"""Notification API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from uuid import UUID
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User, UserRole
from app.middleware.auth import get_current_user, require_role
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    MarkReadRequest,
    DeleteNotificationsRequest,
    NotificationPreferenceItem,
    NotificationPreferencesResponse,
    UpdatePreferencesRequest,
    BroadcastRequest,
)
from app.services.notification_service import (
    NOTIFICATION_TYPES,
    create_notification,
)

router = APIRouter(prefix="/notifications")


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    user_id: Optional[UUID] = None,
    unread_only: bool = False,
    type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List notifications with filtering, pagination, and search."""
    query = select(Notification)

    if user_id:
        query = query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.where(Notification.user_id.is_(None))

    if unread_only:
        query = query.where(Notification.is_read == False)

    if type:
        query = query.where(Notification.type == type)

    if search:
        query = query.where(
            Notification.title.ilike(f"%{search}%")
            | Notification.message.ilike(f"%{search}%")
        )

    # Get total count for pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    # Get unread count
    unread_query = select(func.count(Notification.id)).where(Notification.is_read == False)
    if user_id:
        unread_query = unread_query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        unread_query = unread_query.where(Notification.user_id.is_(None))

    count_result = await db.execute(unread_query)
    unread_count = count_result.scalar() or 0

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
        total=total,
    )


@router.get("/unread-count")
async def get_unread_count(
    user_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications."""
    query = select(func.count(Notification.id)).where(Notification.is_read == False)
    if user_id:
        query = query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.where(Notification.user_id.is_(None))

    result = await db.execute(query)
    return {"unread_count": result.scalar() or 0}


@router.post("/mark-read")
async def mark_notifications_read(
    request: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Mark specific notifications as read."""
    now = datetime.utcnow()
    await db.execute(
        update(Notification)
        .where(Notification.id.in_(request.notification_ids))
        .values(is_read=True, read_at=now)
    )
    await db.commit()
    return {"status": "success", "marked": len(request.notification_ids)}


@router.post("/mark-all-read")
async def mark_all_read(
    user_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    now = datetime.utcnow()
    query = (
        update(Notification)
        .where(Notification.is_read == False)
        .values(is_read=True, read_at=now)
    )
    if user_id:
        query = query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.where(Notification.user_id.is_(None))

    await db.execute(query)
    await db.commit()
    return {"status": "success"}


@router.delete("/bulk-delete")
async def delete_notifications(
    request: DeleteNotificationsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete specific notifications."""
    await db.execute(
        delete(Notification).where(Notification.id.in_(request.notification_ids))
    )
    await db.commit()
    return {"status": "success", "deleted": len(request.notification_ids)}


# --- Notification Preferences ---


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's notification preferences for all types."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    existing = {p.notification_type: p for p in result.scalars().all()}

    preferences = []
    for ntype, label in NOTIFICATION_TYPES.items():
        pref = existing.get(ntype)
        preferences.append(
            NotificationPreferenceItem(
                notification_type=ntype,
                label=label,
                in_app_enabled=pref.in_app_enabled if pref else True,
                email_enabled=pref.email_enabled if pref else True,
            )
        )

    return NotificationPreferencesResponse(preferences=preferences)


@router.put("/preferences")
async def update_preferences(
    request: UpdatePreferencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's notification preferences."""
    for item in request.preferences:
        result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == current_user.id,
                NotificationPreference.notification_type == item.notification_type,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.in_app_enabled = item.in_app_enabled
            existing.email_enabled = item.email_enabled
        else:
            pref = NotificationPreference(
                user_id=current_user.id,
                notification_type=item.notification_type,
                in_app_enabled=item.in_app_enabled,
                email_enabled=item.email_enabled,
            )
            db.add(pref)

    await db.commit()
    return {"status": "success"}


# --- Admin Broadcast ---


@router.post("/broadcast")
async def broadcast_notification(
    request: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Broadcast a notification to all users (admin only)."""
    notification = await create_notification(
        db=db,
        type="system",
        title=request.title,
        message=request.message,
        action_url=request.action_url,
        user_id=None,  # broadcast
    )
    return {
        "status": "success",
        "notification_id": str(notification.id),
    }
