#!/usr/bin/env node
/**
 * Check Polar environment variables configuration
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 Checking Polar Environment Variables\n');
console.log('=' .repeat(60));

const requiredVars = {
  'POLAR_API_KEY': {
    required: false,
    description: 'Polar API key for creating checkouts and reconciliation',
    usedIn: ['POST /api/checkout/polar', 'reconcile_polar.js script']
  },
  'POLAR_WEBHOOK_SECRET': {
    required: process.env.NODE_ENV === 'production',
    description: 'Webhook secret for verifying Polar webhook signatures',
    usedIn: ['POST /api/polar-webhook/webhook']
  }
};

let allSet = true;
let missingRequired = false;

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const isSet = !!value;
  const status = isSet ? '✅ SET' : (config.required ? '❌ MISSING (REQUIRED)' : '⚠️  NOT SET (OPTIONAL)');

  console.log(`${status}: ${varName}`);
  console.log(`   Description: ${config.description}`);
  console.log(`   Used in: ${config.usedIn.join(', ')}`);

  if (isSet) {
    // Show first few characters for verification (but not full value for security)
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value.substring(0, value.length);
    console.log(`   Value preview: ${preview}`);
  } else {
    if (config.required) {
      missingRequired = true;
      allSet = false;
    }
  }
  console.log('');
}

console.log('=' .repeat(60));
console.log('\n📋 Summary:');

if (missingRequired) {
  console.log('❌ Missing required environment variables!');
  console.log('   Webhook verification will fail in production.');
  process.exit(1);
} else if (!allSet) {
  console.log('⚠️  Some optional variables are not set.');
  console.log('   Webhook will work in development but may have limited functionality.');
  process.exit(0);
} else {
  console.log('✅ All environment variables are configured!');
  process.exit(0);
}
