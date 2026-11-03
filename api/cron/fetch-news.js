/**
 * Cron: Fetch AI news RSS → Gemini curation (score + translate) → Supabase
 *
 * Dijalankan otomatis oleh Vercel Cron (lihat vercel.json), atau manual:
 *   curl -H "x-admin-token: $ADMIN_PASSWORD" https://<domain>/api/cron/fetch-news
 *
 * Flow:
 *   1. Fetch RSS feeds dari sumber berita AI
 *   2. Deduplicate (di dalam batch + terhadap isi Supabase)
 *   3. Gemini: skor relevansi + terjemahan judul/ringkasan ke Bahasa Indonesia
 *   4. Upsert artikel skor >= 40, lalu simpan hanya 200 artikel terbaru
 */

const RSSParser = require('rss-parser');
const { getSupabase } = require('../../lib/supabase');

// AI News RSS Feeds
const RSS_FEEDS = [
  { name: 'MIT Technology Review - AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'The Verge - AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'VentureBeat - AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Ars Technica - AI', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'TechCrunch - AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Hacker News - AI', url: 'https://hnrss.org/newest?q=artificial+intelligence+OR+LLM+OR+GPT&points=50' },
];

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
const BATCH_SIZE = 10;   // artikel per panggilan Gemini
const MAX_ARTICLES = 40; // batasi agar tidak timeout di serverless
const MIN_SCORE = 40;
const KEEP_ARTICLES = 200;

