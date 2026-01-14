from sqlalchemy import String, ForeignKey, Integer, Numeric, UniqueConstraint, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class RiskLevel(str, enum.Enum):
    ON_TRACK = "on_track"
    MONITOR = "monitor"
    AT_RISK = "at_risk"
    CRITICAL = "critical"

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        UniqueConstraint('fellow_id', 'week', name='uq_fellow_week_risk'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"),
        nullable=False
    )
    week: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[str] = mapped_column(
        SQLEnum(RiskLevel),
        nullable=False
    )
    risk_score: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    signals: Mapped[dict] = mapped_column(JSONB, nullable=False)
    concerns: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    recommended_action: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    action_taken: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actioned_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    actioned_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    assessed_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="risk_assessments")
