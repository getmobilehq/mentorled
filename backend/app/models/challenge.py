from sqlalchemy import String, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum
import secrets

from app.database import Base


class ChallengeStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cohort_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("cohorts.id", ondelete="SET NULL"),
        nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[Optional[list]] = mapped_column(
        JSONB, default=list, server_default='[]'
    )
    role_type: Mapped[str] = mapped_column(
        String(50), default="all", server_default="all"
    )
    submission_types: Mapped[Optional[list]] = mapped_column(
        JSONB, default=list, server_default='[]'
    )
    deadline: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ChallengeStatus.DRAFT.value, nullable=False
    )
    share_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False,
        default=lambda: secrets.token_urlsafe(32)
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Auto-evaluate submissions on receipt
    auto_evaluate: Mapped[bool] = mapped_column(default=False)

    # Track configuration fields (nullable for backward compatibility)
    duration_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sequence_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    track_config_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("challenge_track_configs.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    cohort: Mapped[Optional["Cohort"]] = relationship("Cohort")
    track_config: Mapped[Optional["ChallengeTrackConfig"]] = relationship(
        "ChallengeTrackConfig", back_populates="challenges"
    )
    submissions: Mapped[List["MicroshipSubmission"]] = relationship(
        "MicroshipSubmission",
        back_populates="challenge",
        foreign_keys="[MicroshipSubmission.challenge_ref]"
    )
