#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

class InnovationAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.innovativeCount = 0;
    this.copyingCount = 0;
  }

  analyze() {
    const files = this.findFiles();
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Innovation indicators
      if (/unique|innovative|novel|proprietary|differentiating|first-of|pioneering/gi.test(content)) {
        this.innovativeCount++;
      }
      
      // Copying indicators
      if (/based-on.*competitor|inspired-by|similar-to.*\w+|clone|fork-of/gi.test(content)) {
        this.copyingCount++;
      }
      
      // Check for unique features from rules
      const uniqueFeatures = this.rules.innovation?.competitiveAnalysis?.uniqueFeatures || [];
      uniqueFeatures.forEach(feature => {
        if (new RegExp(feature, 'gi').test(content)) {
          this.innovativeCount++;
        }
      });
    });
    
    const ratio = this.innovativeCount / (this.innovativeCount + this.copyingCount + 1);
    let score = 5 + (ratio * 5);
    
    if (this.copyingCount > this.innovativeCount) score -= 2;
    score = Math.max(0, Math.min(10, score));
    
    console.log(`Innovation Score: ${score.toFixed(1)}/10`);
    console.log(`  Innovative indicators: ${this.innovativeCount}`);
    console.log(`  Copying indicators: ${this.copyingCount}\n`);
    
    return { score: Math.round(score * 10) / 10, exitCode: 0 };
  }

  findFiles() {
    const files = [];
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
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
    path.join(__dirname, '../scripts'),
    path.join(__dirname, '../docs')
  ];
  const analyzer = new InnovationAnalyzer(rulesPath, searchPaths);
  const result = analyzer.analyze();
  process.exit(result.exitCode);
}

module.exports = { InnovationAnalyzer };
