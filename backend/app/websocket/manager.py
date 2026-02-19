"""WebSocket connection manager for real-time dashboard updates."""
import logging
import json
from datetime import datetime
from typing import Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts events to connected clients.
    Tracks connections by user_id for targeted messaging.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections (supports multiple tabs)
        self._connections: dict[str, set[WebSocket]] = {}

    @property
    def connected_count(self) -> int:
        return sum(len(conns) for conns in self._connections.values())

    async def connect(self, user_id: str, websocket: WebSocket):
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)
        logger.info(f"WebSocket connected: user={user_id} (total: {self.connected_count})")

    async def disconnect(self, user_id: str, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"WebSocket disconnected: user={user_id} (total: {self.connected_count})")

    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections for a specific user."""
        connections = self._connections.get(user_id, set())
        dead = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        for ws in dead:
            connections.discard(ws)
        if not connections and user_id in self._connections:
            del self._connections[user_id]

    async def broadcast(self, event_type: str, data: dict, user_ids: list[str] | None = None):
        """
        Broadcast an event to specific users or all connected clients.

        Args:
            event_type: Event type string (e.g., "meeting_unlocked")
            data: Event payload
            user_ids: Target user IDs. None = broadcast to all.
        """
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if user_ids is None:
            # Broadcast to all
            for uid in list(self._connections.keys()):
                await self.send_to_user(uid, message)
        else:
            for uid in user_ids:
                await self.send_to_user(uid, message)

    async def broadcast_to_all(self, event_type: str, data: dict):
        """Broadcast to every connected client."""
        await self.broadcast(event_type, data, user_ids=None)


# Singleton
ws_manager = ConnectionManager()
