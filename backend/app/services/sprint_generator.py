"""Sprint generation service — creates 6 sprints with all meetings for a team."""
import logging
from datetime import date, datetime, timedelta, time
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.sprint import Sprint, SprintStatus
from app.models.meeting import Meeting, MeetingType, MeetingStatus
from app.models.team import Team
from app.models.cohort import Cohort
from app.services.google_calendar import google_calendar_service

logger = logging.getLogger(__name__)


def _next_weekday(d: date, weekday: int) -> date:
    """Return the next date on or after d with the given weekday (0=Monday)."""
    days_ahead = weekday - d.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return d + timedelta(days=days_ahead)


def _meeting_link_placeholder(team_name: str, meeting_type: str, sprint_num: int) -> str:
    """Generate a placeholder meeting link."""
    slug = team_name.lower().replace(" ", "-")
    return f"https://meet.google.com/{slug}-s{sprint_num}-{meeting_type}"


async def generate_sprints_for_team(
    team_id: UUID,
    db: AsyncSession | None = None,
    cohort_start_date: date | None = None,
) -> list[Sprint]:
    """
    Generate 6 sprints with all standard meetings for a team.

    Each sprint is 2 weeks. Each sprint gets:
      - 1 Sprint Planning (Monday 10:00 AM, Week 1)
      - 3 Standups (Tue 9AM W1, Thu 9AM W1, Tue 9AM W2)
      - 1 Sprint Review (Friday 2:00 PM, Week 2)
      - 1 Sprint Retrospective (Friday 4:00 PM, Week 2)

    Total: 6 meetings per sprint, 36 meetings per team.
    """
    close_session = False
    if db is None:
        db = AsyncSessionLocal()
        close_session = True

    try:
        # Fetch team
        result = await db.execute(select(Team).where(Team.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            raise ValueError(f"Team {team_id} not found")

        # Determine cohort start date
        if cohort_start_date is None:
            result = await db.execute(select(Cohort).where(Cohort.id == team.cohort_id))
            cohort = result.scalar_one_or_none()
            if not cohort:
                raise ValueError(f"Cohort {team.cohort_id} not found")
            cohort_start_date = cohort.start_date

        # Ensure start on a Monday
        if cohort_start_date.weekday() == 0:
            start_monday = cohort_start_date
        else:
            start_monday = _next_weekday(cohort_start_date, 0)

        sprints = []
        total_meetings = 0
        use_gcal = google_calendar_service.is_enabled

        for sprint_num in range(1, 7):
            sprint_start = start_monday + timedelta(weeks=(sprint_num - 1) * 2)
            sprint_end = sprint_start + timedelta(days=11)  # Friday of Week 2

            sprint = Sprint(
                team_id=team_id,
                sprint_number=sprint_num,
                status=SprintStatus.PENDING,
                start_date=sprint_start,
                end_date=sprint_end,
            )
            db.add(sprint)
            await db.flush()
            sprints.append(sprint)

            # Define all meetings for this sprint
            meeting_defs = [
                # (meeting_type, scheduled_datetime, duration_minutes)
                (MeetingType.SPRINT_PLANNING, datetime.combine(sprint_start, time(10, 0)), 90),
                (MeetingType.STANDUP, datetime.combine(sprint_start + timedelta(days=1), time(9, 0)), 30),
                (MeetingType.STANDUP, datetime.combine(sprint_start + timedelta(days=3), time(9, 0)), 30),
                (MeetingType.STANDUP, datetime.combine(sprint_start + timedelta(days=8), time(9, 0)), 30),
                (MeetingType.SPRINT_REVIEW, datetime.combine(sprint_end, time(14, 0)), 90),
                (MeetingType.SPRINT_RETROSPECTIVE, datetime.combine(sprint_end, time(16, 0)), 60),
            ]

            meetings = []
            for m_type, m_dt, m_duration in meeting_defs:
                link = _meeting_link_placeholder(team.name, m_type.value, sprint_num)
                google_event_id = None

                if use_gcal:
                    summary = f"{team.name} — {m_type.value.replace('_', ' ').title()} (Sprint {sprint_num})"
                    result = await google_calendar_service.create_meeting_event(
                        summary=summary,
                        start_time=m_dt,
                        duration_minutes=m_duration,
                        description=f"Sprint {sprint_num} · {team.name}",
                    )
                    if result.get("meet_link"):
                        link = result["meet_link"]
                        google_event_id = result["google_event_id"]

                meetings.append(Meeting(
                    sprint_id=sprint.id,
                    team_id=team_id,
                    meeting_type=m_type,
                    scheduled_at=m_dt,
                    duration_minutes=m_duration,
                    meeting_link=link,
                    google_event_id=google_event_id,
                    is_locked=True,
                    unlock_time=m_dt - timedelta(minutes=15),
                    status=MeetingStatus.SCHEDULED,
                ))

            db.add_all(meetings)
            total_meetings += len(meetings)

        await db.flush()
        logger.info(
            f"Generated {len(sprints)} sprints and {total_meetings} meetings "
            f"for team '{team.name}' ({team_id})"
        )
        return sprints

    finally:
        if close_session:
            await db.commit()
            await db.close()
