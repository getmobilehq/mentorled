"""Peer feedback model."""
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional

from app.database import Base


class PeerFeedback(Base):
    __tablename__ = "peer_feedback"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    giver_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"), nullable=False
    )
    receiver_id: Mapped[UUID] = mapped_column(
        ForeignKey("fellows.id", ondelete="CASCADE"), nullable=False
    )
    sprint_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True
    )
    strengths: Mapped[str] = mapped_column(Text, nullable=False)
    areas_to_improve: Mapped[str] = mapped_column(Text, nullable=False)
    collaboration_rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    communication_rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    technical_rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    overall_rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    anonymous: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    giver: Mapped["Fellow"] = relationship("Fellow", foreign_keys=[giver_id])
    receiver: Mapped["Fellow"] = relationship("Fellow", foreign_keys=[receiver_id])
    sprint: Mapped[Optional["Sprint"]] = relationship("Sprint")
