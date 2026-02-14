from sqlalchemy import String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional

from app.database import Base


class EmailTemplateOverride(Base):
    __tablename__ = "email_template_overrides"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    template_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
