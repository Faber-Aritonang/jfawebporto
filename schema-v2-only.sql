-- ============================================
-- HANYA tambahan baru (jalan schema v1 dulu)
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
ALTER TABLE blog_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read blog_attachments" ON blog_attachments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service all blog_attachments" ON blog_attachments FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
DO $$ BEGIN
  CREATE POLICY "Public read storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'blog-attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service insert storage" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'blog-attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service delete storage" ON storage.objects
    FOR DELETE USING (bucket_id = 'blog-attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
