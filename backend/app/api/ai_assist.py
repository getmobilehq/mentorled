"""AI assistance endpoints: meeting summaries, retro insights, risk prediction."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
import json

from app.database import get_db
from app.models.meeting import Meeting
from app.models.attendance import Attendance, AttendanceStatus
from app.models.sprint_objective import SprintObjective
from app.models.sprint import Sprint
from app.models.retrospective import Retrospective
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment
from app.agents.llm_client import llm_client

router = APIRouter(prefix="/ai")


@router.post("/meetings/{meeting_id}/summarize")
async def summarize_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI summary for a meeting based on attendance and context."""
    # Get meeting with sprint
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.sprint), selectinload(Meeting.team))
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get attendance records
    att_result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.fellow).selectinload(Fellow.applicant))
        .where(Attendance.meeting_id == meeting_id)
    )
    records = att_result.scalars().all()

    present = []
    absent = []
    late = []
    for r in records:
        name = r.fellow.applicant.name if r.fellow and r.fellow.applicant else "Unknown"
        if r.status == AttendanceStatus.PRESENT:
            present.append(name)
        elif r.status == AttendanceStatus.ABSENT:
            absent.append(name)
        elif r.status == AttendanceStatus.LATE:
            late.append(name)

    # Get sprint objectives for context
    objectives = []
    if meeting.sprint_id:
        obj_result = await db.execute(
            select(SprintObjective).where(SprintObjective.sprint_id == meeting.sprint_id)
        )
        objectives = [
            {"title": o.title, "status": o.status, "evidence": o.evidence_links}
            for o in obj_result.scalars().all()
        ]

    sprint_name = meeting.sprint.name if meeting.sprint else "Unknown"
    team_name = meeting.team.name if meeting.team else "Unknown"

    prompt = f"""Generate a concise meeting summary for a {meeting.meeting_type} meeting.

Context:
- Sprint: {sprint_name}
- Team: {team_name}
- Scheduled: {meeting.scheduled_at.strftime('%B %d, %Y %I:%M %p') if meeting.scheduled_at else 'N/A'}
- Duration: {meeting.duration_minutes} minutes
- Present ({len(present)}): {', '.join(present) if present else 'None'}
- Late ({len(late)}): {', '.join(late) if late else 'None'}
- Absent ({len(absent)}): {', '.join(absent) if absent else 'None'}
- Sprint objectives: {json.dumps(objectives, default=str)}

Return JSON with:
{{
  "summary": "2-3 sentence meeting summary",
  "key_points": ["list of key discussion points/outcomes"],
  "attendance_note": "brief attendance observation",
  "action_items": ["any follow-up items based on context"],
  "health_score": 1-5 (team engagement based on attendance and context)
}}"""

    result = await llm_client.complete(
        prompt=prompt,
        system="You are an AI assistant summarizing team meetings for a fellowship program. Be concise and actionable.",
        max_tokens=1024,
        metadata={"action": "meeting_summary", "entity_type": "meeting", "entity_id": str(meeting_id)},
    )

    summary = result["content"]
    meeting.ai_summary = summary
    await db.commit()

    return {"meeting_id": str(meeting_id), "summary": summary}


