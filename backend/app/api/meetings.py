"""Meeting and attendance API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional
from datetime import datetime, timedelta
import math

from app.database import get_db
from app.models.meeting import Meeting, MeetingStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.meeting import (
    MeetingResponse, MeetingDetailResponse, MeetingJoinResponse,
    MeetingCreateRequest, MeetingUpdateRequest,
)
from app.services.google_calendar import google_calendar_service
from app.services.event_service import event_publisher

router = APIRouter(prefix="/meetings")


@router.get("/")
async def list_meetings(
    team_id: Optional[UUID] = None,
    sprint_id: Optional[UUID] = None,
    status: Optional[str] = None,
    meeting_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List meetings with optional filters."""
    query = select(Meeting)

    if team_id:
        query = query.where(Meeting.team_id == team_id)
    if sprint_id:
        query = query.where(Meeting.sprint_id == sprint_id)
    if status:
        query = query.where(Meeting.status == status)
    if meeting_type:
        query = query.where(Meeting.meeting_type == meeting_type)

    query = query.order_by(Meeting.scheduled_at)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/upcoming")
async def upcoming_meetings(
    team_id: Optional[UUID] = None,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
):
    """Get upcoming meetings within the next N days."""
    now = datetime.utcnow()
    cutoff = now + timedelta(days=days)

    query = (
        select(Meeting)
        .where(Meeting.scheduled_at >= now)
        .where(Meeting.scheduled_at <= cutoff)
    )

    if team_id:
        query = query.where(Meeting.team_id == team_id)

    query = query.order_by(Meeting.scheduled_at)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting(meeting_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a meeting with attendance records."""
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.attendance_records))
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/", response_model=MeetingResponse)
async def create_meeting(
    request: MeetingCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new meeting. Auto-generates Google Meet link if enabled."""
    unlock_time = request.unlock_time or (request.scheduled_at - timedelta(minutes=15))
    link = request.meeting_link
    google_event_id = None

    # Try to create Google Calendar event with Meet link
    if not link and google_calendar_service.is_enabled:
        summary = f"{request.meeting_type.replace('_', ' ').title()}"
        gcal_result = await google_calendar_service.create_meeting_event(
            summary=summary,
            start_time=request.scheduled_at,
            duration_minutes=request.duration_minutes,
        )
        if gcal_result.get("meet_link"):
            link = gcal_result["meet_link"]
            google_event_id = gcal_result["google_event_id"]

    meeting = Meeting(
        sprint_id=request.sprint_id,
        team_id=request.team_id,
        meeting_type=request.meeting_type,
        scheduled_at=request.scheduled_at,
        duration_minutes=request.duration_minutes,
        meeting_link=link,
        google_event_id=google_event_id,
        is_locked=request.is_locked,
        unlock_time=unlock_time,
        status=MeetingStatus.SCHEDULED,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: UUID,
    request: MeetingUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a meeting's details."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(meeting, key, value)

    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a meeting and its Google Calendar event if applicable."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Clean up Google Calendar event
    if meeting.google_event_id:
        await google_calendar_service.delete_event(meeting.google_event_id)

    await db.delete(meeting)
    await db.commit()
    return {"status": "success", "deleted": str(meeting_id)}


@router.post("/update-lock-states")
async def update_lock_states(db: AsyncSession = Depends(get_db)):
    """Manually trigger meeting lock state transitions (same as scheduler job)."""
    now = datetime.utcnow()

    # Unlock meetings
    result = await db.execute(
        select(Meeting)
        .where(Meeting.status == MeetingStatus.SCHEDULED.value)
        .where(Meeting.unlock_time <= now)
    )
    to_unlock = result.scalars().all()
    for m in to_unlock:
        m.status = MeetingStatus.UNLOCKED
        m.is_locked = False

    # Activate meetings
    result = await db.execute(
        select(Meeting)
        .where(Meeting.status == MeetingStatus.UNLOCKED.value)
        .where(Meeting.scheduled_at <= now)
    )
    to_activate = result.scalars().all()
    for m in to_activate:
        m.status = MeetingStatus.ACTIVE

    await db.commit()
    return {
        "status": "success",
        "unlocked": len(to_unlock),
        "activated": len(to_activate),
    }


@router.post("/{meeting_id}/generate-meet-link")
async def generate_meet_link(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate a real Google Meet link for a meeting (requires Google Calendar enabled)."""
    if not google_calendar_service.is_enabled:
        raise HTTPException(status_code=400, detail="Google Calendar integration is not enabled")

    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.team)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    team_name = meeting.team.name if meeting.team else "Team"
    summary = f"{team_name} — {meeting.meeting_type.replace('_', ' ').title()}"
    gcal_result = await google_calendar_service.create_meeting_event(
        summary=summary,
        start_time=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        description=f"MentorLed meeting · {team_name}",
    )

    if gcal_result.get("meet_link"):
        meeting.meeting_link = gcal_result["meet_link"]
        meeting.google_event_id = gcal_result["google_event_id"]
        await db.commit()
        await db.refresh(meeting)
        return {"status": "success", "meeting_link": meeting.meeting_link, "google_event_id": meeting.google_event_id}

    raise HTTPException(status_code=500, detail="Failed to generate Google Meet link")


@router.post("/{meeting_id}/join", response_model=MeetingJoinResponse)
async def join_meeting(
    meeting_id: UUID,
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Join a meeting. Records attendance and returns the meeting link.

    Attendance status is determined by how late the fellow joins:
    - 0-5 min: present (1.0)
    - 6-15 min: late (0.8)
    - 16+ min: very_late (0.5)
    """
    # Fetch meeting
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    now = datetime.utcnow()

    # Check if meeting is accessible (unlocked or past unlock_time)
    if meeting.is_locked and now < meeting.unlock_time:
        raise HTTPException(status_code=400, detail="Meeting is not yet available to join")

    # Check if meeting window has passed (3 hours after scheduled time)
    if now > meeting.scheduled_at + timedelta(hours=3):
        raise HTTPException(status_code=400, detail="Meeting join window has closed")

    # Check for existing attendance
    result = await db.execute(
        select(Attendance)
        .where(Attendance.meeting_id == meeting_id)
        .where(Attendance.fellow_id == fellow_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Attendance already recorded for this meeting")

    # Calculate lateness
    diff_minutes = (now - meeting.scheduled_at).total_seconds() / 60

    if diff_minutes <= 0:
        attendance_status = AttendanceStatus.PRESENT
        minutes_late = 0
    elif diff_minutes <= 5:
        attendance_status = AttendanceStatus.PRESENT
        minutes_late = math.ceil(diff_minutes)
    elif diff_minutes <= 15:
        attendance_status = AttendanceStatus.LATE
        minutes_late = math.ceil(diff_minutes)
    else:
        attendance_status = AttendanceStatus.VERY_LATE
        minutes_late = math.ceil(diff_minutes)

    # Record attendance
    attendance = Attendance(
        meeting_id=meeting_id,
        fellow_id=fellow_id,
        status=attendance_status,
        joined_at=now,
        minutes_late=minutes_late,
    )
    db.add(attendance)
    await db.commit()

    # Broadcast attendance event
    await event_publisher.attendance_recorded(
        fellow_id=str(fellow_id),
        meeting_id=str(meeting_id),
        status=attendance_status.value,
        team_id=str(meeting.team_id),
    )

    return MeetingJoinResponse(
        meeting_link=meeting.meeting_link,
        attendance_recorded=True,
        status=attendance_status.value,
        minutes_late=minutes_late,
    )
