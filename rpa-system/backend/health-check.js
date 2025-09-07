// Quick server health check script
// Run this to verify your server endpoints are working

const axios = require('axios');

const BASE_URL = 'http://localhost:3030';

const healthChecks = [
  { name: 'Server Health', endpoint: '/health' },
  { name: 'Database Health', endpoint: '/api/health/databases' },
];

async function runHealthCheck() {
  console.log('🔍 Running server health checks...\n');
  
  for (const check of healthChecks) {
    try {
      const response = await axios.get(`${BASE_URL}${check.endpoint}`, {
        timeout: 5000
      });
      
      console.log(`✅ ${check.name}: OK (${response.status})`);
      if (check.endpoint === '/api/health/databases') {
        console.log(`   - Overall: ${response.data.overall.status}`);
        console.log(`   - Supabase: ${response.data.services.supabase.status}`);
        console.log(`   - Firebase: ${response.data.services.firebase.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${check.name}: Server not running on ${BASE_URL}`);
      } else {
        console.log(`❌ ${check.name}: ${error.response?.status || error.message}`);
      }
    }
  }
  
  console.log('\n🔍 Testing authenticated endpoints...');
  console.log('Note: These will fail without proper authentication token');
  
  const authChecks = [
    '/api/user/notifications',
    '/api/user/preferences',
  ];
  
  for (const endpoint of authChecks) {
    try {
      await axios.get(`${BASE_URL}${endpoint}`, { timeout: 2000 });
      console.log(`✅ ${endpoint}: Available`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`🔐 ${endpoint}: Protected (requires auth) - OK`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint}: Server not running`);
      } else {
        console.log(`⚠️ ${endpoint}: ${error.response?.status || error.message}`);
      }
    }
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Ensure your backend server is running on port 3030');
  console.log('2. Apply Firebase security rules from firebase-security-rules.json');
  console.log('3. Set DEV_MOCK_AUTOMATION=true in your .env file');
}

runHealthCheck().catch(console.error);