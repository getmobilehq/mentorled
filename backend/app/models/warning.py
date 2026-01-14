from sqlalchemy import String, Text, Boolean, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class WarningLevel(str, enum.Enum):
    FIRST = "first"
    FINAL = "final"

class WarningOutcome(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    ESCALATED = "escalated"
    REMOVAL = "removal"

class Warning(Base):
    __tablename__ = "warnings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"),
        nullable=False
    )
    level: Mapped[str] = mapped_column(
        SQLEnum(WarningLevel),
        nullable=False
    )
    concerns: Mapped[list] = mapped_column(ARRAY(Text), nullable=False)
    requirements: Mapped[list] = mapped_column(ARRAY(Text), nullable=False)
    evidence_refs: Mapped[Optional[list]] = mapped_column(ARRAY(PGUUID(as_uuid=True)), nullable=True)
    review_deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    draft_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issued_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    issued_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="warnings")
