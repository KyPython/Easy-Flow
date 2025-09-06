#!/usr/bin/env node

// Firebase Integration Test Script
// This script tests the Firebase real-time notification system end-to-end
const path = require('path');

// Store original directory
const originalDir = process.cwd();
const backendDir = path.join(__dirname, 'backend');

// Load environment from backend directory
require('dotenv').config({ path: path.join(backendDir, '.env') });

// Temporarily change directory for Firebase initialization
process.chdir(backendDir);

const { firebaseNotificationService, NotificationTemplates } = require('./utils/firebaseAdmin');

// Restore original directory
process.chdir(originalDir);

async function testFirebaseIntegration() {
  console.log('🔥 Testing Firebase Integration...\n');
  
  // 1. Check Firebase service status
  console.log('1. Checking Firebase service status...');
  const status = firebaseNotificationService.getStatus();
  console.log('Firebase Status:', JSON.stringify(status, null, 2));
  
  if (!status.isConfigured) {
    console.log('❌ Firebase is not configured. Please check your environment variables.');
    console.log('Required variables:');
    console.log('- FIREBASE_PROJECT_ID');
    console.log('- FIREBASE_CLIENT_EMAIL');
    console.log('- FIREBASE_PRIVATE_KEY');
    console.log('- FIREBASE_DATABASE_URL');
    console.log('Or provide a service account file at backend/config/firebase-service-account.json');
    return;
  }
  
  console.log('✅ Firebase is configured\n');
  
  // 2. Test notification templates
  console.log('2. Testing notification templates...');
  const templates = {
    welcome: NotificationTemplates.welcome('TestUser'),
    taskCompleted: NotificationTemplates.taskCompleted('Test Scrape Task'),
    taskFailed: NotificationTemplates.taskFailed('Test Scrape Task', 'Network timeout'),
    systemAlert: NotificationTemplates.systemAlert('System maintenance in 5 minutes', 'high')
  };
  
  Object.entries(templates).forEach(([name, template]) => {
    console.log(`✅ ${name}:`, JSON.stringify(template, null, 2));
  });
  
  console.log('\n3. Testing database connection...');
  try {
    if (status.hasDatabase) {
      console.log('✅ Firebase Realtime Database connection available');
    } else {
      console.log('❌ Firebase Realtime Database not available');
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
  
  console.log('\n4. Testing notification service (no actual send)...');
  try {
    const testUserId = 'test-user-123';
    const testNotification = NotificationTemplates.welcome('TestUser');
    
    // This will attempt to store in Firebase but won't send push notification
    // since we don't have a real FCM token
    const result = await firebaseNotificationService.storeNotification(testUserId, testNotification);
    console.log('✅ Store notification result:', result);
    
    if (result.success) {
      console.log('✅ Notification storage test passed');
    } else {
      console.log('❌ Notification storage test failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Notification service test failed:', error.message);
  }
  
  console.log('\n🎉 Firebase integration test completed!');
  console.log('\nNext steps:');
  console.log('1. Set up your Firebase project at https://console.firebase.google.com/');
  console.log('2. Copy the configuration to your .env file');
  console.log('3. Enable Authentication, Realtime Database, and Cloud Messaging');
  console.log('4. Test with real users by having them visit your app');
  
  process.exit(0);
}

testFirebaseIntegration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});