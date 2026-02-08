#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

class DataIntelligenceAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.violations = [];
    this.warnings = [];
    this.passed = [];
    this.instrumentation = {
      analytics: 0,
      metrics: 0,
      logging: 0,
      performance: 0
    };
  }

  async analyze() {
    console.log(`${BOLD}${BLUE}Analyzing codebase for Data Intelligence (Rockefeller Filter #3)...${RESET}\n`);
    
    const files = this.findCodeFiles();
    
    for (const file of files) {
      await this.analyzeFile(file);
    }
    
    this.generateReport();
    
    return {
      passed: this.passed.length,
      warnings: this.warnings.length,
      violations: this.violations.length,
      score: this.calculateScore(),
      instrumentation: this.instrumentation,
      exitCode: this.violations.length > 0 ? 1 : 0
    };
  }

  findCodeFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    for (const searchPath of this.searchPaths) {
      walkDir(searchPath);
    }
    
    return files;
  }

  async analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    const warnings = [];
    
    this.checkAnalyticsInstrumentation(filePath, content, issues, warnings);
    this.checkPerformanceMonitoring(filePath, content, issues, warnings);
    this.checkErrorTracking(filePath, content, issues, warnings);
    this.checkBusinessMetrics(filePath, content, issues, warnings);
    this.checkMissingInstrumentation(filePath, content, issues, warnings);
    
    if (issues.length > 0) {
      this.violations.push({ file: filePath, issues });
    } else if (warnings.length > 0) {
      this.warnings.push({ file: filePath, warnings });
    } else {
      this.passed.push(filePath);
    }
  }

  checkAnalyticsInstrumentation(filePath, content, issues, warnings) {
    const patterns = [
      /analytics\.track/gi,
      /telemetry\.log/gi,
      /metrics\.record/gi,
      /trackEvent/gi,
      /\.track\(/gi
    ];
    
    let hasAnalytics = false;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        hasAnalytics = true;
        this.instrumentation.analytics++;
        break;
      }
    }
    
    if (hasAnalytics) {
      this.passed.push(filePath);
    }
  }

  checkPerformanceMonitoring(filePath, content, issues, warnings) {
    const patterns = [
      /performance\.mark/gi,
      /performance\.measure/gi,
      /timer\.start/gi,
      /metrics\.timing/gi,
      /measure\(/gi
    ];
    
    let hasPerformanceMonitoring = false;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        hasPerformanceMonitoring = true;
        this.instrumentation.performance++;
        break;
      }
    }
  }

  checkErrorTracking(filePath, content, issues, warnings) {
    const patterns = [
      /logger\.error/gi,
      /logger\.warn/gi,
      /captureException/gi,
      /trackError/gi,
      /Sentry\.captureException/gi,
      /errorLogger/gi
    ];
    
    let hasErrorTracking = false;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        hasErrorTracking = true;
        this.instrumentation.logging++;
        break;
      }
    }
    
    const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch/gi.test(content);
    if (hasTryCatch && !hasErrorTracking) {
      warnings.push({
        type: 'missing-error-tracking',
        severity: 'warning',
        message: 'Try-catch blocks found but no error tracking/logging',
        recommendation: 'Add error logging to capture and analyze failures'
      });
    }
  }

  checkBusinessMetrics(filePath, content, issues, warnings) {
    const patterns = [
      /metrics\.increment/gi,
      /counter\.inc/gi,
      /gauge\.set/gi,
      /histogram\.observe/gi
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        this.instrumentation.metrics++;
        break;
      }
    }
  }

  checkMissingInstrumentation(filePath, content, issues, warnings) {
    const missingPatterns = this.rules.dataIntelligence?.missingDataPatterns || [];
    
    for (const patternRule of missingPatterns) {
      const regex = new RegExp(patternRule.pattern, 'gi');
      if (regex.test(content)) {
        const requiredPatterns = patternRule.requiredNearby || [];
        let hasRequired = false;
        
        for (const reqPattern of requiredPatterns) {
          if (new RegExp(reqPattern, 'gi').test(content)) {
            hasRequired = true;
            break;
          }
        }
        
        if (!hasRequired) {
          warnings.push({
            type: 'missing-instrumentation',
            severity: 'warning',
            message: patternRule.description,
            recommendation: `Add tracking: ${requiredPatterns.join(' or ')}`
          });
        }
      }
    }
  }

  calculateScore() {
    const totalFiles = this.passed.length + this.warnings.length + this.violations.length;
    if (totalFiles === 0) return 5;
    
    const totalInstrumentation = Object.values(this.instrumentation).reduce((a, b) => a + b, 0);
    const instrumentationRatio = totalInstrumentation / totalFiles;
    
    let score = 5;
    
    if (instrumentationRatio >= 0.5) score = 10;
    else if (instrumentationRatio >= 0.3) score = 8;
    else if (instrumentationRatio >= 0.2) score = 6;
    else if (instrumentationRatio >= 0.1) score = 4;
    else score = 2;
    
    const violationPenalty = (this.violations.length / totalFiles) * 3;
    score = Math.max(0, score - violationPenalty);
    
    return Math.round(score * 10) / 10;
  }

  generateReport() {
    console.log(`${BOLD}=== Data Intelligence Analysis Report ===${RESET}\n`);
    
    const score = this.calculateScore();
    const scoreColor = score >= 7 ? GREEN : score >= 5 ? YELLOW : RED;
    
    console.log(`${BOLD}Data Intelligence Score: ${scoreColor}${score}/10${RESET}\n`);
    
    console.log(`${BOLD}Instrumentation Coverage:${RESET}`);
    console.log(`  ${GREEN}Analytics tracking: ${this.instrumentation.analytics} files${RESET}`);
    console.log(`  ${GREEN}Performance monitoring: ${this.instrumentation.performance} files${RESET}`);
    console.log(`  ${GREEN}Error logging: ${this.instrumentation.logging} files${RESET}`);
    console.log(`  ${GREEN}Business metrics: ${this.instrumentation.metrics} files${RESET}\n`);
    
    console.log(`${GREEN}✓ Passed: ${this.passed.length} files${RESET}`);
    console.log(`${YELLOW}⚠ Warnings: ${this.warnings.length} files${RESET}`);
    console.log(`${RED}✗ Violations: ${this.violations.length} files${RESET}\n`);
    
    if (this.warnings.length > 0) {
      console.log(`${BOLD}${YELLOW}=== WARNINGS (Should Review) ===${RESET}\n`);
      
      const topWarnings = this.warnings.slice(0, 5);
      topWarnings.forEach(({ file, warnings }) => {
        console.log(`${YELLOW}${BOLD}${path.basename(file)}${RESET}`);
        
        warnings.slice(0, 2).forEach(warning => {
          console.log(`  ${YELLOW}⚠${RESET} ${warning.message}`);
          if (warning.recommendation) {
            console.log(`    ${BLUE}→ ${warning.recommendation}${RESET}`);
          }
        });
        console.log();
      });
    }
    
    this.printRecommendations();
  }

  printRecommendations() {
    console.log(`${BOLD}${BLUE}=== Data Intelligence Principles ===${RESET}\n`);
    console.log(`${BOLD}Does this generate valuable intelligence?${RESET}`);
    console.log(`  • Track user actions and behavior patterns`);
    console.log(`  • Monitor performance and bottlenecks`);
    console.log(`  • Log errors for analysis and debugging`);
    console.log(`  • Measure business metrics and KPIs`);
    console.log(`\n${BOLD}Will this help us understand users better?${RESET}`);
    console.log(`  • Add analytics to key user interactions`);
    console.log(`  • Track conversion funnels and drop-off points`);
    console.log(`  • Monitor feature usage and adoption`);
    console.log(`\n${BOLD}Can we measure its impact?${RESET}`);
    console.log(`  • Instrument all critical paths`);
    console.log(`  • Add performance timing for optimization`);
    console.log(`  • Track success/failure rates\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const rulesPath = args[0] || path.join(__dirname, '../.github/rockefeller-rules.json');
  const searchPaths = args.slice(1).length > 0 ? args.slice(1) : [
    path.join(__dirname, '../rpa-system/backend'),
    path.join(__dirname, '../scripts')
  ];
  
  if (!fs.existsSync(rulesPath)) {
    console.error(`${RED}Error: Rules file not found: ${rulesPath}${RESET}`);
    process.exit(1);
  }
  
  const analyzer = new DataIntelligenceAnalyzer(rulesPath, searchPaths);
  
  analyzer.analyze().then(result => {
    console.log(`${BOLD}Analysis complete:${RESET}`);
    console.log(`  Score: ${result.score}/10`);
    console.log(`  Instrumented files: ${Object.values(result.instrumentation).reduce((a, b) => a + b, 0)}`);
    console.log(`  Violations: ${result.violations}\n`);
    
    if (result.violations > 0) {
      console.log(`${RED}${BOLD}⚠ Code has data intelligence violations.${RESET}\n`);
    } else if (result.warnings > 0) {
      console.log(`${YELLOW}${BOLD}⚠ Consider adding more instrumentation.${RESET}\n`);
    } else {
      console.log(`${GREEN}${BOLD}✓ Good data intelligence coverage!${RESET}\n`);
    }
    
    process.exit(result.exitCode);
  });
}

if (require.main === module) {
  main();
}

module.exports = { DataIntelligenceAnalyzer };
