#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

class StrategyAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.violations = [];
    this.warnings = [];
    this.passed = [];
    this.strategicCount = 0;
    this.experimentalCount = 0;
  }

  async analyze() {
    console.log(`${BOLD}${BLUE}Analyzing codebase for Strategic Alignment (Rockefeller Filter #4)...${RESET}\n`);
    
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
      strategic: this.strategicCount,
      experimental: this.experimentalCount,
      exitCode: this.violations.length > 0 ? 1 : 0
    };
  }

  findCodeFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.md'];
    
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
    
    this.checkStrategicAlignment(filePath, content, issues, warnings);
    this.checkDistractions(filePath, content, issues, warnings);
    this.checkVisionAlignment(filePath, content, issues, warnings);
    this.checkPrioritySupport(filePath, content, issues, warnings);
    
    if (issues.length > 0) {
      this.violations.push({ file: filePath, issues });
    } else if (warnings.length > 0) {
      this.warnings.push({ file: filePath, warnings });
    } else {
      this.passed.push(filePath);
    }
  }

  checkStrategicAlignment(filePath, content, issues, warnings) {
    const vision = this.rules.strategicAlignment?.threeYearVision || [];
    
    for (const visionKeyword of vision) {
      const regex = new RegExp(visionKeyword, 'gi');
      if (regex.test(content)) {
        this.strategicCount++;
        return;
      }
    }
  }

  checkDistractions(filePath, content, issues, warnings) {
    const distractionPatterns = this.rules.strategicAlignment?.distractionPatterns || [];
    
    for (const pattern of distractionPatterns) {
      const regex = new RegExp(pattern.pattern, 'gi');
      if (regex.test(content)) {
        this.experimentalCount++;
        
        warnings.push({
          type: 'potential-distraction',
          severity: 'warning',
          message: pattern.description,
          recommendation: pattern.recommendation
        });
      }
    }
  }

  checkVisionAlignment(filePath, content, issues, warnings) {
    const priorities = this.rules.strategicAlignment?.currentPriorities || [];
    
    let hasAlignment = false;
    for (const priority of priorities) {
      const regex = new RegExp(priority, 'gi');
      if (regex.test(content)) {
        hasAlignment = true;
        break;
      }
    }
    
    if (!hasAlignment && filePath.includes('feature') && content.length > 500) {
      warnings.push({
        type: 'unclear-alignment',
        severity: 'warning',
        message: 'Feature code does not clearly reference strategic priorities',
        recommendation: 'Add comments linking to roadmap or priority documentation'
      });
    }
  }

  checkPrioritySupport(filePath, content, issues, warnings) {
    const experimentalMarkers = [
      /\bexperimental\b/gi,
      /\bprototype\b/gi,
      /\bpoc\b/gi,
      /\btemp\b/gi,
      /\btemporary\b/gi,
      /\bhack\b/gi,
      /\bquick.?fix\b/gi
    ];
    
    for (const marker of experimentalMarkers) {
      if (marker.test(content)) {
        warnings.push({
          type: 'experimental-code',
          severity: 'warning',
          message: 'Experimental or temporary code detected',
          recommendation: 'Ensure this supports strategic priorities or remove before production'
        });
        break;
      }
    }
  }

  calculateScore() {
    const totalFiles = this.passed.length + this.warnings.length + this.violations.length;
    if (totalFiles === 0) return 8;
    
    let score = 8;
    
    const strategicRatio = this.strategicCount / totalFiles;
    if (strategicRatio >= 0.5) score = 10;
    else if (strategicRatio >= 0.3) score = 9;
    else if (strategicRatio >= 0.2) score = 8;
    else if (strategicRatio >= 0.1) score = 7;
    else score = 6;
    
    if (this.experimentalCount > this.strategicCount * 0.3) {
      score -= 2;
    }
    
    const violationPenalty = (this.violations.length / totalFiles) * 2;
    score = Math.max(0, score - violationPenalty);
    
    return Math.round(score * 10) / 10;
  }

  generateReport() {
    console.log(`${BOLD}=== Strategic Alignment Analysis Report ===${RESET}\n`);
    
    const score = this.calculateScore();
    const scoreColor = score >= 7 ? GREEN : score >= 5 ? YELLOW : RED;
    
    console.log(`${BOLD}Strategic Fit Score: ${scoreColor}${score}/10${RESET}\n`);
    
    console.log(`${BOLD}Alignment Metrics:${RESET}`);
    console.log(`  ${GREEN}Strategic: ${this.strategicCount} files${RESET}`);
    console.log(`  ${YELLOW}Experimental: ${this.experimentalCount} files${RESET}\n`);
    
    console.log(`${GREEN}✓ Passed: ${this.passed.length} files${RESET}`);
    console.log(`${YELLOW}⚠ Warnings: ${this.warnings.length} files${RESET}`);
    console.log(`${RED}✗ Violations: ${this.violations.length} files${RESET}\n`);
    
    if (this.warnings.length > 0) {
      console.log(`${BOLD}${YELLOW}=== WARNINGS (Should Review) ===${RESET}\n`);
      
      const topWarnings = this.warnings.slice(0, 5);
      topWarnings.forEach(({ file, warnings }) => {
        console.log(`${YELLOW}${BOLD}${path.basename(file)}${RESET}`);
        
        warnings.forEach(warning => {
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
    console.log(`${BOLD}${BLUE}=== Strategic Alignment Principles ===${RESET}\n`);
    console.log(`${BOLD}Does this support our 3-year vision?${RESET}`);
    console.log(`  • Ubiquitous automation`);
    console.log(`  • Reduce context switching`);
    console.log(`  • Integration marketplace`);
    console.log(`  • AI-powered workflows`);
    console.log(`\n${BOLD}Is this a distraction from the #1 priority?${RESET}`);
    console.log(`  • Ship production-ready features`);
    console.log(`  • Deliver immediate user value`);
    console.log(`  • Build integration capabilities`);
    console.log(`\n${BOLD}Would we regret NOT doing this in 2 years?${RESET}`);
    console.log(`  • Focus on high-impact work`);
    console.log(`  • Align with roadmap priorities`);
    console.log(`  • Build foundations for scale\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const rulesPath = args[0] || path.join(__dirname, '../.github/rockefeller-rules.json');
  const searchPaths = args.slice(1).length > 0 ? args.slice(1) : [
    path.join(__dirname, '../rpa-system/backend'),
    path.join(__dirname, '../scripts'),
    path.join(__dirname, '../docs')
  ];
  
  if (!fs.existsSync(rulesPath)) {
    console.error(`${RED}Error: Rules file not found: ${rulesPath}${RESET}`);
    process.exit(1);
  }
  
  const analyzer = new StrategyAnalyzer(rulesPath, searchPaths);
  
  analyzer.analyze().then(result => {
    console.log(`${BOLD}Analysis complete:${RESET}`);
    console.log(`  Score: ${result.score}/10`);
    console.log(`  Strategic files: ${result.strategic}`);
    console.log(`  Experimental files: ${result.experimental}\n`);
    
    if (result.violations > 0) {
      console.log(`${RED}${BOLD}⚠ Code has strategic alignment violations.${RESET}\n`);
    } else if (result.warnings > 0) {
      console.log(`${YELLOW}${BOLD}⚠ Review strategic alignment.${RESET}\n`);
    } else {
      console.log(`${GREEN}${BOLD}✓ Good strategic alignment!${RESET}\n`);
    }
    
    process.exit(result.exitCode);
  });
}

if (require.main === module) {
  main();
}

module.exports = { StrategyAnalyzer };
