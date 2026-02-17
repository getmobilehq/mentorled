from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# --- Sprint Schemas ---

class SprintCreate(BaseModel):
    team_id: UUID
    sprint_number: int = Field(..., ge=1, le=6)
    goal: Optional[str] = None
    start_date: date
    end_date: date


class SprintUpdate(BaseModel):
    goal: Optional[str] = None
    status: Optional[str] = None
    completion_score: Optional[float] = None


class SprintStatusUpdate(BaseModel):
    status: str


# --- Sprint Objective Schemas ---

class SprintObjectiveCreate(BaseModel):
    sprint_id: UUID
    description: str = Field(..., min_length=1)
    owner_role: str = Field(..., min_length=1, max_length=50)
    owner_fellow_id: Optional[UUID] = None


class SprintObjectiveUpdate(BaseModel):
    description: Optional[str] = None
    owner_role: Optional[str] = None
    owner_fellow_id: Optional[UUID] = None
    status: Optional[str] = None
    evidence_url: Optional[str] = None
    evidence_type: Optional[str] = None


class SprintObjectiveResponse(BaseModel):
    id: UUID
    sprint_id: UUID
    description: str
    owner_role: str
    owner_fellow_id: Optional[UUID] = None
    status: str
    evidence_url: Optional[str] = None
    evidence_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Sprint Response Schemas ---

class SprintResponse(BaseModel):
    id: UUID
    team_id: UUID
    sprint_number: int
    goal: Optional[str] = None
    status: str
    start_date: date
    end_date: date
    completion_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    objectives: List[SprintObjectiveResponse] = []

    class Config:
        from_attributes = True


class SprintListResponse(BaseModel):
    id: UUID
    team_id: UUID
    sprint_number: int
    goal: Optional[str] = None
    status: str
    start_date: date
    end_date: date
    completion_score: Optional[float] = None
    objective_count: int = 0
    completed_objectives: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Retrospective Schemas ---

class RetrospectiveCreate(BaseModel):
    sprint_id: UUID
    what_worked: List[str] = Field(..., min_length=1)
    what_didnt_work: List[str] = Field(..., min_length=1)
    what_to_improve: List[str] = Field(..., min_length=1)
    team_mood: str
    sprint_rating: int = Field(..., ge=1, le=10)
    submitted_by: Optional[UUID] = None


class RetrospectiveResponse(BaseModel):
    id: UUID
    sprint_id: UUID
    what_worked: List[str] = []
    what_didnt_work: List[str] = []
    what_to_improve: List[str] = []
    team_mood: Optional[str] = None
    sprint_rating: Optional[int] = None
    submitted_by: Optional[UUID] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
