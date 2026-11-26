"""
Analytics and reporting API endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, date

from app.database import get_db
from app.models.applicant import Applicant, ApplicantStatus
from app.models.fellow import Fellow, FellowStatus
from app.models.evaluation import ApplicationEvaluation
from app.models.risk_assessment import RiskAssessment
from app.models.audit_log import AuditLog
from app.models.microship import MicroshipSubmission
from app.models.cohort import Cohort

router = APIRouter(prefix="/analytics")

@router.get("/dashboard")
async def get_analytics_dashboard(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive analytics dashboard data"""

    # Applicant metrics
    applicants_query = select(Applicant)
    if cohort_id:
        applicants_query = applicants_query.where(Applicant.cohort_id == cohort_id)

    result = await db.execute(applicants_query)
    applicants = list(result.scalars().all())

    applicant_stats = {
        "total": len(applicants),
        "by_status": {},
        "by_role": {},
        "by_source": {}
    }

    for app in applicants:
        # Count by status
        applicant_stats["by_status"][app.status] = applicant_stats["by_status"].get(app.status, 0) + 1
        # Count by role
        applicant_stats["by_role"][app.role] = applicant_stats["by_role"].get(app.role, 0) + 1
        # Count by source
        source = app.source or "unknown"
        applicant_stats["by_source"][source] = applicant_stats["by_source"].get(source, 0) + 1

    # Fellow metrics
    fellows_query = select(Fellow)
    if cohort_id:
        fellows_query = fellows_query.where(Fellow.cohort_id == cohort_id)

    result = await db.execute(fellows_query)
    fellows = list(result.scalars().all())

    fellow_stats = {
        "total": len(fellows),
        "by_status": {},
        "by_risk_level": {},
        "average_milestone_1": 0,
        "average_milestone_2": 0,
    }

    milestone_1_scores = []
    milestone_2_scores = []

    for fellow in fellows:
        # Count by status
        fellow_stats["by_status"][fellow.status] = fellow_stats["by_status"].get(fellow.status, 0) + 1
        # Count by risk level
        if fellow.current_risk_level:
            fellow_stats["by_risk_level"][fellow.current_risk_level] = fellow_stats["by_risk_level"].get(fellow.current_risk_level, 0) + 1
        # Collect milestone scores
        if fellow.milestone_1_score:
            milestone_1_scores.append(float(fellow.milestone_1_score))
        if fellow.milestone_2_score:
            milestone_2_scores.append(float(fellow.milestone_2_score))

    if milestone_1_scores:
        fellow_stats["average_milestone_1"] = sum(milestone_1_scores) / len(milestone_1_scores)
    if milestone_2_scores:
        fellow_stats["average_milestone_2"] = sum(milestone_2_scores) / len(milestone_2_scores)

    # Evaluation metrics
    eval_result = await db.execute(select(ApplicationEvaluation))
    evaluations = list(eval_result.scalars().all())

    evaluation_stats = {
        "total": len(evaluations),
        "by_outcome": {},
        "average_score": 0,
        "average_confidence": 0,
        "human_review_rate": 0
    }

    scores = []
    confidences = []
    human_reviewed_count = 0

    for eval in evaluations:
        # Count by outcome
        if eval.outcome:
            evaluation_stats["by_outcome"][eval.outcome] = evaluation_stats["by_outcome"].get(eval.outcome, 0) + 1
        # Collect scores
        if eval.overall_score:
            scores.append(float(eval.overall_score))
        if eval.confidence:
            confidences.append(float(eval.confidence))
        if eval.human_reviewed:
            human_reviewed_count += 1

    if scores:
        evaluation_stats["average_score"] = sum(scores) / len(scores)
    if confidences:
        evaluation_stats["average_confidence"] = sum(confidences) / len(confidences)
    if evaluations:
        evaluation_stats["human_review_rate"] = (human_reviewed_count / len(evaluations)) * 100

    # Risk assessment metrics
    risk_result = await db.execute(select(RiskAssessment))
    risk_assessments = list(risk_result.scalars().all())

    risk_stats = {
        "total_assessments": len(risk_assessments),
        "by_risk_level": {}
    }

    for risk in risk_assessments:
        risk_stats["by_risk_level"][risk.risk_level] = risk_stats["by_risk_level"].get(risk.risk_level, 0) + 1

    # AI Cost metrics (from audit log)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    cost_result = await db.execute(
        select(AuditLog).where(
            AuditLog.timestamp >= thirty_days_ago,
            AuditLog.ai_cost_usd.isnot(None)
        )
    )
    cost_logs = list(cost_result.scalars().all())

    total_cost = sum(float(log.ai_cost_usd) for log in cost_logs if log.ai_cost_usd)

    ai_stats = {
        "total_ai_calls_30d": len(cost_logs),
        "total_cost_30d_usd": round(total_cost, 2),
        "average_cost_per_call": round(total_cost / len(cost_logs), 4) if cost_logs else 0
    }

    return {
        "applicants": applicant_stats,
        "fellows": fellow_stats,
        "evaluations": evaluation_stats,
        "risk_assessments": risk_stats,
        "ai_usage": ai_stats,
        "generated_at": datetime.utcnow().isoformat()
    }

