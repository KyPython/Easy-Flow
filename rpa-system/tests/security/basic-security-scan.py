#!/usr/bin/env python3
"""
OWASP ZAP Security Scanner for EasyFlow
Performs automated security testing including:
- SSL/TLS configuration
- Common vulnerabilities (OWASP Top 10)
- Authentication bypass attempts
- Input validation testing

Prerequisites:
- pip install python-owasp-zap-v2.4
- OWASP ZAP installed and running on localhost:8080

Usage:
    python tests/security/basic-security-scan.py --target http://localhost:3030
    python tests/security/basic-security-scan.py --target http://staging-url:3030
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from zapv2 import ZAPv2

class EasyFlowSecurityScanner:
    def __init__(self, target_url, zap_proxy='http://127.0.0.1:8080'):
        self.target_url = target_url
        self.zap = ZAPv2(proxies={'http': zap_proxy, 'https': zap_proxy})
        self.results = {
            'target': target_url,
            'scan_time': datetime.now().isoformat(),
            'alerts': [],
            'summary': {}
        }
        
    def start_scan(self):
        """Execute the complete security scan"""
        print(f"🔒 Starting security scan for {self.target_url}")
        print(f"📡 ZAP Proxy: {self.zap._ZAPv2__proxies}")
        
        try:
            # 1. Spider the application
            self.spider_application()
            
            # 2. Run passive scan
            self.passive_scan()
            
            # 3. Run active scan
            self.active_scan()
            
            # 4. Check specific EasyFlow endpoints
            self.test_api_endpoints()
            
            # 5. Generate report
            self.generate_report()
            
            return self.results
            
        except Exception as e:
            print(f"❌ Security scan failed: {str(e)}")
            return None
    
    def spider_application(self):
        """Spider the application to discover URLs"""
        print("🕷️  Spidering application...")
        
        spider_id = self.zap.spider.scan(self.target_url)
        
        # Wait for spider to complete
        while int(self.zap.spider.status(spider_id)) < 100:
            print(f"Spider progress: {self.zap.spider.status(spider_id)}%")
            time.sleep(2)
        
        print("✅ Spidering completed")
        
        # Get discovered URLs
        urls = self.zap.core.urls()
        print(f"📋 Discovered {len(urls)} URLs")
        
        self.results['discovered_urls'] = len(urls)
        
    def passive_scan(self):
        """Run passive security scan"""
        print("🔍 Running passive scan...")
        
        # Wait for passive scan to complete
        while int(self.zap.pscan.records_to_scan) > 0:
            print(f"Passive scan remaining: {self.zap.pscan.records_to_scan}")
            time.sleep(2)
            
        print("✅ Passive scan completed")
        
    def active_scan(self):
        """Run active security scan"""
        print("⚡ Starting active scan...")
        
        scan_id = self.zap.ascan.scan(self.target_url)
        
        # Wait for active scan to complete (with timeout)
        timeout = 300  # 5 minutes
        start_time = time.time()
        
        while int(self.zap.ascan.status(scan_id)) < 100:
            if time.time() - start_time > timeout:
                print("⚠️  Active scan timeout - stopping scan")
                self.zap.ascan.stop(scan_id)
                break
                
            progress = self.zap.ascan.status(scan_id)
            print(f"Active scan progress: {progress}%")
            time.sleep(10)
            
        print("✅ Active scan completed")
        
    def test_api_endpoints(self):
        """Test specific API endpoints for security issues"""
        print("🔌 Testing API endpoints...")
        
        endpoints = [
            '/health',
            '/api/metrics', 
            '/api/tasks',
            '/api/runs',
            '/api/trigger-campaign'
        ]
        
        for endpoint in endpoints:
            url = f"{self.target_url}{endpoint}"
            print(f"Testing: {endpoint}")
            
            # Test for common issues
            self.test_endpoint_security(url)
            
    def test_endpoint_security(self, url):
        """Test individual endpoint for security issues"""
        try:
            # Test for SQL injection
            self.zap.ascan.scan_as_user(url, contextid=None, userid=None, recurse=None, 
                                      scanpolicyname=None, method=None, postdata="' OR 1=1 --")
            
            # Test for XSS
            self.zap.ascan.scan_as_user(url, contextid=None, userid=None, recurse=None,
                                      scanpolicyname=None, method=None, postdata="<script>alert('xss')</script>")
                                      
        except Exception as e:
            print(f"⚠️  Error testing {url}: {str(e)}")
            
    def get_alerts(self):
        """Get all security alerts"""
        alerts = self.zap.core.alerts()
        
        categorized_alerts = {
            'high': [],
            'medium': [], 
            'low': [],
            'informational': []
        }
        
        for alert in alerts:
            risk = alert.get('risk', '').lower()
            
            alert_data = {
                'name': alert.get('alert', ''),
                'risk': risk,
                'confidence': alert.get('confidence', ''),
                'url': alert.get('url', ''),
                'description': alert.get('description', ''),
                'solution': alert.get('solution', ''),
                'reference': alert.get('reference', ''),
                'cwe_id': alert.get('cweid', ''),
                'wasc_id': alert.get('wascid', '')
            }
            
            if risk == 'high':
                categorized_alerts['high'].append(alert_data)
            elif risk == 'medium':
                categorized_alerts['medium'].append(alert_data) 
            elif risk == 'low':
                categorized_alerts['low'].append(alert_data)
            else:
                categorized_alerts['informational'].append(alert_data)
                
        return categorized_alerts
        
    def generate_report(self):
        """Generate security scan report"""
        print("📊 Generating security report...")
        
        # Get all alerts
        alerts = self.get_alerts()
        self.results['alerts'] = alerts
        
        # Summary statistics
        summary = {
            'total_alerts': sum(len(alerts[category]) for category in alerts),
            'high_risk': len(alerts['high']),
            'medium_risk': len(alerts['medium']),
            'low_risk': len(alerts['low']),
            'informational': len(alerts['informational']),
            'risk_score': self.calculate_risk_score(alerts)
        }
        
        self.results['summary'] = summary
        
        # Save JSON report
        os.makedirs('tests/results', exist_ok=True)
        
        with open('tests/results/security-scan-results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
            
        # Generate HTML report
        self.generate_html_report()
        
        # Print summary
        self.print_summary(summary)
        
    def calculate_risk_score(self, alerts):
        """Calculate overall risk score"""
        score = 0
        score += len(alerts['high']) * 10
        score += len(alerts['medium']) * 5  
        score += len(alerts['low']) * 1
        return score
        
    def generate_html_report(self):
        """Generate HTML security report"""
        alerts = self.results['alerts']
        summary = self.results['summary']
        
        html_content = f'''
<!DOCTYPE html>
<html>
<head>
    <title>EasyFlow Security Scan Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #dc3545 0%, #6f1e1e 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }}
        .card {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .card.high {{ border-left: 5px solid #dc3545; }} .card.medium {{ border-left: 5px solid #fd7e14; }}
        .card.low {{ border-left: 5px solid #ffc107; }} .card.info {{ border-left: 5px solid #6c757d; }}
        .metric-title {{ font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }}
        .metric-value {{ font-size: 28px; font-weight: bold; }}
        .alerts {{ background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0; }}
        .alert-item {{ padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ddd; }}
        .alert-high {{ border-left-color: #dc3545; background: #f8d7da; }}
        .alert-medium {{ border-left-color: #fd7e14; background: #ffeaa7; }}
        .alert-low {{ border-left-color: #ffc107; background: #fff3cd; }}
        .alert-title {{ font-weight: bold; margin-bottom: 8px; }}
        .alert-url {{ font-family: monospace; font-size: 12px; background: #f8f9fa; padding: 4px 8px; border-radius: 3px; }}
        .recommendations {{ background: #d1ecf1; border: 1px solid #b6d4fe; padding: 20px; border-radius: 10px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 EasyFlow Security Scan Report</h1>
            <p><strong>Target:</strong> {self.target_url}</p>
            <p><strong>Scan Time:</strong> {self.results['scan_time']}</p>
        </div>
        
        <div class="summary">
            <div class="card high">
                <div class="metric-title">High Risk</div>
                <div class="metric-value" style="color: #dc3545;">{summary['high_risk']}</div>
            </div>
            <div class="card medium">
                <div class="metric-title">Medium Risk</div>
                <div class="metric-value" style="color: #fd7e14;">{summary['medium_risk']}</div>
            </div>
            <div class="card low">
                <div class="metric-title">Low Risk</div>
                <div class="metric-value" style="color: #ffc107;">{summary['low_risk']}</div>
            </div>
            <div class="card info">
                <div class="metric-title">Total Issues</div>
                <div class="metric-value" style="color: #6c757d;">{summary['total_alerts']}</div>
            </div>
        </div>
        
        {self.generate_alert_sections(alerts)}
        
        <div class="recommendations">
            <h3>🛡️ Security Recommendations</h3>
            <ul>
                <li>Implement proper input validation and sanitization</li>
                <li>Use HTTPS for all communications</li>
                <li>Implement proper authentication and authorization</li>
                <li>Keep dependencies up to date</li>
                <li>Implement rate limiting and CSRF protection</li>
                <li>Regular security audits and penetration testing</li>
            </ul>
        </div>
    </div>
</body>
</html>'''
        
        with open('tests/results/security-scan-report.html', 'w') as f:
            f.write(html_content)
            
    def generate_alert_sections(self, alerts):
        """Generate HTML for alert sections"""
        sections = []
        
        for risk_level, alert_list in alerts.items():
            if alert_list:
                section = f'''
        <div class="alerts">
            <h3>🚨 {risk_level.upper()} Risk Issues ({len(alert_list)})</h3>
            {self.generate_alert_items(alert_list, risk_level)}
        </div>'''
                sections.append(section)
                
        return ''.join(sections)
        
    def generate_alert_items(self, alert_list, risk_level):
        """Generate HTML for individual alert items"""
        items = []
        
        for alert in alert_list[:10]:  # Limit to first 10 for brevity
            item = f'''
            <div class="alert-item alert-{risk_level}">
                <div class="alert-title">{alert['name']}</div>
                <div class="alert-url">{alert['url']}</div>
                <p>{alert['description'][:200]}...</p>
                {f"<p><strong>Solution:</strong> {alert['solution'][:150]}...</p>" if alert['solution'] else ""}
            </div>'''
            items.append(item)
            
        return ''.join(items)
        
    def print_summary(self, summary):
        """Print scan summary to console"""
        print(f"""
