# MentorLed Platform - Technical Guide (Part 1/6)
## System Overview & Architecture

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 1)

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [System Components](#system-components)
6. [Data Flow Overview](#data-flow-overview)
7. [Development Environment](#development-environment)

---

## 1. System Overview

### What is MentorLed?

MentorLed is an **AI-Ops Platform** designed to manage the entire lifecycle of a mentorship/fellowship program. It automates key operations using AI agents while providing a comprehensive management interface for program administrators.

### Core Capabilities

**Program Management**:
- Applicant tracking and screening
- Fellow onboarding and profile management
- Delivery planning and tracking
- Placement management and analytics

**AI-Powered Operations**:
- Automated applicant screening (Screening Agent)
- Delivery plan generation (Delivery Agent)
- Placement matching and recommendations (Placement Agent)

**User Management**:
- Role-based access control (5 roles)
- JWT-based authentication
- Permission-based feature access

**Data Operations**:
- Search and filtering across all entities
- Pagination for large datasets
- Export capabilities (planned)
- Audit logging

---

## 2. High-Level Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js 14 Frontend (React + TypeScript)                  │ │
│  │  - Pages (7): Dashboard, Applicants, Fellows, etc.         │ │
│  │  - Components (15+): UI, Layout, Auth                      │ │
│  │  - State Management: React Context API + Hooks             │ │
│  │  - Styling: Tailwind CSS                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕ HTTP/HTTPS (Axios)               │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  FastAPI Backend (Python 3.11+)                            │ │
│  │  - REST API (30+ endpoints)                                │ │
│  │  - Authentication & Authorization (JWT + RBAC)             │ │
│  │  - Business Logic                                          │ │
│  │  - AI Agent Integration                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕ SQLAlchemy (Async)               │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                       │ │
│  │  - 8 Tables: Users, Applicants, Fellows, etc.             │ │
│  │  - Relationships & Foreign Keys                            │ │
│  │  - Indexes for Performance                                 │ │
│  │  - Audit Columns (created_at, updated_at)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Anthropic Claude API (AI Agents)                          │ │
│  │  - Screening Agent (Claude Sonnet 4)                       │ │
│  │  - Delivery Agent (Claude Sonnet 4)                        │ │
│  │  - Placement Agent (Claude Sonnet 4)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Layers Explained

#### 1. **Client Layer** (Port 3002)
- **Framework**: Next.js 14 with App Router
- **Purpose**: User interface and client-side logic
- **Key Features**:
  - Server-side rendering (SSR) for initial page loads
  - Client-side routing for navigation
  - State management with React Context
  - Responsive UI with Tailwind CSS

#### 2. **Application Layer** (Port 8000)
- **Framework**: FastAPI (async Python)
- **Purpose**: Business logic, API endpoints, authentication
- **Key Features**:
  - RESTful API design
  - Async request handling
  - JWT token generation/validation
  - Role-based access control
  - AI agent orchestration

#### 3. **Data Layer** (Port 5432)
- **Database**: PostgreSQL 15
- **Purpose**: Persistent data storage
- **Key Features**:
  - Relational data model
  - ACID compliance
  - Foreign key constraints
  - Indexed queries for performance

#### 4. **External Services**
- **AI Provider**: Anthropic Claude API
- **Purpose**: AI-powered operations
- **Key Features**:
  - Natural language processing
  - Structured output generation
  - Context-aware reasoning

---

## 3. Technology Stack

### Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Python | 3.11+ | Programming language |
| **Framework** | FastAPI | 0.100+ | Web framework |
| **Database** | PostgreSQL | 15 | Data persistence |
| **ORM** | SQLAlchemy | 2.0+ | Database abstraction |
| **Database Driver** | asyncpg | 0.27+ | Async PostgreSQL driver |
| **Validation** | Pydantic | 2.0+ | Data validation |
| **Authentication** | python-jose | 3.3+ | JWT handling |
| **Password Hashing** | bcrypt | 4.0+ | Password security |
| **AI Integration** | anthropic | 0.18+ | Claude API client |
| **Migrations** | Alembic | 1.11+ | Database migrations |
| **HTTP Client** | httpx | 0.24+ | Async HTTP requests |
| **Environment** | python-dotenv | 1.0+ | Environment variables |

### Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Next.js | 14.2+ | React framework |
| **Language** | TypeScript | 5.0+ | Type safety |
| **UI Library** | React | 18.2+ | Component library |
| **Styling** | Tailwind CSS | 3.3+ | Utility-first CSS |
| **HTTP Client** | Axios | 1.4+ | API requests |
| **Icons** | Lucide React | 0.263+ | Icon components |
| **State Management** | React Context | Built-in | Global state |
| **Routing** | Next.js Router | Built-in | Client routing |

### Infrastructure Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Containerization** | Docker | 20.10+ | Container runtime |
| **Orchestration** | Docker Compose | 2.0+ | Multi-container apps |
| **Web Server** | Uvicorn | 0.22+ | ASGI server |
| **Process Manager** | (Built-in) | - | Auto-reload in dev |

---

## 4. Project Structure

### Root Directory Structure

```
mentorled/
├── backend/                 # FastAPI backend application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # Application entry point
│   │   ├── models/         # SQLAlchemy models
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core utilities (auth, security)
│   │   ├── schemas/        # Pydantic schemas
│   │   └── agents/         # AI agents
│   ├── alembic/            # Database migrations
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Backend container config
│
├── frontend/               # Next.js frontend application
│   ├── app/               # Next.js App Router pages
│   │   ├── page.tsx       # Dashboard
│   │   ├── login/         # Login page
│   │   ├── applicants/    # Applicants page
│   │   ├── fellows/       # Fellows page
│   │   ├── screening/     # Screening page
│   │   ├── delivery/      # Delivery page
│   │   ├── placement/     # Placement page
│   │   └── settings/      # Settings page
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   ├── layout/       # Layout components
│   │   └── auth/         # Auth components
│   ├── contexts/         # React contexts
│   ├── lib/              # Utilities and API client
│   ├── types/            # TypeScript types
│   ├── public/           # Static assets
│   ├── package.json      # Node dependencies
│   └── Dockerfile        # Frontend container config
│
├── scripts/              # Utility scripts
│   └── seed_data.py     # Database seeding
│
├── docker-compose.yml    # Container orchestration
├── RUN_ME.sh            # Quick start script
├── .env.example         # Environment template
└── *.md                 # Documentation files
```

### Backend Directory Deep Dive

```
backend/app/
├── main.py                      # FastAPI app initialization, CORS, routes
├── database.py                  # Database connection, async session
│
├── models/                      # SQLAlchemy ORM Models
│   ├── __init__.py
│   ├── user.py                 # User model (authentication)
│   ├── applicant.py            # Applicant model
│   ├── fellow_profile.py       # Fellow profile model
│   ├── delivery.py             # Delivery plan model
│   ├── opportunity.py          # Placement opportunity model
│   ├── placement.py            # Placement match model
│   ├── screening_result.py     # Screening result model
│   └── audit_log.py            # Audit logging model
│
├── api/                         # API Route Handlers
│   ├── __init__.py
│   ├── router.py               # Main API router aggregator
│   ├── auth.py                 # Authentication endpoints (6 endpoints)
│   ├── applicants.py           # Applicant CRUD (5 endpoints)
│   ├── fellows.py              # Fellow CRUD (5 endpoints)
│   ├── screening.py            # Screening operations (3 endpoints)
│   ├── delivery.py             # Delivery operations (4 endpoints)
│   ├── placement.py            # Placement operations (5 endpoints)
│   └── opportunities.py        # Opportunity CRUD (5 endpoints)
│
├── core/                        # Core Utilities
│   ├── __init__.py
│   ├── security.py             # JWT & password hashing
│   └── auth.py                 # Auth middleware, RBAC decorators
│
├── schemas/                     # Pydantic Schemas
│   ├── __init__.py
│   ├── user.py                 # User request/response schemas
│   ├── applicant.py            # Applicant schemas
│   ├── fellow.py               # Fellow schemas
│   ├── delivery.py             # Delivery schemas
│   ├── placement.py            # Placement schemas
│   └── opportunity.py          # Opportunity schemas
│
└── agents/                      # AI Agents
    ├── __init__.py
    ├── screening_agent.py      # Automated applicant screening
    ├── delivery_agent.py       # Delivery plan generation
    └── placement_agent.py      # Placement matching
```

### Frontend Directory Deep Dive

```
frontend/
├── app/                         # Next.js Pages (App Router)
│   ├── layout.tsx              # Root layout (providers)
│   ├── page.tsx                # Dashboard page
│   ├── login/
│   │   └── page.tsx            # Login page (public)
│   ├── applicants/
│   │   └── page.tsx            # Applicants list (protected)
│   ├── fellows/
│   │   └── page.tsx            # Fellows list (protected)
│   ├── screening/
│   │   └── page.tsx            # Screening operations (protected)
│   ├── delivery/
│   │   └── page.tsx            # Delivery plans (protected)
│   ├── placement/
│   │   └── page.tsx            # Placements (protected)
│   └── settings/
│       └── page.tsx            # Settings (protected)
│
├── components/                  # React Components
│   ├── ui/                     # Reusable UI Components
│   │   ├── Button.tsx          # Button component
│   │   ├── Card.tsx            # Card component
│   │   ├── Badge.tsx           # Badge component
│   │   ├── Table.tsx           # Table components
│   │   ├── Modal.tsx           # Modal component
│   │   ├── Tabs.tsx            # Tabs component
│   │   ├── SearchInput.tsx     # Search input
│   │   ├── FilterDropdown.tsx  # Multi-select filter
│   │   ├── Pagination.tsx      # Pagination controls
│   │   └── Skeleton.tsx        # Loading skeletons
│   ├── layout/                 # Layout Components
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Header.tsx          # Top header with user menu
│   │   └── AppLayout.tsx       # Main protected layout
│   ├── auth/                   # Auth Components
│   │   └── ProtectedRoute.tsx  # Route protection wrapper
│   └── ErrorBoundary.tsx       # Error boundary
│
├── contexts/                    # React Contexts
│   └── AuthContext.tsx         # Global auth state
│
├── lib/                         # Utilities
│   ├── api.ts                  # API client functions
│   └── axios.ts                # Axios configuration
│
├── types/                       # TypeScript Types
│   └── index.ts                # Global type definitions
│
├── public/                      # Static Files
│   └── (images, fonts, etc.)
│
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── next.config.js              # Next.js configuration
└── package.json                # Dependencies
```

---

## 5. System Components

### 5.1 Backend Components

#### FastAPI Application (`main.py`)

**Purpose**: Application entry point and configuration

**Key Responsibilities**:
- Initialize FastAPI app
- Configure CORS for frontend communication
- Register API routers
- Set up middleware
- Health check endpoint

**Code Structure**:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router

app = FastAPI(
    title="MentorLed API",
    description="AI-Ops Platform for Mentorship Programs",
    version="1.0.0"
)

# CORS configuration (allows frontend to call API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routes
app.include_router(api_router, prefix="/api")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

#### Database Connection (`database.py`)

**Purpose**: Async database session management

**Key Features**:
- Async connection pooling
- Session lifecycle management
- Dependency injection for routes

**Code Structure**:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

DATABASE_URL = "postgresql+asyncpg://user:pass@db:5432/mentorled"

engine = create_async_engine(DATABASE_URL, echo=True, future=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session
```

#### Models (SQLAlchemy ORM)

**Purpose**: Define database schema and relationships

**8 Core Models**:

1. **User** (`models/user.py`)
   - Authentication and authorization
   - Fields: id, email, hashed_password, full_name, role, permissions
   - 5 Roles: admin, program_manager, mentor, fellow, readonly

2. **Applicant** (`models/applicant.py`)
   - Program applicants
   - Fields: id, name, email, role, status, source, applied_at
   - Statuses: applied, screening, interview, accepted, rejected, waitlisted

3. **FellowProfile** (`models/fellow_profile.py`)
   - Fellow information
   - Fields: id, name, email, skills, interests, github, linkedin
   - Links to delivery plans and placements

4. **ScreeningResult** (`models/screening_result.py`)
   - AI screening outcomes
   - Fields: id, applicant_id, score, recommendation, reasoning

5. **DeliveryPlan** (`models/delivery.py`)
   - Learning/project plans
   - Fields: id, fellow_id, title, description, milestones, status

6. **Opportunity** (`models/opportunity.py`)
   - Placement opportunities
   - Fields: id, title, company, description, requirements, status

7. **Placement** (`models/placement.py`)
   - Fellow placements
   - Fields: id, fellow_id, opportunity_id, status, match_score

8. **AuditLog** (`models/audit_log.py`)
   - System audit trail
   - Fields: id, user_id, action, entity_type, entity_id, timestamp

#### API Endpoints

**Total**: 30+ endpoints across 8 routers

**Authentication API** (`api/auth.py`):
- POST `/api/auth/signup` - User registration
- POST `/api/auth/login` - Login with JWT
- POST `/api/auth/refresh` - Refresh access token
- GET `/api/auth/me` - Get current user
- POST `/api/auth/logout` - Logout (client-side token removal)
- GET `/api/auth/users` - List users (admin only)

**Applicants API** (`api/applicants.py`):
- GET `/api/applicants` - List all applicants
- POST `/api/applicants` - Create new applicant
- GET `/api/applicants/{id}` - Get applicant by ID
- PUT `/api/applicants/{id}` - Update applicant
- DELETE `/api/applicants/{id}` - Delete applicant

*Similar patterns for Fellows, Opportunities, Delivery, Placement, Screening*

#### AI Agents

**Screening Agent** (`agents/screening_agent.py`):
- **Purpose**: Automate applicant evaluation
- **Input**: Applicant profile, resume, responses
- **Output**: Score (0-100), recommendation, detailed reasoning
- **Model**: Claude Sonnet 4

**Delivery Agent** (`agents/delivery_agent.py`):
- **Purpose**: Generate personalized learning plans
- **Input**: Fellow profile, interests, goals
- **Output**: Structured delivery plan with milestones
- **Model**: Claude Sonnet 4

**Placement Agent** (`agents/placement_agent.py`):
- **Purpose**: Match fellows with opportunities
- **Input**: Fellow profile, opportunity details
- **Output**: Match score, placement recommendation
- **Model**: Claude Sonnet 4

### 5.2 Frontend Components

#### Pages (App Router)

**7 Main Pages**:

1. **Dashboard** (`app/page.tsx`)
   - Overview statistics
   - Recent activities
   - Quick actions

2. **Login** (`app/login/page.tsx`)
   - Authentication form
   - Public route (no protection)

3. **Applicants** (`app/applicants/page.tsx`)
   - List all applicants
   - Search, filter, pagination
   - Status management

4. **Fellows** (`app/fellows/page.tsx`)
   - Active fellows list
   - Profile viewing

5. **Screening** (`app/screening/page.tsx`)
   - Run AI screening
   - View screening results

6. **Delivery** (`app/delivery/page.tsx`)
   - Delivery plan management
   - Generate AI plans

7. **Placement** (`app/placement/page.tsx`)
   - Placement tracking
   - AI matching

8. **Settings** (`app/settings/page.tsx`)
   - User preferences
   - System configuration

#### UI Components (15+ Reusable)

**Base Components**:
- `Button` - Primary, secondary, outline variants
- `Card` - Content containers
- `Badge` - Status indicators
- `Table` - Data tables with headers

**Advanced Components**:
- `SearchInput` - Search with clear button
- `FilterDropdown` - Multi-select filters
- `Pagination` - Full pagination controls
- `Skeleton` - Loading states (4 variants)
- `Modal` - Dialog windows
- `Tabs` - Tabbed interfaces

**Layout Components**:
- `Sidebar` - Navigation menu
- `Header` - Top bar with user menu
- `AppLayout` - Protected page wrapper

**Auth Components**:
- `ProtectedRoute` - Authentication guard
- `ErrorBoundary` - Error handling

#### State Management

**AuthContext** (`contexts/AuthContext.tsx`):
- Global authentication state
- User information
- Login/logout functions
- Token management
- Automatic token refresh

**Local State** (React Hooks):
- `useState` - Component state
- `useEffect` - Side effects
- `useMemo` - Computed values
- `useRef` - DOM references

---

## 6. Data Flow Overview

### 6.1 User Authentication Flow

```
1. User enters credentials on Login page
   ↓
2. Frontend sends POST /api/auth/login with email/password
   ↓
3. Backend verifies credentials against database
   ↓
4. Backend generates JWT access token (30min) + refresh token (7 days)
   ↓
5. Frontend stores tokens in localStorage
   ↓
6. Frontend sets user in AuthContext
   ↓
7. User redirected to Dashboard
   ↓
8. All subsequent requests include: Authorization: Bearer {access_token}
   ↓
9. If access token expires (401 error):
   - Axios interceptor catches error
   - Automatically calls POST /api/auth/refresh with refresh_token
   - Gets new access token
   - Retries original request
   ↓
10. If refresh fails → Redirect to login
```

### 6.2 Protected Page Access Flow

```
1. User navigates to protected page (e.g., /applicants)
   ↓
2. AppLayout wrapper renders
   ↓
3. ProtectedRoute checks authentication:
   - Is user authenticated? (check AuthContext)
   - If NO → Redirect to /login
   - If YES → Continue
   ↓
4. Page component mounts
   ↓
5. useEffect triggers API call (e.g., GET /api/applicants)
   - Axios adds Authorization header automatically
   ↓
6. Backend validates JWT token:
   - Decode token → Extract user_id
   - Query database for user
   - Check role permissions
   - If valid → Return data
   - If invalid → Return 401
   ↓
7. Frontend receives data
   ↓
8. Component renders with data
```

### 6.3 Data CRUD Flow (Example: Applicants)

**CREATE Flow**:
```
1. User clicks "Add Applicant" button
   ↓
2. Modal opens with form
   ↓
3. User fills form and submits
   ↓
4. Frontend calls POST /api/applicants with data
   ↓
5. Backend validates data (Pydantic schema)
   ↓
6. Backend creates Applicant model instance
   ↓
7. Backend saves to database (SQLAlchemy)
   ↓
8. Backend returns created applicant with ID
   ↓
9. Frontend updates local state
   ↓
10. Table re-renders with new applicant
```

**READ Flow**:
```
1. Page loads → useEffect triggers
   ↓
2. Frontend calls GET /api/applicants
   ↓
3. Backend queries database (SELECT * FROM applicants)
   ↓
4. Backend returns array of applicants
   ↓
5. Frontend stores in state
   ↓
6. useMemo applies filters/search
   ↓
7. useMemo applies pagination
   ↓
8. Table renders visible rows
```

**UPDATE Flow**:
```
1. User clicks "Edit" on applicant row
   ↓
2. Modal opens with pre-filled form
   ↓
3. User modifies fields and submits
   ↓
4. Frontend calls PUT /api/applicants/{id} with updated data
   ↓
5. Backend validates data
   ↓
6. Backend updates database record
   ↓
7. Backend returns updated applicant
   ↓
8. Frontend updates state
   ↓
9. Table re-renders with changes
```

**DELETE Flow**:
```
1. User clicks "Delete" button
   ↓
2. Confirmation dialog appears
   ↓
3. User confirms
   ↓
4. Frontend calls DELETE /api/applicants/{id}
   ↓
5. Backend deletes from database
   ↓
6. Backend returns success status
   ↓
7. Frontend removes from state
   ↓
8. Table re-renders without deleted item
```

### 6.4 AI Agent Flow (Example: Screening)

```
1. User selects applicant and clicks "Screen with AI"
   ↓
2. Frontend calls POST /api/screening/screen/{applicant_id}
   ↓
3. Backend fetches applicant data from database
   ↓
4. Backend constructs prompt for Claude API:
   - System prompt (role definition)
   - Applicant information
   - Evaluation criteria
   ↓
5. Backend calls Anthropic API with structured output
   ↓
6. Claude processes and returns:
   {
     "score": 85,
     "recommendation": "strong_accept",
     "reasoning": "Detailed analysis...",
     "strengths": [...],
     "concerns": [...]
   }
   ↓
7. Backend saves ScreeningResult to database
   ↓
8. Backend returns result to frontend
   ↓
9. Frontend displays result in UI
   ↓
10. User can accept/reject AI recommendation
```

---

## 7. Development Environment

### 7.1 Prerequisites

**Required Software**:
- Docker Desktop 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

**Optional**:
- PostgreSQL client (psql, pgAdmin, DBeaver)
- API testing tool (Postman, Insomnia)
- Git

### 7.2 Environment Variables

**Backend** (`.env` in project root):
```bash
# Database
POSTGRES_USER=mentorled_user
POSTGRES_PASSWORD=mentorled_pass
POSTGRES_DB=mentorled
DATABASE_URL=postgresql+asyncpg://mentorled_user:mentorled_pass@db:5432/mentorled

# Security
JWT_SECRET_KEY=your-secret-key-change-in-production-please
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Environment
ENVIRONMENT=development
```

**Frontend** (`.env.local` in frontend/):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 7.3 Running the Platform

**Quick Start**:
```bash
# 1. Clone repository
git clone <repo-url>
cd mentorled

# 2. Set up environment
cp .env.example .env
# Edit .env with your values (especially ANTHROPIC_API_KEY)

# 3. Run everything
chmod +x RUN_ME.sh
./RUN_ME.sh
```

**Manual Start**:
```bash
# 1. Start containers
docker-compose up -d

# 2. Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# 3. Access services
# Frontend: http://localhost:3002
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Database: localhost:5432
```

### 7.4 Container Architecture

**3 Docker Containers**:

1. **Backend** (`backend` service)
   - Image: Python 3.11-slim
   - Port: 8000 (mapped to host 8000)
   - Volumes: `./backend:/app`
   - Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
   - Auto-reload on code changes

2. **Frontend** (`frontend` service)
   - Image: Node 18-alpine
   - Port: 3000 (mapped to host 3002)
   - Volumes: `./frontend:/app`
   - Command: `npm run dev`
   - Auto-reload on code changes

3. **Database** (`db` service)
   - Image: PostgreSQL 15-alpine
   - Port: 5432 (mapped to host 5432)
   - Volumes: `postgres_data:/var/lib/postgresql/data`
   - Persistent storage

**Network**:
- All containers on same Docker network
- Backend can reach DB at `db:5432`
- Frontend can reach backend at `http://backend:8000` (internal) or `http://localhost:8000` (from browser)

### 7.5 Development Workflow

**Typical Development Cycle**:

1. **Make changes to code**
   - Backend: Edit files in `backend/`
   - Frontend: Edit files in `frontend/`

2. **Changes auto-reload**
   - Backend: Uvicorn detects changes and reloads
   - Frontend: Next.js hot-reloads browser

3. **Test changes**
   - Frontend: View in browser at http://localhost:3002
   - Backend API: Test at http://localhost:8000/docs

4. **Check logs for errors**
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

5. **Database changes**
   ```bash
   # Create migration
   docker-compose exec backend alembic revision --autogenerate -m "description"

   # Apply migration
   docker-compose exec backend alembic upgrade head
   ```

6. **Seed data**
   ```bash
   docker-compose exec backend python /scripts/seed_data.py
   ```

### 7.6 Accessing Services

**Frontend**:
- URL: http://localhost:3002
- Login: admin@mentorled.com / admin123

**Backend API Documentation**:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Database**:
- Host: localhost
- Port: 5432
- Database: mentorled
- User: mentorled_user
- Password: mentorled_pass

**Connection String**:
```
postgresql://mentorled_user:mentorled_pass@localhost:5432/mentorled
```

---

## Summary (Part 1)

This part covered the **system overview and architecture**:

✅ High-level architecture (4 layers)
✅ Complete technology stack (backend, frontend, infrastructure)
✅ Project structure (root, backend, frontend)
✅ System components (models, APIs, UI components)
✅ Data flow overview (auth, CRUD, AI agents)
✅ Development environment setup

**Next in Part 2**: Authentication Flow Deep Dive
- JWT token generation and validation
- Password hashing implementation
- Role-based access control (RBAC)
- Frontend authentication state
- Axios interceptors
- Protected routes implementation

---

**Navigation**:
- **Current**: Part 1 - System Overview & Architecture ✓
- **Next**: Part 2 - Authentication Flow Deep Dive
- Part 3 - Backend APIs & Database
- Part 4 - Frontend Components & State Management
- Part 5 - AI Agents & Workflows
- Part 6 - Deployment & Production Readiness
