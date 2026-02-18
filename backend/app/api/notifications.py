"""Notification API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from uuid import UUID
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationListResponse, MarkReadRequest

router = APIRouter(prefix="/notifications")


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    user_id: Optional[UUID] = None,
    unread_only: bool = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List notifications, optionally filtered by user and read status."""
    query = select(Notification)

    if user_id:
        query = query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        query = query.where(Notification.user_id.is_(None))

    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()

    # Get unread count
    count_query = select(func.count(Notification.id)).where(Notification.is_read == False)
    if user_id:
        count_query = count_query.where(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )
    else:
        count_query = count_query.where(Notification.user_id.is_(None))

    count_result = await db.execute(count_query)
    unread_count = count_result.scalar() or 0

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
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