@router.post("/retrospectives/{retro_id}/insights")
async def generate_retro_insights(
    retro_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate AI insights from a sprint retrospective."""
    result = await db.execute(
        select(Retrospective)
        .options(selectinload(Retrospective.sprint))
        .where(Retrospective.id == retro_id)
    )
    retro = result.scalar_one_or_none()
    if not retro:
        raise HTTPException(status_code=404, detail="Retrospective not found")

    sprint_name = retro.sprint.name if retro.sprint else "Unknown"

    prompt = f"""Analyze this sprint retrospective and provide insights.

Sprint: {sprint_name}
Team Mood: {retro.team_mood or 'Not specified'}
Sprint Rating: {retro.sprint_rating or 'Not rated'}/5

What Worked:
{chr(10).join('- ' + item for item in (retro.what_worked or []))}

What Didn't Work:
{chr(10).join('- ' + item for item in (retro.what_didnt_work or []))}

What to Improve:
{chr(10).join('- ' + item for item in (retro.what_to_improve or []))}

Return JSON with:
{{
  "themes": ["recurring themes identified"],
  "strengths": ["team strengths to maintain"],
  "concerns": ["areas of concern"],
  "action_items": [
    {{"action": "specific action", "priority": "high/medium/low", "owner": "team/individual"}}
  ],
  "team_health_score": 1-10,
  "team_health_note": "brief assessment of team health",
  "next_sprint_focus": "recommended focus for next sprint"
}}"""

    result = await llm_client.complete(
        prompt=prompt,
        system="You are an agile coach AI analyzing sprint retrospectives for a tech fellowship. Provide actionable insights.",
        max_tokens=1024,
        metadata={"action": "retro_insights", "entity_type": "retrospective", "entity_id": str(retro_id)},
    )

    insights = result["content"]
    retro.ai_insights = insights
    await db.commit()

    return {"retrospective_id": str(retro_id), "insights": insights}


@router.get("/risk/predict/{fellow_id}")
async def predict_risk(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Predict next-week risk level using historical data."""
    # Get fellow
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.id == fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    fellow_name = fellow.applicant.name if fellow.applicant else "Unknown"

    # Get risk history
    risk_result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.fellow_id == fellow_id)
        .order_by(desc(RiskAssessment.week))
        .limit(5)
    )
    risk_history = [
        {"week": r.week, "level": r.risk_level, "score": float(r.risk_score) if r.risk_score else 0}
        for r in risk_result.scalars().all()
    ]

    # Get recent check-ins
    checkin_result = await db.execute(
        select(CheckIn)
        .where(CheckIn.fellow_id == fellow_id)
        .order_by(desc(CheckIn.week))
        .limit(4)
    )
    checkins = [
        {
            "week": c.week,
            "energy_level": c.energy_level,
            "sentiment_score": float(c.sentiment_score) if c.sentiment_score else None,
            "self_assessment": c.self_assessment,
            "blockers": c.blockers,
            "is_late": c.is_late,
        }
        for c in checkin_result.scalars().all()
    ]

    # Get attendance stats
    att_result = await db.execute(
        select(Attendance)
        .where(Attendance.fellow_id == fellow_id)
        .order_by(desc(Attendance.created_at))
        .limit(10)
    )
    attendance = [
        {"status": str(a.status.value) if hasattr(a.status, 'value') else str(a.status)}
        for a in att_result.scalars().all()
    ]

    prompt = f"""Based on the following historical data for fellow "{fellow_name}" (role: {fellow.role}), predict their risk level for next week.

Risk History (most recent first):
{json.dumps(risk_history, default=str)}

Recent Check-ins:
{json.dumps(checkins, default=str)}

Recent Attendance (last 10):
{json.dumps(attendance, default=str)}

Current risk level: {fellow.current_risk_level or 'unknown'}
Current risk score: {float(fellow.current_risk_score) if fellow.current_risk_score else 'unknown'}
Warning count: {fellow.warnings_count or 0}

Return JSON with:
{{
  "predicted_risk_level": "on_track/monitor/at_risk/critical",
  "predicted_risk_score": 0.0-10.0,
  "confidence": 0.0-1.0,
  "trend": "improving/stable/declining",
  "reasoning": "brief explanation of prediction",
  "risk_factors": ["key factors influencing prediction"],
  "recommended_actions": ["1-3 preventive actions"]
}}"""

    result = await llm_client.complete(
        prompt=prompt,
        system="You are a predictive analytics AI for a tech fellowship program. Base predictions strictly on data patterns, not assumptions.",
        max_tokens=1024,
        metadata={"action": "risk_prediction", "entity_type": "fellow", "entity_id": str(fellow_id)},
    )

    prediction = result["content"]

    return {
        "fellow_id": str(fellow_id),
        "fellow_name": fellow_name,
        "current_risk_level": fellow.current_risk_level,
        "prediction": prediction,
    }
