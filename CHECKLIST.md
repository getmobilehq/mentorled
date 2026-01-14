# ✅ MentorLed AI-Ops Platform - Verification Checklist

Use this checklist to verify your platform is working correctly.

## 🔧 Pre-Setup

- [ ] Docker Desktop installed and running
- [ ] Anthropic API key obtained
- [ ] Terminal/command line access
- [ ] 8GB+ RAM available
- [ ] Ports 3000, 5432, 6379, 8000 available

## 📝 Configuration

- [ ] `.env` file created from `.env.example`
- [ ] `ANTHROPIC_API_KEY` set in `.env`
- [ ] `DATABASE_URL` correct in `.env`
- [ ] No syntax errors in `.env` (no spaces around `=`)

## 🚀 Startup

- [ ] `docker-compose up -d` runs without errors
- [ ] `docker-compose ps` shows 3 services running (db, redis, backend)
- [ ] Wait 30 seconds for services to initialize
- [ ] `curl http://localhost:8000/health` returns `{"status":"healthy"}`

## 💾 Database

- [ ] Database container running: `docker-compose ps db`
- [ ] Can connect: `docker-compose exec db psql -U mentorled -c "\dt"`
- [ ] Tables created (15+ tables shown)
- [ ] Seed script runs: `docker-compose exec backend python /app/../scripts/seed_data.py`
- [ ] Seed shows success: "✅ Database seeded successfully!"

## 📊 Data Verification

- [ ] Applicants loaded: `curl http://localhost:8000/api/applicants/ | jq 'length'` returns `5`
- [ ] Cohorts loaded: `curl http://localhost:8000/api/cohorts/ | jq 'length'` returns `1`
- [ ] Screening queue works: `curl http://localhost:8000/api/screening/queue` returns stats

## 🤖 AI Agent Testing

### Screening Agent

- [ ] Get applicant ID: `curl http://localhost:8000/api/applicants/ | jq '.[0].id' -r`
- [ ] AI evaluation works: `POST /api/screening/application/evaluate` with applicant_id
- [ ] Response contains:
  - [ ] `evaluation_id` (UUID)
  - [ ] `scores` object with 4 dimensions
  - [ ] `overall_score` (0-100)
  - [ ] `eligibility` (eligible/not_eligible/review)
  - [ ] `reasoning` (text explanation)
  - [ ] `confidence` (0.0-1.0)
  - [ ] `recommended_action`

### Database Persistence

- [ ] Evaluation saved: Check `application_evaluations` table
  ```bash
  docker-compose exec db psql -U mentorled -c \
    "SELECT overall_score, outcome FROM application_evaluations LIMIT 1;"
  ```
- [ ] Audit log created: Check `audit_log` table
  ```bash
  docker-compose exec db psql -U mentorled -c \
    "SELECT action, ai_model, ai_cost_usd FROM audit_log WHERE actor_type = 'ai_agent' LIMIT 1;"
  ```

## 🔍 Audit & Cost Tracking

- [ ] AI calls logged in `audit_log`
- [ ] Token counts recorded (`ai_prompt_tokens`, `ai_completion_tokens`)
- [ ] Costs calculated (`ai_cost_usd`)
- [ ] Can query costs:
  ```sql
  SELECT action, COUNT(*), SUM(ai_cost_usd)
  FROM audit_log
  WHERE actor_type = 'ai_agent'
  GROUP BY action;
  ```

## 👤 Human-in-the-Loop

- [ ] Can approve evaluation: `POST /api/screening/application/{eval_id}/approve?approved=true`
- [ ] Applicant status changes after approval
- [ ] Can override decision with reason
- [ ] `human_reviewed` flag set to true

## 📚 Documentation

- [ ] API docs accessible: http://localhost:8000/docs
- [ ] Interactive Swagger UI loads
- [ ] Can test endpoints in browser
- [ ] Health endpoint documented: http://localhost:8000/health

## 🔒 Security

- [ ] `.env` file NOT committed to git (in `.gitignore`)
- [ ] API key not visible in logs
- [ ] Database password secure
- [ ] CORS configured correctly

## 📈 Performance

- [ ] Backend responds within 2 seconds
- [ ] AI evaluation completes within 10 seconds
- [ ] Database queries fast (<100ms)
- [ ] No memory leaks (check `docker stats`)

## 🧪 Advanced Testing

### Multiple Evaluations

- [ ] Can evaluate multiple applicants in succession
- [ ] Each gets unique evaluation_id
- [ ] Costs accumulate in audit log

### Queue Management

- [ ] Screening queue counts update after evaluations
- [ ] Can filter by cohort_id
- [ ] Status categories correct

### Error Handling

- [ ] Invalid applicant ID returns 404
- [ ] Missing API key handled gracefully
- [ ] Malformed JSON rejected with clear error

## 🎯 Success Criteria

All of these should be ✅:

- [ ] ✅ Platform starts without errors
- [ ] ✅ Database has 15+ tables
- [ ] ✅ Seed data loaded (5 applicants)
- [ ] ✅ AI evaluation returns valid JSON
- [ ] ✅ Scores make sense (0-100 range)
- [ ] ✅ Reasoning is coherent and specific
- [ ] ✅ Confidence scores present (0.0-1.0)
- [ ] ✅ Audit logs capture AI usage
- [ ] ✅ Costs calculated per call
- [ ] ✅ Human approval workflow functions

## 🚨 Common Issues & Fixes

### Issue: Backend won't start
```bash
docker-compose logs backend
# Look for error messages
# Common: database not ready yet (wait 30s)
```

### Issue: Database connection failed
```bash
docker-compose down
docker-compose up -d db
sleep 10
docker-compose up -d backend
```

### Issue: API key error
```bash
# Check .env file
cat .env | grep ANTHROPIC_API_KEY
# Should show: ANTHROPIC_API_KEY=sk-ant-...
# No spaces around =
```

### Issue: Seed script fails
```bash
# Drop and recreate
docker-compose down -v
docker-compose up -d
sleep 30
docker-compose exec backend python /app/../scripts/seed_data.py
```

## 📊 Final Score

**Count your checkmarks above:**

- **50+ ✅** : Perfect! Platform fully operational
- **40-49 ✅** : Good! Minor issues to resolve
- **30-39 ✅** : Functional but needs attention
- **< 30 ✅** : Review TESTING.md for troubleshooting

---

## 🎓 What Success Looks Like

When everything is working, you should be able to:

1. Start the platform with one command
2. Seed sample data with one command
3. Call the API and get AI evaluations
4. See evaluations saved to database
5. View audit logs with costs
6. Approve/override AI decisions
7. Query the database directly
8. Access interactive API docs

**All of this works right now!** ✅

---

**Next**: Read BUILD_SUMMARY.md to understand the architecture and what's possible.
