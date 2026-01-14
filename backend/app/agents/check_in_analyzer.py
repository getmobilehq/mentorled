"""Check-in Analyzer using Claude AI."""
import os
import json
import re
from typing import Dict, Any
from anthropic import Anthropic


class CheckInAnalyzer:
    """
    AI agent for analyzing weekly check-ins from fellows.

    Analyzes check-in submissions to extract sentiment, identify risks,
    detect blockers, and recommend actions for program managers.
    """

    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"

    async def analyze_check_in(self, check_in_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a weekly check-in submission.

        Args:
            check_in_data: Dictionary containing check-in information

        Returns:
            Dictionary with analysis results
        """
        system_prompt = """You are an empathetic program manager analyzing weekly check-ins from fellows in a work experience program.

Your goal is to understand how the fellow is doing, identify any risks or blockers, and provide actionable insights for the program management team.

ANALYSIS DIMENSIONS:

1. **Sentiment Score (-1.0 to 1.0)**:
   - 1.0: Very positive, energized, making great progress
   - 0.5: Generally positive with minor concerns
   - 0.0: Neutral, steady progress
   - -0.5: Some concerns, struggling with specific issues
   - -1.0: Very negative, at risk, significant blockers

2. **Risk Contribution (0.0 to 1.0)**:
   - 0.0-0.2: On track, no concerns
   - 0.2-0.4: Minor concerns, monitor
   - 0.4-0.6: Notable concerns, may need intervention
   - 0.6-0.8: At risk, needs attention
   - 0.8-1.0: Critical risk, immediate action required

RISK SIGNALS TO WATCH FOR:
- Repeated blockers week over week
- Low energy levels (< 4/10)
- Collaboration issues ("struggling" rating)
- Self-assessment consistently "below" expectations
- Vague or minimal responses
- Emotional language indicating frustration or burnout
- Lack of progress on commitments from previous week
- No clear plan for next week
- Missing multiple check-ins

POSITIVE SIGNALS:
- Clear accomplishments and learning
- Proactive problem-solving
- Strong collaboration and communication
- Specific, achievable plans
- High energy and engagement
- Growth mindset language

Respond ONLY with valid JSON (no markdown, no code blocks):
{
    "sentiment_score": <-1.0 to 1.0>,
    "risk_contribution": <0.0 to 1.0>,
    "blockers_extracted": ["<list specific blockers mentioned or implied>"],
    "action_items": ["<recommended actions for program managers>"],
    "themes": ["<2-3 key themes in this check-in>"],
    "concerns": ["<specific concerns to monitor>"],
    "positive_signals": ["<strengths and positive indicators>"],
    "confidence": <0.0 to 1.0, confidence in this analysis>,
    "summary": "<2-3 sentence summary of fellow's status this week>"
}"""

        user_prompt = self._build_analysis_prompt(check_in_data)

        try:
            response = await self._call_claude(system_prompt, user_prompt)
            analysis = self._parse_and_validate_response(response)
            return analysis
        except Exception as e:
            raise Exception(f"Check-in analysis failed: {str(e)}")

    def _build_analysis_prompt(self, data: Dict[str, Any]) -> str:
        """Build analysis prompt for check-in."""
        return f"""Analyze this weekly check-in from a fellow in our program.

## FELLOW INFORMATION
- Name: {data.get('fellow_name', 'Unknown')}
- Week: {data.get('week', 'Unknown')}
- Role: {data.get('role', 'Unknown')}

## CHECK-IN RESPONSES

**What did you accomplish this week?**
{data.get('accomplishments', 'No response')}

**What are you focusing on next week?**
{data.get('next_focus', 'No response')}

**Any blockers or challenges?**
{data.get('blockers', 'None mentioned')}

**Do you need help with anything?**
{data.get('needs_help', 'No response')}

**Self-Assessment (exceeded/met/below expectations):**
{data.get('self_assessment', 'Not provided')}

**Team Collaboration Rating (great/good/okay/struggling):**
{data.get('collaboration_rating', 'Not provided')}

**Energy Level (1-10):**
{data.get('energy_level', 'Not provided')}/10

**Submitted:**
{data.get('submitted_at', 'Unknown')}

## CONTEXT
- Program Week: {data.get('week', 'Unknown')}
- This is a 12-week intensive work experience program
- Fellows work in teams on real projects
- We track weekly progress to catch issues early

## YOUR TASK
Based on the check-in above, provide a comprehensive analysis to help program managers understand this fellow's status and identify any needed interventions.

Be empathetic but honest. Look for patterns that indicate risk, but also recognize strengths and progress.

Provide your analysis in the required JSON format."""

    async def _call_claude(self, system_prompt: str, user_prompt: str) -> str:
        """Call Claude API and return response text."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            temperature=0.3,  # Slightly higher for nuanced analysis
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        return message.content[0].text

    def _parse_and_validate_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and validate AI response."""
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in response")

            result = json.loads(json_match.group())

            # Validate required fields
            required_fields = [
                'sentiment_score', 'risk_contribution', 'blockers_extracted',
                'action_items', 'themes', 'concerns', 'positive_signals',
                'confidence', 'summary'
            ]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")

            # Validate scores
            if not (-1.0 <= result['sentiment_score'] <= 1.0):
                raise ValueError(f"Sentiment score out of range: {result['sentiment_score']}")

            if not (0.0 <= result['risk_contribution'] <= 1.0):
                raise ValueError(f"Risk contribution out of range: {result['risk_contribution']}")

            if not (0.0 <= result['confidence'] <= 1.0):
                raise ValueError(f"Confidence out of range: {result['confidence']}")

            return result

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Response validation failed: {str(e)}")
