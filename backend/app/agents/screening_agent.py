from typing import Dict, Any, Optional
from uuid import UUID
import logging

from app.agents.llm_client import llm_client
from app.agents.prompts.screening import (
    APPLICATION_SCREENING_SYSTEM,
    APPLICATION_SCREENING_PROMPT,
    MICROSHIP_CODE_EVALUATION_SYSTEM,
    MICROSHIP_CODE_EVALUATION_PROMPT,
    MICROSHIP_PRD_EVALUATION_PROMPT,
    MICROSHIP_DESIGN_EVALUATION_PROMPT
)
from app.config import settings

logger = logging.getLogger(__name__)

class ScreeningAgent:
    """
    AI Agent for screening applications and evaluating Microship submissions.
    """

    async def evaluate_application(
        self,
        applicant_id: UUID,
        applicant_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate an application for eligibility.
        """
        prompt = APPLICATION_SCREENING_PROMPT.format(
            name=applicant_data.get("name", "Unknown"),
            role=applicant_data.get("role", "Unknown"),
            portfolio_url=applicant_data.get("portfolio_url", "Not provided"),
            github_url=applicant_data.get("github_url", "Not provided"),
            project_description=applicant_data.get("project_description", "Not provided"),
            time_commitment="Yes" if applicant_data.get("time_commitment") else "No"
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=APPLICATION_SCREENING_SYSTEM,
            model=settings.FAST_MODEL,
            temperature=0.2,
            json_response=True,
            metadata={
                "action": "application_screening",
                "entity_type": "applicant",
                "entity_id": str(applicant_id)
            }
        )

        evaluation = result["content"]
        evaluation["model_used"] = result["usage"]["model"]
        evaluation["prompt_version"] = "v1.0"

        return evaluation

    async def evaluate_microship(
        self,
        applicant_id: UUID,
        submission_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate a Microship challenge submission.
        """
        role = submission_data.get("role", "").lower()

        # Select appropriate prompt based on role
        if role in ["frontend", "backend"]:
            prompt_template = MICROSHIP_CODE_EVALUATION_PROMPT
            system = MICROSHIP_CODE_EVALUATION_SYSTEM
        elif role == "product_manager":
            prompt_template = MICROSHIP_PRD_EVALUATION_PROMPT
            system = MICROSHIP_CODE_EVALUATION_SYSTEM
        elif role == "product_designer":
            prompt_template = MICROSHIP_DESIGN_EVALUATION_PROMPT
            system = MICROSHIP_CODE_EVALUATION_SYSTEM
        else:
            prompt_template = MICROSHIP_CODE_EVALUATION_PROMPT
            system = MICROSHIP_CODE_EVALUATION_SYSTEM

        # Format communication log
        comm_log = submission_data.get("communication_log", [])
        comm_log_str = "\n".join([
            f"- {log.get('timestamp', 'N/A')}: {log.get('type', 'message')} - {log.get('content', '')}"
            for log in comm_log
        ]) if comm_log else "No communication logged."

        prompt = prompt_template.format(
            role=role,
            submission_url=submission_data.get("submission_url", "Not provided"),
            submission_type=submission_data.get("submission_type", "unknown"),
            submitted_at=str(submission_data.get("submitted_at", "Unknown")),
            deadline=str(submission_data.get("deadline", "Unknown")),
            on_time="Yes" if submission_data.get("on_time") else "No",
            communication_log=comm_log_str,
            code_analysis=str(submission_data.get("code_analysis", "No analysis available")),
            content=submission_data.get("content", "No content provided")
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=system,
            model=settings.DEFAULT_MODEL,
            temperature=0.2,
            json_response=True,
            metadata={
                "action": "microship_evaluation",
                "entity_type": "applicant",
                "entity_id": str(applicant_id)
            }
        )

        evaluation = result["content"]

        # Calculate weighted score
        scores = evaluation.get("scores", {})
        weighted_score = (
            scores.get("technical_execution", 0) * 0.40 +
            scores.get("execution_discipline", 0) * 0.25 +
            scores.get("professional_behavior", 0) * 0.25 +
            scores.get("instruction_following", 0) * 0.10
        )

        evaluation["weighted_score"] = round(weighted_score, 2)

        # Determine outcome
        if evaluation.get("disqualifiers"):
            evaluation["outcome"] = "do_not_progress"
        elif weighted_score >= 3.0:
            evaluation["outcome"] = "progress"
        elif weighted_score >= 2.5:
            evaluation["outcome"] = "borderline"
        else:
            evaluation["outcome"] = "do_not_progress"

        # Flag for human review
        evaluation["requires_human_review"] = (
            evaluation["outcome"] == "borderline" or
            evaluation.get("confidence", 1.0) < settings.SCREENING_CONFIDENCE_THRESHOLD
        )

        evaluation["model_used"] = result["usage"]["model"]
        evaluation["prompt_version"] = "v1.0"

        return evaluation

screening_agent = ScreeningAgent()
