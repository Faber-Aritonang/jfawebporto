/**
 * News API — Berita Info Rubrik
 * 
 * GET    /api/news           → List curated news articles
 * DELETE /api/news?id=xxx    → Remove article (admin)
 */

const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const { limit = 12, offset = 0, category } = req.query;

    // === DELETE: Remove article (admin only) ===
    if (req.method === 'DELETE') {
      const auth = (req.headers.authorization || '').replace('Bearer ', '');
      if (auth !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required' });

      const { error } = await supabase.from('news_articles').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

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
