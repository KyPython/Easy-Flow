// Test script to verify Firebase rules are working
// Run this after updating your Firebase security rules

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Your Firebase config (replace with actual values)
const firebaseConfig = {
  // Add your config here
  databaseURL: "your-database-url",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

async function testFirebaseRules() {
  try {
    console.log('🔍 Testing Firebase security rules...');
    
    // Sign in anonymously to get a user ID
    const userCredential = await signInAnonymously(auth);
    const userId = userCredential.user.uid;
    
    console.log('✅ Authenticated with user ID:', userId);
    
    // Try to write to the notifications path
    const notificationData = {
      type: 'test',
      title: 'Test Notification',
      body: 'Testing Firebase rules',
      timestamp: new Date().toISOString(),
      read: false
    };
    
    const userNotificationsRef = ref(database, `notifications/${userId}`);
    await push(userNotificationsRef, notificationData);
    
    console.log('✅ SUCCESS: Firebase rules allow authenticated write');
    console.log('🔔 Test notification written to Firebase');
    
    return true;
    
  } catch (error) {
    console.error('❌ FAILED: Firebase rules test failed');
    console.error('Error:', error.message);
    
    if (error.code === 'PERMISSION_DENIED') {
      console.error('🔧 Fix: Update Firebase security rules to allow authenticated writes');
    }
    
    return false;
  }
}

// Run the test
testFirebaseRules()
  .then(success => {
    if (success) {
      console.log('\n🎉 Firebase rules are correctly configured!');
    } else {
      console.log('\n⚠️  Firebase rules need to be updated');
    }
  })
  .catch(console.error);