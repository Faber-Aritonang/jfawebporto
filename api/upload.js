/**
 * Upload API — lampiran blog langsung ke Supabase Storage (signed upload URL)
 *
 * POST /api/upload  { action: 'sign', file_name, file_type, file_size }
 *   → { upload_url, token, path, public_url }
 *   Browser melakukan PUT langsung ke `upload_url`, jadi ukuran file tidak
 *   dibatasi body-parser Vercel (±4.5MB) melainkan limit bucket (100MB).
 *
 * POST /api/upload  { action: 'finalize', post_id, file_name, file_url, file_type, file_size }
 *   → { attachment }
 *
 * DELETE /api/upload?id=xxx → hapus objek Storage + baris DB
 */

const { getSupabase } = require('../lib/supabase');

const BUCKET = 'blog-attachments';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB — sama dengan file_size_limit bucket
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/zip',
];

const EXT_BY_TYPE = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

function checkAdmin(req) {
  const auth = req.headers.authorization || '';
  return auth.replace('Bearer ', '') === process.env.ADMIN_PASSWORD;
}

function safeExtension(fileName, fileType) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(String(fileName || ''));
  if (match) return match[1].toLowerCase();
  return EXT_BY_TYPE[fileType] || 'bin';
}

function publicPrefix() {
  return `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!checkAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabase();

    // === POST: sign / finalize ===
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      body = body || {};

      const action = body.action || 'sign';

      // --- Step 1: izin upload + URL tujuan ---
      if (action === 'sign') {
        const fileName = String(body.file_name || '').trim();
        const fileType = String(body.file_type || '').trim();
        const fileSize = Number(body.file_size || 0);

        if (!fileName) return res.status(400).json({ error: 'file_name wajib diisi' });
        if (!ALLOWED_TYPES.includes(fileType)) {
          return res.status(400).json({ error: `Tipe file tidak didukung: ${fileType || 'unknown'}` });
        }
        if (!Number.isFinite(fileSize) || fileSize <= 0) {
          return res.status(400).json({ error: 'file_size tidak valid' });
        }
        if (fileSize > MAX_FILE_SIZE) {
          return res.status(400).json({ error: 'File terlalu besar (maks 100MB)' });
        }

        const ext = safeExtension(fileName, fileType);
        const path = `attachments/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

        const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) throw error;

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

        return res.status(200).json({
          upload_url: data.signedUrl,
          token: data.token,
          path: data.path || path,
          public_url: urlData.publicUrl,
        });
      }

      // --- Step 2: catat lampiran ke database setelah upload selesai ---
      if (action === 'finalize') {
        const postId = body.post_id;
        const fileName = String(body.file_name || '').trim();
        const fileUrl = String(body.file_url || '').trim();
        const fileType = String(body.file_type || '').trim();
        const fileSize = Number(body.file_size || 0);

        if (!postId) return res.status(400).json({ error: 'post_id wajib diisi' });
        if (!fileName) return res.status(400).json({ error: 'file_name wajib diisi' });
        if (!ALLOWED_TYPES.includes(fileType)) {
          return res.status(400).json({ error: 'Tipe file tidak didukung' });
        }
        if (!fileUrl.startsWith(publicPrefix())) {
          return res.status(400).json({ error: 'file_url harus berasal dari bucket blog-attachments' });
        }
        if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
          return res.status(400).json({ error: 'Ukuran file tidak valid' });
        }

        const { data, error } = await supabase
          .from('blog_attachments')
          .insert({
            post_id: postId,
            file_name: fileName,
            file_url: fileUrl,
            file_type: fileType,
            file_size: Math.round(fileSize),
          })
          .select()
          .single();

        if (error) throw error;
        return res.status(201).json({ attachment: data });
      }

      return res.status(400).json({ error: 'action harus "sign" atau "finalize"' });
    }

    // === DELETE: hapus objek Storage + baris DB ===
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required' });

      const { data: att } = await supabase
        .from('blog_attachments')
        .select('file_url')
        .eq('id', id)
        .single();

      if (att?.file_url) {
        const path = att.file_url.split(`/${BUCKET}/`)[1];
        if (path) await supabase.storage.from(BUCKET).remove([path]);
      }
      await supabase.from('blog_attachments').delete().eq('id', id);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
