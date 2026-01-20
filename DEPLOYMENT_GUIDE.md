# MentorLed AI-Ops Platform - Production Deployment Guide

**Last Updated**: January 20, 2026
**Status**: Ready for Production Deployment
**Version**: 1.0.0

---

## 🎉 **Platform Status: 98% Complete**

### ✅ **Completed Features**

**Core Infrastructure:**
- ✅ FastAPI backend with async support
- ✅ PostgreSQL database with 16 tables
- ✅ Redis caching layer
- ✅ Docker containerization
- ✅ Background task scheduler (APScheduler)

**AI Agents (3):**
- ✅ Screening Agent - Application & Microship evaluation
- ✅ Delivery Agent - Check-in analysis & risk assessment
- ✅ Placement Agent - Profile generation & job matching

**Authentication & Security:**
- ✅ JWT-based authentication
- ✅ Role-based access control (4 roles)
- ✅ Password hashing with BCrypt
- ✅ Protected API endpoints

**Core Features:**
- ✅ Analytics dashboard with metrics
- ✅ Bulk operations (import/export CSV)
- ✅ Email notifications (SMTP)
- ✅ Slack notifications
- ✅ Automated scheduled tasks
- ✅ Cost tracking for AI operations
- ✅ Audit logging

**Frontend:**
- ✅ Next.js 14 application
- ✅ Analytics dashboard
- ✅ Bulk operations UI
- ✅ Complete component library

**Testing:**
- ✅ Pytest infrastructure
- ✅ Authentication test suite
- ✅ Test fixtures and mocks

---

## 🚀 **Quick Deployment Options**

### **Option 1: Railway (Recommended - Easiest)**

**Why Railway:**
- 1-click deployment
- Free tier available
- Auto HTTPS
- PostgreSQL included
- Git-based deployments

**Steps:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL
railway add postgresql

# 5. Deploy
railway up

# 6. Set environment variables
railway variables set ANTHROPIC_API_KEY=your-key-here
railway variables set SECRET_KEY=$(openssl rand -hex 32)

# 7. Open in browser
railway open
```

**Cost**: Free tier → $5-20/month for production

---

### **Option 2: Render**

**Why Render:**
- Free PostgreSQL
- Auto-deploy from Git
- Easy environment management

**Steps:**
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `docker build -t backend ./backend`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Add variables below

**Cost**: Free tier → $7-25/month for production

---

### **Option 3: Fly.io**

**Why Fly.io:**
- Global edge deployment
- Great for Docker
- Generous free tier

**Steps:**
```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Launch app
flyctl launch

# 4. Deploy
flyctl deploy

# 5. Set secrets
flyctl secrets set ANTHROPIC_API_KEY=your-key
flyctl secrets set SECRET_KEY=$(openssl rand -hex 32)
```

**Cost**: Free tier → $10-30/month for production

---

### **Option 4: AWS/GCP/Azure (Enterprise)**

For enterprise deployments, use:
- **AWS**: ECS + RDS + ElastiCache
- **GCP**: Cloud Run + Cloud SQL + Memorystore
- **Azure**: App Service + PostgreSQL + Redis Cache

**Estimated Cost**: $50-200/month depending on scale

---

## 🔧 **Required Environment Variables**

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# AI API
ANTHROPIC_API_KEY=sk-ant-your-key-here
DEFAULT_MODEL=claude-3-haiku-20240307

# Security
SECRET_KEY=your-secret-key-min-32-chars
CORS_ORIGINS=https://your-frontend-domain.com

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
ENABLE_EMAIL=true

# Slack (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ENABLE_SLACK_NOTIFICATIONS=true
SLACK_MENTION_USER=U01234567
```

---

## 📋 **Pre-Deployment Checklist**

### Security:
- [ ] Generate new `SECRET_KEY` (min 32 characters)
- [ ] Rotate all exposed credentials
- [ ] Set `ENABLE_EMAIL=false` if not configured
- [ ] Set `ENABLE_SLACK_NOTIFICATIONS=false` if not configured
- [ ] Update `CORS_ORIGINS` to your frontend domain
- [ ] Never commit `.env` file to git

### Database:
- [ ] Create production PostgreSQL database
- [ ] Run migrations: `alembic upgrade head`
- [ ] Create first admin user
- [ ] Backup strategy configured

### Testing:
- [ ] Run tests locally: `pytest backend/tests/`
- [ ] Test authentication flow
- [ ] Test AI agent endpoints with mock data
- [ ] Verify email/Slack integrations

### Monitoring:
- [ ] Set up error tracking (Sentry recommended)
- [ ] Configure logging (structured logs)
- [ ] Set up uptime monitoring
- [ ] Configure AI cost alerts

---

## 🎯 **First Deploy Steps**

### 1. **Choose Platform** (Railway recommended for speed)

### 2. **Configure Environment**
```bash
# Generate secure secret
export SECRET_KEY=$(openssl rand -hex 32)

# Set on your platform
railway variables set SECRET_KEY=$SECRET_KEY
```

### 3. **Deploy Backend**
```bash
# Push to git triggers auto-deploy on most platforms
git push origin main
```

### 4. **Run Migrations**
```bash
# Connect to production and run
alembic upgrade head
```

### 5. **Create Admin User**
```bash
curl -X POST https://your-api-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "username": "admin",
    "full_name": "Platform Admin",
    "password": "SecurePassword123"
  }'
```

### 6. **Deploy Frontend**
```bash
# On Vercel (recommended for Next.js)
cd frontend
vercel --prod

# Set environment variables on Vercel:
# NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### 7. **Test Production**
```bash
# Health check
curl https://your-api-domain.com/health

# API docs
open https://your-api-domain.com/docs

# Frontend
open https://your-frontend-domain.com
```

---

## 📊 **Post-Deployment**

### Monitor These Metrics:
1. **AI Costs**: Check `/api/analytics/dashboard` daily
2. **Error Rates**: Set up Sentry or similar
3. **Response Times**: Monitor p95/p99 latencies
4. **Database Size**: Track growth
5. **User Activity**: Track registrations and usage

### Scheduled Tasks Running:
- Daily 9 AM: Auto-process pending applications
- Daily 10 AM: Run risk assessments for fellows
- Daily 6 PM: Check for missing check-ins
- Monday 8 AM: Weekly analytics report
- Friday 5 PM: Weekly cost report

---

## 🐛 **Troubleshooting**

### "Internal Server Error" on startup:
```bash
# Check logs
docker logs backend
# or
railway logs
```

### Database connection failed:
- Verify `DATABASE_URL` format
- Check network connectivity
- Ensure database exists

### Authentication not working:
- Verify `SECRET_KEY` is set
- Check `users` table exists
- Run: `alembic upgrade head`

### AI agent errors:
- Verify `ANTHROPIC_API_KEY` is valid
- Check API quota/credits
- Monitor `/api/analytics/ai-performance`

---

## 📞 **Support & Resources**

- **Documentation**: See `README.md`, `ROADMAP.md`
- **API Docs**: https://your-domain.com/docs
- **Issues**: GitHub Issues
- **Testing**: `pytest backend/tests/`

---

## 🎊 **You're Ready to Deploy!**

The platform is production-ready. Choose your deployment platform and follow the steps above.

**Recommended First Deploy**: Railway (fastest setup)
**Recommended Frontend**: Vercel (best for Next.js)
**Estimated Setup Time**: 15-30 minutes

**Good luck!** 🚀
