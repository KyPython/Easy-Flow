#!/usr/bin/env node
/**
 * Diagnostic Script for Critical Product Issues
 * Uses observability data to investigate:
 * 1. Zero signups (35 days)
 * 2. Feature discovery tracking (showing 'None')
 * 3. Login failures (Dec 26-27, 0% success rate)
 * 4. Time to first workflow (6.3 minutes)
 * 
 * This script uses actual data from logs and database, not guesses.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // Owner token
const LOGS_DIR = path.join(__dirname, '..', 'logs');

async function main() {
  console.log('🔍 Critical Product Issues Diagnostic\n');
  console.log('Using observability data - no guessing!\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check Analytics Health Endpoint
    console.log('\n1️⃣  Checking Analytics Health...');
    await checkAnalyticsHealth();

    // 2. Check Login Failures (Dec 26-27)
    console.log('\n2️⃣  Investigating Login Failures (Dec 26-27)...');
    await checkLoginFailures();

    // 3. Check Signup Tracking
    console.log('\n3️⃣  Investigating Zero Signups...');
    await checkSignupTracking();

    // 4. Check Feature Tracking
    console.log('\n4️⃣  Investigating Feature Discovery...');
    await checkFeatureTracking();

    // 5. Check Time to First Workflow
    console.log('\n5️⃣  Investigating Time to First Workflow...');
    await checkTimeToFirstWorkflow();

    // 6. Check Log Files for Errors
    console.log('\n6️⃣  Scanning Log Files for Errors...');
    await scanLogFiles();

  } catch (error) {
    console.error('\n❌ Diagnostic script failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

async function checkAnalyticsHealth() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/business-metrics/analytics-health?days=35`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = response.data;
    
    console.log(`   Timeframe: ${data.timeframe}`);
    console.log(`   Generated: ${data.generated_at}\n`);

    // Signup Health
    console.log('   📊 Signup Health:');
    console.log(`      - Profiles created: ${data.signup_health.profiles_created}`);
    console.log(`      - Signup events tracked: ${data.signup_health.signup_events_tracked}`);
    console.log(`      - Tracking gap: ${data.signup_health.tracking_gap}`);
    console.log(`      - Issue: ${data.signup_health.issue_detected}`);
    if (data.signup_health.recent_signups?.length > 0) {
      console.log(`      - Recent signups (last 5):`);
      data.signup_health.recent_signups.forEach(s => {
        console.log(`        • ${s.id} - ${s.created_at} (confirmed: ${s.email_confirmed})`);
      });
    }

    // Feature Tracking
    console.log('\n   📊 Feature Tracking:');
    console.log(`      - Total events: ${data.feature_tracking.total_events_tracked}`);
    console.log(`      - Feature events: ${data.feature_tracking.feature_events_count}`);
    console.log(`      - Issue: ${data.feature_tracking.issue_detected}`);
    if (data.feature_tracking.most_used_features?.length > 0) {
      console.log(`      - Most used features:`);
      data.feature_tracking.most_used_features.forEach(f => {
        console.log(`        • ${f.feature}: ${f.count} uses`);
      });
    }

    // Login Health
    console.log('\n   📊 Login Health:');
    console.log(`      - Login events: ${data.login_health.total_login_events}`);
    console.log(`      - Auth logs: ${data.login_health.total_auth_logs}`);
    console.log(`      - Issue: ${data.login_health.issue_detected}`);
    if (data.login_health.days_with_failures?.length > 0) {
      console.log(`      - Days with failures:`);
      data.login_health.days_with_failures.forEach(d => {
        console.log(`        • ${d.date}: ${d.success_rate} success rate (${d.failed} failed, ${d.success} success)`);
      });
    }

    // Recommendations
    if (data.recommendations?.length > 0) {
      console.log('\n   💡 Recommendations:');
      data.recommendations.forEach(r => {
        console.log(`      [${r.priority}] ${r.issue}: ${r.action}`);
      });
    }

  } catch (error) {
    console.error('   ❌ Failed to fetch analytics health:', error.message);
    if (error.response?.status === 401) {
      console.error('   ⚠️  Authentication required. Set AUTH_TOKEN environment variable.');
    }
  }
}

async function checkLoginFailures() {
  try {
    // Check specific dates: Dec 26-27
    const dec26 = new Date('2024-12-26');
    const dec27 = new Date('2024-12-27');
    const dec28 = new Date('2024-12-28');
    
    const response = await axios.get(`${API_BASE_URL}/api/business-metrics/analytics-health?days=35`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = response.data;
    
    // Filter login events for Dec 26-27
    const dec26Logins = data.login_health?.by_day_events?.['2024-12-26'];
    const dec27Logins = data.login_health?.by_day_events?.['2024-12-27'];
    
    console.log('   Dec 26, 2024:');
    if (dec26Logins) {
      const successRate = dec26Logins.total > 0 
        ? ((dec26Logins.success / dec26Logins.total) * 100).toFixed(1)
        : 'N/A';
      console.log(`      - Total: ${dec26Logins.total}, Success: ${dec26Logins.success}, Failed: ${dec26Logins.failed}`);
      console.log(`      - Success Rate: ${successRate}%`);
      if (dec26Logins.total > 0 && dec26Logins.success === 0) {
        console.log('      ⚠️  CRITICAL: 0% success rate detected!');
      }
    } else {
      console.log('      - No login data found');
    }
    
    console.log('   Dec 27, 2024:');
    if (dec27Logins) {
      const successRate = dec27Logins.total > 0 
        ? ((dec27Logins.success / dec27Logins.total) * 100).toFixed(1)
        : 'N/A';
      console.log(`      - Total: ${dec27Logins.total}, Success: ${dec27Logins.success}, Failed: ${dec27Logins.failed}`);
      console.log(`      - Success Rate: ${successRate}%`);
      if (dec27Logins.total > 0 && dec27Logins.success === 0) {
        console.log('      ⚠️  CRITICAL: 0% success rate detected!');
      }
    } else {
      console.log('      - No login data found');
    }

    // Check audit logs for those days
    if (data.login_health?.by_day_audit) {
      console.log('\n   Audit Log Details:');
      Object.entries(data.login_health.by_day_audit)
        .filter(([date]) => date >= '2024-12-26' && date <= '2024-12-27')
        .forEach(([date, stats]) => {
          const successRate = stats.total > 0 
            ? ((stats.success / stats.total) * 100).toFixed(1)
            : 'N/A';
          console.log(`      ${date}: ${successRate}% success (${stats.success}/${stats.total})`);
        });
    }

  } catch (error) {
    console.error('   ❌ Failed to check login failures:', error.message);
  }
}

async function checkSignupTracking() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/business-metrics/signups?timeframe=35d&interval=day`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = response.data;
    
    console.log(`   Total signups in last 35 days: ${data.total}`);
    
    if (data.total === 0) {
      console.log('   ⚠️  CRITICAL: Zero signups detected!');
      console.log('   Possible causes:');
      console.log('     1. Email confirmation blocking users');
      console.log('     2. Signup tracking not working');
      console.log('     3. Genuinely no signups (traffic issue)');
    } else {
      console.log(`   Signup trend (last 7 days):`);
      data.series.slice(-7).forEach(day => {
        console.log(`      ${day.date}: ${day.signups} signup(s)`);
      });
    }

  } catch (error) {
    console.error('   ❌ Failed to check signup tracking:', error.message);
  }
}

async function checkFeatureTracking() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/business-metrics/feature-usage?days=30`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = response.data;
    
    console.log(`   Total events tracked: ${data.total_events}`);
    console.log(`   Most used overall: ${data.most_used_overall}`);
    
    if (data.most_used_overall === 'None') {
      console.log('   ⚠️  CRITICAL: No feature usage tracked!');
      console.log('   Issue: trackFeatureUsage() calls may not be working or events not being stored');
    } else {
      console.log(`   Top features:`);
      data.features.slice(0, 5).forEach(f => {
        console.log(`      • ${f.feature}: ${f.total_uses} uses (${f.unique_users} users)`);
      });
    }

  } catch (error) {
    console.error('   ❌ Failed to check feature tracking:', error.message);
  }
}

async function checkTimeToFirstWorkflow() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/business-metrics/time-to-first-workflow?days=90`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = response.data;
    
    console.log(`   Total users: ${data.total_users}`);
    console.log(`   Users with workflow: ${data.users_with_workflow}`);
    console.log(`   Conversion rate: ${data.conversion_rate}`);
    console.log(`   Average time: ${data.average_time_to_first_workflow.formatted}`);
    
    if (parseFloat(data.average_time_to_first_workflow.minutes) > 5) {
      console.log('   ⚠️  HIGH: Time to first workflow exceeds 5 minutes');
      console.log('   Recommendation: Add onboarding wizard or pre-built templates');
    }

    if (data.recommendations?.length > 0) {
      console.log('   Recommendations:');
      data.recommendations.forEach(r => {
        console.log(`      [${r.priority}] ${r.issue}: ${r.action}`);
      });
    }

  } catch (error) {
    console.error('   ❌ Failed to check time to first workflow:', error.message);
  }
}

async function scanLogFiles() {
  const logFiles = [
    'backend.log',
    'backend-error.log',
    'frontend-error.log'
  ];

  const dec26Pattern = /2024-12-2[67]/i;
  
  for (const logFile of logFiles) {
    const filePath = path.join(LOGS_DIR, logFile);
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️  Log file not found: ${logFile}`);
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Check for Dec 26-27 errors
      const dec26_27Errors = lines.filter(line => 
        dec26Pattern.test(line) && (
          line.toLowerCase().includes('error') ||
          line.toLowerCase().includes('fail') ||
          line.toLowerCase().includes('auth') ||
          line.toLowerCase().includes('login')
        )
      );

      if (dec26_27Errors.length > 0) {
        console.log(`\n   📋 ${logFile} - Found ${dec26_27Errors.length} relevant entries on Dec 26-27:`);
        dec26_27Errors.slice(0, 5).forEach(line => {
          console.log(`      ${line.substring(0, 150)}...`);
        });
        if (dec26_27Errors.length > 5) {
          console.log(`      ... and ${dec26_27Errors.length - 5} more`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Failed to read ${logFile}:`, error.message);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

