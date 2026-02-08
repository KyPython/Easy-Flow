#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AUDIT_DIR = path.join(__dirname, '../.rockefeller-audits');
const AUDIT_FILE = path.join(AUDIT_DIR, 'compliance-history.jsonl');

class QuarterlyAuditTracker {
  constructor() {
    this.ensureAuditDirectory();
  }

  ensureAuditDirectory() {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
  }

  async runAudit() {
    console.log('🔍 Running Rockefeller Compliance Audit...\n');
    
    const timestamp = new Date().toISOString();
    const gitInfo = await this.getGitInfo();
    
    // Run the master compliance analyzer
    const results = await this.runCompliance();
    
    const auditRecord = {
      timestamp,
      quarter: this.getCurrentQuarter(),
      git: gitInfo,
      scores: results.scores,
      totalScore: results.totalScore,
      grade: this.getGrade(results.totalScore),
      ...results.metadata
    };
    
    this.saveAuditRecord(auditRecord);
    this.generateAuditReport(auditRecord);
    
    return auditRecord;
  }

  async getGitInfo() {
    try {
      const branch = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      const commit = await this.execGit(['rev-parse', 'HEAD']);
      const commitMsg = await this.execGit(['log', '-1', '--pretty=%B']);
      
      return {
        branch: branch.trim(),
        commit: commit.trim().substring(0, 7),
        message: commitMsg.trim().split('\n')[0]
      };
    } catch (error) {
      return { branch: 'unknown', commit: 'unknown', message: 'unknown' };
    }
  }

