# MentorLed Platform - Technical Guide (Part 6/6)
## Deployment & Production Readiness

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 6)

1. [Deployment Overview](#deployment-overview)
2. [Docker Production Setup](#docker-production-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Production Setup](#database-production-setup)
5. [Security Hardening](#security-hardening)
6. [Monitoring & Logging](#monitoring--logging)
7. [Performance Optimization](#performance-optimization)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Production Checklist](#production-checklist)

---

## 1. Deployment Overview

### 1.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     INTERNET                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   LOAD BALANCER                         │
│  (HTTPS Termination, SSL Certificates)                  │
│  - nginx or AWS ALB or Cloudflare                       │
└─────────────────────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ↓                         ↓
┌─────────────────────┐   ┌─────────────────────┐
│   Frontend Server   │   │   Backend Server    │
│   (Next.js)         │   │   (FastAPI)         │
│   Port: 3000        │   │   Port: 8000        │
│   - Vercel or       │   │   - AWS EC2 or      │
│   - Docker on VPS   │   │   - Docker on VPS   │
└─────────────────────┘   └─────────────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ↓                     ↓
              ┌──────────────────┐   ┌─────────────────┐
              │   PostgreSQL     │   │   Redis Cache   │
              │   (Database)     │   │   (Optional)    │
              │   - AWS RDS or   │   │   - AWS ElastiCache│
              │   - Managed DB   │   │   - Docker      │
              └──────────────────┘   └─────────────────┘
```

### 1.2 Deployment Options

#### Option 1: All-in-One Docker Deployment (VPS)
**Best for**: Small-medium deployments, cost-effective

- Single VPS (Digital Ocean, Linode, Hetzner)
- Docker Compose for all services
- nginx reverse proxy
- Let's Encrypt SSL

**Pros**: Simple, cheap ($10-20/month), full control
**Cons**: Single point of failure, manual scaling

---

#### Option 2: Managed Services (AWS/GCP/Azure)
**Best for**: Production, scalability, reliability

**Frontend**: Vercel or AWS Amplify
**Backend**: AWS ECS/Fargate or Google Cloud Run
**Database**: AWS RDS or Google Cloud SQL
**Cache**: AWS ElastiCache Redis

**Pros**: Auto-scaling, managed, reliable
**Cons**: More expensive ($50-200+/month), complexity

---

#### Option 3: Hybrid Approach
**Best for**: Balance of cost and performance

**Frontend**: Vercel (free tier or $20/month)
**Backend**: Docker on VPS ($10-20/month)
**Database**: Managed PostgreSQL ($15-30/month)

**Pros**: Frontend CDN, managed DB, affordable backend
**Cons**: Multiple providers to manage

---

## 2. Docker Production Setup

### 2.1 Production Dockerfile (Backend)

**File**: `backend/Dockerfile.prod`

```dockerfile
# Multi-stage build for smaller image
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY ./app /app/app
COPY ./alembic /app/alembic
COPY ./alembic.ini /app/

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Make sure scripts are in PATH
ENV PATH=/root/.local/bin:$PATH

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=2)"

# Run with production server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**Key Features**:
- Multi-stage build (smaller final image)
- Non-root user (security)
- Health check (container orchestration)
- 4 workers (production scale)

---

### 2.2 Production Dockerfile (Frontend)

**File**: `frontend/Dockerfile.prod`

```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

---

### 2.3 Production Docker Compose

**File**: `docker-compose.prod.yml`

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - mentorled-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache (Optional)
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - mentorled-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: always
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ENVIRONMENT=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mentorled-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: always
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    depends_on:
      - backend
    networks:
      - mentorled-network

  # nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - mentorled-network

volumes:
  postgres_data:
  redis_data:

networks:
  mentorled-network:
    driver: bridge
```

---

### 2.4 nginx Configuration

**File**: `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    # Upstream servers
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL Certificates
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL Configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API routes
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Login endpoint (stricter rate limit)
        location /api/auth/login {
            limit_req zone=login_limit burst=3 nodelay;

            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Access logs
        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log;
    }
}
```

---

## 3. Environment Configuration

### 3.1 Production Environment Variables

**File**: `.env.production`

```bash
# ============================================
# ENVIRONMENT
# ============================================
ENVIRONMENT=production

# ============================================
# DATABASE
# ============================================
POSTGRES_USER=mentorled_prod
POSTGRES_PASSWORD=<STRONG_RANDOM_PASSWORD_64_CHARS>
POSTGRES_DB=mentorled_production
DATABASE_URL=postgresql+asyncpg://mentorled_prod:<PASSWORD>@db:5432/mentorled_production

# ============================================
# REDIS (Optional)
# ============================================
REDIS_PASSWORD=<STRONG_RANDOM_PASSWORD_32_CHARS>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# ============================================
# SECURITY
# ============================================
JWT_SECRET_KEY=<STRONG_RANDOM_SECRET_64_CHARS>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ============================================
# AI
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-<YOUR_KEY_HERE>

# ============================================
# CORS
# ============================================
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ============================================
# FRONTEND
# ============================================
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# ============================================
# MONITORING (Optional)
# ============================================
SENTRY_DSN=<YOUR_SENTRY_DSN>
LOG_LEVEL=INFO

# ============================================
# EMAIL (Optional - for notifications)
# ============================================
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<SENDGRID_API_KEY>
FROM_EMAIL=noreply@yourdomain.com
```

**Security Notes**:
- ✅ Never commit `.env.production` to git
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- ✅ Rotate secrets regularly
- ✅ Use different secrets for each environment

---

### 3.2 Generating Strong Secrets

```bash
# Generate 64-character random string (JWT secret)
openssl rand -hex 32

# Generate 32-character random string (passwords)
openssl rand -hex 16

# Or use Python
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 4. Database Production Setup

### 4.1 Managed PostgreSQL (Recommended)

**Option 1: AWS RDS PostgreSQL**
```bash
# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier mentorled-prod \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.3 \
    --master-username mentorled_admin \
    --master-user-password <STRONG_PASSWORD> \
    --allocated-storage 20 \
    --storage-type gp3 \
    --backup-retention-period 7 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "sun:04:00-sun:05:00" \
    --multi-az \
    --publicly-accessible false
```

**Option 2: Digital Ocean Managed Database**
- Use Digital Ocean Control Panel
- Select PostgreSQL 15
- Choose size (1GB RAM = $15/month)
- Enable automatic backups
- Configure trusted sources

---

### 4.2 Database Migrations

**Production migration workflow**:

```bash
# 1. Backup database BEFORE migration
pg_dump -h db.example.com -U mentorled_prod mentorled_production > backup_before_migration.sql

# 2. Test migration on staging
docker-compose -f docker-compose.staging.yml exec backend alembic upgrade head

# 3. If successful, apply to production
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Verify migration
docker-compose -f docker-compose.prod.yml exec backend alembic current
```

---

### 4.3 Connection Pooling

**Update**: `backend/app/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

DATABASE_URL = os.getenv("DATABASE_URL")

# Production: Use connection pooling
if os.getenv("ENVIRONMENT") == "production":
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,  # Disable SQL logging in production
        pool_size=20,  # Max number of connections
        max_overflow=10,  # Max overflow connections
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,  # Recycle connections after 1 hour
    )
else:
    # Development: Simpler config
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        pool_pre_ping=True,
    )
```

---

## 5. Security Hardening

### 5.1 HTTPS/SSL Setup

**Option 1: Let's Encrypt (Free)**

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (cron job)
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

**Option 2: Cloudflare (Free + CDN)**
- Point DNS to Cloudflare
- Enable "Full (strict)" SSL mode
- Cloudflare handles SSL certificates

---

### 5.2 Security Headers

Already configured in nginx (see Section 2.4):
- `Strict-Transport-Security`: Force HTTPS
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-XSS-Protection`: XSS filtering

---

### 5.3 Rate Limiting

nginx configuration (see Section 2.4):
- API endpoints: 10 requests/second
- Login endpoint: 5 requests/minute
- Burst allowance: 20 for API, 3 for login

---

### 5.4 Database Security

```sql
-- Create read-only user for analytics
CREATE USER analytics_reader WITH PASSWORD '<strong_password>';
GRANT CONNECT ON DATABASE mentorled_production TO analytics_reader;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_reader;

-- Revoke unnecessary permissions from app user
REVOKE CREATE ON SCHEMA public FROM mentorled_prod;
```

---

### 5.5 Secret Management

**Option 1: AWS Secrets Manager**

```python
import boto3
import json

def get_secret(secret_name: str) -> dict:
    """Fetch secret from AWS Secrets Manager."""
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Usage
secrets = get_secret('mentorled/production')
JWT_SECRET_KEY = secrets['jwt_secret_key']
ANTHROPIC_API_KEY = secrets['anthropic_api_key']
```

**Option 2: HashiCorp Vault**

```python
import hvac

client = hvac.Client(url='https://vault.example.com')
client.auth.approle.login(role_id='...', secret_id='...')

secrets = client.secrets.kv.v2.read_secret_version(path='mentorled/production')
JWT_SECRET_KEY = secrets['data']['data']['jwt_secret_key']
```

---

## 6. Monitoring & Logging

### 6.1 Application Logging

**Update**: `backend/app/main.py`

```python
import logging
import sys
from logging.handlers import RotatingFileHandler

# Configure logging
def setup_logging():
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # Create logger
    logger = logging.getLogger("mentorled")
    logger.setLevel(getattr(logging, log_level))

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)

    # File handler (production)
    if os.getenv("ENVIRONMENT") == "production":
        file_handler = RotatingFileHandler(
            "logs/mentorled.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(console_formatter)
        logger.addHandler(file_handler)

    logger.addHandler(console_handler)
    return logger

logger = setup_logging()

# Usage in code
logger.info("Application started")
logger.error("Database connection failed", exc_info=True)
```

---

### 6.2 Error Tracking (Sentry)

```bash
pip install sentry-sdk[fastapi]
```

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if os.getenv("ENVIRONMENT") == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,  # 10% of requests traced
        environment="production",
    )
```

---

### 6.3 Health Checks

**Endpoint**: `backend/app/main.py`

```python
from fastapi import status

@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    """Database health check."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unhealthy: {str(e)}"
        )
```

---

### 6.4 Metrics (Prometheus - Optional)

```bash
pip install prometheus-fastapi-instrumentator
```

```python
from prometheus_fastapi_instrumentator import Instrumentator

# Add to main.py
Instrumentator().instrument(app).expose(app)

# Metrics available at: /metrics
```

---

## 7. Performance Optimization

### 7.1 Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX idx_applicants_email ON applicants(email);
CREATE INDEX idx_applicants_status ON applicants(status);
CREATE INDEX idx_fellows_cohort ON fellow_profiles(cohort);
CREATE INDEX idx_placements_fellow_id ON placements(fellow_id);
CREATE INDEX idx_placements_opportunity_id ON placements(opportunity_id);

-- Composite index for common filter combinations
CREATE INDEX idx_applicants_role_status ON applicants(role, status);
```

---

### 7.2 Caching with Redis

```python
import redis.asyncio as redis
import json

# Redis client
redis_client = redis.from_url(os.getenv("REDIS_URL"))

async def get_applicants_cached():
    """Get applicants with caching."""
    # Try cache first
    cached = await redis_client.get("applicants:all")
    if cached:
        return json.loads(cached)

    # Cache miss - fetch from database
    result = await db.execute(select(Applicant))
    applicants = result.scalars().all()

    # Cache for 5 minutes
    await redis_client.setex(
        "applicants:all",
        300,
        json.dumps([a.to_dict() for a in applicants])
    )

    return applicants

# Invalidate cache on update
async def update_applicant(applicant_id, data):
    # Update database
    # ...

    # Invalidate cache
    await redis_client.delete("applicants:all")
```

---

### 7.3 Frontend Optimization

**Next.js Production Build**:

```json
// package.json
{
  "scripts": {
    "build": "next build",
    "start": "next start -p 3000"
  }
}
```

**next.config.js**:

```javascript
module.exports = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Compress images
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Enable SWC minification
  swcMinify: true,

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }
        ],
      },
    ];
  },
};
```

---

## 8. Backup & Disaster Recovery

### 8.1 Database Backups

**Automated Backups** (cron job):

```bash
#!/bin/bash
# backup.sh

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups"
DB_NAME="mentorled_production"
DB_USER="mentorled_prod"
DB_HOST="db.example.com"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -F c -b -v -f "$BACKUP_DIR/backup_$DATE.dump" $DB_NAME

# Compress
gzip "$BACKUP_DIR/backup_$DATE.dump"

# Delete backups older than 30 days
find $BACKUP_DIR -name "backup_*.dump.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/backup_$DATE.dump.gz" s3://mentorled-backups/
```

**Crontab**:
```bash
# Daily backup at 3 AM
0 3 * * * /path/to/backup.sh
```

---

### 8.2 Restore Procedure

```bash
# 1. Stop application
docker-compose -f docker-compose.prod.yml stop backend frontend

# 2. Restore database
gunzip -c backup_20251226_030000.dump.gz | pg_restore -h db.example.com -U mentorled_prod -d mentorled_production --clean

# 3. Run migrations (if needed)
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Restart application
docker-compose -f docker-compose.prod.yml start backend frontend
```

---

### 8.3 Disaster Recovery Plan

**RTO (Recovery Time Objective)**: < 1 hour
**RPO (Recovery Point Objective)**: < 24 hours

**Procedure**:
1. Database backup restored (last night's backup)
2. Application redeployed from git
3. Environment variables restored from secrets manager
4. DNS updated (if server changed)
5. SSL certificates re-issued (if needed)

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd backend
          pytest tests/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_SERVER_HOST }}
          username: ${{ secrets.PROD_SERVER_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/mentorled
            git pull origin main
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d --build
            docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
```

---

## 10. Production Checklist

### 10.1 Pre-Deployment Checklist

**Security**:
- [ ] All secrets rotated and stored securely
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] Security headers added
- [ ] Database user permissions restricted
- [ ] CORS configured for production domains only

**Configuration**:
- [ ] Environment variables set for production
- [ ] Database connection pooling enabled
- [ ] Logging configured and tested
- [ ] Error tracking (Sentry) configured
- [ ] Health check endpoints working

**Database**:
- [ ] Migrations tested on staging
- [ ] Indexes created for common queries
- [ ] Automated backups configured
- [ ] Restore procedure tested

**Monitoring**:
- [ ] Application logs collecting
- [ ] Database monitoring enabled
- [ ] Error alerts configured
- [ ] Uptime monitoring (Pingdom, UptimeRobot)

**Performance**:
- [ ] Frontend production build tested
- [ ] API response times acceptable (< 200ms)
- [ ] Database queries optimized
- [ ] Caching implemented (if needed)

**Documentation**:
- [ ] Deployment instructions updated
- [ ] Runbook for common issues
- [ ] Disaster recovery plan documented
- [ ] Team trained on production procedures

---

### 10.2 Post-Deployment Checklist

**Immediate (Day 1)**:
- [ ] All pages load correctly
- [ ] User can sign up and log in
- [ ] API endpoints responding
- [ ] Database connections stable
- [ ] SSL certificate valid
- [ ] No error spikes in logs

**Week 1**:
- [ ] Monitor error rates
- [ ] Check backup success
- [ ] Review performance metrics
- [ ] Verify automated tasks running
- [ ] Test disaster recovery procedure

**Month 1**:
- [ ] Review security logs
- [ ] Analyze performance trends
- [ ] Optimize slow queries
- [ ] Update dependencies
- [ ] Review and rotate secrets

---

## Summary (Part 6 - Final)

This final part covered **deployment and production readiness**:

✅ Deployment architecture (3 options: VPS, managed, hybrid)
✅ Docker production setup (multi-stage builds, security)
✅ Environment configuration (secrets, env vars)
✅ Database production setup (managed DB, connection pooling)
✅ Security hardening (HTTPS, headers, rate limiting, secrets)
✅ Monitoring & logging (Sentry, health checks, metrics)
✅ Performance optimization (indexing, caching, frontend)
✅ Backup & disaster recovery (automated backups, restore procedures)
✅ CI/CD pipeline (GitHub Actions)
✅ Production checklist (pre/post deployment)

---

## 🎉 Technical Documentation Complete!

**All 6 Parts**:
1. ✅ System Overview & Architecture
2. ✅ Authentication Flow Deep Dive
3. ✅ Backend APIs & Database
4. ✅ Frontend Components & State Management
5. ✅ AI Agents & Workflows
6. ✅ Deployment & Production Readiness

**Total Pages**: ~150 pages of comprehensive technical documentation

**Coverage**:
- System architecture
- Authentication & security
- Backend implementation (30+ endpoints)
- Frontend implementation (15+ components)
- AI agent integration (Claude API)
- Production deployment
- Best practices throughout

---

## Quick Reference

**Development**:
```bash
./RUN_ME.sh  # Start dev environment
```

**Production Deployment**:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

**Database Backup**:
```bash
./backup.sh
```

**View Logs**:
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
```

**Health Check**:
```bash
curl https://api.yourdomain.com/health
```

---

**Built by**: Claude Code
**Date**: December 26, 2025
**Platform**: MentorLed AI-Ops Platform
**Status**: ✅ Production-Ready
**Documentation**: Complete (6/6 Parts)

---

**Navigation**:
- Part 1 - System Overview & Architecture ✓
- Part 2 - Authentication Flow Deep Dive ✓
- Part 3 - Backend APIs & Database ✓
- Part 4 - Frontend Components & State Management ✓
- Part 5 - AI Agents & Workflows ✓
- **Current**: Part 6 - Deployment & Production Readiness ✓

**📚 END OF TECHNICAL GUIDE 📚**
