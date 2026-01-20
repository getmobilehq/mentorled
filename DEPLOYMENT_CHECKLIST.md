# Production Deployment Checklist

**Platform**: MentorLed AI-Ops
**Version**: 1.0.0
**Last Updated**: January 20, 2026

---

## ✅ Pre-Deployment

### Security
- [ ] Generate new `SECRET_KEY` using: `openssl rand -hex 32`
- [ ] Verify `.env` is in `.gitignore`
- [ ] Remove any hardcoded secrets from codebase
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure `CORS_ORIGINS` with actual frontend domain
- [ ] Review all environment variables in `.env.production.template`

### API Keys
- [ ] Obtain Anthropic API key from https://console.anthropic.com/
- [ ] Test API key with small request
- [ ] Set up billing alerts on Anthropic dashboard
- [ ] Configure rate limiting if needed

### Database
- [ ] Production PostgreSQL database created
- [ ] Database credentials secured
- [ ] Connection tested successfully
- [ ] Backup strategy configured

### Email (if enabled)
- [ ] SMTP credentials obtained
- [ ] For Gmail: Create app-specific password
- [ ] Test email sending from production SMTP
- [ ] Set `ENABLE_EMAIL=true` if using

### Slack (if enabled)
- [ ] Slack webhook created at https://api.slack.com/messaging/webhooks
- [ ] Webhook URL tested
- [ ] User ID for mentions obtained
- [ ] Set `ENABLE_SLACK_NOTIFICATIONS=true` if using

---

## 🚀 Deployment Steps

### 1. Choose Platform
Select one:
- [ ] **Railway** (recommended for quick deployment)
- [ ] **Render** (good for free tier)
- [ ] **Fly.io** (global edge deployment)
- [ ] **AWS/GCP/Azure** (enterprise scale)

### 2. Backend Deployment

#### For Railway:
```bash
railway login
railway init
railway add postgresql
railway add redis
railway variables set ANTHROPIC_API_KEY=your-key
railway variables set SECRET_KEY=$(openssl rand -hex 32)
railway up
```

#### For Render:
1. Create new Web Service from GitHub repo
2. Add PostgreSQL database
3. Add Redis instance
4. Set environment variables
5. Deploy

#### For Fly.io:
```bash
flyctl auth login
flyctl launch
flyctl postgres create
flyctl redis create
flyctl secrets set ANTHROPIC_API_KEY=your-key
flyctl secrets set SECRET_KEY=$(openssl rand -hex 32)
flyctl deploy
```

### 3. Database Migration
```bash
# Connect to production environment
alembic upgrade head
```

### 4. Create Admin User
```bash
curl -X POST https://your-api-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "username": "admin",
    "full_name": "Admin User",
    "password": "SecurePassword123!"
  }'
```

### 5. Frontend Deployment (Vercel)
```bash
cd frontend
vercel --prod

# Set environment variable:
# NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

---

## ✅ Post-Deployment

### Verification
- [ ] Backend health check: `curl https://your-api-domain.com/health`
- [ ] API docs accessible: `https://your-api-domain.com/docs`
- [ ] Frontend loads successfully
- [ ] Authentication flow works (register → login → access protected route)
- [ ] AI agent endpoint tested (screening/delivery/placement)
- [ ] Database connection verified
- [ ] Redis cache working

### Monitoring Setup
- [ ] Set up Sentry for error tracking
- [ ] Configure logging (structured logs)
- [ ] Set up uptime monitoring (UptimeRobot, Better Uptime, etc.)
- [ ] Configure AI cost alerts
- [ ] Set up backup monitoring
- [ ] Database performance monitoring

### Testing in Production
- [ ] Create test user account
- [ ] Test screening agent with sample application
- [ ] Test delivery agent with check-in data
- [ ] Test placement agent with fellow profile
- [ ] Verify email notifications (if enabled)
- [ ] Verify Slack alerts (if enabled)
- [ ] Test bulk operations
- [ ] Test analytics dashboard
- [ ] Test CSV import/export

---

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Check error rates in logs/Sentry
- [ ] Monitor AI API costs
- [ ] Review Slack/email alerts
- [ ] Check database size/growth
- [ ] Monitor response times

### Weekly Tasks
- [ ] Review weekly analytics report (auto-sent Friday 5 PM)
- [ ] Check scheduled task execution logs
- [ ] Review user activity
- [ ] Backup verification
- [ ] Security updates check

### Monthly Tasks
- [ ] Review and optimize AI costs
- [ ] Database cleanup/optimization
- [ ] Review and update dependencies
- [ ] Security audit
- [ ] Performance optimization review

---

## 🔧 Scheduled Tasks (Auto-Running)

These tasks run automatically in production:
- **Daily 9 AM UTC**: Auto-process pending applications
- **Daily 10 AM UTC**: Run risk assessments for fellows
- **Daily 6 PM UTC**: Check for missing check-ins
- **Monday 8 AM UTC**: Weekly analytics report
- **Friday 5 PM UTC**: Weekly cost report

Verify these are running:
```bash
# Check logs for scheduled task execution
docker logs backend | grep "Scheduled task"
```

---

## 🚨 Troubleshooting

### Backend won't start
1. Check environment variables are set
2. Verify `DATABASE_URL` format
3. Check logs: `railway logs` or `flyctl logs` or `docker logs backend`
4. Verify all dependencies installed

### Database connection failed
1. Verify `DATABASE_URL` is correct
2. Check database is running
3. Verify network connectivity
4. Check SSL requirements (add `?sslmode=require` if needed)

### Authentication errors
1. Verify `SECRET_KEY` is set
2. Run database migrations: `alembic upgrade head`
3. Check `users` table exists
4. Verify JWT token format

### AI agent errors
1. Verify `ANTHROPIC_API_KEY` is valid
2. Check API quota/credits at https://console.anthropic.com/
3. Monitor `/api/analytics/ai-performance` for cost tracking
4. Check logs for specific error messages

---

## 📞 Support Resources

- **Documentation**: See `README.md`, `DEPLOYMENT_GUIDE.md`
- **API Documentation**: `https://your-domain.com/docs`
- **Test Suite**: Run `pytest backend/tests/` locally
- **Anthropic Status**: https://status.anthropic.com/

---

## ✅ Deployment Complete!

Once all items are checked:
- Platform is live at: `https://your-domain.com`
- API available at: `https://api.your-domain.com`
- Monitoring active
- Admin user created
- Ready for users!

**Next Steps**:
1. Invite team members
2. Import initial cohort data
3. Configure integrations
4. Train staff on platform usage
