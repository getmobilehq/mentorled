"""Risk Detection Service for Fellows."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.risk_assessment import RiskAssessment, RiskLevel


class RiskDetectionService:
    """
    Service for detecting and assessing fellow risk levels.

    Combines multiple signals to calculate comprehensive risk scores:
    - Check-in patterns (frequency, sentiment, risk contributions)
    - Milestone performance
    - Warning history
    - Team collaboration ratings
    - Energy levels
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def assess_fellow_risk(self, fellow_id: UUID, week: int) -> Dict[str, Any]:
        """
        Perform comprehensive risk assessment for a fellow.

        Args:
            fellow_id: Fellow's UUID
            week: Current program week

        Returns:
            Dictionary with risk assessment data
        """
        # Get fellow data
        result = await self.db.execute(select(Fellow).filter(Fellow.id == fellow_id))
        fellow = result.scalar_one_or_none()

        if not fellow:
            raise ValueError(f"Fellow {fellow_id} not found")

        # Gather signals
        signals = await self._gather_risk_signals(fellow, week)

        # Calculate risk score (0.0 to 1.0)
        risk_score = self._calculate_risk_score(signals)

        # Determine risk level
        risk_level = self._determine_risk_level(risk_score)

        # Identify concerns
        concerns = self._identify_concerns(signals)

        # Recommend action
        recommended_action = self._recommend_action(risk_level, concerns, signals)

        return {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'signals': signals,
            'concerns': concerns,
            'recommended_action': recommended_action,
        }

    async def _gather_risk_signals(self, fellow: Fellow, week: int) -> Dict[str, Any]:
        """Gather all risk signals for a fellow."""
        signals = {}

        # 1. Check-in signals (last 3 weeks)
        recent_check_ins = await self._get_recent_check_ins(fellow.id, week, lookback=3)
        signals['check_in_frequency'] = len(recent_check_ins) / 3.0  # Expect 1 per week

        if recent_check_ins:
            # Average sentiment from recent check-ins
            sentiments = [ci.sentiment_score for ci in recent_check_ins if ci.sentiment_score is not None]
            signals['avg_sentiment'] = sum(sentiments) / len(sentiments) if sentiments else None

            # Average risk contribution from check-ins
            risk_contributions = [ci.risk_contribution for ci in recent_check_ins if ci.risk_contribution is not None]
            signals['avg_check_in_risk'] = sum(risk_contributions) / len(risk_contributions) if risk_contributions else None

            # Recent energy levels
            energy_levels = [ci.energy_level for ci in recent_check_ins if ci.energy_level is not None]
            signals['avg_energy'] = sum(energy_levels) / len(energy_levels) if energy_levels else None

            # Collaboration ratings
            collab_ratings = [ci.collaboration_rating for ci in recent_check_ins if ci.collaboration_rating]
            struggling_count = sum(1 for r in collab_ratings if r == 'struggling')
            signals['collaboration_issues'] = struggling_count / len(collab_ratings) if collab_ratings else 0.0

            # Self-assessment trend
            self_assessments = [ci.self_assessment for ci in recent_check_ins if ci.self_assessment]
            below_count = sum(1 for a in self_assessments if a == 'below')
            signals['below_expectations_rate'] = below_count / len(self_assessments) if self_assessments else 0.0
        else:
            signals['avg_sentiment'] = None
            signals['avg_check_in_risk'] = None
            signals['avg_energy'] = None
            signals['collaboration_issues'] = 0.0
            signals['below_expectations_rate'] = 0.0

        # 2. Milestone performance
        milestone_scores = []
        if fellow.milestone_1_score is not None:
            milestone_scores.append(float(fellow.milestone_1_score))
        if fellow.milestone_2_score is not None:
            milestone_scores.append(float(fellow.milestone_2_score))
        if fellow.milestone_3_score is not None:
            milestone_scores.append(float(fellow.milestone_3_score))

        signals['milestone_avg'] = sum(milestone_scores) / len(milestone_scores) if milestone_scores else None
        signals['milestone_count'] = len(milestone_scores)

        # 3. Warning history
        signals['warnings_count'] = fellow.warnings_count

        # 4. Previous risk assessments trend
        prev_assessments = await self._get_recent_risk_assessments(fellow.id, week, lookback=2)
        if prev_assessments:
            signals['prev_risk_trend'] = [float(ra.risk_score) for ra in prev_assessments]
            signals['risk_increasing'] = self._is_risk_increasing(signals['prev_risk_trend'])
        else:
            signals['prev_risk_trend'] = []
            signals['risk_increasing'] = False

        return signals

    async def _get_recent_check_ins(self, fellow_id: UUID, current_week: int, lookback: int = 3) -> List[CheckIn]:
        """Get recent check-ins for a fellow."""
        result = await self.db.execute(
            select(CheckIn)
            .filter(
                CheckIn.fellow_id == fellow_id,
                CheckIn.week >= current_week - lookback,
                CheckIn.week <= current_week
            )
            .order_by(desc(CheckIn.week))
        )
        return result.scalars().all()

    async def _get_recent_risk_assessments(self, fellow_id: UUID, current_week: int, lookback: int = 2) -> List[RiskAssessment]:
        """Get recent risk assessments for a fellow."""
        result = await self.db.execute(
            select(RiskAssessment)
            .filter(
                RiskAssessment.fellow_id == fellow_id,
                RiskAssessment.week >= current_week - lookback,
                RiskAssessment.week < current_week
            )
            .order_by(desc(RiskAssessment.week))
        )
        return result.scalars().all()

    def _calculate_risk_score(self, signals: Dict[str, Any]) -> float:
        """
        Calculate overall risk score from signals.

        Returns value between 0.0 (no risk) and 1.0 (critical risk).
        """
        score = 0.0
        weight_total = 0.0

        # Check-in frequency (weight: 0.15)
        if 'check_in_frequency' in signals:
            freq = signals['check_in_frequency']
            if freq < 0.33:  # Less than 1 in 3 weeks
                score += 0.8 * 0.15
            elif freq < 0.67:  # Less than 2 in 3 weeks
                score += 0.4 * 0.15
            weight_total += 0.15

        # Check-in risk contribution (weight: 0.25)
        if signals['avg_check_in_risk'] is not None:
            score += signals['avg_check_in_risk'] * 0.25
            weight_total += 0.25

        # Sentiment (weight: 0.15)
        if signals['avg_sentiment'] is not None:
            # Convert sentiment from -1:1 to 0:1 risk scale (inverted)
            sentiment_risk = (1.0 - (signals['avg_sentiment'] + 1.0) / 2.0)
            score += sentiment_risk * 0.15
            weight_total += 0.15

        # Energy levels (weight: 0.10)
        if signals['avg_energy'] is not None:
            # Convert 1-10 scale to 0-1 risk (inverted)
            energy_risk = 1.0 - (signals['avg_energy'] / 10.0)
            score += energy_risk * 0.10
            weight_total += 0.10

        # Milestone performance (weight: 0.20)
        if signals['milestone_avg'] is not None:
            # Assuming milestones scored 0-4, convert to risk
            milestone_risk = 1.0 - (signals['milestone_avg'] / 4.0)
            score += milestone_risk * 0.20
            weight_total += 0.20

        # Collaboration issues (weight: 0.05)
        score += signals['collaboration_issues'] * 0.05
        weight_total += 0.05

        # Below expectations rate (weight: 0.05)
        score += signals['below_expectations_rate'] * 0.05
        weight_total += 0.05

        # Warnings (weight: 0.05)
        warnings_risk = min(signals['warnings_count'] / 3.0, 1.0)  # Cap at 3 warnings
        score += warnings_risk * 0.05
        weight_total += 0.05

        # Normalize by actual weight used
        if weight_total > 0:
            score = score / weight_total

        # Amplify if risk is increasing
        if signals.get('risk_increasing', False):
            score = min(score * 1.2, 1.0)

        return round(score, 2)

    def _determine_risk_level(self, risk_score: float) -> str:
        """Determine risk level from score."""
        if risk_score < 0.25:
            return RiskLevel.ON_TRACK.value
        elif risk_score < 0.50:
            return RiskLevel.MONITOR.value
        elif risk_score < 0.75:
            return RiskLevel.AT_RISK.value
        else:
            return RiskLevel.CRITICAL.value

    def _identify_concerns(self, signals: Dict[str, Any]) -> Dict[str, Any]:
        """Identify specific concerns from signals."""
        concerns = {}

        if signals['check_in_frequency'] < 0.67:
            concerns['check_in_compliance'] = f"Low check-in rate: {signals['check_in_frequency']:.1%}"

        if signals['avg_sentiment'] is not None and signals['avg_sentiment'] < -0.3:
            concerns['low_morale'] = f"Negative sentiment: {signals['avg_sentiment']:.2f}"

        if signals['avg_energy'] is not None and signals['avg_energy'] < 4:
            concerns['low_energy'] = f"Low energy levels: {signals['avg_energy']:.1f}/10"

        if signals['collaboration_issues'] > 0.3:
            concerns['collaboration'] = "Struggling with team collaboration"

        if signals['milestone_avg'] is not None and signals['milestone_avg'] < 2.5:
            concerns['performance'] = f"Below target milestone performance: {signals['milestone_avg']:.2f}/4"

        if signals['warnings_count'] > 0:
            concerns['warnings'] = f"{signals['warnings_count']} warning(s) issued"

        if signals.get('risk_increasing', False):
            concerns['trend'] = "Risk score is increasing"

        return concerns

    def _recommend_action(self, risk_level: str, concerns: Dict[str, Any], signals: Dict[str, Any]) -> str:
        """Recommend action based on risk level and concerns."""
        if risk_level == RiskLevel.CRITICAL.value:
            return "immediate_intervention"
        elif risk_level == RiskLevel.AT_RISK.value:
            if signals['warnings_count'] >= 1:
                return "final_warning"
            else:
                return "issue_warning"
        elif risk_level == RiskLevel.MONITOR.value:
            return "schedule_1_on_1"
        else:
            return "continue_monitoring"

    def _is_risk_increasing(self, trend: List[float]) -> bool:
        """Check if risk is on an upward trend."""
        if len(trend) < 2:
            return False

        # Simple check: is latest higher than average of previous?
        latest = trend[0]
        previous_avg = sum(trend[1:]) / len(trend[1:])

        return latest > previous_avg * 1.1  # 10% increase threshold

    async def get_cohort_risk_dashboard(self, cohort_id: UUID, week: int) -> Dict[str, Any]:
        """Get risk dashboard data for entire cohort."""
        # Get all fellows in cohort
        result = await self.db.execute(
            select(Fellow).filter(Fellow.cohort_id == cohort_id)
        )
        fellows = result.scalars().all()

        # Get latest risk assessments for each fellow
        dashboard_data = {
            'summary': {
                'on_track': 0,
                'monitor': 0,
                'at_risk': 0,
                'critical': 0,
            },
            'fellows': []
        }

        for fellow in fellows:
            # Get most recent risk assessment
            result = await self.db.execute(
                select(RiskAssessment)
                .filter(RiskAssessment.fellow_id == fellow.id)
                .order_by(desc(RiskAssessment.assessed_at))
                .limit(1)
            )
            latest_assessment = result.scalar_one_or_none()

            if latest_assessment:
                risk_level = latest_assessment.risk_level
                risk_score = float(latest_assessment.risk_score)
            else:
                risk_level = 'on_track'
                risk_score = 0.0

            # Update summary counts
            dashboard_data['summary'][risk_level] += 1

            # Add fellow data
            dashboard_data['fellows'].append({
                'id': str(fellow.id),
                'name': fellow.applicant.name if fellow.applicant else 'Unknown',
                'role': fellow.role,
                'team_id': str(fellow.team_id) if fellow.team_id else None,
                'risk_level': risk_level,
                'risk_score': risk_score,
                'warnings_count': fellow.warnings_count,
                'milestone_1_score': float(fellow.milestone_1_score) if fellow.milestone_1_score else None,
                'milestone_2_score': float(fellow.milestone_2_score) if fellow.milestone_2_score else None,
            })

        return dashboard_data
