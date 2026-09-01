-- ============================================
-- JFA Web Portfolio — Database Schema
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================

-- 1. Blog Posts (Opini & Tulisan)
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

-- 2. News Articles (Berita Info AI — dari RSS + Gemini)
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

-- 3. Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Public bisa baca blog posts yang published
CREATE POLICY "Public read blog_posts" ON blog_posts
  FOR SELECT USING (published = true);

-- Public bisa baca semua news articles
CREATE POLICY "Public read news_articles" ON news_articles
  FOR SELECT USING (true);

-- Service role (API) bisa full akses
CREATE POLICY "Service all blog_posts" ON blog_posts
  FOR ALL USING (true);

CREATE POLICY "Service all news_articles" ON news_articles
  FOR ALL USING (true);
