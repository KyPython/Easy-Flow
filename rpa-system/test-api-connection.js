#!/usr/bin/env node

// API Connection Test Script
// This script helps debug API connectivity issues between frontend and backend

const axios = require('axios');

// Configuration
const API_URLS = [
  'http://localhost:3030',
  'https://easyflow-backend-ad8e.onrender.com'
];

const ENDPOINTS = [
  '/health',
  '/api/firebase/token',
  '/api/user/preferences'
];

async function testConnection(baseUrl, endpoint) {
  try {
    const url = `${baseUrl}${endpoint}`;
    console.log(`Testing: ${url}`);
    
    const response = await axios.get(url, { 
      timeout: 5000,
      validateStatus: (status) => status < 500 // Accept 4xx as "connection working"
    });
    
    return {
      url,
      status: response.status,
      success: true,
      message: `✅ ${response.status} - ${response.statusText}`
    };
    
  } catch (error) {
    return {
      url: `${baseUrl}${endpoint}`,
      status: error.response?.status || 'ERROR',
      success: false,
      message: `❌ ${error.code || error.message}`
    };
  }
}

async function main() {
  console.log('🔍 EasyFlow API Connection Test\n');
  console.log('Testing connectivity to backend services...\n');
  
  const results = [];
  
  for (const baseUrl of API_URLS) {
    console.log(`\n📡 Testing: ${baseUrl}`);
    console.log('─'.repeat(50));
    
    for (const endpoint of ENDPOINTS) {
      const result = await testConnection(baseUrl, endpoint);
      results.push(result);
      console.log(`  ${result.message}`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log('─'.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Total tests: ${total}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${total - successful}`);
  
  if (successful === 0) {
    console.log('\n❌ No backend services are accessible!');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if backend is running locally: npm run dev:backend');
    console.log('2. Verify Render deployment is active');
    console.log('3. Check environment variables');
    console.log('4. Review network/firewall settings');
  } else {
    console.log(`\n✅ ${successful} connection(s) working!`);
    
    // Find the best working URL
    const workingUrls = results.filter(r => r.success && r.url.includes('/health'));
    if (workingUrls.length > 0) {
      console.log(`\n🎯 Recommended API URL: ${workingUrls[0].url.replace('/health', '')}`);
      console.log('\nAdd this to your frontend .env file:');
      console.log(`REACT_APP_API_URL=${workingUrls[0].url.replace('/health', '')}`);
    }
  }
  
  console.log('\n🔔 Firebase Token Test:');
  const tokenTests = results.filter(r => r.url.includes('/api/firebase/token'));
  if (tokenTests.some(t => t.success || t.status === 401)) {
    console.log('✅ Firebase token endpoint is available (auth required)');
  } else {
    console.log('❌ Firebase token endpoint not found - check if custom token routes are deployed');
  }
}

// Run the test
main().catch(error => {
  console.error('\n💥 Test script failed:', error.message);
  process.exit(1);
});

console.log('🚀 Starting connection tests...\n');