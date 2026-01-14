from sqlalchemy import String, Integer, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import UUID, uuid4
from typing import List
import enum

from app.database import Base

class MentorStack(str, enum.Enum):
    PRODUCT = "product"
    DESIGN = "design"
    FRONTEND = "frontend"
    BACKEND = "backend"
    QA = "qa"
    GENERAL = "general"

class MentorStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class Mentor(Base):
    __tablename__ = "mentors"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stack: Mapped[str] = mapped_column(
        SQLEnum(MentorStack),
        nullable=False
    )
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(
        SQLEnum(MentorStatus),
        default=MentorStatus.ACTIVE,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    teams: Mapped[List["Team"]] = relationship(
        "Team",
        back_populates="mentor"
    )
