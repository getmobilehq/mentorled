from sqlalchemy import String, Integer, ForeignKey, Numeric, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base

class FellowStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_TRACK = "on_track"
    MONITOR = "monitor"
    AT_RISK = "at_risk"
    CRITICAL = "critical"
    WARNING = "warning"
    FINAL_WARNING = "final_warning"
    REMOVED = "removed"
    GRADUATED = "graduated"
    GRADUATED_DISTINCTION = "graduated_distinction"
    DID_NOT_GRADUATE = "did_not_graduate"

class Fellow(Base):
    __tablename__ = "fellows"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    applicant_id: Mapped[UUID] = mapped_column(ForeignKey("applicants.id"), nullable=False)
    cohort_id: Mapped[UUID] = mapped_column(ForeignKey("cohorts.id"), nullable=False)
    team_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("teams.id"), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum(FellowStatus),
        default=FellowStatus.ACTIVE,
        nullable=False
    )
    microship_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    current_risk_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    milestone_1_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    milestone_2_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    milestone_3_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    final_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    warnings_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    applicant: Mapped["Applicant"] = relationship("Applicant", back_populates="fellow")
    cohort: Mapped["Cohort"] = relationship("Cohort", back_populates="fellows")
    team: Mapped[Optional["Team"]] = relationship("Team", back_populates="fellows")
    check_ins: Mapped[List["CheckIn"]] = relationship(
        "CheckIn",
        back_populates="fellow",
        cascade="all, delete-orphan"
    )
    risk_assessments: Mapped[List["RiskAssessment"]] = relationship(
        "RiskAssessment",
        back_populates="fellow",
        cascade="all, delete-orphan"
    )
    warnings: Mapped[List["Warning"]] = relationship(
        "Warning",
        back_populates="fellow",
        cascade="all, delete-orphan"
    )
    profiles: Mapped[List["FellowProfile"]] = relationship(
        "FellowProfile",
        back_populates="fellow",
        cascade="all, delete-orphan"
    )
    placement_matches: Mapped[List["PlacementMatch"]] = relationship(
        "PlacementMatch",
        back_populates="fellow",
        cascade="all, delete-orphan"
    )
