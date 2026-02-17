from sqlalchemy import (
    String, Text, Integer, Numeric, Date, ForeignKey,
    UniqueConstraint, Enum as SQLEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base


class SprintStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"


class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = (
        UniqueConstraint('team_id', 'sprint_number', name='uq_team_sprint_number'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    sprint_number: Mapped[int] = mapped_column(Integer, nullable=False)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SQLEnum(SprintStatus), default=SprintStatus.PENDING, nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    completion_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="sprints")
    objectives: Mapped[List["SprintObjective"]] = relationship(
        "SprintObjective", back_populates="sprint", cascade="all, delete-orphan"
    )
    meetings: Mapped[List["Meeting"]] = relationship(
        "Meeting", back_populates="sprint", cascade="all, delete-orphan"
    )
    retrospective: Mapped[Optional["Retrospective"]] = relationship(
        "Retrospective", back_populates="sprint", uselist=False,
        cascade="all, delete-orphan"
    )
