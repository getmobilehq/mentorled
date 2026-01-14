from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional, List, Dict, Any

class CheckInCreate(BaseModel):
    fellow_id: UUID4
    week: int
    accomplishments: Optional[str] = None
    next_focus: Optional[str] = None
    blockers: Optional[str] = None
    needs_help: Optional[str] = None
    self_assessment: Optional[str] = None
    collaboration_rating: Optional[str] = None
    energy_level: Optional[int] = None

class CheckInResponse(BaseModel):
    id: UUID4
    fellow_id: UUID4
    week: int
    accomplishments: Optional[str]
    next_focus: Optional[str]
    blockers: Optional[str]
    needs_help: Optional[str]
    self_assessment: Optional[str]
    collaboration_rating: Optional[str]
    energy_level: Optional[int]
    submitted_at: datetime
    analysis: Optional[Dict[str, Any]]
    sentiment_score: Optional[float]
    risk_contribution: Optional[float]
    blockers_extracted: Optional[List[str]]
    action_items: Optional[List[str]]
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True

class CheckInAnalysisRequest(BaseModel):
    check_in_id: UUID4

class CheckInAnalysis(BaseModel):
    """AI analysis results for a check-in."""
    sentiment_score: float  # -1.0 to 1.0
    risk_contribution: float  # 0.0 to 1.0
    blockers_extracted: List[str] = []
    action_items: List[str] = []
    themes: List[str] = []
    concerns: List[str] = []
    positive_signals: List[str] = []
    confidence: float  # 0.0 to 1.0
    summary: str

class CheckInAnalysisResponse(BaseModel):
    """Response from check-in analysis endpoint."""
    check_in_id: UUID4
    fellow_id: UUID4
    fellow_name: str
    week: int
    analysis: CheckInAnalysis
    analyzed_at: datetime

class RiskAssessmentRequest(BaseModel):
    fellow_id: UUID4
    week: int

class RiskAssessmentResponse(BaseModel):
    id: UUID4
    fellow_id: UUID4
    week: int
    risk_level: str
    risk_score: float
    signals: Dict[str, float]
    concerns: Optional[Dict[str, Any]]
    recommended_action: Optional[str]
    assessed_at: datetime

    class Config:
        from_attributes = True
