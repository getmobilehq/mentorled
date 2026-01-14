from pydantic import BaseModel, EmailStr, UUID4, HttpUrl
from datetime import datetime
from typing import Optional

class ApplicantBase(BaseModel):
    email: EmailStr
    name: str
    role: str
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    project_description: Optional[str] = None
    time_commitment: bool = False
    source: Optional[str] = None

class ApplicantCreate(ApplicantBase):
    cohort_id: UUID4

class ApplicantUpdate(BaseModel):
    status: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    project_description: Optional[str] = None
    time_commitment: Optional[bool] = None

class ApplicantResponse(ApplicantBase):
    id: UUID4
    cohort_id: UUID4
    status: str
    applied_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
