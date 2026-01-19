from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.models.applicant import Applicant
from app.models.evaluation import ApplicationEvaluation
from app.models.microship import MicroshipSubmission
from app.agents.screening_agent import screening_agent
from app.schemas.evaluation import (
    ApplicationEvaluationRequest,
    ApplicationEvaluationResponse,
    MicroshipEvaluationRequest,
    MicroshipEvaluationResponse,
    ScreeningQueueResponse
)
from app.utils.audit import log_decision
from app.utils.email import email_service

router = APIRouter(prefix="/screening")

@router.post("/application/evaluate", response_model=ApplicationEvaluationResponse)
async def evaluate_application(
    request: ApplicationEvaluationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger AI evaluation of an application.
    """
    # Fetch applicant
    result = await db.execute(
        select(Applicant).where(Applicant.id == request.applicant_id)
    )
    applicant = result.scalar_one_or_none()

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Prepare applicant data for agent
    applicant_data = {
        "name": applicant.name,
        "email": applicant.email,
        "role": applicant.role,
        "portfolio_url": applicant.portfolio_url,
        "github_url": applicant.github_url,
        "project_description": applicant.project_description,
        "time_commitment": applicant.time_commitment
    }

    # Run evaluation
    evaluation = await screening_agent.evaluate_application(
        applicant_id=applicant.id,
        applicant_data=applicant_data
    )

    # Save evaluation
    db_evaluation = ApplicationEvaluation(
        applicant_id=applicant.id,
        evaluation_type="application",
        scores=evaluation.get("scores"),
        overall_score=evaluation.get("overall_score"),
        outcome=evaluation.get("eligibility"),
        reasoning=evaluation.get("reasoning"),
        flags=evaluation.get("flags"),
        confidence=evaluation.get("confidence"),
        model_used=evaluation.get("model_used"),
        prompt_version=evaluation.get("prompt_version"),
        evaluated_by="ai_screening_agent",
        ai_generated=True,
        human_reviewed=False
    )
    db.add(db_evaluation)

    # Update applicant status
    applicant.status = "screening"

    await db.commit()
    await db.refresh(db_evaluation)

    # Log decision in background
    background_tasks.add_task(
        log_decision,
        entity_type="applicant",
        entity_id=applicant.id,
        decision_type="application_screening",
        decision=evaluation.get("eligibility"),
        rationale=evaluation.get("reasoning"),
        ai_assisted=True,
        ai_recommendation=evaluation.get("recommended_action"),
        ai_confidence=evaluation.get("confidence")
    )

    return ApplicationEvaluationResponse(
        evaluation_id=db_evaluation.id,
        applicant_id=applicant.id,
        scores=evaluation.get("scores"),
        overall_score=evaluation.get("overall_score"),
        eligibility=evaluation.get("eligibility"),
        reasoning=evaluation.get("reasoning"),
        flags=evaluation.get("flags", []),
        confidence=evaluation.get("confidence"),
        recommended_action=evaluation.get("recommended_action"),
        requires_human_review=evaluation.get("confidence", 1.0) < 0.7
    )

@router.post("/microship/evaluate", response_model=MicroshipEvaluationResponse)
async def evaluate_microship(
    request: MicroshipEvaluationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger AI evaluation of a Microship submission.
    """
    # Fetch submission
    result = await db.execute(
        select(MicroshipSubmission).where(MicroshipSubmission.id == request.submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Fetch applicant
    result = await db.execute(
        select(Applicant).where(Applicant.id == submission.applicant_id)
    )
    applicant = result.scalar_one_or_none()

    # Prepare submission data
    submission_data = {
        "role": applicant.role,
        "submission_url": submission.submission_url,
        "submission_type": submission.submission_type,
        "submitted_at": submission.submitted_at,
        "deadline": submission.deadline,
        "on_time": submission.on_time,
        "communication_log": submission.communication_log or [],
        "code_analysis": submission.raw_analysis,
        "content": request.content  # For PRD/design submissions
    }

    # Run evaluation
    evaluation = await screening_agent.evaluate_microship(
        applicant_id=applicant.id,
        submission_data=submission_data
    )

    # Save evaluation
    db_evaluation = ApplicationEvaluation(
        applicant_id=applicant.id,
        evaluation_type="microship",
        scores=evaluation.get("scores"),
        overall_score=evaluation.get("weighted_score"),
        outcome=evaluation.get("outcome"),
        reasoning=evaluation.get("reasoning"),
        evidence=evaluation.get("evidence"),
        flags=evaluation.get("concerns"),
        confidence=evaluation.get("confidence"),
        model_used=evaluation.get("model_used"),
        prompt_version=evaluation.get("prompt_version"),
        evaluated_by="ai_screening_agent",
        ai_generated=True,
        human_reviewed=False
    )
    db.add(db_evaluation)

    # Update applicant status
    applicant.status = "microship_evaluated"

    await db.commit()
    await db.refresh(db_evaluation)

    # Log decision
    background_tasks.add_task(
        log_decision,
        entity_type="applicant",
        entity_id=applicant.id,
        decision_type="microship_evaluation",
        decision=evaluation.get("outcome"),
        rationale=evaluation.get("reasoning"),
        ai_assisted=True,
        ai_recommendation=evaluation.get("outcome"),
        ai_confidence=evaluation.get("confidence")
    )

    return MicroshipEvaluationResponse(
        evaluation_id=db_evaluation.id,
        applicant_id=applicant.id,
        scores=evaluation.get("scores"),
        weighted_score=evaluation.get("weighted_score"),
        outcome=evaluation.get("outcome"),
        evidence=evaluation.get("evidence"),
        strengths=evaluation.get("strengths", []),
        concerns=evaluation.get("concerns", []),
        disqualifiers=evaluation.get("disqualifiers"),
        confidence=evaluation.get("confidence"),
        requires_human_review=evaluation.get("requires_human_review", False)
    )

@router.get("/queue", response_model=ScreeningQueueResponse)
async def get_screening_queue(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get current screening queue status.
    """
    # Build query
    query = select(Applicant).where(
        Applicant.status.in_([
            'applied', 'screening', 'microship_submitted', 'microship_evaluated'
        ])
    )

    if cohort_id:
        query = query.where(Applicant.cohort_id == cohort_id)

    result = await db.execute(query)
    applicants = result.scalars().all()

    # Categorize
    pending_applications = len([a for a in applicants if a.status == 'applied'])
    pending_microships = len([a for a in applicants if a.status == 'microship_submitted'])
    requires_review = len([a for a in applicants if a.status in ['screening', 'microship_evaluated']])

    return ScreeningQueueResponse(
        pending_applications=pending_applications,
        pending_microships=pending_microships,
        requires_review=requires_review,
        total_in_queue=len(applicants)
    )

@router.post("/application/{evaluation_id}/approve")
async def approve_application_evaluation(
    evaluation_id: UUID,
    approved: bool,
    override_decision: Optional[str] = None,
    override_reason: Optional[str] = None,
    reviewer_id: Optional[UUID] = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Human review/approval of an application evaluation.
    """
    result = await db.execute(
        select(ApplicationEvaluation).where(ApplicationEvaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    evaluation.human_reviewed = True
    evaluation.human_reviewer_id = reviewer_id

    if override_decision:
        evaluation.human_override = True
        evaluation.outcome = override_decision
        evaluation.override_reason = override_reason

    # Update applicant status
    result = await db.execute(
        select(Applicant).where(Applicant.id == evaluation.applicant_id)
    )
    applicant = result.scalar_one_or_none()

    if approved or override_decision == "eligible":
        applicant.status = "eligible"
    else:
        applicant.status = "not_eligible"

    await db.commit()

    # Send email notification in background
    if background_tasks:
        final_decision = override_decision if override_decision else evaluation.outcome
        background_tasks.add_task(
            email_service.send_evaluation_result,
            applicant_email=applicant.email,
            applicant_name=applicant.name,
            overall_score=evaluation.overall_score or 0,
            eligibility=final_decision,
            reasoning=evaluation.reasoning or "",
            strengths=evaluation.scores.get("strengths", []) if evaluation.scores else [],
            concerns=evaluation.flags or [],
            confidence=evaluation.confidence,
            recommended_action=final_decision
        )

    return {"status": "success", "new_status": applicant.status}
