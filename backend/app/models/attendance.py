from sqlalchemy import (
    Integer, ForeignKey, UniqueConstraint,
    Enum as SQLEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"
    VERY_LATE = "very_late"
    ABSENT = "absent"
    APPROVED_ABSENCE = "approved_absence"


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint('meeting_id', 'fellow_id', name='uq_meeting_fellow'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(AttendanceStatus), nullable=False
    )
    joined_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    minutes_late: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    approved_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="attendance_records")
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="attendance_records")
