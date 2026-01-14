# MentorLed AI-Ops Platform

> AI-augmented operations platform for scaling work-experience programs

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688.svg?style=flat&logo=FastAPI)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-316192?logo=postgresql)](https://www.postgresql.org/)
[![Claude AI](https://img.shields.io/badge/Claude-3.5_Sonnet-764ABC)](https://www.anthropic.com/claude)

## 🎯 Mission

Scale MentorLed from 150 to 5,000 participants annually by automating 85% of routine operations while keeping humans in the loop for critical decisions.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Screening │  │Delivery  │  │Placement │  │Dashboard │   │
│  │  Queue   │  │   Risk   │  │ Matching │  │Analytics │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AI Agents (Claude API)                   │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │  │
│  │  │ Screening  │ │ Delivery   │ │ Placement  │       │  │
│  │  │   Agent    │ │   Agent    │ │   Agent    │       │  │
│  │  └────────────┘ └────────────┘ └────────────┘       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Database Layer (SQLAlchemy)              │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Data Layer (PostgreSQL + Redis)                 │
└─────────────────────────────────────────────────────────────┘
```

## 🤖 AI Agents

### 1. Screening Agent
Evaluates applications and Microship submissions.
- **Model**: Claude 3 Haiku (high volume)
- **Function**: Scores applications, flags concerns, recommends progression
- **Output**: Evaluation scores, eligibility decision, confidence level

### 2. Delivery Agent
Monitors fellow progress and detects risk.
- **Model**: Claude 3 Haiku (analysis) + Sonnet (interventions)
- **Function**: Analyzes check-ins, calculates risk scores, drafts warnings
- **Output**: Risk assessments, intervention recommendations, warning drafts

### 3. Placement Agent
Generates profiles and matches opportunities.
- **Model**: Claude 3.5 Sonnet
- **Function**: Creates professional profiles, matches jobs, drafts introductions
- **Output**: Fellow profiles, match scores, introduction emails

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Anthropic API key ([Get one here](https://console.anthropic.com/))
- 8GB RAM minimum

### Setup

1. **Clone and configure**
   ```bash
   cd mentorled
   cp .env.example .env
   ```

2. **Add your Anthropic API key to `.env`**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Seed sample data**
   ```bash
   docker-compose exec backend python /app/../scripts/seed_data.py
   ```

5. **Access the platform**
   - **Frontend**: http://localhost:3000
   - **API Docs**: http://localhost:8000/docs
   - **Health Check**: http://localhost:8000/health

## 🧪 Testing the AI Agents

### Test Screening Agent

```bash
# Evaluate an application
curl -X POST "http://localhost:8000/api/screening/application/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": "<applicant-id-from-seed-data>"
  }'
```

### Test Delivery Agent

```bash
# Analyze a check-in (requires check-in data)
curl -X POST "http://localhost:8000/api/delivery/check-in/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "check_in_id": "<check-in-id>"
  }'
```

### Test Placement Agent

```bash
# Generate a fellow profile (requires fellow data)
curl -X POST "http://localhost:8000/api/placement/profile/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "fellow_id": "<fellow-id>"
  }'
```

## 📁 Project Structure

```
mentorled-ai-ops/
├── backend/
│   ├── app/
│   │   ├── agents/           # AI agents and prompts
│   │   ├── api/              # FastAPI routes
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   └── utils/            # Utilities (audit, GitHub)
│   ├── alembic/              # Database migrations
│   └── tests/                # Backend tests
├── frontend/
│   └── src/
│       ├── app/              # Next.js app router
│       ├── components/       # React components
│       └── lib/              # Frontend utilities
├── scripts/
│   └── seed_data.py          # Database seeder
└── docker-compose.yml        # Service orchestration
```

## 🗄️ Database Schema

### Core Entities

- **Cohorts**: Program cohorts with dates and status
- **Applicants**: Application data and screening results
- **Fellows**: Accepted participants with progress tracking
- **Teams**: Project teams with mentor assignments
- **Evaluations**: AI-generated application assessments
- **Risk Assessments**: Multi-signal fellow health monitoring
- **Warnings**: Intervention drafts and tracking
- **Decisions**: Audit trail of all decisions (AI + human)
- **Audit Log**: Complete log of AI API calls with cost tracking

## 🔑 Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/mentorled

# Redis
REDIS_URL=redis://localhost:6379

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-your-key-here
DEFAULT_MODEL=claude-3-5-sonnet-20241022
FAST_MODEL=claude-3-haiku-20240307

# Application
CORS_ORIGINS=http://localhost:3000
SECRET_KEY=your-secret-key

# Agent Thresholds
SCREENING_CONFIDENCE_THRESHOLD=0.7
RISK_ALERT_THRESHOLD=0.5
```

## 📊 Key Features

### ✅ Implemented

- [x] Screening Agent with application and Microship evaluation
- [x] Delivery Agent with check-in analysis and risk assessment
- [x] Placement Agent with profile generation and job matching
- [x] Complete database schema with audit logging
- [x] REST API with FastAPI
- [x] Human-in-the-loop approval workflows
- [x] Cost tracking for AI operations
- [x] Decision audit trail

### 🚧 To Extend

- [ ] Frontend UI implementation (Next.js pages provided as templates)
- [ ] Real-time notifications (Slack, email)
- [ ] GitHub integration for code analysis
- [ ] Advanced analytics dashboard
- [ ] Batch processing for high volume
- [ ] Webhook integrations

## 🧰 Development

### Running Backend Only

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Running Frontend Only

```bash
cd frontend
npm install
npm run dev
```

### Database Migrations

```bash
# Create a new migration
docker-compose exec backend alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback
docker-compose exec backend alembic downgrade -1
```

## 📈 Monitoring Costs

All AI calls are logged with token usage and cost estimates.

```sql
-- View AI costs by action
SELECT
    action,
    COUNT(*) as calls,
    SUM(ai_prompt_tokens) as total_input_tokens,
    SUM(ai_completion_tokens) as total_output_tokens,
    SUM(ai_cost_usd) as total_cost_usd
FROM audit_log
WHERE actor_type = 'ai_agent'
GROUP BY action
ORDER BY total_cost_usd DESC;
```

## 🛡️ Security Notes

- **API Keys**: Never commit `.env` file. Use `.env.example` as template
- **Database**: Use strong passwords in production
- **CORS**: Restrict `CORS_ORIGINS` to trusted domains
- **Auth**: Implement proper authentication (NextAuth template provided)

## 🤝 Contributing

This is a production system built for MentorLed. For contributions:

1. Fork the repository
2. Create a feature branch
3. Test with seed data
4. Submit a pull request with clear description

## 📝 License

Proprietary - © 2025 MentorLed

## 🆘 Support

- **Issues**: Check Docker logs `docker-compose logs -f`
- **Database**: `docker-compose exec db psql -U mentorled`
- **API**: http://localhost:8000/docs for interactive testing

## ✨ Success Criteria

The platform is working correctly when:

1. ✓ All three agents respond correctly to API calls
2. ✓ Evaluations are saved to database with audit logs
3. ✓ Human-in-the-loop workflows allow approval/override
4. ✓ Dashboard displays real-time queue and risk data
5. ✓ End-to-end flow works: Application → Evaluation → Decision

---

**Built with ❤️ for MentorLed** | Powered by Claude AI
