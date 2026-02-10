"""Challenge management API endpoints."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, cast, Date
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.challenge import Challenge, ChallengeStatus
from app.models.challenge_track_config import ChallengeTrackConfig
from app.models.microship import MicroshipSubmission
from app.models.applicant import Applicant
from app.schemas.challenge import (
    ChallengeCreate,
    ChallengeUpdate,
    ChallengeStatusUpdate,
    ChallengeResponse,
    ChallengePublicResponse,
    ChallengeGenerateRequest,
    ChallengeGenerateResponse,
    PublicSubmissionCreate,
    PublicSubmissionResponse,
)
from app.agents.challenge_generator import challenge_generator
from app.utils.email import email_service
from app.services.auto_evaluate import run_auto_evaluation
from app.services.applicant_status import update_applicant_status_on_event

router = APIRouter(prefix="/challenges")


async def _enrich_challenge_response(challenge: Challenge, db: AsyncSession) -> dict:
    """Add total_in_track to a challenge response."""
    total_in_track = None
    if challenge.track_config_id:
        cfg_result = await db.execute(
            select(ChallengeTrackConfig).where(
                ChallengeTrackConfig.id == challenge.track_config_id
            )
        )
        cfg = cfg_result.scalar_one_or_none()
        if cfg:
            total_in_track = cfg.total_challenges
    return {
        "id": challenge.id,
        "cohort_id": challenge.cohort_id,
        "title": challenge.title,
        "description": challenge.description,
        "requirements": challenge.requirements or [],
        "role_type": challenge.role_type,
        "submission_types": challenge.submission_types or [],
        "deadline": challenge.deadline,
        "status": challenge.status,
        "share_token": challenge.share_token,
        "created_by": challenge.created_by,
        "auto_evaluate": challenge.auto_evaluate,
        "duration_hours": challenge.duration_hours,
        "sequence_number": challenge.sequence_number,
        "track_config_id": challenge.track_config_id,
        "total_in_track": total_in_track,
        "created_at": challenge.created_at,
        "updated_at": challenge.updated_at,
    }


@router.post("/", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    challenge: ChallengeCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new challenge."""
    track_config = None
    sequence_number = challenge.sequence_number

    if challenge.track_config_id:
        # Validate track config exists
        cfg_result = await db.execute(
            select(ChallengeTrackConfig).where(
                ChallengeTrackConfig.id == challenge.track_config_id
            )
        )
        track_config = cfg_result.scalar_one_or_none()
        if not track_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Track config not found"
            )

        # Validate role/cohort match
        if challenge.cohort_id and challenge.cohort_id != track_config.cohort_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cohort ID does not match track config's cohort"
            )
        if challenge.role_type != "all" and challenge.role_type != track_config.role_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role type does not match track config's role"
            )

        # Count existing challenges in this track
        count_result = await db.execute(
            select(sqlfunc.count(Challenge.id))
            .where(Challenge.track_config_id == track_config.id)
        )
        current_count = count_result.scalar() or 0

        if current_count >= track_config.total_challenges:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Track already has {current_count}/{track_config.total_challenges} challenges"
            )

        # Auto-assign sequence_number if not provided
        if sequence_number is None:
            max_seq_result = await db.execute(
                select(sqlfunc.max(Challenge.sequence_number))
                .where(Challenge.track_config_id == track_config.id)
            )
            max_seq = max_seq_result.scalar() or 0
            sequence_number = max_seq + 1
        else:
            # Validate sequence uniqueness within track
            existing_seq = await db.execute(
                select(Challenge).where(
                    Challenge.track_config_id == track_config.id,
                    Challenge.sequence_number == sequence_number,
                )
            )
            if existing_seq.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Sequence number {sequence_number} already exists in this track"
                )

        # Use track config's cohort_id and role_type
        cohort_id = track_config.cohort_id
        role_type = track_config.role_type
    else:
        cohort_id = challenge.cohort_id
        role_type = challenge.role_type

    new_challenge = Challenge(
        cohort_id=cohort_id,
        title=challenge.title,
        description=challenge.description,
        requirements=challenge.requirements,
        role_type=role_type,
        submission_types=challenge.submission_types,
        deadline=challenge.deadline,
        status=ChallengeStatus.DRAFT.value,
        auto_evaluate=challenge.auto_evaluate,
        duration_hours=challenge.duration_hours,
        sequence_number=sequence_number,
        track_config_id=challenge.track_config_id,
    )
    db.add(new_challenge)
    await db.commit()
    await db.refresh(new_challenge)

    data = await _enrich_challenge_response(new_challenge, db)
    return ChallengeResponse(**data)


