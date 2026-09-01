/**
 * Blog API — Opini & AI Keseharian Rubrik
 * 
 * GET    /api/blog           → List published posts
 * GET    /api/blog?slug=xxx  → Get single post with attachments
 * POST   /api/blog           → Create post (admin)
 * PUT    /api/blog           → Update post (admin)
 * DELETE /api/blog?id=xxx    → Delete post (admin)
 * POST   /api/blog/upload    → Upload file attachment (admin)
 */

const { getSupabase } = require('../lib/supabase');

function checkAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  return token === process.env.ADMIN_PASSWORD;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const { method, query } = req;
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    // === GET: List, Get single, or Auth check ===
    if (method === 'GET') {
      const { slug, category, limit = 20, offset = 0, auth } = query;

      // Auth check: admin login
      if (auth === 'check') {
        if (checkAdmin(req)) {
          return res.status(200).json({ ok: true });
        }
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (slug) {
        // Get single post with attachments
        const { data: post, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('published', true)
          .single();

        if (error || !post) {
          return res.status(404).json({ error: 'Post not found' });
        }

        // Fetch attachments
        const { data: attachments } = await supabase
          .from('blog_attachments')
          .select('*')
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        return res.status(200).json({
          post: { ...post, attachments: attachments || [] }
        });
      }

      // List posts
      let q = supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (category) {
        q = q.eq('category', category);
      }

      const { data: posts, error } = await q;
      if (error) throw error;

      return res.status(200).json({ posts: posts || [] });
    }

    // === POST: Create post ===
    if (method === 'POST') {
      if (!checkAdmin(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { title, content, excerpt, cover_image, category, tags, published } = body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
      }

      const slug = slugify(title) + '-' + Date.now().toString(36);

      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title,
          slug,
          content,
          excerpt: excerpt || content.substring(0, 200) + '...',
          cover_image: cover_image || null,
          category: category || 'opini',
          tags: tags || [],
          published: published !== false
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ post: data });
    }

    // === PUT: Update post ===
    if (method === 'PUT') {
      if (!checkAdmin(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, title, content, excerpt, cover_image, category, tags, published } = body;

      if (!id) return res.status(400).json({ error: 'Post ID required' });

      const updates = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (excerpt !== undefined) updates.excerpt = excerpt;
      if (cover_image !== undefined) updates.cover_image = cover_image;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags;
      if (published !== undefined) updates.published = published;

      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ post: data });
    }

    // === DELETE: Delete post ===
    if (method === 'DELETE') {
      if (!checkAdmin(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = query;
      if (!id) return res.status(400).json({ error: 'Post ID required' });

      // Delete attachments first
      await supabase.from('blog_attachments').delete().eq('post_id', id);
      
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[Blog API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
