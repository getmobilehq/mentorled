from sqlalchemy import (
    String, Integer, Text, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List

from app.database import Base


class Retrospective(Base):
    __tablename__ = "retrospectives"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sprint_id: Mapped[UUID] = mapped_column(
        ForeignKey("sprints.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    what_worked: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    what_didnt_work: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    what_to_improve: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    team_mood: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sprint_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    submitted_by: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("fellows.id"), nullable=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    ai_insights: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    sprint: Mapped["Sprint"] = relationship("Sprint", back_populates="retrospective")
    submitter: Mapped[Optional["Fellow"]] = relationship("Fellow")
