# MentorLed Platform Bible

> Comprehensive technical documentation for the MentorLed AI-Ops Platform.
> Last updated: February 14, 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Infrastructure & DevOps](#3-infrastructure--devops)
4. [Database Schema](#4-database-schema)
5. [Backend API Reference](#5-backend-api-reference)
6. [AI Agents & LLM Integration](#6-ai-agents--llm-integration)
7. [Services & Background Jobs](#7-services--background-jobs)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Email System](#9-email-system)
10. [Frontend Application](#10-frontend-application)
11. [Frontend Pages Reference](#11-frontend-pages-reference)
12. [UI Component Library](#12-ui-component-library)
13. [API Client Reference](#13-api-client-reference)
14. [Business Logic & Workflows](#14-business-logic--workflows)
15. [Configuration & Environment](#15-configuration--environment)
16. [Seed Data](#16-seed-data)
17. [Known Constraints & Gotchas](#17-known-constraints--gotchas)

---

## 1. Platform Overview

**MentorLed** is an AI-powered program management platform for running work-experience accelerators for early-career tech talent. It manages the complete lifecycle from applicant screening through fellowship delivery to job placement.

### What It Does

- **Applicant Pipeline**: Receive applications, AI-screen candidates, manage cohorts
- **Challenge System**: Create role-specific technical challenges, collect public submissions, auto-evaluate with AI
- **Fellowship Delivery**: Track fellows via weekly check-ins, AI-powered risk assessment, automated warning system
- **Placement**: Generate professional profiles, match fellows to job opportunities, draft introductions
- **Analytics**: Conversion funnels, risk dashboards, AI performance metrics, cohort comparisons

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.11) |
| **Frontend** | Next.js 14 (TypeScript, React 18) |
| **Database** | PostgreSQL 15 (async via SQLAlchemy 2.0 + asyncpg) |
| **Cache** | Redis 7 |
| **AI** | Anthropic Claude (Haiku for scoring, Sonnet for evaluation) |
| **Email** | aiosmtplib + Jinja2 templates |
| **Scheduling** | APScheduler |
| **Containerization** | Docker Compose |
| **UI** | Tailwind CSS + Radix UI |

### Default Credentials

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | -- |
| API Docs (Swagger) | http://localhost:8000/docs | -- |
| Frontend | http://localhost:3000 | -- |
| Admin Login | http://localhost:3000/login | `admin@mentorled.com` / `admin123` |

---

## 2. Architecture

### High-Level Architecture

```
                     +------------------+
                     |   Next.js 14     |
                     |   Frontend       |
                     |   (Port 3000)    |
                     +--------+---------+
                              |
                     /api/* proxy (next.config.js)
                              |
                     +--------v---------+
                     |   FastAPI        |
                     |   Backend        |
                     |   (Port 8000)    |
                     +---+------+---+---+
                         |      |   |
              +----------+  +---+   +----------+
              |             |                   |
     +--------v---+  +-----v------+   +--------v-------+
     | PostgreSQL  |  |   Redis    |   | Anthropic API  |
     | (Port 5432) |  | (Port 6379)|   | (Claude LLMs)  |
     +-------------+  +------------+   +----------------+
```

### Directory Structure

```
mentorled/
  backend/
    app/
      agents/           # AI agent classes + prompts
        prompts/         # System & user prompts for each agent
      api/               # FastAPI route handlers (16 files)
      middleware/         # Auth middleware (JWT)
      models/            # SQLAlchemy ORM models (19 models)
      schemas/           # Pydantic request/response schemas
      services/          # Business logic services
      templates/
        emails/          # Jinja2 email templates (HTML)
      utils/             # Email service, template registry, helpers
      config.py          # Settings (env-based)
      database.py        # Async SQLAlchemy engine
      main.py            # FastAPI app, lifespan, CORS
    scripts/
      seed_data.py       # Comprehensive seed script
    Dockerfile
    requirements.txt
  frontend/
    app/                 # Next.js App Router pages
      login/             # Login page (unauthenticated)
      submit/[token]/    # Public challenge submission
      [13 protected pages]
    components/
      auth/              # ProtectedRoute
      layout/            # AppLayout, Sidebar, Header
      ui/                # Button, Badge, Card, Modal, Table, etc.
    contexts/            # AuthContext
    lib/                 # API client (axios)
    types/               # TypeScript interfaces
    next.config.js       # API proxy config
    tailwind.config.ts   # Brand colors
  scripts/
    seed_data.py         # Simple seed script (Docker)
  docker-compose.yml
  .env / .env.example
```

### Key Architecture Decisions

1. **Async Everything**: SQLAlchemy async sessions, aiosmtplib, asyncpg -- the entire backend is async
2. **No Migration in Dev**: Uses `create_all()` on startup. Won't add columns to existing tables. Use `docker-compose down -v` to recreate
3. **Client-Side Auth**: No Next.js middleware -- auth handled via React context + ProtectedRoute component
4. **API Proxy**: `next.config.js` proxies `/api/*` to backend, enabling same-origin requests
5. **AI Cost Tracking**: Every LLM call is audit-logged with token counts and cost calculations
6. **Hybrid Email Templates**: Disk defaults + DB overrides for runtime customization without deploys

---

## 3. Infrastructure & DevOps

### Docker Compose

**File**: `docker-compose.yml`

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15 | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache & sessions |
| `backend` | Custom (Dockerfile) | 8000 | FastAPI API server |

The frontend is **not** in Docker Compose -- it runs separately via `npm run dev`.

**Startup Order**: db (healthcheck) -> redis (healthcheck) -> backend

**Volumes**: `postgres_data` persists database across restarts.

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim
# Installs: build-essential, libpq-dev
# Copies requirements.txt, installs deps
# Runs: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Running the Platform

```bash
# Start backend + database + redis
docker-compose up -d

# Start frontend (separate terminal)
cd frontend && npm run dev

# Seed data (if using Docker)
# Runs automatically via scripts/seed_data.py

# Seed data (standalone)
cd backend && python scripts/seed_data.py
```

### Frontend Dependencies

- **Next.js 14.2.0** + React 18.3.0
- **UI**: Radix UI (Dialog, Dropdown, Select, Tabs, Toast)
- **Icons**: lucide-react
- **HTTP**: axios
- **Dates**: date-fns
- **Styling**: Tailwind CSS + PostCSS

### Backend Dependencies

- **FastAPI 0.109.0** + Uvicorn 0.27.0
- **SQLAlchemy 2.0.25** (async) + asyncpg
- **Pydantic 2.5.3** (with email-validator)
- **Anthropic 0.18.0** (Claude API)
- **python-jose 3.3.0** + bcrypt (JWT auth)
- **APScheduler 3.10.4** (background jobs)
- **aiosmtplib 3.0.1** + Jinja2 (emails)
- **pandas 2.1.4** (CSV/XLSX export)
- **Redis 5.0.1** (cache)

---

## 4. Database Schema

### Entity Relationship Overview

```
Cohort (root)
  |-- Applicant (many) ---> ApplicationEvaluation (many)
  |       |                  MicroshipSubmission (many) --> Challenge (via challenge_ref)
  |       |--- Fellow (one-to-one)
  |                |-- CheckIn (many, unique per week)
  |                |-- RiskAssessment (many, unique per week)
  |                |-- Warning (many)
  |                |-- FellowProfile (many, versioned)
  |                |-- PlacementMatch (many) --> JobOpportunity
  |-- Team (many) --> Mentor
  |-- ChallengeTrackConfig (many) --> Challenge (many)

User (auth, separate from domain entities)
Decision (generic audit log)
AuditLog (AI usage tracking)
EmailTemplateOverride (template customization)
```

### Models Reference (19 Total)

#### User (`users`)
Authentication entity, separate from applicants/fellows.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique, indexed |
| username | String | Unique, indexed |
| full_name | String | Required |
| hashed_password | String | bcrypt |
| role | Enum | ADMIN, REVIEWER, VIEWER, API |
| is_active | Boolean | Default: true |
| is_verified | Boolean | Default: false |
| last_login | DateTime | Nullable |
| api_key | String | Nullable, for API access |

#### Cohort (`cohorts`)
Root organizational entity. A cohort represents a program batch.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String(100) | Required |
| start_date | Date | Required |
| end_date | Date | Required |
| status | Enum | PLANNING -> APPLICATIONS_OPEN -> MICROSHIP -> ACTIVE -> COMPLETED |
| target_size | Integer | Default: 100 |

**Relationships**: applicants, teams, fellows (cascade delete)

#### Applicant (`applicants`)
People who apply to a cohort. Unique per (cohort_id, email).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| cohort_id | UUID | FK -> Cohort |
| email | String(255) | Required |
| name | String(255) | Required |
| role | Enum | PRODUCT_MANAGER, PRODUCT_DESIGNER, FRONTEND, BACKEND, QA |
| status | Enum | 10 statuses (see below) |
| portfolio_url | Text | Optional |
| github_url | Text | Optional |
| linkedin_url | Text | Optional |
| project_description | Text | Optional |
| time_commitment | Boolean | Default: false |
| source | String(50) | Optional |
| applied_at | DateTime | Auto |

**Status Enum**: `APPLIED` -> `SCREENING` -> `ELIGIBLE` / `NOT_ELIGIBLE` -> `MICROSHIP_PENDING` -> `MICROSHIP_SUBMITTED` -> `MICROSHIP_EVALUATED` -> `ACCEPTED` / `REJECTED` / `WITHDRAWN`

**Relationships**: cohort, evaluations, microship_submissions, fellow (one-to-one)

#### Fellow (`fellows`)
Accepted applicants who are in the program. One-to-one with Applicant.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| applicant_id | UUID | FK -> Applicant |
| cohort_id | UUID | FK -> Cohort |
| team_id | UUID | FK -> Team (nullable) |
| role | String(50) | Required |
| status | Enum | ACTIVE, ON_TRACK, MONITOR, AT_RISK, CRITICAL, WARNING, FINAL_WARNING, REMOVED, GRADUATED, GRADUATED_DISTINCTION, DID_NOT_GRADUATE |
| microship_score | Numeric(3,2) | Optional |
| current_risk_score | Numeric(3,2) | Updated by risk service |
| current_risk_level | String(20) | on_track/monitor/at_risk/critical |
| milestone_1_score | Numeric(3,2) | Optional |
| milestone_2_score | Numeric(3,2) | Optional |
| milestone_3_score | Numeric(3,2) | Optional |
| final_score | Numeric(3,2) | Optional |
| warnings_count | Integer | Default: 0 |

**Important**: Fellow has no `name` or `email` field. These come from the related Applicant via `selectinload(Fellow.applicant)`.

**Relationships**: applicant, cohort, team, check_ins, risk_assessments, warnings, profiles, placement_matches

#### Challenge (`challenges`)
Technical challenges assigned to cohorts with optional track configuration.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| cohort_id | UUID | FK -> Cohort (SET NULL on delete) |
| title | String(255) | Required |
| description | Text | Required |
| requirements | JSONB | Default: [] |
| role_type | String(50) | Default: "all" |
| submission_types | JSONB | Default: [] |
| deadline | DateTime | Required |
| status | String(20) | DRAFT -> ACTIVE -> CLOSED -> ARCHIVED |
| share_token | String(64) | Unique, auto-generated (URL-safe) |
| auto_evaluate | Boolean | Default: false |
| duration_hours | Integer | Optional |
| sequence_number | Integer | Optional (position in track) |
| track_config_id | UUID | FK -> ChallengeTrackConfig |

#### ChallengeTrackConfig (`challenge_track_configs`)
Defines how many challenges exist per role in a cohort. Unique per (cohort_id, role_type).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| cohort_id | UUID | FK -> Cohort |
| role_type | String(50) | e.g., "backend", "frontend" |
| total_challenges | Integer | Required |

#### MicroshipSubmission (`microship_submissions`)
Challenge submissions from applicants.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| applicant_id | UUID | FK -> Applicant |
| challenge_id | String(50) | Legacy identifier (nullable) |
| challenge_ref | UUID | FK -> Challenge (nullable) |
| submission_url | Text | Optional |
| submission_type | String(20) | github, figma, document, other |
| submitted_at | DateTime | Optional |
| deadline | DateTime | Optional |
| on_time | Boolean | Optional |
| communication_log | JSONB | Default: [] |
| raw_analysis | JSONB | AI evaluation results (nullable) |

#### ApplicationEvaluation (`application_evaluations`)
AI evaluation results for applications and microship submissions.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| applicant_id | UUID | FK -> Applicant |
| evaluation_type | Enum | APPLICATION, MICROSHIP |
| scores | JSONB | Required |
| overall_score | Numeric(5,2) | Optional |
| outcome | String(30) | Optional |
| reasoning | Text | Optional |
| evidence | JSONB | Optional |
| flags | ARRAY[Text] | Optional |
| confidence | Numeric(3,2) | 0.0 - 1.0 |
| model_used | String(50) | Claude model identifier |
| ai_generated | Boolean | Default: false |
| human_reviewed | Boolean | Default: false |
| human_override | Boolean | Default: false |
| override_reason | Text | Optional |

#### CheckIn (`check_ins`)
Weekly check-ins from fellows. Unique per (fellow_id, week).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| fellow_id | UUID | FK -> Fellow |
| week | Integer | Required |
| accomplishments | Text | Optional |
| next_focus | Text | Optional |
| blockers | Text | Optional |
| needs_help | Text | Optional |
| self_assessment | String(20) | EXCEEDED, MET, BELOW |
| collaboration_rating | String(20) | GREAT, GOOD, OKAY, STRUGGLING |
| energy_level | Integer | 1-10 scale |
| analysis | JSONB | AI analysis results |
| sentiment_score | Numeric(3,2) | -1.0 to +1.0 |
| risk_contribution | Numeric(3,2) | 0.0 to 1.0 |
| blockers_extracted | ARRAY[Text] | AI-extracted |
| action_items | ARRAY[Text] | AI-extracted |

#### RiskAssessment (`risk_assessments`)
Weekly risk assessments for fellows. Unique per (fellow_id, week).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| fellow_id | UUID | FK -> Fellow |
| week | Integer | Required |
| risk_level | Enum | ON_TRACK, MONITOR, AT_RISK, CRITICAL |
| risk_score | Numeric(3,2) | 0.0 - 1.0 |
| signals | JSONB | Weighted signal breakdown |
| concerns | JSONB | AI-identified concerns |
| recommended_action | String(30) | Optional |
| action_taken | String(50) | Recorded by admin |
| actioned_by | UUID | Admin who took action |

#### Warning (`warnings`)
Performance warnings issued to fellows.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| fellow_id | UUID | FK -> Fellow |
| level | Enum | FIRST, FINAL |
| concerns | ARRAY[Text] | Required |
| requirements | ARRAY[Text] | Required |
| evidence_refs | ARRAY[UUID] | Optional |
| draft_message | Text | AI-drafted (nullable) |
| final_message | Text | Edited by human (nullable) |
| issued_at | DateTime | Nullable |
| issued_by | UUID | Admin who issued |
| acknowledged | Boolean | Default: false |
| acknowledged_at | DateTime | Nullable |
| outcome | String(20) | PENDING, RESOLVED, ESCALATED, REMOVAL |

#### Mentor (`mentors`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String(255) | Unique |
| name | String(255) | Required |
| stack | Enum | PRODUCT, DESIGN, FRONTEND, BACKEND, QA, GENERAL |
| capacity | Integer | Default: 2 |
| status | Enum | ACTIVE, INACTIVE |

#### Team (`teams`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| cohort_id | UUID | FK -> Cohort |
| name | String(100) | Required |
| brief_title | String(200) | Optional |
| brief_description | Text | Optional |
| mentor_id | UUID | FK -> Mentor (nullable) |
| slack_channel | String(100) | Optional |
| github_repo | Text | Optional |
| status | Enum | FORMING, ACTIVE, COMPLETED |

#### FellowProfile (`fellow_profiles`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| fellow_id | UUID | FK -> Fellow |
| headline | String(200) | Optional |
| summary | Text | Optional |
| skills | JSONB | Optional |
| projects | JSONB | Optional |
| linkedin_summary | Text | Optional |
| version | Integer | Default: 1 |

#### JobOpportunity (`job_opportunities`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| employer_name | String(200) | Required (NOT `company`) |
| employer_contact_email | String(255) | Optional |
| title | String(200) | Required |
| description | Text | Optional |
| requirements | ARRAY[Text] | Optional |
| preferred_skills | ARRAY[Text] | Optional |
| experience_level | String(20) | ENTRY, JUNIOR, MID |
| location | String(100) | Optional |
| remote_ok | Boolean | Default: true |
| status | Enum | ACTIVE, FILLED, CLOSED |

#### PlacementMatch (`placement_matches`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| fellow_id | UUID | FK -> Fellow |
| opportunity_id | UUID | FK -> JobOpportunity |
| match_score | Integer | Optional |
| match_reasoning | Text | Optional |
| status | Enum | SUGGESTED -> APPROVED -> INTRODUCED -> INTERVIEWING -> OFFERED -> HIRED/REJECTED/WITHDRAWN |
| introduction_draft | Text | AI-generated |
| introduction_sent_at | DateTime | Nullable |

#### Decision (`decisions`)
Generic decision audit trail.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| entity_type | Enum | APPLICANT, FELLOW, TEAM |
| entity_id | UUID | Generic reference |
| decision_type | String(50) | Required |
| decision | String(50) | Required |
| rationale | Text | Required |
| ai_assisted | Boolean | Default: false |
| ai_recommendation | String(50) | Optional |
| ai_confidence | Numeric(3,2) | Optional |

#### AuditLog (`audit_log`)
AI usage and cost tracking.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| timestamp | DateTime | Indexed |
| actor_type | Enum | USER, SYSTEM, AI_AGENT |
| action | String(100) | Indexed |
| entity_type | String(50) | Indexed |
| entity_id | UUID | Indexed |
| details | JSONB | Optional |
| ai_model | String(50) | Optional |
| ai_prompt_tokens | Integer | Optional |
| ai_completion_tokens | Integer | Optional |
| ai_cost_usd | Numeric(10,6) | Optional |

#### EmailTemplateOverride (`email_template_overrides`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| template_key | String(100) | Unique, indexed |
| subject | String(500) | Optional |
| content | Text | Required (Jinja2 HTML) |

---

## 5. Backend API Reference

**Base URL**: `http://localhost:8000/api`
**Total Endpoints**: 84+

### Auth (`/auth`) -- 9 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register user (first becomes admin) |
| POST | `/auth/login` | No | Login with email/password, returns JWT tokens |
| POST | `/auth/refresh` | No | Refresh access token |
| GET | `/auth/me` | Yes | Get current user |
| PUT | `/auth/me` | Yes | Update current user profile |
| POST | `/auth/change-password` | Yes | Change password |
| GET | `/auth/users` | Admin | List all users |
| POST | `/auth/users` | Admin | Create user |
| PUT | `/auth/users/{id}` | Admin | Update user |

### Applicants (`/applicants`) -- 5 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/applicants` | No | Create applicant |
| GET | `/applicants` | No | List (filters: cohort_id, status) |
| GET | `/applicants/{id}` | No | Get one |
| PATCH | `/applicants/{id}` | No | Update |
| GET | `/applicants/{id}/journey` | No | Full timeline (applied -> fellow_started) |

### Cohorts (`/cohorts`) -- 5 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/cohorts` | No | Create cohort |
| GET | `/cohorts` | No | List all |
| GET | `/cohorts/{id}` | No | Get one |
| PUT | `/cohorts/{id}` | No | Update (name, dates, target_size) |
| PATCH | `/cohorts/{id}/status` | No | Status transition (validated) |

**Status Transitions**: planning -> applications_open -> microship -> active -> completed

### Screening (`/screening`) -- 4 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/screening/application/evaluate` | No | AI evaluate application |
| POST | `/screening/microship/evaluate` | No | AI evaluate microship submission |
| GET | `/screening/queue` | No | Queue status (pending counts) |
| POST | `/screening/application/{id}/approve` | No | Human review with override |

### Challenges (`/challenges`) -- 10 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/challenges` | No | Create challenge |
| GET | `/challenges` | No | List (filters: cohort_id, status, track_config_id) |
| GET | `/challenges/{id}` | No | Get one |
| PUT | `/challenges/{id}` | No | Update |
| PATCH | `/challenges/{id}/status` | No | Status change (draft/active/closed/archived) |
| GET | `/challenges/{id}/submissions` | No | List submissions for challenge |
| GET | `/challenges/analytics` | No | Aggregated analytics |
| POST | `/challenges/generate-content` | No | AI generate title + description |
| GET | `/challenges/public/{token}` | No | Public challenge view |
| POST | `/challenges/public/{token}/submit` | No | Public submission |

### Track Configs (`/track-configs`) -- 6 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/track-configs` | No | Create (cohort + role + total) |
| GET | `/track-configs` | No | List for cohort with counts |
| GET | `/track-configs/{id}` | No | Get one |
| PUT | `/track-configs/{id}` | No | Update total_challenges |
| DELETE | `/track-configs/{id}` | No | Delete (only if no linked challenges) |
| GET | `/track-configs/cohort/{id}/summary` | No | All tracks with ordered challenges |

### Microship (`/microship`) -- 6 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/submissions` | No | Create submission |
| GET | `/submissions/{id}` | No | Get one |
| GET | `/submissions/applicant/{id}` | No | All for applicant |
| GET | `/submissions` | No | List all (paginated) |
| POST | `/evaluate/{id}` | No | AI evaluate submission |
| POST | `/evaluate-bulk` | No | Bulk evaluate all unevaluated |

### Fellows (`/fellows`) -- 6 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/fellows` | No | Create fellow |
| GET | `/fellows` | No | List (filters: cohort_id, status, team_id) |
| GET | `/fellows/{id}` | No | Get one (with applicant name/email) |
| PATCH | `/fellows/{id}` | No | Update |
| GET | `/fellows/{id}/check-ins` | No | Fellow's check-ins |
| GET | `/fellows/{id}/risk` | No | Latest risk assessment |

### Check-Ins (`/check-ins`) -- 7 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/check-ins` | Any User | Create check-in |
| GET | `/check-ins/{id}` | Any User | Get one |
| GET | `/check-ins/fellow/{id}` | Any User | Fellow's check-ins |
| GET | `/check-ins` | Admin | List all (filters: week, cohort_id) |
| POST | `/check-ins/analyze/{id}` | Admin | AI analyze check-in |
| GET | `/check-ins/week/{week}` | Admin | All for specific week |
| POST | `/check-ins/analyze-bulk` | Admin | Bulk analyze unanalyzed |

### Risk (`/risk`) -- 6 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/risk/assess/{id}` | Admin | Assess fellow at week |
| GET | `/risk/fellow/{id}` | Any User | Risk history |
| GET | `/risk/dashboard/{cohort_id}` | Admin | Cohort risk dashboard |
| GET | `/risk/assessment/{id}` | Any User | Specific assessment |
| POST | `/risk/action/{id}` | Admin | Record action taken |
| GET | `/risk/week/{week}` | Admin | All assessments for week |

### Warnings (`/warnings`) -- 8 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/warnings/draft` | Admin | AI draft warning |
| POST | `/warnings` | Admin | Create warning |
| GET | `/warnings/{id}` | Any User | Get one |
| GET | `/warnings/fellow/{id}` | Any User | Fellow's warnings |
| PUT | `/warnings/{id}` | Admin | Update before issuing |
| POST | `/warnings/{id}/issue` | Admin | Issue warning (sends email) |
| POST | `/warnings/{id}/acknowledge` | Any User | Fellow acknowledges |
| GET | `/warnings` | Admin | List all (filters: cohort_id, level, acknowledged) |

### Delivery (`/delivery`) -- 6 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/delivery/check-in/analyze` | No | AI analyze check-in |
| POST | `/delivery/risk/assess` | No | Risk assessment |
| POST | `/delivery/warning/draft` | No | AI draft warning |
| POST | `/delivery/warning/{id}/approve` | No | Approve/reject warning |
| GET | `/delivery/risk/dashboard` | No | Risk dashboard data |
| GET | `/delivery/warnings/{fellow_id}` | No | Fellow's warnings |

### Placement (`/placement`) -- 10 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/placement/profile/generate` | No | AI generate professional profile |
| POST | `/placement/opportunities/match` | No | AI match fellow to jobs |
| POST | `/placement/introduction/draft` | No | AI draft intro email |
| GET | `/placement/profiles` | No | List profiles (filter: cohort_id) |
| GET | `/placement/opportunities` | No | List opportunities (filter: status) |
| POST | `/placement/opportunities` | No | Create opportunity |
| PUT | `/placement/opportunities/{id}` | No | Update opportunity |
| PATCH | `/placement/opportunities/{id}/status` | No | Update status |
| GET | `/placement/matches/{fellow_id}` | No | Fellow's matches |
| PATCH | `/placement/matches/{id}/status` | No | Progress match status |

**Match Status Flow**: suggested -> approved -> introduced -> interviewing -> offered -> hired/rejected/withdrawn

### Analytics (`/analytics`) -- 5 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/dashboard` | No | Overview (applicants, fellows, evaluations, risk, AI) |
| GET | `/analytics/conversion-funnel` | No | Pipeline funnel |
| GET | `/analytics/ai-performance` | No | AI confidence, override rate |
| GET | `/analytics/trends` | No | 30-day time-series |
| GET | `/analytics/cohort-comparison` | No | Side-by-side cohort metrics |

### Bulk Operations (`/bulk`) -- 5 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bulk/evaluate` | No | Batch evaluate applications |
| POST | `/bulk/status/update` | No | Batch status update |
| POST | `/bulk/import/applicants` | No | Import CSV |
| GET | `/bulk/export/applicants` | No | Export CSV |
| GET | `/bulk/export/fellows` | No | Export CSV |

### Email Templates (`/email-templates`) -- 7 endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/email-templates` | No | List with metadata |
| GET | `/email-templates/config` | No | SMTP status |
| GET | `/email-templates/{key}` | No | Template detail |
| GET | `/email-templates/{key}/preview` | No | Rendered preview |
| PUT | `/email-templates/{key}` | No | Update (validates Jinja2) |
| DELETE | `/email-templates/{key}/override` | No | Revert to default |
| POST | `/email-templates/{key}/test-send` | No | Send test email |

---

## 6. AI Agents & LLM Integration

### LLM Client (Core Wrapper)

**File**: `backend/app/agents/llm_client.py`

All AI agents use a shared `LLMClient` singleton that wraps the Anthropic API.

```python
class LLMClient:
    async def complete(
        prompt: str,
        system: Optional[str],
        model: str = settings.DEFAULT_MODEL,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        json_response: bool = True,
        metadata: Optional[Dict]  # for audit logging
    ) -> Dict:
        # Returns: { content: parsed_json, usage: {input_tokens, output_tokens, model} }
```

**Features**:
- Automatic JSON parsing (handles markdown code blocks)
- Audit logging of every call (model, tokens, cost, entity)
- Robust error handling with fallback parsing

### Model Strategy

| Use Case | Model | Temperature | Rationale |
|----------|-------|-------------|-----------|
| Application screening | claude-3-haiku | 0.2 | Fast, consistent scoring |
| Microship evaluation | claude-sonnet-4 | 0.2 | Higher capability for code review |
| Check-in analysis | claude-sonnet-4 | 0.3 | Nuanced sentiment analysis |
| Challenge generation | claude-3-haiku | 0.7 | Creative content |
| Risk assessment | claude-3-haiku | 0.3 | Consistent scoring |
| Warning drafting | claude-3-haiku | 0.3 | Formal, conservative |
| Profile generation | claude-3-haiku | 0.4 | Balanced creativity |
| Job matching | claude-3-haiku | 0.2 | Consistent scoring |
| Introduction drafting | claude-3-haiku | 0.4 | Balanced creativity |

### Cost Tracking

- Input: $3.00 per 1M tokens (Haiku)
- Output: $15.00 per 1M tokens (Haiku)
- Every call logs to `audit_log` table with token counts and USD cost

### Agent 1: Screening Agent

**File**: `backend/app/agents/screening_agent.py`

**Application Evaluation**:
- Scores 4 dimensions: completeness, portfolio_quality, role_fit, commitment_signals
- Weighted average -> overall_score
- Outcome: `eligible` / `review` / `not_eligible`
- Includes: reasoning, flags, confidence (0-1), recommended_action

**Microship Evaluation** (routes by role):
- Code submissions: technical execution, execution discipline, professional behavior, instruction following
- PRD submissions: product thinking, structure, user stories
- Design submissions: visual design, UX thinking, deliverables
- Scores on 1-4 scale (3 = target)
- Weighted score -> outcome: `progress` (3.0+) / `borderline` (2.5-2.9) / `do_not_progress` (<2.5)
- Disqualifier checks: late submission, plagiarism, wrong challenge, unprofessional

### Agent 2: Microship Evaluator

**File**: `backend/app/agents/microship_evaluator.py`

Uses **Sonnet 4** for higher capability. Same evaluation framework as ScreeningAgent's microship evaluation but with more detailed analysis.

### Agent 3: Challenge Generator

**File**: `backend/app/agents/challenge_generator.py`

Generates challenge briefs based on:
- Role type (backend/frontend/designer/PM/QA)
- Duration (6-48 hours, scope scales accordingly)
- Sequence position (1=foundational, 2=intermediate, 3+=advanced)
- Existing challenges (to avoid duplication)
- PM's working title/description (refines if provided)

Output: `{ title, description, requirements: string[] }`

### Agent 4: Delivery Agent

**File**: `backend/app/agents/delivery_agent.py`

**Check-in Analysis**: Sentiment (-1 to +1), risk contribution (0 to 1), blockers, action items

**Risk Assessment** (8 weighted signals):

| Signal | Weight |
|--------|--------|
| GitHub activity | 20% |
| Check-in risk contribution | 15% |
| Check-in sentiment | 15% |
| Attendance | 15% |
| Check-in completeness | 10% |
| Self assessment | 10% |
| Mentor flags | 10% |
| Trend | 5% |

Risk levels: on_track (<0.25) / monitor (0.25-0.50) / at_risk (0.50-0.75) / critical (>=0.75)

**Warning Drafting**: Formal warning document based on concerns, evidence, and fellow context.

### Agent 5: Check-in Analyzer

**File**: `backend/app/agents/check_in_analyzer.py`

Uses **Sonnet 4** for nuanced analysis. Returns: sentiment_score, risk_contribution, blockers_extracted, action_items, themes, concerns, positive_signals, confidence, summary.

### Agent 6: Placement Agent

**File**: `backend/app/agents/placement_agent.py`

- **Profile Generation**: Creates professional profile from fellow data (skills, projects, scores)
- **Job Matching**: Scores fellow against opportunities, returns match_score + reasoning
- **Introduction Drafting**: Writes employer introduction email

---

## 7. Services & Background Jobs

### Scheduler Service

**File**: `backend/app/services/scheduler.py`

Uses APScheduler, starts with app lifespan.

| Job | Schedule | Description |
|-----|----------|-------------|
| `process_pending_applications` | Daily 9:00 AM | Auto-evaluate applications pending 24+ hours |
| `daily_risk_assessment` | Daily 10:00 AM | Risk score all active fellows |
| `check_missing_checkins` | Daily 6:00 PM | Alert on missing weekly check-ins |
| `check_deadline_reminders` | Daily 9:30 AM | Email 24h deadline reminders |
| `weekly_analytics_report` | Monday 8:00 AM | Generate metrics report |
| `weekly_cost_report` | Friday 5:00 PM | AI usage cost summary |

### Auto-Evaluate Service

**File**: `backend/app/services/auto_evaluate.py`

Triggered via `BackgroundTasks` after challenge submission when `auto_evaluate=True`.

Flow:
1. Get submission + applicant
2. Route to evaluator by role (code/PRD/design)
3. Store results in `submission.raw_analysis`
4. Auto-progress applicant status
5. Send evaluation result email (score * 25 = 0-100 scale)

### Applicant Status Service

**File**: `backend/app/services/applicant_status.py`

Automatic status progression:
- On **submission**: `applied`/`screening` -> `microship_pending`
- On **evaluation**: `microship_pending` -> `microship_completed`
- **Never** auto-accepts or auto-rejects (manual decision required)

### Risk Service

**File**: `backend/app/services/risk_service.py`

Comprehensive risk scoring combining 8 weighted signals. Returns risk_score, risk_level, signals breakdown, concerns, and recommended_action.

---

## 8. Authentication & Authorization

### JWT Token Flow

```
Login (email/password)
  -> Backend validates credentials
  -> Returns { access_token, refresh_token, user }
  -> Frontend stores in localStorage

API Request
  -> Axios interceptor adds Authorization: Bearer {access_token}
  -> Backend validates via get_current_user()

401 Response
  -> Axios interceptor catches
  -> POSTs to /auth/refresh with refresh_token
  -> Gets new access_token
  -> Retries original request
  -> If refresh fails -> clears tokens, redirects to /login
```

### User Roles

| Role | Permissions |
|------|------------|
| ADMIN | Full system access, user management |
| REVIEWER | Can evaluate and review |
| VIEWER | Read-only access |
| API | Programmatic access (via api_key) |

### Auth Middleware Functions

**File**: `backend/app/middleware/auth.py`

- `get_current_user(credentials)` -- validates JWT, returns User
- `get_current_active_user(current_user)` -- ensures user is active
- `require_role(*allowed_roles)` -- dependency factory
- `require_admin` -- shortcut for admin-only endpoints
- `require_reviewer` -- shortcut for reviewer+ endpoints

### Protected Routes (Backend)

Currently, most routes are unauthenticated. Auth-protected routes:
- **Check-ins**: create/view (any user), list/analyze (admin)
- **Risk**: assess/dashboard (admin), view (any user)
- **Warnings**: draft/create/issue (admin), view/acknowledge (any user)

### Protected Routes (Frontend)

`AppLayout` wraps all children in `ProtectedRoute`, which:
1. Checks `isAuthenticated` from AuthContext
2. Shows loading spinner while validating
3. Redirects to `/login` if not authenticated
4. Optionally checks user role

---

## 9. Email System

### Email Service

**File**: `backend/app/utils/email.py`

- Async SMTP via aiosmtplib
- Jinja2 template rendering
- **Hybrid storage**: checks DB override first, falls back to disk template
- Controlled by `ENABLE_EMAIL` env var (default: false)

### Email Templates (6 Total)

| Key | Category | Trigger |
|-----|----------|---------|
| `evaluation_result` | Screening | After AI evaluation completes |
| `fellow_warning` | Delivery | When admin approves/issues warning |
| `risk_alert` | Delivery | When fellow hits at_risk/critical |
| `challenge_activated` | Challenges | When challenge status -> active |
| `deadline_reminder` | Challenges | 24h before challenge deadline (scheduler) |
| `submission_confirmation` | Challenges | After public submission |

### Template Variables

Each template has documented variables with types and sample data. Templates use Jinja2 syntax and extend a shared `base.html` with MentorLed branding, blue accent color, and responsive layout.

### SMTP Configuration

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=your-email@example.com
SMTP_FROM_NAME=MentorLed
ENABLE_EMAIL=false
```

---

## 10. Frontend Application

### Layout Hierarchy

```
RootLayout (app/layout.tsx)
  -> Providers (AuthProvider)
    -> Page Routes
      -> /login (unauthenticated)
      -> /submit/[token] (public, unauthenticated)
      -> AppLayout (all other pages)
          -> ProtectedRoute
          -> Sidebar (fixed, 256px)
          -> Header (fixed, 64px)
          -> Main Content (scrollable, max-width 1152px)
```

### Sidebar Navigation (15 items)

| # | Icon | Label | Route |
|---|------|-------|-------|
| 1 | LayoutDashboard | Dashboard | `/` |
| 2 | Calendar | Cohorts | `/cohorts` |
| 3 | ClipboardCheck | Screening | `/screening` |
| 4 | Users | Applicants | `/applicants` |
| 5 | Flag | Challenges | `/challenges` |
| 6 | Target | Microship | `/microship` |
| 7 | TrendingUp | Fellows | `/fellows` |
| 8 | Activity | Check-ins | `/check-ins` |
| 9 | AlertTriangle | Risk Dashboard | `/risk` |
| 10 | Shield | Delivery | `/delivery` |
| 11 | BarChart3 | Analytics | `/analytics` |
| 12 | Layers | Bulk Operations | `/bulk-operations` |
| 13 | Briefcase | Placement | `/placement` |
| 14 | Mail | Email Templates | `/email-templates` |
| 15 | Settings | Settings | `/settings` |

Active state: light green background (#f0fdf4), green text (#16a34a)

### State Management

- **Global**: AuthContext (user, loading, login, logout, isAuthenticated)
- **Local**: `useState` per page for data, modals, filters, loading states
- **Derived**: `useMemo` for filtered/paginated results
- **Side Effects**: `useEffect` for data fetching on mount/filter change

### Styling

- **Tailwind CSS** with custom brand colors:
  - Brand green: `#67C471`
  - Brand dark: `#23292E`
- **Radix UI** for accessible primitives (Dialog, Dropdown, Tabs)
- **CSS-only charts** (bar charts, trend charts) -- no charting library
- **Font**: Arial, Helvetica, sans-serif

---

## 11. Frontend Pages Reference

### Dashboard (`/`)
- Stats cards: Total Applicants, Active Fellows, AI Evaluations, AI Cost
- Conversion Funnel: Applied -> Screening -> Eligible -> Microship -> Accepted (with rates)
- Challenge Activity: 2x2 grid
- Quick Actions: Links to create cohort, view applicants, etc.

### Cohorts (`/cohorts`)
- Stats cards (total, active, planning, completed)
- Cohort cards grid with status badges
- Create/edit modal (name, dates, target_size)
- Status progression buttons (validated transitions)

### Screening (`/screening`)
- 6-card stats grid
- Cohort/role/status filters + search
- Applicants table with evaluate/approve actions
- Batch evaluate via `bulkAPI.evaluateApplications()`

### Applicants (`/applicants`)
- Cohort/status/role/date filters + search
- Applicants table with clickable rows
- Journey modal: vertical timeline with color-coded events (applied, evaluation, submission, decision, fellow_started)

### Challenges (`/challenges`)
- **List view**: Challenge cards with deadline countdown, status, auto-eval badge
- **Track view**: Grouped by role type with sequence ordering
- **Create/Edit modal**: Title, description, requirements, role, deadline, AI Assist button
- **Submissions modal**: Table with evaluate buttons, CSV export, timeline chart
- **Analytics**: Pass/fail rates, avg scores, submissions by day (14-day chart)

### Microship (`/microship`)
- Cohort filter + search + status filter
- Submissions table with outcome badges
- Bulk evaluate button
- Evaluation detail modal: scores, evidence, strengths/concerns
- Communication log timeline in detail modal

### Fellows (`/fellows`)
- Cohort filter + search
- Fellows table with risk level badges
- Detail modal: milestone scores, risk history, check-in history

### Check-ins (`/check-ins`)
- Cohort filter
- Check-ins table by week
- Bulk analyze button
- Weekly sentiment/energy trend bar charts (CSS-only)

### Risk Dashboard (`/risk`)
- 4 summary cards: On Track, Monitor, At Risk, Critical
- Fellows table with risk levels
- View button: detail modal with risk history, concerns, action recording
- Risk score bar chart

### Delivery (`/delivery`)
- Cohort filter
- Risk summary cards
- Fellows table with Draft Warning / View History actions
- Warning draft modal (editable)
- Warning history modal (timeline)

### Placement (`/placement`)
- **3 tabs**: Profiles, Opportunities, Matches
- Profiles: Generate/view profiles, find opportunities
- Opportunities: CRUD modal, status filter
- Matches: Score, status progression, draft intro

### Analytics (`/analytics`)
- **5 tabs**: Overview, Pipeline, Fellows & Risk, Challenges, AI Performance
- Cohort filter + CSV export
- Bar charts, trend charts, funnel visualization, cohort comparison table

### Bulk Operations (`/bulk-operations`)
- Checkbox selection table
- Batch evaluate, batch status update
- CSV import/export (applicants + fellows)

### Settings (`/settings`)
- **Account tab**: Profile display, change password form
- **User Management tab** (admin only): Users table, create user modal, role/active toggles

### Email Templates (`/email-templates`)
- **Templates tab**: Grid of 6 templates, preview/edit/test-send/revert
- **Configuration tab**: SMTP status, documentation

### Public Submission (`/submit/[token]`)
- No auth required
- Challenge details display
- Submission form: email, name, URL, type, notes
- States: loading, not_found, closed, expired, form, success

### Login (`/login`)
- Email/password form
- Redirects to `/` if already authenticated
- Error display on failed login

---

## 12. UI Component Library

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| AppLayout | `components/layout/AppLayout.tsx` | Sidebar + Header + content wrapper |
| Sidebar | `components/layout/Sidebar.tsx` | 15-item navigation |
| Header | `components/layout/Header.tsx` | User menu + notifications |

### UI Components

| Component | Props | Variants |
|-----------|-------|----------|
| **Button** | variant, size | primary, secondary, danger, ghost / sm, md, lg |
| **Badge** | variant | default, success, warning, danger, info, secondary |
| **Card** | padding | CardHeader, CardTitle, CardContent |
| **Modal** | open, onOpenChange, title, size | sm, md, lg, xl |
| **Table** | -- | Table, TableHeader, TableBody, TableRow, TableHead, TableCell |
| **SearchInput** | value, onChange, placeholder | -- |
| **FilterDropdown** | label, options, selected, onChange | Multi-select with checkmarks |
| **Pagination** | currentPage, totalPages, onPageChange | Items per page: 10/25/50/100 |
| **Tabs** | -- | Tabs, TabsList, TabsTrigger, TabsContent |

### Auth Components

| Component | Props | Purpose |
|-----------|-------|---------|
| ProtectedRoute | children, requireRole? | Blocks unauthenticated access |
| ErrorBoundary | children, fallback? | Catches React errors |

### Known Component Limitations

- `Badge` uses `danger` not `error` for red variants
- `TableCell` doesn't support `colSpan` or `onClick` -- use raw `<td>` for these
- `TableHead` requires non-empty children
- `Card` supports `onClick` prop (was added for Risk Dashboard)

---

## 13. API Client Reference

**File**: `frontend/lib/api.ts`

Axios instance with base URL `http://localhost:8000`, request interceptor (Bearer token), and response interceptor (token refresh on 401).

### Complete Method Reference

```typescript
// Auth
authAPI.me()                              // GET /api/auth/me
authAPI.changePassword(data)              // POST /api/auth/change-password
authAPI.listUsers()                       // GET /api/auth/users
authAPI.createUser(data)                  // POST /api/auth/users
authAPI.updateUser(id, data)              // PUT /api/auth/users/{id}

// Applicants
applicantsAPI.list(cohortId?)             // GET /api/applicants/
applicantsAPI.get(id)                     // GET /api/applicants/{id}
applicantsAPI.create(data)                // POST /api/applicants/
applicantsAPI.update(id, data)            // PUT /api/applicants/{id}
applicantsAPI.getJourney(id)              // GET /api/applicants/{id}/journey

// Screening
screeningAPI.evaluateApplication(id)      // POST /api/screening/application/evaluate
screeningAPI.evaluateMicroship(id)        // POST /api/screening/microship/evaluate
screeningAPI.getQueue()                   // GET /api/screening/queue
screeningAPI.approveEvaluation(id, ...)   // POST /api/screening/application/{id}/approve

// Cohorts
cohortsAPI.list()                         // GET /api/cohorts/
cohortsAPI.get(id)                        // GET /api/cohorts/{id}
cohortsAPI.create(data)                   // POST /api/cohorts/
cohortsAPI.update(id, data)              // PUT /api/cohorts/{id}
cohortsAPI.updateStatus(id, status)       // PATCH /api/cohorts/{id}/status

// Fellows
fellowsAPI.list(cohortId?)                // GET /api/fellows/
fellowsAPI.get(id)                        // GET /api/fellows/{id}
fellowsAPI.getCheckIns(id)                // GET /api/fellows/{id}/check-ins
fellowsAPI.getRisk(id)                    // GET /api/fellows/{id}/risk

// Check-ins
checkInsAPI.list(week?, cohortId?, ...)   // GET /api/check-ins
checkInsAPI.getCheckIn(id)                // GET /api/check-ins/{id}
checkInsAPI.getFellowCheckIns(id)         // GET /api/check-ins/fellow/{id}
checkInsAPI.getByWeek(week)               // GET /api/check-ins/week/{week}
checkInsAPI.create(data)                  // POST /api/check-ins
checkInsAPI.analyze(id)                   // POST /api/check-ins/analyze/{id}
checkInsAPI.analyzeBulk(week?, cohortId?) // POST /api/check-ins/analyze-bulk

// Risk
riskAPI.assessFellow(id, week)            // POST /api/risk/assess/{id}
riskAPI.getFellowHistory(id)              // GET /api/risk/fellow/{id}
riskAPI.getDashboard(cohortId, week)      // GET /api/risk/dashboard/{cohortId}
riskAPI.getAssessment(id)                 // GET /api/risk/assessment/{id}
riskAPI.recordAction(id, action)          // POST /api/risk/action/{id}
riskAPI.getByWeek(week, cohortId?)        // GET /api/risk/week/{week}

// Warnings
warningsAPI.draft(data)                   // POST /api/warnings/draft
warningsAPI.create(data)                  // POST /api/warnings
warningsAPI.get(id)                       // GET /api/warnings/{id}
warningsAPI.getFellowWarnings(id)         // GET /api/warnings/fellow/{id}
warningsAPI.update(id, data)              // PUT /api/warnings/{id}
warningsAPI.issue(id, sendEmail?)         // POST /api/warnings/{id}/issue
warningsAPI.acknowledge(id, response?)    // POST /api/warnings/{id}/acknowledge
warningsAPI.list(cohortId?, ...)          // GET /api/warnings

// Delivery
deliveryAPI.analyzeCheckIn(id)            // POST /api/delivery/check-in/analyze
deliveryAPI.assessRisk(id)                // POST /api/delivery/risk/assess
deliveryAPI.draftWarning(id)              // POST /api/delivery/warning/draft
deliveryAPI.approveWarning(id, ...)       // POST /api/delivery/warning/{id}/approve
deliveryAPI.getRiskDashboard(cohortId?)   // GET /api/delivery/risk/dashboard

// Microship
microshipAPI.listSubmissions(limit?, ...) // GET /api/microship/submissions
microshipAPI.getSubmission(id)            // GET /api/microship/submissions/{id}
microshipAPI.getApplicantSubmissions(id)  // GET /api/microship/submissions/applicant/{id}
microshipAPI.createSubmission(data)       // POST /api/microship/submissions
microshipAPI.evaluateSubmission(id)       // POST /api/microship/evaluate/{id}
microshipAPI.evaluateBulk()               // POST /api/microship/evaluate-bulk

// Placement
placementAPI.generateProfile(id)          // POST /api/placement/profile/generate
placementAPI.matchOpportunities(id, ...)  // POST /api/placement/opportunities/match
placementAPI.draftIntroduction(id)        // POST /api/placement/introduction/draft
placementAPI.listProfiles(cohortId?)      // GET /api/placement/profiles
placementAPI.listOpportunities(status?)   // GET /api/placement/opportunities
placementAPI.createOpportunity(data)      // POST /api/placement/opportunities
placementAPI.updateOpportunity(id, data)  // PUT /api/placement/opportunities/{id}
placementAPI.updateOpportunityStatus(...) // PATCH /api/placement/opportunities/{id}/status
placementAPI.getFellowMatches(id)         // GET /api/placement/matches/{id}
placementAPI.updateMatchStatus(id, ...)   // PATCH /api/placement/matches/{id}/status

// Challenges
challengesAPI.list(cohortId?, status?)    // GET /api/challenges/
challengesAPI.get(id)                     // GET /api/challenges/{id}
challengesAPI.create(data)                // POST /api/challenges/
challengesAPI.update(id, data)            // PUT /api/challenges/{id}
challengesAPI.updateStatus(id, status)    // PATCH /api/challenges/{id}/status
challengesAPI.getSubmissions(id)          // GET /api/challenges/{id}/submissions
challengesAPI.getPublic(token)            // GET /api/challenges/public/{token}
challengesAPI.submitPublic(token, data)   // POST /api/challenges/public/{token}/submit
challengesAPI.generateContent(data)       // POST /api/challenges/generate-content
challengesAPI.getAnalytics(cohortId?)     // GET /api/challenges/analytics

// Track Configs
trackConfigsAPI.list(cohortId)            // GET /api/track-configs/
trackConfigsAPI.get(id)                   // GET /api/track-configs/{id}
trackConfigsAPI.create(data)              // POST /api/track-configs/
trackConfigsAPI.update(id, data)          // PUT /api/track-configs/{id}
trackConfigsAPI.delete(id)               // DELETE /api/track-configs/{id}
trackConfigsAPI.getCohortSummary(id)      // GET /api/track-configs/cohort/{id}/summary

// Analytics
analyticsAPI.getDashboard(cohortId?)      // GET /api/analytics/dashboard
analyticsAPI.getConversionFunnel(...)     // GET /api/analytics/conversion-funnel
analyticsAPI.getAIPerformance(...)        // GET /api/analytics/ai-performance
analyticsAPI.getTrends(cohortId?)         // GET /api/analytics/trends
analyticsAPI.getCohortComparison()        // GET /api/analytics/cohort-comparison

// Bulk Operations
bulkAPI.evaluateApplications(ids, ...)    // POST /api/bulk/evaluate
bulkAPI.updateStatus(ids, status)         // POST /api/bulk/status/update
bulkAPI.importApplicants(file, ...)       // POST /api/bulk/import/applicants (multipart)
bulkAPI.exportApplicants(cohortId?, ...)  // GET /api/bulk/export/applicants (blob)
bulkAPI.exportFellows(cohortId?)          // GET /api/bulk/export/fellows (blob)

// Email Templates
emailTemplatesAPI.list()                  // GET /api/email-templates/
emailTemplatesAPI.get(key)                // GET /api/email-templates/{key}
emailTemplatesAPI.getPreview(key)         // GET /api/email-templates/{key}/preview
emailTemplatesAPI.update(key, data)       // PUT /api/email-templates/{key}
emailTemplatesAPI.revert(key)             // DELETE /api/email-templates/{key}/override
emailTemplatesAPI.testSend(key, data)     // POST /api/email-templates/{key}/test-send
emailTemplatesAPI.getConfig()             // GET /api/email-templates/config

// Health
healthAPI.check()                         // GET /health
```

---

## 14. Business Logic & Workflows

### Workflow 1: Applicant Pipeline

```
1. Applicant applies (POST /applicants)
   Status: APPLIED

2. AI screens application (POST /screening/application/evaluate)
   Status: SCREENING -> ELIGIBLE or NOT_ELIGIBLE

3. Challenge activated for cohort
   Email sent to all cohort applicants

4. Applicant submits challenge (POST /challenges/public/{token}/submit)
   Status: MICROSHIP_PENDING
   Creates/updates MicroshipSubmission

5. AI evaluates submission (auto or manual)
   Status: MICROSHIP_COMPLETED
   Outcome: progress / borderline / do_not_progress

6. Admin accepts/rejects
   Status: ACCEPTED or REJECTED

7. Fellow created from accepted applicant
```

### Workflow 2: Challenge Lifecycle

```
1. Create challenge (DRAFT)
   - Optional: AI Assist generates content
   - Optional: Assign to track config

2. Activate challenge (DRAFT -> ACTIVE)
   - Emails sent to cohort applicants
   - Share token URL becomes live

3. Collect submissions
   - Public URL: /submit/{share_token}
   - Auto-evaluate if enabled
   - Confirmation email sent

4. Evaluate submissions
   - Manual: Evaluate button per submission
   - Bulk: Evaluate all unevaluated
   - Result emails sent

5. Close challenge (ACTIVE -> CLOSED)
   - No more submissions accepted

6. Archive (CLOSED -> ARCHIVED)
```

### Workflow 3: Fellow Risk Management

```
Weekly Cycle:
1. Fellows submit check-ins (POST /check-ins)

2. AI analyzes check-ins (POST /check-ins/analyze/{id})
   - Sentiment score (-1 to +1)
   - Risk contribution (0 to 1)
   - Extracts blockers and action items

3. Risk assessment (POST /risk/assess/{id})
   - Combines 8 weighted signals
   - Risk level: on_track / monitor / at_risk / critical

4. If at_risk or critical:
   - Admin drafts warning (POST /warnings/draft)
   - AI generates warning document
   - Admin reviews and edits
   - Admin issues warning (POST /warnings/{id}/issue)
   - Email sent to fellow

5. Fellow acknowledges warning
   - POST /warnings/{id}/acknowledge
```

### Workflow 4: Placement Pipeline

```
1. Generate fellow profile
   - AI creates headline, summary, skills, projects

2. Create job opportunities
   - CRUD via /placement/opportunities

3. Match fellows to opportunities
   - AI scores and provides reasoning
   - Status: SUGGESTED

4. Admin approves match
   - Status: APPROVED

5. Draft introduction
   - AI writes intro email
   - Status: INTRODUCED (when sent)

6. Track progression
   - INTERVIEWING -> OFFERED -> HIRED
   (or REJECTED / WITHDRAWN)
```

### Workflow 5: Cohort Lifecycle

```
PLANNING
  -> APPLICATIONS_OPEN (accepting applicants)
  -> MICROSHIP (running challenges)
  -> ACTIVE (fellowship in progress)
  -> COMPLETED (program ended)
```

---

## 15. Configuration & Environment

### Root `.env` (Docker Compose)

```env
DATABASE_URL=postgresql+asyncpg://mentorled:mentorled_dev@db:5432/mentorled
REDIS_URL=redis://redis:6379
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=mentorled-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3002
API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
```

### Backend `.env` (Local Dev)

```env
DATABASE_URL=postgresql+asyncpg://mentorled:mentorled_dev@localhost:5432/mentorled
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your-api-key-here
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
SCREENING_CONFIDENCE_THRESHOLD=0.7
RISK_ALERT_THRESHOLD=0.5
COST_PER_1M_INPUT_TOKENS=3.0
COST_PER_1M_OUTPUT_TOKENS=15.0
```

### Full Configuration Reference

```env
# Email (disabled by default)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=your-email@example.com
SMTP_FROM_NAME=MentorLed
ENABLE_EMAIL=false

# Slack (disabled by default)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ENABLE_SLACK_NOTIFICATIONS=false
SLACK_MENTION_USER=U01234567
```

### Backend Settings Class

**File**: `backend/app/config.py`

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    ANTHROPIC_API_KEY: str
    DEFAULT_MODEL: str = "claude-3-haiku-20240307"
    FAST_MODEL: str = "claude-3-haiku-20240307"
    SECRET_KEY: str
    CORS_ORIGINS: List[str]
    SCREENING_CONFIDENCE_THRESHOLD: float = 0.7
    RISK_ALERT_THRESHOLD: float = 0.5
    COST_PER_1M_INPUT_TOKENS: float = 3.0
    COST_PER_1M_OUTPUT_TOKENS: float = 15.0
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    ENABLE_EMAIL: bool = False
    ENABLE_SLACK_NOTIFICATIONS: bool = False
```

---

## 16. Seed Data

### Simple Seed (Docker)

**File**: `scripts/seed_data.py`

Creates:
- 1 admin user
- 1 cohort (2025 Spring)
- 3 mentors
- 2 teams
- 5 applicants
- 1 microship submission
- 3 track configs + 4 challenges

### Comprehensive Seed (Standalone)

**File**: `backend/scripts/seed_data.py`

Creates:
- 1 admin user
- 2 cohorts (1 active week 8/12, 1 past completed)
- 50 applicants (realistic African names)
- 50 microship submissions
- 30 fellows (varied statuses)
- Check-ins for weeks 1-8 (with sentiment variance, missing checks)
- Milestones (5 per fellow)
- Warnings for at-risk fellows (first + final)
- Risk assessments (week 8)
- 3 track configs + 4 challenges

Run: `cd backend && python scripts/seed_data.py`

---

## 17. Known Constraints & Gotchas

### Database
- **`create_all()` won't add columns**: If you add a field to a model, you must `docker-compose down -v` and recreate the database
- **Alembic is installed** but not actively used for migrations in dev

### Models
- **Fellow has no `name`/`email`**: Access via `Fellow.applicant.name`. Must use `selectinload(Fellow.applicant)` in async queries
- **Warning model fields**: Use `level`, `concerns`, `requirements`, `draft_message` (NOT `warning_number`, `ai_draft`, `tone`, `required_actions`, `consequences`)
- **CheckIn uses `week`** (NOT `week_number`)
- **JobOpportunity uses `employer_name`** (NOT `company`)

### Frontend Components
- `Badge` uses `danger` not `error` for red variants
- `TableCell` doesn't support `colSpan` or `onClick` -- use raw `<td>`
- `TableHead` requires non-empty children

### Auth
- Most backend routes still don't require auth (only check-ins, risk, warnings do)
- Frontend sends Bearer token on all requests regardless
- First registered user becomes admin

### Email
- Disabled by default (`ENABLE_EMAIL=false`)
- Returns early (no error) if disabled or credentials missing

### AI
- Default model is Haiku (budget-friendly)
- MicroshipEvaluator and CheckInAnalyzer use Sonnet 4 (higher capability)
- JSON parsing handles markdown code blocks and literal newlines

### Docker
- Frontend is NOT in Docker Compose (runs separately)
- Backend hot-reloads in Docker (volume mount)
- Database volume persists across restarts (use `-v` flag to clear)

---

*This document was auto-generated from codebase analysis on February 14, 2026.*
