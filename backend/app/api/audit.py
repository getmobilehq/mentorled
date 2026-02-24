"""Audit log and activity feed API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.notification import Notification

router = APIRouter()


@router.get("/audit-logs")
async def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    actor_type: Optional[str] = None,
    search: Optional[str] = None,
    days: int = 30,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List audit log entries with filtering and pagination."""
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if actor_type:
        query = query.where(AuditLog.actor_type == actor_type)
    if search:
        query = query.where(AuditLog.action.ilike(f"%{search}%"))
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        query = query.where(AuditLog.timestamp >= since)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat(),
                "actor_type": str(log.actor_type.value) if hasattr(log.actor_type, 'value') else str(log.actor_type),
                "actor_id": log.actor_id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else None,
                "details": log.details,
                "ai_model": log.ai_model,
                "ai_prompt_tokens": log.ai_prompt_tokens,
                "ai_completion_tokens": log.ai_completion_tokens,
                "ai_cost_usd": float(log.ai_cost_usd) if log.ai_cost_usd else None,
            }
            for log in logs
        ],
        "total": total,
    }


@router.get("/audit-logs/actions")
async def get_audit_actions(
    db: AsyncSession = Depends(get_db),
):
    """Get distinct action types for filter dropdown."""
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    return [r[0] for r in result.all()]


@router.get("/audit-logs/entity-types")
async def get_audit_entity_types(
    db: AsyncSession = Depends(get_db),
):
    """Get distinct entity types for filter dropdown."""
    result = await db.execute(
        select(AuditLog.entity_type).distinct().where(AuditLog.entity_type.isnot(None)).order_by(AuditLog.entity_type)
    )
    return [r[0] for r in result.all()]


@router.get("/activity/feed")
async def get_activity_feed(
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity feed combining notifications and audit logs."""
    # Recent notifications
    notif_result = await db.execute(
        select(Notification)
        .order_by(desc(Notification.created_at))
        .limit(limit)
    )
    notifications = notif_result.scalars().all()

    # Recent audit logs
    audit_result = await db.execute(
        select(AuditLog)
        .order_by(desc(AuditLog.timestamp))
        .limit(limit)
    )
    audits = audit_result.scalars().all()

    # Combine and sort by timestamp
    feed = []
    for n in notifications:
        feed.append({
            "id": str(n.id),
            "source": "notification",
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "action_url": n.action_url,
            "timestamp": n.created_at.isoformat(),
        })
    for a in audits:
        feed.append({
            "id": str(a.id),
            "source": "audit",
            "type": a.action,
            "title": f"{a.action} ({a.entity_type or 'system'})",
            "message": f"By {a.actor_type.value if hasattr(a.actor_type, 'value') else a.actor_type}: {a.actor_id or 'system'}",
            "action_url": None,
            "timestamp": a.timestamp.isoformat(),
        })

    feed.sort(key=lambda x: x["timestamp"], reverse=True)
    return feed[:limit]
