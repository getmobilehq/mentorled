"""Risk Assessment API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_
from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models.risk_assessment import RiskAssessment
from app.models.attendance import Attendance, AttendanceStatus
from app.models.meeting import Meeting
from app.models.check_in import CheckIn
from app.models.fellow import Fellow
from app.models.user import User, UserRole
from app.schemas.check_in import RiskAssessmentResponse
from app.middleware.auth import get_current_user, require_role
from app.services.risk_service import RiskDetectionService

router = APIRouter(prefix="/risk")


@router.post("/assess/{fellow_id}", response_model=RiskAssessmentResponse)
async def assess_fellow_risk(
    fellow_id: UUID,
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """
    Perform risk assessment for a fellow at a specific week.
    """
    # Verify fellow exists
    result = await db.execute(select(Fellow).filter(Fellow.id == fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Run risk assessment
    risk_service = RiskDetectionService(db)
    try:
        assessment_data = await risk_service.assess_fellow_risk(fellow_id, week)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if assessment already exists for this week
    result = await db.execute(
        select(RiskAssessment).filter(
            RiskAssessment.fellow_id == fellow_id,
            RiskAssessment.week == week
        )
    )
    existing_assessment = result.scalar_one_or_none()

    if existing_assessment:
        # Update existing
        existing_assessment.risk_level = assessment_data['risk_level']
        existing_assessment.risk_score = assessment_data['risk_score']
        existing_assessment.signals = assessment_data['signals']
        existing_assessment.concerns = assessment_data['concerns']
        existing_assessment.recommended_action = assessment_data['recommended_action']
        existing_assessment.assessed_at = datetime.utcnow()
        db_assessment = existing_assessment
    else:
        # Create new
        db_assessment = RiskAssessment(
            fellow_id=fellow_id,
            week=week,
            risk_level=assessment_data['risk_level'],
            risk_score=assessment_data['risk_score'],
            signals=assessment_data['signals'],
            concerns=assessment_data['concerns'],
            recommended_action=assessment_data['recommended_action']
        )
        db.add(db_assessment)

    # Update fellow's current risk score
    fellow.current_risk_score = assessment_data['risk_score']

    await db.commit()
    await db.refresh(db_assessment)

    return db_assessment


@router.post("/assess-bulk")
async def assess_bulk_risk(
    cohort_id: UUID,
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """
    Perform risk assessment for all fellows in a cohort.
    Returns summary of assessed, errors, and per-fellow results.
    """
    risk_service = RiskDetectionService(db)
    try:
        result = await risk_service.assess_cohort_bulk(cohort_id, week)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk assessment failed: {str(e)}")

    return result


@router.get("/fellow/{fellow_id}", response_model=List[RiskAssessmentResponse])
async def get_fellow_risk_history(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all risk assessments for a fellow."""
    result = await db.execute(
        select(RiskAssessment)
        .filter(RiskAssessment.fellow_id == fellow_id)
        .order_by(desc(RiskAssessment.week))
    )
    assessments = result.scalars().all()
    return assessments


