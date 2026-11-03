const { createClient } = require('@supabase/supabase-js');

let supabaseInstance = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL;
  // Tulis data lewat service role: policy RLS "public read" tidak bisa menahan
  // operasi insert/delete kalau kuncinya anon key.
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_KEY harus di-set (lihat .env.example)');
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.warn('[Supabase] SUPABASE_SERVICE_KEY belum di-set — memakai anon key. Set service key agar akses tulis aman.');
  }

  supabaseInstance = createClient(url, key, { auth: { persistSession: false } });
  return supabaseInstance;
}

module.exports = { getSupabase };
