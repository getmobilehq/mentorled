"""Warning Workflow API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models.warning import Warning
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment
from app.models.user import User, UserRole
from app.schemas.warning import (
    WarningDraftRequest,
    WarningDraftResponse,
    WarningCreate,
    WarningUpdate,
    WarningResponse,
    WarningIssueRequest,
    WarningAcknowledgeRequest,
    WarningDraft
)
from app.middleware.auth import get_current_user, require_role
from app.agents.warning_drafter import WarningDrafter

router = APIRouter(prefix="/warnings")


@router.post("/draft", response_model=WarningDraftResponse)
async def draft_warning(
    request: WarningDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """
    Generate AI draft of a warning message.
    """
    # Get fellow and related data
    result = await db.execute(
        select(Fellow).filter(Fellow.id == request.fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Get recent check-ins
    result = await db.execute(
        select(CheckIn)
        .filter(CheckIn.fellow_id == request.fellow_id)
        .order_by(desc(CheckIn.week))
        .limit(3)
    )
    recent_check_ins = result.scalars().all()

    # Get latest risk assessment
    result = await db.execute(
        select(RiskAssessment)
        .filter(RiskAssessment.fellow_id == request.fellow_id)
        .order_by(desc(RiskAssessment.assessed_at))
        .limit(1)
    )
    risk_assessment = result.scalar_one_or_none()

    # Get previous warning if this is a final warning
    previous_warning = None
    if request.level == 'final':
        result = await db.execute(
            select(Warning)
            .filter(
                Warning.fellow_id == request.fellow_id,
                Warning.level == 'first'
            )
            .order_by(desc(Warning.issued_at))
            .limit(1)
        )
        previous_warning = result.scalar_one_or_none()

    # Prepare data for AI drafter
    warning_data = {
        'fellow_name': fellow.applicant.name if fellow.applicant else 'Unknown',
        'role': fellow.role,
        'current_week': 'Unknown',  # TODO: Calculate from cohort
        'warnings_count': fellow.warnings_count,
        'level': request.level,
        'concerns': request.concerns,
    }

    if risk_assessment:
        warning_data['risk_assessment'] = {
            'risk_level': risk_assessment.risk_level,
            'risk_score': float(risk_assessment.risk_score),
            'signals': risk_assessment.signals,
            'concerns': risk_assessment.concerns,
        }

    if recent_check_ins:
        warning_data['recent_check_ins'] = [
            {
                'week': ci.week,
                'accomplishments': ci.accomplishments,
                'blockers': ci.blockers,
                'sentiment_score': float(ci.sentiment_score) if ci.sentiment_score else None,
                'energy_level': ci.energy_level,
            }
            for ci in recent_check_ins
        ]

    if previous_warning:
        warning_data['previous_warning'] = {
            'issued_at': previous_warning.issued_at.isoformat() if previous_warning.issued_at else None,
            'level': previous_warning.level,
            'requirements': previous_warning.requirements,
            'acknowledged': previous_warning.acknowledged,
        }

    # Generate draft
    drafter = WarningDrafter()
    draft_result = await drafter.draft_warning(warning_data)

    # Build response
    draft = WarningDraft(**draft_result)

    return WarningDraftResponse(
        fellow_id=request.fellow_id,
        fellow_name=warning_data['fellow_name'],
        level=request.level,
        draft=draft,
        drafted_at=datetime.utcnow()
    )


@router.post("/", response_model=WarningResponse)
async def create_warning(
    warning: WarningCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Create a warning (not yet issued)."""
    # Verify fellow exists
    result = await db.execute(select(Fellow).filter(Fellow.id == warning.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    db_warning = Warning(
        fellow_id=warning.fellow_id,
        level=warning.level,
        concerns=warning.concerns,
        requirements=warning.requirements,
        evidence_refs=warning.evidence_refs,
        review_deadline=warning.review_deadline,
        draft_message=warning.draft_message,
    )

    db.add(db_warning)
    await db.commit()
    await db.refresh(db_warning)

    return db_warning


@router.get("/{warning_id}", response_model=WarningResponse)
async def get_warning(
    warning_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific warning."""
    result = await db.execute(select(Warning).filter(Warning.id == warning_id))
    warning = result.scalar_one_or_none()

    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    return warning


@router.get("/fellow/{fellow_id}", response_model=List[WarningResponse])
async def get_fellow_warnings(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all warnings for a fellow."""
    result = await db.execute(
        select(Warning)
        .filter(Warning.fellow_id == fellow_id)
        .order_by(desc(Warning.created_at))
    )
    warnings = result.scalars().all()
    return warnings


@router.put("/{warning_id}", response_model=WarningResponse)
async def update_warning(
    warning_id: UUID,
    update: WarningUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Update warning message before issuing."""
    result = await db.execute(select(Warning).filter(Warning.id == warning_id))
    warning = result.scalar_one_or_none()

    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    if warning.issued_at:
        raise HTTPException(status_code=400, detail="Cannot update already issued warning")

    warning.final_message = update.final_message

    await db.commit()
    await db.refresh(warning)

    return warning


@router.post("/{warning_id}/issue", response_model=WarningResponse)
async def issue_warning(
    warning_id: UUID,
    request: WarningIssueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Issue a warning to the fellow."""
    result = await db.execute(select(Warning).filter(Warning.id == warning_id))
    warning = result.scalar_one_or_none()

    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    if warning.issued_at:
        raise HTTPException(status_code=400, detail="Warning already issued")

    # Mark as issued
    warning.issued_at = datetime.utcnow()
    warning.issued_by = current_user.id

    # Use final_message if set, otherwise use draft_message
    if not warning.final_message and not warning.draft_message:
        raise HTTPException(status_code=400, detail="No message to send")

    if not warning.final_message:
        warning.final_message = warning.draft_message

    # Update fellow's warning count
    result = await db.execute(select(Fellow).filter(Fellow.id == warning.fellow_id))
    fellow = result.scalar_one_or_none()
    if fellow:
        fellow.warnings_count += 1

    await db.commit()
    await db.refresh(warning)

    # TODO: Send email if request.send_email is True

    return warning


@router.post("/{warning_id}/acknowledge")
async def acknowledge_warning(
    warning_id: UUID,
    request: WarningAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fellow acknowledges receipt of warning."""
    result = await db.execute(select(Warning).filter(Warning.id == warning_id))
    warning = result.scalar_one_or_none()

    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    if not warning.issued_at:
        raise HTTPException(status_code=400, detail="Warning not yet issued")

    warning.acknowledged = True
    warning.acknowledged_at = datetime.utcnow()

    await db.commit()
    await db.refresh(warning)

    return {"message": "Warning acknowledged", "warning": warning}


@router.get("/", response_model=List[WarningResponse])
async def list_warnings(
    cohort_id: UUID = None,
    level: str = None,
    acknowledged: bool = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """List all warnings with optional filters."""
    query = select(Warning)

    if cohort_id:
        query = query.join(Fellow).filter(Fellow.cohort_id == cohort_id)

    if level:
        query = query.filter(Warning.level == level)

    if acknowledged is not None:
        query = query.filter(Warning.acknowledged == acknowledged)

    query = query.order_by(desc(Warning.created_at)).limit(limit).offset(offset)

    result = await db.execute(query)
    warnings = result.scalars().all()
    return warnings
