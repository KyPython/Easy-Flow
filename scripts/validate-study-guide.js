#!/usr/bin/env node
/**
 * Validate Study Guide against actual codebase
 * Ensures documentation matches implementation
 */

const fs = require('fs');
const path = require('path');

const STUDY_GUIDE_PATH = path.join(__dirname, '..', 'docs', 'guides', 'COMPREHENSIVE_STUDY_GUIDE.md');
const ROOT_DIR = path.join(__dirname, '..');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    log(`  ❌ ${description}: ${filePath}`, 'red');
    return false;
  }
  return true;
}

function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(ROOT_DIR, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  if (!exists) {
    log(`  ❌ ${description}: ${dirPath}`, 'red');
    return false;
  }
  return true;
}

function getFilesInDirectory(dirPath, extension = null) {
  const fullPath = path.join(ROOT_DIR, dirPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  try {
    const files = fs.readdirSync(fullPath);
    return files
      .filter(file => {
        const filePath = path.join(fullPath, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return false;
        if (extension) {
          return file.endsWith(extension);
        }
        return true;
      })
      .map(file => file.replace(extension || '', ''));
  } catch (error) {
    return [];
  }
}

function getDirectoriesInDirectory(dirPath) {
  const fullPath = path.join(ROOT_DIR, dirPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  try {
    return fs.readdirSync(fullPath).filter(file => {
      const filePath = path.join(fullPath, file);
      return fs.statSync(filePath).isDirectory();
    });
  } catch (error) {
    return [];
  }
}

function extractListedItems(content, sectionPattern) {
  const sectionMatch = content.match(sectionPattern);
  if (!sectionMatch) return [];
  
  const section = sectionMatch[0];
  // Extract items from markdown lists (lines starting with - or *)
  const items = [];
  const lines = section.split('\n');
  let inList = false;
  
  for (const line of lines) {
    if (line.match(/^[-*]\s+`([^`]+)`/)) {
      const match = line.match(/`([^`]+)`/);
      if (match) {
        items.push(match[1]);
      }
    } else if (line.match(/^[-*]\s+[^`]/)) {
      // Plain list item, try to extract filename
      const match = line.match(/^[-*]\s+(.+?)(?:\s+-|$)/);
      if (match) {
        const item = match[1].trim();
        // Extract filename if it looks like one
        const filenameMatch = item.match(/([a-zA-Z0-9_\-]+\.(js|jsx|ts|tsx|py|md))/);
        if (filenameMatch) {
          items.push(filenameMatch[1]);
        }
      }
    }
  }
  
  return items;
}

function validateStudyGuide() {
  log('\n📚 Validating Study Guide against Codebase...\n', 'blue');
  
  if (!fs.existsSync(STUDY_GUIDE_PATH)) {
    log('❌ Study guide not found!', 'red');
    process.exit(1);
  }
  
  const studyGuideContent = fs.readFileSync(STUDY_GUIDE_PATH, 'utf-8');
  let errors = [];
  let warnings = [];
  let passed = 0;
  
  // 1. Validate Frontend Pages
  log('1. Validating Frontend Pages...', 'blue');
  const frontendPagesDir = 'rpa-system/rpa-dashboard/src/pages';
  const actualPages = getFilesInDirectory(frontendPagesDir, '.jsx')
    .filter(page => !page.includes('.test') && !page.includes('.module'));
  
  const pagePattern = /#### \*\*Pages\*\*[^#]+/s;
  const listedPages = extractListedItems(studyGuideContent, pagePattern);
  
  for (const page of listedPages) {
    if (actualPages.includes(page) || actualPages.includes(page.replace('.jsx', ''))) {
      passed++;
    } else {
      warnings.push(`Page mentioned but not found: ${page}`);
      log(`  ⚠️  Page mentioned but not found: ${page}`, 'yellow');
    }
  }
  
  // Check for pages that exist but aren't documented
  for (const page of actualPages) {
    if (page !== 'README' && !listedPages.some(listed => listed.includes(page))) {
      warnings.push(`Page exists but not documented: ${page}.jsx`);
      log(`  ⚠️  Page exists but not documented: ${page}.jsx`, 'yellow');
    }
  }
  
  // 2. Validate Backend Services
  log('\n2. Validating Backend Services...', 'blue');
  const backendServicesDir = 'rpa-system/backend/services';
  const actualServices = getFilesInDirectory(backendServicesDir, '.js')
    .filter(service => service !== 'README');
  
  const servicePattern = /#### \*\*Core Services\*\*[^#]+/s;
  const listedServices = extractListedItems(studyGuideContent, servicePattern);
  
  for (const service of listedServices) {
    if (actualServices.includes(service) || actualServices.includes(service.replace('.js', ''))) {
      passed++;
      log(`  ✓ ${service}`, 'green');
    } else {
      errors.push(`Service mentioned but not found: ${service}`);
      log(`  ❌ Service mentioned but not found: ${service}`, 'red');
    }
  }
  
  // Check integration services
  const integrationServicesDir = 'rpa-system/backend/services/integrations';
  const actualIntegrations = getFilesInDirectory(integrationServicesDir, '.js');
  const integrationPattern = /#### \*\*Integration Services\*\*[^#]+/s;
  const listedIntegrations = extractListedItems(studyGuideContent, integrationPattern);
  
  for (const integration of listedIntegrations) {
    if (actualIntegrations.includes(integration) || actualIntegrations.includes(integration.replace('.js', ''))) {
      passed++;
      log(`  ✓ ${integration}`, 'green');
    } else {
      warnings.push(`Integration mentioned but not found: ${integration}`);
      log(`  ⚠️  Integration mentioned but not found: ${integration}`, 'yellow');
    }
  }
  
  // 3. Validate Frontend Components
  log('\n3. Validating Frontend Components...', 'blue');
  const componentsDir = 'rpa-system/rpa-dashboard/src/components';
  const actualComponents = getDirectoriesInDirectory(componentsDir);
  
  const componentPattern = /#### \*\*Key Components\*\*[^#]+/s;
  const listedComponents = extractListedItems(studyGuideContent, componentPattern);
  
  for (const component of listedComponents) {
    const componentName = component.replace(/[`\/]/g, '');
    if (actualComponents.includes(componentName)) {
      passed++;
      log(`  ✓ ${componentName}`, 'green');
    } else {
      warnings.push(`Component mentioned but not found: ${componentName}`);
      log(`  ⚠️  Component mentioned but not found: ${componentName}`, 'yellow');
    }
  }
  
  // 4. Validate Hooks
  log('\n4. Validating Frontend Hooks...', 'blue');
  const hooksDir = 'rpa-system/rpa-dashboard/src/hooks';
  const actualHooks = getFilesInDirectory(hooksDir, '.js')
    .filter(hook => hook !== 'README');
  
  const hookPattern = /#### \*\*Hooks\*\*[^#]+/s;
  const listedHooks = extractListedItems(studyGuideContent, hookPattern);
  
  for (const hook of listedHooks) {
    if (actualHooks.includes(hook) || actualHooks.includes(hook.replace('.js', ''))) {
      passed++;
      log(`  ✓ ${hook}`, 'green');
    } else {
      warnings.push(`Hook mentioned but not found: ${hook}`);
      log(`  ⚠️  Hook mentioned but not found: ${hook}`, 'yellow');
    }
  }
  
  // 5. Validate Technology Stack Versions
  log('\n5. Validating Technology Stack...', 'blue');
  
  // Check package.json files for versions
  const frontendPackageJson = path.join(ROOT_DIR, 'rpa-system/rpa-dashboard/package.json');
  const backendPackageJson = path.join(ROOT_DIR, 'rpa-system/backend/package.json');
  
  if (fs.existsSync(frontendPackageJson)) {
    const frontendPkg = JSON.parse(fs.readFileSync(frontendPackageJson, 'utf-8'));
    const reactVersion = frontendPkg.dependencies?.react || frontendPkg.devDependencies?.react;
    if (reactVersion && studyGuideContent.includes(reactVersion)) {
      passed++;
      log(`  ✓ React version matches: ${reactVersion}`, 'green');
    } else if (reactVersion) {
      warnings.push(`React version mismatch: guide may need update`);
      log(`  ⚠️  React version in code: ${reactVersion}`, 'yellow');
    }
  }
  
  // 6. Validate Directory Structure
  log('\n6. Validating Directory Structure...', 'blue');
  
  const requiredDirs = [
    { path: 'rpa-system/rpa-dashboard/src/pages', desc: 'Frontend pages directory' },
    { path: 'rpa-system/rpa-dashboard/src/components', desc: 'Frontend components directory' },
    { path: 'rpa-system/rpa-dashboard/src/hooks', desc: 'Frontend hooks directory' },
    { path: 'rpa-system/backend/services', desc: 'Backend services directory' },
    { path: 'rpa-system/backend/middleware', desc: 'Backend middleware directory' },
    { path: 'rpa-system/backend/routes', desc: 'Backend routes directory' },
    { path: 'rpa-system/automation/automation-service', desc: 'Automation service directory' },
  ];
  
  for (const dir of requiredDirs) {
    if (checkDirectoryExists(dir.path, dir.desc)) {
      passed++;
    } else {
      errors.push(`Required directory missing: ${dir.path}`);
    }
  }
  
  // 7. Check for new services not in guide
  log('\n7. Checking for undocumented services...', 'blue');
  const allServices = [
    ...actualServices,
    ...actualIntegrations.map(i => `integrations/${i}`),
  ];
  
  const allListedServices = [
    ...listedServices,
    ...listedIntegrations,
  ];
  
  for (const service of allServices) {
    const serviceName = service.replace('.js', '').replace('integrations/', '');
    if (!allListedServices.some(listed => listed.includes(serviceName))) {
      warnings.push(`Service exists but not documented: ${service}`);
      log(`  ⚠️  Service exists but not documented: ${service}`, 'yellow');
    }
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 Validation Summary', 'blue');
  log('='.repeat(60), 'blue');
  log(`✓ Passed: ${passed}`, 'green');
  log(`⚠️  Warnings: ${warnings.length}`, warnings.length > 0 ? 'yellow' : 'green');
  log(`❌ Errors: ${errors.length}`, errors.length > 0 ? 'red' : 'green');
  
  if (warnings.length > 0) {
    log('\n⚠️  Warnings:', 'yellow');
    warnings.slice(0, 10).forEach(w => log(`  - ${w}`, 'yellow'));
    if (warnings.length > 10) {
      log(`  ... and ${warnings.length - 10} more warnings`, 'yellow');
    }
  }
  
  if (errors.length > 0) {
    log('\n❌ Errors:', 'red');
    errors.forEach(e => log(`  - ${e}`, 'red'));
  }
  
  log('\n' + '='.repeat(60), 'blue');
  
  // Check if running in strict/blocking mode (main branch)
  // STRICT_MODE can be set via environment variable or detected via CI context
  const isStrictMode = process.env.STRICT_MODE === 'true' || 
                       process.env.BLOCKING_MODE === 'true' ||
                       process.env.GITHUB_REF === 'refs/heads/main' ||
                       (process.env.GITHUB_BASE_REF === 'main' && process.env.GITHUB_EVENT_NAME === 'pull_request');

  if (errors.length > 0) {
    log('\n❌ Study guide validation failed!', 'red');
    log('Please update docs/guides/COMPREHENSIVE_STUDY_GUIDE.md to match the codebase.', 'red');
    
    // In permissive mode (non-main branch), errors become warnings
    if (!isStrictMode) {
      log('\n⚠️  Continuing in permissive mode (errors treated as warnings on feature branch).', 'yellow');
      process.exit(0);
    }
    process.exit(1);
  } else if (warnings.length > 0) {
    log('\n⚠️  Study guide has warnings but no critical errors.', 'yellow');
    log('Consider updating docs/guides/COMPREHENSIVE_STUDY_GUIDE.md to include missing items.', 'yellow');
    
    // In strict/blocking mode (main branch), warnings should fail the check
    if (isStrictMode) {
      log('\n❌ Warnings are not allowed in strict mode (main branch).', 'red');
      log('Documentation must be complete before production deployment.', 'red');
      process.exit(1);
    } else {
      log('\n⚠️  Continuing in permissive mode (warnings allowed on dev branch).', 'yellow');
      process.exit(0);
    }
  } else {
    log('\n✓ Study guide validation passed!', 'green');
    process.exit(0);
  }
}

// Run validation
validateStudyGuide();

