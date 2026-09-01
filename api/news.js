/**
 * News API — Berita Info Rubrik
 * 
 * GET /api/news → List curated news articles
 */

const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const { limit = 12, offset = 0, category } = req.query;

    let q = supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (category) {
      q = q.eq('category', category);
    }

    const { data, error } = await q;
    if (error) throw error;

    return res.status(200).json({ articles: data || [] });

  } catch (err) {
    console.error('[News API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
