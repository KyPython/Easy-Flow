// Performance monitoring and optimization script for file sharing system
const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      api: {},
      frontend: {},
      database: {}
    };
    this.observers = [];
    this.isMonitoring = false;
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🚀 Starting performance monitoring...');

    // Monitor API response times
    this.monitorAPIPerformance();
    
    // Monitor database queries
    this.monitorDatabasePerformance();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor frontend performance
    this.monitorFrontendPerformance();
  }

  stop() {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    console.log('🛑 Performance monitoring stopped');
  }

  monitorAPIPerformance() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('file-sharing-api')) {
          this.recordAPIMetric(entry);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.push(observer);
  }

  monitorDatabasePerformance() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('db-query')) {
          this.recordDatabaseMetric(entry);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.push(observer);
  }

  monitorMemoryUsage() {
    setInterval(() => {
      if (!this.isMonitoring) return;
      
      const memUsage = process.memoryUsage();
      this.metrics.memory = {
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      };
      
      // Alert if memory usage is high
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) {
        console.warn(`⚠️  High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }
    }, 5000);
  }

  monitorFrontendPerformance() {
    // This would be implemented in the browser context
    // For now, we'll create a placeholder that could be injected
    const frontendScript = `
      // Frontend performance monitoring script
      (function() {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name.includes('file-sharing')) {
              // Send metrics to backend
              fetch('/api/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'frontend',
                  name: entry.name,
                  duration: entry.duration,
                  timestamp: Date.now()
                })
              });
            }
          });
        });
        
        observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
        
        // Monitor React component render times
        if (window.React && window.React.Profiler) {
          // Would integrate with React DevTools Profiler
        }
      })();
    `;
    
    return frontendScript;
  }

  recordAPIMetric(entry) {
    const endpoint = entry.name.split('|')[1] || 'unknown';
    
    if (!this.metrics.api[endpoint]) {
      this.metrics.api[endpoint] = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: []
      };
    }

    const metric = this.metrics.api[endpoint];
    metric.count++;
    metric.totalDuration += entry.duration;
    metric.minDuration = Math.min(metric.minDuration, entry.duration);
    metric.maxDuration = Math.max(metric.maxDuration, entry.duration);
    metric.durations.push(entry.duration);

    // Keep only last 100 durations for percentile calculations
    if (metric.durations.length > 100) {
      metric.durations.shift();
    }

    // Alert on slow responses
    if (entry.duration > 1000) {
      console.warn(`🐌 Slow API response: ${endpoint} took ${entry.duration.toFixed(2)}ms`);
    }
  }

  recordDatabaseMetric(entry) {
    const queryType = entry.name.split('|')[1] || 'unknown';
    
    if (!this.metrics.database[queryType]) {
      this.metrics.database[queryType] = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: []
      };
    }

    const metric = this.metrics.database[queryType];
    metric.count++;
    metric.totalDuration += entry.duration;
    metric.minDuration = Math.min(metric.minDuration, entry.duration);
    metric.maxDuration = Math.max(metric.maxDuration, entry.duration);
    metric.durations.push(entry.duration);

    if (metric.durations.length > 100) {
      metric.durations.shift();
    }

    // Alert on slow queries
    if (entry.duration > 500) {
      console.warn(`🐌 Slow database query: ${queryType} took ${entry.duration.toFixed(2)}ms`);
    }
  }

  getMetrics() {
    const processedMetrics = {
      api: {},
      database: {},
      memory: this.metrics.memory,
      timestamp: Date.now()
    };

    // Process API metrics
    Object.keys(this.metrics.api).forEach(endpoint => {
      const metric = this.metrics.api[endpoint];
      processedMetrics.api[endpoint] = {
        count: metric.count,
        avgDuration: metric.totalDuration / metric.count,
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        p95Duration: this.calculatePercentile(metric.durations, 95),
        p99Duration: this.calculatePercentile(metric.durations, 99)
      };
    });

    // Process database metrics
    Object.keys(this.metrics.database).forEach(queryType => {
      const metric = this.metrics.database[queryType];
      processedMetrics.database[queryType] = {
        count: metric.count,
        avgDuration: metric.totalDuration / metric.count,
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        p95Duration: this.calculatePercentile(metric.durations, 95),
        p99Duration: this.calculatePercentile(metric.durations, 99)
      };
    });

    return processedMetrics;
  }

  calculatePercentile(durations, percentile) {
    if (durations.length === 0) return 0;
    
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  generateReport() {
    const metrics = this.getMetrics();
    const report = {
      summary: this.generateSummary(metrics),
      recommendations: this.generateRecommendations(metrics),
      detailed: metrics
    };

    return report;
  }

  generateSummary(metrics) {
    const summary = {
      apiEndpoints: Object.keys(metrics.api).length,
      dbQueries: Object.keys(metrics.database).length,
      totalAPIRequests: 0,
      totalDBQueries: 0,
      avgAPIResponse: 0,
      avgDBQuery: 0,
      memoryUsageMB: metrics.memory ? (metrics.memory.heapUsed / 1024 / 1024).toFixed(2) : 'N/A'
    };

    // Calculate totals and averages
    let totalAPITime = 0;
    Object.values(metrics.api).forEach(metric => {
      summary.totalAPIRequests += metric.count;
      totalAPITime += metric.avgDuration * metric.count;
    });

    let totalDBTime = 0;
    Object.values(metrics.database).forEach(metric => {
      summary.totalDBQueries += metric.count;
      totalDBTime += metric.avgDuration * metric.count;
    });

    summary.avgAPIResponse = summary.totalAPIRequests > 0 ? 
      (totalAPITime / summary.totalAPIRequests).toFixed(2) : 0;
    summary.avgDBQuery = summary.totalDBQueries > 0 ? 
      (totalDBTime / summary.totalDBQueries).toFixed(2) : 0;

    return summary;
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    // API performance recommendations
    Object.entries(metrics.api).forEach(([endpoint, metric]) => {
      if (metric.avgDuration > 500) {
        recommendations.push({
          type: 'api',
          severity: 'high',
          message: `API endpoint ${endpoint} has high average response time (${metric.avgDuration.toFixed(2)}ms)`,
          suggestion: 'Consider optimizing database queries, adding caching, or implementing pagination'
        });
      }

      if (metric.p95Duration > 1000) {
        recommendations.push({
          type: 'api',
          severity: 'medium',
          message: `API endpoint ${endpoint} has high P95 response time (${metric.p95Duration.toFixed(2)}ms)`,
          suggestion: 'Investigate slow requests and optimize bottlenecks'
        });
      }
    });

    // Database performance recommendations
    Object.entries(metrics.database).forEach(([queryType, metric]) => {
      if (metric.avgDuration > 200) {
        recommendations.push({
          type: 'database',
          severity: 'high',
          message: `Database query ${queryType} has high average duration (${metric.avgDuration.toFixed(2)}ms)`,
          suggestion: 'Add indexes, optimize query structure, or consider query caching'
        });
      }
    });

    // Memory recommendations
    if (metrics.memory && metrics.memory.heapUsed > 500 * 1024 * 1024) {
      recommendations.push({
        type: 'memory',
        severity: 'medium',
        message: `High memory usage detected (${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB)`,
        suggestion: 'Monitor for memory leaks and optimize data structures'
      });
    }

    return recommendations;
  }

  async saveReport(filename) {
    const report = this.generateReport();
    const reportPath = path.join(__dirname, 'reports', filename || `performance-report-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error('Failed to save performance report:', error);
      throw error;
    }
  }

  async generateHTMLReport(filename) {
    const report = this.generateReport();
    const html = this.createHTMLReport(report);
    const reportPath = path.join(__dirname, 'reports', filename || `performance-report-${Date.now()}.html`);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, html);
      console.log(`📊 HTML Performance report saved to ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error('Failed to save HTML performance report:', error);
      throw error;
    }
  }

  createHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Sharing Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .recommendations { margin: 20px 0; }
        .recommendation { padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; }
        .high { border-color: #dc3545; background: #f8d7da; }
        .medium { border-color: #ffc107; background: #fff3cd; }
        .low { border-color: #28a745; background: #d4edda; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
        .chart { height: 300px; margin: 20px 0; background: #f8f9fa; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 File Sharing Performance Report</h1>
        <p>Generated on: ${new Date(report.detailed.timestamp).toLocaleString()}</p>
        
        <h2>Summary</h2>
        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalAPIRequests}</div>
                <div class="metric-label">API Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.avgAPIResponse}ms</div>
                <div class="metric-label">Avg API Response</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalDBQueries}</div>
                <div class="metric-label">DB Queries</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.avgDBQuery}ms</div>
                <div class="metric-label">Avg DB Query</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.memoryUsageMB}MB</div>
                <div class="metric-label">Memory Usage</div>
            </div>
        </div>

        <h2>🚨 Recommendations</h2>
        <div class="recommendations">
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.severity}">
                    <strong>${rec.message}</strong><br>
                    <em>Suggestion: ${rec.suggestion}</em>
                </div>
            `).join('')}
        </div>

        <h2>📈 API Endpoints</h2>
        <table>
            <thead>
                <tr>
                    <th>Endpoint</th>
                    <th>Count</th>
                    <th>Avg (ms)</th>
                    <th>Min (ms)</th>
                    <th>Max (ms)</th>
                    <th>P95 (ms)</th>
                    <th>P99 (ms)</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(report.detailed.api).map(([endpoint, metrics]) => `
                    <tr>
                        <td>${endpoint}</td>
                        <td>${metrics.count}</td>
                        <td>${metrics.avgDuration.toFixed(2)}</td>
                        <td>${metrics.minDuration.toFixed(2)}</td>
                        <td>${metrics.maxDuration.toFixed(2)}</td>
                        <td>${metrics.p95Duration.toFixed(2)}</td>
                        <td>${metrics.p99Duration.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>🗄️ Database Queries</h2>
        <table>
            <thead>
                <tr>
                    <th>Query Type</th>
                    <th>Count</th>
                    <th>Avg (ms)</th>
                    <th>Min (ms)</th>
                    <th>Max (ms)</th>
                    <th>P95 (ms)</th>
                    <th>P99 (ms)</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(report.detailed.database).map(([queryType, metrics]) => `
                    <tr>
                        <td>${queryType}</td>
                        <td>${metrics.count}</td>
                        <td>${metrics.avgDuration.toFixed(2)}</td>
                        <td>${metrics.minDuration.toFixed(2)}</td>
                        <td>${metrics.maxDuration.toFixed(2)}</td>
                        <td>${metrics.p95Duration.toFixed(2)}</td>
                        <td>${metrics.p99Duration.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;
  }

  // Integration with Express app for real-time monitoring
  getExpressMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      
      res.on('finish', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Record the API call
        performance.mark(`file-sharing-api|${req.method}-${req.path}`);
        performance.measure(`file-sharing-api|${req.method}-${req.path}`, {
          start: startTime,
          duration: duration
        });
      });
      
      next();
    };
  }

  // Database query wrapper for monitoring
  wrapDatabaseQuery(queryFn, queryType) {
    return async (...args) => {
      const startTime = performance.now();
      
      try {
        const result = await queryFn(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        performance.mark(`db-query|${queryType}`);
        performance.measure(`db-query|${queryType}`, {
          start: startTime,
          duration: duration
        });
        
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        performance.mark(`db-query|${queryType}-error`);
        performance.measure(`db-query|${queryType}-error`, {
          start: startTime,
          duration: duration
        });
        
        throw error;
      }
    };
  }
}

// Usage example
const monitor = new PerformanceMonitor();

// Start monitoring
monitor.start();

// In your Express app:
// app.use(monitor.getExpressMiddleware());

// Wrap database calls:
// const wrappedQuery = monitor.wrapDatabaseQuery(supabase.from('file_shares').select, 'file_shares_select');

// Generate reports periodically
setInterval(async () => {
  try {
    await monitor.saveReport();
    await monitor.generateHTMLReport();
  } catch (error) {
    console.error('Failed to generate performance report:', error);
  }
}, 60000); // Every minute

module.exports = { PerformanceMonitor };
