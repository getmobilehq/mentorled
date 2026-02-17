from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class MeetingResponse(BaseModel):
    id: UUID
    sprint_id: UUID
    team_id: UUID
    meeting_type: str
    scheduled_at: datetime
    duration_minutes: int
    meeting_link: Optional[str] = None
    is_locked: bool
    unlock_time: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceInMeeting(BaseModel):
    id: UUID
    fellow_id: UUID
    status: str
    joined_at: Optional[datetime] = None
    minutes_late: Optional[int] = None

    class Config:
        from_attributes = True


class MeetingDetailResponse(BaseModel):
    id: UUID
    sprint_id: UUID
    team_id: UUID
    meeting_type: str
    scheduled_at: datetime
    duration_minutes: int
    meeting_link: Optional[str] = None
    is_locked: bool
    unlock_time: datetime
    status: str
    created_at: datetime
    attendance_records: List[AttendanceInMeeting] = []

    class Config:
        from_attributes = True


class MeetingJoinResponse(BaseModel):
    meeting_link: Optional[str] = None
    attendance_recorded: bool
    status: str
    minutes_late: int
