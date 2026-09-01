/**
 * Upload API — Blog File Attachments
 * 
 * POST /api/upload → Upload file to Supabase Storage
 * DELETE /api/upload?id=xxx → Delete file
 */

const { getSupabase } = require('../lib/supabase');

function checkAdmin(req) {
  const auth = req.headers.authorization || '';
  return auth.replace('Bearer ', '') === process.env.ADMIN_PASSWORD;
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

    // === POST: Upload file ===
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Send as multipart/form-data' });
      }

      // Parse multipart manually (Vercel serverless doesn't have multer)
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      
      // Simple boundary parse
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return res.status(400).json({ error: 'No boundary' });

      const parts = parseMultipart(buffer, boundary);
      const file = parts.find(p => p.filename);
      const postId = parts.find(p => p.name === 'post_id');

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Upload to Supabase Storage
      const ext = file.filename.split('.').pop();
      const filePath = `attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('blog-attachments')
        .upload(filePath, file.data, {
          contentType: file.contentType,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase
        .storage
        .from('blog-attachments')
        .getPublicUrl(filePath);

      // Save to blog_attachments table
      const attachmentData = {
        post_id: postId?.value || null,
        file_name: file.filename,
        file_url: urlData.publicUrl,
        file_type: file.contentType,
        file_size: file.data.length
      };

      if (postId?.value) {
        const { data, error } = await supabase
          .from('blog_attachments')
          .insert(attachmentData)
          .select()
          .single();

        if (error) throw error;
        return res.status(201).json({ attachment: data });
      }

      return res.status(201).json({
        attachment: {
          ...attachmentData,
          id: null,
          message: 'File uploaded. Link post_id later via PUT.'
        }
      });
    }

    // === DELETE: Delete file ===
    if (req.method === 'DELETE') {
      const { id, file_url } = req.query;
      if (!id && !file_url) return res.status(400).json({ error: 'ID or file_url required' });

      if (id) {
        // Get file path from DB
        const { data: att } = await supabase
          .from('blog_attachments')
          .select('file_url')
          .eq('id', id)
          .single();

        if (att?.file_url) {
          const path = att.file_url.split('/blog-attachments/')[1];
          if (path) await supabase.storage.from('blog-attachments').remove([path]);
        }
        await supabase.from('blog_attachments').delete().eq('id', id);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// Simple multipart parser
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length + 2;

  while (start < buffer.length) {
    const end = buffer.indexOf(boundaryBuf, start);
    if (end === -1) break;

    const partData = buffer.slice(start, end - 2); // -2 for \r\n
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + boundaryBuf.length + 2; continue; }

    const headers = partData.slice(0, headerEnd).toString();
    const body = partData.slice(headerEnd + 4);

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/i);

    parts.push({
      name: nameMatch?.[1],
      filename: filenameMatch?.[1],
      contentType: contentTypeMatch?.[1]?.trim() || 'application/octet-stream',
      data: body,
      value: body.toString()
    });

    start = end + boundaryBuf.length + 2;
  }
  return parts;
}
