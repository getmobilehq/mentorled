from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment
from app.schemas.fellow import FellowCreate, FellowResponse, FellowUpdate

router = APIRouter(prefix="/fellows")

@router.post("/", response_model=FellowResponse)
async def create_fellow(
    fellow: FellowCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new fellow."""
    new_fellow = Fellow(**fellow.dict())
    db.add(new_fellow)
    await db.commit()
    await db.refresh(new_fellow)
    return new_fellow

@router.get("/", response_model=List[FellowResponse])
async def list_fellows(
    cohort_id: Optional[UUID] = None,
    status: Optional[str] = None,
    team_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """List fellows with optional filters."""
    query = select(Fellow)

    if cohort_id:
        query = query.where(Fellow.cohort_id == cohort_id)
    if status:
        query = query.where(Fellow.status == status)
    if team_id:
        query = query.where(Fellow.team_id == team_id)

    result = await db.execute(query.order_by(Fellow.created_at.desc()))
    fellows = result.scalars().all()
    return fellows

@router.get("/{fellow_id}", response_model=FellowResponse)
async def get_fellow(fellow_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific fellow."""
    result = await db.execute(select(Fellow).where(Fellow.id == fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")
    return fellow

@router.patch("/{fellow_id}", response_model=FellowResponse)
async def update_fellow(
    fellow_id: UUID,
    updates: FellowUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a fellow."""
    result = await db.execute(select(Fellow).where(Fellow.id == fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    for field, value in updates.dict(exclude_unset=True).items():
        setattr(fellow, field, value)

    await db.commit()
    await db.refresh(fellow)
    return fellow

@router.get("/{fellow_id}/check-ins")
async def get_fellow_check_ins(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all check-ins for a fellow."""
    result = await db.execute(
        select(CheckIn)
        .where(CheckIn.fellow_id == fellow_id)
        .order_by(CheckIn.week_number.desc())
    )
    check_ins = result.scalars().all()
    return check_ins

@router.get("/{fellow_id}/risk")
async def get_fellow_risk(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get latest risk assessment for a fellow."""
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.fellow_id == fellow_id)
        .order_by(RiskAssessment.assessed_at.desc())
        .limit(1)
    )
    risk = result.scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=404, detail="No risk assessment found")
    return risk
