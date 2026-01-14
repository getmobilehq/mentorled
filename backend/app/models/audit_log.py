from sqlalchemy import String, Integer, Numeric, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import enum

from app.database import Base

class ActorType(str, enum.Enum):
    USER = "user"
    SYSTEM = "system"
    AI_AGENT = "ai_agent"

class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    timestamp: Mapped[datetime] = mapped_column(server_default=func.now(), index=True)
    actor_type: Mapped[str] = mapped_column(
        SQLEnum(ActorType),
        nullable=False
    )
    actor_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    entity_id: Mapped[Optional[UUID]] = mapped_column(nullable=True, index=True)
    details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ai_model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ai_completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ai_cost_usd: Mapped[Optional[float]] = mapped_column(Numeric(10, 6), nullable=True)
