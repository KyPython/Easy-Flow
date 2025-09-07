#!/usr/bin/env node

// Firebase Rules Deployment Script for EasyFlow
// This script helps deploy and validate Firebase security rules

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Rules Deployment Helper\n');

// Check if Firebase CLI is available
const { execSync } = require('child_process');

function checkFirebaseCLI() {
  try {
    const version = execSync('firebase --version', { encoding: 'utf8' });
    console.log('✅ Firebase CLI found:', version.trim());
    return true;
  } catch (error) {
    console.error('❌ Firebase CLI not found. Please install it with:');
    console.error('   npm install -g firebase-tools');
    return false;
  }
}

function validateRulesFile(filePath) {
  try {
    const rulesContent = fs.readFileSync(filePath, 'utf8');
    const rules = JSON.parse(rulesContent);
    
    console.log('✅ Rules file is valid JSON');
    
    // Basic validation
    if (!rules.rules) {
      throw new Error('Rules file must have a "rules" property');
    }
    
    if (!rules.rules.notifications) {
      throw new Error('Rules must include notifications path');
    }
    
    console.log('✅ Rules file structure is valid');
    return true;
    
  } catch (error) {
    console.error('❌ Rules file validation failed:', error.message);
    return false;
  }
}

function displayRulesInfo() {
  console.log('📋 Firebase Rules Information:');
  console.log('');
  console.log('🔒 Security Features:');
  console.log('  • User-specific access control based on Supabase UID');
  console.log('  • Custom token validation with supabase_uid claim');
  console.log('  • Structured data validation for notifications');
  console.log('  • Read-only system announcements and feature flags');
  console.log('');
  console.log('📁 Paths Protected:');
  console.log('  • /notifications/$userId - User notifications');
  console.log('  • /presence/$userId - User presence status');
  console.log('  • /user_settings/$userId - User settings cache');
  console.log('  • /announcements - System announcements (read-only)');
  console.log('  • /feature_flags - Feature flags (read-only)');
  console.log('');
}

function deployInstructions() {
  console.log('🚀 Deployment Instructions:');
  console.log('');
  console.log('1. Ensure you are logged in to Firebase:');
  console.log('   firebase login');
  console.log('');
  console.log('2. Initialize Firebase in your project (if not done):');
  console.log('   firebase init database');
  console.log('');
  console.log('3. Deploy the secure rules:');
  console.log('   firebase deploy --only database');
  console.log('');
  console.log('4. Or deploy rules from specific file:');
  console.log('   firebase database:set --data @firebase-rules-secure.json /.settings/rules');
  console.log('');
  console.log('⚠️  Important Notes:');
  console.log('  • Test rules in Firebase console before deploying to production');
  console.log('  • Make sure your Firebase project supports custom token authentication');
  console.log('  • Verify that your backend is generating tokens with supabase_uid claim');
  console.log('');
  console.log('🧪 Testing:');
  console.log('  • Use Firebase Rules Playground in the console to test access patterns');
  console.log('  • Test with sample auth token containing supabase_uid claim');
  console.log('  • Verify that unauthorized users cannot access other users\' data');
  console.log('');
}

function createFirebaseRC() {
  const firebaseRC = {
    projects: {
      default: 'YOUR_PROJECT_ID_HERE'
    }
  };
  
  if (!fs.existsSync('.firebaserc')) {
    fs.writeFileSync('.firebaserc', JSON.stringify(firebaseRC, null, 2));
    console.log('📝 Created .firebaserc file - please update with your project ID');
  }
}

function createFirebaseJSON() {
  const firebaseJSON = {
    database: {
      rules: 'firebase-rules-secure.json'
    }
  };
  
  if (!fs.existsSync('firebase.json')) {
    fs.writeFileSync('firebase.json', JSON.stringify(firebaseJSON, null, 2));
    console.log('📝 Created firebase.json file');
  }
}

// Main execution
async function main() {
  const secureRulesPath = path.join(__dirname, 'firebase-rules-secure.json');
  
  // Check if rules file exists
  if (!fs.existsSync(secureRulesPath)) {
    console.error('❌ Secure rules file not found:', secureRulesPath);
    process.exit(1);
  }
  
  // Validate rules file
  if (!validateRulesFile(secureRulesPath)) {
    process.exit(1);
  }
  
  // Check Firebase CLI
  checkFirebaseCLI();
  
  // Display information
  displayRulesInfo();
  
  // Create configuration files
  createFirebaseRC();
  createFirebaseJSON();
  
  // Show deployment instructions
  deployInstructions();
  
  // Offer to deploy if CLI is available
  const args = process.argv.slice(2);
  if (args.includes('--deploy')) {
    console.log('🚀 Deploying rules to Firebase...\n');
    try {
      execSync('firebase deploy --only database', { stdio: 'inherit' });
      console.log('\n✅ Rules deployed successfully!');
    } catch (error) {
      console.error('\n❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { validateRulesFile, checkFirebaseCLI };