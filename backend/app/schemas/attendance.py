from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class AttendanceResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    fellow_id: UUID
    status: str
    joined_at: Optional[datetime] = None
    minutes_late: Optional[int] = None
    approved_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceApproveRequest(BaseModel):
    fellow_id: UUID


class AttendanceSummary(BaseModel):
    fellow_id: UUID
    fellow_name: str
    role: str
    total_meetings: int
    present_count: int
    late_count: int
    very_late_count: int
    absent_count: int
    approved_absence_count: int
    attendance_score: float


class TeamAttendanceSummary(BaseModel):
    team_id: UUID
    team_average: float
    total_meetings: int
    members: List[AttendanceSummary]
