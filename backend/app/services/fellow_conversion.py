"""
Convert an accepted applicant into a Fellow and upgrade their account.

Shared by the bulk accept flow and the explicit
POST /applicants/{id}/convert-to-fellow endpoint.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.applicant import Applicant
from app.models.fellow import Fellow, FellowStatus
from app.models.user import User, UserRole


async def convert_applicant_to_fellow(
    db: AsyncSession,
    applicant: Applicant,
    team_id: Optional[UUID] = None,
) -> Fellow:
    """
    Idempotently create a Fellow for an applicant and upgrade their login
    account from `applicant` to `viewer` (the fellow portal role).

    Does NOT commit — the caller owns the transaction so this can be batched.
    """
    # Mark the applicant accepted
    applicant.status = "accepted"

    # Reuse an existing fellow if one already exists for this applicant
    existing = (
        await db.execute(select(Fellow).where(Fellow.applicant_id == applicant.id))
    ).scalar_one_or_none()

    if existing:
        fellow = existing
        if team_id is not None:
            fellow.team_id = team_id
    else:
        fellow = Fellow(
            applicant_id=applicant.id,
            cohort_id=applicant.cohort_id,
            team_id=team_id,
            role=applicant.role,
            status=FellowStatus.ACTIVE.value,
            started_at=datetime.utcnow(),
        )
        db.add(fellow)

    # Upgrade the matching user account to fellow-level access
    user = (
        await db.execute(select(User).where(User.email == applicant.email))
    ).scalar_one_or_none()
    if user and user.role == UserRole.APPLICANT:
        user.role = UserRole.VIEWER
        user.is_verified = True

    await db.flush()
    return fellow
