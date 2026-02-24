"""Certificate generation API."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.fellow import Fellow, FellowStatus
from app.models.cohort import Cohort

router = APIRouter(prefix="/certificates")


@router.get("/{fellow_id}")
async def generate_certificate(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate a downloadable HTML certificate for a graduated fellow."""
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant), selectinload(Fellow.cohort))
        .where(Fellow.id == fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Only graduated fellows can get certificates
    status_value = fellow.status.value if hasattr(fellow.status, 'value') else str(fellow.status)
    if status_value not in ("graduated", "graduated_distinction"):
        raise HTTPException(status_code=400, detail="Certificate only available for graduated fellows")

    name = fellow.applicant.name if fellow.applicant else "Fellow"
    cohort_name = fellow.cohort.name if fellow.cohort else "MentorLed Cohort"
    end_date = fellow.cohort.end_date if fellow.cohort else datetime.utcnow().date()

    distinction = status_value == "graduated_distinction"
    title = "Certificate of Distinction" if distinction else "Certificate of Completion"

    milestones_html = ""
    scores = [
        ("Milestone 1", fellow.milestone_1_score),
        ("Milestone 2", fellow.milestone_2_score),
        ("Milestone 3", fellow.milestone_3_score),
        ("Final Score", fellow.final_score),
    ]
    for label, score in scores:
        if score is not None:
            milestones_html += f'<div class="milestone"><span>{label}</span><span class="score">{float(score):.2f}/4.00</span></div>'

    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>{title} - {name}</title>
<style>
  @page {{ size: landscape; margin: 0; }}
  body {{ margin: 0; padding: 0; font-family: 'Georgia', serif; background: #fefefe; }}
  .certificate {{
    width: 1056px; height: 816px; margin: 0 auto; position: relative;
    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #f0fdf4 100%);
    border: 3px solid {'#d4af37' if distinction else '#059669'};
    box-sizing: border-box;
  }}
  .border-inner {{
    position: absolute; top: 12px; left: 12px; right: 12px; bottom: 12px;
    border: 1px solid {'#d4af37' if distinction else '#059669'};
  }}
  .content {{ padding: 60px 80px; text-align: center; position: relative; z-index: 1; }}
  .logo {{ color: #059669; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 20px; }}
  .title {{
    font-size: 42px; font-weight: 700; margin: 20px 0 8px;
    color: {'#d4af37' if distinction else '#059669'};
    letter-spacing: 1px;
  }}
  .subtitle {{ font-size: 16px; color: #6b7280; margin-bottom: 30px; }}
  .presented {{ font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; }}
  .name {{ font-size: 36px; font-weight: 700; color: #1a1a1a; margin: 12px 0 6px; font-style: italic; }}
  .role {{ font-size: 16px; color: #6b7280; margin-bottom: 24px; }}
  .description {{ font-size: 14px; color: #374151; line-height: 1.7; max-width: 600px; margin: 0 auto 30px; }}
  .milestones {{
    display: flex; justify-content: center; gap: 24px; margin: 20px 0;
  }}
  .milestone {{
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    font-size: 12px; color: #6b7280;
  }}
  .milestone .score {{ font-size: 18px; font-weight: 700; color: #059669; }}
  .footer {{ position: absolute; bottom: 40px; left: 80px; right: 80px; display: flex; justify-content: space-between; }}
  .footer-item {{ text-align: center; }}
  .footer-line {{ width: 160px; border-top: 1px solid #d1d5db; margin-bottom: 8px; }}
  .footer-label {{ font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }}
  .footer-value {{ font-size: 13px; color: #374151; margin-top: 4px; }}
  @media print {{
    body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .certificate {{ page-break-inside: avoid; }}
  }}
</style>
</head><body>
<div class="certificate">
  <div class="border-inner"></div>
  <div class="content">
    <div class="logo">MentorLed Fellowship Program</div>
    <div class="title">{title}</div>
    <div class="subtitle">{cohort_name}</div>
    <div class="presented">This is to certify that</div>
    <div class="name">{name}</div>
    <div class="role">{fellow.role.replace('_', ' ').title()} Fellow</div>
    <div class="description">
      Has successfully completed the MentorLed Fellowship Program
      {'with distinction ' if distinction else ''}
      demonstrating exceptional growth in technical skills, collaboration, and professional development.
    </div>
    {f'<div class="milestones">{milestones_html}</div>' if milestones_html else ''}
  </div>
  <div class="footer">
    <div class="footer-item">
      <div class="footer-line"></div>
      <div class="footer-label">Date</div>
      <div class="footer-value">{end_date.strftime('%B %d, %Y') if end_date else 'N/A'}</div>
    </div>
    <div class="footer-item">
      <div class="footer-line"></div>
      <div class="footer-label">Program Director</div>
      <div class="footer-value">MentorLed</div>
    </div>
  </div>
</div>
</body></html>"""

    filename = f"certificate_{name.replace(' ', '_')}.html"
    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
