from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.cohort import Cohort, CohortStatus
from app.models.fellow import Fellow, FellowStatus
from app.services.notification_service import create_notification
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/cohorts")

class CohortCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    target_size: int = 100

class CohortUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_size: Optional[int] = None

class CohortStatusUpdate(BaseModel):
    status: str

class CohortResponse(BaseModel):
    id: UUID
    name: str
    start_date: date
    end_date: date
    status: str
    target_size: int

    class Config:
        from_attributes = True

@router.post("/", response_model=CohortResponse)
async def create_cohort(
    cohort: CohortCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new cohort."""
    new_cohort = Cohort(**cohort.dict())
    db.add(new_cohort)
    await db.commit()
    await db.refresh(new_cohort)
    return new_cohort

@router.get("/", response_model=List[CohortResponse])
async def list_cohorts(db: AsyncSession = Depends(get_db)):
    """List all cohorts."""
    result = await db.execute(select(Cohort).order_by(Cohort.start_date.desc()))
    cohorts = result.scalars().all()
    return cohorts

@router.get("/{cohort_id}", response_model=CohortResponse)
async def get_cohort(cohort_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific cohort."""
    result = await db.execute(select(Cohort).where(Cohort.id == cohort_id))
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    return cohort


@router.put("/{cohort_id}", response_model=CohortResponse)
async def update_cohort(
    cohort_id: UUID,
    updates: CohortUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a cohort."""
    result = await db.execute(select(Cohort).where(Cohort.id == cohort_id))
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(cohort, field, value)

    await db.commit()
    await db.refresh(cohort)
    return cohort


@router.patch("/{cohort_id}/status", response_model=CohortResponse)
async def update_cohort_status(
    cohort_id: UUID,
    status_update: CohortStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a cohort's status with validated transitions."""
    result = await db.execute(select(Cohort).where(Cohort.id == cohort_id))
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    valid_transitions = {
        "planning": ["applications_open"],
        "applications_open": ["microship"],
        "microship": ["active"],
        "active": ["completed"],
        "completed": [],
    }

    current = cohort.status
    if isinstance(current, CohortStatus):
        current = current.value

    new_status = status_update.status
    if new_status not in valid_transitions.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new_status}'. Valid: {valid_transitions.get(current, [])}"
        )

    cohort.status = new_status
    await db.commit()
    await db.refresh(cohort)
    return cohort


class GraduateRequest(BaseModel):
    distinction_threshold: float = 3.5
    pass_threshold: float = 2.5


@router.post("/{cohort_id}/graduate")
async def graduate_cohort(
    cohort_id: UUID,
    request: GraduateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Graduate all fellows in a cohort based on final_score thresholds.
    - final_score >= distinction_threshold → GRADUATED_DISTINCTION
    - final_score >= pass_threshold → GRADUATED
    - final_score < pass_threshold or None → DID_NOT_GRADUATE
    Also transitions cohort to COMPLETED status.
    """
    result = await db.execute(select(Cohort).where(Cohort.id == cohort_id))
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    current = cohort.status
    if isinstance(current, CohortStatus):
        current = current.value
    if current != "active":
        raise HTTPException(status_code=400, detail="Can only graduate an active cohort")

    # Get all active fellows in cohort
    fellows_result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(
            Fellow.cohort_id == cohort_id,
            Fellow.status.in_([
                FellowStatus.ACTIVE,
                FellowStatus.ON_TRACK,
                FellowStatus.MONITOR,
                FellowStatus.AT_RISK,
                FellowStatus.WARNING,
                FellowStatus.FINAL_WARNING,
            ]),
        )
    )
    fellows = fellows_result.scalars().all()

    graduated = 0
    distinction = 0
    did_not_graduate = 0

    for fellow in fellows:
        score = float(fellow.final_score) if fellow.final_score is not None else None
        if score is not None and score >= request.distinction_threshold:
            fellow.status = FellowStatus.GRADUATED_DISTINCTION
            distinction += 1
        elif score is not None and score >= request.pass_threshold:
            fellow.status = FellowStatus.GRADUATED
            graduated += 1
        else:
            fellow.status = FellowStatus.DID_NOT_GRADUATE
            did_not_graduate += 1

    # Transition cohort to completed
    cohort.status = CohortStatus.COMPLETED

    await db.commit()

    await create_notification(
        db,
        type="system",
        title=f"Cohort Graduated: {cohort.name}",
        message=f"{graduated + distinction} graduated ({distinction} with distinction), {did_not_graduate} did not graduate",
        action_url="/cohorts",
    )

    return {
        "message": f"Graduated {len(fellows)} fellows",
        "graduated": graduated,
        "graduated_with_distinction": distinction,
        "did_not_graduate": did_not_graduate,
        "cohort_status": "completed",
    }
