from sqlalchemy import String, Text, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base


class ObjectiveStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    NOT_DONE = "not_done"


class SprintObjective(Base):
    __tablename__ = "sprint_objectives"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sprint_id: Mapped[UUID] = mapped_column(
        ForeignKey("sprints.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    owner_role: Mapped[str] = mapped_column(String(50), nullable=False)
    owner_fellow_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("fellows.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(ObjectiveStatus), default=ObjectiveStatus.NOT_STARTED, nullable=False
    )
    evidence_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    sprint: Mapped["Sprint"] = relationship("Sprint", back_populates="objectives")
    owner: Mapped[Optional["Fellow"]] = relationship("Fellow")
