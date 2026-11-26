from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.applicant import Applicant
from app.models.cohort import Cohort, CohortStatus
from app.models.evaluation import ApplicationEvaluation
from app.models.microship import MicroshipSubmission
from app.models.decision import Decision, EntityType
from app.models.fellow import Fellow
from app.models.challenge import Challenge
from app.models.user import User, UserRole
from app.schemas.applicant import (
    ApplicantApply,
    ApplicantCreate,
    ApplicantResponse,
    ApplicantUpdate,
)
from app.schemas.auth import LoginResponse
from app.utils.auth import hash_password, create_access_token, create_refresh_token
from app.utils.email import email_service
from app.middleware.auth import get_current_user, require_staff
from app.services.fellow_conversion import convert_applicant_to_fellow
from app.middleware.auth import require_admin
from sqlalchemy import delete as sa_delete, update as sa_update, select as sa_select, func as sa_func

router = APIRouter(prefix="/applicants")

@router.post("/", response_model=ApplicantResponse, dependencies=[Depends(require_staff)])
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


@router.post("/apply", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def apply(
    application: ApplicantApply,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: a candidate applies to an open cohort.
    Creates both an Applicant record and a login account (role=applicant),
    then auto-logs them in so they can submit challenges.
    """
    # Cohort must exist and be accepting applications
    cohort = (
        await db.execute(select(Cohort).where(Cohort.id == application.cohort_id))
    ).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    if cohort.status != CohortStatus.APPLICATIONS_OPEN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This cohort is not currently accepting applications",
        )

    # No duplicate application for this cohort
    existing_applicant = (
        await db.execute(
            select(Applicant).where(
                Applicant.cohort_id == application.cohort_id,
                Applicant.email == application.email,
            )
        )
    ).scalar_one_or_none()
    if existing_applicant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied to this cohort",
        )

    # Find or create the user account (email is the shared identity key)
    user = (
        await db.execute(select(User).where(User.email == application.email))
    ).scalar_one_or_none()
    if user is None:
        user = User(
            email=application.email,
            username=application.email,  # email is unique → safe as username
            full_name=application.name,
            hashed_password=hash_password(application.password),
            role=UserRole.APPLICANT,
            is_active=True,
            is_verified=False,
        )
        db.add(user)
    elif user.role not in (UserRole.APPLICANT, UserRole.VIEWER):
        # An existing staff account shouldn't be repurposed as an applicant
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in to apply.",
        )

    # Create the applicant record
    applicant = Applicant(
        cohort_id=application.cohort_id,
        email=application.email,
        name=application.name,
        role=application.role,
        status="applied",
        portfolio_url=application.portfolio_url,
        github_url=application.github_url,
        linkedin_url=application.linkedin_url,
        project_description=application.project_description,
        time_commitment=application.time_commitment,
        source=application.source or "web_apply",
    )
    db.add(applicant)
    await db.commit()
    await db.refresh(user)

    # Welcome email (best-effort; gated by ENABLE_EMAIL)
    background_tasks.add_task(
        email_service.send_application_received,
        applicant_email=application.email,
        applicant_name=application.name,
        cohort_name=cohort.name,
    )

    # Auto-login: issue tokens so the frontend lands them in the portal
    token_data = {
        "user_id": str(user.id),
        "username": user.username,
        "role": user.role.value,
    }
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me")
async def get_my_application(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current applicant's most recent application + submissions."""
    applicant = (
        await db.execute(
            select(Applicant)
            .where(Applicant.email == current_user.email)
            .order_by(Applicant.applied_at.desc())
        )
    ).scalars().first()
    if not applicant:
        raise HTTPException(
            status_code=404, detail="No application linked to this account"
        )

    submissions = (
        await db.execute(
            select(MicroshipSubmission)
            .where(MicroshipSubmission.applicant_id == applicant.id)
            .order_by(MicroshipSubmission.created_at.desc())
        )
    ).scalars().all()

    cohort = (
        await db.execute(select(Cohort).where(Cohort.id == applicant.cohort_id))
    ).scalar_one_or_none()

    return {
        "id": str(applicant.id),
        "name": applicant.name,
        "email": applicant.email,
        "role": applicant.role,
        "status": applicant.status,
        "cohort_id": str(applicant.cohort_id),
        "cohort_name": cohort.name if cohort else None,
        "applied_at": applicant.applied_at.isoformat() if applicant.applied_at else None,
        "portfolio_url": applicant.portfolio_url,
        "github_url": applicant.github_url,
        "linkedin_url": applicant.linkedin_url,
        "submissions": [
            {
                "id": str(s.id),
                "challenge_ref": str(s.challenge_ref) if s.challenge_ref else None,
                "submission_url": s.submission_url,
                "submission_type": s.submission_type,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "on_time": s.on_time,
            }
            for s in submissions
        ],
    }


@router.get("/", response_model=List[ApplicantResponse], dependencies=[Depends(require_staff)])
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

@router.get("/{applicant_id}", response_model=ApplicantResponse, dependencies=[Depends(require_staff)])
async def get_applicant(applicant_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific applicant."""
    result = await db.execute(select(Applicant).where(Applicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return applicant

@router.patch("/{applicant_id}", response_model=ApplicantResponse, dependencies=[Depends(require_staff)])
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


@router.post("/{applicant_id}/convert-to-fellow", dependencies=[Depends(require_staff)])
async def convert_to_fellow(
    applicant_id: UUID,
    team_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Accept an applicant: create their Fellow record and upgrade their account."""
    applicant = (
        await db.execute(select(Applicant).where(Applicant.id == applicant_id))
    ).scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    fellow = await convert_applicant_to_fellow(db, applicant, team_id=team_id)
    await db.commit()
    await db.refresh(fellow)
    return {
        "message": f"{applicant.name} is now a fellow",
        "fellow_id": str(fellow.id),
        "applicant_id": str(applicant.id),
    }


@router.get("/{applicant_id}/journey", dependencies=[Depends(require_staff)])
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

@router.delete("/{applicant_id}", status_code=204)
async def delete_applicant(
    applicant_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete an applicant and their evaluations/submissions (admin only). Refused once they are a fellow."""
    applicant = (await db.execute(sa_select(Applicant).where(Applicant.id == applicant_id))).scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    has_fellow = (await db.execute(sa_select(sa_func.count()).select_from(Fellow).where(Fellow.applicant_id == applicant_id))).scalar()
    if has_fellow:
        raise HTTPException(status_code=409, detail="This applicant is a fellow. Delete the fellow record first.")
    await db.execute(sa_delete(Applicant).where(Applicant.id == applicant_id))
    await db.commit()
