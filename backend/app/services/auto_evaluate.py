"""Auto-evaluation service for challenge submissions."""
import logging
from uuid import UUID

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.applicant import Applicant
from app.models.microship import MicroshipSubmission
from app.agents.microship_evaluator import MicroshipEvaluator
from app.utils.email import EmailService
from app.services.applicant_status import update_applicant_status_on_event

logger = logging.getLogger(__name__)


async def run_auto_evaluation(submission_id: UUID):
    """
    Run AI evaluation on a submission in the background.

    Creates its own DB session since this runs via BackgroundTasks.
    """
    logger.info(f"Auto-evaluating submission {submission_id}...")

    async with AsyncSessionLocal() as db:
        try:
            # Get submission
            result = await db.execute(
                select(MicroshipSubmission).where(MicroshipSubmission.id == submission_id)
            )
            submission = result.scalar_one_or_none()
            if not submission:
                logger.error(f"Submission {submission_id} not found for auto-evaluation")
                return

            # Get applicant
            result = await db.execute(
                select(Applicant).where(Applicant.id == submission.applicant_id)
            )
            applicant = result.scalar_one_or_none()
            if not applicant:
                logger.error(f"Applicant {submission.applicant_id} not found for auto-evaluation")
                return

            # Prepare submission data
            submission_data = {
                "applicant_name": applicant.name,
                "role": applicant.role,
                "submission_url": submission.submission_url,
                "submission_type": submission.submission_type,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "deadline": submission.deadline.isoformat() if submission.deadline else None,
                "on_time": submission.on_time,
                "acknowledgment_time": submission.acknowledgment_time.isoformat() if submission.acknowledgment_time else None,
                "communication_log": submission.communication_log or [],
            }

            # Route to correct evaluator method by role
            evaluator = MicroshipEvaluator()

            if applicant.role in ['frontend', 'backend', 'fullstack']:
                evaluation = await evaluator.evaluate_code_submission(submission_data)
            elif applicant.role in ['product', 'product_manager']:
                evaluation = await evaluator.evaluate_prd_submission(submission_data)
            elif applicant.role in ['designer', 'product_designer']:
                evaluation = await evaluator.evaluate_design_submission(submission_data)
            else:
                logger.warning(f"Unsupported role '{applicant.role}' for auto-evaluation of submission {submission_id}")
                return

            # Store result
            submission.raw_analysis = evaluation
            await db.commit()

            outcome = evaluation.get("outcome", "unknown")
            score = evaluation.get("weighted_score", 0)
            logger.info(f"Auto-evaluation complete for submission {submission_id}: {outcome} ({score}/4.0)")

            # Auto-progress applicant status
            await update_applicant_status_on_event(db, applicant.id, "evaluation")

            # Send evaluation result email
            try:
                OUTCOME_MAP = {
                    "progress": "eligible",
                    "borderline": "under review",
                    "do_not_progress": "not eligible",
                }
                email_svc = EmailService()
                await email_svc.send_evaluation_result(
                    applicant_email=applicant.email,
                    applicant_name=applicant.name,
                    overall_score=round(score * 25, 1),
                    eligibility=OUTCOME_MAP.get(outcome, outcome),
                    reasoning=evaluation.get("reasoning", ""),
                    strengths=evaluation.get("strengths"),
                    concerns=evaluation.get("concerns"),
                    confidence=evaluation.get("confidence"),
                )
            except Exception as email_err:
                logger.error(f"Failed to send eval result email for submission {submission_id}: {email_err}")

        except Exception as e:
            logger.error(f"Auto-evaluation failed for submission {submission_id}: {str(e)}")
