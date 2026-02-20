"""Absence request workflow API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.absence_request import AbsenceRequest, AbsenceRequestStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.meeting import Meeting
from app.models.fellow import Fellow
from app.models.user import User
from app.middleware.auth import get_current_user
from app.services.notification_service import create_notification

router = APIRouter(prefix="/absence-requests")


class AbsenceRequestCreate(BaseModel):
    fellow_id: UUID
    meeting_id: UUID
    reason: str


class AbsenceRequestReview(BaseModel):
    note: Optional[str] = None


@router.post("/")
async def create_absence_request(
    data: AbsenceRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an absence request for a future meeting."""
    # Verify fellow exists
    fellow_result = await db.execute(
        select(Fellow).options(selectinload(Fellow.applicant)).where(Fellow.id == data.fellow_id)
    )
    fellow = fellow_result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Verify meeting exists and is in the future
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == data.meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.scheduled_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot request absence for a past meeting")

    # Check for duplicate request
    existing = await db.execute(
        select(AbsenceRequest)
        .where(AbsenceRequest.fellow_id == data.fellow_id)
        .where(AbsenceRequest.meeting_id == data.meeting_id)
        .where(AbsenceRequest.status == AbsenceRequestStatus.PENDING)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A pending absence request already exists for this meeting")

    request = AbsenceRequest(
        fellow_id=data.fellow_id,
        meeting_id=data.meeting_id,
        reason=data.reason,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # Notify ops
    name = fellow.applicant.name if fellow.applicant else "Unknown"
    await create_notification(
        db,
        type="meeting",
        title=f"Absence request from {name}",
        message=f"{name} has requested an absence for {meeting.meeting_type if isinstance(meeting.meeting_type, str) else meeting.meeting_type.value} on {meeting.scheduled_at.strftime('%b %d')}. Reason: {data.reason[:100]}",
        action_url="/attendance",
    )

    return {
        "id": request.id,
        "fellow_id": request.fellow_id,
        "meeting_id": request.meeting_id,
        "reason": request.reason,
        "status": request.status.value if hasattr(request.status, "value") else request.status,
        "requested_at": request.requested_at,
    }


@router.get("/")
async def list_absence_requests(
    status: Optional[str] = None,
    fellow_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List absence requests with optional filters."""
    query = (
        select(AbsenceRequest)
        .options(
            selectinload(AbsenceRequest.fellow).selectinload(Fellow.applicant),
            selectinload(AbsenceRequest.meeting),
        )
    )

    if status:
        query = query.where(AbsenceRequest.status == status)
    if fellow_id:
        query = query.where(AbsenceRequest.fellow_id == fellow_id)

    query = query.order_by(AbsenceRequest.requested_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()

    return [
        {
            "id": r.id,
            "fellow_id": r.fellow_id,
            "fellow_name": r.fellow.applicant.name if r.fellow and r.fellow.applicant else "Unknown",
            "meeting_id": r.meeting_id,
            "meeting_type": r.meeting.meeting_type if isinstance(r.meeting.meeting_type, str) else r.meeting.meeting_type.value,
            "meeting_date": r.meeting.scheduled_at,
            "reason": r.reason,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "requested_at": r.requested_at,
            "reviewed_at": r.reviewed_at,
            "reviewed_by": r.reviewed_by,
            "review_note": r.review_note,
        }
        for r in requests
    ]


@router.patch("/{request_id}/approve")
async def approve_absence_request(
    request_id: UUID,
    data: AbsenceRequestReview = AbsenceRequestReview(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve an absence request and create approved_absence attendance record."""
    result = await db.execute(
        select(AbsenceRequest)
        .options(
            selectinload(AbsenceRequest.fellow).selectinload(Fellow.applicant),
        )
        .where(AbsenceRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Absence request not found")

    if (request.status.value if hasattr(request.status, "value") else request.status) != "pending":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    # Approve the request
    request.status = AbsenceRequestStatus.APPROVED
    request.reviewed_at = datetime.utcnow()
    request.reviewed_by = current_user.id
    request.review_note = data.note

    # Create or update attendance record as approved_absence
    existing_att = await db.execute(
        select(Attendance)
        .where(Attendance.meeting_id == request.meeting_id)
        .where(Attendance.fellow_id == request.fellow_id)
    )
    attendance = existing_att.scalar_one_or_none()

    if attendance:
        attendance.status = AttendanceStatus.APPROVED_ABSENCE
        attendance.approved_by = current_user.id
    else:
        attendance = Attendance(
            meeting_id=request.meeting_id,
            fellow_id=request.fellow_id,
            status=AttendanceStatus.APPROVED_ABSENCE,
            approved_by=current_user.id,
        )
        db.add(attendance)

    await db.commit()

    name = request.fellow.applicant.name if request.fellow and request.fellow.applicant else "Unknown"
    return {
        "id": request.id,
        "status": "approved",
        "fellow_name": name,
        "message": f"Absence approved for {name}. Attendance marked as approved absence.",
    }


@router.patch("/{request_id}/deny")
async def deny_absence_request(
    request_id: UUID,
    data: AbsenceRequestReview = AbsenceRequestReview(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deny an absence request."""
    result = await db.execute(
        select(AbsenceRequest)
        .options(
            selectinload(AbsenceRequest.fellow).selectinload(Fellow.applicant),
        )
        .where(AbsenceRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Absence request not found")

    if (request.status.value if hasattr(request.status, "value") else request.status) != "pending":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    request.status = AbsenceRequestStatus.DENIED
    request.reviewed_at = datetime.utcnow()
    request.reviewed_by = current_user.id
    request.review_note = data.note

    await db.commit()

    name = request.fellow.applicant.name if request.fellow and request.fellow.applicant else "Unknown"

    # Notify the fellow
    await create_notification(
        db,
        type="meeting",
        title=f"Absence request denied",
        message=f"Your absence request for the meeting has been denied.{' Note: ' + data.note if data.note else ''}",
    )

    return {
        "id": request.id,
        "status": "denied",
        "fellow_name": name,
        "message": f"Absence request denied for {name}.",
    }
