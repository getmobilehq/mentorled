from sqlalchemy import String, Text, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base

class TeamStatus(str, enum.Enum):
    FORMING = "forming"
    ACTIVE = "active"
    COMPLETED = "completed"

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cohort_id: Mapped[UUID] = mapped_column(ForeignKey("cohorts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    brief_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    brief_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mentor_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("mentors.id"), nullable=True)
    slack_channel: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    github_repo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SQLEnum(TeamStatus),
        default=TeamStatus.FORMING,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    cohort: Mapped["Cohort"] = relationship("Cohort", back_populates="teams")
    mentor: Mapped[Optional["Mentor"]] = relationship("Mentor", back_populates="teams")
    fellows: Mapped[List["Fellow"]] = relationship(
        "Fellow",
        back_populates="team",
        cascade="all, delete-orphan"
    )
