from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional, Dict, List, Any

class ApplicationEvaluationRequest(BaseModel):
    applicant_id: UUID4

class ApplicationEvaluationResponse(BaseModel):
    evaluation_id: UUID4
    applicant_id: UUID4
    scores: Dict[str, Any]
    overall_score: float
    eligibility: str
    reasoning: str
    flags: List[str]
    confidence: float
    recommended_action: str
    requires_human_review: bool

class MicroshipEvaluationRequest(BaseModel):
    submission_id: UUID4
    content: Optional[str] = None  # For PRD/design submissions

class MicroshipEvaluationResponse(BaseModel):
    evaluation_id: UUID4
    applicant_id: UUID4
    scores: Dict[str, float]
    weighted_score: float
    outcome: str
    evidence: Dict[str, str]
    strengths: List[str]
    concerns: List[str]
    disqualifiers: Optional[List[str]]
    confidence: float
    requires_human_review: bool

class ScreeningQueueResponse(BaseModel):
    pending_applications: int
    pending_microships: int
    requires_review: int
    total_in_queue: int

class EvaluationApprovalRequest(BaseModel):
    approved: bool
    override_decision: Optional[str] = None
    override_reason: Optional[str] = None
    reviewer_id: Optional[UUID4] = None
