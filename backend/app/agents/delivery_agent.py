from typing import Dict, Any, List, Optional
from uuid import UUID
import logging

from app.agents.llm_client import llm_client
from app.agents.prompts.delivery import (
    CHECK_IN_ANALYSIS_SYSTEM,
    CHECK_IN_ANALYSIS_PROMPT,
    RISK_ASSESSMENT_SYSTEM,
    RISK_ASSESSMENT_PROMPT,
    WARNING_DRAFT_SYSTEM,
    WARNING_DRAFT_PROMPT
)
from app.config import settings

logger = logging.getLogger(__name__)

class DeliveryAgent:
    """
    AI Agent for monitoring fellow progress, detecting risk, and drafting interventions.
    """

    # Signal weights for risk calculation
    SIGNAL_WEIGHTS = {
        "check_in_sentiment": 0.15,
        "check_in_completeness": 0.10,
        "self_assessment": 0.10,
        "slack_activity": 0.15,
        "github_activity": 0.20,
        "attendance": 0.15,
        "mentor_flags": 0.10,
        "trend": 0.05
    }

    async def analyze_check_in(
        self,
        fellow_id: UUID,
        check_in_data: Dict[str, Any],
        prior_check_ins: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a weekly check-in submission.
        """
        # Format prior check-ins for context
        prior_context = ""
        if prior_check_ins:
            prior_context = "\n".join([
                f"Week {ci.get('week')}: Self-assessment: {ci.get('self_assessment')}, "
                f"Sentiment: {ci.get('sentiment_score', 'N/A')}"
                for ci in prior_check_ins[-3:]  # Last 3 weeks
            ])
        else:
            prior_context = "No prior check-ins available."

        prompt = CHECK_IN_ANALYSIS_PROMPT.format(
            week=check_in_data.get("week", "Unknown"),
            accomplishments=check_in_data.get("accomplishments", "Not provided"),
            next_focus=check_in_data.get("next_focus", "Not provided"),
            blockers=check_in_data.get("blockers", "None mentioned"),
            needs_help=check_in_data.get("needs_help", "None mentioned"),
            self_assessment=check_in_data.get("self_assessment", "Not provided"),
            collaboration_rating=check_in_data.get("collaboration_rating", "Not provided"),
            energy_level=check_in_data.get("energy_level", "Not provided"),
            prior_check_ins=prior_context
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=CHECK_IN_ANALYSIS_SYSTEM,
            model=settings.FAST_MODEL,
            temperature=0.2,
            json_response=True,
            metadata={
                "action": "check_in_analysis",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        return result["content"]

    async def assess_risk(
        self,
        fellow_id: UUID,
        signals: Dict[str, Any],
        fellow_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Perform multi-signal risk assessment.
        """
        # Calculate weighted risk score
        risk_score = 0.0
        for signal, weight in self.SIGNAL_WEIGHTS.items():
            signal_value = signals.get(signal, 0.5)  # Default to neutral
            risk_score += signal_value * weight

        risk_score = round(risk_score, 2)

        # Determine risk level
        if risk_score >= 0.7:
            risk_level = "on_track"
        elif risk_score >= 0.5:
            risk_level = "monitor"
        elif risk_score >= 0.3:
            risk_level = "at_risk"
        else:
            risk_level = "critical"

        # Use LLM to identify specific concerns and recommendations
        prompt = RISK_ASSESSMENT_PROMPT.format(
            fellow_name=fellow_context.get("name", "Fellow"),
            role=fellow_context.get("role", "Unknown"),
            week=fellow_context.get("current_week", "Unknown"),
            team=fellow_context.get("team_name", "Unknown"),
            risk_score=risk_score,
            risk_level=risk_level,
            signals=str(signals),
            prior_warnings=fellow_context.get("warnings_count", 0),
            recent_check_in_summary=fellow_context.get("recent_check_in", "No recent check-in")
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=RISK_ASSESSMENT_SYSTEM,
            model=settings.FAST_MODEL,
            temperature=0.2,
            json_response=True,
            metadata={
                "action": "risk_assessment",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        assessment = result["content"]
        assessment["risk_score"] = risk_score
        assessment["risk_level"] = risk_level
        assessment["signals"] = signals

        return assessment

    async def draft_warning(
        self,
        fellow_id: UUID,
        warning_level: str,
        concerns: List[str],
        evidence: Dict[str, Any],
        fellow_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Draft a warning document for ops review.
        """
        prompt = WARNING_DRAFT_PROMPT.format(
            fellow_name=fellow_context.get("name", "Fellow"),
            role=fellow_context.get("role", "Unknown"),
            team=fellow_context.get("team_name", "Unknown"),
            warning_level=warning_level,
            concerns="\n".join([f"- {c}" for c in concerns]),
            evidence=str(evidence),
            prior_warnings=fellow_context.get("warnings_count", 0),
            weeks_remaining=fellow_context.get("weeks_remaining", "Unknown")
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=WARNING_DRAFT_SYSTEM,
            model=settings.DEFAULT_MODEL,
            temperature=0.3,
            json_response=True,
            metadata={
                "action": "warning_draft",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        return result["content"]

delivery_agent = DeliveryAgent()
