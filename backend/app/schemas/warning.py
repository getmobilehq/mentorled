"""Pydantic schemas for warnings."""
from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import datetime


class WarningDraftRequest(BaseModel):
    """Request to draft a warning."""
    fellow_id: UUID4
    level: str  # first, final
    concerns: List[str]


class WarningDraft(BaseModel):
    """AI-generated warning draft."""
    message: str
    tone: str
    key_points: List[str]
    requirements: List[str]
    timeline: str
    recommended_followup: str
    escalation_note: Optional[str] = None


class WarningDraftResponse(BaseModel):
    """Response from draft endpoint."""
    fellow_id: UUID4
    fellow_name: str
    level: str
    draft: WarningDraft
    drafted_at: datetime


class WarningCreate(BaseModel):
    """Schema for creating a warning."""
    fellow_id: UUID4
    level: str  # first, final
    concerns: List[str]
    requirements: List[str]
    evidence_refs: Optional[List[UUID4]] = None
    review_deadline: Optional[datetime] = None
    draft_message: Optional[str] = None


class WarningUpdate(BaseModel):
    """Schema for updating a warning before sending."""
    final_message: str


class WarningResponse(BaseModel):
    """Schema for warning response."""
    id: UUID4
    fellow_id: UUID4
    level: str
    concerns: List[str]
    requirements: List[str]
    evidence_refs: Optional[List[UUID4]]
    review_deadline: Optional[datetime]
    draft_message: Optional[str]
    final_message: Optional[str]
    issued_at: Optional[datetime]
    issued_by: Optional[UUID4]
    acknowledged: bool
    acknowledged_at: Optional[datetime]
    outcome: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WarningIssueRequest(BaseModel):
    """Request to issue a warning."""
    send_email: bool = True


class WarningAcknowledgeRequest(BaseModel):
    """Request to acknowledge a warning."""
    response: Optional[str] = None
