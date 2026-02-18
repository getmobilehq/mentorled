from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models.fellow import Fellow
from app.models.applicant import Applicant
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment
from app.models.user import User
from app.schemas.fellow import FellowCreate, FellowResponse, FellowUpdate
from app.middleware.auth import get_current_user


class MilestoneUpdate(BaseModel):
    milestone_1_score: Optional[float] = None
    milestone_2_score: Optional[float] = None
    milestone_3_score: Optional[float] = None
    final_score: Optional[float] = None

router = APIRouter(prefix="/fellows")


@router.get("/me")
async def get_my_fellow_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the fellow profile matching the current user's email."""
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .join(Applicant, Fellow.applicant_id == Applicant.id)
        .where(Applicant.email == current_user.email)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="No fellow profile linked to this account")
    return {
        **{c.key: getattr(fellow, c.key) for c in Fellow.__table__.columns},
        "name": fellow.applicant.name if fellow.applicant else "Unknown",
        "email": fellow.applicant.email if fellow.applicant else "",
    }


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

@router.get("/")
async def list_fellows(
    cohort_id: Optional[UUID] = None,
    status: Optional[str] = None,
    team_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """List fellows with optional filters."""
    query = select(Fellow).options(selectinload(Fellow.applicant))

    if cohort_id:
        query = query.where(Fellow.cohort_id == cohort_id)
    if status:
        query = query.where(Fellow.status == status)
    if team_id:
        query = query.where(Fellow.team_id == team_id)

    result = await db.execute(query.order_by(Fellow.created_at.desc()))
    fellows = result.scalars().all()
    return [
        {
            **{c.key: getattr(f, c.key) for c in Fellow.__table__.columns},
            "name": f.applicant.name if f.applicant else "Unknown",
            "email": f.applicant.email if f.applicant else "",
        }
        for f in fellows
    ]

@router.get("/{fellow_id}")
async def get_fellow(fellow_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific fellow."""
    result = await db.execute(
        select(Fellow).options(selectinload(Fellow.applicant)).where(Fellow.id == fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")
    return {
        **{c.key: getattr(fellow, c.key) for c in Fellow.__table__.columns},
        "name": fellow.applicant.name if fellow.applicant else "Unknown",
        "email": fellow.applicant.email if fellow.applicant else "",
    }

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
        .order_by(CheckIn.week.desc())
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


@router.patch("/{fellow_id}/milestones")
async def update_milestones(
    fellow_id: UUID,
    data: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Record milestone scores for a fellow."""
    result = await db.execute(
        select(Fellow).options(selectinload(Fellow.applicant)).where(Fellow.id == fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fellow, field, value)

    await db.commit()
    await db.refresh(fellow)

    return {
        "id": fellow.id,
        "name": fellow.applicant.name if fellow.applicant else "Unknown",
        "milestone_1_score": fellow.milestone_1_score,
        "milestone_2_score": fellow.milestone_2_score,
        "milestone_3_score": fellow.milestone_3_score,
        "final_score": fellow.final_score,
    }
