from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment
from app.models.warning import Warning
from app.models.applicant import Applicant
from app.agents.delivery_agent import DeliveryAgent
from app.utils.email import email_service
from app.utils.slack import slack_notifier
from app.services.notification_service import create_notification

router = APIRouter(prefix="/delivery")

class CheckInAnalyzeRequest(BaseModel):
    check_in_id: UUID

class RiskAssessRequest(BaseModel):
    fellow_id: UUID

class WarningDraftRequest(BaseModel):
    fellow_id: UUID

class WarningApproveRequest(BaseModel):
    approved: bool
    edited_message: Optional[str] = None

@router.post("/check-in/analyze")
async def analyze_check_in(
    request: CheckInAnalyzeRequest,
    db: AsyncSession = Depends(get_db)
):
    """Analyze a check-in submission using AI."""
    # Get check-in
    result = await db.execute(select(CheckIn).where(CheckIn.id == request.check_in_id))
    check_in = result.scalar_one_or_none()
    if not check_in:
        raise HTTPException(status_code=404, detail="Check-in not found")

    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == check_in.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Run AI analysis
    delivery_agent = DeliveryAgent(db)
    analysis = await delivery_agent.analyze_check_in(check_in, fellow)

    # Update check-in with analysis
    check_in.ai_analysis = analysis
    check_in.sentiment_score = analysis.get("sentiment_score")
    check_in.risk_contribution = analysis.get("risk_contribution")

    await db.commit()
    await db.refresh(check_in)

    return {
        "check_in_id": str(check_in.id),
        "analysis": analysis
    }

@router.post("/risk/assess")
async def assess_risk(
    request: RiskAssessRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Run risk assessment for a fellow."""
    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == request.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Get recent check-ins
    result = await db.execute(
        select(CheckIn)
        .where(CheckIn.fellow_id == request.fellow_id)
        .order_by(CheckIn.week.desc())
        .limit(4)
    )
    check_ins = list(result.scalars().all())

    # Run AI risk assessment
    delivery_agent = DeliveryAgent(db)
    assessment = await delivery_agent.assess_risk(fellow, check_ins)

    # Create or update risk assessment
    new_assessment = RiskAssessment(
        fellow_id=fellow.id,
        risk_level=assessment["risk_level"],
        risk_score=assessment["risk_score"],
        contributing_factors=assessment["contributing_factors"],
        ai_concerns=assessment["ai_concerns"],
        recommended_action=assessment["recommended_action"]
    )
    db.add(new_assessment)

    # Update fellow's current risk level
    fellow.current_risk_level = assessment["risk_level"]

    await db.commit()
    await db.refresh(new_assessment)

    # Send Slack notification for high-risk fellows
    if assessment["risk_level"] in ["at_risk", "critical"]:
        # Get applicant for fellow name
        applicant_result = await db.execute(select(Applicant).where(Applicant.id == fellow.applicant_id))
        applicant = applicant_result.scalar_one_or_none()

        if applicant:
            background_tasks.add_task(
                slack_notifier.notify_high_risk_fellow,
                fellow_id=str(fellow.id),
                fellow_name=applicant.name,
                role=fellow.role,
                risk_level=assessment["risk_level"],
                risk_score=assessment["risk_score"],
                concerns=assessment.get("concerns", [])
            )
            await create_notification(
                db,
                type="risk_alert",
                title=f"High Risk: {applicant.name}",
                message=f"{applicant.name} ({fellow.role}) flagged as {assessment['risk_level']} with score {assessment['risk_score']:.1f}",
                action_url="/risk",
            )

    return {
        "assessment_id": str(new_assessment.id),
        "fellow_id": str(fellow.id),
        **assessment
    }

@router.post("/warning/draft")
async def draft_warning(
    request: WarningDraftRequest,
    db: AsyncSession = Depends(get_db)
):
    """Draft a warning message for a fellow using AI."""
    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == request.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Get latest risk assessment
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.fellow_id == request.fellow_id)
        .order_by(RiskAssessment.assessed_at.desc())
        .limit(1)
    )
    risk_assessment = result.scalar_one_or_none()
    if not risk_assessment:
        raise HTTPException(status_code=404, detail="No risk assessment found. Run risk assessment first.")

    # Get recent check-ins
    result = await db.execute(
        select(CheckIn)
        .where(CheckIn.fellow_id == request.fellow_id)
        .order_by(CheckIn.week.desc())
        .limit(3)
    )
    check_ins = list(result.scalars().all())

    # Draft warning using AI
    delivery_agent = DeliveryAgent(db)
    warning_count = fellow.warnings_count or 0
    draft = await delivery_agent.draft_warning(fellow, risk_assessment, check_ins, warning_count)

    # Create warning in draft state using correct model fields
    new_warning = Warning(
        fellow_id=fellow.id,
        level="final" if warning_count >= 1 else "first",
        concerns=risk_assessment.ai_concerns or ["Performance concerns identified"],
        requirements=draft.get("requirements", draft.get("required_actions", [])),
        draft_message=draft.get("message", ""),
    )
    db.add(new_warning)
    await db.commit()
    await db.refresh(new_warning)

    return {
        "warning_id": str(new_warning.id),
        "fellow_id": str(fellow.id),
        "draft": {
            "id": str(new_warning.id),
            "message": draft.get("message", ""),
            "tone": draft.get("tone", "firm_supportive"),
            "warning_number": warning_count + 1,
            "required_actions": draft.get("requirements", draft.get("required_actions", [])),
            "consequences": draft.get("escalation_note", ""),
            "key_points": draft.get("key_points", []),
        }
    }

@router.post("/warning/{warning_id}/approve")
async def approve_warning(
    warning_id: UUID,
    request: WarningApproveRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Approve or reject a warning draft."""
    # Get warning
    result = await db.execute(select(Warning).where(Warning.id == warning_id))
    warning = result.scalar_one_or_none()
    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == warning.fellow_id))
    fellow = result.scalar_one_or_none()

    # Get fellow's email from applicant record
    applicant = None
    if fellow:
        result = await db.execute(select(Applicant).where(Applicant.id == fellow.applicant_id))
        applicant = result.scalar_one_or_none()

    if request.approved:
        # Use edited message if provided, otherwise use draft_message
        warning.final_message = request.edited_message or warning.draft_message
        warning.issued_at = datetime.utcnow()

        # Update fellow's warning count
        if fellow:
            fellow.warnings_count = (fellow.warnings_count or 0) + 1

            # Send warning email in background
            if applicant and applicant.email:
                # Get latest risk assessment for context
                result = await db.execute(
                    select(RiskAssessment)
                    .where(RiskAssessment.fellow_id == fellow.id)
                    .order_by(RiskAssessment.assessed_at.desc())
                    .limit(1)
                )
                risk = result.scalar_one_or_none()

                background_tasks.add_task(
                    email_service.send_fellow_warning,
                    fellow_email=applicant.email,
                    fellow_name=applicant.name,
                    warning_number=(fellow.warnings_count or 1),
                    message=warning.final_message,
                    risk_level=risk.risk_level if risk else fellow.current_risk_level,
                    required_actions=warning.requirements or [],
                    consequences=""
                )

    await db.commit()
    await db.refresh(warning)

    # Send Slack notification and create in-app notification for approved warnings
    if request.approved and applicant:
        warning_num = fellow.warnings_count or 1
        background_tasks.add_task(
            slack_notifier.notify_warning_issued,
            fellow_name=applicant.name,
            warning_number=warning_num,
            message=warning.final_message or warning.draft_message or "",
            risk_level=fellow.current_risk_level or "at_risk",
        )
        await create_notification(
            db,
            type="warning_issued",
            title=f"Warning #{warning_num} Issued",
            message=f"Warning issued to {applicant.name} ({fellow.role})",
            action_url=f"/delivery",
        )

    return {
        "warning_id": str(warning.id),
        "approved": request.approved,
        "sent": warning.issued_at is not None
    }

