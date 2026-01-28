#!/usr/bin/env node
/**
 * Test Script: Signup Flow End-to-End
 * 
 * Tests the complete signup flow:
 * 1. Check if marketing_events table exists and is accessible
 * 2. Test tracking endpoint (/api/tracking/event)
 * 3. Verify event insertion works
 * 4. Test analytics dashboard endpoint
 * 
 * Usage: node scripts/test-signup-flow.js [--endpoint URL]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'rpa-system', 'backend', '.env') });

// Try to use backend's supabase client
let createClient;
try {
  const backendNodeModules = path.join(__dirname, '..', 'rpa-system', 'backend', 'node_modules');
  createClient = require(path.join(backendNodeModules, '@supabase', 'supabase-js')).createClient;
} catch (e) {
  try {
    createClient = require('@supabase/supabase-js').createClient;
  } catch (e2) {
    console.error('ERROR: @supabase/supabase-js not found');
    process.exit(1);
  }
}

// Try to load axios from backend, but make it optional
let axios;
try {
  const backendNodeModules = path.join(__dirname, '..', 'rpa-system', 'backend', 'node_modules');
  axios = require(path.join(backendNodeModules, 'axios'));
} catch (e) {
  try {
    axios = require('axios');
  } catch (e2) {
    // axios not available - skip endpoint tests
    axios = null;
  }
}
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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

async function testMarketingEventsTable(supabase) {
  logSection('1. Testing marketing_events Table');
  
  try {
    // Test 1: Try to insert a test event
    logInfo('Inserting test event...');
    const testEvent = {
      event_name: 'test_event',
      properties: { test: true, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('marketing_events')
      .insert([testEvent])
      .select();
    
    if (insertError) {
      logError(`Cannot insert into marketing_events: ${insertError.message}`);
      if (insertError.code === '42P01') {
        logWarning('Table "marketing_events" does not exist. Run migrations?');
      } else if (insertError.code === '42501') {
        logWarning('Permission denied. Check RLS (Row Level Security) policies.');
      }
      return false;
    }
    
    logSuccess('Test event inserted successfully');
    
    // Test 2: Query the test event back
    if (insertData && insertData.length > 0) {
      const eventId = insertData[0].id;
      logInfo(`Querying test event with ID: ${eventId}`);
      
      const { data: queryData, error: queryError } = await supabase
        .from('marketing_events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (queryError) {
        logError(`Cannot query marketing_events: ${queryError.message}`);
        return false;
      }
      
      logSuccess('Test event queried successfully');
      
      // Test 3: Clean up test event
      logInfo('Cleaning up test event...');
      const { error: deleteError } = await supabase
        .from('marketing_events')
        .delete()
        .eq('id', eventId);
      
      if (deleteError) {
        logWarning(`Could not delete test event: ${deleteError.message}`);
      } else {
        logSuccess('Test event cleaned up');
      }
      
      return true;
    }
    
    return false;
  } catch (err) {
    logError(`Error testing marketing_events table: ${err.message}`);
    return false;
  }
}

async function testTrackingEndpoint(backendUrl = 'http://localhost:3001') {
  logSection('2. Testing /api/tracking/event Endpoint');
  
  if (!axios) {
    logWarning('axios not available - skipping endpoint test');
    logInfo('Install axios in backend: cd rpa-system/backend && npm install axios');
    return null;
  }
  
  try {
    const testEvent = {
      event_name: 'test_tracking_event',
      properties: {
        test: true,
        source: 'diagnostic_script',
        timestamp: new Date().toISOString()
      }
    };
    
    logInfo(`POST ${backendUrl}/api/tracking/event`);
    
    const response = await axios.post(`${backendUrl}/api/tracking/event`, testEvent, {
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status
    });
    
    if (response.status === 200 || response.status === 201) {
      logSuccess(`Tracking endpoint responded with status ${response.status}`);
      return true;
    } else {
      logError(`Tracking endpoint returned status ${response.status}`);
      if (response.data) {
        logInfo(`Response: ${JSON.stringify(response.data)}`);
      }
      return false;
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      logWarning('Backend server is not running');
      logInfo('Start backend with: cd rpa-system/backend && npm start');
    } else if (err.code === 'ENOTFOUND') {
      logError(`Cannot resolve host: ${err.hostname}`);
    } else {
      logError(`Error testing tracking endpoint: ${err.message}`);
    }
    return false;
  }
}

async function checkAnalyticsEndpoint(backendUrl = 'http://localhost:3001') {
  logSection('3. Testing Analytics Dashboard Endpoint');
  
  try {
    logInfo(`GET ${backendUrl}/api/business-metrics/marketing-events`);
    logWarning('Note: This endpoint requires authentication (owner only)');
    logInfo('Skipping authenticated endpoint test - requires valid auth token');
    
    // We can't test this without auth, but we can check if the endpoint exists
    return null;
  } catch (err) {
    logError(`Error checking analytics endpoint: ${err.message}`);
    return false;
  }
}

async function checkTablePermissions(supabase) {
  logSection('4. Checking Table Permissions');
  
  try {
    // Try to count events (read permission)
    const { count, error: countError } = await supabase
      .from('marketing_events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      if (countError.code === '42501') {
        logWarning('RLS (Row Level Security) may be blocking reads');
        logInfo('Check Supabase RLS policies for marketing_events table');
      } else {
        logError(`Cannot count events: ${countError.message}`);
      }
      return false;
    }
    
    logSuccess(`Read permission OK (found ${count || 0} events)`);
    return true;
  } catch (err) {
    logError(`Error checking permissions: ${err.message}`);
    return false;
  }
}

async function suggestFixes(supabase, tableWorks, endpointWorks) {
  logSection('5. Recommended Fixes');
  
  const fixes = [];
  
  if (!tableWorks) {
    fixes.push({
      issue: 'marketing_events table is not accessible',
      fixes: [
        'Check if table exists: Run migrations if needed',
        'Check RLS policies: marketing_events table may have restrictive policies',
        'Verify Supabase credentials: Check SUPABASE_URL and SUPABASE_ANON_KEY',
        'Check table schema: Ensure columns match expected structure (event_name, properties, created_at, user_id)'
      ]
    });
  }
  
  if (!endpointWorks) {
    fixes.push({
      issue: '/api/tracking/event endpoint is not working',
      fixes: [
        'Start backend server: cd rpa-system/backend && npm start',
        'Check backend logs for errors',
        'Verify CORS settings if testing from browser',
        'Check backend .env file for SUPABASE credentials'
      ]
    });
  }
  
  if (tableWorks && endpointWorks) {
    logSuccess('Table and endpoint are working!');
    logInfo('If events are still not being tracked, check:');
    fixes.push({
      issue: 'Events not being tracked despite working infrastructure',
      fixes: [
        'Check frontend tracking code (signupTracking.js)',
        'Check browser console for JavaScript errors',
        'Verify API base URL in frontend (check api.js)',
        'Check network tab in browser DevTools for failed requests',
        'Verify events are being sent from frontend (check Network tab)'
      ]
    });
  }
  
  if (fixes.length > 0) {
    fixes.forEach((fix, idx) => {
      console.log(`\n${idx + 1}. ${fix.issue}`);
      fix.fixes.forEach(step => {
        console.log(`   - ${step}`);
      });
    });
  } else {
    logSuccess('No issues detected!');
  }
}

async function main() {
  console.log('\n');
  log('='.repeat(60), 'cyan');
  log('  EasyFlow Signup Flow End-to-End Test', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const backendUrl = process.argv.includes('--endpoint') 
    ? process.argv[process.argv.indexOf('--endpoint') + 1]
    : process.env.BACKEND_URL || 'http://localhost:3001';
  
  if (!supabaseUrl || !supabaseKey) {
    logError('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const tableWorks = await testMarketingEventsTable(supabase);
  const endpointWorks = await testTrackingEndpoint(backendUrl);
  await checkTablePermissions(supabase);
  await checkAnalyticsEndpoint(backendUrl);
  await suggestFixes(supabase, tableWorks, endpointWorks);
  
  logSection('Summary');
  if (tableWorks && endpointWorks) {
    logSuccess('Signup flow infrastructure is working!');
  } else {
    logWarning('Issues detected - see fixes above');
  }
  console.log('\n');
}

main().catch(err => {
  logError(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
