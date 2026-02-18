"""Service for creating in-app notifications alongside Slack."""
import logging
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    user_id: Optional[UUID] = None,
) -> Notification:
    """Create an in-app notification record.

    Args:
        db: Database session
        type: Notification type (risk_alert, warning_issued, batch_complete, acceptance, evaluation, meeting)
        title: Short title
        message: Detailed message
        action_url: Optional URL to navigate to
        user_id: Optional specific user (None = broadcast to all)
    """
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        action_url=action_url,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification
