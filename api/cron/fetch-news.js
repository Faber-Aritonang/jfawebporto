/**
 * Cron Job: Fetch AI News RSS + Gemini Curation
 * 
 * Runs 2x daily via Vercel Cron (0 1,13 * * * = 08:00 & 20:00 WIB)
 * 
 * Flow:
 *   1. Fetch RSS feeds from top AI news sources
 *   2. Deduplicate against existing articles in Supabase
 *   3. Send to Gemini for scoring & summarization
 *   4. Store top-scored articles in Supabase
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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

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
  // Try to extract from content HTML
  const match = (item.content || '').match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

async function geminiCurate(articles, apiKey) {
  if (!apiKey || articles.length === 0) return articles;

  // Batch articles (max 20 per call to stay under token limits)
  const batch = articles.slice(0, 20);
  const articlesText = batch.map((a, i) =>
    `[${i}] "${a.title}" | Source: ${a.source} | Summary: ${a.summary?.substring(0, 200)}`
  ).join('\n');

  const prompt = `You are an AI news curator for a tech portfolio website focused on AI implementation.

Analyze these articles and return a JSON array. For EACH article, provide:
- index: the article index number
- score: 0-100 relevance score (higher = more relevant for AI implementators)
- summary: a concise 1-2 sentence summary in Indonesian
- category: one of ["ai-news", "llm", "computer-vision", "ai-business", "open-source", "regulation"]

Rules:
- Score HIGH (70-100) for: practical AI implementation, new AI tools/frameworks, business AI adoption, LLM updates, open-source AI
- Score MEDIUM (40-69) for: AI research breakthroughs, AI ethics discussions, industry analysis
- Score LOW (0-39) for: opinion pieces without substance, clickbait, non-AI content
- Only include articles scoring >= 40

Return ONLY the JSON array, no markdown formatting.

Articles:
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
      return articles; // Fallback: return all articles without curation
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) return articles;

    // Parse Gemini response
    let scores;
    try {
      scores = JSON.parse(text);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\[[\s\S]*\]/);
      scores = match ? JSON.parse(match[0]) : [];
    }

    // Merge scores back into articles
    return batch
      .map((article, i) => {
        const scoreData = scores.find(s => s.index === i);
        if (!scoreData || scoreData.score < 40) return null;
        return {
          ...article,
          gemini_score: scoreData.score,
          gemini_summary: scoreData.summary,
          category: scoreData.category || 'ai-news'
        };
      })
      .filter(Boolean);

  } catch (err) {
    console.error('[Gemini] Error:', err.message);
    return articles; // Fallback
  }
}

module.exports = async (req, res) => {
  // Verify cron secret (Vercel Cron uses this)
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET || '';
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow manual trigger from admin
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

    // 1. Fetch all RSS feeds in parallel
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

    // 2. Deduplicate against existing articles
    const { data: existing } = await supabase
      .from('news_articles')
      .select('url')
      .limit(500);

    const existingUrls = new Set((existing || []).map(e => e.url));
    const newArticles = allArticles.filter(a => !existingUrls.has(a.url));

    console.log(`[Dedup] ${newArticles.length} new articles (${allArticles.length - newArticles.length} duplicates)`);

    if (newArticles.length === 0) {
      return res.status(200).json({ message: 'No new articles', count: 0 });
    }

    // 3. Gemini curation
    console.log('[Gemini] Curating articles...');
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

      if (error) {
        console.error('[DB] Insert error:', error);
      } else {
        console.log(`[DB] Inserted ${data?.length || 0} articles`);
      }
    }

    // 5. Cleanup old articles (keep last 200)
    const { data: oldArticles } = await supabase
      .from('news_articles')
      .select('id')
      .order('fetched_at', { ascending: false })
      .range(200, 999);

    if (oldArticles && oldArticles.length > 0) {
      const idsToDelete = oldArticles.map(a => a.id);
      await supabase.from('news_articles').delete().in('id', idsToDelete);
      console.log(`[Cleanup] Removed ${idsToDelete.length} old articles`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cron] Done in ${elapsed}s — ${curated.length} articles stored`);

    return res.status(200).json({
      message: 'News fetched and curated',
      fetched: allArticles.length,
      new: newArticles.length,
      curated: curated.length,
      elapsed: elapsed + 's'
    });

  } catch (err) {
    console.error('[Cron] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
