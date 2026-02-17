"""Team API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.models.team import Team

router = APIRouter(prefix="/teams")


@router.get("/")
async def list_teams(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """List teams with optional cohort filter."""
    query = select(Team).options(selectinload(Team.mentor))

    if cohort_id:
        query = query.where(Team.cohort_id == cohort_id)

    query = query.order_by(Team.name)
    result = await db.execute(query)
    teams = result.scalars().all()

    return [
        {
            "id": t.id,
            "cohort_id": t.cohort_id,
            "name": t.name,
            "brief_title": t.brief_title,
            "brief_description": t.brief_description,
            "mentor_name": t.mentor.name if t.mentor else None,
            "slack_channel": t.slack_channel,
            "github_repo": t.github_repo,
            "status": t.status.value if hasattr(t.status, 'value') else t.status,
            "created_at": t.created_at,
        }
        for t in teams
    ]
