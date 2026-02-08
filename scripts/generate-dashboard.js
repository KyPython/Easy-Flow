#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '../.rockefeller-audits/compliance-history.jsonl');
const OUTPUT_FILE = path.join(__dirname, '../.rockefeller-audits/dashboard.html');

class ComplianceDashboard {
  constructor() {
    this.records = this.loadAuditHistory();
  }

  loadAuditHistory() {
    if (!fs.existsSync(AUDIT_FILE)) {
      console.log('No audit history found. Run quarterly-audit.js first.\n');
      return [];
    }
    
    return fs.readFileSync(AUDIT_FILE, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  generateDashboard() {
    if (this.records.length === 0) {
      console.log('No data to visualize. Run audits first.\n');
      return;
    }
    
    const html = this.buildHTML();
    fs.writeFileSync(OUTPUT_FILE, html);
    
    console.log(`✅ Dashboard generated: ${OUTPUT_FILE}`);
    console.log(`   Open in browser to view compliance trends\n`);
  }

  buildHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rockefeller Compliance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0e27;
            color: #e4e4e7;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #a1a1aa;
            margin-bottom: 40px;
            font-size: 1.1rem;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 24px;
        }
        .stat-label {
            color: #a1a1aa;
            font-size: 0.875rem;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
        }
        .stat-value.green { color: #22c55e; }
        .stat-value.yellow { color: #eab308; }
        .stat-value.red { color: #ef4444; }
        .charts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .chart-card {
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 24px;
        }
        .chart-title {
            font-size: 1.25rem;
            margin-bottom: 20px;
            color: #e4e4e7;
        }
        table {
            width: 100%;
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 12px;
            overflow: hidden;
        }
        th, td {
            padding: 16px;
            text-align: left;
            border-bottom: 1px solid #27272a;
        }
        th {
            background: #27272a;
            font-weight: 600;
            color: #a1a1aa;
            font-size: 0.875rem;
            text-transform: uppercase;
        }
        td {
            color: #e4e4e7;
        }
        tr:last-child td {
            border-bottom: none;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .badge.green { background: #22c55e20; color: #22c55e; }
        .badge.yellow { background: #eab30820; color: #eab308; }
        .badge.red { background: #ef444420; color: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Rockefeller Compliance Dashboard</h1>
        <p class="subtitle">Operating System Performance Tracking</p>
        
        <div class="stats">
            ${this.generateStatsCards()}
        </div>
        
        <div class="charts">
            <div class="chart-card">
                <h2 class="chart-title">Compliance Trend</h2>
                <canvas id="trendChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h2 class="chart-title">7-Filter Breakdown (Latest)</h2>
                <canvas id="filtersChart"></canvas>
            </div>
        </div>
        
        <div class="chart-card">
            <h2 class="chart-title">Audit History</h2>
            ${this.generateHistoryTable()}
        </div>
    </div>

    <script>
        ${this.generateChartScripts()}
    </script>
</body>
</html>`;
  }

  generateStatsCards() {
    const latest = this.records[this.records.length - 1];
    const first = this.records[0];
    const trend = latest.totalScore - first.totalScore;
    const avgScore = this.records.reduce((sum, r) => sum + r.totalScore, 0) / this.records.length;
    
    const scoreClass = latest.totalScore >= 60 ? 'green' : latest.totalScore >= 45 ? 'yellow' : 'red';
    const trendClass = trend > 0 ? 'green' : trend < 0 ? 'red' : 'yellow';
    
    return `
      <div class="stat-card">
        <div class="stat-label">Current Score</div>
        <div class="stat-value ${scoreClass}">${latest.totalScore}/70</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Grade</div>
        <div class="stat-value ${scoreClass}">${latest.grade}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Trend</div>
        <div class="stat-value ${trendClass}">${trend > 0 ? '+' : ''}${trend}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Average (All Time)</div>
        <div class="stat-value">${avgScore.toFixed(1)}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Total Audits</div>
        <div class="stat-value">${this.records.length}</div>
      </div>
    `;
  }

  generateHistoryTable() {
    const rows = this.records.slice(-10).reverse().map(record => {
      const badgeClass = record.totalScore >= 60 ? 'green' : record.totalScore >= 45 ? 'yellow' : 'red';
      const date = new Date(record.timestamp).toLocaleDateString();
      
      return `
        <tr>
          <td>${record.quarter}</td>
          <td>${date}</td>
          <td><span class="badge ${badgeClass}">${record.totalScore}/70</span></td>
          <td><span class="badge ${badgeClass}">${record.grade}</span></td>
          <td>${record.git.commit}</td>
          <td>${record.git.branch}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <table>
        <thead>
          <tr>
            <th>Quarter</th>
            <th>Date</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Commit</th>
            <th>Branch</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  generateChartScripts() {
    const labels = this.records.map(r => r.quarter);
    const scores = this.records.map(r => r.totalScore);
    
    const latest = this.records[this.records.length - 1];
    const filterNames = Object.keys(latest.scores);
    const filterScores = filterNames.map(f => latest.scores[f]);
    
    return `
      // Trend Chart
      new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            label: 'Total Score',
            data: ${JSON.stringify(scores)},
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'Threshold (45)',
            data: Array(${labels.length}).fill(45),
            borderColor: '#eab308',
            borderDash: [5, 5],
            pointRadius: 0
          }, {
            label: 'Target (60)',
            data: Array(${labels.length}).fill(60),
            borderColor: '#22c55e',
            borderDash: [5, 5],
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, max: 70, ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } },
            x: { ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } }
          },
          plugins: {
            legend: { labels: { color: '#e4e4e7' } }
          }
        }
      });
      
      // Filters Chart
      new Chart(document.getElementById('filtersChart'), {
        type: 'radar',
        data: {
          labels: ${JSON.stringify(filterNames.map(f => f.charAt(0).toUpperCase() + f.slice(1)))},
          datasets: [{
            label: 'Current Scores',
            data: ${JSON.stringify(filterScores)},
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.2)',
            pointBackgroundColor: '#667eea'
          }]
        },
        options: {
          responsive: true,
          scales: {
            r: {
              beginAtZero: true,
              max: 10,
              ticks: { color: '#a1a1aa', backdropColor: 'transparent' },
              grid: { color: '#27272a' },
              angleLines: { color: '#27272a' },
              pointLabels: { color: '#e4e4e7' }
            }
          },
          plugins: {
            legend: { labels: { color: '#e4e4e7' } }
          }
        }
      });
    `;
  }
}

function main() {
  const dashboard = new ComplianceDashboard();
  dashboard.generateDashboard();
}

if (require.main === module) {
  main();
}

module.exports = { ComplianceDashboard };
