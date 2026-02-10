from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.applicant import Applicant
from app.models.evaluation import ApplicationEvaluation
from app.models.microship import MicroshipSubmission
from app.models.decision import Decision, EntityType
from app.models.fellow import Fellow
from app.models.challenge import Challenge
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


@router.get("/{applicant_id}/journey")
async def get_applicant_journey(applicant_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get the full journey timeline for an applicant."""
    # Get applicant
    result = await db.execute(select(Applicant).where(Applicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Get evaluations
    eval_result = await db.execute(
        select(ApplicationEvaluation)
        .where(ApplicationEvaluation.applicant_id == applicant_id)
        .order_by(ApplicationEvaluation.evaluated_at.asc())
    )
    evaluations = eval_result.scalars().all()

    # Get microship submissions
    sub_result = await db.execute(
        select(MicroshipSubmission)
        .where(MicroshipSubmission.applicant_id == applicant_id)
        .order_by(MicroshipSubmission.created_at.asc())
    )
    submissions = sub_result.scalars().all()

    # Get challenge titles for submissions
    challenge_titles = {}
    for sub in submissions:
        if sub.challenge_ref and sub.challenge_ref not in challenge_titles:
            ch_result = await db.execute(
                select(Challenge.title).where(Challenge.id == sub.challenge_ref)
            )
            title = ch_result.scalar_one_or_none()
            challenge_titles[sub.challenge_ref] = title or "Unknown Challenge"

    # Get decisions
    dec_result = await db.execute(
        select(Decision).where(
            Decision.entity_type == EntityType.APPLICANT,
            Decision.entity_id == applicant_id,
        ).order_by(Decision.created_at.asc())
    )
    decisions = dec_result.scalars().all()

    # Get fellow record
    fellow_result = await db.execute(
        select(Fellow).where(Fellow.applicant_id == applicant_id)
    )
    fellow = fellow_result.scalar_one_or_none()

    # Build timeline
    timeline = []

    # Applied event
    if applicant.applied_at:
        timeline.append({
            "type": "applied",
            "date": applicant.applied_at.isoformat(),
            "title": "Application Submitted",
            "description": f"Applied as {applicant.role.replace('_', ' ').title()}",
        })

    # Evaluation events
    for ev in evaluations:
        eval_type_label = "Application" if ev.evaluation_type == "application" else "Microship"
        score_str = f" (Score: {float(ev.overall_score):.1f})" if ev.overall_score else ""
        timeline.append({
            "type": "evaluation",
            "date": ev.evaluated_at.isoformat(),
            "title": f"{eval_type_label} Evaluation",
            "description": f"Outcome: {ev.outcome or 'N/A'}{score_str}",
            "metadata": {
                "evaluation_type": ev.evaluation_type,
                "overall_score": float(ev.overall_score) if ev.overall_score else None,
                "outcome": ev.outcome,
                "confidence": float(ev.confidence) if ev.confidence else None,
            },
        })

    # Submission events
    for sub in submissions:
        ch_title = challenge_titles.get(sub.challenge_ref, "Challenge")
        if sub.submitted_at:
            on_time_str = " (On Time)" if sub.on_time else " (Late)"
            timeline.append({
                "type": "submission",
                "date": sub.submitted_at.isoformat(),
                "title": f"Submitted: {ch_title}",
                "description": f"{sub.submission_type or 'unknown'} submission{on_time_str}",
                "metadata": {
                    "submission_url": sub.submission_url,
                    "on_time": sub.on_time,
                    "has_evaluation": sub.raw_analysis is not None,
                },
            })

    # Decision events
    for dec in decisions:
        timeline.append({
            "type": "decision",
            "date": dec.created_at.isoformat(),
            "title": f"Decision: {dec.decision.replace('_', ' ').title()}",
            "description": dec.rationale[:200] if dec.rationale else "",
            "metadata": {
                "decision_type": dec.decision_type,
                "decision": dec.decision,
                "made_by_name": dec.made_by_name,
                "ai_assisted": dec.ai_assisted,
            },
        })

    # Fellow started event
    if fellow and fellow.started_at:
        timeline.append({
            "type": "fellow_started",
            "date": fellow.started_at.isoformat(),
            "title": "Became a Fellow",
            "description": f"Status: {fellow.status.replace('_', ' ').title()}",
        })

    # Sort timeline by date
    timeline.sort(key=lambda e: e["date"])

    # Build response
    fellow_data = None
    if fellow:
        fellow_data = {
            "id": str(fellow.id),
            "status": fellow.status,
            "role": fellow.role,
            "microship_score": float(fellow.microship_score) if fellow.microship_score else None,
            "milestone_1_score": float(fellow.milestone_1_score) if fellow.milestone_1_score else None,
            "milestone_2_score": float(fellow.milestone_2_score) if fellow.milestone_2_score else None,
            "current_risk_level": fellow.current_risk_level,
            "warnings_count": fellow.warnings_count,
            "started_at": fellow.started_at.isoformat() if fellow.started_at else None,
        }

    return {
        "applicant": {
            "id": str(applicant.id),
            "name": applicant.name,
            "email": applicant.email,
            "role": applicant.role,
            "status": applicant.status,
            "applied_at": applicant.applied_at.isoformat() if applicant.applied_at else None,
        },
        "timeline": timeline,
        "fellow": fellow_data,
    }
