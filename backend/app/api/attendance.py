"""Attendance tracking API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from datetime import datetime, timedelta

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.meeting import Meeting, MeetingStatus
from app.models.fellow import Fellow
from app.schemas.attendance import (
    AttendanceResponse, AttendanceApproveRequest,
    AttendanceSummary, TeamAttendanceSummary,
)

router = APIRouter(prefix="/attendance")

# Score weights for attendance statuses
STATUS_SCORES = {
    "present": 1.0,
    "late": 0.8,
    "very_late": 0.5,
    "absent": 0.0,
    "approved_absence": 0.7,
}


@router.get("/fellow/{fellow_id}")
async def get_fellow_attendance(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get attendance history for a fellow."""
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.meeting))
        .where(Attendance.fellow_id == fellow_id)
        .order_by(Attendance.created_at.desc())
    )
    records = result.scalars().all()

    return [
        {
            "id": r.id,
            "meeting_id": r.meeting_id,
            "fellow_id": r.fellow_id,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "joined_at": r.joined_at,
            "minutes_late": r.minutes_late,
            "approved_by": r.approved_by,
            "created_at": r.created_at,
            "meeting_type": r.meeting.meeting_type.value if hasattr(r.meeting.meeting_type, 'value') else r.meeting.meeting_type,
            "scheduled_at": r.meeting.scheduled_at,
        }
        for r in records
    ]


@router.get("/team/{team_id}", response_model=TeamAttendanceSummary)
async def get_team_attendance(
    team_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get team attendance summary with per-member scores."""
    # Get all fellows in the team
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.team_id == team_id)
    )
    fellows = result.scalars().all()

    if not fellows:
        raise HTTPException(status_code=404, detail="No fellows found for this team")

    members = []
    total_score = 0.0

    for fellow in fellows:
        # Get all attendance records for this fellow
        result = await db.execute(
            select(Attendance)
            .join(Meeting)
            .where(Attendance.fellow_id == fellow.id)
            .where(Meeting.team_id == team_id)
        )
        records = result.scalars().all()

        total = len(records)
        if total == 0:
            score = 1.0  # No meetings yet = perfect
        else:
            score_sum = sum(
                STATUS_SCORES.get(
                    r.status.value if hasattr(r.status, 'value') else r.status,
                    0.5
                )
                for r in records
            )
            score = score_sum / total

        status_counts = {}
        for r in records:
            s = r.status.value if hasattr(r.status, 'value') else r.status
            status_counts[s] = status_counts.get(s, 0) + 1

        name = fellow.applicant.name if fellow.applicant else "Unknown"

        members.append(AttendanceSummary(
            fellow_id=fellow.id,
            fellow_name=name,
            role=fellow.role,
            total_meetings=total,
            present_count=status_counts.get("present", 0),
            late_count=status_counts.get("late", 0),
            very_late_count=status_counts.get("very_late", 0),
            absent_count=status_counts.get("absent", 0),
            approved_absence_count=status_counts.get("approved_absence", 0),
            attendance_score=round(score, 2),
        ))
        total_score += score

    team_avg = round(total_score / len(members), 2) if members else 0.0

    # Get total meetings for the team
    result = await db.execute(
        select(Meeting).where(Meeting.team_id == team_id)
    )
    all_meetings = result.scalars().all()

    return TeamAttendanceSummary(
        team_id=team_id,
        team_average=team_avg,
        total_meetings=len(all_meetings),
        members=members,
    )


@router.post("/{meeting_id}/approve-absence", response_model=AttendanceResponse)
async def approve_absence(
    meeting_id: UUID,
    data: AttendanceApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Approve an absence for a fellow (sets status to approved_absence)."""
    # Check if attendance record exists
    result = await db.execute(
        select(Attendance)
        .where(Attendance.meeting_id == meeting_id)
        .where(Attendance.fellow_id == data.fellow_id)
    )
    attendance = result.scalar_one_or_none()

    if attendance:
        # Update existing record
        attendance.status = AttendanceStatus.APPROVED_ABSENCE
        attendance.approved_by = data.fellow_id  # In practice, this would be the mentor's ID
    else:
        # Create new record as approved absence
        attendance = Attendance(
            meeting_id=meeting_id,
            fellow_id=data.fellow_id,
            status=AttendanceStatus.APPROVED_ABSENCE,
            approved_by=data.fellow_id,
        )
        db.add(attendance)

    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.post("/finalize-meetings")
async def finalize_meetings(db: AsyncSession = Depends(get_db)):
    """
    Manually trigger absent-marking for all past meetings.
    Finds meetings past their 3-hour join window, marks absent fellows,
    and transitions meetings to COMPLETED status.
    """
    cutoff = datetime.utcnow() - timedelta(hours=3)

    result = await db.execute(
        select(Meeting)
        .where(Meeting.scheduled_at <= cutoff)
        .where(Meeting.status != MeetingStatus.COMPLETED)
    )
    meetings = result.scalars().all()

    total_absent = 0
    for meeting in meetings:
        fellows_result = await db.execute(
            select(Fellow).where(Fellow.team_id == meeting.team_id)
        )
        fellows = fellows_result.scalars().all()

        for fellow in fellows:
            existing = await db.execute(
                select(Attendance.id)
                .where(Attendance.meeting_id == meeting.id)
                .where(Attendance.fellow_id == fellow.id)
            )
            if existing.scalar_one_or_none():
                continue

            db.add(Attendance(
                meeting_id=meeting.id,
                fellow_id=fellow.id,
                status=AttendanceStatus.ABSENT,
            ))
            total_absent += 1

        meeting.status = MeetingStatus.COMPLETED

    await db.commit()
    return {
        "status": "success",
        "meetings_finalized": len(meetings),
        "absences_marked": total_absent,
    }
