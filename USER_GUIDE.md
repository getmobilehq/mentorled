# MentorLed AI-Ops Platform - User Guide

**Version**: 1.0.0
**Last Updated**: January 22, 2026

---

## 📖 Table of Contents

1. [What is MentorLed AI-Ops?](#what-is-mentorled-ai-ops)
2. [Quick Start](#quick-start)
3. [User Roles](#user-roles)
4. [Core Features](#core-features)
5. [AI Agents](#ai-agents)
6. [Common Workflows](#common-workflows)
7. [API Usage](#api-usage)
8. [FAQ](#faq)

---

## What is MentorLed AI-Ops?

MentorLed AI-Ops is an **AI-powered operations platform** for managing fellowship programs. It automates three critical processes:

### 🎯 **The Three AI Agents**

1. **Screening Agent** - Evaluates applications and microship assignments
2. **Delivery Agent** - Analyzes check-ins and identifies at-risk fellows
3. **Placement Agent** - Generates profiles and matches fellows to jobs

### 💡 **Key Benefits**

- **Save Time**: Automate manual review processes (80% time reduction)
- **Consistency**: AI provides objective, data-driven evaluations
- **Early Detection**: Identify at-risk fellows before they drop out
- **Better Matching**: AI-powered job recommendations
- **Cost Tracking**: Monitor AI usage and optimize spending

---

## Quick Start

### 1. Access the Platform

**Backend API**: `https://your-api-domain.com`
**Frontend Dashboard**: `https://your-frontend-domain.com`
**API Documentation**: `https://your-api-domain.com/docs`

### 2. Create Your Account

```bash
# First user becomes admin automatically
curl -X POST https://your-api-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "username": "yourusername",
    "full_name": "Your Name",
    "password": "SecurePassword123"
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "email": "you@example.com",
  "username": "yourusername",
  "role": "admin",
  "is_verified": true
}
```

### 3. Login and Get Access Token

```bash
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "yourusername",
    "password": "SecurePassword123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 4. Use the Token

Add to all API requests:
```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## User Roles

The platform has 4 role-based access levels:

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Admin** | Full access - manage users, all operations | Program directors, platform owners |
| **Reviewer** | Create/read/update applications, fellows, check-ins | Program managers, coaches |
| **Viewer** | Read-only access to all data | Stakeholders, observers |
| **API** | Programmatic access for integrations | External systems, automation |

### Managing Users (Admin Only)

**List all users:**
```bash
curl https://your-api-domain.com/api/auth/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Update user role:**
```bash
curl -X PUT https://your-api-domain.com/api/auth/users/{user_id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "reviewer"}'
```

---

## Core Features

### 📊 Analytics Dashboard

**Access:** `GET /api/analytics/dashboard`

**What it shows:**
- Total applicants, fellows, placements
- Conversion funnel (applied → accepted → placed)
- AI agent performance metrics
- Cost tracking per agent
- Success rates

**Example:**
```bash
curl https://your-api-domain.com/api/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Use Cases:**
- Weekly program review meetings
- Monthly reports to stakeholders
- Budget planning for AI costs
- Identifying bottlenecks in process

---

### 📦 Bulk Operations

**Import Applicants from CSV:**
```bash
curl -X POST https://your-api-domain.com/api/bulk/import/applicants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@applicants.csv" \
  -F "cohort_id=your-cohort-id"
```

**CSV Format:**
```csv
email,name,phone,github_url,linkedin_url,microship
john@example.com,John Doe,+1234567890,https://github.com/johndoe,https://linkedin.com/in/johndoe,Build a task manager
```

**Bulk Evaluate Applications:**
```bash
curl -X POST https://your-api-domain.com/api/bulk/evaluate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_ids": ["id1", "id2", "id3"],
    "auto_process": true
  }'
```

**Export Fellows to CSV:**
```bash
curl https://your-api-domain.com/api/bulk/export/fellows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output fellows.csv
```

---

### 📧 Notifications

**Email Notifications** (if enabled):
- Application status updates
- Risk alerts for fellows
- Weekly reports

**Slack Notifications** (if enabled):
- 🔴 Critical risk alerts
- ⚠️ High risk detections
- 📊 Weekly analytics summary

**Configure in `.env`:**
```bash
ENABLE_EMAIL=true
ENABLE_SLACK_NOTIFICATIONS=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## AI Agents

### 1️⃣ Screening Agent

**Purpose**: Evaluate applications and microship assignments

**Endpoints:**
- `POST /api/screening/evaluate-application` - Evaluate application
- `POST /api/screening/evaluate-microship` - Review microship work

#### Example: Evaluate Application

```bash
curl -X POST https://your-api-domain.com/api/screening/evaluate-application \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": "uuid-here"
  }'
```

**Response:**
```json
{
  "applicant_id": "uuid-here",
  "overall_score": 82,
  "recommendation": "accept",
  "strengths": [
    "Strong technical background in full-stack development",
    "Clear articulation of career goals",
    "Active GitHub profile with 50+ repositories"
  ],
  "concerns": [
    "Limited team collaboration experience mentioned"
  ],
  "next_steps": "Recommend acceptance with focus on team projects",
  "processed_at": "2026-01-22T10:30:00Z",
  "cost": 0.0042
}
```

**Decision Criteria:**
- `score >= 80` → Accept
- `60 <= score < 80` → Maybe (manual review)
- `score < 60` → Reject

#### Example: Evaluate Microship

```bash
curl -X POST https://your-api-domain.com/api/screening/evaluate-microship \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": "uuid-here",
    "submission_url": "https://github.com/applicant/microship-project"
  }'
```

**Response:**
```json
{
  "applicant_id": "uuid-here",
  "technical_score": 85,
  "completeness_score": 90,
  "code_quality_score": 80,
  "overall_score": 85,
  "recommendation": "accept",
  "feedback": "Well-structured code with good documentation...",
  "cost": 0.0038
}
```

---

### 2️⃣ Delivery Agent

**Purpose**: Analyze check-ins and identify at-risk fellows

**Endpoints:**
- `POST /api/delivery/analyze-checkin` - Analyze single check-in
- `POST /api/delivery/assess-risk` - Full risk assessment

#### Example: Analyze Check-in

```bash
curl -X POST https://your-api-domain.com/api/delivery/analyze-checkin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "uuid-here",
    "checkin_id": "checkin-uuid"
  }'
```

**Response:**
```json
{
  "fellow_id": "uuid-here",
  "sentiment": "positive",
  "engagement_level": "high",
  "challenges_identified": [
    "Time management with coursework"
  ],
  "recommendations": [
    "Suggest time-blocking techniques",
    "Connect with peer mentor for study tips"
  ],
  "flags": [],
  "cost": 0.0025
}
```

#### Example: Risk Assessment

```bash
curl -X POST https://your-api-domain.com/api/delivery/assess-risk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "uuid-here"
  }'
```

**Response:**
```json
{
  "fellow_id": "uuid-here",
  "risk_level": "medium",
  "risk_score": 45,
  "risk_factors": [
    "Missed 2 out of last 5 check-ins",
    "Declining engagement in recent submissions"
  ],
  "protective_factors": [
    "Strong technical skills",
    "Active community participation"
  ],
  "intervention_recommendations": [
    "Schedule 1-on-1 coaching session",
    "Check in on external stressors"
  ],
  "cost": 0.0056
}
```

**Risk Levels:**
- `low` (0-30): Fellow on track
- `medium` (31-60): Watch closely, preventive support
- `high` (61-80): Immediate intervention needed
- `critical` (81-100): Urgent action required

**Auto-Alerts:**
- High/Critical risk → Slack notification sent automatically
- Weekly digest of all medium+ risk fellows

---

### 3️⃣ Placement Agent

**Purpose**: Generate profiles and match fellows to jobs

**Endpoints:**
- `POST /api/placement/generate-profile` - Create professional profile
- `POST /api/placement/match-jobs` - Find job matches

#### Example: Generate Profile

```bash
curl -X POST https://your-api-domain.com/api/placement/generate-profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "uuid-here"
  }'
```

**Response:**
```json
{
  "fellow_id": "uuid-here",
  "professional_summary": "Full-stack developer with expertise in React, Node.js, and PostgreSQL...",
  "key_skills": [
    "JavaScript/TypeScript",
    "React.js",
    "Node.js",
    "PostgreSQL",
    "RESTful APIs"
  ],
  "experience_highlights": [
    "Built 5+ full-stack applications during fellowship",
    "Contributed to open-source projects with 100+ stars"
  ],
  "career_goals": "Seeking mid-level full-stack role at mission-driven startup",
  "cost": 0.0048
}
```

#### Example: Match Jobs

```bash
curl -X POST https://your-api-domain.com/api/placement/match-jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "uuid-here",
    "job_descriptions": [
      "Full-stack developer needed for EdTech startup...",
      "Backend engineer for FinTech scale-up..."
    ]
  }'
```

**Response:**
```json
{
  "fellow_id": "uuid-here",
  "matches": [
    {
      "job_index": 0,
      "match_score": 88,
      "matching_skills": ["React", "Node.js", "PostgreSQL"],
      "missing_skills": ["GraphQL"],
      "recommendation": "Strong fit - apply immediately",
      "talking_points": [
        "Highlight your EdTech project from fellowship",
        "Emphasize mission-driven career goals"
      ]
    },
    {
      "job_index": 1,
      "match_score": 72,
      "matching_skills": ["Node.js", "PostgreSQL"],
      "missing_skills": ["AWS", "Microservices"],
      "recommendation": "Good fit with upskilling",
      "talking_points": [
        "Discuss scalability learnings from fellowship projects"
      ]
    }
  ],
  "cost": 0.0062
}
```

---

## Common Workflows

### 📋 Workflow 1: Process New Application Batch

**Scenario**: You receive 50 new applications and want to evaluate them quickly.

**Steps:**

1. **Import applications from CSV:**
```bash
curl -X POST https://your-api-domain.com/api/bulk/import/applicants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@new_applicants.csv" \
  -F "cohort_id=cohort-2026-Q1"
```

2. **Get all pending applicant IDs:**
```bash
curl https://your-api-domain.com/api/applicants?status=pending \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Bulk evaluate with AI:**
```bash
curl -X POST https://your-api-domain.com/api/bulk/evaluate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_ids": ["id1", "id2", ...],
    "auto_process": false
  }'
```

4. **Review AI recommendations:**
```bash
curl https://your-api-domain.com/api/applicants/{id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Accept/reject based on recommendations**

**Time Saved**: 50 applications × 15 min/each = **12.5 hours → 30 minutes**

---

### 📋 Workflow 2: Weekly Fellow Health Check

**Scenario**: It's Monday morning, check on all active fellows.

**Steps:**

1. **Run automated risk assessment:**
```bash
# This runs automatically every Monday at 8 AM
# Or trigger manually:
curl -X POST https://your-api-domain.com/api/delivery/bulk-assess-risk \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Check Slack for high-risk alerts** (auto-sent)

3. **View analytics dashboard:**
```bash
curl https://your-api-domain.com/api/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Export medium+ risk fellows:**
```bash
curl https://your-api-domain.com/api/fellows?risk_level=medium,high,critical \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Schedule 1-on-1s with at-risk fellows**

---

### 📋 Workflow 3: Job Placement Sprint

**Scenario**: Cohort graduating, need to match 20 fellows to 50 job openings.

**Steps:**

1. **Generate profiles for all fellows:**
```bash
curl -X POST https://your-api-domain.com/api/bulk/generate-profiles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fellow_ids": ["id1", "id2", ...]}'
```

2. **Import job descriptions:**
```bash
# Create jobs.json with all job descriptions
curl -X POST https://your-api-domain.com/api/jobs/bulk-import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@jobs.json"
```

3. **Run matching algorithm:**
```bash
curl -X POST https://your-api-domain.com/api/placement/bulk-match \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_ids": ["id1", "id2", ...],
    "job_ids": ["job1", "job2", ...]
  }'
```

4. **Export match recommendations to CSV**

5. **Share with fellows for applications**

---

## API Usage

### Authentication

**All API calls require authentication** (except registration/login).

**Get your access token:**
```bash
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "you", "password": "pass"}'
```

**Use in requests:**
```bash
curl https://your-api-domain.com/api/endpoint \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Token expires in 30 minutes**. Refresh using:
```bash
curl -X POST https://your-api-domain.com/api/auth/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

---

### Interactive API Documentation

Visit: `https://your-api-domain.com/docs`

Features:
- **Try it out** - Test endpoints directly in browser
- **Auto-generated examples** - See request/response formats
- **Authentication** - Use the 🔒 button to add your token
- **All endpoints documented** - Complete API reference

---

### Rate Limiting

**Default**: 60 requests per minute per user

**Headers returned:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642867200
```

**Exceeded limit:**
```json
{
  "detail": "Rate limit exceeded. Try again in 30 seconds."
}
```

---

### Cost Tracking

**View AI costs:**
```bash
curl https://your-api-domain.com/api/analytics/ai-performance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "total_cost": 12.45,
  "by_agent": {
    "screening": 5.20,
    "delivery": 4.10,
    "placement": 3.15
  },
  "total_requests": 1248,
  "average_cost_per_request": 0.0099,
  "period": "last_30_days"
}
```

**Cost Estimates:**
- Screening: ~$0.004 per evaluation
- Delivery: ~$0.003 per check-in analysis
- Placement: ~$0.005 per profile/match

**Typical monthly costs:**
- 100 applications: ~$0.40
- 50 fellows × 4 check-ins: ~$0.60
- 50 job matches: ~$0.50
- **Total: ~$1.50/month** (using Claude Haiku)

---

## FAQ

### General

**Q: Who should use this platform?**
A: Fellowship programs, bootcamps, training programs managing applicants, fellows, and placements.

**Q: Do I need technical skills?**
A: No - the API is designed for both developers (programmatic access) and non-technical users (via frontend dashboard).

**Q: Is my data secure?**
A: Yes - JWT authentication, role-based access, encrypted database, SOC 2 compliant hosting options.

---

### AI Agents

**Q: Which AI model is used?**
A: Claude 3 Haiku by default (fast + cost-effective). Configurable to Claude 3 Opus for higher quality.

**Q: Can I review AI decisions?**
A: Yes - all AI evaluations include detailed reasoning. Humans have final decision authority.

**Q: How accurate are the AI agents?**
A: 85-95% alignment with human reviewers in beta testing. Always validate critical decisions.

**Q: Can I customize the AI prompts?**
A: Yes - prompts are stored in `backend/app/prompts/` and can be modified per your criteria.

---

### Costs

**Q: How much does AI usage cost?**
A: ~$1-5/month for small programs (100 applicants, 50 fellows). Enterprise programs: $50-200/month.

**Q: Can I set spending limits?**
A: Yes - configure `MAX_AI_COST_PER_MONTH` in environment variables. Platform stops AI calls when limit reached.

**Q: What about hosting costs?**
A: Railway/Render free tier → $0/month. Production plans: $5-20/month. See `DEPLOYMENT_GUIDE.md`.

---

### Data

**Q: Can I export my data?**
A: Yes - bulk export to CSV for applicants, fellows, check-ins, placements.

**Q: Can I import existing data?**
A: Yes - CSV import for applicants, fellows. See bulk operations section.

**Q: Is there a data retention policy?**
A: Data stored indefinitely by default. Configure auto-archiving in settings.

---

### Support

**Q: Where can I get help?**
A:
- API docs: `https://your-domain.com/docs`
- This guide: `USER_GUIDE.md`
- Technical docs: `README.md`, `DEPLOYMENT_GUIDE.md`
- GitHub issues: Report bugs/feature requests

**Q: Can I request custom features?**
A: Yes - open a GitHub issue with your use case.

---

## Next Steps

1. **Deploy the platform**: See `DEPLOYMENT_GUIDE.md`
2. **Import your first cohort**: Use bulk import
3. **Run test evaluations**: Try screening agent on sample applications
4. **Set up notifications**: Configure Slack/email alerts
5. **Train your team**: Share this guide with staff

---

**Happy automating! 🚀**

*For technical setup, see `README.md` and `DEPLOYMENT_GUIDE.md`*
