# MentorLed Platform - Technical Guide (Part 3/6)
## Backend APIs & Database

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 3)

1. [API Architecture Overview](#api-architecture-overview)
2. [Database Schema](#database-schema)
3. [SQLAlchemy Models](#sqlalchemy-models)
4. [Pydantic Schemas](#pydantic-schemas)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Database Migrations](#database-migrations)
7. [API Design Patterns](#api-design-patterns)

---

## 1. API Architecture Overview

### 1.1 FastAPI Application Structure

**Entry Point**: `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router

# Initialize FastAPI app
app = FastAPI(
    title="MentorLed API",
    description="AI-Ops Platform for Mentorship Programs",
    version="1.0.0",
    docs_url="/docs",      # Swagger UI
    redoc_url="/redoc",    # ReDoc
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3002",
        # Add production domains here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routes
app.include_router(api_router, prefix="/api")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "MentorLed API",
        "docs": "/docs",
        "health": "/health"
    }
```

### 1.2 Router Organization

**Main Router**: `backend/app/api/router.py`

```python
from fastapi import APIRouter
from app.api import (
    auth,
    applicants,
    fellows,
    screening,
    delivery,
    placement,
    opportunities,
    audit_logs,
)

api_router = APIRouter()

# Authentication routes (no prefix, accessible at /api/auth/...)
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Resource routes
api_router.include_router(applicants.router, prefix="/applicants", tags=["Applicants"])
api_router.include_router(fellows.router, prefix="/fellows", tags=["Fellows"])
api_router.include_router(screening.router, prefix="/screening", tags=["Screening"])
api_router.include_router(delivery.router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(placement.router, prefix="/placement", tags=["Placement"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["Opportunities"])
api_router.include_router(audit_logs.router, prefix="/audit", tags=["Audit Logs"])
```

**URL Structure**:
```
/api/auth/login
/api/auth/signup
/api/applicants
/api/applicants/{id}
/api/fellows
/api/fellows/{id}
/api/screening/screen/{applicant_id}
/api/delivery/generate
/api/placement/match
/api/opportunities
```

### 1.3 API Response Patterns

**Success Response** (200/201):
```json
{
  "id": "uuid",
  "field1": "value1",
  "field2": "value2"
}
```

**List Response** (200):
```json
[
  {"id": "uuid1", "name": "Item 1"},
  {"id": "uuid2", "name": "Item 2"}
]
```

**Error Response** (4xx/5xx):
```json
{
  "detail": "Error message description"
}
```

**Validation Error** (422):
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 2. Database Schema

### 2.1 Entity Relationship Diagram

```
┌──────────────────┐
│      users       │
│──────────────────│
│ id (PK)          │───┐
│ email            │   │
│ hashed_password  │   │
│ full_name        │   │
│ role             │   │
│ is_active        │   │
│ is_superuser     │   │
│ permissions      │   │
│ created_at       │   │
│ updated_at       │   │
│ last_login       │   │
└──────────────────┘   │
                       │
                       │ (created_by_id)
                       ↓
┌──────────────────────────┐         ┌─────────────────────┐
│      applicants          │         │ screening_results   │
│──────────────────────────│         │─────────────────────│
│ id (PK)                  │←────────│ applicant_id (FK)   │
│ name                     │         │ id (PK)             │
│ email                    │         │ score               │
│ role                     │         │ recommendation      │
│ status                   │         │ reasoning           │
│ source                   │         │ strengths           │
│ github_url               │         │ concerns            │
│ portfolio_url            │         │ created_at          │
│ resume_url               │         └─────────────────────┘
│ cover_letter             │
│ years_of_experience      │
│ skills                   │
│ interests                │
│ applied_at               │
│ created_at               │
│ updated_at               │
└──────────────────────────┘
         │
         │ (Accepted applicants become fellows)
         ↓
┌──────────────────────────┐
│    fellow_profiles       │
│──────────────────────────│
│ id (PK)                  │───┐
│ name                     │   │
│ email                    │   │
│ skills                   │   │
│ interests                │   │
│ github_url               │   │
│ linkedin_url             │   │
│ bio                      │   │
│ cohort                   │   │
│ status                   │   │
│ start_date               │   │
│ end_date                 │   │
│ created_at               │   │
│ updated_at               │   │
└──────────────────────────┘   │
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
         │ (fellow_id)                               │ (fellow_id)
         ↓                                           ↓
┌────────────────────┐                    ┌──────────────────────┐
│  delivery_plans    │                    │    placements        │
│────────────────────│                    │──────────────────────│
│ id (PK)            │                    │ id (PK)              │
│ fellow_id (FK)     │                    │ fellow_id (FK)       │
│ title              │                    │ opportunity_id (FK)  │
│ description        │                    │ status               │
│ milestones         │                    │ match_score          │
│ status             │                    │ reasoning            │
│ start_date         │                    │ start_date           │
│ end_date           │                    │ end_date             │
│ created_at         │                    │ created_at           │
│ updated_at         │                    │ updated_at           │
└────────────────────┘                    └──────────────────────┘
                                                     │
                                                     │ (opportunity_id)
                                                     ↓
                                          ┌─────────────────────┐
                                          │   opportunities     │
                                          │─────────────────────│
                                          │ id (PK)             │
                                          │ title               │
                                          │ company             │
                                          │ description         │
                                          │ requirements        │
                                          │ location            │
                                          │ type                │
                                          │ status              │
                                          │ posted_date         │
                                          │ deadline            │
                                          │ created_at          │
                                          │ updated_at          │
                                          └─────────────────────┘

┌──────────────────────┐
│     audit_logs       │
│──────────────────────│
│ id (PK)              │
│ user_id (FK)         │
│ action               │
│ entity_type          │
│ entity_id            │
│ changes              │
│ ip_address           │
│ user_agent           │
│ timestamp            │
└──────────────────────┘
```

### 2.2 Database Tables Summary

| Table | Purpose | Rows (Sample Data) | Key Fields |
|-------|---------|-------------------|------------|
| **users** | Authentication & authorization | ~10 | email, role, hashed_password |
| **applicants** | Program applicants | ~50 | name, email, status, role |
| **screening_results** | AI screening outcomes | ~30 | applicant_id, score, recommendation |
| **fellow_profiles** | Active fellows | ~20 | name, email, cohort, status |
| **delivery_plans** | Learning plans | ~15 | fellow_id, title, milestones |
| **opportunities** | Placement opportunities | ~25 | company, title, requirements |
| **placements** | Fellow placements | ~10 | fellow_id, opportunity_id, match_score |
| **audit_logs** | System audit trail | ~1000+ | user_id, action, entity_type |

---

## 3. SQLAlchemy Models

### 3.1 User Model

**File**: `backend/app/models/user.py`

```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class UserRole(str, enum.Enum):
    """User role enumeration."""
    ADMIN = "admin"
    PROGRAM_MANAGER = "program_manager"
    MENTOR = "mentor"
    FELLOW = "fellow"
    READONLY = "readonly"

class User(Base):
    """
    User model for authentication and authorization.

    Attributes:
        id: Unique user identifier (UUID)
        email: User email (unique, indexed)
        hashed_password: bcrypt hashed password
        full_name: User's full name
        role: User role (admin, program_manager, mentor, fellow, readonly)
        is_active: Whether user account is active
        is_superuser: Superuser bypass all role checks
        permissions: Custom permission strings
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        last_login: Last login timestamp
    """
    __tablename__ = "users"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Authentication
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)

    # Profile
    full_name = Column(String, nullable=False)

    # Authorization
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.READONLY)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    permissions = Column(ARRAY(String), default=list, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"
```

**Database Constraints**:
- `email` must be unique
- `email` is indexed for fast lookups
- `id` is indexed (primary key)
- `role` must be one of enum values

### 3.2 Applicant Model

**File**: `backend/app/models/applicant.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Applicant(Base):
    """
    Applicant model for program applicants.

    Statuses:
        - applied: Initial application received
        - screening: AI screening in progress
        - interview: Selected for interview
        - accepted: Accepted into program
        - rejected: Not accepted
        - waitlisted: On waiting list

    Roles:
        - backend_engineer
        - frontend_engineer
        - fullstack_engineer
        - mobile_engineer
        - devops_engineer
        - data_engineer
    """
    __tablename__ = "applicants"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Personal information
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)

    # Application details
    role = Column(String, nullable=False)  # backend_engineer, frontend_engineer, etc.
    status = Column(String, default="applied", nullable=False)  # applied, screening, interview, accepted, rejected, waitlisted
    source = Column(String, nullable=True)  # linkedin, referral, website, etc.

    # URLs
    github_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    resume_url = Column(String, nullable=True)

    # Application content
    cover_letter = Column(Text, nullable=True)
    years_of_experience = Column(Integer, default=0)
    skills = Column(ARRAY(String), default=list)
    interests = Column(ARRAY(String), default=list)

    # Timestamps
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Applicant {self.name} ({self.status})>"
```

**Key Features**:
- `email` indexed for fast lookups
- `skills` and `interests` stored as PostgreSQL arrays
- `status` tracks application pipeline stage
- `applied_at` separate from `created_at` (allows backdating)

### 3.3 Fellow Profile Model

**File**: `backend/app/models/fellow_profile.py`

```python
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Date, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class FellowProfile(Base):
    """
    Fellow profile model for accepted program participants.

    Statuses:
        - active: Currently in program
        - completed: Finished program
        - dropped: Left program early
        - paused: Temporarily inactive
    """
    __tablename__ = "fellow_profiles"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Personal information
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    bio = Column(Text, nullable=True)

    # Skills and interests
    skills = Column(ARRAY(String), default=list)
    interests = Column(ARRAY(String), default=list)

    # Social links
    github_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)

    # Program details
    cohort = Column(String, nullable=True)  # "2025-Q1", "2025-Q2", etc.
    status = Column(String, default="active", nullable=False)  # active, completed, dropped, paused
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<FellowProfile {self.name} (Cohort: {self.cohort})>"
```

**Relationships** (implicit):
- One fellow can have many delivery plans
- One fellow can have many placements

### 3.4 Screening Result Model

**File**: `backend/app/models/screening_result.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class ScreeningResult(Base):
    """
    Screening result model for AI-generated applicant evaluations.

    Recommendations:
        - strong_accept: Highly qualified
        - accept: Qualified
        - maybe: Borderline
        - reject: Not qualified
    """
    __tablename__ = "screening_results"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign key to applicant
    applicant_id = Column(UUID(as_uuid=True), ForeignKey("applicants.id"), nullable=False, index=True)

    # AI evaluation
    score = Column(Integer, nullable=False)  # 0-100
    recommendation = Column(String, nullable=False)  # strong_accept, accept, maybe, reject
    reasoning = Column(Text, nullable=False)  # Detailed explanation

    # Detailed analysis
    strengths = Column(ARRAY(String), default=list)
    concerns = Column(ARRAY(String), default=list)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<ScreeningResult for Applicant {self.applicant_id} (Score: {self.score})>"
```

**Foreign Key**: `applicant_id` → `applicants.id`
- Each screening result belongs to one applicant
- Applicants can have multiple screening results (if re-screened)

### 3.5 Delivery Plan Model

**File**: `backend/app/models/delivery.py`

```python
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class DeliveryPlan(Base):
    """
    Delivery plan model for fellow learning/project plans.

    Statuses:
        - draft: Plan created but not started
        - active: Currently in progress
        - completed: All milestones finished
        - cancelled: Plan abandoned
    """
    __tablename__ = "delivery_plans"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign key to fellow
    fellow_id = Column(UUID(as_uuid=True), ForeignKey("fellow_profiles.id"), nullable=False, index=True)

    # Plan details
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    milestones = Column(JSON, nullable=True)  # Array of milestone objects
    status = Column(String, default="draft", nullable=False)  # draft, active, completed, cancelled

    # Timeline
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<DeliveryPlan '{self.title}' for Fellow {self.fellow_id}>"
```

**Milestones JSON Structure**:
```json
[
  {
    "id": 1,
    "title": "Complete Python basics",
    "description": "Learn Python fundamentals",
    "status": "completed",
    "due_date": "2025-01-15",
    "completed_date": "2025-01-14"
  },
  {
    "id": 2,
    "title": "Build REST API",
    "description": "Create a FastAPI application",
    "status": "in_progress",
    "due_date": "2025-02-01",
    "completed_date": null
  }
]
```

### 3.6 Opportunity Model

**File**: `backend/app/models/opportunity.py`

```python
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Date, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Opportunity(Base):
    """
    Opportunity model for placement opportunities.

    Types:
        - internship: Short-term internship
        - full_time: Full-time position
        - contract: Contract/freelance work
        - part_time: Part-time position

    Statuses:
        - open: Accepting applications
        - closed: No longer accepting
        - filled: Position filled
    """
    __tablename__ = "opportunities"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Opportunity details
    title = Column(String, nullable=False)
    company = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    requirements = Column(ARRAY(String), default=list)

    # Location and type
    location = Column(String, nullable=True)  # "Remote", "New York, NY", etc.
    type = Column(String, nullable=False)  # internship, full_time, contract, part_time

    # Status
    status = Column(String, default="open", nullable=False)  # open, closed, filled

    # Dates
    posted_date = Column(Date, default=date.today, nullable=False)
    deadline = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Opportunity '{self.title}' at {self.company}>"
```

**Indexed Fields**:
- `id` (primary key, auto-indexed)
- `company` (fast company-based queries)

### 3.7 Placement Model

**File**: `backend/app/models/placement.py`

```python
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Placement(Base):
    """
    Placement model for fellow-opportunity matches.

    Statuses:
        - matched: AI matched, not yet applied
        - applied: Fellow applied to opportunity
        - interviewing: In interview process
        - offered: Received offer
        - accepted: Offer accepted
        - rejected: Not selected
        - declined: Fellow declined offer
    """
    __tablename__ = "placements"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign keys
    fellow_id = Column(UUID(as_uuid=True), ForeignKey("fellow_profiles.id"), nullable=False, index=True)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id"), nullable=False, index=True)

    # Matching details
    status = Column(String, default="matched", nullable=False)
    match_score = Column(Integer, nullable=True)  # 0-100 from AI
    reasoning = Column(Text, nullable=True)  # AI's reasoning for the match

    # Timeline
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Placement Fellow:{self.fellow_id} → Opportunity:{self.opportunity_id} ({self.status})>"
```

**Composite Relationships**:
- One placement links one fellow to one opportunity
- A fellow can have multiple placements (different opportunities)
- An opportunity can have multiple placements (different fellows)

### 3.8 Audit Log Model

**File**: `backend/app/models/audit_log.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class AuditLog(Base):
    """
    Audit log model for tracking all system actions.

    Actions:
        - create: New entity created
        - update: Entity modified
        - delete: Entity deleted
        - login: User logged in
        - logout: User logged out
        - screen: Applicant screened
        - generate_plan: Delivery plan generated
        - match: Placement match created
    """
    __tablename__ = "audit_logs"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign key to user (who performed the action)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    # Action details
    action = Column(String, nullable=False, index=True)  # create, update, delete, login, etc.
    entity_type = Column(String, nullable=True)  # applicant, fellow, delivery_plan, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Change details
    changes = Column(JSON, nullable=True)  # Before/after values

    # Request metadata
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)

    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.entity_type} by User:{self.user_id}>"
```

**Changes JSON Example**:
```json
{
  "before": {
    "status": "applied",
    "role": "backend_engineer"
  },
  "after": {
    "status": "screening",
    "role": "backend_engineer"
  }
}
```

---

## 4. Pydantic Schemas

Pydantic schemas define the structure of request/response data and provide validation.

### 4.1 User Schemas

**File**: `backend/app/schemas/user.py`

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Request schemas
class SignupRequest(BaseModel):
    """Signup request body."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1)
    role: Optional[str] = "readonly"

class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    """Refresh token request body."""
    refresh_token: str

# Response schemas
class UserResponse(BaseModel):
    """User response (excludes password)."""
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    is_superuser: bool
    permissions: List[str]
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True  # Allow ORM model conversion

class TokenResponse(BaseModel):
    """Token response for login/signup."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenRefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

**Validation Features**:
- `EmailStr`: Validates email format
- `Field(..., min_length=8)`: Password must be 8+ characters
- `Optional[str]`: Field can be None
- `from_attributes = True`: Allows converting SQLAlchemy models to Pydantic

### 4.2 Applicant Schemas

**File**: `backend/app/schemas/applicant.py`

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class ApplicantBase(BaseModel):
    """Base applicant schema with common fields."""
    name: str = Field(..., min_length=1)
    email: EmailStr
    role: str
    source: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    years_of_experience: int = 0
    skills: List[str] = []
    interests: List[str] = []

class ApplicantCreate(ApplicantBase):
    """Schema for creating a new applicant."""
    pass

class ApplicantUpdate(BaseModel):
    """Schema for updating an applicant (all fields optional)."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    years_of_experience: Optional[int] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None

class ApplicantResponse(ApplicantBase):
    """Schema for applicant response."""
    id: str
    status: str
    applied_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Schema Patterns**:
- **Base**: Common fields shared across schemas
- **Create**: Required fields for creation
- **Update**: All fields optional (partial updates)
- **Response**: Includes database-generated fields (id, timestamps)

### 4.3 Screening Schemas

**File**: `backend/app/schemas/screening.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ScreeningResultCreate(BaseModel):
    """Schema for creating a screening result."""
    applicant_id: str
    score: int = Field(..., ge=0, le=100)  # 0-100
    recommendation: str  # strong_accept, accept, maybe, reject
    reasoning: str
    strengths: List[str] = []
    concerns: List[str] = []

class ScreeningResultResponse(BaseModel):
    """Schema for screening result response."""
    id: str
    applicant_id: str
    score: int
    recommendation: str
    reasoning: str
    strengths: List[str]
    concerns: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ScreeningRequest(BaseModel):
    """Schema for screening request."""
    applicant_id: str
```

**Validation**:
- `Field(..., ge=0, le=100)`: Score must be between 0 and 100
- `recommendation`: Must be one of predefined values (enforced in endpoint)

### 4.4 Delivery Schemas

**File**: `backend/app/schemas/delivery.py`

```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime

class DeliveryPlanCreate(BaseModel):
    """Schema for creating a delivery plan."""
    fellow_id: str
    title: str
    description: Optional[str] = None
    milestones: Optional[List[Dict[str, Any]]] = []
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class DeliveryPlanUpdate(BaseModel):
    """Schema for updating a delivery plan."""
    title: Optional[str] = None
    description: Optional[str] = None
    milestones: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class DeliveryPlanResponse(BaseModel):
    """Schema for delivery plan response."""
    id: str
    fellow_id: str
    title: str
    description: Optional[str]
    milestones: List[Dict[str, Any]]
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GenerateDeliveryPlanRequest(BaseModel):
    """Schema for AI delivery plan generation."""
    fellow_id: str
    preferences: Optional[Dict[str, Any]] = {}
```

**Milestone Structure** (not enforced by Pydantic, but expected):
```python
{
  "id": 1,
  "title": "Learn Python",
  "description": "Complete Python fundamentals",
  "status": "in_progress",
  "due_date": "2025-02-01"
}
```

---

## 5. API Endpoints Reference

### 5.1 Authentication API

**Base Path**: `/api/auth`

#### POST /api/auth/signup
Create a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "full_name": "John Doe",
  "role": "fellow"
}
```

**Response** (201 Created):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "fellow",
    "is_active": true,
    "is_superuser": false,
    "permissions": []
  }
}
```

**Errors**:
- 400: Email already registered
- 422: Validation error

---

#### POST /api/auth/login
Authenticate and receive tokens.

**Request Body**:
```json
{
  "email": "admin@mentorled.com",
  "password": "admin123"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@mentorled.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true,
    "is_superuser": true,
    "permissions": []
  }
}
```

**Errors**:
- 401: Invalid credentials
- 403: Account inactive

---

#### POST /api/auth/refresh
Refresh access token.

**Request Body**:
```json
{
  "refresh_token": "eyJ..."
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors**:
- 401: Invalid or expired refresh token

---

#### GET /api/auth/me
Get current user information.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "admin@mentorled.com",
  "full_name": "Admin User",
  "role": "admin",
  "is_active": true,
  "is_superuser": true,
  "permissions": [],
  "created_at": "2025-01-01T00:00:00",
  "last_login": "2025-12-26T10:30:00"
}
```

**Errors**:
- 401: Invalid or missing token

---

#### POST /api/auth/logout
Logout (client-side token removal).

**Note**: Backend doesn't maintain session state. Logout is handled by clearing tokens in frontend.

---

#### GET /api/auth/users
List all users (admin only).

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
[
  {
    "id": "uuid1",
    "email": "admin@mentorled.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true
  },
  {
    "id": "uuid2",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "fellow",
    "is_active": true
  }
]
```

**Errors**:
- 401: Not authenticated
- 403: Not admin

---

### 5.2 Applicants API

**Base Path**: `/api/applicants`

#### GET /api/applicants
List all applicants.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "backend_engineer",
    "status": "applied",
    "source": "linkedin",
    "github_url": "https://github.com/johndoe",
    "portfolio_url": "https://johndoe.dev",
    "resume_url": null,
    "cover_letter": "I am interested in...",
    "years_of_experience": 3,
    "skills": ["Python", "FastAPI", "PostgreSQL"],
    "interests": ["AI", "Web Development"],
    "applied_at": "2025-12-20T10:00:00",
    "created_at": "2025-12-20T10:00:00",
    "updated_at": "2025-12-20T10:00:00"
  }
]
```

---

#### POST /api/applicants
Create new applicant.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Request Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "frontend_engineer",
  "source": "website",
  "github_url": "https://github.com/janesmith",
  "years_of_experience": 2,
  "skills": ["React", "TypeScript", "Tailwind"],
  "interests": ["UI/UX", "Accessibility"]
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "status": "applied",
  ...
}
```

**Errors**:
- 401: Not authenticated
- 403: Insufficient permissions (must be admin or program_manager)
- 422: Validation error

---

#### GET /api/applicants/{id}
Get applicant by ID.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "John Doe",
  ...
}
```

**Errors**:
- 401: Not authenticated
- 404: Applicant not found

---

#### PUT /api/applicants/{id}
Update applicant.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Request Body** (partial update):
```json
{
  "status": "screening",
  "skills": ["Python", "FastAPI", "PostgreSQL", "Redis"]
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "status": "screening",
  "skills": ["Python", "FastAPI", "PostgreSQL", "Redis"],
  ...
}
```

**Errors**:
- 401: Not authenticated
- 403: Insufficient permissions
- 404: Applicant not found
- 422: Validation error

---

#### DELETE /api/applicants/{id}
Delete applicant.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (204 No Content)

**Errors**:
- 401: Not authenticated
- 403: Insufficient permissions (admin only)
- 404: Applicant not found

---

### 5.3 Screening API

**Base Path**: `/api/screening`

#### POST /api/screening/screen/{applicant_id}
Screen an applicant with AI.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "applicant_id": "applicant-uuid",
  "score": 85,
  "recommendation": "strong_accept",
  "reasoning": "The candidate demonstrates exceptional technical skills...",
  "strengths": [
    "Strong Python and FastAPI experience",
    "Good GitHub profile with quality projects",
    "Clear communication in cover letter"
  ],
  "concerns": [
    "Limited cloud platform experience"
  ],
  "created_at": "2025-12-26T12:00:00"
}
```

**Errors**:
- 401: Not authenticated
- 403: Insufficient permissions (admin or program_manager only)
- 404: Applicant not found

---

#### GET /api/screening/results
List all screening results.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "applicant_id": "applicant-uuid",
    "score": 85,
    "recommendation": "strong_accept",
    ...
  }
]
```

---

#### GET /api/screening/results/{applicant_id}
Get screening results for specific applicant.

**Headers**:
```
Authorization: Bearer eyJ...
```

**Response** (200 OK):
```json
[
  {
    "id": "result-uuid",
    "applicant_id": "applicant-uuid",
    "score": 85,
    ...
  }
]
```

---

### 5.4 Fellows API

Similar structure to Applicants API:
- GET /api/fellows - List all fellows
- POST /api/fellows - Create fellow
- GET /api/fellows/{id} - Get fellow by ID
- PUT /api/fellows/{id} - Update fellow
- DELETE /api/fellows/{id} - Delete fellow

---

### 5.5 Delivery API

**Base Path**: `/api/delivery`

#### POST /api/delivery/generate
Generate delivery plan with AI.

**Request Body**:
```json
{
  "fellow_id": "fellow-uuid",
  "preferences": {
    "duration_weeks": 12,
    "focus_areas": ["Backend", "Cloud"],
    "learning_style": "project-based"
  }
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "fellow_id": "fellow-uuid",
  "title": "Backend Engineering Learning Path",
  "description": "12-week intensive program...",
  "milestones": [
    {
      "id": 1,
      "title": "Week 1-2: Python Fundamentals",
      "description": "Master Python basics...",
      "tasks": ["..."]
    }
  ],
  "status": "draft",
  "start_date": "2025-01-06",
  "end_date": "2025-03-31"
}
```

---

#### GET /api/delivery
List all delivery plans.

#### GET /api/delivery/{id}
Get delivery plan by ID.

#### PUT /api/delivery/{id}
Update delivery plan.

#### DELETE /api/delivery/{id}
Delete delivery plan.

---

### 5.6 Placement API

**Base Path**: `/api/placement`

#### POST /api/placement/match
Match fellow with opportunities using AI.

**Request Body**:
```json
{
  "fellow_id": "fellow-uuid",
  "opportunity_ids": ["opp-uuid1", "opp-uuid2"]
}
```

**Response** (200 OK):
```json
[
  {
    "id": "placement-uuid",
    "fellow_id": "fellow-uuid",
    "opportunity_id": "opp-uuid1",
    "status": "matched",
    "match_score": 92,
    "reasoning": "Strong alignment between candidate's Python skills and job requirements..."
  }
]
```

---

#### GET /api/placement/matches
List all placements.

#### GET /api/placement/matches/{fellow_id}
Get placements for specific fellow.

#### PUT /api/placement/{id}
Update placement status.

---

### 5.7 Opportunities API

Similar CRUD structure:
- GET /api/opportunities
- POST /api/opportunities
- GET /api/opportunities/{id}
- PUT /api/opportunities/{id}
- DELETE /api/opportunities/{id}

---

## 6. Database Migrations

### 6.1 Alembic Overview

**Alembic** is the database migration tool for SQLAlchemy.

**Migration Flow**:
```
Code changes in models → Generate migration → Review migration → Apply migration → Database updated
```

### 6.2 Creating Migrations

**Auto-generate migration** (recommended):
```bash
# Inside backend container
docker-compose exec backend alembic revision --autogenerate -m "Add users table"
```

**What it does**:
1. Compares current database state to SQLAlchemy models
2. Generates migration file in `backend/alembic/versions/`
3. Creates upgrade() and downgrade() functions

**Generated file** (example):
```python
"""Add users table

Revision ID: abc123def456
Revises:
Create Date: 2025-12-26 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'abc123def456'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('role', sa.Enum('admin', 'program_manager', 'mentor', 'fellow', 'readonly', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_superuser', sa.Boolean(), nullable=False),
        sa.Column('permissions', sa.ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

def downgrade():
    # Drop users table
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
```

### 6.3 Applying Migrations

**Apply all pending migrations**:
```bash
docker-compose exec backend alembic upgrade head
```

**Rollback one migration**:
```bash
docker-compose exec backend alembic downgrade -1
```

**View migration history**:
```bash
docker-compose exec backend alembic history
```

**View current version**:
```bash
docker-compose exec backend alembic current
```

### 6.4 Migration Best Practices

✅ **Always review auto-generated migrations**:
- Alembic might not detect all changes
- Verify upgrade() and downgrade() are correct

✅ **Test migrations**:
- Apply to dev database first
- Test both upgrade and downgrade
- Verify data integrity

✅ **Use descriptive migration messages**:
```bash
# Good:
alembic revision --autogenerate -m "Add applicant_status_index"

# Bad:
alembic revision --autogenerate -m "Update"
```

✅ **Never edit applied migrations**:
- Create a new migration instead
- Keeps migration history clean

✅ **Backup before migrations in production**:
```bash
pg_dump mentorled > backup_before_migration.sql
```

---

## 7. API Design Patterns

### 7.1 RESTful Conventions

MentorLed follows REST principles:

| Method | Path | Purpose | Response Code |
|--------|------|---------|---------------|
| GET | /api/resource | List all | 200 OK |
| GET | /api/resource/{id} | Get one | 200 OK |
| POST | /api/resource | Create | 201 Created |
| PUT | /api/resource/{id} | Update (full) | 200 OK |
| PATCH | /api/resource/{id} | Update (partial) | 200 OK |
| DELETE | /api/resource/{id} | Delete | 204 No Content |

**Example**:
```
GET    /api/applicants          → List all applicants
GET    /api/applicants/uuid     → Get applicant by ID
POST   /api/applicants          → Create new applicant
PUT    /api/applicants/uuid     → Update applicant
DELETE /api/applicants/uuid     → Delete applicant
```

### 7.2 Response Patterns

**Single resource**:
```json
{
  "id": "uuid",
  "field1": "value1"
}
```

**Collection**:
```json
[
  {"id": "uuid1", "name": "Item 1"},
  {"id": "uuid2", "name": "Item 2"}
]
```

**Error**:
```json
{
  "detail": "Error message"
}
```

### 7.3 Async/Await Pattern

All database operations are async:

```python
@router.get("/applicants")
async def list_applicants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Async database query
    result = await db.execute(select(Applicant))
    applicants = result.scalars().all()
    return applicants
```

**Benefits**:
- Non-blocking I/O
- Better performance under load
- Efficient resource usage

### 7.4 Dependency Injection

FastAPI uses dependency injection for:
- Database sessions
- Authentication
- Authorization

**Example**:
```python
async def create_applicant(
    applicant_data: ApplicantCreate,  # Request body (validated by Pydantic)
    db: AsyncSession = Depends(get_db),  # Injected database session
    current_user: User = Depends(get_current_user)  # Injected authenticated user
):
    # Function logic
    pass
```

**Execution order**:
1. Extract request body → Validate with Pydantic
2. Execute `get_db()` → Yield database session
3. Execute `get_current_user()` → Validate token, return user
4. Call `create_applicant()` with all dependencies

### 7.5 Error Handling

**HTTPException** for expected errors:
```python
from fastapi import HTTPException, status

if not applicant:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Applicant not found"
    )
```

**Validation errors** (automatic):
```python
class ApplicantCreate(BaseModel):
    email: EmailStr  # Automatically validates email format
    name: str = Field(..., min_length=1)  # Validates non-empty string
```

**Try-except for unexpected errors**:
```python
try:
    await db.commit()
except Exception as e:
    await db.rollback()
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Database error: {str(e)}"
    )
```

---

## Summary (Part 3)

This part covered **backend APIs and database**:

✅ API architecture (FastAPI, router organization)
✅ Complete database schema (8 tables, relationships)
✅ SQLAlchemy models (User, Applicant, Fellow, Screening, Delivery, Placement, Opportunity, AuditLog)
✅ Pydantic schemas (validation, request/response)
✅ Complete API endpoint reference (30+ endpoints)
✅ Database migrations with Alembic
✅ API design patterns (REST, async, dependency injection)

**Next in Part 4**: Frontend Components & State Management
- React component architecture
- State management patterns
- UI component library
- Page components
- Client-side routing
- Data fetching patterns

---

**Navigation**:
- Part 1 - System Overview & Architecture ✓
- Part 2 - Authentication Flow Deep Dive ✓
- **Current**: Part 3 - Backend APIs & Database ✓
- **Next**: Part 4 - Frontend Components & State Management
- Part 5 - AI Agents & Workflows
- Part 6 - Deployment & Production Readiness
