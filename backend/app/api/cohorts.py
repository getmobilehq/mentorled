from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.cohort import Cohort
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/cohorts")

class CohortCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    target_size: int = 100

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
