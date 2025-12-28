// test-supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Testing Supabase connection...');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Test query
async function testConnection() {
  console.log('🔗 Connecting to Supabase...');
  
  try {
    // Test a simple query
     const { data, error } = await supabase
          .from('group_stats')
          .select('*')
          .limit(1);
        if (error) {
          console.error('❌ Error querying Supabase:', error.message);
          return;
        }

    if (error) {
      console.error('❌ Error querying Supabase:', error.message);
      return;
    }

    console.log('✅ Connection successful!');
    console.log(`📊 Found ${data.length} records in group_stats table`);
    if (data.length > 0) {
      console.log('Sample record:', JSON.stringify(data[0], null, 2));
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

testConnection();
