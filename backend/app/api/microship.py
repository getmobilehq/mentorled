"""Microship Challenge API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.database import get_db
# TEMPORARY: Auth imports commented out until Phase 4
# from app.models.user import User
# from app.core.auth import get_current_user, require_role, UserRole
from app.models.applicant import Applicant
from app.models.microship import MicroshipSubmission
from app.schemas.microship import (
    MicroshipSubmissionCreate,
    MicroshipSubmissionResponse,
    MicroshipEvaluationRequest,
    MicroshipEvaluationResponse
)
from app.agents.microship_evaluator import MicroshipEvaluator

router = APIRouter()


@router.post("/submissions", response_model=MicroshipSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    submission: MicroshipSubmissionCreate,
    db: AsyncSession = Depends(get_db),
    # TEMPORARY: Auth disabled until Phase 4
    # current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """
    Record a Microship submission.

    Requires admin or program_manager role.
    """
    # Verify applicant exists
    result = await db.execute(
        select(Applicant).where(Applicant.id == submission.applicant_id)
    )
    applicant = result.scalar_one_or_none()

    if not applicant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Applicant not found"
        )

    # Create submission
    new_submission = MicroshipSubmission(
        applicant_id=submission.applicant_id,
        challenge_id=submission.challenge_id,
        submission_url=submission.submission_url,
        submission_type=submission.submission_type,
        submitted_at=submission.submitted_at,
        deadline=submission.deadline,
        on_time=submission.on_time,
        acknowledgment_time=submission.acknowledgment_time,
        communication_log=submission.communication_log or []
    )

    db.add(new_submission)
    await db.commit()
    await db.refresh(new_submission)

    return new_submission


@router.get("/submissions/{submission_id}", response_model=MicroshipSubmissionResponse)
async def get_submission(
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    # TEMPORARY: Auth disabled until Phase 4
    # current_user: User = Depends(get_current_user)
):
    """Get a Microship submission by ID."""
    result = await db.execute(
        select(MicroshipSubmission).where(MicroshipSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    return submission


@router.get("/submissions/applicant/{applicant_id}", response_model=List[MicroshipSubmissionResponse])
async def get_applicant_submissions(
    applicant_id: UUID,
    db: AsyncSession = Depends(get_db),
    # TEMPORARY: Auth disabled until Phase 4
    # current_user: User = Depends(get_current_user)
):
    """Get all Microship submissions for an applicant."""
    result = await db.execute(
        select(MicroshipSubmission).where(MicroshipSubmission.applicant_id == applicant_id)
    )
    submissions = result.scalars().all()

    return submissions


@router.post("/evaluate/{submission_id}", response_model=MicroshipEvaluationResponse)
async def evaluate_submission(
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    # TEMPORARY: Auth disabled until Phase 4
    # current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """
    Trigger AI evaluation of a Microship submission.

    The AI will analyze the submission and provide scores, evidence,
    and recommendations.

    Requires admin or program_manager role.
    """
    # Get submission
    result = await db.execute(
        select(MicroshipSubmission).where(MicroshipSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Get applicant info
    result = await db.execute(
        select(Applicant).where(Applicant.id == submission.applicant_id)
    )
    applicant = result.scalar_one_or_none()

    if not applicant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Applicant not found"
        )

    # Prepare data for AI evaluation
    submission_data = {
        "applicant_name": applicant.name,
        "role": applicant.role,
        "submission_url": submission.submission_url,
        "submission_type": submission.submission_type,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "deadline": submission.deadline.isoformat() if submission.deadline else None,
        "on_time": submission.on_time,
        "acknowledgment_time": submission.acknowledgment_time.isoformat() if submission.acknowledgment_time else None,
        "communication_log": submission.communication_log or []
    }

    try:
        # Call AI evaluator
        evaluator = MicroshipEvaluator()

        # Choose evaluation method based on role
        if applicant.role in ['frontend', 'backend', 'fullstack']:
            evaluation = await evaluator.evaluate_code_submission(submission_data)
        elif applicant.role in ['product', 'product_manager']:
            evaluation = await evaluator.evaluate_prd_submission(submission_data)
        elif applicant.role in ['designer', 'product_designer']:
            evaluation = await evaluator.evaluate_design_submission(submission_data)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported role for Microship evaluation: {applicant.role}"
            )

        # Store raw analysis in submission
        submission.raw_analysis = evaluation
        await db.commit()
        await db.refresh(submission)

        return {
            "submission_id": str(submission.id),
            "applicant_id": str(applicant.id),
            "applicant_name": applicant.name,
            "evaluation": evaluation,
            "evaluated_at": submission.created_at
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation failed: {str(e)}"
        )


@router.get("/submissions", response_model=List[MicroshipSubmissionResponse])
async def list_submissions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    # TEMPORARY: Auth disabled until Phase 4
    # current_user: User = Depends(get_current_user)
):
    """List all Microship submissions with pagination."""
    result = await db.execute(
        select(MicroshipSubmission)
        .offset(skip)
        .limit(limit)
    )
    submissions = result.scalars().all()

    return submissions
