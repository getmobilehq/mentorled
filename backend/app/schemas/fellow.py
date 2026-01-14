from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional

class FellowBase(BaseModel):
    role: str
    status: str = "active"

class FellowCreate(FellowBase):
    applicant_id: UUID4
    cohort_id: UUID4
    team_id: Optional[UUID4] = None
    microship_score: Optional[float] = None

class FellowUpdate(BaseModel):
    team_id: Optional[UUID4] = None
    status: Optional[str] = None
    current_risk_score: Optional[float] = None
    milestone_1_score: Optional[float] = None
    milestone_2_score: Optional[float] = None
    milestone_3_score: Optional[float] = None
    final_score: Optional[float] = None
    warnings_count: Optional[int] = None

class FellowResponse(FellowBase):
    id: UUID4
    applicant_id: UUID4
    cohort_id: UUID4
    team_id: Optional[UUID4]
    microship_score: Optional[float]
    current_risk_score: Optional[float]
    milestone_1_score: Optional[float]
    milestone_2_score: Optional[float]
    milestone_3_score: Optional[float]
    final_score: Optional[float]
    warnings_count: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
