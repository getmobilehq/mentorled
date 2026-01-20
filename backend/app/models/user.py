"""
User model for authentication and authorization.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    """User roles for role-based access control"""
    ADMIN = "admin"  # Full access to everything
    REVIEWER = "reviewer"  # Can review AI decisions, update statuses
    VIEWER = "viewer"  # Read-only access
    API = "api"  # Programmatic access for external systems


class User(Base):
    """User model for authentication"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Role-based access control
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VIEWER)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))

    # API key for programmatic access (optional)
    api_key = Column(String, unique=True, nullable=True, index=True)

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"
