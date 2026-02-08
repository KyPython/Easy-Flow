#!/usr/bin/env node
/**
 * Diagnostic Script: Signup & Onboarding Flow
 * 
 * Checks:
 * 1. Signup flow functionality (backend endpoints)
 * 2. Marketing events tracking (marketing_events table)
 * 3. User activation status (activation_events table)
 * 4. Onboarding trigger logic (just_signed_up flag)
 * 5. Database connectivity and table structure
 * 
 * Usage: node scripts/diagnose-signup-flow.js [--verbose]
 */

const path = require('path');

// Load environment variables from backend
require('dotenv').config({ path: path.join(__dirname, '..', 'rpa-system', 'backend', '.env') });

// Try to use backend's supabase client if available, otherwise require directly
let createClient;
try {
  // Try backend's node_modules first
  const backendNodeModules = path.join(__dirname, '..', 'rpa-system', 'backend', 'node_modules');
  createClient = require(path.join(backendNodeModules, '@supabase', 'supabase-js')).createClient;
} catch (e) {
  try {
    // Fallback to root node_modules
    createClient = require('@supabase/supabase-js').createClient;
  } catch (e2) {
    console.error('ERROR: @supabase/supabase-js not found. Please install it in backend:');
    console.error('  cd rpa-system/backend && npm install');
    process.exit(1);
  }
}

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

