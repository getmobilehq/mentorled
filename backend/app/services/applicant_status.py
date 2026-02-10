"""Applicant status auto-progression service."""
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.applicant import Applicant

logger = logging.getLogger(__name__)

# Status progression rules (never auto-accept/reject)
STATUS_TRANSITIONS = {
    "submission": {
        "applied": "microship_pending",
        "screening": "microship_pending",
    },
    "evaluation": {
        "microship_pending": "microship_completed",
    },
}


async def update_applicant_status_on_event(
    db: AsyncSession,
    applicant_id: UUID,
    event_type: str,
):
    """
    Advance applicant status based on a pipeline event.

    Args:
        db: Database session
        applicant_id: The applicant to update
        event_type: "submission" or "evaluation"
    """
    transitions = STATUS_TRANSITIONS.get(event_type)
    if not transitions:
        logger.warning(f"Unknown event type: {event_type}")
        return

    result = await db.execute(
        select(Applicant).where(Applicant.id == applicant_id)
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        logger.warning(f"Applicant {applicant_id} not found for status update")
        return

    new_status = transitions.get(applicant.status)
    if new_status:
        old_status = applicant.status
        applicant.status = new_status
        await db.commit()
        logger.info(
            f"Applicant {applicant_id} status: {old_status} -> {new_status} (event: {event_type})"
        )
