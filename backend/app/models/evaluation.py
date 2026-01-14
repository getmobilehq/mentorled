from sqlalchemy import String, Text, Boolean, ForeignKey, Numeric, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class EvaluationType(str, enum.Enum):
    APPLICATION = "application"
    MICROSHIP = "microship"

class ApplicationEvaluation(Base):
    __tablename__ = "application_evaluations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    applicant_id: Mapped[UUID] = mapped_column(
        ForeignKey("applicants.id", ondelete="CASCADE"),
        nullable=False
    )
    evaluation_type: Mapped[str] = mapped_column(
        SQLEnum(EvaluationType),
        default=EvaluationType.APPLICATION,
        nullable=False
    )
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False)
    overall_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    flags: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    model_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    prompt_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    evaluated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    human_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    human_reviewer_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    human_override: Mapped[bool] = mapped_column(Boolean, default=False)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    applicant: Mapped["Applicant"] = relationship(
        "Applicant",
        back_populates="evaluations"
    )
