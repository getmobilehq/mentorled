"""Challenge Content Generator using Claude AI."""
import json
import re
import logging
from typing import Dict, Any, Optional

from app.agents.llm_client import llm_client
from app.agents.prompts.challenge_generator import (
    CHALLENGE_GENERATOR_SYSTEM,
    CHALLENGE_GENERATOR_PROMPT,
)

logger = logging.getLogger(__name__)

ROLE_LABELS = {
    "backend": "Backend Developer",
    "frontend": "Frontend Developer",
    "product_designer": "Product Designer",
    "product_manager": "Product Manager",
    "qa": "QA Engineer",
}


class ChallengeGenerator:
    """
    AI agent for generating challenge content (title, description, requirements).

    Helps program managers quickly create well-structured challenge briefs
    tailored to specific roles, durations, and track sequences.
    """

    async def generate_content(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate challenge content based on context.

        Args:
            context: Dictionary with keys:
                - role_type (str): required
                - duration_hours (int|None)
                - sequence_number (int|None)
                - total_in_track (int|None)
                - existing_challenges (list[dict]): titles/descriptions of existing challenges in track
                - existing_title (str|None): PM's partial input
                - existing_description (str|None): PM's partial input

        Returns:
            Dictionary with title, description, requirements
        """
        role_type = context.get("role_type", "backend")
        duration_hours = context.get("duration_hours")
        sequence_number = context.get("sequence_number")
        total_in_track = context.get("total_in_track")
        existing_challenges = context.get("existing_challenges", [])
        existing_title = context.get("existing_title")
        existing_description = context.get("existing_description")

        # Format existing challenges for prompt
        if existing_challenges:
            challenges_text = "\n".join(
                f"  - #{c.get('sequence_number', '?')}: {c['title']}"
                for c in existing_challenges
            )
        else:
            challenges_text = "None yet (this is the first challenge in the track)"

        prompt = CHALLENGE_GENERATOR_PROMPT.format(
            role_type=ROLE_LABELS.get(role_type, role_type),
            duration_hours=f"{duration_hours} hours" if duration_hours else "Not specified (default to 24h scope)",
            sequence_number=sequence_number or 1,
            total_in_track=total_in_track or "unknown",
            existing_challenges=challenges_text,
            existing_title=existing_title or "None provided",
            existing_description=existing_description or "None provided",
        )

        try:
            # Use json_response=False to handle parsing ourselves,
            # since creative content often contains literal newlines
            result = await llm_client.complete(
                prompt=prompt,
                system=CHALLENGE_GENERATOR_SYSTEM,
                temperature=0.7,
                max_tokens=2048,
                json_response=False,
                metadata={
                    "action": "challenge_generation",
                    "entity_type": "challenge",
                },
            )

            raw = result["content"]

            # Extract JSON from markdown code blocks if present
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0]
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0]

            # Replace literal control characters inside JSON string values
            # (newlines, tabs) that break json.loads
            raw = raw.strip()
            # Replace actual newlines/tabs within strings with escaped versions
            # by first normalizing \r\n and \r to \n, then escaping for JSON
            raw = raw.replace('\r\n', '\n').replace('\r', '\n')
            # Use a regex to fix unescaped newlines inside JSON string values
            raw = re.sub(r'(?<=": ")(.*?)(?="[,\s*}])', lambda m: m.group(0).replace('\n', '\\n').replace('\t', '\\t'), raw, flags=re.DOTALL)

            try:
                content = json.loads(raw)
            except json.JSONDecodeError:
                # Fallback: try replacing all literal newlines
                raw_fallback = raw.replace('\n', '\\n').replace('\t', '\\t')
                # But fix the structural ones back
                raw_fallback = raw_fallback.replace('\\n{', '\n{').replace('\\n}', '\n}')
                raw_fallback = raw_fallback.replace('\\n  ', '\n  ').replace('\\n]', '\n]')
                content = json.loads(raw_fallback)

            return {
                "title": content.get("title", ""),
                "description": content.get("description", ""),
                "requirements": content.get("requirements", []),
                "usage": result.get("usage"),
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.error(f"Raw content: {raw}")
            raise Exception(f"Failed to parse AI-generated content")
        except Exception as e:
            logger.error(f"Challenge content generation failed: {e}")
            raise Exception(f"Failed to generate challenge content: {str(e)}")


# Singleton instance
challenge_generator = ChallengeGenerator()
