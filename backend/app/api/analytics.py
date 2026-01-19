"""
Analytics and reporting API endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

from app.database import get_db
from app.models.applicant import Applicant
from app.models.fellow import Fellow
from app.models.evaluation import ApplicationEvaluation
from app.models.risk_assessment import RiskAssessment
from app.models.audit_log import AuditLog

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
    db: AsyncSession = Depends(get_db)
):
    """Get AI performance metrics"""

    result = await db.execute(select(ApplicationEvaluation))
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
