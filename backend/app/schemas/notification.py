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
    total: int = 0


class MarkReadRequest(BaseModel):
    notification_ids: List[UUID]


class DeleteNotificationsRequest(BaseModel):
    notification_ids: List[UUID]


# Notification preferences
class NotificationPreferenceItem(BaseModel):
    notification_type: str
    label: str
    in_app_enabled: bool = True
    email_enabled: bool = True


class NotificationPreferencesResponse(BaseModel):
    preferences: List[NotificationPreferenceItem]


class UpdatePreferenceRequest(BaseModel):
    notification_type: str
    in_app_enabled: bool = True
    email_enabled: bool = True


class UpdatePreferencesRequest(BaseModel):
    preferences: List[UpdatePreferenceRequest]


# Broadcast (admin)
class BroadcastRequest(BaseModel):
    title: str
    message: str
    action_url: Optional[str] = None
