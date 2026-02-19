"""Event publishing service for real-time dashboard updates."""
import logging
from typing import Optional

from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class EventPublisher:
    """
    Publishes events to connected WebSocket clients.
    Wraps the WebSocket manager with a clean API for use in route handlers.
    """

    async def publish(
        self,
        event_type: str,
        data: dict,
        user_ids: list[str] | None = None,
    ):
        """
        Publish an event to targeted users via WebSocket.

        Args:
            event_type: One of the dashboard event types
            data: Event payload (must be JSON-serializable)
            user_ids: Target users. None = broadcast to all.
        """
        try:
            await ws_manager.broadcast(event_type, data, user_ids)
            target = f"{len(user_ids)} user(s)" if user_ids else "all"
            logger.debug(f"Published event '{event_type}' to {target}")
        except Exception as e:
            logger.error(f"Failed to publish event '{event_type}': {e}")

    # Convenience methods for common events

    async def meeting_unlocked(self, meeting_id: str, team_id: str, meeting_type: str):
        await self.publish("meeting_unlocked", {
            "meeting_id": meeting_id,
            "team_id": team_id,
            "meeting_type": meeting_type,
        })

    async def attendance_recorded(self, fellow_id: str, meeting_id: str, status: str, team_id: str):
        await self.publish("attendance_recorded", {
            "fellow_id": fellow_id,
            "meeting_id": meeting_id,
            "status": status,
            "team_id": team_id,
        })

    async def objective_completed(self, objective_id: str, sprint_id: str, team_id: str):
        await self.publish("objective_completed", {
            "objective_id": objective_id,
            "sprint_id": sprint_id,
            "team_id": team_id,
        })

    async def check_in_submitted(self, fellow_id: str, week: int):
        await self.publish("check_in_submitted", {
            "fellow_id": fellow_id,
            "week": week,
        })

    async def check_in_analyzed(self, fellow_id: str, check_in_id: str, sentiment: float | None = None):
        await self.publish("check_in_analyzed", {
            "fellow_id": fellow_id,
            "check_in_id": check_in_id,
            "sentiment": sentiment,
        })

    async def risk_level_changed(self, fellow_id: str, risk_level: str, risk_score: float | None = None):
        await self.publish("risk_level_changed", {
            "fellow_id": fellow_id,
            "risk_level": risk_level,
            "risk_score": risk_score,
        })

    async def sprint_completed(self, sprint_id: str, team_id: str, completion_score: float | None = None):
        await self.publish("sprint_completed", {
            "sprint_id": sprint_id,
            "team_id": team_id,
            "completion_score": completion_score,
        })

    async def absence_approved(self, fellow_id: str, meeting_id: str):
        await self.publish("absence_approved", {
            "fellow_id": fellow_id,
            "meeting_id": meeting_id,
        })

    async def notification_created(self, user_id: str | None, notif_type: str, title: str):
        """Notify specific user (or all) that a new notification was created."""
        user_ids = [user_id] if user_id else None
        await self.publish("notification_created", {
            "type": notif_type,
            "title": title,
        }, user_ids=user_ids)


# Singleton
event_publisher = EventPublisher()