@router.get("/dashboard/{cohort_id}")
async def get_risk_dashboard(
    cohort_id: UUID,
    week: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Get risk dashboard for a cohort."""
    risk_service = RiskDetectionService(db)
    dashboard_data = await risk_service.get_cohort_risk_dashboard(cohort_id, week)
    return dashboard_data


@router.get("/assessment/{assessment_id}", response_model=RiskAssessmentResponse)
async def get_risk_assessment(
    assessment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific risk assessment."""
    result = await db.execute(
        select(RiskAssessment).filter(RiskAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    return assessment


@router.post("/action/{assessment_id}")
async def record_action_taken(
    assessment_id: UUID,
    action: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Record action taken on a risk assessment."""
    result = await db.execute(
        select(RiskAssessment).filter(RiskAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    assessment.action_taken = action
    assessment.actioned_by = current_user.id
    assessment.actioned_at = datetime.utcnow()

    await db.commit()
    await db.refresh(assessment)

    return {"message": "Action recorded", "assessment": assessment}


@router.get("/week/{week}")
async def get_assessments_by_week(
    week: int,
    cohort_id: UUID = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ADMIN))
):
    """Get all risk assessments for a specific week."""
    query = select(RiskAssessment).filter(RiskAssessment.week == week)

    if cohort_id:
        query = query.join(Fellow).filter(Fellow.cohort_id == cohort_id)

    query = query.order_by(desc(RiskAssessment.risk_score))

    result = await db.execute(query)
    assessments = result.scalars().all()
    return assessments


@router.get("/alerts/{cohort_id}")
async def get_risk_alerts(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Detect patterns and return alerts for fellows in a cohort.
    Checks: high absences, low attendance rate, low sentiment, consecutive at_risk/critical.
    """
    from sqlalchemy.orm import selectinload

    # Get all fellows in cohort
    fellows_result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.cohort_id == cohort_id)
    )
    fellows = fellows_result.scalars().all()
    if not fellows:
        return []

    alerts = []
    two_weeks_ago = datetime.utcnow() - timedelta(days=14)

    for fellow in fellows:
        fellow_name = fellow.applicant.name if fellow.applicant else "Unknown"

        # 1. Check absences in last 2 weeks (3+ absences)
        absence_result = await db.execute(
            select(func.count())
            .select_from(Attendance)
            .join(Meeting, Attendance.meeting_id == Meeting.id)
            .where(
                Attendance.fellow_id == fellow.id,
                Attendance.status == AttendanceStatus.ABSENT,
                Meeting.scheduled_at >= two_weeks_ago,
            )
        )
        recent_absences = absence_result.scalar() or 0
        if recent_absences >= 3:
            alerts.append({
                "fellow_id": str(fellow.id),
                "fellow_name": fellow_name,
                "alert_type": "high_absences",
                "severity": "critical" if recent_absences >= 5 else "high",
                "message": f"{recent_absences} absences in last 2 weeks",
                "recommended_action": "Schedule immediate 1-on-1 meeting",
                "value": recent_absences,
            })

        # 2. Check overall attendance rate (below 80%)
        total_meetings_result = await db.execute(
            select(func.count())
            .select_from(Attendance)
            .where(Attendance.fellow_id == fellow.id)
        )
        total_records = total_meetings_result.scalar() or 0

        if total_records >= 5:  # Need enough data
            present_result = await db.execute(
                select(func.count())
                .select_from(Attendance)
                .where(
                    Attendance.fellow_id == fellow.id,
                    Attendance.status.in_([
                        AttendanceStatus.PRESENT,
                        AttendanceStatus.LATE,
                        AttendanceStatus.APPROVED_ABSENCE,
                    ]),
                )
            )
            present_count = present_result.scalar() or 0
            attendance_rate = present_count / total_records
            if attendance_rate < 0.8:
                alerts.append({
                    "fellow_id": str(fellow.id),
                    "fellow_name": fellow_name,
                    "alert_type": "low_attendance",
                    "severity": "critical" if attendance_rate < 0.6 else "high",
                    "message": f"Attendance rate at {round(attendance_rate * 100)}%",
                    "recommended_action": "Review attendance pattern with fellow",
                    "value": round(attendance_rate * 100),
                })

        # 3. Check low sentiment (below 0.3 for 2+ consecutive weeks)
        checkins_result = await db.execute(
            select(CheckIn)
            .where(CheckIn.fellow_id == fellow.id)
            .order_by(desc(CheckIn.week))
            .limit(3)
        )
        recent_checkins = checkins_result.scalars().all()
        low_sentiment_weeks = 0
        for ci in recent_checkins:
            if ci.sentiment_score is not None and float(ci.sentiment_score) < 0.3:
                low_sentiment_weeks += 1
            else:
                break
        if low_sentiment_weeks >= 2:
            alerts.append({
                "fellow_id": str(fellow.id),
                "fellow_name": fellow_name,
                "alert_type": "low_sentiment",
                "severity": "high",
                "message": f"Low sentiment for {low_sentiment_weeks} consecutive weeks",
                "recommended_action": "Check in on fellow wellbeing",
                "value": low_sentiment_weeks,
            })

        # 4. Check consecutive at_risk/critical assessments (2+)
        assessments_result = await db.execute(
            select(RiskAssessment)
            .where(RiskAssessment.fellow_id == fellow.id)
            .order_by(desc(RiskAssessment.week))
            .limit(3)
        )
        recent_assessments = assessments_result.scalars().all()
        consecutive_risky = 0
        for ra in recent_assessments:
            if ra.risk_level in ("at_risk", "critical"):
                consecutive_risky += 1
            else:
                break
        if consecutive_risky >= 2:
            alerts.append({
                "fellow_id": str(fellow.id),
                "fellow_name": fellow_name,
                "alert_type": "persistent_risk",
                "severity": "critical" if consecutive_risky >= 3 else "high",
                "message": f"At risk/critical for {consecutive_risky} consecutive weeks",
                "recommended_action": "Consider formal intervention or warning",
                "value": consecutive_risky,
            })

        # 5. Check low energy (energy_level <= 2 for 2+ weeks)
        low_energy_weeks = 0
        for ci in recent_checkins:
            if ci.energy_level is not None and ci.energy_level <= 2:
                low_energy_weeks += 1
            else:
                break
        if low_energy_weeks >= 2:
            alerts.append({
                "fellow_id": str(fellow.id),
                "fellow_name": fellow_name,
                "alert_type": "low_energy",
                "severity": "high" if low_energy_weeks >= 3 else "medium",
                "message": f"Low energy for {low_energy_weeks} consecutive weeks",
                "recommended_action": "Discuss workload and support needs",
                "value": low_energy_weeks,
            })

    # Sort by severity (critical first, then high, then medium)
    severity_order = {"critical": 0, "high": 1, "medium": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return alerts
