from sqlalchemy import String, Text, Integer, ForeignKey, Numeric, UniqueConstraint, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class SelfAssessment(str, enum.Enum):
    EXCEEDED = "exceeded"
    MET = "met"
    BELOW = "below"

class CollaborationRating(str, enum.Enum):
    GREAT = "great"
    GOOD = "good"
    OKAY = "okay"
    STRUGGLING = "struggling"

class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (
        UniqueConstraint('fellow_id', 'week', name='uq_fellow_week'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"),
        nullable=False
    )
    week: Mapped[int] = mapped_column(Integer, nullable=False)
    accomplishments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_focus: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blockers: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    needs_help: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    self_assessment: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    collaboration_rating: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    energy_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # AI Analysis Results
    analysis: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    risk_contribution: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    blockers_extracted: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    action_items: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="check_ins")
