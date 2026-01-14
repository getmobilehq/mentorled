from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.applicant import Applicant
from app.schemas.applicant import ApplicantCreate, ApplicantResponse, ApplicantUpdate

router = APIRouter(prefix="/applicants")

@router.post("/", response_model=ApplicantResponse)
async def create_applicant(
    applicant: ApplicantCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new applicant."""
    new_applicant = Applicant(**applicant.dict())
    db.add(new_applicant)
    await db.commit()
    await db.refresh(new_applicant)
    return new_applicant

@router.get("/", response_model=List[ApplicantResponse])
async def list_applicants(
    cohort_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List applicants with optional filters."""
    query = select(Applicant)

    if cohort_id:
        query = query.where(Applicant.cohort_id == cohort_id)
    if status:
        query = query.where(Applicant.status == status)

    result = await db.execute(query.order_by(Applicant.applied_at.desc()))
    applicants = result.scalars().all()
    return applicants

@router.get("/{applicant_id}", response_model=ApplicantResponse)
async def get_applicant(applicant_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific applicant."""
    result = await db.execute(select(Applicant).where(Applicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return applicant

@router.patch("/{applicant_id}", response_model=ApplicantResponse)
async def update_applicant(
    applicant_id: UUID,
    updates: ApplicantUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an applicant."""
    result = await db.execute(select(Applicant).where(Applicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    for field, value in updates.dict(exclude_unset=True).items():
        setattr(applicant, field, value)

    await db.commit()
    await db.refresh(applicant)
    return applicant
