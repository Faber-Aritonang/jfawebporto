-- ============================================
-- HANYA tambahan baru (jalan schema v1 dulu)
-- Aman dijalankan ulang: policy lama di-drop dulu sebelum dibuat ulang.
-- ============================================

-- 1. Tabel Blog Attachments (file PPT, video, dll)
CREATE TABLE IF NOT EXISTS blog_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_post ON blog_attachments(post_id);

-- 2. RLS untuk blog_attachments
-- Tulis dilakukan server memakai service_role key (bypass RLS), jadi anon
-- hanya butuh akses baca. Policy "FOR ALL USING (true)" tidak dibuat lagi.
ALTER TABLE blog_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read blog_attachments" ON blog_attachments;
DROP POLICY IF EXISTS "Service all blog_attachments" ON blog_attachments;

CREATE POLICY "Public read blog_attachments" ON blog_attachments
  FOR SELECT TO anon, authenticated USING (true);

-- 3. Storage Bucket untuk file attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-attachments',
  'blog-attachments',
  true,
  104857600,
  ARRAY[
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
    'application/zip'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 4. Storage Policies
-- Upload dari browser memakai signed upload URL (ditandatangani server),
-- jadi tidak perlu policy INSERT/DELETE untuk anon.
DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
DROP POLICY IF EXISTS "Service insert storage" ON storage.objects;
DROP POLICY IF EXISTS "Service delete storage" ON storage.objects;

CREATE POLICY "Public read storage" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'blog-attachments');
