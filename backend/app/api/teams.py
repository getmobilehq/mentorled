"""Team API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.models.team import Team, TeamStatus
from app.models.fellow import Fellow
from app.models.sprint import Sprint
from app.models.mentor import Mentor
from app.schemas.team import TeamCreate, TeamUpdate

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

    response = []
    for t in teams:
        # Count members
        member_result = await db.execute(
            select(func.count()).select_from(Fellow).where(Fellow.team_id == t.id)
        )
        member_count = member_result.scalar() or 0

        # Count sprints
        sprint_result = await db.execute(
            select(func.count()).select_from(Sprint).where(Sprint.team_id == t.id)
        )
        sprint_count = sprint_result.scalar() or 0

        response.append({
            "id": t.id,
            "cohort_id": t.cohort_id,
            "name": t.name,
            "brief_title": t.brief_title,
            "brief_description": t.brief_description,
            "mentor_name": t.mentor.name if t.mentor else None,
            "mentor_id": t.mentor_id,
            "slack_channel": t.slack_channel,
            "github_repo": t.github_repo,
            "status": t.status.value if hasattr(t.status, 'value') else t.status,
            "member_count": member_count,
            "sprint_count": sprint_count,
            "created_at": t.created_at,
        })
    return response


@router.get("/{team_id}")
async def get_team(team_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single team with details."""
    result = await db.execute(
        select(Team).options(selectinload(Team.mentor)).where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Get members
    members_result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.team_id == team_id)
    )
    members = members_result.scalars().all()

    return {
        "id": team.id,
        "cohort_id": team.cohort_id,
        "name": team.name,
        "brief_title": team.brief_title,
        "brief_description": team.brief_description,
        "mentor_name": team.mentor.name if team.mentor else None,
        "mentor_id": team.mentor_id,
        "slack_channel": team.slack_channel,
        "github_repo": team.github_repo,
        "status": team.status.value if hasattr(team.status, 'value') else team.status,
        "created_at": team.created_at,
        "members": [
            {
                "id": f.id,
                "name": f.applicant.name if f.applicant else "Unknown",
                "email": f.applicant.email if f.applicant else None,
                "role": f.role,
                "status": f.status,
            }
            for f in members
        ],
    }


@router.post("/")
async def create_team(data: TeamCreate, db: AsyncSession = Depends(get_db)):
    """Create a new team."""
    team = Team(
        cohort_id=data.cohort_id,
        name=data.name,
        brief_title=data.brief_title,
        brief_description=data.brief_description,
        mentor_id=data.mentor_id,
        slack_channel=data.slack_channel,
        github_repo=data.github_repo,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)

    return {
        "id": team.id,
        "cohort_id": team.cohort_id,
        "name": team.name,
        "status": team.status.value if hasattr(team.status, 'value') else team.status,
        "created_at": team.created_at,
    }


@router.put("/{team_id}")
async def update_team(team_id: UUID, data: TeamUpdate, db: AsyncSession = Depends(get_db)):
    """Update a team."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)

    return {"message": "Team updated", "id": team.id}


@router.post("/{team_id}/assign-fellow")
async def assign_fellow_to_team(
    team_id: UUID,
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Assign a fellow to a team."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    result = await db.execute(select(Fellow).where(Fellow.id == fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    fellow.team_id = team_id
    await db.commit()

    return {"message": f"Fellow assigned to team {team.name}"}


@router.post("/{team_id}/remove-fellow")
async def remove_fellow_from_team(
    team_id: UUID,
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a fellow from a team."""
    result = await db.execute(
        select(Fellow).where(Fellow.id == fellow_id, Fellow.team_id == team_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found in this team")

    fellow.team_id = None
    await db.commit()

    return {"message": "Fellow removed from team"}


@router.get("/mentors/list")
async def list_available_mentors(db: AsyncSession = Depends(get_db)):
    """List available mentors for team assignment."""
    result = await db.execute(select(Mentor).order_by(Mentor.name))
    mentors = result.scalars().all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "stack": m.stack.value if hasattr(m.stack, 'value') else m.stack,
        }
        for m in mentors
    ]
