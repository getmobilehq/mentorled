# 🚀 MentorLed AI-Ops Platform - 5-Minute Quick Start

Get the platform running in 5 minutes.

## Prerequisites

- ✅ Docker Desktop installed and running
- ✅ Anthropic API key ([Get one free](https://console.anthropic.com/))
- ✅ 8GB RAM minimum

## Step 1: Configure API Key (1 min)

```bash
cd /Users/josephagunbiade/Desktop/studio/mentorled
cp .env.example .env
```

Edit `.env` and add your API key:
```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

## Step 2: Start Services (2 min)

```bash
docker-compose up -d
```

Wait for services to start (~30 seconds). Check status:
```bash
docker-compose ps
```

All services should show "Up".

## Step 3: Seed Sample Data (1 min)

```bash
docker-compose exec backend python /app/../scripts/seed_data.py
```

You should see:
```
✅ Database seeded successfully!
📊 Summary:
   - Cohorts: 1
   - Mentors: 3
   - Teams: 2
   - Applicants: 5
   - Microship Submissions: 1
```

## Step 4: Test the AI Agent (1 min)

Get an applicant ID:
```bash
curl -s http://localhost:8000/api/applicants/ | jq '.[0].id' -r
```

Copy the ID, then run AI evaluation:
```bash
curl -X POST "http://localhost:8000/api/screening/application/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"applicant_id": "PASTE-ID-HERE"}' | jq '.'
```

You should see AI evaluation results with scores, reasoning, and recommendation!

## Step 5: Explore the API

Visit: **http://localhost:8000/docs**

You'll see interactive API documentation where you can:
- Browse all endpoints
- Test API calls directly
- View request/response schemas

## ✅ You're Done!

The platform is now running. Here's what you can do:

### Test More Agents

**List all applicants:**
```bash
curl http://localhost:8000/api/applicants/ | jq '.[] | {name, email, role, status}'
```

**Get screening queue status:**
```bash
curl http://localhost:8000/api/screening/queue | jq '.'
```

**View audit logs (AI costs):**
```bash
docker-compose exec db psql -U mentorled -c \
  "SELECT action, ai_model, ai_cost_usd FROM audit_log WHERE actor_type = 'ai_agent';"
```

### Access Services

- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Database**: `docker-compose exec db psql -U mentorled`

### Common Commands

```bash
# View backend logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Reset everything
docker-compose down -v
docker-compose up -d
```

## 🎯 What Just Happened?

1. ✅ PostgreSQL database created with 15 tables
2. ✅ Sample data loaded (5 applicants, 1 cohort, 3 mentors)
3. ✅ AI Screening Agent evaluated an application
4. ✅ Results saved to database with audit trail
5. ✅ Cost tracking recorded the API usage

## 📚 Next Steps

- **Read BUILD_SUMMARY.md** - Understand what was built
- **Read TESTING.md** - Run comprehensive tests
- **Read README.md** - Full documentation
- **Explore /docs** - Interactive API testing

## 🆘 Something Wrong?

**Services won't start:**
```bash
docker-compose down
docker-compose up -d
docker-compose logs
```

**Can't connect to backend:**
```bash
# Wait 30 seconds for startup
sleep 30
curl http://localhost:8000/health
```

**Database errors:**
```bash
docker-compose down -v  # Removes volumes
docker-compose up -d
# Wait, then re-run seed script
```

**API key not working:**
- Check .env file exists
- Ensure no spaces around `=`
- Verify key starts with `sk-ant-`
- Restart: `docker-compose restart backend`

---

**That's it!** You now have a production-ready AI-Ops platform running locally.

**Questions?** Check the comprehensive docs in README.md or TESTING.md
