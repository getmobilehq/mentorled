"""Report generation API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import datetime
import io
import csv

from app.database import get_db
from app.models.cohort import Cohort
from app.models.fellow import Fellow
from app.models.applicant import Applicant
from app.models.risk_assessment import RiskAssessment
from app.models.sprint import Sprint
from app.models.sprint_objective import SprintObjective
from app.models.check_in import CheckIn
from app.models.attendance import Attendance, AttendanceStatus
from app.models.meeting import Meeting
from app.models.evaluation import ApplicationEvaluation
from app.models.microship import MicroshipSubmission

router = APIRouter(prefix="/reports")


async def _build_cohort_report_data(cohort_id: UUID, db: AsyncSession) -> dict:
    """Build comprehensive cohort report data used by both JSON and PDF endpoints."""
    # Get cohort
    result = await db.execute(select(Cohort).where(Cohort.id == cohort_id))
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    # Get fellows with applicant data
    fellows_result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.cohort_id == cohort_id)
    )
    fellows = fellows_result.scalars().all()

    # Get applicants
    applicants_result = await db.execute(
        select(Applicant).where(Applicant.cohort_id == cohort_id)
    )
    applicants = applicants_result.scalars().all()

    # Pipeline stats
    pipeline = {}
    for a in applicants:
        pipeline[a.status] = pipeline.get(a.status, 0) + 1

    # Risk distribution
    risk_dist = {"on_track": 0, "monitor": 0, "at_risk": 0, "critical": 0}
    for f in fellows:
        level = f.current_risk_level or "on_track"
        if level in risk_dist:
            risk_dist[level] += 1

    # Fellow status distribution
    status_dist = {}
    for f in fellows:
        s = str(f.status.value) if hasattr(f.status, 'value') else str(f.status)
        status_dist[s] = status_dist.get(s, 0) + 1

    # Milestone averages
    m1_scores = [float(f.milestone_1_score) for f in fellows if f.milestone_1_score is not None]
    m2_scores = [float(f.milestone_2_score) for f in fellows if f.milestone_2_score is not None]
    m3_scores = [float(f.milestone_3_score) for f in fellows if f.milestone_3_score is not None]
    final_scores = [float(f.final_score) for f in fellows if f.final_score is not None]

    milestones = {
        "m1_avg": round(sum(m1_scores) / len(m1_scores), 2) if m1_scores else None,
        "m1_count": len(m1_scores),
        "m2_avg": round(sum(m2_scores) / len(m2_scores), 2) if m2_scores else None,
        "m2_count": len(m2_scores),
        "m3_avg": round(sum(m3_scores) / len(m3_scores), 2) if m3_scores else None,
        "m3_count": len(m3_scores),
        "final_avg": round(sum(final_scores) / len(final_scores), 2) if final_scores else None,
        "final_count": len(final_scores),
    }

    # Sprint completion
    sprints_result = await db.execute(
        select(Sprint).where(Sprint.cohort_id == cohort_id)
    )
    sprints = sprints_result.scalars().all()
    completed_sprints = len([s for s in sprints if s.status == "completed"])

    # Attendance rate
    fellow_ids = [f.id for f in fellows]
    if fellow_ids:
        total_att_result = await db.execute(
            select(func.count()).select_from(Attendance).where(
                Attendance.fellow_id.in_(fellow_ids)
            )
        )
        total_att = total_att_result.scalar() or 0

        present_att_result = await db.execute(
            select(func.count()).select_from(Attendance).where(
                Attendance.fellow_id.in_(fellow_ids),
                Attendance.status.in_([
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.LATE,
                    AttendanceStatus.APPROVED_ABSENCE,
                ]),
            )
        )
        present_att = present_att_result.scalar() or 0
        attendance_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0
    else:
        attendance_rate = 0
        total_att = 0

    # Check-in completion
    checkins_result = await db.execute(
        select(func.count()).select_from(CheckIn).where(
            CheckIn.fellow_id.in_(fellow_ids)
        )
    ) if fellow_ids else None
    total_checkins = (checkins_result.scalar() or 0) if checkins_result else 0

    # Evaluations count
    eval_count_result = await db.execute(
        select(func.count()).select_from(ApplicationEvaluation).where(
            ApplicationEvaluation.applicant_id.in_([a.id for a in applicants])
        )
    )
    eval_count = eval_count_result.scalar() or 0

    # Fellow details for table
    fellow_details = []
    for f in fellows:
        name = f.applicant.name if f.applicant else "Unknown"
        email = f.applicant.email if f.applicant else ""
        fellow_details.append({
            "id": str(f.id),
            "name": name,
            "email": email,
            "role": f.role,
            "status": str(f.status.value) if hasattr(f.status, 'value') else str(f.status),
            "risk_level": f.current_risk_level or "on_track",
            "risk_score": float(f.current_risk_score) if f.current_risk_score else 0,
            "m1": float(f.milestone_1_score) if f.milestone_1_score else None,
            "m2": float(f.milestone_2_score) if f.milestone_2_score else None,
            "m3": float(f.milestone_3_score) if f.milestone_3_score else None,
            "final": float(f.final_score) if f.final_score else None,
            "warnings": f.warnings_count or 0,
        })

    return {
        "cohort": {
            "id": str(cohort.id),
            "name": cohort.name,
            "status": str(cohort.status.value) if hasattr(cohort.status, 'value') else str(cohort.status),
            "start_date": cohort.start_date.isoformat() if cohort.start_date else None,
            "end_date": cohort.end_date.isoformat() if cohort.end_date else None,
        },
        "summary": {
            "total_applicants": len(applicants),
            "total_fellows": len(fellows),
            "evaluations_completed": eval_count,
            "sprints_total": len(sprints),
            "sprints_completed": completed_sprints,
            "attendance_rate": attendance_rate,
            "total_check_ins": total_checkins,
        },
        "pipeline": pipeline,
        "risk_distribution": risk_dist,
        "fellow_status": status_dist,
        "milestones": milestones,
        "fellows": fellow_details,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/stakeholder/{cohort_id}")
async def get_stakeholder_report(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get stakeholder-facing cohort report data (JSON)."""
    return await _build_cohort_report_data(cohort_id, db)