  execGit(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd: path.join(__dirname, '..') });
      let output = '';
      
      proc.stdout.on('data', (data) => output += data);
      proc.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error('Git command failed'));
      });
    });
  }

  async runCompliance() {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, 'analyze-rockefeller-compliance.js');
      const rulesPath = path.join(__dirname, '../.github/rockefeller-rules.json');
      const searchPaths = [
        path.join(__dirname, '../rpa-system/backend'),
        path.join(__dirname, '../scripts')
      ];
      
      const proc = spawn('node', [scriptPath, rulesPath, ...searchPaths]);
      let output = '';
      
      proc.stdout.on('data', (data) => output += data);
      proc.stderr.on('data', (data) => output += data);
      
      proc.on('close', () => {
        const scores = this.extractScores(output);
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
        
        resolve({
          scores,
          totalScore,
          metadata: {
            filesAnalyzed: this.countFiles(searchPaths),
            duration: 'N/A'
          }
        });
      });
    });
  }

  extractScores(output) {
    const scores = {};
    
    // Strip ANSI color codes for easier parsing
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    const filterMappings = {
      efficiency: '1\\. Efficiency Test',
      control: '2\\. Control Test',
      data: '3\\. Data Test',
      strategy: '4\\. Strategic Fit Test',
      culture: '5\\. Culture Test',
      innovation: '6\\. Innovation Test',
      focus: '7\\. Focus Test'
    };
    
    Object.entries(filterMappings).forEach(([filter, pattern]) => {
      const regex = new RegExp(`${pattern}[\\s\\S]*?Score:\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const match = cleanOutput.match(regex);
      scores[filter] = match ? parseFloat(match[1]) : 5;
    });
    
    return scores;
  }

  countFiles(searchPaths) {
    let count = 0;
    
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          walkDir(fullPath);
        } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
          count++;
        }
      });
    };
    
    searchPaths.forEach(walkDir);
    return count;
  }

  getCurrentQuarter() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }

  getGrade(totalScore) {
    if (totalScore >= 60) return 'A';
    if (totalScore >= 45) return 'B';
    if (totalScore >= 30) return 'C';
    return 'F';
  }

  saveAuditRecord(record) {
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(AUDIT_FILE, line);
    console.log(`✅ Audit record saved to: ${AUDIT_FILE}\n`);
  }

  generateAuditReport(record) {
    console.log('═══════════════════════════════════════════');
    console.log('       QUARTERLY AUDIT REPORT');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`Quarter: ${record.quarter}`);
    console.log(`Date: ${new Date(record.timestamp).toLocaleString()}`);
    console.log(`Branch: ${record.git.branch}`);
    console.log(`Commit: ${record.git.commit}\n`);
    
    console.log(`Total Score: ${record.totalScore}/70 (Grade: ${record.grade})`);
    console.log(`Files Analyzed: ${record.filesAnalyzed}\n`);
    
    console.log('7-Filter Breakdown:');
    Object.entries(record.scores).forEach(([filter, score]) => {
      const status = score >= 8 ? '✅' : score >= 6 ? '⚠️' : '❌';
      console.log(`  ${status} ${filter}: ${score}/10`);
    });
    
    console.log('\n═══════════════════════════════════════════\n');
    
    this.showTrend();
  }

  showTrend() {
    if (!fs.existsSync(AUDIT_FILE)) return;
    
    const records = fs.readFileSync(AUDIT_FILE, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-5); // Last 5 audits
    
    if (records.length < 2) {
      console.log('📊 Not enough data for trend analysis yet\n');
      return;
    }
    
    console.log('📊 Compliance Trend (Last 5 Audits):\n');
    
    records.forEach(record => {
      const bar = '█'.repeat(Math.round(record.totalScore / 2));
      console.log(`${record.quarter}: ${bar} ${record.totalScore}/70`);
    });
    
    const first = records[0].totalScore;
    const last = records[records.length - 1].totalScore;
    const trend = last - first;
    
    console.log();
    if (trend > 0) {
      console.log(`📈 Trend: +${trend} points (Improving!)`);
    } else if (trend < 0) {
      console.log(`📉 Trend: ${trend} points (Declining)`);
    } else {
      console.log(`➡️ Trend: Stable`);
    }
    console.log();
  }

  async generateQuarterlyReport() {
    if (!fs.existsSync(AUDIT_FILE)) {
      console.log('No audit history found. Run an audit first.\n');
      return;
    }
    
    const records = fs.readFileSync(AUDIT_FILE, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    const currentQuarter = this.getCurrentQuarter();
    const quarterRecords = records.filter(r => r.quarter === currentQuarter);
    
    if (quarterRecords.length === 0) {
      console.log(`No audits for ${currentQuarter} yet.\n`);
      return;
    }
    
    console.log(`\n📊 QUARTERLY REPORT: ${currentQuarter}\n`);
    console.log(`Total Audits: ${quarterRecords.length}`);
    
    const avgScore = quarterRecords.reduce((sum, r) => sum + r.totalScore, 0) / quarterRecords.length;
    console.log(`Average Score: ${avgScore.toFixed(1)}/70`);
    
    const bestScore = Math.max(...quarterRecords.map(r => r.totalScore));
    const worstScore = Math.min(...quarterRecords.map(r => r.totalScore));
    
    console.log(`Best Score: ${bestScore}/70`);
    console.log(`Worst Score: ${worstScore}/70`);
    
    console.log('\nFilter Averages:');
    const filters = Object.keys(quarterRecords[0].scores);
    filters.forEach(filter => {
      const avg = quarterRecords.reduce((sum, r) => sum + r.scores[filter], 0) / quarterRecords.length;
      console.log(`  ${filter}: ${avg.toFixed(1)}/10`);
    });
    
    console.log();
  }
}

function main() {
  const command = process.argv[2] || 'run';
  const tracker = new QuarterlyAuditTracker();
  
  if (command === 'run' || command === 'audit') {
    tracker.runAudit();
  } else if (command === 'report') {
    tracker.generateQuarterlyReport();
  } else if (command === 'trend') {
    tracker.showTrend();
  } else {
    console.log('Usage:');
    console.log('  node quarterly-audit.js run      # Run compliance audit');
    console.log('  node quarterly-audit.js report   # Generate quarterly report');
    console.log('  node quarterly-audit.js trend    # Show trend analysis');
  }
}

if (require.main === module) {
  main();
}

module.exports = { QuarterlyAuditTracker };
