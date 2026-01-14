from sqlalchemy import String, Boolean, Text, ForeignKey, UniqueConstraint, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base

class ApplicantRole(str, enum.Enum):
    PRODUCT_MANAGER = "product_manager"
    PRODUCT_DESIGNER = "product_designer"
    FRONTEND = "frontend"
    BACKEND = "backend"
    QA = "qa"

class ApplicantStatus(str, enum.Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    MICROSHIP_PENDING = "microship_pending"
    MICROSHIP_SUBMITTED = "microship_submitted"
    MICROSHIP_EVALUATED = "microship_evaluated"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"

class Applicant(Base):
    __tablename__ = "applicants"
    __table_args__ = (
        UniqueConstraint('cohort_id', 'email', name='uq_cohort_email'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cohort_id: Mapped[UUID] = mapped_column(ForeignKey("cohorts.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        SQLEnum(ApplicantRole),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(ApplicantStatus),
        default=ApplicantStatus.APPLIED,
        nullable=False
    )
    portfolio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_commitment: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    applied_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    cohort: Mapped["Cohort"] = relationship("Cohort", back_populates="applicants")
    evaluations: Mapped[List["ApplicationEvaluation"]] = relationship(
        "ApplicationEvaluation",
        back_populates="applicant",
        cascade="all, delete-orphan"
    )
    microship_submissions: Mapped[List["MicroshipSubmission"]] = relationship(
        "MicroshipSubmission",
        back_populates="applicant",
        cascade="all, delete-orphan"
    )
    fellow: Mapped[Optional["Fellow"]] = relationship(
        "Fellow",
        back_populates="applicant",
        uselist=False
    )
