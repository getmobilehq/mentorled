# Testing Guide - Scaling Features

**Last Updated**: December 30, 2025

This guide walks you through testing all the new scaling features for the MentorLed AI-Ops Platform.

---

## Prerequisites

1. **Start the Backend**:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Create Admin User** (First time only):

   **Option A - Using Script**:
   ```bash
   cd backend
   source venv/bin/activate
   python scripts/create_admin.py
   ```

   **Option B - Using Signup API**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@mentorled.com",
       "password": "admin123",
       "full_name": "Admin User",
       "role": "admin"
     }' | jq
   ```

4. **Get Auth Token**:
   ```bash
   # Login to get access token
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@mentorled.com","password":"admin123"}' | jq

   # Save just the token
   export TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@mentorled.com","password":"admin123"}' | jq -r '.access_token')

   # Verify token is set
   echo $TOKEN
   ```

---

## 1. Testing Microship Challenge Evaluation

### 1.1 Create a Test Submission (API)

```bash
# Get an applicant ID first
APPLICANT_ID=$(curl -s http://localhost:8000/api/applicants \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Create a microship submission
curl -X POST http://localhost:8000/api/microship/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": "'$APPLICANT_ID'",
    "challenge_id": "MICROSHIP_TEST_001",
    "submission_url": "https://github.com/testuser/microship-challenge",
    "submission_type": "github",
    "submitted_at": "2025-12-30T10:00:00",
    "deadline": "2025-12-30T12:00:00",
    "on_time": true,
    "acknowledgment_time": "2025-12-29T14:30:00",
    "communication_log": [
      {
        "timestamp": "2025-12-29T14:30:00",
        "type": "email",
        "content": "Acknowledged. Will submit by tomorrow noon!"
      }
    ]
  }' | jq

# Save the submission ID
SUBMISSION_ID="<copy-from-response>"
```

### 1.2 Trigger AI Evaluation

```bash
# Evaluate the submission (this calls Claude AI)
curl -X POST http://localhost:8000/api/microship/evaluate/$SUBMISSION_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response**:
- `weighted_score`: 1.0-4.0
- `outcome`: "progress", "borderline", or "do_not_progress"
- `scores`: Object with 4 dimensions (each 1-4)
- `evidence`: Detailed evidence for each score
- `strengths` and `concerns`: Arrays of strings
- `confidence`: 0.0-1.0

### 1.3 Test Frontend UI

1. Navigate to `http://localhost:3002/microship`
2. You should see:
   - Stats dashboard (total, pending, evaluated, progress, borderline, do not progress)
   - Filter tabs (All/Pending/Evaluated)
   - Submissions table
3. Click **"Evaluate"** on a submission
4. Review the evaluation modal with:
   - Weighted score
   - Individual dimension scores
   - Evidence breakdown
   - Strengths, concerns, disqualifiers
   - AI confidence level

---

## 2. Testing Check-in System

### 2.1 Create a Test Check-in (API)

```bash
# Get a fellow ID first
FELLOW_ID=$(curl -s http://localhost:8000/api/fellows \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Create a check-in
curl -X POST http://localhost:8000/api/check-ins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "'$FELLOW_ID'",
    "week": 5,
    "accomplishments": "Completed the user authentication feature. Fixed 3 critical bugs. Helped teammate with state management.",
    "next_focus": "Working on the dashboard UI and integrating the API endpoints.",
    "blockers": "Struggling with responsive design for mobile. Need help understanding the routing logic.",
    "needs_help": "Would appreciate a code review on the auth implementation.",
    "self_assessment": "met",
    "collaboration_rating": "good",
    "energy_level": 7
  }' | jq

# Save the check-in ID
CHECKIN_ID="<copy-from-response>"
```

### 2.2 Trigger AI Analysis

```bash
# Analyze the check-in (this calls Claude AI)
curl -X POST http://localhost:8000/api/check-ins/analyze/$CHECKIN_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response**:
- `sentiment_score`: -1.0 to 1.0 (expect ~0.3 to 0.6 for this example)
- `risk_contribution`: 0.0 to 1.0 (expect ~0.2 to 0.4)
- `blockers_extracted`: ["responsive design", "routing logic"]
- `action_items`: Recommended actions for program managers
- `themes`, `concerns`, `positive_signals`: Arrays of insights
- `summary`: 2-3 sentence overview

### 2.3 Test Frontend UI

1. Navigate to `http://localhost:3002/check-ins`
2. You should see:
   - Stats (total, pending analysis, analyzed, at risk)
   - Filter tabs and week selector
   - Check-ins table with energy, self-assessment, collaboration, sentiment, risk level
