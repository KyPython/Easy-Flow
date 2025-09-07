# EasyFlow Production Deployment Guide

This comprehensive guide covers deploying the EasyFlow RPA system to production with all components properly configured.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 100GB minimum SSD storage
- **Network**: Public IP address with domain name
- **Ports**: 80, 443, 3030, 9090, 3001, 5432

### Required Services
- **Domain & DNS**: Domain pointing to your server
- **SSL Certificate**: Let's Encrypt recommended
- **Email Service**: SMTP server for notifications
- **Supabase**: Database and auth service
- **Firebase**: Real-time notifications

### Software Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx htop git
```

## Deployment Process

### Phase 1: Infrastructure Setup

#### 1. Domain and SSL Setup
```bash
# Point your domain to your server IP
# Configure Nginx
sudo cp easyflow-app.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/easyflow-app.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env
cp backend/.env.example backend/.env

# Configure environment variables
nano .env
nano backend/.env
```

**Required Environment Variables:**
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_DATABASE_URL=your_database_url
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

# Email
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Security
API_KEY=generate_secure_api_key
JWT_SECRET=generate_secure_jwt_secret
WEBHOOK_SECRET=generate_secure_webhook_secret

# Domains
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Phase 2: Database Setup

#### 1. Supabase Configuration
```sql
-- Run in Supabase SQL editor
\i supabase-schema.sql
```

#### 2. Verify Database Tables
- profiles
- automation_tasks
- email_campaigns
- hubspot_contacts
- email_queue
- system_logs

### Phase 3: Firebase Setup

#### 1. Firebase Console Configuration
Follow the detailed steps in `FIREBASE_SETUP.md`:

1. Create Firebase project
2. Enable Realtime Database
3. Configure Database rules
4. Generate service account
5. Enable Cloud Messaging
6. Configure web app

#### 2. Service Account Setup
```bash
# Place Firebase service account key
mkdir -p backend/config
# Upload firebase-service-account.json to backend/config/
```

### Phase 4: Application Deployment

#### 1. Build and Deploy Backend
```bash
# Install dependencies
cd backend && npm ci

# Build application (if needed)
npm run build

# Start with PM2 (production process manager)
npm install -g pm2
pm2 start index.js --name easyflow-backend
pm2 startup
pm2 save
```

#### 2. Build and Deploy Frontend
```bash
# Build React app
cd rpa-dashboard
npm ci
npm run build

# Deploy to web server
sudo cp -r build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
```

#### 3. Configure Nginx
```nginx
# /etc/nginx/sites-available/easyflow-app.conf
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    root /var/www/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3030/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Phase 5: Monitoring Setup

#### 1. Start Monitoring Stack
```bash
cd monitoring
./start-monitoring.sh
```

#### 2. Configure Monitoring Access
```nginx
# Add to Nginx config
location /monitoring/ {
    proxy_pass http://localhost:3001/;
    auth_basic "Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

#### 3. Create Monitoring Users
```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin
sudo systemctl reload nginx
```

### Phase 6: Security Configuration

#### 1. Firewall Setup
```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3030/tcp  # Backend API
sudo ufw enable
```

#### 2. Rate Limiting
```nginx
# Add to nginx.conf http block
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Add to server block
location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... proxy config
}
```

#### 3. SSL Configuration
```bash
# Generate strong DH parameters
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Add to Nginx SSL config
ssl_dhparam /etc/ssl/certs/dhparam.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
```

## Testing and Validation

### 1. System Health Check
```bash
./run-all-tests.sh
```

### 2. Load Testing
```bash
./run-load-tests.sh production
```

### 3. Security Testing  
```bash
./run-security-tests.sh production
```

### 4. Integration Testing
```bash
./run-integration-tests.sh production
```

## Post-Deployment

### 1. Monitoring Setup
- Access Grafana: https://yourdomain.com/monitoring/
- Configure alert notifications
- Set up log rotation

### 2. Backup Configuration
```bash
# Database backups
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh

# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/easyflow_${DATE}.sql
find /backups -name "easyflow_*.sql" -mtime +7 -delete
```

### 3. SSL Certificate Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab
0 12 * * * /usr/bin/certbot renew --quiet
```

## Maintenance

### Daily Tasks
- Check system health via monitoring dashboard
- Review error logs
- Monitor resource usage

### Weekly Tasks  
- Review security alerts
- Update dependencies (if needed)
- Check backup integrity

### Monthly Tasks
- Security audit
- Performance review
- Capacity planning
- SSL certificate check

## Troubleshooting

### Common Issues

#### Backend Not Starting
```bash
# Check logs
pm2 logs easyflow-backend

# Check process
pm2 status

# Restart
pm2 restart easyflow-backend
```

#### Database Connection Issues
```bash
# Test database connection
psql $SUPABASE_URL

# Check environment variables
env | grep SUPABASE
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
```

#### High Memory Usage
```bash
# Check memory usage
free -h
htop

# Restart services if needed
pm2 restart all
docker-compose -f monitoring/docker-compose.monitoring.yml restart
```

## Performance Optimization

### 1. Database Optimization
- Enable connection pooling
- Add database indexes
- Configure query optimization

### 2. Caching Strategy
```nginx
# Static asset caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. CDN Integration
- Configure CloudFlare or similar CDN
- Enable compression and minification

## Security Hardening

### 1. Server Hardening
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Update packages
sudo apt update && sudo apt upgrade -y

# Install fail2ban
sudo apt install fail2ban
```

### 2. Application Security
- Enable HTTPS everywhere
- Implement rate limiting
- Regular security audits
- Keep dependencies updated

## Scaling Considerations

### Horizontal Scaling
- Load balancer configuration
- Multi-server deployment
- Database replication

### Vertical Scaling
- Resource monitoring
- Performance bottleneck identification
- Hardware upgrade planning

This guide provides a complete production deployment process for the EasyFlow RPA system with security, monitoring, and maintenance considerations.