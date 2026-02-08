#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

class CultureAnalyzer {
  constructor(rulesPath, searchPaths) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.searchPaths = searchPaths;
    this.scores = { sovereignty: 0, simplicity: 0, transparent: 0, userFirst: 0, longTerm: 0 };
  }

  analyze() {
    const files = this.findFiles();
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Sovereignty
      if (/proprietary|in-house|custom|self-hosted/gi.test(content)) this.scores.sovereignty++;
      
      // Radical Simplicity
      if (/simplified|streamlined|one-click|automated|easy|simple/gi.test(content)) this.scores.simplicity++;
      if (/complex|complicated|workaround|hack|temporary-fix/gi.test(content)) this.scores.simplicity--;
      
      // Transparent Building
      if (/changelog|documentation|README|docs\//gi.test(content)) this.scores.transparent++;
      
      // User-First
      if (/user-facing|customer|solves.*pain|immediate.*value/gi.test(content)) this.scores.userFirst++;
      
      // Long-term
      if (/scalable|extensible|maintainable|future-proof/gi.test(content)) this.scores.longTerm++;
    });
    
    const totalFiles = files.length;
    const avgScore = Object.values(this.scores).reduce((a, b) => a + b, 0) / (totalFiles * 5);
    const score = Math.max(0, Math.min(10, avgScore * 10 + 5));
    
    console.log(`Culture Score: ${score.toFixed(1)}/10`);
    console.log(`  Sovereignty: ${this.scores.sovereignty}`);
    console.log(`  Simplicity: ${this.scores.simplicity}`);
    console.log(`  Transparent: ${this.scores.transparent}`);
    console.log(`  User-First: ${this.scores.userFirst}`);
    console.log(`  Long-term: ${this.scores.longTerm}\n`);
    
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
    path.join(__dirname, '../scripts')
  ];
  const analyzer = new CultureAnalyzer(rulesPath, searchPaths);
  const result = analyzer.analyze();
  process.exit(result.exitCode);
}

module.exports = { CultureAnalyzer };