@router.get("/conversion-funnel")
async def get_conversion_funnel(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get application-to-fellow conversion funnel"""

    query = select(Applicant)
    if cohort_id:
        query = query.where(Applicant.cohort_id == cohort_id)

    result = await db.execute(query)
    applicants = list(result.scalars().all())

    funnel = {
        "applied": 0,
        "screening": 0,
        "eligible": 0,
        "microship_submitted": 0,
        "microship_evaluated": 0,
        "accepted": 0,
        "not_eligible": 0,
        "conversion_rate": 0
    }

    for app in applicants:
        if app.status in funnel:
            funnel[app.status] += 1

    total = len(applicants)
    if total > 0:
        funnel["conversion_rate"] = (funnel["accepted"] / total) * 100

    return funnel

@router.get("/ai-performance")
async def get_ai_performance(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get AI performance metrics"""

    query = select(ApplicationEvaluation)
    if cohort_id:
        query = query.join(Applicant, ApplicationEvaluation.applicant_id == Applicant.id).where(
            Applicant.cohort_id == cohort_id
        )

    result = await db.execute(query)
    evaluations = list(result.scalars().all())

    high_confidence = sum(1 for e in evaluations if e.confidence and e.confidence >= 0.8)
    medium_confidence = sum(1 for e in evaluations if e.confidence and 0.6 <= e.confidence < 0.8)
    low_confidence = sum(1 for e in evaluations if e.confidence and e.confidence < 0.6)

    human_override = sum(1 for e in evaluations if e.human_override)

    return {
        "total_evaluations": len(evaluations),
        "confidence_distribution": {
            "high (>= 80%)": high_confidence,
            "medium (60-79%)": medium_confidence,
            "low (< 60%)": low_confidence
        },
        "human_override_count": human_override,
        "human_override_rate": (human_override / len(evaluations) * 100) if evaluations else 0
    }


@router.get("/trends")
async def get_trends(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get time-series trend data for the last 30 days"""

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    # Applications per day
    app_query = select(
        cast(Applicant.applied_at, Date).label("day"),
        func.count().label("count")
    ).where(Applicant.applied_at >= thirty_days_ago)
    if cohort_id:
        app_query = app_query.where(Applicant.cohort_id == cohort_id)
    app_query = app_query.group_by("day").order_by("day")

    app_result = await db.execute(app_query)
    applications_by_day = [
        {"date": row.day.isoformat(), "count": row.count}
        for row in app_result.all()
    ]

    # Evaluations per day
    eval_query = select(
        cast(ApplicationEvaluation.created_at, Date).label("day"),
        func.count().label("count")
    ).where(ApplicationEvaluation.created_at >= thirty_days_ago)
    if cohort_id:
        eval_query = eval_query.join(
            Applicant, ApplicationEvaluation.applicant_id == Applicant.id
        ).where(Applicant.cohort_id == cohort_id)
    eval_query = eval_query.group_by("day").order_by("day")

    eval_result = await db.execute(eval_query)
    evaluations_by_day = [
        {"date": row.day.isoformat(), "count": row.count}
        for row in eval_result.all()
    ]

    # Submissions per day
    sub_query = select(
        cast(MicroshipSubmission.submitted_at, Date).label("day"),
        func.count().label("count")
    ).where(
        MicroshipSubmission.submitted_at.isnot(None),
        MicroshipSubmission.submitted_at >= thirty_days_ago
    )
    if cohort_id:
        sub_query = sub_query.join(
            Applicant, MicroshipSubmission.applicant_id == Applicant.id
        ).where(Applicant.cohort_id == cohort_id)
    sub_query = sub_query.group_by("day").order_by("day")

    sub_result = await db.execute(sub_query)
    submissions_by_day = [
        {"date": row.day.isoformat(), "count": row.count}
        for row in sub_result.all()
    ]

    return {
        "applications_by_day": applications_by_day,
        "evaluations_by_day": evaluations_by_day,
        "submissions_by_day": submissions_by_day,
    }


@router.get("/cohort-comparison")
async def get_cohort_comparison(
    db: AsyncSession = Depends(get_db)
):
    """Compare metrics across all cohorts"""

    cohort_result = await db.execute(select(Cohort).order_by(Cohort.created_at.desc()))
    cohorts = list(cohort_result.scalars().all())

    comparison = []
    for cohort in cohorts:
        # Applicant counts
        app_result = await db.execute(
            select(Applicant).where(Applicant.cohort_id == cohort.id)
        )
        applicants = list(app_result.scalars().all())
        applicant_count = len(applicants)
        accepted_count = sum(1 for a in applicants if a.status == "accepted")

        # Fellow count
        fellow_result = await db.execute(
            select(func.count()).select_from(Fellow).where(Fellow.cohort_id == cohort.id)
        )
        fellow_count = fellow_result.scalar() or 0

        # Average evaluation score
        eval_result = await db.execute(
            select(func.avg(ApplicationEvaluation.overall_score)).join(
                Applicant, ApplicationEvaluation.applicant_id == Applicant.id
            ).where(
                Applicant.cohort_id == cohort.id,
                ApplicationEvaluation.overall_score.isnot(None)
            )
        )
        avg_score = eval_result.scalar()

        comparison.append({
            "id": str(cohort.id),
            "name": cohort.name,
            "status": cohort.status,
            "applicant_count": applicant_count,
            "fellow_count": fellow_count,
            "accepted_count": accepted_count,
            "conversion_rate": round((accepted_count / applicant_count) * 100, 1) if applicant_count > 0 else 0,
            "average_eval_score": round(float(avg_score), 1) if avg_score else 0,
        })

    return {"cohorts": comparison}


# ---------------------------------------------------------------------------
# Dashboard overview: one call feeds the homepage (metrics, charts, table)
# ---------------------------------------------------------------------------

_SELECTED = {
    ApplicantStatus.ELIGIBLE, ApplicantStatus.MICROSHIP_PENDING,
    ApplicantStatus.MICROSHIP_SUBMITTED, ApplicantStatus.MICROSHIP_EVALUATED,
}
_OUTCOME_GROUPS = [
    ("Accepted", {ApplicantStatus.ACCEPTED}),
    ("Shortlisted", _SELECTED),
    ("In review", {ApplicantStatus.APPLIED, ApplicantStatus.SCREENING}),
    ("Not selected", {ApplicantStatus.NOT_ELIGIBLE, ApplicantStatus.REJECTED}),
    ("Withdrawn", {ApplicantStatus.WITHDRAWN}),
]
_ALUMNI_STATUSES = (FellowStatus.GRADUATED, FellowStatus.GRADUATED_DISTINCTION)


def _enum_value(v):
    return getattr(v, "value", v)


@router.get("/overview")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    """Everything the dashboard homepage needs, computed from live data."""
    # Applicants by status / role
    status_rows = (await db.execute(
        select(Applicant.status, func.count()).group_by(Applicant.status)
    )).all()
    by_status = {_enum_value(s): n for s, n in status_rows}
    total = sum(by_status.values())

    role_rows = (await db.execute(
        select(Applicant.role, func.count()).group_by(Applicant.role)
    )).all()
    alumni_role_rows = (await db.execute(
        select(Applicant.role, func.count())
        .join(Fellow, Fellow.applicant_id == Applicant.id)
        .where(Fellow.status.in_(_ALUMNI_STATUSES))
        .group_by(Applicant.role)
    )).all()
    alumni_by_role = {_enum_value(r): n for r, n in alumni_role_rows}
    by_track = sorted(
        [{"track": _enum_value(r), "applications": n, "alumni": alumni_by_role.get(_enum_value(r), 0)}
         for r, n in role_rows],
        key=lambda t: t["applications"], reverse=True,
    )

    alumni = sum(alumni_by_role.values())
    cohorts = (await db.execute(select(func.count()).select_from(Cohort))).scalar() or 0
    committed = (await db.execute(
        select(func.count()).select_from(Applicant).where(Applicant.time_commitment.is_(True))
    )).scalar() or 0

    # Selection rate over applicants who have a screening decision
    undecided = {"applied", "screening", "withdrawn"}
    decided = sum(n for s, n in by_status.items() if s not in undecided)
    selected = sum(n for s, n in by_status.items() if s not in undecided | {"not_eligible", "rejected"})
    selection_rate = round(selected / decided * 100, 1) if decided else 0.0

    outcomes = []
    for label, statuses in _OUTCOME_GROUPS:
        n = sum(by_status.get(_enum_value(s), 0) for s in statuses)
        if n:
            outcomes.append({"label": label, "value": n})

    # Applications per month (sparkline for the metric card)
    month = func.date_trunc("month", Applicant.applied_at)
    month_rows = (await db.execute(
        select(month, func.count()).group_by(month).order_by(month)
    )).all()
    by_month = [{"month": m.strftime("%Y-%m"), "count": n} for m, n in month_rows if m]

    # Five most recent submissions
    subs = (await db.execute(
        select(MicroshipSubmission)
        .options(selectinload(MicroshipSubmission.applicant), selectinload(MicroshipSubmission.challenge))
        .order_by(func.coalesce(MicroshipSubmission.submitted_at, MicroshipSubmission.created_at).desc())
        .limit(5)
    )).scalars().all()
    recent = []
    for s in subs:
        raw = s.raw_analysis or {}
        recent.append({
            "id": str(s.id),
            "name": s.applicant.name if s.applicant else "Unknown",
            "email": s.applicant.email if s.applicant else None,
            "track": _enum_value(s.applicant.role) if s.applicant else None,
            "challenge": s.challenge.title if s.challenge else (s.challenge_id or "Microship"),
            "submission_url": s.submission_url,
            "submission_type": s.submission_type,
            "submitted_at": (s.submitted_at or s.created_at).isoformat(),
            "on_time": s.on_time,
            "outcome": raw.get("outcome"),
            "score": raw.get("weighted_score"),
        })

    return {
        "metrics": {
            "total_applications": total,
            "alumni": alumni,
            "selection_rate": selection_rate,
            "selected": selected,
            "decided": decided,
            "cohorts": cohorts,
            "tracks": len(by_track),
            "committed": committed,
        },
        "applications_by_month": by_month,
        "by_track": by_track,
        "outcomes": outcomes,
        "recent_submissions": recent,
    }
