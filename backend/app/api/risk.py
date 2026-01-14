"""Risk Assessment API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.risk_assessment import RiskAssessment
from app.models.fellow import Fellow
from app.models.user import User, UserRole
from app.schemas.check_in import RiskAssessmentResponse
from app.api.auth import get_current_user, require_role
from app.services.risk_service import RiskDetectionService

router = APIRouter(prefix="/risk")


@router.post("/assess/{fellow_id}", response_model=RiskAssessmentResponse)
async def assess_fellow_risk(
    fellow_id: UUID,
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """
    Perform risk assessment for a fellow at a specific week.
    """
    # Verify fellow exists
    result = await db.execute(select(Fellow).filter(Fellow.id == fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Run risk assessment
    risk_service = RiskDetectionService(db)
    try:
        assessment_data = await risk_service.assess_fellow_risk(fellow_id, week)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if assessment already exists for this week
    result = await db.execute(
        select(RiskAssessment).filter(
            RiskAssessment.fellow_id == fellow_id,
            RiskAssessment.week == week
        )
    )
    existing_assessment = result.scalar_one_or_none()

    if existing_assessment:
        # Update existing
        existing_assessment.risk_level = assessment_data['risk_level']
        existing_assessment.risk_score = assessment_data['risk_score']
        existing_assessment.signals = assessment_data['signals']
        existing_assessment.concerns = assessment_data['concerns']
        existing_assessment.recommended_action = assessment_data['recommended_action']
        existing_assessment.assessed_at = datetime.utcnow()
        db_assessment = existing_assessment
    else:
        # Create new
        db_assessment = RiskAssessment(
            fellow_id=fellow_id,
            week=week,
            risk_level=assessment_data['risk_level'],
            risk_score=assessment_data['risk_score'],
            signals=assessment_data['signals'],
            concerns=assessment_data['concerns'],
            recommended_action=assessment_data['recommended_action']
        )
        db.add(db_assessment)

    # Update fellow's current risk score
    fellow.current_risk_score = assessment_data['risk_score']

    await db.commit()
    await db.refresh(db_assessment)

    return db_assessment


@router.get("/fellow/{fellow_id}", response_model=List[RiskAssessmentResponse])
async def get_fellow_risk_history(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all risk assessments for a fellow."""
    result = await db.execute(
        select(RiskAssessment)
        .filter(RiskAssessment.fellow_id == fellow_id)
        .order_by(desc(RiskAssessment.week))
    )
    assessments = result.scalars().all()
    return assessments


@router.get("/dashboard/{cohort_id}")
async def get_risk_dashboard(
    cohort_id: UUID,
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """Get risk dashboard for a cohort."""
    risk_service = RiskDetectionService(db)
    dashboard_data = await risk_service.get_cohort_risk_dashboard(cohort_id, week)
    return dashboard_data


@router.get("/assessment/{assessment_id}", response_model=RiskAssessmentResponse)
async def get_risk_assessment(
    assessment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific risk assessment."""
    result = await db.execute(
        select(RiskAssessment).filter(RiskAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    return assessment


@router.post("/action/{assessment_id}")
async def record_action_taken(
    assessment_id: UUID,
    action: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """Record action taken on a risk assessment."""
    result = await db.execute(
        select(RiskAssessment).filter(RiskAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    assessment.action_taken = action
    assessment.actioned_by = current_user.id
    assessment.actioned_at = datetime.utcnow()

    await db.commit()
    await db.refresh(assessment)

    return {"message": "Action recorded", "assessment": assessment}


@router.get("/week/{week}")
async def get_assessments_by_week(
    week: int,
    cohort_id: UUID = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """Get all risk assessments for a specific week."""
    query = select(RiskAssessment).filter(RiskAssessment.week == week)

    if cohort_id:
        query = query.join(Fellow).filter(Fellow.cohort_id == cohort_id)

    query = query.order_by(desc(RiskAssessment.risk_score))

    result = await db.execute(query)
    assessments = result.scalars().all()
    return assessments
