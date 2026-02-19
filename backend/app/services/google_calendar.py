"""Google Calendar service for creating meetings with Google Meet links."""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    """
    Creates Google Calendar events with Google Meet conferencing.
    Falls back to placeholder links when credentials are not configured.
    """

    def __init__(self):
        self._service = None
        self._enabled = False
        self._calendar_id = "primary"
        self._init_client()

    def _init_client(self):
        """Initialize the Google Calendar API client if credentials are available."""
        try:
            from app.config import settings

            if not settings.ENABLE_GOOGLE_CALENDAR or not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
                logger.info("Google Calendar integration disabled (ENABLE_GOOGLE_CALENDAR=false)")
                return

            json_path = settings.GOOGLE_SERVICE_ACCOUNT_JSON
            if not os.path.exists(json_path):
                logger.warning(f"Google service account file not found: {json_path}")
                return

            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            credentials = service_account.Credentials.from_service_account_file(
                json_path,
                scopes=["https://www.googleapis.com/auth/calendar"],
            )
            self._service = build("calendar", "v3", credentials=credentials)
            self._calendar_id = settings.GOOGLE_CALENDAR_ID or "primary"
            self._enabled = True
            logger.info("Google Calendar service initialized successfully")

        except ImportError:
            logger.warning("Google API client library not installed — using placeholder links")
        except Exception as e:
            logger.warning(f"Google Calendar init failed: {e} — using placeholder links")

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    async def create_meeting_event(
        self,
        summary: str,
        start_time: datetime,
        duration_minutes: int,
        description: str = "",
        attendee_emails: list[str] | None = None,
    ) -> dict:
        """
        Create a Google Calendar event with Google Meet conferencing.

        Returns dict with:
          - google_event_id: str (Calendar event ID)
          - meet_link: str (Google Meet URL)

        Falls back to empty values if not enabled.
        """
        if not self._enabled or not self._service:
            return {"google_event_id": None, "meet_link": None}

        try:
            end_time = start_time + timedelta(minutes=duration_minutes)

            event_body = {
                "summary": summary,
                "description": description,
                "start": {
                    "dateTime": start_time.isoformat(),
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": end_time.isoformat(),
                    "timeZone": "UTC",
                },
                "conferenceData": {
                    "createRequest": {
                        "requestId": f"mentorled-{start_time.strftime('%Y%m%d%H%M')}",
                        "conferenceSolutionKey": {"type": "hangoutsMeet"},
                    }
                },
            }

            if attendee_emails:
                event_body["attendees"] = [{"email": e} for e in attendee_emails]

            event = self._service.events().insert(
                calendarId=self._calendar_id,
                body=event_body,
                conferenceDataVersion=1,
                sendUpdates="all" if attendee_emails else "none",
            ).execute()

            meet_link = None
            if event.get("conferenceData", {}).get("entryPoints"):
                for ep in event["conferenceData"]["entryPoints"]:
                    if ep.get("entryPointType") == "video":
                        meet_link = ep["uri"]
                        break

            logger.info(f"Created Google Calendar event: {event['id']} with Meet: {meet_link}")
            return {
                "google_event_id": event["id"],
                "meet_link": meet_link,
            }

        except Exception as e:
            logger.error(f"Failed to create Google Calendar event: {e}")
            return {"google_event_id": None, "meet_link": None}

    async def delete_event(self, google_event_id: str) -> bool:
        """Delete a Google Calendar event."""
        if not self._enabled or not self._service or not google_event_id:
            return False

        try:
            self._service.events().delete(
                calendarId=self._calendar_id,
                eventId=google_event_id,
            ).execute()
            logger.info(f"Deleted Google Calendar event: {google_event_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete Google Calendar event: {e}")
            return False

    async def update_event(
        self,
        google_event_id: str,
        summary: Optional[str] = None,
        start_time: Optional[datetime] = None,
        duration_minutes: Optional[int] = None,
    ) -> bool:
        """Update a Google Calendar event."""
        if not self._enabled or not self._service or not google_event_id:
            return False

        try:
            # Fetch current event
            event = self._service.events().get(
                calendarId=self._calendar_id,
                eventId=google_event_id,
            ).execute()

            if summary:
                event["summary"] = summary
            if start_time:
                event["start"]["dateTime"] = start_time.isoformat()
                end_time = start_time + timedelta(minutes=duration_minutes or 60)
                event["end"]["dateTime"] = end_time.isoformat()

            self._service.events().update(
                calendarId=self._calendar_id,
                eventId=google_event_id,
                body=event,
            ).execute()
            logger.info(f"Updated Google Calendar event: {google_event_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update Google Calendar event: {e}")
            return False


# Singleton instance
google_calendar_service = GoogleCalendarService()
