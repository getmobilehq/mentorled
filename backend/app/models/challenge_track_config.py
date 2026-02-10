from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List

from app.database import Base


class ChallengeTrackConfig(Base):
    __tablename__ = "challenge_track_configs"
    __table_args__ = (
        UniqueConstraint("cohort_id", "role_type", name="uq_track_config_cohort_role"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cohort_id: Mapped[UUID] = mapped_column(
        ForeignKey("cohorts.id", ondelete="CASCADE"),
        nullable=False
    )
    role_type: Mapped[str] = mapped_column(String(50), nullable=False)
    total_challenges: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    cohort: Mapped[Optional["Cohort"]] = relationship("Cohort")
    challenges: Mapped[List["Challenge"]] = relationship(
        "Challenge", back_populates="track_config"
    )
