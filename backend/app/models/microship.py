from sqlalchemy import String, Text, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class SubmissionType(str, enum.Enum):
    GITHUB = "github"
    FIGMA = "figma"
    DOCUMENT = "document"
    OTHER = "other"

class MicroshipSubmission(Base):
    __tablename__ = "microship_submissions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    applicant_id: Mapped[UUID] = mapped_column(
        ForeignKey("applicants.id", ondelete="CASCADE"),
        nullable=False
    )
    challenge_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    submission_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submission_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    on_time: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    acknowledgment_time: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    communication_log: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        server_default='[]'
    )
    raw_analysis: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    applicant: Mapped["Applicant"] = relationship(
        "Applicant",
        back_populates="microship_submissions"
    )
