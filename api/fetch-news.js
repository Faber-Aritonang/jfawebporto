/**
 * Cron Job: Fetch AI News RSS + Gemini Curation + Indonesian Translation
 *
 * Runs 2x daily via Vercel Cron (08:00 & 20:00 WIB)
 *
 * Flow:
 *   1. Fetch RSS feeds from top AI news sources
 *   2. Send to Gemini in batches for scoring + translation to Indonesian
 *   3. Store curated articles in Supabase
 */

const RSSParser = require('rss-parser');
const { getSupabase } = require('../lib/supabase');

// AI News RSS Feeds
const RSS_FEEDS = [
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=artificial+intelligence+OR+LLM+OR+GPT+OR+machine+learning&points=30' },
  { name: 'MIT Tech Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'DailySocial', url: 'https://dailysocial.id/feed' },
  { name: 'Katadata', url: 'https://katadata.co.id/feed' },
];

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
const BATCH_SIZE = 10; // articles per Gemini call
const MAX_ARTICLES = 60; // max articles to curate total (avoid timeout)
const MIN_SCORE = 40;

// ─── RSS ───────────────────────────────────────────────────────────
async function fetchRSS(feedUrl, timeoutMs = 8000) {
  const parser = new RSSParser({
    timeout: timeoutMs,
    headers: { 'User-Agent': 'JFA-Portfolio-Bot/1.0' },
  });
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 15).map(item => ({
      title: item.title || 'Untitled',
      url: item.link || '',
      source: feed.title || 'Unknown',
      summary: (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').substring(0, 300),
      published_at: item.pubDate || item.isoDate || new Date().toISOString(),
      image_url: item.enclosure?.url || item.mediaThumbnail?.$?.url || null,
    })).filter(item => item.title && item.url);
  } catch (err) {
    console.error(`[RSS] Failed: ${feedUrl}`, err.message);
    return [];
  }
}

// ─── GEMINI: Score + Translate to Indonesian ───────────────────────
async function geminiBatch(articles, apiKey) {
  if (!apiKey || articles.length === 0) return [];

  const list = articles.map((a, i) =>
    `[${i}] "${a.title}" | Sumber: ${a.source} | Isi: ${a.summary}`
  ).join('\n');

  const prompt = `Anda kurator berita AI. Tugas: Pilih artikel yang relevan, beri skor, DAN terjemahkan ke Bahasa Indonesia.

ARTIKEL:
${list}

KEMBALIKAN hanya JSON array (tanpa markdown, tanpa penjelasan):
[
  {
    "index": 0,
    "score": 85,
    "title_id": "Judul dalam Bahasa Indonesia",
    "summary_id": "Ringkasan 1-2 kalimat dalam Bahasa Indonesia",
    "category": "ai-news"
  }
]

Aturan:
- Skor 0-100. Hanya sertakan artikel dengan skor >= 40
- title_id: TERJEMAHKAN ke Indonesia. Pertahankan istilah teknis (LLM, GPT, AI, ML, dll)
- summary_id: Ringkasan dalam Bahasa Indonesia
- category: "ai-news" | "llm" | "computer-vision" | "ai-business" | "open-source" | "regulation"
- Jika artikel sudah Indonesia, tetap masukkan di title_id/summary_id
- Kembalikan JSON array saja. Jika tidak ada yang relevan, kembalikan []`;

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[Gemini] HTTP', resp.status, err.substring(0, 200));
      return [];
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle markdown code blocks)
    let scores;
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      scores = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      scores = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(scores)) return [];

    return articles
      .map((article, i) => {
        const s = scores.find(x => x.index === i);
        if (!s || (s.score || 0) < MIN_SCORE) return null;
        return {
          title: s.title_id || s.title || article.title,
          summary: s.summary_id || s.summary || article.summary,
          category: s.category || 'ai-news',
          score: s.score,
          original: article,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[Gemini] Error:', err.message);
    return [];
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // Auth check
  const token = req.headers['x-admin-token'] || req.query.token;
  const adminPw = process.env.ADMIN_PASSWORD || '';
  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = req.headers.authorization || '';

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron auth OK
  } else if (adminPw && token === adminPw) {
    // Admin auth OK
  } else if (cronSecret || adminPw) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting news fetch...');

  try {
    const supabase = getSupabase();
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Fetch RSS
    console.log(`[RSS] Fetching ${RSS_FEEDS.length} feeds...`);
    const results = await Promise.allSettled(
      RSS_FEEDS.map(f => fetchRSS(f.url))
    );

    let allArticles = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        allArticles = allArticles.concat(r.value);
        console.log(`[RSS] ${RSS_FEEDS[i].name}: ${r.value.length}`);
      }
    });

    console.log(`[RSS] Total: ${allArticles.length}`);
    if (allArticles.length === 0) {
      return res.status(200).json({ pesan: 'Tidak ada artikel', diambil: 0 });
    }

    // 2. Deduplicate by URL
    const seen = new Set();
    allArticles = allArticles.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
    console.log(`[Dedup] Unique: ${allArticles.length}`);

    // 3. Limit to avoid timeout
    const toProcess = allArticles.slice(0, MAX_ARTICLES);

    // 4. Gemini: score + translate in batches
    let curated = [];
    if (geminiKey) {
      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        console.log(`[Gemini] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toProcess.length / BATCH_SIZE)} (${batch.length} articles)...`);
        const result = await geminiBatch(batch, geminiKey);
        curated = curated.concat(result);
        console.log(`[Gemini] → ${result.length} scored >= ${MIN_SCORE}`);
      }
    } else {
      // No Gemini key — insert all with default score
      curated = toProcess.map(a => ({
        title: a.title,
        summary: a.summary,
        category: 'ai-news',
        score: 50,
        original: a,
      }));
    }

    console.log(`[Gemini] Total curated: ${curated.length}`);

    // 5. Clear old + insert new
    await supabase.from('news_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('[DB] Cleared old articles');

    if (curated.length > 0) {
      const toInsert = curated.map(c => ({
        title: c.title,
        url: c.original.url,
        source: c.original.source,
        summary: c.summary,
        gemini_summary: c.summary,
        category: c.category,
        image_url: c.original.image_url,
        published_at: c.original.published_at,
        gemini_score: c.score,
      }));

      const { error } = await supabase.from('news_articles').insert(toInsert);
      if (error) console.error('[DB] Insert error:', error);
      else console.log(`[DB] Inserted ${toInsert.length} articles`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] Done in ${elapsed}s`);

    return res.status(200).json({
      pesan: 'Selesai',
      diambil: allArticles.length,
      baru: curated.length,
      dikurasi: curated.length,
      'waktu berlalu': elapsed + ' detik',
    });
  } catch (err) {
    console.error('[Cron] Fatal:', err);
    return res.status(500).json({ error: err.message });
  }
};
