-- ============================================
-- JFA Web Portfolio — Database Schema v2
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================

-- 1. Blog Posts (Opini + AI Keseharian)
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  category TEXT DEFAULT 'opini',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);

-- 2. Blog Attachments (file PPT, video, gambar, dll)
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

-- 3. News Articles (Berita Info AI)
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT,
  summary TEXT,
  category TEXT DEFAULT 'ai-news',
  image_url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  gemini_score FLOAT DEFAULT 0,
  gemini_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_fetched ON news_articles(fetched_at DESC);

-- 4. Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read blog_posts" ON blog_posts
  FOR SELECT USING (published = true);
CREATE POLICY "Public read blog_attachments" ON blog_attachments
  FOR SELECT USING (true);
CREATE POLICY "Public read news_articles" ON news_articles
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service all blog_posts" ON blog_posts
  FOR ALL USING (true);
CREATE POLICY "Service all blog_attachments" ON blog_attachments
  FOR ALL USING (true);
CREATE POLICY "Service all news_articles" ON news_articles
  FOR ALL USING (true);

-- 5. Supabase Storage Bucket untuk file attachments
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

-- Storage policies
CREATE POLICY "Public read storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-attachments');

CREATE POLICY "Service insert storage" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'blog-attachments');

CREATE POLICY "Service delete storage" ON storage.objects
  FOR DELETE USING (bucket_id = 'blog-attachments');
