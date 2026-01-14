from typing import Dict, Any, List, Optional
from uuid import UUID
import logging

from app.agents.llm_client import llm_client
from app.agents.prompts.placement import (
    PROFILE_GENERATION_SYSTEM,
    PROFILE_GENERATION_PROMPT,
    JOB_MATCHING_SYSTEM,
    JOB_MATCHING_PROMPT,
    INTRODUCTION_DRAFT_SYSTEM,
    INTRODUCTION_DRAFT_PROMPT
)
from app.config import settings

logger = logging.getLogger(__name__)

class PlacementAgent:
    """
    AI Agent for profile generation, job matching, and placement support.
    """

    async def generate_profile(
        self,
        fellow_id: UUID,
        fellow_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a professional profile for a fellow.
        """
        prompt = PROFILE_GENERATION_PROMPT.format(
            name=fellow_data.get("name", "Fellow"),
            role=fellow_data.get("role", "Unknown"),
            project_description=fellow_data.get("project_description", "N/A"),
            team_project_title=fellow_data.get("team_project", {}).get("title", "N/A"),
            team_project_description=fellow_data.get("team_project", {}).get("description", "N/A"),
            team_contribution=fellow_data.get("team_project", {}).get("contribution", "N/A"),
            skills_demonstrated=", ".join(fellow_data.get("skills_demonstrated", [])),
            microship_score=fellow_data.get("microship_score", "N/A"),
            milestone_scores=str(fellow_data.get("milestone_scores", {})),
            portfolio_url=fellow_data.get("portfolio_url", "N/A"),
            github_url=fellow_data.get("github_url", "N/A")
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=PROFILE_GENERATION_SYSTEM,
            model=settings.DEFAULT_MODEL,
            temperature=0.4,
            json_response=True,
            metadata={
                "action": "profile_generation",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        return result["content"]

    async def match_opportunities(
        self,
        fellow_id: UUID,
        fellow_profile: Dict[str, Any],
        opportunities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Match a fellow with job opportunities.
        """
        # Format opportunities for prompt
        opps_formatted = "\n\n".join([
            f"**Opportunity {i+1}: {opp.get('title')} at {opp.get('employer_name')}**\n"
            f"Requirements: {', '.join(opp.get('requirements', []))}\n"
            f"Preferred: {', '.join(opp.get('preferred_skills', []))}\n"
            f"Level: {opp.get('experience_level', 'entry')}"
            for i, opp in enumerate(opportunities)
        ])

        prompt = JOB_MATCHING_PROMPT.format(
            fellow_name=fellow_profile.get("name", "Fellow"),
            role=fellow_profile.get("role", "Unknown"),
            headline=fellow_profile.get("headline", "N/A"),
            summary=fellow_profile.get("summary", "N/A"),
            skills=str(fellow_profile.get("skills", [])),
            opportunities=opps_formatted,
            num_opportunities=len(opportunities)
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=JOB_MATCHING_SYSTEM,
            model=settings.FAST_MODEL,
            temperature=0.2,
            json_response=True,
            metadata={
                "action": "job_matching",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        matches = result["content"].get("matches", [])

        # Add opportunity IDs back
        for i, match in enumerate(matches):
            if i < len(opportunities):
                match["opportunity_id"] = opportunities[i].get("id")

        return matches

    async def draft_introduction(
        self,
        fellow_id: UUID,
        fellow_profile: Dict[str, Any],
        opportunity: Dict[str, Any],
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Draft an introduction email for an employer.
        """
        prompt = INTRODUCTION_DRAFT_PROMPT.format(
            fellow_name=fellow_profile.get("name", "Fellow"),
            role=fellow_profile.get("role", "Unknown"),
            headline=fellow_profile.get("headline", "N/A"),
            summary=fellow_profile.get("summary", "N/A"),
            key_project=fellow_profile.get("projects", [{}])[0].get("description", "N/A") if fellow_profile.get("projects") else "N/A",
            employer_name=opportunity.get("employer_name", "Employer"),
            job_title=opportunity.get("title", "Position"),
            job_requirements=", ".join(opportunity.get("requirements", [])),
            context=context or "No additional context"
        )

        result = await llm_client.complete(
            prompt=prompt,
            system=INTRODUCTION_DRAFT_SYSTEM,
            model=settings.DEFAULT_MODEL,
            temperature=0.4,
            json_response=True,
            metadata={
                "action": "introduction_draft",
                "entity_type": "fellow",
                "entity_id": str(fellow_id)
            }
        )

        return result["content"]

placement_agent = PlacementAgent()
