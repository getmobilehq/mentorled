"""WebSocket endpoint for real-time dashboard updates."""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from app.config import settings
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


def _validate_token(token: str) -> dict | None:
    """Validate JWT token and return payload. Returns None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    """
    WebSocket endpoint for real-time dashboard updates.

    Connect with: ws://localhost:8000/api/ws?token=<jwt_token>

    Events sent to clients:
    - meeting_unlocked: Meeting is now joinable
    - attendance_recorded: Fellow joined a meeting
    - objective_completed: Sprint objective marked done
    - check_in_submitted: Fellow submitted a check-in
    - check_in_analyzed: AI analysis completed
    - risk_level_changed: Fellow's risk level updated
    - sprint_completed: Sprint finished
    - absence_approved: Absence was approved
    - notification_created: New in-app notification
    """
    # Validate token
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = _validate_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub", "anonymous")

    await ws_manager.connect(user_id, websocket)
    try:
        # Keep connection alive — listen for pings or client messages
        while True:
            data = await websocket.receive_text()
            # Client can send "ping" to keep alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(user_id, websocket)
    except Exception:
        await ws_manager.disconnect(user_id, websocket)