// ─── RSS ───────────────────────────────────────────────────────────
async function fetchRSS(feedUrl, timeoutMs = 8000) {
  const parser = new RSSParser({
    timeout: timeoutMs,
    headers: { 'User-Agent': 'JFA-Portfolio-Bot/1.0' },
    customFields: { item: [['media:content', 'mediaContent'], ['media:thumbnail', 'mediaThumbnail']] },
  });

  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 15).map(item => ({
      title: item.title || 'Untitled',
      url: item.link || '',
      source: feed.title || feedUrl,
      summary: (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').substring(0, 300),
      published_at: item.pubDate || item.isoDate || new Date().toISOString(),
      image_url: extractImage(item),
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

// ─── GEMINI: skor + terjemahan ─────────────────────────────────────
async function geminiBatch(articles, apiKey) {
  if (!apiKey || articles.length === 0) return [];

  const list = articles.map((a, i) =>
    `[${i}] "${a.title}" | Sumber: ${a.source} | Isi: ${a.summary}`
  ).join('\n');

  const prompt = `Anda kurator berita AI untuk portfolio seorang AI Implementator.
Pilih artikel yang relevan, beri skor, DAN terjemahkan ke Bahasa Indonesia.

ARTIKEL:
${list}

KEMBALIKAN hanya JSON array (tanpa markdown, tanpa penjelasan):
[
  { "index": 0, "score": 85, "title_id": "Judul dalam Bahasa Indonesia", "summary_id": "Ringkasan 1-2 kalimat", "category": "ai-news" }
]

Aturan:
- Skor 0-100. Sertakan hanya artikel dengan skor >= ${MIN_SCORE}
- Skor TINGGI (70-100): implementasi AI praktis, tools/framework AI baru, adopsi AI di bisnis, update LLM, AI open-source
- Skor SEDANG (40-69): riset AI, diskusi etika AI, analisis industri
- Skor RENDAH (0-39): opini tanpa isi, clickbait, bukan tentang AI
- title_id: terjemahkan ke Bahasa Indonesia, pertahankan istilah teknis (LLM, GPT, AI, ML)
- summary_id: ringkasan dalam Bahasa Indonesia
- category: "ai-news" | "llm" | "computer-vision" | "ai-business" | "open-source" | "regulation"
- Jika tidak ada yang relevan, kembalikan []`;

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
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

    let scores;
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      scores = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      try { scores = match ? JSON.parse(match[0]) : []; } catch { scores = []; }
    }
    if (!Array.isArray(scores)) return [];

    return articles
      .map((article, i) => {
        const s = scores.find(x => x.index === i);
        if (!s || (s.score || 0) < MIN_SCORE) return null;
        return {
          title: s.title_id || article.title,
          summary: s.summary_id || article.summary,
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

async function curate(articles, apiKey) {
  const curated = [];
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(`[Gemini] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)} (${batch.length} artikel)...`);
    curated.push(...await geminiBatch(batch, apiKey));
  }
  return curated;
}

// ─── MAIN ──────────────────────────────────────────────────────────
function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const authHeader = req.headers.authorization || '';
  const adminToken = req.headers['x-admin-token'] || req.query.token;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (adminPassword && adminToken === adminPassword) return true;
  return false;
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting news fetch...');

  try {
    const supabase = getSupabase();
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Fetch semua feed secara paralel
    const results = await Promise.allSettled(RSS_FEEDS.map(feed => fetchRSS(feed.url)));

    let allArticles = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        allArticles = allArticles.concat(r.value);
        console.log(`[RSS] ${RSS_FEEDS[i].name}: ${r.value.length} artikel`);
      }
    });
    console.log(`[RSS] Total: ${allArticles.length}`);

    if (allArticles.length === 0) {
      return res.status(200).json({ message: 'No articles fetched', fetched: 0, new: 0, stored: 0 });
    }

    // 2a. Dedupe di dalam hasil fetch
    const seen = new Set();
    allArticles = allArticles.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    // 2b. Dedupe terhadap isi database
    const { data: existing } = await supabase.from('news_articles').select('url').limit(500);
    const existingUrls = new Set((existing || []).map(e => e.url));
    const newArticles = allArticles.filter(a => !existingUrls.has(a.url));
    console.log(`[Dedup] ${newArticles.length} artikel baru (${allArticles.length - newArticles.length} duplikat)`);

    if (newArticles.length === 0) {
      return res.status(200).json({ message: 'No new articles', fetched: allArticles.length, new: 0, stored: 0 });
    }

    // 3. Kurasi Gemini (batas MAX_ARTICLES agar tidak timeout)
    const toProcess = newArticles.slice(0, MAX_ARTICLES);
    let curated = geminiKey ? await curate(toProcess, geminiKey) : [];

    // Fallback: tanpa Gemini / Gemini gagal → simpan apa adanya dengan skor default
    if (curated.length === 0) {
      console.warn('[Gemini] Tidak ada hasil kurasi — memakai fallback skor default');
      curated = toProcess.map(a => ({
        title: a.title,
        summary: a.summary,
        category: 'ai-news',
        score: 50,
        original: a,
      }));
    }
    console.log(`[Gemini] ${curated.length} artikel disimpan`);

    // 4. Upsert (url unik, jadi artikel yang sama tidak dobel)
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

    const { data: inserted, error } = await supabase
      .from('news_articles')
      .upsert(toInsert, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('[DB] Upsert error:', error);
      throw error;
    }
    console.log(`[DB] ${inserted?.length || 0} artikel tersimpan`);

    // 5. Cleanup: simpan KEEP_ARTICLES terbaru
    const { data: oldArticles } = await supabase
      .from('news_articles')
      .select('id')
      .order('fetched_at', { ascending: false })
      .range(KEEP_ARTICLES, 999);

    if (oldArticles && oldArticles.length > 0) {
      await supabase.from('news_articles').delete().in('id', oldArticles.map(a => a.id));
      console.log(`[Cleanup] ${oldArticles.length} artikel lama dihapus`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] Selesai dalam ${elapsed}s`);

    return res.status(200).json({
      message: 'News fetched and curated',
      fetched: allArticles.length,
      new: newArticles.length,
      curated: curated.length,
      stored: inserted?.length || 0,
      elapsed: elapsed + 's',
    });
  } catch (err) {
    console.error('[Cron] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Gemini bisa lambat untuk banyak batch — beri ruang sampai 60 detik
module.exports.config = { maxDuration: 60 };
