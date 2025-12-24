const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
console.log('🔧 Loading environment variables from .env file');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
    throw new Error('Supabase URL is missing in the .env file');
}
if (!supabaseKey) {
    throw new Error('Supabase Key is missing in the .env file');
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized successfully');

module.exports = supabase;