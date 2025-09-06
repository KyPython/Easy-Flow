#!/usr/bin/env node

// Firebase Integration Test Script
// Run this from the backend directory: cd backend && node test-firebase.js

require('dotenv').config();
const { firebaseNotificationService, NotificationTemplates } = require('./utils/firebaseAdmin');

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
    console.log('Or provide a service account file at config/firebase-service-account.json');
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
      console.log(`🔗 Check your Firebase Console: https://console.firebase.google.com/project/${status.projectId || 'your-project'}/database`);
    } else {
      console.log('❌ Notification storage test failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Notification service test failed:', error.message);
  }
  
  console.log('\n🎉 Firebase integration test completed!');
  console.log('\nNext steps:');
  console.log('1. Check Firebase Console > Realtime Database for test notification');
  console.log('2. Start your frontend app and test with real user notifications');
  console.log('3. Complete onboarding to trigger welcome notification');
  console.log('4. Create and run a task to trigger completion notification');
  
  process.exit(0);
}

testFirebaseIntegration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});