async function checkSupabaseConnection() {
  logSection('1. Database Connection Check');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    logError('Missing Supabase credentials (SUPABASE_URL or SUPABASE_ANON_KEY)');
    return null;
  }
  
  logInfo(`Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection by querying a simple table
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      logError(`Connection failed: ${error.message}`);
      if (VERBOSE) console.error(error);
      return null;
    }
    
    logSuccess('Database connection successful');
    return supabase;
  } catch (err) {
    logError(`Connection error: ${err.message}`);
    if (VERBOSE) console.error(err);
    return null;
  }
}

async function checkMarketingEvents(supabase) {
  logSection('2. Marketing Events Tracking Check');
  
  try {
    // Check if table exists and has data
    const { data: events, error } = await supabase
      .from('marketing_events')
      .select('event_name, created_at, properties')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      logError(`Cannot query marketing_events: ${error.message}`);
      if (error.code === '42P01') {
        logWarning('Table "marketing_events" does not exist. Run migrations?');
      }
      return;
    }
    
    if (!events || events.length === 0) {
      logWarning('No marketing events found in database');
      logInfo('This suggests either:');
      logInfo('  - No signups have occurred yet');
      logInfo('  - Event tracking is not working');
      logInfo('  - Events are being stored elsewhere');
      return;
    }
    
    logSuccess(`Found ${events.length} marketing events`);
    
    // Group by event type
    const eventCounts = {};
    events.forEach(event => {
      eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
    });
    
    logInfo('\nEvent Breakdown:');
    Object.entries(eventCounts).forEach(([eventName, count]) => {
      console.log(`  ${eventName}: ${count}`);
    });
    
    // Check for signup funnel events
    const signupEvents = ['signup_form_viewed', 'signup_attempt', 'signup_success', 'signup_failure', 'signup_validation_error'];
    const hasSignupEvents = signupEvents.some(event => eventCounts[event]);
    
    if (hasSignupEvents) {
      logSuccess('Signup funnel events are being tracked');
      
      // Check conversion funnel
      const viewed = eventCounts['signup_form_viewed'] || 0;
      const attempted = eventCounts['signup_attempt'] || 0;
      const succeeded = eventCounts['signup_success'] || 0;
      const failed = eventCounts['signup_failure'] || 0;
      
      logInfo('\nSignup Funnel:');
      console.log(`  Form Views: ${viewed}`);
      console.log(`  Attempts: ${attempted}`);
      console.log(`  Successes: ${succeeded}`);
      console.log(`  Failures: ${failed}`);
      
      if (viewed > 0) {
        const conversionRate = attempted > 0 ? ((succeeded / attempted) * 100).toFixed(1) : 0;
        logInfo(`  Conversion Rate: ${conversionRate}%`);
        
        if (conversionRate === 0 && attempted > 0) {
          logWarning('0% conversion rate - all signup attempts are failing!');
        }
      }
    } else {
      logWarning('No signup funnel events found');
      logInfo('This suggests signup tracking is not working');
    }
    
    // Show recent events
    if (VERBOSE && events.length > 0) {
      logInfo('\nRecent Events (last 5):');
      events.slice(0, 5).forEach(event => {
        console.log(`  ${event.created_at} - ${event.event_name}`);
        if (event.properties) {
          const props = typeof event.properties === 'string' 
            ? JSON.parse(event.properties) 
            : event.properties;
          if (Object.keys(props).length > 0) {
            console.log(`    Properties: ${JSON.stringify(props).substring(0, 100)}...`);
          }
        }
      });
    }
  } catch (err) {
    logError(`Error checking marketing events: ${err.message}`);
    if (VERBOSE) console.error(err);
  }
}

async function checkUserActivation(supabase) {
  logSection('3. User Activation Check');
  
  try {
    // Check activation_events table
    const { data: activationEvents, error: activationError } = await supabase
      .from('activation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (activationError) {
      if (activationError.code === '42P01') {
        logWarning('Table "activation_events" does not exist');
      } else {
        logError(`Cannot query activation_events: ${activationError.message}`);
      }
    } else if (!activationEvents || activationEvents.length === 0) {
      logWarning('No activation events found');
      logInfo('This suggests users are not creating their first workflow');
    } else {
      logSuccess(`Found ${activationEvents.length} activation events`);
      
      // Check activation rate
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, created_at')
        .order('created_at', { ascending: false });
      
      if (!usersError && users && users.length > 0) {
        const totalUsers = users.length;
        const activatedUsers = new Set(activationEvents.map(e => e.user_id)).size;
        const activationRate = ((activatedUsers / totalUsers) * 100).toFixed(1);
        
        logInfo(`\nActivation Rate: ${activationRate}% (${activatedUsers}/${totalUsers} users)`);
        
        if (activationRate === 0) {
          logWarning('0% activation rate - users are not creating workflows!');
        }
      }
    }
    
    // Check users and their workflow count
    const { data: userWorkflows, error: workflowError } = await supabase
      .from('workflows')
      .select('user_id')
      .limit(1000);
    
    if (!workflowError && userWorkflows) {
      const usersWithWorkflows = new Set(userWorkflows.map(w => w.user_id)).size;
      logInfo(`Users with workflows: ${usersWithWorkflows}`);
    }
  } catch (err) {
    logError(`Error checking activation: ${err.message}`);
    if (VERBOSE) console.error(err);
  }
}

async function checkUserAccounts(supabase) {
  logSection('4. User Accounts Check');
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      logError(`Cannot query profiles: ${error.message}`);
      return;
    }
    
    if (!profiles || profiles.length === 0) {
      logWarning('No user profiles found in database');
      logInfo('This confirms zero signups - the issue is acquisition, not conversion');
      return;
    }
    
    logSuccess(`Found ${profiles.length} user profiles`);
    
    // Check recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSignups = profiles.filter(p => new Date(p.created_at) > sevenDaysAgo);
    logInfo(`Recent signups (last 7 days): ${recentSignups.length}`);
    
    if (VERBOSE && profiles.length > 0) {
      logInfo('\nRecent Users (last 5):');
      profiles.slice(0, 5).forEach(profile => {
        const email = profile.email ? profile.email.substring(0, 20) + '...' : 'no email';
        console.log(`  ${profile.created_at} - ${email}`);
      });
    }
  } catch (err) {
    logError(`Error checking user accounts: ${err.message}`);
    if (VERBOSE) console.error(err);
  }
}

async function checkOnboardingLogic() {
  logSection('5. Onboarding Logic Check');
  
  logInfo('Checking frontend onboarding trigger logic...');
  
  try {
    const fs = require('fs');
    const dashboardPath = path.join(__dirname, '..', 'rpa-system', 'rpa-dashboard', 'src', 'components', 'Dashboard', 'Dashboard.jsx');
    
    if (!fs.existsSync(dashboardPath)) {
      logWarning('Dashboard.jsx not found');
      return;
    }
    
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for just_signed_up flag usage
    if (dashboardContent.includes('just_signed_up')) {
      logSuccess('Onboarding trigger logic found (just_signed_up flag)');
      
      if (dashboardContent.includes('sessionStorage.getItem(\'just_signed_up\')')) {
        logSuccess('Checks sessionStorage for just_signed_up flag');
      }
      
      if (dashboardContent.includes('OnboardingModal')) {
        logSuccess('OnboardingModal component is integrated');
      }
    } else {
      logWarning('just_signed_up flag not found in Dashboard.jsx');
    }
    
    // Check AuthPage for flag setting
    const authPagePath = path.join(__dirname, '..', 'rpa-system', 'rpa-dashboard', 'src', 'pages', 'AuthPage.jsx');
    if (fs.existsSync(authPagePath)) {
      const authContent = fs.readFileSync(authPagePath, 'utf8');
      
      if (authContent.includes('just_signed_up')) {
        if (authContent.includes('sessionStorage.setItem') && authContent.includes('just_signed_up')) {
          logSuccess('AuthPage sets just_signed_up flag on signup');
        } else {
          logWarning('just_signed_up referenced but not set in AuthPage');
        }
      } else {
        logWarning('just_signed_up flag not set in AuthPage.jsx');
        logInfo('This is a CRITICAL issue - onboarding modal will never trigger!');
      }
    }
  } catch (err) {
    logError(`Error checking onboarding logic: ${err.message}`);
    if (VERBOSE) console.error(err);
  }
}

async function checkBackendEndpoints() {
  logSection('6. Backend Endpoints Check');
  
  logInfo('Checking backend endpoint availability...');
  
  try {
    const fs = require('fs');
    const appPath = path.join(__dirname, '..', 'rpa-system', 'backend', 'app.js');
    
    if (!fs.existsSync(appPath)) {
      logWarning('app.js not found');
      return;
    }
    
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    // Check for signup endpoint
    const hasSignupEndpoint = appContent.includes('/api/auth/signup') || 
                              appContent.includes('signUp') ||
                              appContent.includes('signup');
    
    if (hasSignupEndpoint) {
      logSuccess('Signup endpoint exists in backend');
    } else {
      logWarning('Signup endpoint not found (using Supabase auth directly?)');
    }
    
    // Check for marketing events tracking endpoint
    if (appContent.includes('/api/tracking/event') || appContent.includes('/api/track-event')) {
      logSuccess('Marketing events tracking endpoint exists');
    } else {
      logWarning('Marketing events tracking endpoint not found');
    }
    
    // Check for ensureUserProfile function
    if (appContent.includes('ensureUserProfile')) {
      logSuccess('ensureUserProfile function exists (creates profile + tracks signup)');
    } else {
      logWarning('ensureUserProfile function not found');
    }
  } catch (err) {
    logError(`Error checking backend endpoints: ${err.message}`);
    if (VERBOSE) console.error(err);
  }
}

async function generateRecommendations(supabase) {
  logSection('7. Recommendations');
  
  const recommendations = [];
  
  try {
    // Check if we have any users
    const { data: profiles } = await supabase.from('profiles').select('count').limit(1);
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    
    // Check if we have marketing events
    const { count: eventCount } = await supabase.from('marketing_events').select('*', { count: 'exact', head: true });
    
    if ((!userCount || userCount === 0) && (!eventCount || eventCount === 0)) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Zero signups and zero events',
        action: 'The problem is ACQUISITION, not conversion. Drive traffic to the landing page.',
        steps: [
          'Post on Reddit (r/automation, r/smallbusiness)',
          'Share on Twitter/X',
          'Post on Product Hunt',
          'Create content (blog posts, tutorials) with links to EasyFlow'
        ]
      });
    }
    
    if (userCount > 0 && eventCount === 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Users exist but no events tracked',
        action: 'Event tracking is broken - users are signing up but events are not being recorded.',
        steps: [
          'Check /api/tracking/event endpoint is working',
          'Verify marketing_events table exists and is accessible',
          'Check frontend tracking code (signupTracking.js)',
          'Test signup flow and check browser console for errors'
        ]
      });
    }
    
    // Check for just_signed_up flag issue
    try {
      const fs = require('fs');
      const authPath = path.join(__dirname, '..', 'rpa-system', 'rpa-dashboard', 'src', 'pages', 'AuthPage.jsx');
      if (fs.existsSync(authPath)) {
        const authContent = fs.readFileSync(authPath, 'utf8');
        if (!authContent.includes('sessionStorage.setItem') || !authContent.includes('just_signed_up')) {
          recommendations.push({
            priority: 'HIGH',
            issue: 'Onboarding modal will not trigger',
            action: 'just_signed_up flag is not being set in AuthPage.jsx',
            steps: [
              'Add sessionStorage.setItem(\'just_signed_up\', \'true\') after successful signup',
              'Verify Dashboard.jsx checks for this flag',
              'Test onboarding flow end-to-end'
            ]
          });
        }
      }
    } catch (err) {
      // Ignore file read errors
    }
    
  } catch (err) {
    // Ignore errors in recommendations
  }
  
  if (recommendations.length === 0) {
    logSuccess('No critical issues detected!');
    logInfo('If signups are still low, focus on traffic acquisition.');
  } else {
    recommendations.forEach((rec, idx) => {
      console.log(`\n${idx + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   Action: ${rec.action}`);
      if (rec.steps && rec.steps.length > 0) {
        console.log(`   Steps:`);
        rec.steps.forEach(step => console.log(`     - ${step}`));
      }
    });
  }
}

async function main() {
  console.log('\n');
  log('='.repeat(60), 'cyan');
  log('  EasyFlow Signup & Onboarding Flow Diagnostic', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const supabase = await checkSupabaseConnection();
  
  if (!supabase) {
    logError('\nCannot continue without database connection');
    process.exit(1);
  }
  
  await checkUserAccounts(supabase);
  await checkMarketingEvents(supabase);
  await checkUserActivation(supabase);
  await checkOnboardingLogic();
  await checkBackendEndpoints();
  await generateRecommendations(supabase);
  
  logSection('Summary');
  logInfo('Diagnostic complete. Review recommendations above.');
  logInfo('Use --verbose flag for detailed event logs.');
  console.log('\n');
}

main().catch(err => {
  logError(`Fatal error: ${err.message}`);
  if (VERBOSE) console.error(err);
  process.exit(1);
});
