# RSL VIMS Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Road Safety Limited Vehicle Inspection Management System (RSL VIMS) to production environments.

## Prerequisites

### System Requirements

- **Node.js**: v20.x or higher
- **PostgreSQL**: v15.x or higher
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: Minimum 10GB SSD (50GB recommended for production)
- **CPU**: 2 cores minimum (4 cores recommended)

### Software Dependencies

- Docker and Docker Compose (for containerized deployment)
- Nginx or Apache (for reverse proxy)
- SSL/TLS certificates (Let's Encrypt recommended)
- Backup storage (S3, GCS, or local)

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### 1. Clone the Repository

```bash
git clone https://github.com/your-org/rsl-vims.git
cd rsl-vims
```

#### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://rsl_user:secure_password@db:5432/rsl_vims
DATABASE_POOL_SIZE=20

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://vims.rsl.gh
APP_VERSION=1.0.0

# Authentication
JWT_SECRET=your-secure-jwt-secret-min-32-chars
SESSION_SECRET=your-secure-session-secret-min-32-chars
CSRF_SECRET=your-secure-csrf-secret-min-32-chars

# API Keys
API_KEY_SALT=your-secure-api-key-salt-min-32-chars

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@rsl.gh
SMTP_PASSWORD=your-email-password
SMTP_FROM=RSL VIMS <noreply@rsl.gh>

# Error Tracking (Optional)
SENTRY_DSN=https://your-sentry-dsn
ERROR_TRACKING_WEBHOOK=https://your-webhook-url

# File Storage (Optional)
S3_BUCKET=rsl-vims-uploads
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Security
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=15

# 2FA Configuration
TWO_FACTOR_ISSUER=RSL VIMS

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**Important**: Generate secure secrets using:
```bash
openssl rand -hex 32
```

#### 3. Build and Start Services

```bash
# Build the application
docker-compose build

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f app
```

#### 4. Run Database Migrations

```bash
# Push schema to database
docker-compose exec app npx drizzle-kit push

# Or run migrations if using migration files
docker-compose exec app npx drizzle-kit migrate
```

#### 5. Verify Deployment

```bash
# Check health endpoint
curl https://vims.rsl.gh/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-XXT12:00:00Z",
#   "version": "1.0.0",
#   ...
# }
```

---

### Option 2: Manual Deployment

#### 1. Install Dependencies

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-15
```

#### 2. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE rsl_vims;
CREATE USER rsl_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE rsl_vims TO rsl_user;
\q
```

#### 3. Install Application

```bash
# Clone repository
git clone https://github.com/your-org/rsl-vims.git
cd rsl-vims

# Install dependencies
npm ci --production

# Build application
npm run build
```

#### 4. Configure Systemd Service

Create `/etc/systemd/system/rsl-vims.service`:

```ini
[Unit]
Description=RSL VIMS Application
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rsl-vims
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://rsl_user:secure_password@localhost:5432/rsl_vims"
Environment="NEXT_PUBLIC_APP_URL=https://vims.rsl.gh"
ExecStart=/usr/bin/node /var/www/rsl-vims/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable rsl-vims
sudo systemctl start rsl-vims

# Check status
sudo systemctl status rsl-vims
```

#### 5. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/rsl-vims`:

```nginx
server {
    listen 80;
    server_name vims.rsl.gh;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vims.rsl.gh;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/vims.rsl.gh/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vims.rsl.gh/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        expires 60m;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /api/health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/rsl-vims /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Setup SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d vims.rsl.gh

# Auto-renewal (already configured by certbot)
sudo systemctl status certbot.timer
```

---

## Database Backup Strategy

### Automated Daily Backups

Create `/usr/local/bin/backup-rsl-vims.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/rsl-vims"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="rsl_vims"
DB_USER="rsl_user"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/db_$DATE.dump

# Compress backup
gzip $BACKUP_DIR/db_$DATE.dump

# Upload to S3 (optional)
if [ -n "$S3_BUCKET" ]; then
    aws s3 cp $BACKUP_DIR/db_$DATE.dump.gz s3://$S3_BUCKET/backups/
fi

# Remove old backups
find $BACKUP_DIR -name "db_*.dump.gz" -type f -mtime +$RETENTION_DAYS -delete

# Log backup
echo "[$DATE] Backup completed: db_$DATE.dump.gz" >> $BACKUP_DIR/backup.log
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-rsl-vims.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /usr/local/bin/backup-rsl-vims.sh
```

### Manual Backup

```bash
# Database backup
pg_dump -U rsl_user -d rsl_vims -F c -f backup.dump

# Restore
pg_restore -U rsl_user -d rsl_vims -c backup.dump
```

---

## Monitoring and Alerting

### Health Checks

Configure monitoring to check:

```bash
# Application health
curl -f https://vims.rsl.gh/api/health

# Database connectivity
pg_isready -h localhost -p 5432 -U rsl_user

# Disk space
df -h /var/lib/postgresql

# Memory usage
free -m

# CPU usage
top -bn1 | grep "Cpu(s)"
```

### Log Monitoring

```bash
# Application logs
journalctl -u rsl-vims -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

### Alerting Rules

Configure alerts for:
- Application health check failures
- High CPU usage (>80% for 5 minutes)
- High memory usage (>85% for 5 minutes)
- Low disk space (<20% remaining)
- Database connection failures
- High error rates (>1% of requests)
- Slow response times (>2s average)

---

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use Nginx, HAProxy, or cloud load balancer
2. **Multiple App Instances**: Run multiple Node.js instances
3. **Session Storage**: Use Redis for session storage
4. **Database**: Use read replicas for read-heavy workloads

### Vertical Scaling

1. **Increase Resources**: Add more CPU, memory, or storage
2. **Optimize Database**: Add indexes, optimize queries
3. **Caching**: Implement Redis caching layer

---

## Security Hardening

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Database Security

```bash
# Configure PostgreSQL to only accept local connections
# Edit /etc/postgresql/15/main/pg_hba.conf
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Application Security

- Keep dependencies updated: `npm audit`
- Use security headers (already configured in Nginx)
- Implement rate limiting (already configured)
- Use HTTPS everywhere
- Regular security audits

---

## Maintenance

### Updating the Application

```bash
# Pull latest changes
cd /var/www/rsl-vims
git pull origin main

# Install dependencies
npm ci --production

# Build application
npm run build

# Restart service
sudo systemctl restart rsl-vims

# Or for Docker
docker-compose pull
docker-compose up -d
```

### Database Maintenance

```bash
# Vacuum database (weekly)
vacuumdb -U rsl_user -d rsl_vims -z

# Reindex database (monthly)
reindexdb -U rsl_user -d rsl_vims

# Analyze database (weekly)
psql -U rsl_user -d rsl_vims -c "ANALYZE;"
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
journalctl -u rsl-vims -n 50

# Check Node.js version
node --version

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### High CPU Usage

```bash
# Check running processes
top -c

# Check Node.js processes
ps aux | grep node

# Check database queries
psql -U rsl_user -d rsl_vims -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection pool
psql -U rsl_user -d rsl_vims -c "SELECT count(*) FROM pg_stat_activity;"

# Check for locks
psql -U rsl_user -d rsl_vims -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

---

## Support

For deployment support:
- Email: devops@rsl.gh
- Documentation: https://docs.rsl.gh/deployment
- Status Page: https://status.rsl.gh

---

## Changelog

### v1.0.0 (2026-01-XX)
- Initial deployment guide
- Docker Compose setup
- Manual deployment instructions
- Backup procedures
- Monitoring configuration
