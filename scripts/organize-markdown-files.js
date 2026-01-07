#!/usr/bin/env node
/**
 * Organize all markdown files in the codebase into a clear structure
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// Define organization structure
const ORGANIZATION = {
  // Keep in root (important docs)
  root: [
    'README.md',
    'COMPREHENSIVE_STUDY_GUIDE.md',
    '.cursor-rules.md',
  ],
  
  // Setup & Configuration
  'docs/setup': [
    { source: 'rpa-system/rpa-dashboard/FRONTEND_ENV_SETUP.md', keep: false },
    { source: 'rpa-system/rpa-dashboard/SERVICE_WORKER_CONFIG_SETUP.md', keep: false },
    { source: 'rpa-system/backend/BACKEND_ENV_SETUP.md', keep: false },
    { source: 'GOOGLE_VERIFICATION_STEPS.md', keep: false },
    { source: 'GOOGLE_CALENDAR_FIX.md', keep: false },
    { source: 'NAMECHEAP_DNS_SETUP.md', keep: false },
    { source: 'NOTION_LOGO_INSTRUCTIONS.md', keep: false },
  ],
  
  // Architecture & Design
  'docs/architecture': [
    { source: 'docs/OBSERVABILITY_ARCHITECTURE.md', keep: false },
    { source: 'docs/COMPETITIVE_ADVANTAGE.md', keep: false },
    { source: 'docs/WORKFLOW_EXECUTION_MODES.md', keep: false },
    { source: 'docs/EXECUTION_MODE_COST_ANALYSIS.md', keep: false },
    { source: 'ROUTE_MAP.md', keep: false },
  ],
  
  // Development Guides
  'docs/development': [
    { source: 'docs/DAILY_DEVELOPER_GUIDE.md', keep: false },
    { source: 'docs/FEATURE_SHIPPING_GUIDE.md', keep: false },
    { source: 'docs/WORKFLOW.md', keep: false },
    { source: 'docs/WEEK2_LEARNING_APPLICATION.md', keep: false },
  ],
  
  // CI/CD & DevOps
  'docs/devops': [
    { source: 'docs/CI_CD_PIPELINE_SIMPLE.md', keep: false },
    { source: 'docs/BRANCH_AWARE_CI_CD.md', keep: false },
    { source: 'docs/CI_CD_AUTOMATION_STATUS.md', keep: false },
    { source: 'docs/CODE_VALIDATION_SYSTEM.md', keep: false },
    { source: 'docs/ACCESSIBILITY_CI_CD.md', keep: false },
    { source: 'docs/GITHUB_BRANCH_PROTECTION_SETUP.md', keep: false },
    { source: 'docs/DEVOPS_PRODUCTIVITY_SUITE_INTEGRATION.md', keep: false },
    { source: 'AUTOMATED_CICD_PROTECTION.md', keep: false },
  ],
  
  // Features & Integrations
  'docs/features': [
    { source: 'docs/CLIENT_AUTOMATION_GUIDE.md', keep: false },
    { source: 'docs/CLIENT_AUTOMATION_QUICK_START.md', keep: false },
    { source: 'docs/OUTREACH_TEMPLATES.md', keep: false },
    { source: 'docs/RAG_INTEGRATION.md', keep: false },
    { source: 'docs/RAG_KNOWLEDGE_VALIDATION.md', keep: false },
    { source: 'REDDIT_MONITORING_IMPLEMENTATION.md', keep: false },
  ],
  
  // Fixes & Migrations
  'docs/fixes': [
    { source: 'docs/CRITICAL_FIXES_APPLIED.md', keep: false },
    { source: 'docs/FIREBASE_AUTH_FIX.md', keep: false },
    { source: 'docs/VERCEL_DEPLOYMENT_FIX.md', keep: false },
    { source: 'docs/ENVIRONMENT_AWARE_MIGRATION.md', keep: false },
    { source: 'docs/GOOGLE_OAUTH_VERIFICATION.md', keep: false },
  ],
  
  // Philosophy & Strategy
  'docs/philosophy': [
    { source: 'docs/SOFTWARE_ENTROPY_PHILOSOPHY.md', keep: false },
    { source: 'docs/SOFTWARE_ENTROPY_INTEGRATION_PLAN.md', keep: false },
    { source: 'docs/SOFTWARE_ENTROPY_INTEGRATION_COMPLETE.md', keep: false },
    { source: 'docs/STARTUP_OPTIMIZATION.md', keep: false },
    { source: 'ROCKEFELLER_DECISION_ANALYSIS.md', keep: false },
    { source: 'ROCKEFELLER_IMPLEMENTATION_PLAN.md', keep: false },
  ],
  
  // Keep component READMEs in place (they're useful there)
  // These stay where they are:
  // - rpa-system/rpa-dashboard/src/README.md
  // - rpa-system/rpa-dashboard/src/components/README.md
  // - rpa-system/rpa-dashboard/src/pages/README.md
  // - rpa-system/backend/README.md
  // - rpa-system/backend/services/README.md
  // - rpa-system/backend/routes/README.md
};

function ensureDirectory(dirPath) {
  const fullPath = path.join(ROOT_DIR, dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function moveFile(source, dest) {
  const sourcePath = path.join(ROOT_DIR, source);
  const destPath = path.join(ROOT_DIR, dest);
  
  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Source file not found: ${source}`);
    return false;
  }
  
  // Skip if already in destination
  if (fs.existsSync(destPath)) {
    console.log(`  ⊘ Already exists at destination: ${dest}`);
    // Remove source if it's different
    if (sourcePath !== destPath) {
      try {
        fs.unlinkSync(sourcePath);
        console.log(`  ✓ Removed duplicate: ${source}`);
      } catch (e) {
        // Ignore errors removing source
      }
    }
    return true;
  }
  
  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  ensureDirectory(destDir);
  
  // Copy then delete (more reliable than rename across filesystems)
  try {
    fs.copyFileSync(sourcePath, destPath);
    // Only delete source if it's not the same file
    if (sourcePath !== destPath) {
      fs.unlinkSync(sourcePath);
    }
    console.log(`✓ Moved: ${source} → ${dest}`);
    return true;
  } catch (error) {
    console.error(`❌ Error moving ${source}: ${error.message}`);
    return false;
  }
}

function organizeFiles() {
  console.log('📚 Organizing markdown files...\n');
  
  let moved = 0;
  let skipped = 0;
  
  // Process each category
  for (const [category, files] of Object.entries(ORGANIZATION)) {
    if (category === 'root') {
      // Skip root files - they stay where they are
      continue;
    }
    
    console.log(`\n📁 Category: ${category}`);
    
    for (const fileEntry of files) {
      const file = typeof fileEntry === 'string' ? fileEntry : fileEntry.source;
      const fileName = path.basename(file);
      const destPath = path.join(category, fileName);
      
      // Skip if already in the right place
      if (file.startsWith(category + '/')) {
        console.log(`  ⊘ Already in place: ${file}`);
        skipped++;
        continue;
      }
      
      if (moveFile(file, destPath)) {
        moved++;
      } else {
        skipped++;
      }
    }
  }
  
  // Create index file
  createIndexFile();
  
  console.log(`\n✅ Organization complete!`);
  console.log(`   Moved: ${moved} files`);
  console.log(`   Skipped: ${skipped} files (not found or already in place)`);
}

function createIndexFile() {
  const indexContent = `# Documentation Index

This directory contains all project documentation organized by category.

## 📚 Documentation Structure

### Setup & Configuration (\`docs/setup/\`)
- **FRONTEND_ENV_SETUP.md** - Frontend environment setup guide
- **BACKEND_ENV_SETUP.md** - Backend environment setup guide
- **SERVICE_WORKER_CONFIG_SETUP.md** - Service worker configuration
- **GOOGLE_VERIFICATION_STEPS.md** - Google OAuth verification steps
- **GOOGLE_CALENDAR_FIX.md** - Google Calendar integration fixes
- **NAMECHEAP_DNS_SETUP.md** - Namecheap DNS configuration
- **NOTION_LOGO_INSTRUCTIONS.md** - Notion logo setup instructions

### Architecture & Design (\`docs/architecture/\`)
- **OBSERVABILITY_ARCHITECTURE.md** - Observability system architecture
- **COMPETITIVE_ADVANTAGE.md** - Competitive analysis and advantages
- **WORKFLOW_EXECUTION_MODES.md** - Execution modes documentation
- **EXECUTION_MODE_COST_ANALYSIS.md** - Cost analysis for execution modes
- **ROUTE_MAP.md** - API route mapping

### Development Guides (\`docs/development/\`)
- **DAILY_DEVELOPER_GUIDE.md** - Daily development workflow guide
- **FEATURE_SHIPPING_GUIDE.md** - Guide for shipping new features
- **WORKFLOW.md** - Workflow development guide
- **WEEK2_LEARNING_APPLICATION.md** - Learning application documentation

### CI/CD & DevOps (\`docs/devops/\`)
- **CI_CD_PIPELINE_SIMPLE.md** - CI/CD pipeline overview
- **BRANCH_AWARE_CI_CD.md** - Branch-aware CI/CD configuration
- **CI_CD_AUTOMATION_STATUS.md** - CI/CD automation status
- **CODE_VALIDATION_SYSTEM.md** - Code validation system documentation
- **ACCESSIBILITY_CI_CD.md** - Accessibility CI/CD checks
- **GITHUB_BRANCH_PROTECTION_SETUP.md** - GitHub branch protection setup
- **DEVOPS_PRODUCTIVITY_SUITE_INTEGRATION.md** - DevOps tools integration
- **AUTOMATED_CICD_PROTECTION.md** - Automated CI/CD protection

### Features & Integrations (\`docs/features/\`)
- **CLIENT_AUTOMATION_GUIDE.md** - Client automation guide
- **CLIENT_AUTOMATION_QUICK_START.md** - Quick start for client automation
- **OUTREACH_TEMPLATES.md** - Outreach email templates
- **RAG_INTEGRATION.md** - RAG (Retrieval-Augmented Generation) integration
- **RAG_KNOWLEDGE_VALIDATION.md** - RAG knowledge validation
- **REDDIT_MONITORING_IMPLEMENTATION.md** - Reddit monitoring feature

### Fixes & Migrations (\`docs/fixes/\`)
- **CRITICAL_FIXES_APPLIED.md** - Critical bug fixes documentation
- **FIREBASE_AUTH_FIX.md** - Firebase authentication fixes
- **VERCEL_DEPLOYMENT_FIX.md** - Vercel deployment fixes
- **ENVIRONMENT_AWARE_MIGRATION.md** - Environment-aware migration guide
- **GOOGLE_OAUTH_VERIFICATION.md** - Google OAuth verification fixes

### Philosophy & Strategy (\`docs/philosophy/\`)
- **SOFTWARE_ENTROPY_PHILOSOPHY.md** - Software entropy philosophy
- **SOFTWARE_ENTROPY_INTEGRATION_PLAN.md** - Integration plan for software entropy
- **SOFTWARE_ENTROPY_INTEGRATION_COMPLETE.md** - Completed integration documentation
- **STARTUP_OPTIMIZATION.md** - Startup optimization strategies
- **ROCKEFELLER_DECISION_ANALYSIS.md** - Decision-making framework
- **ROCKEFELLER_IMPLEMENTATION_PLAN.md** - Implementation planning framework

## 📖 Main Documentation

- **README.md** (root) - Project overview and quick start
- **COMPREHENSIVE_STUDY_GUIDE.md** (root) - Complete system architecture guide

## 📝 Component Documentation

Component-specific READMEs are kept in their respective directories:
- \`rpa-system/rpa-dashboard/src/README.md\` - Frontend overview
- \`rpa-system/rpa-dashboard/src/components/README.md\` - Component documentation
- \`rpa-system/rpa-dashboard/src/pages/README.md\` - Page documentation
- \`rpa-system/backend/README.md\` - Backend overview
- \`rpa-system/backend/services/README.md\` - Services documentation
- \`rpa-system/backend/routes/README.md\` - Routes documentation

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;

  const indexPath = path.join(ROOT_DIR, 'docs', 'INDEX.md');
  fs.writeFileSync(indexPath, indexContent);
  console.log(`\n✓ Created documentation index: docs/INDEX.md`);
}

// Run organization
organizeFiles();

