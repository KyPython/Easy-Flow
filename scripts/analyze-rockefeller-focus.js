#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

class FocusAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.focusedCount = 0;
    this.distractedCount = 0;
  }

  analyze() {
    const files = this.findFiles();
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Focus indicators
      const priorities = this.rules.strategicAlignment?.currentPriorities || [];
      priorities.forEach(priority => {
        if (new RegExp(priority, 'gi').test(content)) {
          this.focusedCount++;
        }
      });
      
      // Distraction indicators
      if (/side-project|quick-experiment|just-trying|random|unplanned/gi.test(content)) {
        this.distractedCount++;
      }
      
      // Check TODOs and priorities
      const todos = (content.match(/TODO|FIXME|HACK/gi) || []).length;
      if (todos > 10) this.distractedCount++;
    });
    
    let score = 8;
    
    if (this.distractedCount > this.focusedCount * 0.2) score -= 2;
    if (this.distractedCount > this.focusedCount) score -= 3;
    if (this.focusedCount === 0) score = 5;
    
    score = Math.max(0, Math.min(10, score));
    
    console.log(`Focus Score: ${score.toFixed(1)}/10`);
    console.log(`  Focused on priorities: ${this.focusedCount}`);
    console.log(`  Distractions detected: ${this.distractedCount}\n`);
    
    return { score: Math.round(score * 10) / 10, exitCode: 0 };
  }

  findFiles() {
    const files = [];
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir, { withFileTypes: true}).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          walkDir(fullPath);
        } else if (entry.isFile() && /\.(js|ts|jsx|tsx|md)$/.test(entry.name)) {
          files.push(fullPath);
        }
      });
    };
    this.searchPaths.forEach(walkDir);
    return files;
  }
}

if (require.main === module) {
  const rulesPath = process.argv[2] || path.join(__dirname, '../.github/rockefeller-rules.json');
  const searchPaths = process.argv.slice(3).length > 0 ? process.argv.slice(3) : [
    path.join(__dirname, '../rpa-system/backend'),
    path.join(__dirname, '../scripts')
  ];
  const analyzer = new FocusAnalyzer(rulesPath, searchPaths);
  const result = analyzer.analyze();
  process.exit(result.exitCode);
}

module.exports = { FocusAnalyzer };
