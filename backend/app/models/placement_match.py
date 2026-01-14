from sqlalchemy import String, Text, Integer, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class MatchStatus(str, enum.Enum):
    SUGGESTED = "suggested"
    APPROVED = "approved"
    INTRODUCED = "introduced"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"

class PlacementMatch(Base):
    __tablename__ = "placement_matches"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(ForeignKey("fellows.id"), nullable=False)
    opportunity_id: Mapped[UUID] = mapped_column(
        ForeignKey("job_opportunities.id"),
        nullable=False
    )
    match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    match_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SQLEnum(MatchStatus),
        default=MatchStatus.SUGGESTED,
        nullable=False
    )
    introduction_draft: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    introduction_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    outcome_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="placement_matches")
    opportunity: Mapped["JobOpportunity"] = relationship(
        "JobOpportunity",
        back_populates="matches"
    )