@router.get("/cohort/{cohort_id}/csv")
async def export_cohort_report_csv(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Export cohort fellows data as CSV."""
    data = await _build_cohort_report_data(cohort_id, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Email", "Role", "Status", "Risk Level", "Risk Score",
        "M1 Score", "M2 Score", "M3 Score", "Final Score", "Warnings"
    ])

    for f in data["fellows"]:
        writer.writerow([
            f["name"], f["email"], f["role"], f["status"], f["risk_level"],
            f["risk_score"], f["m1"] or "", f["m2"] or "", f["m3"] or "",
            f["final"] or "", f["warnings"],
        ])

    output.seek(0)
    cohort_name = data["cohort"]["name"].replace(" ", "_")
    filename = f"cohort_report_{cohort_name}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/cohort/{cohort_id}/pdf")
async def export_cohort_report_pdf(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Export cohort report as PDF."""
    data = await _build_cohort_report_data(cohort_id, db)

    # Build a simple HTML report and return as downloadable HTML
    # (Avoids heavy PDF library dependency — can be printed to PDF from browser)
    cohort = data["cohort"]
    summary = data["summary"]
    milestones = data["milestones"]
    risk = data["risk_distribution"]

    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Cohort Report - {cohort['name']}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #1a1a1a; font-size: 14px; }}
  h1 {{ color: #059669; margin-bottom: 4px; }}
  h2 {{ color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }}
  .subtitle {{ color: #6b7280; font-size: 14px; margin-bottom: 24px; }}
  .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }}
  .stat {{ background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }}
  .stat .value {{ font-size: 28px; font-weight: 700; color: #059669; }}
  .stat .label {{ font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }}
  th {{ background: #f3f4f6; text-align: left; padding: 10px 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; }}
  td {{ padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }}
  tr:hover {{ background: #f9fafb; }}
  .risk-on_track {{ color: #059669; }} .risk-monitor {{ color: #d97706; }}
  .risk-at_risk {{ color: #dc2626; }} .risk-critical {{ color: #7c2d12; }}
  .bar {{ display: inline-block; height: 12px; border-radius: 4px; }}
  .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }}
  @media print {{ body {{ margin: 20px; }} .grid {{ grid-template-columns: repeat(4, 1fr); }} }}
</style>
</head><body>
<h1>Cohort Report: {cohort['name']}</h1>
<p class="subtitle">Status: {cohort['status']} &middot; {cohort['start_date'] or 'N/A'} to {cohort['end_date'] or 'N/A'} &middot; Generated {datetime.utcnow().strftime('%B %d, %Y')}</p>

<h2>Summary</h2>
<div class="grid">
  <div class="stat"><div class="value">{summary['total_applicants']}</div><div class="label">Applicants</div></div>
  <div class="stat"><div class="value">{summary['total_fellows']}</div><div class="label">Fellows</div></div>
  <div class="stat"><div class="value">{summary['attendance_rate']}%</div><div class="label">Attendance Rate</div></div>
  <div class="stat"><div class="value">{summary['sprints_completed']}/{summary['sprints_total']}</div><div class="label">Sprints Completed</div></div>
</div>

<h2>Risk Distribution</h2>
<div class="grid">
  <div class="stat"><div class="value risk-on_track">{risk['on_track']}</div><div class="label">On Track</div></div>
  <div class="stat"><div class="value risk-monitor">{risk['monitor']}</div><div class="label">Monitor</div></div>
  <div class="stat"><div class="value risk-at_risk">{risk['at_risk']}</div><div class="label">At Risk</div></div>
  <div class="stat"><div class="value risk-critical">{risk['critical']}</div><div class="label">Critical</div></div>
</div>

<h2>Milestone Averages</h2>
<table>
<tr><th>Milestone</th><th>Average Score</th><th>Scored</th></tr>
<tr><td>Milestone 1</td><td>{milestones['m1_avg'] if milestones['m1_avg'] is not None else 'N/A'}</td><td>{milestones['m1_count']} fellows</td></tr>
<tr><td>Milestone 2</td><td>{milestones['m2_avg'] if milestones['m2_avg'] is not None else 'N/A'}</td><td>{milestones['m2_count']} fellows</td></tr>
<tr><td>Milestone 3</td><td>{milestones['m3_avg'] if milestones['m3_avg'] is not None else 'N/A'}</td><td>{milestones['m3_count']} fellows</td></tr>
<tr><td>Final Score</td><td>{milestones['final_avg'] if milestones['final_avg'] is not None else 'N/A'}</td><td>{milestones['final_count']} fellows</td></tr>
</table>

<h2>Fellow Details</h2>
<table>
<tr><th>Name</th><th>Role</th><th>Status</th><th>Risk</th><th>M1</th><th>M2</th><th>M3</th><th>Final</th><th>Warnings</th></tr>
"""

    for f in data["fellows"]:
        risk_class = f"risk-{f['risk_level']}"
        html += f"""<tr>
  <td><strong>{f['name']}</strong><br><span style="color:#6b7280;font-size:11px">{f['email']}</span></td>
  <td>{f['role']}</td>
  <td>{f['status']}</td>
  <td class="{risk_class}">{f['risk_level']}</td>
  <td>{f['m1'] if f['m1'] is not None else '-'}</td>
  <td>{f['m2'] if f['m2'] is not None else '-'}</td>
  <td>{f['m3'] if f['m3'] is not None else '-'}</td>
  <td>{f['final'] if f['final'] is not None else '-'}</td>
  <td>{f['warnings']}</td>
</tr>"""

    html += f"""</table>
<div class="footer">
  MentorLed AI-Ops Platform &middot; Report generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
</div>
</body></html>"""

    cohort_name = cohort['name'].replace(" ", "_")
    filename = f"cohort_report_{cohort_name}_{datetime.utcnow().strftime('%Y%m%d')}.html"

    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
