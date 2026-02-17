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

            meetings = []

            # 1. Sprint Planning: Monday Week 1, 10:00 AM
            planning_dt = datetime.combine(sprint_start, time(10, 0))
            meetings.append(Meeting(
                sprint_id=sprint.id,
                team_id=team_id,
                meeting_type=MeetingType.SPRINT_PLANNING,
                scheduled_at=planning_dt,
                duration_minutes=90,
                meeting_link=_meeting_link_placeholder(team.name, "planning", sprint_num),
                is_locked=True,
                unlock_time=planning_dt - timedelta(minutes=15),
                status=MeetingStatus.SCHEDULED,
            ))

            # 2. Standups: Tue W1, Thu W1, Tue W2 at 9:00 AM
            standup_offsets = [1, 3, 8]  # days from sprint_start Monday
            for offset in standup_offsets:
                standup_dt = datetime.combine(
                    sprint_start + timedelta(days=offset), time(9, 0)
                )
                meetings.append(Meeting(
                    sprint_id=sprint.id,
                    team_id=team_id,
                    meeting_type=MeetingType.STANDUP,
                    scheduled_at=standup_dt,
                    duration_minutes=30,
                    meeting_link=_meeting_link_placeholder(team.name, "standup", sprint_num),
                    is_locked=True,
                    unlock_time=standup_dt - timedelta(minutes=15),
                    status=MeetingStatus.SCHEDULED,
                ))

            # 3. Sprint Review: Friday Week 2, 2:00 PM
            review_dt = datetime.combine(sprint_end, time(14, 0))
            meetings.append(Meeting(
                sprint_id=sprint.id,
                team_id=team_id,
                meeting_type=MeetingType.SPRINT_REVIEW,
                scheduled_at=review_dt,
                duration_minutes=90,
                meeting_link=_meeting_link_placeholder(team.name, "review", sprint_num),
                is_locked=True,
                unlock_time=review_dt - timedelta(minutes=15),
                status=MeetingStatus.SCHEDULED,
            ))

            # 4. Sprint Retrospective: Friday Week 2, 4:00 PM
            retro_dt = datetime.combine(sprint_end, time(16, 0))
            meetings.append(Meeting(
                sprint_id=sprint.id,
                team_id=team_id,
                meeting_type=MeetingType.SPRINT_RETROSPECTIVE,
                scheduled_at=retro_dt,
                duration_minutes=60,
                meeting_link=_meeting_link_placeholder(team.name, "retro", sprint_num),
                is_locked=True,
                unlock_time=retro_dt - timedelta(minutes=15),
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
