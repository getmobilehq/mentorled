"""Pydantic schemas for Team management."""
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime


class TeamCreate(BaseModel):
    cohort_id: UUID
    name: str
    brief_title: Optional[str] = None
    brief_description: Optional[str] = None
    mentor_id: Optional[UUID] = None
    slack_channel: Optional[str] = None
    github_repo: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    brief_title: Optional[str] = None
    brief_description: Optional[str] = None
    mentor_id: Optional[UUID] = None
    slack_channel: Optional[str] = None
    github_repo: Optional[str] = None
    status: Optional[str] = None


class TeamResponse(BaseModel):
    id: UUID
    cohort_id: UUID
    name: str
    brief_title: Optional[str] = None
    brief_description: Optional[str] = None
    mentor_name: Optional[str] = None
    slack_channel: Optional[str] = None
    github_repo: Optional[str] = None
    status: str
    member_count: int = 0
    sprint_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
