#!/bin/bash
# Validate RAG Knowledge Base
# 
# This script ensures the AI Agent's RAG knowledge is always up-to-date with:
# - Workflow steps available in the codebase
# - Task types supported
# - Integrations available
# - Features and capabilities
# - System prompts in AI Agent
#
# Fails if knowledge is missing or outdated.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/rpa-system/backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Track validation errors
ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}🔍 VALIDATING RAG KNOWLEDGE BASE${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Node.js is required but not found${RESET}"
  exit 1
fi

# Create temporary validation script
VALIDATION_SCRIPT=$(cat << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = process.env.BACKEND_DIR || path.join(__dirname, '../rpa-system/backend');

// Extract workflow steps from aiWorkflowAgent.js
function extractWorkflowSteps() {
  const filePath = path.join(BACKEND_DIR, 'services/aiWorkflowAgent.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find WORKFLOW_STEPS object
  const stepsMatch = content.match(/const WORKFLOW_STEPS\s*=\s*\{([\s\S]*?)\};/);
  if (!stepsMatch) {
    throw new Error('Could not find WORKFLOW_STEPS in aiWorkflowAgent.js');
  }
  
  const stepsContent = stepsMatch[1];
  const stepIds = [];
  
  // Extract step IDs (e.g., "start:", "web_scrape:", etc.)
  const stepIdRegex = /(\w+):\s*\{/g;
  let match;
  while ((match = stepIdRegex.exec(stepsContent)) !== null) {
    stepIds.push(match[1]);
  }
  
  return stepIds;
}

// Extract task types from codebase
function extractTaskTypes() {
  const taskTypes = new Set();
  
  // Check aiWorkflowAgent.js for task_type mentions
  const aiAgentPath = path.join(BACKEND_DIR, 'services/aiWorkflowAgent.js');
  if (fs.existsSync(aiAgentPath)) {
    const content = fs.readFileSync(aiAgentPath, 'utf-8');
    const taskTypeMatches = content.matchAll(/task_type['":\s]*['"](\w+)['"]/g);
    for (const match of taskTypeMatches) {
      taskTypes.add(match[1]);
    }
  }
  
  // Check app.js for task_type enum values
  const appPath = path.join(BACKEND_DIR, 'app.js');
  if (fs.existsSync(appPath)) {
    const content = fs.readFileSync(appPath, 'utf-8');
    // Look for common task types
    const commonTypes = ['invoice_download', 'web_scraping', 'form_submission'];
    commonTypes.forEach(type => {
      if (content.includes(type)) {
        taskTypes.add(type);
      }
    });
  }
  
  return Array.from(taskTypes);
}

// Extract integrations from addIntegrationKnowledge.js
function extractIntegrations() {
  const filePath = path.join(BACKEND_DIR, 'services/addIntegrationKnowledge.js');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const integrations = [];
  
  // Look for integration names in the content
  const integrationNames = ['Slack', 'Gmail', 'Google Sheets', 'Google Meet', 'WhatsApp', 'Notion'];
  integrationNames.forEach(name => {
    if (content.includes(name)) {
      integrations.push(name);
    }
  });
  
  return integrations;
}

// Extract knowledge from RAG seed function
function extractRAGKnowledge() {
  const filePath = path.join(BACKEND_DIR, 'services/ragClient.js');
  if (!fs.existsSync(filePath)) {
    return { steps: [], taskTypes: [], features: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const knowledge = {
    steps: [],
    taskTypes: [],
    features: []
  };
  
  // Extract workflow steps from RAG knowledge
  const stepSources = content.matchAll(/source:\s*['"]easyflow:help:(\w+)-step['"]/g);
  for (const match of stepSources) {
    knowledge.steps.push(match[1]);
  }
  
  // Extract task types from RAG knowledge
  if (content.includes('invoice_download')) knowledge.taskTypes.push('invoice_download');
  if (content.includes('web_scraping')) knowledge.taskTypes.push('web_scraping');
  if (content.includes('form_submission')) knowledge.taskTypes.push('form_submission');
  
  // Extract features
  const featureSources = content.matchAll(/source:\s*['"]easyflow:feature:(\w+)['"]/g);
  for (const match of featureSources) {
    knowledge.features.push(match[1]);
  }
  
  return knowledge;
}

// Extract system prompt features from aiWorkflowAgent.js
function extractSystemPromptFeatures() {
  const filePath = path.join(BACKEND_DIR, 'services/aiWorkflowAgent.js');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const features = [];
  
  // Look for NEW FEATURES section
  const newFeaturesMatch = content.match(/## NEW FEATURES[^:]*:\s*([\s\S]*?)(?=##|$)/);
  if (newFeaturesMatch) {
    const featuresText = newFeaturesMatch[1];
    // Extract feature names (lines starting with -)
    const featureLines = featuresText.match(/-\s*([^\n]+)/g) || [];
    featureLines.forEach(line => {
      const featureName = line.replace(/^-\s*/, '').trim();
      if (featureName) {
        features.push(featureName);
      }
    });
  }
  
  return features;
}

// Main validation
try {
  console.log('📋 Extracting features from codebase...');
  
  const actualSteps = extractWorkflowSteps();
  const actualTaskTypes = extractTaskTypes();
  const actualIntegrations = extractIntegrations();
  const systemPromptFeatures = extractSystemPromptFeatures();
  
  console.log('📚 Extracting knowledge from RAG seed function...');
  const ragKnowledge = extractRAGKnowledge();
  
  console.log('\n🔍 Comparing codebase vs RAG knowledge...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check workflow steps
  console.log('📊 Workflow Steps:');
  const missingSteps = actualSteps.filter(step => !ragKnowledge.steps.includes(step));
  const extraSteps = ragKnowledge.steps.filter(step => !actualSteps.includes(step));
  
  if (missingSteps.length > 0) {
    console.log(`  ${'❌'} Missing in RAG: ${missingSteps.join(', ')}`);
    hasErrors = true;
  }
  if (extraSteps.length > 0) {
    console.log(`  ${'⚠️'} Extra in RAG (may be outdated): ${extraSteps.join(', ')}`);
    hasWarnings = true;
  }
  if (missingSteps.length === 0 && extraSteps.length === 0) {
    console.log(`  ${'✅'} All workflow steps documented in RAG`);
  }
  
  // Check task types
  console.log('\n📊 Task Types:');
  const missingTaskTypes = actualTaskTypes.filter(type => !ragKnowledge.taskTypes.includes(type));
  const extraTaskTypes = ragKnowledge.taskTypes.filter(type => !actualTaskTypes.includes(type));
  
  if (missingTaskTypes.length > 0) {
    console.log(`  ${'❌'} Missing in RAG: ${missingTaskTypes.join(', ')}`);
    hasErrors = true;
  }
  if (extraTaskTypes.length > 0) {
    console.log(`  ${'⚠️'} Extra in RAG (may be outdated): ${extraTaskTypes.join(', ')}`);
    hasWarnings = true;
  }
  if (missingTaskTypes.length === 0 && extraTaskTypes.length === 0) {
    console.log(`  ${'✅'} All task types documented in RAG`);
  }
  
  // Check integrations
  console.log('\n📊 Integrations:');
  if (actualIntegrations.length > 0) {
    console.log(`  ${'✅'} Found ${actualIntegrations.length} integrations: ${actualIntegrations.join(', ')}`);
    console.log(`  ${'ℹ️'} Integration knowledge is managed separately in addIntegrationKnowledge.js`);
  } else {
    console.log(`  ${'⚠️'} No integrations found (may need to check integrationRoutes.js)`);
    hasWarnings = true;
  }
  
  // Check system prompt features
  console.log('\n📊 System Prompt Features:');
  if (systemPromptFeatures.length > 0) {
    console.log(`  ${'✅'} Found ${systemPromptFeatures.length} features in system prompt`);
    // Check if features are in RAG knowledge
    const missingFeatures = systemPromptFeatures.filter(f => {
      // Simple check - see if feature name appears in RAG knowledge
      const ragContent = fs.readFileSync(path.join(BACKEND_DIR, 'services/ragClient.js'), 'utf-8');
      return !ragContent.includes(f.substring(0, 20)); // Check first 20 chars
    });
    if (missingFeatures.length > 0) {
      console.log(`  ${'⚠️'} Some features may not be in RAG: ${missingFeatures.length} features`);
      hasWarnings = true;
    }
  } else {
    console.log(`  ${'⚠️'} No features found in system prompt`);
    hasWarnings = true;
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED: RAG knowledge is missing critical information');
    console.log('   Please update ragClient.js seedEasyFlowKnowledge() function');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS: Some knowledge may be outdated');
    console.log('   Consider updating RAG knowledge for better AI Agent accuracy');
    process.exit(0);
  } else {
    console.log('✅ VALIDATION PASSED: RAG knowledge is up-to-date');
    process.exit(0);
  }
  
} catch (error) {
  console.error(`\n❌ Validation error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
NODE_SCRIPT
)

# Write validation script to temp file
TEMP_SCRIPT=$(mktemp)
echo "$VALIDATION_SCRIPT" > "$TEMP_SCRIPT"

# Run validation
cd "$PROJECT_ROOT"
export BACKEND_DIR="$BACKEND_DIR"
node "$TEMP_SCRIPT"

# Cleanup
rm -f "$TEMP_SCRIPT"

