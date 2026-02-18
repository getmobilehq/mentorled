"""Notification schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str
    action_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int


class MarkReadRequest(BaseModel):
    notification_ids: List[UUID]
