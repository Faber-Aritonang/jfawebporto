/**
 * Cron Job: Fetch AI News RSS + Gemini Curation + Translation
 * 
 * Runs 2x daily via Vercel Cron (0 1,13 * * * = 08:00 & 20:00 WIB)
 * 
 * Flow:
 *   1. Fetch RSS feeds from top AI news sources
 *   2. Deduplicate against existing articles in Supabase
 *   3. Send to Gemini for scoring, summarization, AND translation to Indonesian
 *   4. Store top-scored articles in Supabase
 */

const RSSParser = require('rss-parser');
const { getSupabase } = require('../lib/supabase');

// AI News RSS Feeds — kredibel & sering update
const RSS_FEEDS = [
  // Internasional (akan diterjemahkan ke Indonesia)
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=artificial+intelligence+OR+LLM+OR+GPT+OR+machine+learning&points=30' },
  { name: 'MIT Tech Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'Towards AI', url: 'https://towardsai.net/feed' },
  // Indonesia 🇮🇩
  { name: 'DailySocial AI', url: 'https://dailysocial.id/feed' },
  { name: 'Katadata AI', url: 'https://katadata.co.id/feed' },
];

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function fetchRSS(feedUrl, timeoutMs = 10000) {
  const parser = new RSSParser({
    timeout: timeoutMs,
    headers: { 'User-Agent': 'JFA-Portfolio-Bot/1.0' },
    customFields: { item: [['media:content', 'mediaContent'], ['media:thumbnail', 'mediaThumbnail']] }
  });

  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).map(item => ({
      title: item.title || 'Untitled',
      url: item.link || '',
      source: feed.title || feedUrl,
      summary: (item.contentSnippet || item.content || '').substring(0, 500),
      published_at: item.pubDate || item.isoDate || new Date().toISOString(),
      image_url: extractImage(item)
    })).filter(item => item.title && item.url);
  } catch (err) {
    console.error(`[RSS] Failed: ${feedUrl}`, err.message);
    return [];
  }
}

function extractImage(item) {
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url) return item.enclosure.url;
  const match = (item.content || '').match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

