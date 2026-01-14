"""Check-in API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.check_in import CheckIn
from app.models.fellow import Fellow
from app.models.user import User, UserRole
from app.schemas.check_in import (
    CheckInCreate,
    CheckInResponse,
    CheckInAnalysisResponse,
    CheckInAnalysis
)
from app.api.auth import get_current_user, require_role
from app.agents.check_in_analyzer import CheckInAnalyzer

router = APIRouter(prefix="/check-ins")


@router.post("/", response_model=CheckInResponse)
async def create_check_in(
    check_in: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new check-in submission."""
    # Verify fellow exists
    result = await db.execute(select(Fellow).filter(Fellow.id == check_in.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Create check-in
    db_check_in = CheckIn(
        fellow_id=check_in.fellow_id,
        week=check_in.week,
        accomplishments=check_in.accomplishments,
        next_focus=check_in.next_focus,
        blockers=check_in.blockers,
        needs_help=check_in.needs_help,
        self_assessment=check_in.self_assessment,
        collaboration_rating=check_in.collaboration_rating,
        energy_level=check_in.energy_level,
    )

    db.add(db_check_in)
    await db.commit()
    await db.refresh(db_check_in)

    return db_check_in


@router.get("/{check_in_id}", response_model=CheckInResponse)
async def get_check_in(
    check_in_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific check-in by ID."""
    result = await db.execute(select(CheckIn).filter(CheckIn.id == check_in_id))
    check_in = result.scalar_one_or_none()

    if not check_in:
        raise HTTPException(status_code=404, detail="Check-in not found")

    return check_in


@router.get("/fellow/{fellow_id}", response_model=List[CheckInResponse])
async def get_fellow_check_ins(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all check-ins for a specific fellow."""
    result = await db.execute(
        select(CheckIn)
        .filter(CheckIn.fellow_id == fellow_id)
        .order_by(CheckIn.week.desc())
    )
    check_ins = result.scalars().all()
    return check_ins


@router.get("/", response_model=List[CheckInResponse])
async def list_check_ins(
    week: int = None,
    cohort_id: UUID = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """List all check-ins with optional filters."""
    query = select(CheckIn)

    if week is not None:
        query = query.filter(CheckIn.week == week)

    if cohort_id:
        query = query.join(Fellow).filter(Fellow.cohort_id == cohort_id)

    query = query.order_by(CheckIn.submitted_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    check_ins = result.scalars().all()
    return check_ins


@router.post("/analyze/{check_in_id}", response_model=CheckInAnalysisResponse)
async def analyze_check_in(
    check_in_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """Trigger AI analysis of a check-in."""
    # Get check-in and fellow
    result = await db.execute(
        select(CheckIn, Fellow)
        .join(Fellow, CheckIn.fellow_id == Fellow.id)
        .filter(CheckIn.id == check_in_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Check-in not found")

    check_in, fellow = row

    # Prepare data for analyzer
    check_in_data = {
        'fellow_name': fellow.name,
        'week': check_in.week,
        'role': fellow.role,
        'accomplishments': check_in.accomplishments,
        'next_focus': check_in.next_focus,
        'blockers': check_in.blockers,
        'needs_help': check_in.needs_help,
        'self_assessment': check_in.self_assessment,
        'collaboration_rating': check_in.collaboration_rating,
        'energy_level': check_in.energy_level,
        'submitted_at': check_in.submitted_at.isoformat(),
    }

    # Run AI analysis
    analyzer = CheckInAnalyzer()
    analysis_result = await analyzer.analyze_check_in(check_in_data)

    # Update check-in with analysis
    check_in.analysis = analysis_result
    check_in.sentiment_score = analysis_result['sentiment_score']
    check_in.risk_contribution = analysis_result['risk_contribution']
    check_in.blockers_extracted = analysis_result['blockers_extracted']
    check_in.action_items = analysis_result['action_items']
    check_in.analyzed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(check_in)

    # Build response
    analysis = CheckInAnalysis(**analysis_result)

    return CheckInAnalysisResponse(
        check_in_id=check_in.id,
        fellow_id=fellow.id,
        fellow_name=fellow.name,
        week=check_in.week,
        analysis=analysis,
        analyzed_at=check_in.analyzed_at
    )


@router.get("/week/{week}", response_model=List[CheckInResponse])
async def get_check_ins_by_week(
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """Get all check-ins for a specific week."""
    result = await db.execute(
        select(CheckIn)
        .filter(CheckIn.week == week)
        .order_by(CheckIn.submitted_at.desc())
    )
    check_ins = result.scalars().all()
    return check_ins
