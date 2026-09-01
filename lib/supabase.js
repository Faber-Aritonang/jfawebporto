const { createClient } = require('@supabase/supabase-js');

let supabaseInstance = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

module.exports = { getSupabase };
