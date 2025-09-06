# EasyFlow Testing Documentation

This document describes the comprehensive testing suite for EasyFlow, including load testing, security testing, and staging environment validation.

## Overview

EasyFlow includes several types of automated testing:

1. **Load Testing** - Performance and scalability testing using K6
2. **Security Testing** - Vulnerability scanning using OWASP ZAP and custom scripts
3. **Staging Environment Testing** - Comprehensive integration testing
4. **Firebase Integration Testing** - Real-time notification system validation

## Quick Start

### Prerequisites

- Docker and Docker Compose (for staging environment)
- Node.js and npm (for development)
- Optional: K6, OWASP ZAP, Python3 (for advanced testing)

### Basic Testing Commands

```bash
# Test Firebase integration
node backend/test-firebase.js

# Deploy and test staging environment
./deploy-staging.sh

# Run load tests (staging environment)
./run-load-tests.sh

# Run security tests (staging environment) 
./run-security-tests.sh
```

## Load Testing

### Available Load Tests

1. **Basic Load Test** (`tests/load/basic-load-test.k6.js`)
   - Tests core API endpoints
   - Gradual load increase: 10 → 25 → 50 users
   - Duration: ~20 minutes
   - Validates response times and error rates

2. **Stress Test** (`tests/load/stress-test.k6.js`)
   - High load scenarios to find breaking points
   - Load pattern: 50 → 200 → 400 → 600 users
   - Duration: ~20 minutes
   - Tests system resilience under extreme load

### Running Load Tests

```bash
# Using the staging environment (recommended)
./deploy-staging.sh
./run-load-tests.sh

# Individual test types
./run-load-tests.sh basic      # Basic load test only
./run-load-tests.sh stress     # Stress test only
./run-load-tests.sh clean      # Clean old results
```

### Load Test Results

Results are saved to `tests/results/load/`:
- JSON files with detailed metrics
- CSV files for data analysis
- HTML reports with visualizations
- Markdown summary reports

**Key Metrics Tracked:**
- Response time (average, p95, p99)
- Request rate and throughput
- Error rate and failure types
- Resource utilization

## Security Testing

### Security Test Categories

1. **SSL/TLS Configuration**
   - Certificate validation
   - Security headers check
   - HTTPS enforcement

2. **Authentication Security**
   - Protected endpoint validation
   - Invalid token handling
   - Session management

3. **Input Validation**
   - SQL injection protection
   - XSS prevention
   - Large payload handling

4. **OWASP ZAP Scanning**
   - Automated vulnerability detection
   - Common web application security issues
   - OWASP Top 10 coverage

### Running Security Tests

```bash
# Full security test suite
./run-security-tests.sh

# Individual test types
./run-security-tests.sh ssl     # SSL/TLS tests only
./run-security-tests.sh auth    # Authentication tests only
./run-security-tests.sh input   # Input validation tests only
./run-security-tests.sh zap     # OWASP ZAP scan only
./run-security-tests.sh clean   # Clean old results
```

### Security Test Results

Results are saved to `tests/results/security/`:
- Text reports with security findings
- JSON data for programmatic analysis
- HTML reports for detailed review
- OWASP ZAP XML/HTML reports

## Firebase Integration Testing

### Firebase Test Components

1. **Configuration Validation**
   - Environment variable checks
   - Service account validation
   - Database connectivity

2. **Notification System Testing**
   - Push notification delivery
   - Real-time database updates
   - Cross-tab synchronization

3. **Template Testing**
   - Welcome notifications
   - Task completion alerts
   - System notifications

### Running Firebase Tests

```bash
# Basic Firebase integration test
node backend/test-firebase.js

# Test from backend directory
cd backend && node test-firebase.js
```

### Firebase Setup Requirements

Before running Firebase tests, ensure you have:

1. **Firebase Project** - Created at https://console.firebase.google.com/
2. **Service Account** - Downloaded JSON file placed in `backend/config/firebase-service-account.json`
3. **Environment Variables** - Configured in `backend/.env` (see `.env.firebase.example`)
4. **Database Rules** - Properly configured for security

Refer to `FIREBASE_SETUP.md` for detailed setup instructions.

## Staging Environment

### Docker Compose Configuration

The staging environment uses multiple Docker Compose files:
- `docker-compose.yml` - Base configuration
- `docker-compose.staging.yml` - Staging-specific overrides

**Services Included:**
- Backend API server
- Redis for caching
- Prometheus for metrics collection
- Grafana for monitoring dashboards
- K6 for load testing
- OWASP ZAP for security testing

### Staging Environment Commands

```bash
# Deploy staging environment
./deploy-staging.sh

# Check staging status
docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps

# View logs
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs backend

# Stop staging environment
docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
```

### Monitoring and Observability

**Grafana Dashboard:** http://localhost:3001
- Username: `admin`
- Password: `staging_admin_2024`

**Prometheus Metrics:** http://localhost:9090

**Available Dashboards:**
- System performance metrics
- API response times
- Error rates and statuses
- Resource utilization

## Test Results and Reporting

### Results Directory Structure

