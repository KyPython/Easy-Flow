#!/usr/bin/env node
/**
 * Test script for Polar webhook endpoint
 * 
 * Usage:
 *   node scripts/test_polar_webhook.js [webhook_type] [user_email]
 * 
 * Examples:
 *   node scripts/test_polar_webhook.js subscription.created user@example.com
 *   node scripts/test_polar_webhook.js subscription.updated user@example.com
 *   node scripts/test_polar_webhook.js subscription.canceled user@example.com
 * 
 * Environment variables:
 *   - BACKEND_URL: Backend URL (default: http://localhost:3030)
 *   - POLAR_WEBHOOK_SECRET: Webhook secret for signature generation (optional for dev)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3030';
const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET || 'test-secret';
const WEBHOOK_ENDPOINT = `${BACKEND_URL}/api/polar-webhook/webhook`;

// Get command line arguments
const webhookType = process.argv[2] || 'subscription.created';
const userEmail = process.argv[3] || 'test@example.com';
const polarProductId = process.argv[4] || 'test-product-id';

// Generate webhook signature
function generateSignature(body, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

// Sample webhook payloads based on Polar's format
const webhookPayloads = {
  'subscription.created': {
    type: 'subscription.created',
    data: {
      id: `sub_test_${Date.now()}`,
      product_id: polarProductId,
      status: 'active',
      customer: {
        email: userEmail
      },
      trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      billing_cycle_anchor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    }
  },
  'subscription.updated': {
    type: 'subscription.updated',
    data: {
      id: `sub_test_${Date.now()}`,
      product_id: polarProductId,
      status: 'active',
      customer: {
        email: userEmail
      }
    }
  },
  'subscription.active': {
    type: 'subscription.active',
    data: {
      id: `sub_test_${Date.now()}`,
      product_id: polarProductId,
      status: 'active',
      customer: {
        email: userEmail
      }
    }
  },
  'subscription.canceled': {
    type: 'subscription.canceled',
    data: {
      id: `sub_test_${Date.now()}`,
      product_id: polarProductId,
      status: 'canceled',
      customer: {
        email: userEmail
      }
    }
  },
  'subscription.revoked': {
    type: 'subscription.revoked',
    data: {
      id: `sub_test_${Date.now()}`,
      product_id: polarProductId,
      status: 'revoked',
      customer: {
        email: userEmail
      }
    }
  }
};

async function testWebhook() {
  console.log('🧪 Testing Polar Webhook Endpoint\n');
  console.log(`Endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log(`Webhook Type: ${webhookType}`);
  console.log(`User Email: ${userEmail}`);
  console.log(`Product ID: ${polarProductId}\n`);

  // Get payload for webhook type
  const payload = webhookPayloads[webhookType];
  if (!payload) {
    console.error(`❌ Unknown webhook type: ${webhookType}`);
    console.log(`Available types: ${Object.keys(webhookPayloads).join(', ')}`);
    process.exit(1);
  }

  // Convert payload to JSON string
  const body = JSON.stringify(payload);
  
  // Generate signature
  const signature = generateSignature(body, WEBHOOK_SECRET);

  try {
    console.log('📤 Sending webhook...\n');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log(`\nSignature: ${signature}\n`);

    const response = await axios.post(WEBHOOK_ENDPOINT, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-polar-signature': signature
      },
      validateStatus: () => true // Don't throw on any status code
    });

    console.log(`\n📥 Response Status: ${response.status}`);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));

    if (response.status === 200 || response.status === 201) {
      console.log('\n✅ Webhook processed successfully!');
      
      if (response.data.userId) {
        console.log(`   User ID: ${response.data.userId}`);
      }
      if (response.data.action) {
        console.log(`   Action: ${response.data.action}`);
      }
      if (response.data.downgraded_to_plan) {
        console.log(`   Downgraded to plan: ${response.data.downgraded_to_plan}`);
      }
    } else {
      console.log('\n❌ Webhook failed');
      if (response.data.error) {
        console.log(`   Error: ${response.data.error}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error sending webhook:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Body:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the backend server is running on', BACKEND_URL);
    }
    process.exit(1);
  }
}

// Run test
testWebhook().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
