const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

// Service-role key is used because this is a trusted backend-only client.
// NEVER expose this key to the frontend.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
