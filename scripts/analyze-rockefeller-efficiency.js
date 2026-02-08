#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

class EfficiencyAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.violations = [];
    this.warnings = [];
    this.passed = [];
  }

  async analyze() {
    console.log(`${BOLD}${BLUE}Analyzing codebase for Efficiency (Rockefeller Filter #1)...${RESET}\n`);
    
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
    
    this.checkComplexity(filePath, content, issues, warnings);
    this.checkRedundantCode(filePath, content, issues, warnings);
    this.checkUnnecessaryDependencies(filePath, content, issues, warnings);
    this.checkManualProcesses(filePath, content, issues, warnings);
    this.checkIneffientPatterns(filePath, content, issues, warnings);
    
    if (issues.length > 0) {
      this.violations.push({ file: filePath, issues });
    } else if (warnings.length > 0) {
      this.warnings.push({ file: filePath, warnings });
    } else {
      this.passed.push(filePath);
    }
  }

  checkComplexity(filePath, content, issues, warnings) {
    const lines = content.split('\n');
    const functions = this.extractFunctions(content);
    
    for (const func of functions) {
      const complexity = this.calculateCyclomaticComplexity(func.body);
      const lineCount = func.body.split('\n').length;
      
      if (complexity > this.rules.complexity.maxCyclomaticComplexity) {
        issues.push({
          type: 'complexity',
          severity: 'error',
          message: `Function '${func.name}' has complexity ${complexity} (max: ${this.rules.complexity.maxCyclomaticComplexity})`,
          line: func.line,
          recommendation: 'Break down into smaller, focused functions. High complexity suggests multiple responsibilities.'
        });
      } else if (complexity > this.rules.complexity.warnCyclomaticComplexity) {
        warnings.push({
          type: 'complexity',
          severity: 'warning',
          message: `Function '${func.name}' has complexity ${complexity} (warning: ${this.rules.complexity.warnCyclomaticComplexity})`,
          line: func.line,
          recommendation: 'Consider refactoring for better maintainability'
        });
      }
      
      if (lineCount > this.rules.complexity.maxFunctionLines) {
        issues.push({
          type: 'function-length',
          severity: 'error',
          message: `Function '${func.name}' has ${lineCount} lines (max: ${this.rules.complexity.maxFunctionLines})`,
          line: func.line,
          recommendation: 'Long functions are hard to understand and test. Extract logical sections into helper functions.'
        });
      }
    }
  }

  checkRedundantCode(filePath, content, issues, warnings) {
    const duplicatePatterns = this.findDuplicateCodeBlocks(content);
    
    if (duplicatePatterns.length > 0) {
      warnings.push({
        type: 'code-duplication',
        severity: 'warning',
        message: `Found ${duplicatePatterns.length} potential code duplications`,
        recommendation: 'Extract common patterns into reusable functions. Duplication violates efficiency principle.',
        patterns: duplicatePatterns.slice(0, 3)
      });
    }
  }

  checkUnnecessaryDependencies(filePath, content, issues, warnings) {
    const imports = this.extractImports(content);
    const usedIdentifiers = this.extractUsedIdentifiers(content);
    
    for (const imp of imports) {
      if (imp.identifiers) {
        const unusedImports = imp.identifiers.filter(id => 
          !usedIdentifiers.has(id) && !id.startsWith('type ')
        );
        
        if (unusedImports.length > 0) {
          warnings.push({
            type: 'unused-imports',
            severity: 'warning',
            message: `Unused imports detected: ${unusedImports.join(', ')}`,
            recommendation: 'Remove unused imports to reduce bundle size and improve clarity'
          });
        }
      }
    }
  }

  checkManualProcesses(filePath, content, issues, warnings) {
    const manualPatterns = this.rules.inefficientPatterns.manualProcesses;
    
    for (const pattern of manualPatterns) {
      const regex = new RegExp(pattern.pattern, 'gi');
      const matches = content.match(regex);
      
      if (matches && matches.length > 0) {
        warnings.push({
          type: 'manual-process',
          severity: 'warning',
          message: pattern.description,
          occurrences: matches.length,
          recommendation: pattern.recommendation
        });
      }
    }
  }

  checkIneffientPatterns(filePath, content, issues, warnings) {
    const patterns = this.rules.inefficientPatterns.codePatterns;
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.pattern, 'g');
      let match;
      let lineNum = 1;
      
      for (const line of content.split('\n')) {
        if (regex.test(line)) {
          const severity = pattern.severity || 'warning';
          const target = severity === 'error' ? issues : warnings;
          
          target.push({
            type: 'inefficient-pattern',
            severity,
            message: pattern.description,
            line: lineNum,
            recommendation: pattern.recommendation
          });
        }
        lineNum++;
      }
    }
  }

  extractFunctions(content) {
    const functions = [];
    
    const functionPatterns = [
      /function\s+(\w+)\s*\([^)]*\)\s*\{/g,
      /(\w+)\s*[:=]\s*function\s*\([^)]*\)\s*\{/g,
      /(\w+)\s*[:=]\s*\([^)]*\)\s*=>\s*\{/g,
      /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
      /def\s+(\w+)\s*\([^)]*\):/g,
    ];
    
    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1] || match[0];
        const startPos = match.index;
        const beforeMatch = content.substring(0, startPos);
        const line = beforeMatch.split('\n').length;
        
        const body = this.extractFunctionBody(content, startPos);
        
        functions.push({
          name,
          line,
          body
        });
      }
    }
    
    return functions;
  }

  extractFunctionBody(content, startPos) {
    let braceCount = 0;
    let inBody = false;
    let body = '';
    
    for (let i = startPos; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inBody = true;
      } else if (char === '}') {
        braceCount--;
      }
      
      if (inBody) {
        body += char;
      }
      
      if (inBody && braceCount === 0) {
        break;
      }
    }
    
    return body || content.substring(startPos, Math.min(startPos + 500, content.length));
  }

  calculateCyclomaticComplexity(code) {
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
    ];
    
    let complexity = 1;
    
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  findDuplicateCodeBlocks(content) {
    const blocks = [];
    const lines = content.split('\n');
    const minBlockSize = 5;
    
    for (let i = 0; i < lines.length - minBlockSize; i++) {
      const block = lines.slice(i, i + minBlockSize).join('\n').trim();
      
      if (block.length < 50) continue;
      if (/^\/\/|^\/\*|^\*/.test(block)) continue;
      
      const occurrences = this.countOccurrences(content, block);
      
      if (occurrences > 1) {
        blocks.push({
          lines: `${i + 1}-${i + minBlockSize}`,
          occurrences,
          preview: block.substring(0, 60) + '...'
        });
      }
    }
    
    return blocks.slice(0, 5);
  }

  countOccurrences(haystack, needle) {
    let count = 0;
    let pos = 0;
    
    while ((pos = haystack.indexOf(needle, pos)) !== -1) {
      count++;
      pos += needle.length;
    }
    
    return count;
  }

  extractImports(content) {
    const imports = [];
    
    const importPatterns = [
      /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      /const\s+{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\)/g,
      /from\s+(\w+)\s+import\s+([^;\n]+)/g,
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push({
          module: match[2] || match[1],
          identifiers: match[1] ? match[1].split(',').map(s => s.trim()) : null
        });
      }
    }
    
    return imports;
  }

  extractUsedIdentifiers(content) {
    const identifiers = new Set();
    const identifierPattern = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
    let match;
    
    while ((match = identifierPattern.exec(content)) !== null) {
      identifiers.add(match[0]);
    }
    
    return identifiers;
  }

  calculateScore() {
    const totalFiles = this.passed.length + this.warnings.length + this.violations.length;
    if (totalFiles === 0) return 10;
    
    const passedRatio = this.passed.length / totalFiles;
    const warningPenalty = (this.warnings.length / totalFiles) * 3;
    const violationPenalty = (this.violations.length / totalFiles) * 7;
    
    const score = Math.max(0, Math.min(10, passedRatio * 10 - warningPenalty - violationPenalty));
    
    return Math.round(score * 10) / 10;
  }

  generateReport() {
    console.log(`${BOLD}=== Efficiency Analysis Report ===${RESET}\n`);
    
    const score = this.calculateScore();
    const scoreColor = score >= 7 ? GREEN : score >= 5 ? YELLOW : RED;
    
    console.log(`${BOLD}Efficiency Score: ${scoreColor}${score}/10${RESET}\n`);
    console.log(`${GREEN}✓ Passed: ${this.passed.length} files${RESET}`);
    console.log(`${YELLOW}⚠ Warnings: ${this.warnings.length} files${RESET}`);
    console.log(`${RED}✗ Violations: ${this.violations.length} files${RESET}\n`);
    
    if (this.violations.length > 0) {
      console.log(`${BOLD}${RED}=== VIOLATIONS (Must Fix) ===${RESET}\n`);
      
      const topViolations = this.violations.slice(0, 10);
      topViolations.forEach(({ file, issues }) => {
        console.log(`${RED}${BOLD}${path.basename(file)}${RESET}`);
        console.log(`  ${BLUE}${file}${RESET}`);
        
        issues.slice(0, 3).forEach(issue => {
          console.log(`  ${RED}✗${RESET} ${issue.message}`);
          if (issue.line) {
            console.log(`    Line: ${issue.line}`);
          }
          if (issue.recommendation) {
            console.log(`    ${BLUE}→ ${issue.recommendation}${RESET}`);
          }
        });
        
        if (issues.length > 3) {
          console.log(`  ${YELLOW}... and ${issues.length - 3} more issues${RESET}`);
        }
        console.log();
      });
      
      if (this.violations.length > 10) {
        console.log(`${YELLOW}... and ${this.violations.length - 10} more files with violations${RESET}\n`);
      }
    }
    
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
      
      if (this.warnings.length > 5) {
        console.log(`${YELLOW}... and ${this.warnings.length - 5} more files with warnings${RESET}\n`);
      }
    }
    
    this.printRecommendations();
  }

  printRecommendations() {
    console.log(`${BOLD}${BLUE}=== Efficiency Principles ===${RESET}\n`);
    console.log(`${BOLD}Does this reduce steps in our process?${RESET}`);
    console.log(`  • Eliminate redundant code and manual processes`);
    console.log(`  • Simplify complex functions into clear, focused units`);
    console.log(`  • Remove unused dependencies and imports`);
    console.log(`\n${BOLD}Does this save time for users or our team?${RESET}`);
    console.log(`  • Optimize hot paths and frequent operations`);
    console.log(`  • Automate repetitive tasks`);
    console.log(`  • Use efficient algorithms and data structures`);
    console.log(`\n${BOLD}What's the cost-to-value ratio?${RESET}`);
    console.log(`  • Measure impact of changes`);
    console.log(`  • Prioritize high-value, low-effort improvements`);
    console.log(`  • Avoid premature optimization without data\n`);
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
  
  const analyzer = new EfficiencyAnalyzer(rulesPath, searchPaths);
  
  analyzer.analyze().then(result => {
    console.log(`${BOLD}Analysis complete:${RESET}`);
    console.log(`  Score: ${result.score}/10`);
    console.log(`  Passed: ${result.passed}`);
    console.log(`  Warnings: ${result.warnings}`);
    console.log(`  Violations: ${result.violations}\n`);
    
    if (result.violations > 0) {
      console.log(`${RED}${BOLD}⚠ Code has efficiency violations. Review and fix for Rockefeller compliance.${RESET}\n`);
    } else if (result.warnings > 0) {
      console.log(`${YELLOW}${BOLD}⚠ Code has efficiency warnings. Consider improvements.${RESET}\n`);
    } else {
      console.log(`${GREEN}${BOLD}✓ Code follows efficiency principles!${RESET}\n`);
    }
    
    process.exit(result.exitCode);
  });
}

if (require.main === module) {
  main();
}

module.exports = { EfficiencyAnalyzer };
