"""Mentor 1-on-1 meeting notes model."""
from sqlalchemy import String, Text, ForeignKey, func, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime, date
from uuid import UUID, uuid4
from typing import Optional, List

from app.database import Base


class MentorNote(Base):
    __tablename__ = "mentor_notes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    mentor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    action_items: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    mood: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    next_meeting_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow")
