# EasyFlow - No-Code Automation Platform

Transform your repetitive tasks into powerful automated workflows. EasyFlow makes business automation accessible to everyone, no coding required.

![EasyFlow Dashboard](https://via.placeholder.com/800x400/0066cc/ffffff?text=EasyFlow+Dashboard)

## 🚀 What is EasyFlow?

EasyFlow is a comprehensive automation platform that handles everything from simple web tasks to complex multi-step workflows. Whether you're automating data entry, extracting information from websites, or orchestrating entire business processes, EasyFlow has you covered.

### ✨ Key Features

**🎯 Visual Workflow Builder**
- Drag-and-drop interface for building automation workflows  
- Pre-built templates for common business processes
- Real-time testing and debugging tools

**🌐 Web Automation**
- Form filling and submission
- Data extraction from any website
- Login automation and session management
- PDF and file downloads

**📊 Smart Analytics & ROI Tracking** 
- Real-time performance dashboards
- Time savings calculations
- Cost-benefit analysis
- Detailed execution reports

**🔒 Enterprise Security**
- Client-side encryption for sensitive data
- Comprehensive audit logging
- Role-based access control
- SOC 2 compliant infrastructure

**⚡ Scalable Infrastructure**
- Process and thread pool support
- Prometheus metrics integration
- Horizontal scaling capabilities
- 99.9% uptime SLA

## 🎯 Perfect For

- **Business Operations Teams** - Automate data entry, report generation, and routine tasks
- **E-commerce Businesses** - Inventory management, order processing, customer communications  
- **Marketing Agencies** - Lead generation, social media management, campaign automation
- **Finance Teams** - Invoice processing, expense management, compliance reporting
- **HR Departments** - Candidate screening, onboarding workflows, document management

## 🏗️ Architecture

EasyFlow is built with modern, scalable technologies:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │───▶│   Node.js API    │───▶│  Automation     │
│   Dashboard     │    │   (Express.js)   │    │  Service        │
└─────────────────┘    └──────────────────┘    │  (Python)       │
                                ▼               └─────────────────┘
                       ┌──────────────────┐              ▼
                       │   Supabase DB    │    ┌─────────────────┐
                       │   (PostgreSQL)   │    │   Selenium      │
                       └──────────────────┘    │   WebDriver     │
                                               └─────────────────┘
```

- **Frontend**: React.js with modern UI components
- **Backend**: Node.js with Express.js REST API
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Automation Engine**: Python with Selenium WebDriver
- **Queue System**: Kafka for reliable task processing
- **Monitoring**: Prometheus metrics and health checks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and Python 3.9+
- Docker and Docker Compose
- Supabase account (or PostgreSQL database)

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/easyflow.git
cd easyflow

# Install dependencies
npm install
cd rpa-dashboard && npm install
cd ../backend && npm install
```

### 2. Environment Configuration
```bash
# Copy example environment files
cp backend/.env.example backend/.env
cp rpa-dashboard/.env.example rpa-dashboard/.env

# Configure your Supabase credentials
# SUPABASE_URL=your-project-url
# SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 3. Database Setup
```bash
# Run migrations
cd backend
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 4. Start Development
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or run individually:
# Backend API
cd backend && npm run dev

# Frontend Dashboard  
cd rpa-dashboard && npm start

# Automation Service
cd automation/automation-service && python production_automation_service.py
```

Visit `http://localhost:3000` to access the EasyFlow dashboard.

## 📖 Usage Examples

### Example 1: Web Data Extraction
```javascript
// Extract product information from e-commerce sites
const workflow = {
  "name": "Product Price Monitor",
  "steps": [
    {
      "type": "web_navigation",
      "url": "https://example-store.com/product/12345"
    },
    {
      "type": "data_extraction", 
      "selectors": {
        "price": ".price-current",
        "availability": ".stock-status",
        "title": "h1.product-title"
      }
    },
    {
      "type": "email_notification",
      "condition": "price < previous_price",
      "template": "price_drop_alert"
    }
  ]
}
```

### Example 2: Form Automation
```javascript
// Automate contact form submissions
const contactFormWorkflow = {
  "name": "Lead Generation Form Filler",
  "steps": [
    {
      "type": "web_navigation",
      "url": "https://target-site.com/contact"
    },
    {
      "type": "form_filling",
      "fields": {
        "name": "{{lead.name}}",
        "email": "{{lead.email}}", 
        "company": "{{lead.company}}",
        "message": "{{lead.custom_message}}"
      }
    },
    {
      "type": "form_submission",
      "success_indicators": [".success-message", ".thank-you"]
    }
  ]
}
```

## 📊 Configuration Options

### Worker Configuration
```bash
# Automation service settings
MAX_WORKERS=4                    # Number of worker threads/processes  
POOL_TYPE=thread                 # 'thread' or 'process'
USE_PROCESS_POOL=false          # Enable process pool for CPU-bound tasks

# Kafka settings with exponential backoff
KAFKA_RETRY_ATTEMPTS=5
KAFKA_INITIAL_RETRY_DELAY=1     # Initial delay in seconds
KAFKA_MAX_RETRY_DELAY=60        # Maximum delay in seconds  
KAFKA_RETRY_MULTIPLIER=2.0      # Exponential backoff multiplier
```

### Security Configuration
```bash
# Client-side encryption (React app)
REACT_APP_ENCRYPTION_ENABLED=true
REACT_APP_ENCRYPTION_KEY=your-base64-key
REACT_APP_ENCRYPTION_SALT=your-salt-string

# Audit logging
AUDIT_BUFFER_SIZE=100           # Batch size for audit logs
AUDIT_FLUSH_INTERVAL=30000      # Flush interval in milliseconds
```

### Performance Monitoring
```bash
# Prometheus metrics endpoint available at /metrics
METRICS_ENABLED=true

# Custom hourly rate for ROI calculations  
DEFAULT_HOURLY_RATE=25          # USD per hour
```

## 🔧 API Reference

### Automation API
```bash
# Execute automation task
POST /api/automation/execute
{
  "task_type": "web_automation",
  "url": "https://example.com",
  "actions": [...]
}

# Check task status
GET /api/automation/status/{task_id}

# Get execution history
GET /api/automation/history?limit=50&offset=0
```

### Analytics API
```bash
# ROI dashboard data
GET /api/roi-analytics/dashboard?timeframe=30d

# Time savings analysis  
GET /api/roi-analytics/time-savings?task_type=web_automation

# Export analytics data
GET /api/roi-analytics/export?format=csv&timeframe=90d
```

### Audit Logs API
```bash
# Get user audit logs
GET /api/audit-logs/user?startDate=2024-01-01&actionType=automation_execution

# Export audit data  
GET /api/audit-logs/export?format=csv&timeframe=30d
```

## 🛡️ Security Features

### Data Protection
- **Client-side encryption** for sensitive form data using AES-256-GCM
- **Audit logging** for all user actions and system events
- **Row-level security** in database with user isolation
- **Rate limiting** and DDoS protection

### Compliance
- **SOC 2 Type II** compliance ready
- **GDPR** data protection controls
- **CCPA** privacy compliance
- **Data retention** policies with automated cleanup

## 📈 Performance & Scaling

### Metrics & Monitoring
- **Prometheus metrics** for system health and performance
- **Real-time dashboards** with automation success rates
- **Error tracking** with detailed stack traces
- **Resource utilization** monitoring

### Horizontal Scaling
```yaml
# Docker Compose scaling example
version: '3.8'
services:
  automation-service:
    image: easyflow/automation-service
    deploy:
      replicas: 3
    environment:
      - MAX_WORKERS=8
      - POOL_TYPE=process
```

## 🧪 Testing

### Automated Testing
```bash
# Run automation service tests against real websites
cd tests
python automation_service_tests.py

# Run frontend tests
cd rpa-dashboard  
npm test

# Run backend API tests
cd backend
npm test
```

### Test Sites Used
- **Form Testing**: https://practice.expandtesting.com
- **E-commerce**: https://automationexercise.com  
- **Login Flows**: https://the-internet.herokuapp.com
- **API Testing**: https://jsonplaceholder.typicode.com

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test thoroughly
4. Submit a pull request

### Code Standards
- **ESLint** for JavaScript code quality
- **Black** for Python code formatting  
- **Prettier** for consistent code style
- **Jest** for unit testing

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.easyflow.com](https://docs.easyflow.com)
- **Discord Community**: [Join our Discord](https://discord.gg/easyflow)
- **Email Support**: support@easyflow.com
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/easyflow/issues)

## 🗺️ Roadmap

### Q1 2025
- [ ] **AI-Powered Workflow Generation** - Natural language to automation
- [ ] **Advanced Scheduling** - Cron expressions and complex triggers
- [ ] **Team Collaboration** - Shared workflows and permissions

### Q2 2025  
- [ ] **Mobile Apps** - iOS and Android clients
- [ ] **API Integrations** - Zapier, Make.com connectors
- [ ] **Enterprise SSO** - SAML and OAuth2 integration

### Q3 2025
- [ ] **Workflow Marketplace** - Community templates
- [ ] **Advanced Analytics** - ML-powered insights
- [ ] **Multi-tenant Architecture** - White-label solutions

---

**⭐ Star this repository if EasyFlow helps automate your business processes!**

Built with ❤️ by the EasyFlow team. Empowering businesses through intelligent automation.