#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

class RockefellerMasterAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rulesPath = rulesPath;
    this.searchPaths = searchPaths;
    this.results = {};
  }

  async analyze() {
    console.log(`${BOLD}${CYAN}╔════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${BOLD}${CYAN}║   ROCKEFELLER 7-FILTER COMPLIANCE ANALYSIS        ║${RESET}`);
    console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════════════╝${RESET}\n`);
    
    const filters = [
      { name: 'efficiency', display: '1. Ruthless Efficiency' },
      { name: 'control', display: '2. Control & Sovereignty' },
      { name: 'data', display: '3. Data Intelligence' },
      { name: 'strategy', display: '4. Strategic Fit' },
      { name: 'culture', display: '5. Culture Alignment' },
      { name: 'innovation', display: '6. Innovation Test' },
      { name: 'focus', display: '7. Focus Test' }
    ];
    
    for (const filter of filters) {
      console.log(`${BOLD}${BLUE}Running Filter: ${filter.display}${RESET}`);
      const score = await this.runAnalyzer(filter.name);
      this.results[filter.name] = score;
      
      const scoreColor = score >= 8 ? GREEN : score >= 6 ? YELLOW : RED;
      const status = score >= 8 ? '✅ Excellent' : score >= 6 ? '⚠️ Good' : '❌ Needs Work';
      console.log(`  Score: ${scoreColor}${score}/10${RESET} - ${status}\n`);
    }
    
    this.generateFinalReport();
    
    const totalScore = Object.values(this.results).reduce((a, b) => a + b, 0);
    const exitCode = totalScore >= 45 ? 0 : 1;
    
    return { results: this.results, totalScore, exitCode };
  }

  async runAnalyzer(filterName) {
    const scriptPath = path.join(__dirname, `analyze-rockefeller-${filterName}.js`);
    
    if (!fs.existsSync(scriptPath)) {
      console.log(`  ${YELLOW}⚠ Analyzer not found: ${scriptPath}${RESET}`);
      return 5;
    }
    
    return new Promise((resolve) => {
      const args = [scriptPath, this.rulesPath, ...this.searchPaths];
      const proc = spawn('node', args, { stdio: ['inherit', 'pipe', 'pipe'] });
      
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        console.error(data.toString());
      });
      
      proc.on('close', () => {
        const scoreMatch = output.match(/Score:\s*(\d+(?:\.\d+)?)/i);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
        resolve(score);
      });
    });
  }

  generateFinalReport() {
    console.log(`${BOLD}${CYAN}╔════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${BOLD}${CYAN}║           FINAL COMPLIANCE REPORT                  ║${RESET}`);
    console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════════════╝${RESET}\n`);
    
    const totalScore = Object.values(this.results).reduce((a, b) => a + b, 0);
    const percentage = Math.round((totalScore / 70) * 100);
    
    const barLength = 50;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;
    const barColor = percentage >= 86 ? GREEN : percentage >= 64 ? YELLOW : RED;
    
    console.log(`${BOLD}Overall Rockefeller Compliance${RESET}`);
    console.log(`\n  ${barColor}${'█'.repeat(filled)}${RESET}${'░'.repeat(empty)} ${percentage}%`);
    console.log(`\n  ${BOLD}Total Score: ${barColor}${totalScore}/70${RESET}\n`);
    
    console.log(`${BOLD}7-Filter Breakdown:${RESET}\n`);
    
    const filterNames = {
      efficiency: '1. Efficiency Test',
      control: '2. Control Test',
      data: '3. Data Test',
      strategy: '4. Strategic Fit Test',
      culture: '5. Culture Test',
      innovation: '6. Innovation Test',
      focus: '7. Focus Test'
    };
    
    for (const [filter, score] of Object.entries(this.results)) {
      const scoreColor = score >= 8 ? GREEN : score >= 6 ? YELLOW : RED;
      const emoji = score >= 8 ? '✅' : score >= 6 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${BOLD}${filterNames[filter]}${RESET}`);
      console.log(`     Score: ${scoreColor}${score}/10${RESET}`);
    }
    
    console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}\n`);
    
    const decision = this.getDecision(totalScore);
    const decisionColor = decision.includes('STRONG YES') ? GREEN :
                          decision.includes('CONDITIONAL') ? YELLOW : RED;
    
    console.log(`${BOLD}Decision: ${decisionColor}${decision}${RESET}\n`);
    console.log(`${BOLD}Recommendation:${RESET}`);
    console.log(`  ${this.getRecommendation(totalScore)}\n`);
    
    this.printActionItems();
  }

  getDecision(totalScore) {
    if (totalScore >= 60) return 'STRONG YES ✅ - Proceed immediately';
    if (totalScore >= 45) return 'CONDITIONAL YES ⚠️ - Address key concerns';
    if (totalScore >= 30) return 'WEAK ❌ - Rethink approach';
    return 'NO 🚫 - Does not align with principles';
  }

  getRecommendation(totalScore) {
    if (totalScore >= 60) {
      return 'Excellent alignment with Rockefeller principles. Ship with confidence!';
    } else if (totalScore >= 45) {
      return 'Good alignment with some areas for improvement. Review warnings and address key concerns.';
    } else if (totalScore >= 30) {
      return 'Moderate alignment. Significant improvements needed before proceeding.';
    } else {
      return 'Poor alignment. Major changes required to follow Rockefeller principles.';
    }
  }

  printActionItems() {
    console.log(`${BOLD}${BLUE}Priority Actions:${RESET}\n`);
    
    const lowScores = Object.entries(this.results)
      .filter(([_, score]) => score < 7)
      .sort((a, b) => a[1] - b[1]);
    
    if (lowScores.length === 0) {
      console.log(`  ${GREEN}✅ All filters meet standards!${RESET}`);
      console.log(`  ${BOLD}Continue following Rockefeller principles.${RESET}\n`);
      return;
    }
    
    lowScores.slice(0, 3).forEach(([filter, score], idx) => {
      console.log(`  ${idx + 1}. ${BOLD}Improve ${filter}${RESET} (score: ${score}/10)`);
      const actions = this.getFilterActions(filter);
      actions.forEach(action => {
        console.log(`     • ${action}`);
      });
      console.log();
    });
  }

  getFilterActions(filter) {
    const actions = {
      efficiency: [
        'Reduce function complexity (max 15 cyclomatic complexity)',
        'Eliminate code duplication',
        'Remove unused dependencies'
      ],
      control: [
        'Reduce high-risk third-party dependencies',
        'Abstract vendor-specific code',
        'Increase proprietary code ratio'
      ],
      data: [
        'Add analytics tracking to key actions',
        'Implement performance monitoring',
        'Add comprehensive error logging'
      ],
      strategy: [
        'Focus on roadmap-aligned features',
        'Remove experimental code',
        'Align with 3-year vision'
      ],
      culture: [
        'Simplify complex implementations',
        'Remove workarounds',
        'Follow radical simplicity'
      ],
      innovation: [
        'Build unique features',
        'Avoid copying competitors',
        'Create proprietary advantages'
      ],
      focus: [
        'Limit priorities',
        'Remove distractions',
        'Support #1 priority'
      ]
    };
    
    return actions[filter] || ['Review and improve this area'];
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
  
  const analyzer = new RockefellerMasterAnalyzer(rulesPath, searchPaths);
  
  analyzer.analyze().then(({ totalScore, exitCode }) => {
    if (totalScore >= 60) {
      console.log(`${GREEN}${BOLD}✅ Rockefeller compliance check PASSED${RESET}\n`);
    } else if (totalScore >= 45) {
      console.log(`${YELLOW}${BOLD}⚠️ Rockefeller compliance - address concerns${RESET}\n`);
    } else {
      console.log(`${RED}${BOLD}❌ Rockefeller compliance check FAILED${RESET}\n`);
    }
    
    process.exit(exitCode);
  }).catch(error => {
    console.error(`${RED}Error: ${error.message}${RESET}`);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { RockefellerMasterAnalyzer };
