"""Mentor API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import date

from app.database import get_db
from app.models.mentor import Mentor
from app.models.team import Team
from app.models.fellow import Fellow
from app.models.sprint import Sprint
from app.models.attendance import Attendance, AttendanceStatus
from app.models.mentor_note import MentorNote
from app.models.user import User
from app.middleware.auth import get_current_user


class MentorNoteCreate(BaseModel):
    fellow_id: UUID
    content: str
    action_items: Optional[List[str]] = None
    mood: Optional[str] = None
    next_meeting_date: Optional[date] = None

router = APIRouter(prefix="/mentors")


@router.get("/me")
async def get_my_mentor_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the mentor profile matching the current user's email."""
    result = await db.execute(
        select(Mentor)
        .options(selectinload(Mentor.teams))
        .where(Mentor.email == current_user.email)
    )
    mentor = result.scalar_one_or_none()
    if not mentor:
        raise HTTPException(status_code=404, detail="No mentor profile linked to this account")
    return {
        "id": str(mentor.id),
        "email": mentor.email,
        "name": mentor.name,
        "stack": mentor.stack.value if hasattr(mentor.stack, 'value') else mentor.stack,
        "capacity": mentor.capacity,
        "status": mentor.status.value if hasattr(mentor.status, 'value') else mentor.status,
        "teams": [
            {"id": str(t.id), "name": t.name, "status": t.status.value if hasattr(t.status, 'value') else t.status}
            for t in mentor.teams
        ],
    }


@router.get("/teams/{team_id}/health")
async def get_team_health(
    team_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get team health metrics for the mentor dashboard."""
    # Get team with fellows
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.fellows).selectinload(Fellow.applicant),
            selectinload(Team.sprints),
        )
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    fellows = team.fellows
    sprints = team.sprints

    # Sprint delivery: % of completed sprints out of total
    def get_status(s):
        return s.status.value if hasattr(s.status, 'value') else s.status

    completed_sprints = [s for s in sprints if get_status(s) == 'completed']
    active_sprint = next((s for s in sprints if get_status(s) == 'active'), None)
    sprint_delivery = (len(completed_sprints) / len(sprints) * 100) if sprints else 0

    # Attendance: avg across all fellows
    total_attendance_score = 0
    fellows_with_attendance = 0
    score_map = {'present': 1.0, 'late': 0.8, 'very_late': 0.5, 'absent': 0.0, 'approved_absence': 0.7}

    fellow_data = []
    for fellow in fellows:
        att_result = await db.execute(
            select(Attendance).where(Attendance.fellow_id == fellow.id)
        )
        attendance_records = att_result.scalars().all()

        att_score = 0
        if attendance_records:
            att_score = sum(
                score_map.get(a.status.value if hasattr(a.status, 'value') else a.status, 0.5)
                for a in attendance_records
            ) / len(attendance_records)
            total_attendance_score += att_score
            fellows_with_attendance += 1

        fellow_data.append({
            "id": str(fellow.id),
            "name": fellow.applicant.name if fellow.applicant else "Unknown",
            "email": fellow.applicant.email if fellow.applicant else "",
            "role": fellow.role,
            "status": fellow.status.value if hasattr(fellow.status, 'value') else fellow.status,
            "risk_level": fellow.current_risk_level,
            "risk_score": float(fellow.current_risk_score) if fellow.current_risk_score else None,
            "warnings_count": fellow.warnings_count,
            "mentor_flags": fellow.mentor_flags,
            "attendance_score": round(att_score * 100),
            "milestone_1": float(fellow.milestone_1_score) if fellow.milestone_1_score else None,
            "milestone_2": float(fellow.milestone_2_score) if fellow.milestone_2_score else None,
            "milestone_3": float(fellow.milestone_3_score) if fellow.milestone_3_score else None,
            "final_score": float(fellow.final_score) if fellow.final_score else None,
        })

    avg_attendance = (total_attendance_score / fellows_with_attendance * 100) if fellows_with_attendance else 0
    at_risk_count = sum(1 for f in fellows if f.current_risk_level in ('at_risk', 'critical'))

    return {
        "team_id": str(team.id),
        "team_name": team.name,
        "sprint_delivery": round(sprint_delivery, 1),
        "active_sprint": active_sprint.sprint_number if active_sprint else None,
        "total_sprints": len(sprints),
        "completed_sprints": len(completed_sprints),
        "avg_attendance": round(avg_attendance, 1),
        "at_risk_count": at_risk_count,
        "fellow_count": len(fellows),
        "fellows": fellow_data,
    }


@router.post("/fellows/{fellow_id}/flag")
async def flag_fellow(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mentor flags a fellow for concern. Increments mentor_flags count."""
    result = await db.execute(
        select(Fellow).options(selectinload(Fellow.applicant)).where(Fellow.id == fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    fellow.mentor_flags = (fellow.mentor_flags or 0) + 1
    await db.commit()

    return {
        "fellow_id": str(fellow.id),
        "name": fellow.applicant.name if fellow.applicant else "Unknown",
        "mentor_flags": fellow.mentor_flags,
    }


@router.post("/notes")
async def create_mentor_note(
    note: MentorNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a 1-on-1 meeting note for a fellow."""
    # Verify fellow exists
    result = await db.execute(select(Fellow).where(Fellow.id == note.fellow_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Fellow not found")

    new_note = MentorNote(
        mentor_id=current_user.id,
        fellow_id=note.fellow_id,
        content=note.content,
        action_items=note.action_items,
        mood=note.mood,
        next_meeting_date=note.next_meeting_date,
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)

    return {"id": str(new_note.id), "status": "created"}


@router.get("/notes/fellow/{fellow_id}")
async def get_fellow_notes(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all mentor notes for a fellow."""
    result = await db.execute(
        select(MentorNote)
        .options(selectinload(MentorNote.fellow).selectinload(Fellow.applicant))
        .where(MentorNote.fellow_id == fellow_id)
        .order_by(desc(MentorNote.created_at))
    )
    notes = result.scalars().all()

    return [
        {
            "id": str(n.id),
            "fellow_name": n.fellow.applicant.name if n.fellow and n.fellow.applicant else "Unknown",
            "content": n.content,
            "action_items": n.action_items,
            "mood": n.mood,
            "next_meeting_date": n.next_meeting_date.isoformat() if n.next_meeting_date else None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notes
    ]


@router.get("/notes/my")
async def get_my_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all notes created by the current mentor."""
    result = await db.execute(
        select(MentorNote)
        .options(selectinload(MentorNote.fellow).selectinload(Fellow.applicant))
        .where(MentorNote.mentor_id == current_user.id)
        .order_by(desc(MentorNote.created_at))
    )
    notes = result.scalars().all()

    return [
        {
            "id": str(n.id),
            "fellow_id": str(n.fellow_id),
            "fellow_name": n.fellow.applicant.name if n.fellow and n.fellow.applicant else "Unknown",
            "content": n.content,
            "action_items": n.action_items,
            "mood": n.mood,
            "next_meeting_date": n.next_meeting_date.isoformat() if n.next_meeting_date else None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notes
    ]