3. Click **"Analyze"** on a check-in
4. Review the analysis modal with:
   - Sentiment and risk scores
   - AI summary
   - Key themes
   - Positive signals and concerns
   - Extracted blockers
   - Recommended actions

---

## 3. Testing Risk Detection System

### 3.1 Run Risk Assessment (API)

```bash
# Assess a fellow's risk (uses check-in data, milestones, warnings)
curl -X POST "http://localhost:8000/api/risk/assess/$FELLOW_ID?week=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response**:
- `risk_score`: 0.0-1.0 (weighted from multiple signals)
- `risk_level`: "on_track", "monitor", "at_risk", or "critical"
- `signals`: Object with all the data points used:
  - `check_in_frequency`: 0.0-1.0
  - `avg_sentiment`: -1.0 to 1.0
  - `avg_check_in_risk`: 0.0-1.0
  - `avg_energy`: 1-10
  - `collaboration_issues`: 0.0-1.0
  - `milestone_avg`: 0-4
  - `warnings_count`: integer
- `concerns`: Object with specific concerns identified
- `recommended_action`: Suggested next step

### 3.2 Get Cohort Dashboard (API)

```bash
# Get cohort ID
COHORT_ID=$(curl -s http://localhost:8000/api/cohorts \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Get risk dashboard for cohort
curl -X GET "http://localhost:8000/api/risk/dashboard/$COHORT_ID?week=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response**:
- `summary`: Count of fellows in each risk level
- `fellows`: Array of all fellows with risk data

### 3.3 Test Frontend UI

1. Navigate to `http://localhost:3002/risk`
2. You should see:
   - 4 interactive stat cards (On Track, Monitor, At Risk, Critical)
   - Cohort and week selectors
   - Filter tabs by risk level
   - Fellows table with:
     - Risk level badges and icons
     - Risk score progress bars
     - Milestone scores
     - Warning counts
3. Click on a stat card to filter by that risk level
4. Change week/cohort to see updates

---

## 4. Testing Warning Workflow System

### 4.1 Draft a Warning (API)

```bash
# Draft a first warning for an at-risk fellow
curl -X POST http://localhost:8000/api/warnings/draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "'$FELLOW_ID'",
    "level": "first",
    "concerns": [
      "Missed 2 out of 3 weekly check-ins",
      "Low energy levels (avg 3.5/10) indicating potential burnout",
      "Collaboration rating declined to struggling",
      "Milestone 1 score below expectations (2.1/4)"
    ]
  }' | jq
```

**Expected Response**:
- `draft.message`: Complete warning message (200+ characters)
- `draft.tone`: "warm_supportive", "firm_supportive", or "serious"
- `draft.key_points`: 2-4 main points covered
- `draft.requirements`: Specific actionable steps
- `draft.timeline`: Suggested review period (e.g., "2 weeks")
- `draft.recommended_followup`: Next action suggestion

### 4.2 Create and Issue Warning (API)

```bash
# Create the warning (not yet issued)
WARNING_RESPONSE=$(curl -X POST http://localhost:8000/api/warnings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "'$FELLOW_ID'",
    "level": "first",
    "concerns": [
      "Missed check-ins",
      "Low engagement"
    ],
    "requirements": [
      "Submit all weekly check-ins for the next 2 weeks",
      "Schedule a 1-on-1 meeting within 3 days"
    ],
    "draft_message": "<paste-the-AI-draft-message-here>"
  }')

WARNING_ID=$(echo $WARNING_RESPONSE | jq -r '.id')

# Optionally update the message
curl -X PUT http://localhost:8000/api/warnings/$WARNING_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "final_message": "Updated message with edits..."
  }' | jq

# Issue the warning
curl -X POST http://localhost:8000/api/warnings/$WARNING_ID/issue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"send_email": true}' | jq
```

### 4.3 List and View Warnings (API)

```bash
# Get all warnings for a fellow
curl -X GET http://localhost:8000/api/warnings/fellow/$FELLOW_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# List all unacknowledged warnings
curl -X GET "http://localhost:8000/api/warnings?acknowledged=false" \
  -H "Authorization: Bearer $TOKEN" | jq

# List all first warnings
curl -X GET "http://localhost:8000/api/warnings?level=first" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 5. End-to-End Workflow Test

### Scenario: At-Risk Fellow Workflow

**Week 1-3: Fellow is doing well**
1. Create check-ins with good metrics (energy 8/10, sentiment positive)
2. Analyze check-ins → Low risk scores
3. Run risk assessment → "on_track" or "monitor"

**Week 4: Issues emerge**
1. Create check-in with concerning metrics:
   - Energy: 3/10
   - Self-assessment: "below"
   - Collaboration: "struggling"
   - Blockers: Multiple issues
2. Analyze check-in → Negative sentiment, high risk contribution
3. Run risk assessment → "at_risk" level
4. Draft warning using the concerns from risk assessment
5. Review and issue warning

**Week 5: Fellow doesn't improve**
1. Create another check-in with similar/worse metrics
2. Analyze check-in
3. Run risk assessment → "critical" level
4. Draft FINAL warning (references previous warning)
5. Review and issue final warning

**Week 6: Fellow improves**
1. Create check-in with improved metrics
2. Analyze check-in → Better sentiment
3. Run risk assessment → Back to "monitor"
4. Record action taken on warnings

---

## 6. Integration Tests

### Test Full Pipeline for New Applicant

```bash
# 1. Create applicant (or use existing)
# 2. Create microship submission
# 3. Evaluate microship → outcome: "progress"
# 4. Accept applicant → becomes fellow
# 5. Create weekly check-ins (weeks 1-4)
# 6. Analyze each check-in
# 7. Run risk assessments
# 8. If at-risk, draft and issue warning
# 9. Track through to completion or removal
```

---

## 7. Verification Checklist

### Microship System
- [ ] Can create submissions via API
- [ ] AI evaluation returns valid scores (1-4)
- [ ] Weighted score calculated correctly (1.0-4.0)
- [ ] Outcome matches score (≥3.0 = progress)
- [ ] Frontend displays all submissions
- [ ] Can filter by pending/evaluated
- [ ] Evaluation modal shows complete results

### Check-in System
- [ ] Can create check-ins via API
- [ ] AI analysis returns sentiment and risk scores
- [ ] Blockers are automatically extracted
- [ ] Action items are relevant
- [ ] Frontend displays check-ins table
- [ ] Can filter by week and analysis status
- [ ] Analysis modal shows complete insights

### Risk Detection
- [ ] Risk assessment combines multiple signals
- [ ] Risk level matches score thresholds
- [ ] Concerns are specific and actionable
- [ ] Dashboard shows cohort summary
- [ ] Frontend filters work correctly
- [ ] Stats cards are interactive
- [ ] Progress bars display correctly

### Warning Workflow
- [ ] AI draft is empathetic and specific
- [ ] First vs final warnings have different tones
- [ ] Can edit draft before issuing
- [ ] Warning count increments on issue
- [ ] Can track acknowledgment
- [ ] List filters work (level, acknowledged)

---

## 8. Common Issues and Solutions

### Issue: "Incorrect email or password" when logging in
**Solution**: You need to create an admin user first. Use one of these methods:

**Method 1 - Run the admin creation script**:
```bash
cd backend
source venv/bin/activate
python scripts/create_admin.py
```

**Method 2 - Use the signup endpoint**:
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mentorled.com",
    "password": "admin123",
    "full_name": "Admin User",
    "role": "admin"
  }'
```

### Issue: "401 Unauthorized" during API calls
**Solution**: Token expired or not set. Re-login and get a new token:
```bash
export TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mentorled.com","password":"admin123"}' | jq -r '.access_token')
```

### Issue: "404 Fellow/Applicant not found"
**Solution**: The database is empty. You need to create test data manually or check if the database has been migrated properly:
```bash
cd backend
# Check migrations
alembic current
# If needed, run migrations
alembic upgrade head
```

### Issue: AI evaluation fails
**Solution**: Check that `ANTHROPIC_API_KEY` is set in backend `.env` file.

### Issue: Frontend won't compile
**Solution**:
```bash
cd frontend
rm -rf .next
npm install
npm run dev
```

### Issue: Database errors
**Solution**: Reset and migrate:
```bash
cd backend
alembic downgrade base
alembic upgrade head
python scripts/seed_data.py
```

---

## 9. API Documentation

Once backend is running, view interactive API docs at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

All endpoints are organized by tags:
- Microship
- Check-ins
- Risk
- Warnings
- Applicants
- Fellows
- Cohorts

---

## 10. Next Steps

After confirming all systems work:

1. **Performance Testing**:
   - Test with 100+ submissions
   - Test with 50+ check-ins per week
   - Monitor AI response times

2. **Edge Cases**:
   - Missing data (no check-ins, no milestones)
   - Extreme values (sentiment -1.0, risk 1.0)
   - Concurrent evaluations

3. **Production Prep**:
   - Set up email notifications for warnings
   - Configure rate limiting for AI calls
   - Set up monitoring and alerts
   - Create backup/restore procedures

---

**Questions or Issues?**
Refer to `SCALING_FEATURES_STATUS.md` for implementation details or `TECHNICAL_GUIDE_PART_*.md` for architecture documentation.
