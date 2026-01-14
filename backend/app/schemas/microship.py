"""Pydantic schemas for Microship submissions and evaluations."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class MicroshipSubmissionCreate(BaseModel):
    """Schema for creating a Microship submission."""
    applicant_id: UUID
    challenge_id: Optional[str] = None
    submission_url: Optional[str] = None
    submission_type: Optional[str] = None  # github, figma, document
    submitted_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    on_time: Optional[bool] = None
    acknowledgment_time: Optional[datetime] = None
    communication_log: Optional[List[Dict[str, Any]]] = []


class MicroshipSubmissionResponse(BaseModel):
    """Schema for Microship submission response."""
    id: UUID
    applicant_id: UUID
    challenge_id: Optional[str]
    submission_url: Optional[str]
    submission_type: Optional[str]
    submitted_at: Optional[datetime]
    deadline: Optional[datetime]
    on_time: Optional[bool]
    acknowledgment_time: Optional[datetime]
    communication_log: Optional[List[Dict[str, Any]]]
    raw_analysis: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class MicroshipEvaluationRequest(BaseModel):
    """Schema for requesting Microship evaluation."""
    submission_id: UUID


class MicroshipScores(BaseModel):
    """Microship evaluation scores."""
    technical_execution: int = Field(..., ge=1, le=4)
    execution_discipline: int = Field(..., ge=1, le=4)
    professional_behavior: int = Field(..., ge=1, le=4)
    instruction_following: int = Field(..., ge=1, le=4)


class MicroshipEvidence(BaseModel):
    """Evidence supporting the evaluation."""
    technical: str
    execution: str
    professional: str
    instructions: str


class MicroshipEvaluationResult(BaseModel):
    """Complete evaluation result from AI."""
    scores: MicroshipScores
    weighted_score: float = Field(..., ge=1.0, le=4.0)
    outcome: str  # progress, borderline, do_not_progress
    evidence: MicroshipEvidence
    disqualifiers: Optional[List[str]] = None
    strengths: List[str] = []
    concerns: List[str] = []
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str


class MicroshipEvaluationResponse(BaseModel):
    """Response from evaluation endpoint."""
    submission_id: UUID
    applicant_id: UUID
    applicant_name: str
    evaluation: MicroshipEvaluationResult
    evaluated_at: datetime
