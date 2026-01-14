from sqlalchemy import String, Text, Boolean, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
import enum

from app.database import Base

class ExperienceLevel(str, enum.Enum):
    ENTRY = "entry"
    JUNIOR = "junior"
    MID = "mid"

class OpportunityStatus(str, enum.Enum):
    ACTIVE = "active"
    FILLED = "filled"
    CLOSED = "closed"

class JobOpportunity(Base):
    __tablename__ = "job_opportunities"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    employer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    employer_contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    preferred_skills: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    remote_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(
        SQLEnum(OpportunityStatus),
        default=OpportunityStatus.ACTIVE,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    matches: Mapped[List["PlacementMatch"]] = relationship(
        "PlacementMatch",
        back_populates="opportunity",
        cascade="all, delete-orphan"
    )
