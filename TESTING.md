# MentorLed AI-Ops Platform - Testing Guide

## 🧪 Quick Validation

After running `docker-compose up -d` and seeding the database, validate the platform:

### 1. Backend Health Check

```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "MentorLed AI-Ops Platform"
}
```

### 2. API Documentation

Visit: http://localhost:8000/docs

You should see the interactive Swagger UI with all API endpoints.

### 3. Database Verification

```bash
docker-compose exec db psql -U mentorled -c "\dt"
```

**Expected Output:** List of all tables (cohorts, applicants, fellows, etc.)

### 4. List Seeded Data

**Get Cohorts:**
```bash
curl http://localhost:8000/api/cohorts/
```

**Get Applicants:**
```bash
curl http://localhost:8000/api/applicants/
```

You should see the seeded applicants (Alex, Maria, Kevin, Lisa, Tom).

## 🤖 Testing AI Agents

### Test 1: Screening Agent - Application Evaluation

1. **Get an applicant ID** from the seeded data:
   ```bash
   curl http://localhost:8000/api/applicants/ | jq '.[0].id'
   ```

2. **Trigger AI evaluation**:
   ```bash
   curl -X POST "http://localhost:8000/api/screening/application/evaluate" \
     -H "Content-Type: application/json" \
     -d '{
       "applicant_id": "<paste-applicant-id-here>"
     }'
   ```

3. **Expected Response**:
   - `evaluation_id`: UUID
   - `scores`: Object with completeness, portfolio_quality, role_fit, commitment_signals
   - `overall_score`: Number (0-100)
   - `eligibility`: "eligible", "not_eligible", or "review"
   - `reasoning`: AI explanation
   - `confidence`: 0.0-1.0
   - `recommended_action`: Next step

4. **Verify in Database**:
   ```bash
   docker-compose exec db psql -U mentorled -c \
     "SELECT overall_score, outcome, confidence FROM application_evaluations ORDER BY created_at DESC LIMIT 1;"
   ```

### Test 2: Screening Queue Status

```bash
curl http://localhost:8000/api/screening/queue
```

**Expected Response:**
```json
{
  "pending_applications": 4,
  "pending_microships": 1,
  "requires_review": 0,
  "total_in_queue": 5
}
```

### Test 3: Human Approval Workflow

1. **Get the evaluation ID** from Test 1

2. **Approve the evaluation**:
   ```bash
   curl -X POST "http://localhost:8000/api/screening/application/<evaluation-id>/approve?approved=true"
   ```

3. **Verify applicant status changed**:
   ```bash
   curl http://localhost:8000/api/applicants/<applicant-id>
   ```

   Status should be "eligible" or "not_eligible"

## 📊 Audit Log Verification

Check that AI calls are being logged:

```bash
docker-compose exec db psql -U mentorled -c \
  "SELECT action, ai_model, ai_prompt_tokens, ai_completion_tokens, ai_cost_usd
   FROM audit_log
   WHERE actor_type = 'ai_agent'
   ORDER BY timestamp DESC LIMIT 5;"
```

## 💰 Cost Tracking

View total AI costs:

```bash
docker-compose exec db psql -U mentorled -c \
  "SELECT
     action,
     COUNT(*) as calls,
     SUM(ai_prompt_tokens) as input_tokens,
     SUM(ai_completion_tokens) as output_tokens,
     ROUND(SUM(ai_cost_usd)::numeric, 6) as total_cost_usd
   FROM audit_log
   WHERE actor_type = 'ai_agent'
   GROUP BY action;"
```

## 🔍 Debugging

### View Backend Logs

```bash
docker-compose logs -f backend
```

### View Database Logs

```bash
docker-compose logs -f db
```

### Access PostgreSQL Directly

```bash
docker-compose exec db psql -U mentorled
```

Useful queries:
```sql
-- Count applicants by status
SELECT status, COUNT(*) FROM applicants GROUP BY status;

-- View all evaluations
SELECT a.name, e.overall_score, e.outcome, e.confidence
FROM application_evaluations e
JOIN applicants a ON e.applicant_id = a.id;

-- Check AI usage
SELECT ai_model, COUNT(*), SUM(ai_cost_usd) as cost
FROM audit_log
WHERE actor_type = 'ai_agent'
GROUP BY ai_model;
```

## ✅ Success Checklist

After completing all tests:

- [ ] Backend health check returns 200
- [ ] API docs accessible at /docs
- [ ] Database tables created (15+ tables)
- [ ] Seed data loaded (5 applicants, 1 cohort, 3 mentors)
- [ ] Screening agent evaluates application successfully
- [ ] Evaluation saved to database
- [ ] Audit log captures AI call with costs
- [ ] Human approval workflow updates applicant status
- [ ] Screening queue returns correct counts

## 🚨 Common Issues

### Issue: "Connection refused" to backend

**Solution:**
```bash
docker-compose down
docker-compose up -d
# Wait 30 seconds for services to start
docker-compose logs backend
```

### Issue: "ANTHROPIC_API_KEY not set"

**Solution:**
Check `.env` file has your API key:
```bash
cat .env | grep ANTHROPIC_API_KEY
```

### Issue: Database tables not created

**Solution:**
```bash
docker-compose exec backend python -c "
import asyncio
from app.database import engine, Base
async def create():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(create())
"
```

### Issue: Seed script fails

**Solution:**
```bash
# Drop and recreate tables
docker-compose down -v
docker-compose up -d
# Wait for DB to be ready
sleep 10
docker-compose exec backend python /app/../scripts/seed_data.py
```

## 🎯 Next Steps

Once all tests pass:

1. ✅ Backend is production-ready
2. Build frontend UI (Next.js templates provided)
3. Add real-time notifications
4. Implement GitHub integration for code analysis
5. Deploy to production

---

**Questions?** Check the main README.md or API docs at http://localhost:8000/docs