🔒 SECURITY SCAN COMPLETED 🔒

🎯 TARGET: {self.target_url}
📊 SUMMARY:
• Total Issues: {summary['total_alerts']}
• High Risk: {summary['high_risk']}
• Medium Risk: {summary['medium_risk']} 
• Low Risk: {summary['low_risk']}
• Informational: {summary['informational']}
• Risk Score: {summary['risk_score']}

📁 Reports saved to:
• tests/results/security-scan-results.json
• tests/results/security-scan-report.html

{self.get_risk_assessment(summary['risk_score'])}
        """)
        
    def get_risk_assessment(self, risk_score):
        """Get risk assessment based on score"""
        if risk_score == 0:
            return "✅ EXCELLENT: No security issues found!"
        elif risk_score < 10:
            return "🟢 GOOD: Minor security issues detected"
        elif risk_score < 30:
            return "🟡 MODERATE: Some security issues need attention"
        elif risk_score < 60:
            return "🟠 HIGH: Significant security issues detected"
        else:
            return "🔴 CRITICAL: Severe security issues require immediate attention!"

def main():
    parser = argparse.ArgumentParser(description='EasyFlow Security Scanner')
    parser.add_argument('--target', required=True, help='Target URL to scan')
    parser.add_argument('--zap-proxy', default='http://127.0.0.1:8080', help='ZAP proxy URL')
    
    args = parser.parse_args()
    
    print("🔒 EasyFlow Security Scanner")
    print("=" * 50)
    
    # Check if ZAP is running
    try:
        scanner = EasyFlowSecurityScanner(args.target, args.zap_proxy)
        # Test connection
        scanner.zap.core.version()
        print(f"✅ Connected to ZAP at {args.zap_proxy}")
    except Exception as e:
        print(f"❌ Cannot connect to ZAP: {e}")
        print("Please ensure OWASP ZAP is running on the specified port")
        sys.exit(1)
    
    # Run security scan
    results = scanner.start_scan()
    
    if results:
        print("✅ Security scan completed successfully")
        return 0
    else:
        print("❌ Security scan failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())