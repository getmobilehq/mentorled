"""Absence request model for fellows to request approved absences."""
from sqlalchemy import String, Text, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base


class AbsenceRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


class AbsenceRequest(Base):
    __tablename__ = "absence_requests"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"), nullable=False
    )
    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum(AbsenceRequestStatus),
        default=AbsenceRequestStatus.PENDING,
        nullable=False,
    )
    requested_at: Mapped[datetime] = mapped_column(server_default=func.now())
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    reviewed_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow")
    meeting: Mapped["Meeting"] = relationship("Meeting")
