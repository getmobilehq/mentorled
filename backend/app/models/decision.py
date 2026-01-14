from sqlalchemy import String, Text, Boolean, Numeric, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class EntityType(str, enum.Enum):
    APPLICANT = "applicant"
    FELLOW = "fellow"
    TEAM = "team"

class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(
        SQLEnum(EntityType),
        nullable=False
    )
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    decision_type: Mapped[str] = mapped_column(String(50), nullable=False)
    decision: Mapped[str] = mapped_column(String(50), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_refs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    made_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    made_by_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
