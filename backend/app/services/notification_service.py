"""Centralized notification service: create in-app notifications, check preferences, broadcast via WebSocket."""
import logging
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.services.event_service import event_publisher

logger = logging.getLogger(__name__)

# All supported notification types with display labels
NOTIFICATION_TYPES = {
    "risk_alert": "Risk Alerts",
    "warning_issued": "Warnings Issued",
    "batch_complete": "Batch Operations",
    "acceptance": "Acceptances",
    "evaluation": "Evaluations",
    "meeting": "Meeting Updates",
    "check_in": "Check-in Updates",
    "sprint": "Sprint Updates",
    "system": "System Announcements",
}


async def get_user_preference(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
) -> dict:
    """Get a user's preference for a notification type. Defaults to all enabled."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        return {"in_app_enabled": pref.in_app_enabled, "email_enabled": pref.email_enabled}
    return {"in_app_enabled": True, "email_enabled": True}


async def create_notification(
    db: AsyncSession,
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    user_id: Optional[UUID] = None,
) -> Notification:
    """Create an in-app notification, respecting user preferences and broadcasting via WebSocket.

    Args:
        db: Database session
        type: Notification type (risk_alert, warning_issued, etc.)
        title: Short title
        message: Detailed message
        action_url: Optional URL to navigate to
        user_id: Specific user (None = broadcast to all)
    """
    # Check preferences if targeting a specific user
    if user_id:
        pref = await get_user_preference(db, user_id, type)
        if not pref["in_app_enabled"]:
            logger.debug(f"Skipping in-app notification for user {user_id}: {type} disabled")
            # Still return a transient object so callers don't break
            return Notification(user_id=user_id, type=type, title=title, message=message, action_url=action_url)

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

    # Broadcast via WebSocket for real-time UI update
    try:
        await event_publisher.notification_created(
            user_id=str(user_id) if user_id else None,
            notif_type=type,
            title=title,
        )
    except Exception as e:
        logger.error(f"Failed to broadcast notification via WebSocket: {e}")

    return notification


async def create_notification_for_admins(
    db: AsyncSession,
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
) -> Notification:
    """Create a notification visible to all users (user_id=None = broadcast)."""
    return await create_notification(
        db=db,
        type=type,
        title=title,
        message=message,
        action_url=action_url,
        user_id=None,
    )


async def create_notification_for_users(
    db: AsyncSession,
    user_ids: List[UUID],
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
) -> List[Notification]:
    """Create individual notifications for multiple users, respecting each user's preferences."""
    notifications = []
    for uid in user_ids:
        notif = await create_notification(
            db=db,
            type=type,
            title=title,
            message=message,
            action_url=action_url,
            user_id=uid,
        )
        notifications.append(notif)
    return notifications
