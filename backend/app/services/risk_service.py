"""
Multi-Signal Risk Assessment Service for Fellows.

Implements the 7-signal weighted risk scoring system from the Fellowship Execution spec.
Signals are PERFORMANCE scores (1.0 = excellent, 0.0 = failing).
Risk levels: ON_TRACK (0.70-1.00), MONITOR (0.50-0.69), AT_RISK (0.30-0.49), CRITICAL (0.00-0.29)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID

from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment, RiskLevel
from app.models.attendance import Attendance, AttendanceStatus
from app.models.sprint import Sprint, SprintStatus
from app.models.sprint_objective import SprintObjective, ObjectiveStatus
from app.models.team import Team


# Signal weights (must total 1.00)
SIGNAL_WEIGHTS = {
    "attendance_score": 0.20,
    "check_in_sentiment": 0.15,
    "check_in_completeness": 0.10,
    "sprint_delivery": 0.25,
    "evidence_submission": 0.15,
    "mentor_flags": 0.10,
    "trend": 0.05,
}

# Attendance status scores (performance-based: 1.0 = best)
ATTENDANCE_STATUS_SCORES = {
    AttendanceStatus.PRESENT.value: 1.0,
    AttendanceStatus.LATE.value: 0.8,
    AttendanceStatus.VERY_LATE.value: 0.5,
    AttendanceStatus.ABSENT.value: 0.0,
    AttendanceStatus.APPROVED_ABSENCE.value: 0.7,
    "present": 1.0,
    "late": 0.8,
    "very_late": 0.5,
    "absent": 0.0,
    "approved_absence": 0.7,
}


class RiskDetectionService:
    """
    7-signal weighted risk assessment service.

    Each signal is normalized to 0.0-1.0 (higher = better performance).
    Weighted sum produces an overall performance score.
    Risk level is determined from performance score thresholds.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def assess_fellow_risk(self, fellow_id: UUID, week: int) -> Dict[str, Any]:
        """
        Perform comprehensive 7-signal risk assessment for a fellow.

        Returns dict with: risk_score (0-1, higher=better), risk_level, signals, concerns, recommended_action
        """
        result = await self.db.execute(
            select(Fellow).options(selectinload(Fellow.applicant)).filter(Fellow.id == fellow_id)
        )
        fellow = result.scalar_one_or_none()
        if not fellow:
            raise ValueError(f"Fellow {fellow_id} not found")

        # Gather all 7 signals
        signals = {}
        signals["attendance_score"] = await self._calc_attendance_signal(fellow)
        signals["check_in_sentiment"] = await self._calc_sentiment_signal(fellow, week)
        signals["check_in_completeness"] = await self._calc_completeness_signal(fellow, week)
        signals["sprint_delivery"] = await self._calc_delivery_signal(fellow)
        signals["evidence_submission"] = await self._calc_evidence_signal(fellow)
        signals["mentor_flags"] = self._calc_mentor_flags_signal(fellow)
        signals["trend"] = await self._calc_trend_signal(fellow)

        # Calculate weighted performance score
        risk_score = sum(
            signals[key] * SIGNAL_WEIGHTS[key] for key in SIGNAL_WEIGHTS
        )
        risk_score = round(min(max(risk_score, 0.0), 1.0), 2)

        # Determine risk level
        risk_level = self._determine_risk_level(risk_score)

        # Generate concerns for at_risk/critical
        concerns = self._generate_concerns(signals, risk_level)

        # Detect patterns
        patterns = await self._detect_patterns(fellow_id)

        # Recommended action
        recommended_action = self._recommend_action(risk_level, fellow.warnings_count)

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "signals": signals,
            "concerns": concerns,
            "patterns": patterns,
            "recommended_action": recommended_action,
        }

    # --- Signal Calculations ---

    async def _calc_attendance_signal(self, fellow: Fellow) -> float:
        """Signal 1: Attendance Score (20% weight). Last 14 days of attendance."""
        result = await self.db.execute(
            select(Attendance).filter(Attendance.fellow_id == fellow.id)
        )
        records = result.scalars().all()

        if not records:
            return 0.5  # Neutral if no data

        total = sum(
            ATTENDANCE_STATUS_SCORES.get(
                r.status.value if hasattr(r.status, "value") else r.status, 0.5
            )
            for r in records
        )
        return round(total / len(records), 2)

    async def _calc_sentiment_signal(self, fellow: Fellow, week: int) -> float:
        """Signal 2: Check-in Sentiment (15% weight). Latest check-in sentiment."""
        result = await self.db.execute(
            select(CheckIn)
            .filter(CheckIn.fellow_id == fellow.id, CheckIn.week <= week)
            .order_by(desc(CheckIn.week))
            .limit(3)
        )
        check_ins = result.scalars().all()

        if not check_ins:
            return 0.5

        sentiments = [
            ci.sentiment_score for ci in check_ins if ci.sentiment_score is not None
        ]
        if not sentiments:
            return 0.5

        # sentiment_score ranges -1 to 1 in current model. Normalize to 0-1.
        avg = sum(float(s) for s in sentiments) / len(sentiments)
        return round(max(0.0, min(1.0, (avg + 1.0) / 2.0)), 2)

    async def _calc_completeness_signal(self, fellow: Fellow, week: int) -> float:
        """Signal 3: Check-in Completeness (10% weight). Submitted / expected ratio."""
        if week <= 0:
            return 0.5

        result = await self.db.execute(
            select(func.count()).select_from(CheckIn).filter(
                CheckIn.fellow_id == fellow.id
            )
        )
        submitted = result.scalar() or 0
        return round(min(submitted / week, 1.0), 2)

    async def _calc_delivery_signal(self, fellow: Fellow) -> float:
        """Signal 4: Sprint Delivery (25% weight). Most recent completed sprint's score."""
        if not fellow.team_id:
            return 0.5

        result = await self.db.execute(
            select(Sprint)
            .filter(
                Sprint.team_id == fellow.team_id,
                Sprint.status == SprintStatus.COMPLETED,
            )
            .order_by(desc(Sprint.sprint_number))
            .limit(1)
        )
        sprint = result.scalar_one_or_none()

        if not sprint or sprint.completion_score is None:
            return 0.5

        # completion_score is 0-100, normalize to 0-1
        score = float(sprint.completion_score)
        if score > 1.0:
            score = score / 100.0
        return round(max(0.0, min(1.0, score)), 2)

    async def _calc_evidence_signal(self, fellow: Fellow) -> float:
        """Signal 5: Evidence Submission (15% weight). % of done objectives with evidence."""
        if not fellow.team_id:
            return 0.5

        # Get all completed sprints for the team
        result = await self.db.execute(
            select(Sprint)
            .options(selectinload(Sprint.objectives))
            .filter(
                Sprint.team_id == fellow.team_id,
                Sprint.status == SprintStatus.COMPLETED,
            )
        )
        completed_sprints = result.scalars().all()

        if not completed_sprints:
            return 0.5

        total_done = 0
        total_with_evidence = 0

        for sprint in completed_sprints:
            for obj in sprint.objectives:
                status = obj.status.value if hasattr(obj.status, "value") else obj.status
                if status == ObjectiveStatus.DONE.value:
                    total_done += 1
                    if obj.evidence_url:
                        total_with_evidence += 1

        if total_done == 0:
            return 0.5

        return round(total_with_evidence / total_done, 2)

    def _calc_mentor_flags_signal(self, fellow: Fellow) -> float:
        """Signal 6: Mentor Flags (10% weight). Based on warnings count."""
        if fellow.warnings_count == 0:
            return 1.0  # No flags = perfect
        elif fellow.warnings_count == 1:
            return 0.5  # Moderate concern
        elif fellow.warnings_count == 2:
            return 0.2  # Major concern
        else:
            return 0.0  # Critical

    async def _calc_trend_signal(self, fellow: Fellow) -> float:
        """Signal 7: Trend (5% weight). Compare recent risk assessments."""
        result = await self.db.execute(
            select(RiskAssessment)
            .filter(RiskAssessment.fellow_id == fellow.id)
            .order_by(desc(RiskAssessment.week))
            .limit(4)
        )
        history = result.scalars().all()

        if len(history) < 2:
            return 0.5  # Insufficient data

        current = float(history[0].risk_score)
        previous = float(history[1].risk_score)
        change = current - previous

        if change > 0.1:
            return 1.0  # Improving
        elif change < -0.1:
            return 0.3  # Declining
        else:
            return 0.7  # Stable

    # --- Risk Level & Concerns ---

    def _determine_risk_level(self, risk_score: float) -> str:
        """Map performance score to risk level per spec thresholds."""
        if risk_score >= 0.70:
            return RiskLevel.ON_TRACK.value
        elif risk_score >= 0.50:
            return RiskLevel.MONITOR.value
        elif risk_score >= 0.30:
            return RiskLevel.AT_RISK.value
        else:
            return RiskLevel.CRITICAL.value

    def _generate_concerns(self, signals: Dict[str, float], risk_level: str) -> List[Dict[str, str]]:
        """Generate specific concern items for at_risk/critical fellows."""
        if risk_level not in (RiskLevel.AT_RISK.value, RiskLevel.CRITICAL.value):
            return []

        concerns = []

        if signals["attendance_score"] < 0.7:
            severity = "high" if signals["attendance_score"] < 0.5 else "medium"
            concerns.append({
                "type": "attendance",
                "severity": severity,
                "description": f"Attendance below target ({round(signals['attendance_score'] * 100)}%)",
            })

        if signals["check_in_sentiment"] < 0.4:
            concerns.append({
                "type": "engagement",
                "severity": "high",
                "description": f"Low sentiment detected in check-ins (score: {signals['check_in_sentiment']})",
            })

        if signals["sprint_delivery"] < 0.6:
            severity = "high" if signals["sprint_delivery"] < 0.4 else "medium"
            concerns.append({
                "type": "delivery",
                "severity": severity,
                "description": f"Sprint delivery below expectations ({round(signals['sprint_delivery'] * 100)}%)",
            })

        if signals["check_in_completeness"] < 0.8:
            concerns.append({
                "type": "compliance",
                "severity": "medium",
                "description": f"Missing check-ins ({round(signals['check_in_completeness'] * 100)}% completion)",
            })

        if signals["evidence_submission"] < 0.7:
            concerns.append({
                "type": "evidence",
                "severity": "medium",
                "description": f"Low evidence submission rate ({round(signals['evidence_submission'] * 100)}%)",
            })

        if signals["trend"] <= 0.3:
            concerns.append({
                "type": "trend",
                "severity": "medium",
                "description": "Performance declining over recent weeks",
            })

        if signals["mentor_flags"] < 0.5:
            concerns.append({
                "type": "warnings",
                "severity": "high",
                "description": "Multiple warnings issued",
            })

        return concerns

    async def _detect_patterns(self, fellow_id: UUID) -> List[Dict[str, str]]:
        """Detect multi-week risk patterns."""
        result = await self.db.execute(
            select(RiskAssessment)
            .filter(RiskAssessment.fellow_id == fellow_id)
            .order_by(desc(RiskAssessment.week))
            .limit(4)
        )
        assessments = result.scalars().all()
        patterns = []

        if len(assessments) < 2:
            return patterns

        # Pattern 1: Sustained risk (2+ consecutive at_risk/critical)
        consecutive_risk = sum(
            1 for a in assessments
            if a.risk_level in (RiskLevel.AT_RISK.value, RiskLevel.CRITICAL.value)
        )
        if consecutive_risk >= 2:
            patterns.append({
                "pattern": "sustained_risk",
                "severity": "high",
                "description": f"{consecutive_risk} consecutive weeks at-risk or critical",
                "recommendation": "warning_consideration",
            })

        # Pattern 2: Unstable performance (all 4 levels in 4 weeks)
        if len(assessments) >= 4:
            levels = set(a.risk_level for a in assessments)
            if len(levels) >= 3:
                patterns.append({
                    "pattern": "unstable_performance",
                    "severity": "medium",
                    "description": "Highly variable performance week-to-week",
                    "recommendation": "consistency_coaching",
                })

        return patterns

    def _recommend_action(self, risk_level: str, warnings_count: int) -> str:
        """Recommend action based on risk level."""
        if risk_level == RiskLevel.CRITICAL.value:
            return "immediate_review"
        elif risk_level == RiskLevel.AT_RISK.value:
            if warnings_count >= 1:
                return "final_warning"
            return "mentor_intervention"
        elif risk_level == RiskLevel.MONITOR.value:
            return "check_in_required"
        else:
            return "continue_monitoring"

    # --- Dashboard ---

    async def get_cohort_risk_dashboard(self, cohort_id: UUID, week: int) -> Dict[str, Any]:
        """Get risk dashboard data for entire cohort with signal breakdowns."""
        result = await self.db.execute(
            select(Fellow)
            .options(selectinload(Fellow.applicant))
            .filter(Fellow.cohort_id == cohort_id)
        )
        fellows = result.scalars().all()

        dashboard_data: Dict[str, Any] = {
            "summary": {"on_track": 0, "monitor": 0, "at_risk": 0, "critical": 0},
            "fellows": [],
        }

        for fellow in fellows:
            # Get most recent risk assessment
            result = await self.db.execute(
                select(RiskAssessment)
                .filter(RiskAssessment.fellow_id == fellow.id)
                .order_by(desc(RiskAssessment.assessed_at))
                .limit(1)
            )
            latest = result.scalar_one_or_none()

            if latest:
                risk_level = latest.risk_level
                risk_score = float(latest.risk_score)
                signals = latest.signals or {}
                concerns = latest.concerns or []
                recommended_action = latest.recommended_action
            else:
                risk_level = "on_track"
                risk_score = 0.5
                signals = {}
                concerns = []
                recommended_action = None

            dashboard_data["summary"][risk_level] = dashboard_data["summary"].get(risk_level, 0) + 1

            # Get team name
            team_name = None
            if fellow.team_id:
                team_result = await self.db.execute(
                    select(Team).filter(Team.id == fellow.team_id)
                )
                team = team_result.scalar_one_or_none()
                team_name = team.name if team else None

            dashboard_data["fellows"].append({
                "id": str(fellow.id),
                "name": fellow.applicant.name if fellow.applicant else "Unknown",
                "email": fellow.applicant.email if fellow.applicant else None,
                "role": fellow.role,
                "team_id": str(fellow.team_id) if fellow.team_id else None,
                "team_name": team_name,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "signals": signals,
                "concerns": concerns,
                "recommended_action": recommended_action,
                "warnings_count": fellow.warnings_count,
            })

        return dashboard_data
