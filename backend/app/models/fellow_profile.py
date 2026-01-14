from sqlalchemy import String, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional

from app.database import Base

class FellowProfile(Base):
    __tablename__ = "fellow_profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    fellow_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"),
        nullable=False
    )
    headline: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    skills: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    projects: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    linkedin_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    fellow: Mapped["Fellow"] = relationship("Fellow", back_populates="profiles")
