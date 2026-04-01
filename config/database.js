const { createClient } = require('@supabase/supabase-js');

const DB_PROVIDER = (process.env.DB_PROVIDER || 'supabase').toLowerCase();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let connected = false;
let supabaseClient = null;

function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).'
    );
  }
}

async function connectSupabase() {
  assertSupabaseConfig();

  if (supabaseClient) {
    connected = true;
    return supabaseClient;
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  connected = true;

  console.log('✅ Supabase client initialized');
  console.log(`   Provider: ${DB_PROVIDER}`);
  console.log(`   URL: ${SUPABASE_URL}`);

  return supabaseClient;
}

async function connectDB() {
  if (DB_PROVIDER !== 'supabase') {
    throw new Error(`Unsupported DB_PROVIDER "${DB_PROVIDER}". Current supported provider: supabase`);
  }
  return connectSupabase();
}

function isDatabaseConnected() {
  return connected;
}

function getDatabaseClient() {
  return supabaseClient;
}

async function disconnectDB() {
  connected = false;
  supabaseClient = null;
}

module.exports = {
  connectDB,
  disconnectDB,
  getDatabaseClient,
  isDatabaseConnected,
  DB_PROVIDER
};
