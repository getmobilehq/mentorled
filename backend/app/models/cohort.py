from sqlalchemy import String, Integer, Date, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, datetime
from uuid import UUID, uuid4
from typing import List
import enum

from app.database import Base

class CohortStatus(str, enum.Enum):
    PLANNING = "planning"
    APPLICATIONS_OPEN = "applications_open"
    MICROSHIP = "microship"
    ACTIVE = "active"
    COMPLETED = "completed"

class Cohort(Base):
    __tablename__ = "cohorts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        SQLEnum(CohortStatus),
        default=CohortStatus.PLANNING,
        nullable=False
    )
    target_size: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    applicants: Mapped[List["Applicant"]] = relationship(
        "Applicant",
        back_populates="cohort",
        cascade="all, delete-orphan"
    )
    teams: Mapped[List["Team"]] = relationship(
        "Team",
        back_populates="cohort",
        cascade="all, delete-orphan"
    )
    fellows: Mapped[List["Fellow"]] = relationship(
        "Fellow",
        back_populates="cohort",
        cascade="all, delete-orphan"
    )
