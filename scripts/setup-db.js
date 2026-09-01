/**
 * Supabase Schema Setup
 * Run: node scripts/setup-db.js
 * 
 * Creates tables:
 *   - blog_posts (opini rubrik)
 *   - news_articles (berita info rubrik)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // service_role key for setup

if (!supabaseUrl || !supabaseKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log('Creating tables...');

  // Blog posts (Opini rubrik)
  const { error: e1 } = await supabase.rpc('exec_sql', {
    query: `
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
    `
  });

  if (e1) {
    // Fallback: create via raw SQL if RPC not available
    console.log('RPC not available, trying direct SQL...');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log(`
-- Blog Posts (Opini)
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

-- News Articles (Berita Info)
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

-- RLS: Public read, service role write
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read blog_posts" ON blog_posts FOR SELECT USING (published = true);
CREATE POLICY "Public read news_articles" ON news_articles FOR SELECT USING (true);
CREATE POLICY "Service all blog_posts" ON blog_posts FOR ALL USING (true);
CREATE POLICY "Service all news_articles" ON news_articles FOR ALL USING (true);
    `);
  } else {
    console.log('Tables created successfully!');
  }
}

setup().catch(console.error);
