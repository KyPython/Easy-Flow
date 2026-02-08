#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

class ControlAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.violations = [];
    this.warnings = [];
    this.passed = [];
    this.externalDependencies = new Map();
  }

  async analyze() {
    console.log(`${BOLD}${BLUE}Analyzing codebase for Control/Sovereignty (Rockefeller Filter #2)...${RESET}\n`);
    
    const files = this.findCodeFiles();
    
    for (const file of files) {
      await this.analyzeFile(file);
    }
    
    await this.analyzePackageDependencies();
    
    this.generateReport();
    
    return {
      passed: this.passed.length,
      warnings: this.warnings.length,
      violations: this.violations.length,
      score: this.calculateScore(),
      dependencies: Array.from(this.externalDependencies.entries()),
      exitCode: this.violations.length > 0 ? 1 : 0
    };
  }

  findCodeFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py'];
    
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || 
              entry.name === '__pycache__' || entry.name === 'dist') {
            continue;
          }
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
    
    this.checkThirdPartyDependencies(filePath, content, issues, warnings);
    this.checkExternalAPICalls(filePath, content, issues, warnings);
    this.checkVendorLockIn(filePath, content, issues, warnings);
    this.checkProprietaryCode(filePath, content, issues, warnings);
    
    if (issues.length > 0) {
      this.violations.push({ file: filePath, issues });
    } else if (warnings.length > 0) {
      this.warnings.push({ file: filePath, warnings });
    } else {
      this.passed.push(filePath);
    }
  }

  checkThirdPartyDependencies(filePath, content, issues, warnings) {
    const imports = this.extractImports(content);
    
    for (const imp of imports) {
      const module = imp.module;
      
      if (this.isThirdPartyModule(module)) {
        const riskLevel = this.assessDependencyRisk(module);
        
        if (!this.externalDependencies.has(module)) {
          this.externalDependencies.set(module, {
            files: [],
            riskLevel,
            category: this.categorizeDependency(module)
          });
        }
        
        this.externalDependencies.get(module).files.push(filePath);
        
        if (riskLevel === 'high') {
          issues.push({
            type: 'high-risk-dependency',
            severity: 'error',
            message: `High-risk third-party dependency: ${module}`,
            recommendation: 'Consider building in-house or finding a more stable alternative'
          });
        } else if (riskLevel === 'medium') {
          warnings.push({
            type: 'medium-risk-dependency',
            severity: 'warning',
            message: `Medium-risk third-party dependency: ${module}`,
            recommendation: 'Monitor for stability and consider alternatives'
          });
        }
      }
    }
  }

  checkExternalAPICalls(filePath, content, issues, warnings) {
    const apiPatterns = this.rules.control.externalAPIs;
    
    for (const pattern of apiPatterns) {
      const regex = new RegExp(pattern.pattern, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        const service = pattern.service;
        const canInternalize = pattern.canInternalize;
        
        if (canInternalize) {
          warnings.push({
            type: 'externalizable-api',
            severity: 'warning',
            message: `External API call to ${service} detected (${matches.length} occurrences)`,
            recommendation: pattern.recommendation || `Consider building this capability in-house to reduce dependency`
          });
        } else if (pattern.severity === 'error') {
          issues.push({
            type: 'external-api',
            severity: 'error',
            message: `Critical external dependency on ${service} detected`,
            recommendation: 'This creates vendor lock-in. Plan migration strategy.'
          });
        }
      }
    }
  }

  checkVendorLockIn(filePath, content, issues, warnings) {
    const vendors = this.rules.control.vendorLockInPatterns;
    
    for (const vendor of vendors) {
      const regex = new RegExp(vendor.pattern, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        const severity = vendor.severity || 'warning';
        const target = severity === 'error' ? issues : warnings;
        
        target.push({
          type: 'vendor-lock-in',
          severity,
          message: `Vendor lock-in risk detected: ${vendor.vendor} (${matches.length} references)`,
          recommendation: vendor.recommendation || 'Abstract vendor-specific code behind interfaces'
        });
      }
    }
  }

  checkProprietaryCode(filePath, content, issues, warnings) {
    const lines = content.split('\n');
    let proprietaryLines = 0;
    let totalLines = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0 || trimmed.startsWith('//') || 
          trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }
      
      totalLines++;
      
      if (!this.isThirdPartyCode(trimmed)) {
        proprietaryLines++;
      }
    }
    
    if (totalLines > 0) {
      const proprietaryRatio = proprietaryLines / totalLines;
      
      if (proprietaryRatio < this.rules.control.minProprietaryRatio) {
        warnings.push({
          type: 'low-proprietary-code',
          severity: 'warning',
          message: `Only ${Math.round(proprietaryRatio * 100)}% proprietary code (min: ${this.rules.control.minProprietaryRatio * 100}%)`,
          recommendation: 'Too much reliance on third-party code. Consider building more in-house.'
        });
      }
    }
  }

  async analyzePackageDependencies() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    for (const [dep, version] of Object.entries(dependencies)) {
      if (!this.externalDependencies.has(dep)) {
        const riskLevel = this.assessDependencyRisk(dep);
        this.externalDependencies.set(dep, {
          files: [],
          riskLevel,
          category: this.categorizeDependency(dep),
          version
        });
      }
    }
  }

  extractImports(content) {
    const imports = [];
    
    const importPatterns = [
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
      /from\s+(\w+)\s+import/g,
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push({
          module: match[1]
        });
      }
    }
    
    return imports;
  }

  isThirdPartyModule(module) {
    if (!module) return false;
    
    if (module.startsWith('.') || module.startsWith('/')) {
      return false;
    }
    
    if (module.startsWith('@/') || module === 'fs' || module === 'path' || 
        module === 'http' || module === 'https' || module === 'crypto') {
      return false;
    }
    
    return true;
  }

  isThirdPartyCode(line) {
    const thirdPartyIndicators = [
      /import.*from ['"](?!\.|\/)/, 
      /require\(['"](?!\.|\/)/, 
      /@external/,
      /@vendor/
    ];
    
    return thirdPartyIndicators.some(pattern => pattern.test(line));
  }

  assessDependencyRisk(module) {
    const highRiskPatterns = this.rules.control.highRiskDependencies || [];
    const mediumRiskPatterns = this.rules.control.mediumRiskDependencies || [];
    
    for (const pattern of highRiskPatterns) {
      if (module.includes(pattern) || new RegExp(pattern).test(module)) {
        return 'high';
      }
    }
    
    for (const pattern of mediumRiskPatterns) {
      if (module.includes(pattern) || new RegExp(pattern).test(module)) {
        return 'medium';
      }
    }
    
    return 'low';
  }

  categorizeDependency(module) {
    const categories = {
      'payment': ['stripe', 'paypal', 'square'],
      'auth': ['auth0', 'okta', 'firebase-auth'],
      'database': ['mongodb', 'mysql', 'postgres'],
      'cloud': ['aws-sdk', 'azure', 'google-cloud'],
      'analytics': ['analytics', 'mixpanel', 'segment'],
      'communication': ['sendgrid', 'twilio', 'mailgun'],
      'utility': []
    };
    
    for (const [category, patterns] of Object.entries(categories)) {
      for (const pattern of patterns) {
        if (module.includes(pattern)) {
          return category;
        }
      }
    }
    
    return 'utility';
  }

  calculateScore() {
    let score = 10;
    
    const highRiskCount = Array.from(this.externalDependencies.values())
      .filter(dep => dep.riskLevel === 'high').length;
    const mediumRiskCount = Array.from(this.externalDependencies.values())
      .filter(dep => dep.riskLevel === 'medium').length;
    
    score -= highRiskCount * 2;
    score -= mediumRiskCount * 0.5;
    score -= this.violations.length * 1.5;
    score -= this.warnings.length * 0.3;
    
    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }

  generateReport() {
    console.log(`${BOLD}=== Control/Sovereignty Analysis Report ===${RESET}\n`);
    
    const score = this.calculateScore();
    const scoreColor = score >= 7 ? GREEN : score >= 5 ? YELLOW : RED;
    
    console.log(`${BOLD}Control Score: ${scoreColor}${score}/10${RESET}\n`);
    console.log(`${GREEN}✓ Passed: ${this.passed.length} files${RESET}`);
    console.log(`${YELLOW}⚠ Warnings: ${this.warnings.length} files${RESET}`);
    console.log(`${RED}✗ Violations: ${this.violations.length} files${RESET}\n`);
    
    console.log(`${BOLD}=== External Dependencies Summary ===${RESET}\n`);
    
    const byCategory = new Map();
    for (const [module, info] of this.externalDependencies.entries()) {
      if (!byCategory.has(info.category)) {
        byCategory.set(info.category, []);
      }
      byCategory.get(info.category).push({ module, ...info });
    }
    
    for (const [category, deps] of byCategory.entries()) {
      console.log(`${BOLD}${category.toUpperCase()}:${RESET}`);
      
      deps.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
      
      deps.slice(0, 5).forEach(dep => {
        const riskColor = dep.riskLevel === 'high' ? RED : 
                          dep.riskLevel === 'medium' ? YELLOW : GREEN;
        console.log(`  ${riskColor}●${RESET} ${dep.module} (${dep.riskLevel} risk, ${dep.files.length} files)`);
      });
      
      if (deps.length > 5) {
        console.log(`  ${YELLOW}... and ${deps.length - 5} more${RESET}`);
      }
      console.log();
    }
    
    if (this.violations.length > 0) {
      console.log(`${BOLD}${RED}=== VIOLATIONS (Must Fix) ===${RESET}\n`);
      
      const topViolations = this.violations.slice(0, 5);
      topViolations.forEach(({ file, issues }) => {
        console.log(`${RED}${BOLD}${path.basename(file)}${RESET}`);
        
        issues.forEach(issue => {
          console.log(`  ${RED}✗${RESET} ${issue.message}`);
          if (issue.recommendation) {
            console.log(`    ${BLUE}→ ${issue.recommendation}${RESET}`);
          }
        });
        console.log();
      });
    }
    
    this.printRecommendations();
  }

  printRecommendations() {
    console.log(`${BOLD}${BLUE}=== Control/Sovereignty Principles ===${RESET}\n`);
    console.log(`${BOLD}Does this reduce reliance on third parties?${RESET}`);
    console.log(`  • Build core capabilities in-house`);
    console.log(`  • Own your data and infrastructure`);
    console.log(`  • Abstract vendor-specific code`);
    console.log(`\n${BOLD}Does this give us proprietary advantage?${RESET}`);
    console.log(`  • Create unique, differentiating features`);
    console.log(`  • Build intellectual property`);
    console.log(`  • Control the full stack`);
    console.log(`\n${BOLD}Could this supplier become a vulnerability?${RESET}`);
    console.log(`  • Assess vendor stability and lock-in risk`);
    console.log(`  • Have fallback plans for critical dependencies`);
    console.log(`  • Monitor for changes in terms or pricing\n`);
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
  
  const analyzer = new ControlAnalyzer(rulesPath, searchPaths);
  
  analyzer.analyze().then(result => {
    console.log(`${BOLD}Analysis complete:${RESET}`);
    console.log(`  Score: ${result.score}/10`);
    console.log(`  Total Dependencies: ${result.dependencies.length}`);
    console.log(`  Violations: ${result.violations}\n`);
    
    if (result.violations > 0) {
      console.log(`${RED}${BOLD}⚠ Code has control/sovereignty violations.${RESET}\n`);
    } else if (result.warnings > 0) {
      console.log(`${YELLOW}${BOLD}⚠ Consider reducing third-party dependencies.${RESET}\n`);
    } else {
      console.log(`${GREEN}${BOLD}✓ Good control and ownership!${RESET}\n`);
    }
    
    process.exit(result.exitCode);
  });
}

if (require.main === module) {
  main();
}

module.exports = { ControlAnalyzer };
