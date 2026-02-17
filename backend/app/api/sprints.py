"""Sprint management API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.sprint import Sprint, SprintStatus
from app.models.sprint_objective import SprintObjective, ObjectiveStatus
from app.models.retrospective import Retrospective
from app.models.team import Team
from app.schemas.sprint import (
    SprintCreate, SprintUpdate, SprintStatusUpdate,
    SprintResponse, SprintListResponse,
    SprintObjectiveCreate, SprintObjectiveUpdate, SprintObjectiveResponse,
    RetrospectiveCreate, RetrospectiveResponse,
)
from app.services.sprint_generator import generate_sprints_for_team

router = APIRouter(prefix="/sprints")


# --- Sprint Endpoints ---

@router.get("/")
async def list_sprints(
    team_id: Optional[UUID] = None,
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """List sprints with optional team/cohort filter."""
    query = select(Sprint).options(selectinload(Sprint.objectives))

    if team_id:
        query = query.where(Sprint.team_id == team_id)
    if cohort_id:
        query = query.join(Team).where(Team.cohort_id == cohort_id)

    query = query.order_by(Sprint.team_id, Sprint.sprint_number)
    result = await db.execute(query)
    sprints = result.scalars().all()

    response = []
    for s in sprints:
        obj_count = len(s.objectives) if s.objectives else 0
        done_count = sum(1 for o in s.objectives if o.status == ObjectiveStatus.DONE) if s.objectives else 0
        response.append({
            "id": s.id,
            "team_id": s.team_id,
            "sprint_number": s.sprint_number,
            "goal": s.goal,
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "start_date": s.start_date,
            "end_date": s.end_date,
            "completion_score": float(s.completion_score) if s.completion_score else None,
            "objective_count": obj_count,
            "completed_objectives": done_count,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        })
    return response


@router.get("/{sprint_id}", response_model=SprintResponse)
async def get_sprint(sprint_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a sprint with its objectives."""
    result = await db.execute(
        select(Sprint)
        .options(selectinload(Sprint.objectives))
        .where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


@router.post("/", response_model=SprintResponse)
async def create_sprint(data: SprintCreate, db: AsyncSession = Depends(get_db)):
    """Create a single sprint manually."""
    sprint = Sprint(
        team_id=data.team_id,
        sprint_number=data.sprint_number,
        goal=data.goal,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.put("/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    sprint_id: UUID,
    data: SprintUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a sprint (goal, status, completion_score)."""
    result = await db.execute(
        select(Sprint)
        .options(selectinload(Sprint.objectives))
        .where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sprint, field, value)

    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.patch("/{sprint_id}/status", response_model=SprintResponse)
async def update_sprint_status(
    sprint_id: UUID,
    data: SprintStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Transition sprint status with validation."""
    result = await db.execute(
        select(Sprint)
        .options(selectinload(Sprint.objectives))
        .where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    valid_transitions = {
        "pending": ["active"],
        "active": ["completed"],
    }

    current = sprint.status.value if hasattr(sprint.status, 'value') else sprint.status
    if data.status not in valid_transitions.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{data.status}'"
        )

    sprint.status = data.status
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.post("/generate/{team_id}")
async def generate_sprints(team_id: UUID, db: AsyncSession = Depends(get_db)):
    """Auto-generate 6 sprints with meetings for a team."""
    # Check if sprints already exist
    result = await db.execute(
        select(Sprint).where(Sprint.team_id == team_id)
    )
    existing = result.scalars().all()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Team already has {len(existing)} sprints. Delete existing sprints first."
        )

    sprints = await generate_sprints_for_team(team_id, db=db)
    await db.commit()

    return {
        "message": f"Generated {len(sprints)} sprints with meetings",
        "sprint_count": len(sprints),
        "team_id": str(team_id),
    }


# --- Sprint Objective Endpoints ---

@router.get("/{sprint_id}/objectives")
async def list_objectives(sprint_id: UUID, db: AsyncSession = Depends(get_db)):
    """List objectives for a sprint."""
    result = await db.execute(
        select(SprintObjective)
        .where(SprintObjective.sprint_id == sprint_id)
        .order_by(SprintObjective.created_at)
    )
    return result.scalars().all()


@router.post("/objectives", response_model=SprintObjectiveResponse)
async def create_objective(
    data: SprintObjectiveCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a sprint objective."""
    # Verify sprint exists
    result = await db.execute(select(Sprint).where(Sprint.id == data.sprint_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sprint not found")

    objective = SprintObjective(
        sprint_id=data.sprint_id,
        description=data.description,
        owner_role=data.owner_role,
        owner_fellow_id=data.owner_fellow_id,
    )
    db.add(objective)
    await db.commit()
    await db.refresh(objective)
    return objective


@router.put("/objectives/{objective_id}", response_model=SprintObjectiveResponse)
async def update_objective(
    objective_id: UUID,
    data: SprintObjectiveUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a sprint objective."""
    result = await db.execute(
        select(SprintObjective).where(SprintObjective.id == objective_id)
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(objective, field, value)

    await db.commit()
    await db.refresh(objective)
    return objective


@router.delete("/objectives/{objective_id}")
async def delete_objective(objective_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a sprint objective."""
    result = await db.execute(
        select(SprintObjective).where(SprintObjective.id == objective_id)
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    await db.delete(objective)
    await db.commit()
    return {"message": "Objective deleted"}


# --- Retrospective Endpoints ---

@router.post("/retrospectives", response_model=RetrospectiveResponse)
async def submit_retrospective(
    data: RetrospectiveCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit a retrospective for a sprint."""
    # Verify sprint exists
    result = await db.execute(select(Sprint).where(Sprint.id == data.sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # Check no existing retrospective
    result = await db.execute(
        select(Retrospective).where(Retrospective.sprint_id == data.sprint_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Retrospective already exists for this sprint")

    retro = Retrospective(
        sprint_id=data.sprint_id,
        what_worked=data.what_worked,
        what_didnt_work=data.what_didnt_work,
        what_to_improve=data.what_to_improve,
        team_mood=data.team_mood,
        sprint_rating=data.sprint_rating,
        submitted_by=data.submitted_by,
        submitted_at=datetime.utcnow(),
    )
    db.add(retro)
    await db.commit()
    await db.refresh(retro)
    return retro


@router.get("/retrospectives/sprint/{sprint_id}", response_model=RetrospectiveResponse)
async def get_retrospective(sprint_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get retrospective for a sprint."""
    result = await db.execute(
        select(Retrospective).where(Retrospective.sprint_id == sprint_id)
    )
    retro = result.scalar_one_or_none()
    if not retro:
        raise HTTPException(status_code=404, detail="Retrospective not found")
    return retro
