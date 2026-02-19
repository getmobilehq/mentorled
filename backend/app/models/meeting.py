from sqlalchemy import (
    String, Integer, Boolean, Text, ForeignKey,
    Enum as SQLEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base


class MeetingType(str, enum.Enum):
    SPRINT_PLANNING = "sprint_planning"
    STANDUP = "standup"
    SPRINT_REVIEW = "sprint_review"
    SPRINT_RETROSPECTIVE = "sprint_retrospective"


class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    UNLOCKED = "unlocked"
    ACTIVE = "active"
    COMPLETED = "completed"


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sprint_id: Mapped[UUID] = mapped_column(
        ForeignKey("sprints.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    meeting_type: Mapped[str] = mapped_column(
        SQLEnum(MeetingType), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    meeting_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    unlock_time: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum(MeetingStatus), default=MeetingStatus.SCHEDULED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    sprint: Mapped["Sprint"] = relationship("Sprint", back_populates="meetings")
    team: Mapped["Team"] = relationship("Team", back_populates="meetings")
    attendance_records: Mapped[List["Attendance"]] = relationship(
        "Attendance", back_populates="meeting", cascade="all, delete-orphan"
    )