@router.get("/", response_model=List[ChallengeResponse])
async def list_challenges(
    cohort_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    track_config_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List challenges with optional filters."""
    query = select(Challenge)

    if cohort_id:
        query = query.where(Challenge.cohort_id == cohort_id)
    if status_filter:
        query = query.where(Challenge.status == status_filter)
    if track_config_id:
        query = query.where(Challenge.track_config_id == track_config_id)
        query = query.order_by(Challenge.sequence_number.asc())
    else:
        query = query.order_by(Challenge.created_at.desc())

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    challenges = result.scalars().all()

    response = []
    for c in challenges:
        data = await _enrich_challenge_response(c, db)
        response.append(ChallengeResponse(**data))
    return response


@router.post("/generate-content", response_model=ChallengeGenerateResponse)
async def generate_challenge_content(
    request: ChallengeGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate AI-suggested challenge content based on role and context."""
    # Fetch existing challenges in the track for context
    existing_challenges = []
    total_in_track = request.total_in_track

    if request.track_config_id:
        cfg_result = await db.execute(
            select(ChallengeTrackConfig).where(
                ChallengeTrackConfig.id == request.track_config_id
            )
        )
        cfg = cfg_result.scalar_one_or_none()
        if cfg:
            total_in_track = total_in_track or cfg.total_challenges
            challenges_result = await db.execute(
                select(Challenge)
                .where(Challenge.track_config_id == cfg.id)
                .order_by(Challenge.sequence_number.asc())
            )
            for c in challenges_result.scalars().all():
                existing_challenges.append({
                    "sequence_number": c.sequence_number,
                    "title": c.title,
                    "description": c.description[:200] if c.description else "",
                })

    context = {
        "role_type": request.role_type,
        "duration_hours": request.duration_hours,
        "sequence_number": request.sequence_number,
        "total_in_track": total_in_track,
        "existing_challenges": existing_challenges,
        "existing_title": request.existing_title,
        "existing_description": request.existing_description,
    }

    try:
        result = await challenge_generator.generate_content(context)
        return ChallengeGenerateResponse(
            title=result["title"],
            description=result["description"],
            requirements=result["requirements"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI generation failed: {str(e)}"
        )


@router.get("/analytics")
async def get_challenge_analytics(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated analytics across all challenges and submissions."""
    challenge_query = select(Challenge)
    if cohort_id:
        challenge_query = challenge_query.where(Challenge.cohort_id == cohort_id)
    result = await db.execute(challenge_query)
    all_challenges = list(result.scalars().all())
    challenge_ids = [c.id for c in all_challenges]

    if not challenge_ids:
        return {
            "total_challenges": 0,
            "total_submissions": 0,
            "total_evaluated": 0,
            "pending_evaluation": 0,
            "pass_rate": 0,
            "borderline_rate": 0,
            "fail_rate": 0,
            "average_score": 0,
            "on_time_rate": 0,
            "per_challenge": [],
            "submissions_by_day": [],
        }

    # Query all submissions for these challenges
    sub_result = await db.execute(
        select(MicroshipSubmission).where(
            MicroshipSubmission.challenge_ref.in_(challenge_ids)
        )
    )
    all_submissions = list(sub_result.scalars().all())

    total_subs = len(all_submissions)
    evaluated = [s for s in all_submissions if s.raw_analysis is not None]
    total_evaluated = len(evaluated)

    outcomes = {"progress": 0, "borderline": 0, "do_not_progress": 0}
    scores = []
    on_time_count = sum(1 for s in all_submissions if s.on_time)

    for s in evaluated:
        outcome = s.raw_analysis.get("outcome", "")
        if outcome in outcomes:
            outcomes[outcome] += 1
        ws = s.raw_analysis.get("weighted_score")
        if ws is not None:
            scores.append(ws)

    pass_rate = (outcomes["progress"] / total_evaluated * 100) if total_evaluated else 0
    borderline_rate = (outcomes["borderline"] / total_evaluated * 100) if total_evaluated else 0
    fail_rate = (outcomes["do_not_progress"] / total_evaluated * 100) if total_evaluated else 0
    avg_score = sum(scores) / len(scores) if scores else 0
    on_time_rate = (on_time_count / total_subs * 100) if total_subs else 0

    # Per-challenge breakdown
    subs_by_challenge: dict = {}
    for s in all_submissions:
        cid = str(s.challenge_ref)
        subs_by_challenge.setdefault(cid, []).append(s)

    per_challenge = []
    for c in all_challenges:
        c_subs = subs_by_challenge.get(str(c.id), [])
        c_evaluated = [s for s in c_subs if s.raw_analysis is not None]
        c_scores = [
            s.raw_analysis.get("weighted_score", 0)
            for s in c_evaluated
            if s.raw_analysis.get("weighted_score") is not None
        ]
        c_pass = sum(
            1 for s in c_evaluated
            if s.raw_analysis.get("outcome") == "progress"
        )
        per_challenge.append({
            "challenge_id": str(c.id),
            "title": c.title,
            "status": c.status,
            "role_type": c.role_type,
            "submission_count": len(c_subs),
            "evaluated_count": len(c_evaluated),
            "average_score": round(sum(c_scores) / len(c_scores), 2) if c_scores else 0,
            "pass_rate": round(c_pass / len(c_evaluated) * 100, 1) if c_evaluated else 0,
        })

    # Submissions by day (last 14 days)
    fourteen_days_ago = datetime.utcnow() - timedelta(days=14)
    submissions_by_day = []
    daily_counts: dict = {}
    for s in all_submissions:
        if s.submitted_at and s.submitted_at >= fourteen_days_ago:
            day_str = s.submitted_at.strftime("%Y-%m-%d")
            daily_counts[day_str] = daily_counts.get(day_str, 0) + 1
    # Fill in all 14 days (including zeros)
    for i in range(14):
        day = (fourteen_days_ago + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        submissions_by_day.append({"date": day, "count": daily_counts.get(day, 0)})

    return {
        "total_challenges": len(all_challenges),
        "total_submissions": total_subs,
        "total_evaluated": total_evaluated,
        "pending_evaluation": total_subs - total_evaluated,
        "pass_rate": round(pass_rate, 1),
        "borderline_rate": round(borderline_rate, 1),
        "fail_rate": round(fail_rate, 1),
        "average_score": round(avg_score, 2),
        "on_time_rate": round(on_time_rate, 1),
        "per_challenge": per_challenge,
        "submissions_by_day": submissions_by_day,
    }


@router.get("/public/{share_token}", response_model=ChallengePublicResponse)
async def get_public_challenge(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to view a challenge (no auth required)."""
    result = await db.execute(
        select(Challenge).where(Challenge.share_token == share_token)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    total_in_track = None
    if challenge.track_config_id:
        cfg_result = await db.execute(
            select(ChallengeTrackConfig).where(
                ChallengeTrackConfig.id == challenge.track_config_id
            )
        )
        cfg = cfg_result.scalar_one_or_none()
        if cfg:
            total_in_track = cfg.total_challenges

    return ChallengePublicResponse(
        id=challenge.id,
        title=challenge.title,
        description=challenge.description,
        requirements=challenge.requirements or [],
        role_type=challenge.role_type,
        submission_types=challenge.submission_types or [],
        deadline=challenge.deadline,
        status=challenge.status,
        sequence_number=challenge.sequence_number,
        total_in_track=total_in_track,
        duration_hours=challenge.duration_hours,
    )


@router.post("/public/{share_token}/submit", response_model=PublicSubmissionResponse)
async def public_submit(
    share_token: str,
    submission: PublicSubmissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for applicants to submit their work (no auth required)."""
    # Find challenge by share token
    result = await db.execute(
        select(Challenge).where(Challenge.share_token == share_token)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    if challenge.status != ChallengeStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This challenge is not currently accepting submissions"
        )

    if challenge.deadline and datetime.utcnow() > challenge.deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The deadline for this challenge has passed"
        )

    if not challenge.cohort_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This challenge is not linked to a cohort"
        )

    # Look up or create applicant by email in this cohort
    result = await db.execute(
        select(Applicant).where(
            Applicant.email == submission.email,
            Applicant.cohort_id == challenge.cohort_id,
        )
    )
    applicant = result.scalar_one_or_none()

    if not applicant:
        # Create new applicant
        applicant = Applicant(
            cohort_id=challenge.cohort_id,
            email=submission.email,
            name=submission.name,
            role=challenge.role_type if challenge.role_type != "all" else "frontend",
            status="microship_pending",
        )
        db.add(applicant)
        await db.flush()

    # Check for duplicate submission
    result = await db.execute(
        select(MicroshipSubmission).where(
            MicroshipSubmission.applicant_id == applicant.id,
            MicroshipSubmission.challenge_ref == challenge.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted for this challenge"
        )

    # Create submission
    now = datetime.utcnow()
    on_time = challenge.deadline is None or now <= challenge.deadline

    new_submission = MicroshipSubmission(
        applicant_id=applicant.id,
        challenge_ref=challenge.id,
        challenge_id=str(challenge.id),
        submission_url=submission.submission_url,
        submission_type=submission.submission_type,
        submitted_at=now,
        deadline=challenge.deadline,
        on_time=on_time,
        communication_log=[{
            "timestamp": now.isoformat(),
            "type": "submission",
            "content": submission.notes or "Challenge submitted via public link"
        }],
    )
    db.add(new_submission)
    await db.commit()
    await db.refresh(new_submission)

    # Auto-progress applicant status on submission
    await update_applicant_status_on_event(db, applicant.id, "submission")

    # Send confirmation email
    background_tasks.add_task(
        email_service.send_submission_confirmation,
        applicant_email=submission.email,
        applicant_name=submission.name,
        challenge_title=challenge.title,
        submitted_at=now.strftime("%B %d, %Y at %I:%M %p UTC"),
        on_time=on_time,
    )

    # Auto-evaluate if enabled on this challenge
    if challenge.auto_evaluate:
        background_tasks.add_task(run_auto_evaluation, new_submission.id)

    return PublicSubmissionResponse(
        message="Submission received successfully",
        submission_id=new_submission.id,
        challenge_title=challenge.title,
        submitted_at=now,
    )


@router.get("/{challenge_id}", response_model=ChallengeResponse)
async def get_challenge(
    challenge_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific challenge."""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    data = await _enrich_challenge_response(challenge, db)
    return ChallengeResponse(**data)


@router.put("/{challenge_id}", response_model=ChallengeResponse)
async def update_challenge(
    challenge_id: UUID,
    update: ChallengeUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a challenge."""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(challenge, field, value)

    await db.commit()
    await db.refresh(challenge)

    data = await _enrich_challenge_response(challenge, db)
    return ChallengeResponse(**data)


@router.patch("/{challenge_id}/status", response_model=ChallengeResponse)
async def update_challenge_status(
    challenge_id: UUID,
    status_update: ChallengeStatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Change challenge status (activate, close, archive)."""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    valid_statuses = [s.value for s in ChallengeStatus]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    challenge.status = status_update.status
    await db.commit()
    await db.refresh(challenge)

    # Send activation emails when challenge is activated
    if status_update.status == ChallengeStatus.ACTIVE.value and challenge.cohort_id:
        applicants_result = await db.execute(
            select(Applicant).where(Applicant.cohort_id == challenge.cohort_id)
        )
        applicants = applicants_result.scalars().all()

        submission_url = f"/submit/{challenge.share_token}"
        deadline_str = (
            challenge.deadline.strftime("%B %d, %Y at %I:%M %p UTC")
            if challenge.deadline else "N/A"
        )

        for applicant in applicants:
            background_tasks.add_task(
                email_service.send_challenge_activated,
                applicant_email=applicant.email,
                applicant_name=applicant.name,
                challenge_title=challenge.title,
                challenge_description=(challenge.description or "")[:300],
                role_type=challenge.role_type,
                deadline=deadline_str,
                submission_url=submission_url,
                duration_hours=challenge.duration_hours,
                requirements=challenge.requirements or [],
            )

    data = await _enrich_challenge_response(challenge, db)
    return ChallengeResponse(**data)


@router.get("/{challenge_id}/submissions")
async def get_challenge_submissions(
    challenge_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all submissions for a challenge."""
    # Verify challenge exists
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    result = await db.execute(
        select(MicroshipSubmission)
        .where(MicroshipSubmission.challenge_ref == challenge_id)
        .order_by(MicroshipSubmission.created_at.desc())
    )
    submissions = result.scalars().all()

    # Enrich with applicant info
    response = []
    for sub in submissions:
        applicant_result = await db.execute(
            select(Applicant).where(Applicant.id == sub.applicant_id)
        )
        applicant = applicant_result.scalar_one_or_none()

        # Build evaluation data from raw_analysis if available
        evaluation = None
        if sub.raw_analysis:
            raw = sub.raw_analysis
            evaluation = {
                "outcome": raw.get("outcome"),
                "weighted_score": raw.get("weighted_score"),
                "scores": raw.get("scores", {}),
                "evidence": raw.get("evidence", {}),
                "strengths": raw.get("strengths", []),
                "concerns": raw.get("concerns", []),
                "confidence": raw.get("confidence"),
                "reasoning": raw.get("reasoning", ""),
                "disqualifiers": raw.get("disqualifiers"),
            }

        response.append({
            "id": str(sub.id),
            "applicant_id": str(sub.applicant_id),
            "applicant_name": applicant.name if applicant else "Unknown",
            "applicant_email": applicant.email if applicant else "Unknown",
            "submission_url": sub.submission_url,
            "submission_type": sub.submission_type,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "on_time": sub.on_time,
            "has_evaluation": sub.raw_analysis is not None,
            "evaluation": evaluation,
            "created_at": sub.created_at.isoformat(),
        })

    return response
