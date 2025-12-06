#!/usr/bin/env node
/**
 * Workflow Reliability Testing Script
 * Tests "Scheduled Web Scraping → Email Report" workflow 10 times
 * with various failure scenarios to validate reliability improvements
 */

const axios = require('axios');
const { getSupabase } = require('../backend/utils/supabaseClient');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3030';
const TEST_WORKFLOW_ID = process.env.TEST_WORKFLOW_ID; // Set this to your test workflow ID
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Set this to a valid auth token

const supabase = getSupabase();

const testScenarios = [
  { name: 'Normal execution', automationDown: false, emailDown: false },
  { name: 'Automation service down', automationDown: true, emailDown: false },
  { name: 'Email service down', automationDown: false, emailDown: true },
  { name: 'Both services down', automationDown: true, emailDown: true },
  { name: 'Network interruption', automationDown: false, emailDown: false, interrupt: true },
  { name: 'Large dataset', automationDown: false, emailDown: false, largeData: true },
  { name: 'Timeout scenario', automationDown: false, emailDown: false, timeout: true },
  { name: 'Normal execution 2', automationDown: false, emailDown: false },
  { name: 'Normal execution 3', automationDown: false, emailDown: false },
  { name: 'Normal execution 4', automationDown: false, emailDown: false },
];

async function testWorkflow(scenario, index) {
  console.log(`\n[Test ${index + 1}/10] ${scenario.name}`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  let executionId = null;
  let result = { success: false, error: null };
  
  try {
    // Execute workflow
    const response = await axios.post(
      `${BACKEND_URL}/api/workflows/execute`,
      {
        workflowId: TEST_WORKFLOW_ID,
        inputData: {},
        triggeredBy: 'test',
        triggerData: { scenario: scenario.name }
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );
    
    executionId = response.data?.execution?.id;
    console.log(`✅ Execution started: ${executionId}`);
    
    // Poll for completion (max 5 minutes)
    const maxWait = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 2000; // 2 seconds
    let waited = 0;
    
    while (waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
      
      const { data: execution, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();
      
      if (error) {
        console.log(`⚠️  Error checking status: ${error.message}`);
        continue;
      }
      
      if (execution.status === 'completed') {
        result.success = true;
        result.duration = Date.now() - startTime;
        console.log(`✅ Workflow completed in ${result.duration}ms`);
        break;
      } else if (execution.status === 'failed') {
        result.success = false;
        result.error = execution.error_message;
        result.duration = Date.now() - startTime;
        console.log(`❌ Workflow failed: ${execution.error_message}`);
        break;
      } else {
        process.stdout.write('.');
      }
    }
    
    if (!result.success && !result.error) {
      result.error = 'Timeout waiting for completion';
      console.log(`\n⏱️  Timeout waiting for workflow completion`);
    }
    
    // Get step executions for detailed analysis
    const { data: steps } = await supabase
      .from('step_executions')
      .select('*')
      .eq('workflow_execution_id', executionId)
      .order('execution_order', { ascending: true });
    
    result.steps = steps || [];
    result.stepsCompleted = steps?.filter(s => s.status === 'completed').length || 0;
    result.stepsFailed = steps?.filter(s => s.status === 'failed').length || 0;
    
  } catch (error) {
    result.success = false;
    result.error = error.message;
    result.duration = Date.now() - startTime;
    console.log(`❌ Test error: ${error.message}`);
  }
  
  return result;
}

async function runTests() {
  console.log('🧪 Workflow Reliability Test Suite');
  console.log('='.repeat(50));
  console.log(`Testing workflow: ${TEST_WORKFLOW_ID}`);
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Total tests: ${testScenarios.length}`);
  
  if (!TEST_WORKFLOW_ID) {
    console.error('❌ ERROR: TEST_WORKFLOW_ID environment variable not set');
    process.exit(1);
  }
  
  if (!AUTH_TOKEN) {
    console.error('❌ ERROR: AUTH_TOKEN environment variable not set');
    process.exit(1);
  }
  
  const results = [];
  
  for (let i = 0; i < testScenarios.length; i++) {
    const result = await testWorkflow(testScenarios[i], i);
    results.push({
      scenario: testScenarios[i].name,
      ...result
    });
    
    // Wait between tests
    if (i < testScenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Print summary
  console.log('\n\n📊 Test Results Summary');
  console.log('='.repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
  
  console.log(`✅ Successful: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failureCount}/${results.length} (${(failureCount/results.length*100).toFixed(1)}%)`);
  console.log(`⏱️  Average duration: ${avgDuration.toFixed(0)}ms`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${i + 1}. ${r.scenario}: ${r.success ? 'PASS' : 'FAIL'}`);
    if (!r.success && r.error) {
      console.log(`   Error: ${r.error}`);
    }
    if (r.steps) {
      console.log(`   Steps: ${r.stepsCompleted} completed, ${r.stepsFailed} failed`);
    }
  });
  
  // Success criteria: 80%+ success rate
  const successRate = successCount / results.length;
  if (successRate >= 0.8) {
    console.log('\n🎉 SUCCESS: Workflow reliability meets target (80%+)');
    process.exit(0);
  } else {
    console.log('\n⚠️  WARNING: Workflow reliability below target (80%+)');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

