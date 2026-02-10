from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# --- Track Config Schemas ---

class TrackConfigCreate(BaseModel):
    cohort_id: UUID
    role_type: str = Field(..., min_length=1, max_length=50)
    total_challenges: int = Field(..., ge=1)


class TrackConfigUpdate(BaseModel):
    total_challenges: int = Field(..., ge=1)


class TrackConfigResponse(BaseModel):
    id: UUID
    cohort_id: UUID
    role_type: str
    total_challenges: int
    challenges_created: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Challenge Schemas ---

class ChallengeCreate(BaseModel):
    cohort_id: Optional[UUID] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    requirements: List[str] = []
    role_type: str = "all"
    submission_types: List[str] = Field(default=["github", "figma", "document"])
    deadline: datetime
    auto_evaluate: bool = False
    duration_hours: Optional[int] = None
    sequence_number: Optional[int] = None
    track_config_id: Optional[UUID] = None


class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    role_type: Optional[str] = None
    submission_types: Optional[List[str]] = None
    deadline: Optional[datetime] = None
    auto_evaluate: Optional[bool] = None
    cohort_id: Optional[UUID] = None
    duration_hours: Optional[int] = None
    sequence_number: Optional[int] = None
    track_config_id: Optional[UUID] = None


class ChallengeStatusUpdate(BaseModel):
    status: str


class ChallengeResponse(BaseModel):
    id: UUID
    cohort_id: Optional[UUID] = None
    title: str
    description: str
    requirements: List[str] = []
    role_type: str
    submission_types: List[str] = []
    deadline: datetime
    status: str
    share_token: str
    created_by: Optional[UUID] = None
    auto_evaluate: bool = False
    duration_hours: Optional[int] = None
    sequence_number: Optional[int] = None
    track_config_id: Optional[UUID] = None
    total_in_track: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChallengePublicResponse(BaseModel):
    id: UUID
    title: str
    description: str
    requirements: List[str] = []
    role_type: str
    submission_types: List[str] = []
    deadline: datetime
    status: str
    sequence_number: Optional[int] = None
    total_in_track: Optional[int] = None
    duration_hours: Optional[int] = None

    class Config:
        from_attributes = True


# --- AI Generation Schemas ---

class ChallengeGenerateRequest(BaseModel):
    role_type: str = Field(..., min_length=1)
    duration_hours: Optional[int] = None
    sequence_number: Optional[int] = None
    total_in_track: Optional[int] = None
    track_config_id: Optional[UUID] = None
    existing_title: Optional[str] = None
    existing_description: Optional[str] = None


class ChallengeGenerateResponse(BaseModel):
    title: str
    description: str
    requirements: List[str]


class PublicSubmissionCreate(BaseModel):
    email: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    submission_url: str = Field(..., min_length=1)
    submission_type: str
    notes: Optional[str] = None


class PublicSubmissionResponse(BaseModel):
    message: str
    submission_id: UUID
    challenge_title: str
    submitted_at: datetime