```
tests/results/
├── load/
│   ├── basic_load_test_YYYYMMDD_HHMMSS.json
│   ├── stress_test_YYYYMMDD_HHMMSS.json
│   └── load_test_report_YYYYMMDD_HHMMSS.md
├── security/
│   ├── ssl_test_YYYYMMDD_HHMMSS.txt
│   ├── auth_test_YYYYMMDD_HHMMSS.txt
│   ├── input_validation_YYYYMMDD_HHMMSS.txt
│   └── security_report_YYYYMMDD_HHMMSS.md
└── firebase/
    └── integration_test_results.json
```

### Interpreting Results

#### Load Test Results

**Successful Load Test Indicators:**
- HTTP failure rate < 1%
- p95 response time < 1000ms
- p99 response time < 2000ms
- No 5xx server errors

**Warning Signs:**
- Increasing response times under load
- High memory/CPU usage
- Connection timeouts
- Database connection pool exhaustion

#### Security Test Results

**Security Status Indicators:**
- ✅ All security headers present
- ✅ HTTPS properly configured
- ✅ Protected endpoints require authentication
- ✅ Input validation prevents injection attacks

**Security Issues to Address:**
- ❌ Missing security headers
- ⚠️ HTTP endpoints in production
- ❌ Unprotected API endpoints
- ❌ Successful injection attempts

## CI/CD Integration

### Automated Testing Pipeline

The testing suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: EasyFlow Testing
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy Staging
        run: ./deploy-staging.sh
      - name: Run Load Tests
        run: ./run-load-tests.sh basic
      - name: Run Security Tests  
        run: ./run-security-tests.sh
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: tests/results/
```

### Quality Gates

Recommended quality gates for deployment:

**Load Testing Gates:**
- p95 response time < 500ms for critical endpoints
- Error rate < 0.1% under normal load
- System handles 2x expected peak load

**Security Testing Gates:**
- No high-severity security vulnerabilities
- All critical security headers present
- Authentication properly enforced

## Troubleshooting

### Common Issues

1. **"Target is not reachable" Error**
   ```bash
   # Check if services are running
   docker-compose ps
   
   # Check health endpoint manually
   curl http://localhost:3030/health
   ```

2. **"K6 not found" Error**
   ```bash
   # Install K6 (macOS)
   brew install k6
   
   # Install K6 (Ubuntu/Debian)
   sudo apt install k6
   ```

3. **"ZAP not found" Error**
   ```bash
   # Download OWASP ZAP
   # https://owasp.org/www-project-zap/
   
   # Or run without ZAP (basic security checks only)
   ./run-security-tests.sh auth
   ```

4. **Firebase Configuration Issues**
   ```bash
   # Test Firebase setup
   node backend/test-firebase.js
   
   # Check environment variables
   grep FIREBASE backend/.env
   ```

### Getting Help

- **Load Testing Issues:** Check K6 documentation and Grafana dashboards
- **Security Issues:** Review OWASP documentation and ZAP reports  
- **Firebase Issues:** Refer to `FIREBASE_SETUP.md` and Firebase Console
- **Staging Issues:** Check Docker logs and service status

### Performance Optimization Tips

1. **Database Query Optimization**
   - Add indexes for frequently queried fields
   - Implement query caching where appropriate
   - Monitor slow queries in logs

2. **API Response Optimization**
   - Implement response compression
   - Use appropriate HTTP caching headers
   - Optimize payload sizes

3. **Infrastructure Scaling**
   - Implement horizontal scaling
   - Add load balancing
   - Use CDN for static assets

## Best Practices

### Load Testing Best Practices

1. **Test Realistic Scenarios**
   - Use production-like data volumes
   - Simulate actual user behaviors
   - Include authentication flows

2. **Gradual Load Increase**
   - Start with minimal load
   - Gradually increase to find limits
   - Allow system recovery between tests

3. **Monitor System Resources**
   - CPU, memory, disk usage
   - Database connection pools
   - Network bandwidth utilization

### Security Testing Best Practices

1. **Regular Security Scans**
   - Include in CI/CD pipelines
   - Run before each release
   - Automate critical security checks

2. **Defense in Depth**
   - Multiple security layers
   - Proper input validation
   - Authentication and authorization

3. **Security Headers**
   - Implement all recommended headers
   - Configure Content Security Policy
   - Enable HSTS for HTTPS

### Testing Environment Best Practices

1. **Environment Consistency**
   - Use same versions as production
   - Similar data and configuration
   - Isolated test environments

2. **Test Data Management**
   - Use realistic test data sets
   - Protect sensitive information
   - Clean up after tests

3. **Result Analysis**
   - Establish performance baselines
   - Track trends over time
   - Set up automated alerting

## Additional Resources

- [K6 Load Testing Documentation](https://k6.io/docs/)
- [OWASP ZAP User Guide](https://www.zaproxy.org/docs/)
- [Firebase Admin SDK Guide](https://firebase.google.com/docs/admin/setup)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Grafana Dashboard Creation](https://grafana.com/docs/grafana/latest/dashboards/)

---

*Testing documentation for EasyFlow v1.0 - Last updated: September 2024*