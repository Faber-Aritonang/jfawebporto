-- ============================================
-- JFA Web Portfolio — Database Schema v2
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
--
-- AMAN DIJALANKAN BERULANG: setiap CREATE POLICY selalu didahului
-- DROP POLICY IF EXISTS. Kalau SQL Editor menampilkan error
-- "policy ... already exists", berarti yang dijalankan masih salinan lama —
-- tutup tab query tersebut, buka ulang file ini dari repo, lalu Run lagi.
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
-- Semua operasi tulis dilakukan server memakai service_role key, yang otomatis
-- bypass RLS. Jadi policy di bawah hanya perlu mengatur akses baca publik —
-- JANGAN menambah policy "FOR ALL USING (true)", karena itu membuka tulis
-- untuk siapa pun yang memegang anon key.

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Idempotent: aman dijalankan ulang untuk migrasi database yang sudah ada
DROP POLICY IF EXISTS "Public read blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "Public read blog_attachments" ON blog_attachments;
DROP POLICY IF EXISTS "Public read news_articles" ON news_articles;
DROP POLICY IF EXISTS "Service all blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "Service all blog_attachments" ON blog_attachments;
DROP POLICY IF EXISTS "Service all news_articles" ON news_articles;

-- Public read policies
CREATE POLICY "Public read blog_posts" ON blog_posts
  FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "Public read blog_attachments" ON blog_attachments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read news_articles" ON news_articles
  FOR SELECT TO anon, authenticated USING (true);

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
-- Upload dari browser memakai signed upload URL (ditandatangani server dengan
-- service_role key), jadi tidak perlu policy INSERT/DELETE untuk anon.
DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
DROP POLICY IF EXISTS "Service insert storage" ON storage.objects;
DROP POLICY IF EXISTS "Service delete storage" ON storage.objects;

CREATE POLICY "Public read storage" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'blog-attachments');