async function geminiCurate(articles, apiKey) {
  if (!apiKey || articles.length === 0) return articles;

  const batch = articles.slice(0, 20);
  const articlesText = batch.map((a, i) =>
    `[${i}] "${a.title}" | Source: ${a.source} | Summary: ${a.summary?.substring(0, 200)}`
  ).join('\n');

  const prompt = `Anda adalah kurator berita AI untuk website portfolio.

Analisis artikel-artikel ini dan kembalikan array JSON. UNTUK SETIAP artikel, berikan:
- index: nomor index artikel
- score: 0-100 skor relevansi (semakin tinggi = semakin relevan untuk AI implementator)
- title_id: judul artikel DITERJEMAHKAN ke Bahasa Indonesia yang baik dan benar
- summary_id: ringkasan 1-2 kalimat dalam Bahasa Indonesia
- category: salah satu dari ["ai-news", "llm", "computer-vision", "ai-business", "open-source", "regulation"]

Aturan scoring:
- TINGGI (70-100): implementasi AI praktis, tools/framework AI baru, adopsi bisnis AI, update LLM, AI open-source
- SEDANG (40-69): breakthrough riset AI, diskusi etika AI, analisis industri
- RENDAH (0-39): opini tanpa substansi, clickbait, konten non-AI
- Hanya sertakan artikel dengan score >= 40

Aturan terjemahan:
- Jika judul/ringkasan asli sudah Bahasa Indonesia, gunakan asli
- Jika Bahasa Inggris, TERJEMAHKAN ke Bahasa Indonesia yang alami
- Pertahankan istilah teknis (LLM, GPT, AI, ML) dalam bahasa aslinya

Kembalikan HANYA array JSON, tanpa formatting markdown.

Artikel:
${articlesText}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini] API error:', response.status, errText.substring(0, 200));
      return articles;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) return articles;

    let scores;
    try { scores = JSON.parse(text); }
    catch { const match = text.match(/\[[\s\S]*\]/); scores = match ? JSON.parse(match[0]) : []; }

    return batch
      .map((article, i) => {
        const scoreData = scores.find(s => s.index === i);
        if (!scoreData || scoreData.score < 40) return null;
        return {
          ...article,
          title: scoreData.title_id || article.title, // Gunakan judul Indonesia
          summary: scoreData.summary_id || article.summary, // Gunakan ringkasan Indonesia
          gemini_score: scoreData.score,
          gemini_summary: scoreData.summary_id,
          category: scoreData.category || 'ai-news'
        };
      })
      .filter(Boolean);

  } catch (err) {
    console.error('[Gemini] Error:', err.message);
    return articles;
  }
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const adminAuth = req.headers['x-admin-token'] || req.query.token;
    if (adminAuth !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();
  console.log('[Cron] Starting news fetch...');

  try {
    const supabase = getSupabase();
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Fetch all RSS feeds
    console.log(`[RSS] Fetching ${RSS_FEEDS.length} feeds...`);
    const feedResults = await Promise.allSettled(
      RSS_FEEDS.map(feed => fetchRSS(feed.url))
    );

    let allArticles = [];
    feedResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allArticles = allArticles.concat(result.value);
        console.log(`[RSS] ${RSS_FEEDS[i].name}: ${result.value.length} articles`);
      } else {
        console.error(`[RSS] ${RSS_FEEDS[i].name}: FAILED`);
      }
    });

    console.log(`[RSS] Total fetched: ${allArticles.length} articles`);
    if (allArticles.length === 0) {
      return res.status(200).json({ message: 'No articles fetched', count: 0 });
    }

    // 2. Deduplicate
    const { data: existing } = await supabase.from('news_articles').select('url').limit(500);
    const existingUrls = new Set((existing || []).map(e => e.url));
    const newArticles = allArticles.filter(a => !existingUrls.has(a.url));
    console.log(`[Dedup] ${newArticles.length} new (${allArticles.length - newArticles.length} dupes)`);

    if (newArticles.length === 0) {
      return res.status(200).json({ message: 'No new articles', count: 0 });
    }

    // 3. Gemini curation + translation
    console.log('[Gemini] Curating + translating to Indonesian...');
    const curated = await geminiCurate(newArticles, geminiKey);
    console.log(`[Gemini] ${curated.length} articles scored >= 40`);

    // 4. Insert into Supabase
    if (curated.length > 0) {
      const toInsert = curated.map(a => ({
        title: a.title,
        url: a.url,
        source: a.source,
        summary: a.gemini_summary || a.summary,
        category: a.category || 'ai-news',
        image_url: a.image_url,
        published_at: a.published_at,
        gemini_score: a.gemini_score || 50,
        gemini_summary: a.gemini_summary
      }));

      const { data, error } = await supabase
        .from('news_articles')
        .upsert(toInsert, { onConflict: 'url', ignoreDuplicates: false })
        .select();

      if (error) console.error('[DB] Insert error:', error);
      else console.log(`[DB] Inserted ${data?.length || 0} articles`);
    }

    // 5. Cleanup old (keep last 200)
    const { data: oldArticles } = await supabase
      .from('news_articles')
      .select('id')
      .order('fetched_at', { ascending: false })
      .range(200, 999);

    if (oldArticles && oldArticles.length > 0) {
      await supabase.from('news_articles').delete().in('id', oldArticles.map(a => a.id));
      console.log(`[Cleanup] Removed ${oldArticles.length} old articles`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] Done in ${elapsed}s — ${curated.length} articles stored`);
    return res.status(200).json({ message: 'Done', fetched: allArticles.length, new: newArticles.length, curated: curated.length, elapsed: elapsed + 's' });

  } catch (err) {
    console.error('[Cron] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