@router.get("/risk/dashboard")
async def get_risk_dashboard(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get risk dashboard data for all fellows."""
    query = select(Fellow).options(selectinload(Fellow.applicant))
    if cohort_id:
        query = query.where(Fellow.cohort_id == cohort_id)

    result = await db.execute(query)
    fellows = result.scalars().all()

    # Group by risk level
    risk_summary = {
        "on_track": 0,
        "monitor": 0,
        "at_risk": 0,
        "critical": 0
    }

    fellows_by_risk = []
    for fellow in fellows:
        if fellow.current_risk_level:
            risk_summary[fellow.current_risk_level] = risk_summary.get(fellow.current_risk_level, 0) + 1

        fellows_by_risk.append({
            "id": str(fellow.id),
            "name": fellow.applicant.name if fellow.applicant else "Unknown",
            "role": fellow.role,
            "team_id": str(fellow.team_id) if fellow.team_id else None,
            "risk_level": fellow.current_risk_level,
            "warnings_count": fellow.warnings_count or 0,
            "milestone_1_score": fellow.milestone_1_score,
            "milestone_2_score": fellow.milestone_2_score
        })

    return {
        "summary": risk_summary,
        "fellows": fellows_by_risk
    }

@router.get("/warnings/{fellow_id}")
async def get_fellow_warnings(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all warnings for a fellow (no auth required)."""
    result = await db.execute(
        select(Warning)
        .where(Warning.fellow_id == fellow_id)
        .order_by(desc(Warning.created_at))
    )
    warnings = result.scalars().all()

    return [
        {
            "id": str(w.id),
            "fellow_id": str(w.fellow_id),
            "level": w.level,
            "concerns": w.concerns,
            "requirements": w.requirements,
            "draft_message": w.draft_message,
            "final_message": w.final_message,
            "issued_at": w.issued_at.isoformat() if w.issued_at else None,
            "acknowledged": w.acknowledged,
            "acknowledged_at": w.acknowledged_at.isoformat() if w.acknowledged_at else None,
            "outcome": w.outcome,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in warnings
    ]
