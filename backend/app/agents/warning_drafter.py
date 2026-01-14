"""Warning Message Drafter using Claude AI."""
import os
import json
import re
from typing import Dict, Any
from anthropic import Anthropic


class WarningDrafter:
    """
    AI agent for drafting warning messages to fellows.

    Creates empathetic but firm warning messages based on risk
    assessments and specific concerns, maintaining a supportive
    tone while being clear about expectations and consequences.
    """

    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"

    async def draft_warning(self, warning_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Draft a warning message for a fellow.

        Args:
            warning_data: Dictionary containing warning context

        Returns:
            Dictionary with draft message and metadata
        """
        warning_level = warning_data.get('level', 'first')

        if warning_level == 'first':
            system_prompt = self._get_first_warning_prompt()
        else:
            system_prompt = self._get_final_warning_prompt()

        user_prompt = self._build_warning_prompt(warning_data)

        try:
            response = await self._call_claude(system_prompt, user_prompt)
            draft_result = self._parse_and_validate_response(response)
            return draft_result
        except Exception as e:
            raise Exception(f"Warning drafting failed: {str(e)}")

    def _get_first_warning_prompt(self) -> str:
        """System prompt for first warning."""
        return """You are an empathetic program manager drafting a FIRST warning to a fellow in a work experience program.

TONE AND APPROACH:
- Supportive and constructive, not punitive
- Acknowledge their potential and past contributions
- Be specific about concerns, not vague
- Focus on growth and improvement
- Clear about expectations and timeline
- Maintain their dignity while being direct

WARNING STRUCTURE:

1. **Opening** (warm but serious):
   - Acknowledge the conversation is difficult
   - Express genuine care for their success
   - Reference specific positive contributions if applicable

2. **Specific Concerns** (factual, not judgmental):
   - List 2-4 specific, observable concerns
   - Use data where available (check-in trends, milestone scores)
   - Avoid accusations; focus on behaviors and outcomes

3. **Impact** (help them understand consequences):
   - Explain how these issues affect their learning, team, or project
   - Be honest about the stakes

4. **Requirements** (clear, actionable steps):
   - 2-4 specific, measurable requirements
   - Include timeline (typically 1-2 weeks)
   - Make expectations concrete, not abstract

5. **Support** (show you're invested):
   - Offer specific resources or help
   - Invite them to discuss blockers
   - Express confidence in their ability to course-correct

6. **Closing** (encouraging but firm):
   - Reiterate belief in them
   - Clarify this is serious but recoverable
   - Invite dialogue

AVOID:
- Generic language ("you need to try harder")
- Comparisons to other fellows
- Overly harsh or discouraging language
- Vague expectations
- Micromanagement

Respond ONLY with valid JSON (no markdown, no code blocks):
{
    "message": "<the complete warning message as a string>",
    "tone": "<warm_supportive|firm_supportive|serious>",
    "key_points": ["<2-4 main points covered>"],
    "requirements": ["<specific actionable requirements>"],
    "timeline": "<suggested review timeline, e.g., '2 weeks'>",
    "recommended_followup": "<suggested next action, e.g., 'Schedule 1-on-1 check-in in 1 week'>"
}"""

    def _get_final_warning_prompt(self) -> str:
        """System prompt for final warning."""
        return """You are an empathetic program manager drafting a FINAL warning to a fellow in a work experience program.

This is more serious than a first warning. The fellow has already received a first warning and has not adequately improved.

TONE AND APPROACH:
- Direct and clear, while maintaining respect
- Acknowledge this is the final opportunity
- Be explicit about consequences of not improving
- Still supportive, but emphasize urgency and seriousness
- Clear that removal from the program is the next step

WARNING STRUCTURE:

1. **Opening** (serious and direct):
   - State clearly this is a final warning
   - Reference the first warning and what has/hasn't changed
   - Express genuine care but emphasize gravity

2. **Previous Concerns vs. Current Status**:
   - What was required after first warning
   - What has improved (if anything)
   - What remains unresolved or has worsened
   - Use specific data and examples

3. **Clear Consequences**:
   - Be explicit: failure to meet requirements will result in removal
   - Explain the impact on their professional development
   - No ambiguity about stakes

4. **Non-Negotiable Requirements**:
   - 2-4 specific, measurable, time-bound requirements
   - Make expectations crystal clear
   - Shorter timeline (typically 1 week)

5. **Limited Support** (you're still available, but they must lead):
   - Offer help, but emphasize their responsibility
   - They must proactively seek support if needed

6. **Closing** (hopeful but realistic):
   - Express belief they can still succeed
   - Clarify this is their final opportunity
   - Maintain professionalism and respect

Respond ONLY with valid JSON (no markdown, no code blocks):
{
    "message": "<the complete warning message as a string>",
    "tone": "<firm_serious|professional_final>",
    "key_points": ["<2-4 main points covered>"],
    "requirements": ["<specific actionable requirements>"],
    "timeline": "<suggested review timeline, typically 1 week>",
    "recommended_followup": "<suggested next action>",
    "escalation_note": "<internal note about next steps if requirements not met>"
}"""

    def _build_warning_prompt(self, data: Dict[str, Any]) -> str:
        """Build warning drafting prompt."""
        concerns_str = "\n".join([f"- {c}" for c in data.get('concerns', [])])

        evidence_str = ""
        if data.get('risk_assessment'):
            ra = data['risk_assessment']
            evidence_str += f"\n\n## RISK ASSESSMENT DATA\n"
            evidence_str += f"- Risk Level: {ra.get('risk_level', 'N/A')}\n"
            evidence_str += f"- Risk Score: {ra.get('risk_score', 'N/A')}/1.0\n"

            if ra.get('signals'):
                signals = ra['signals']
                evidence_str += "\n### Signals:\n"
                if signals.get('check_in_frequency'):
                    evidence_str += f"- Check-in compliance: {signals['check_in_frequency']:.1%}\n"
                if signals.get('avg_sentiment') is not None:
                    evidence_str += f"- Average sentiment: {signals['avg_sentiment']:.2f} (-1 to 1)\n"
                if signals.get('avg_energy') is not None:
                    evidence_str += f"- Average energy: {signals['avg_energy']:.1f}/10\n"
                if signals.get('milestone_avg') is not None:
                    evidence_str += f"- Milestone average: {signals['milestone_avg']:.2f}/4\n"

        check_ins_str = ""
        if data.get('recent_check_ins'):
            check_ins_str = "\n\n## RECENT CHECK-INS\n"
            for ci in data['recent_check_ins'][:3]:  # Last 3
                check_ins_str += f"\nWeek {ci.get('week', '?')}:\n"
                check_ins_str += f"- Accomplishments: {ci.get('accomplishments', 'Not provided')[:100]}...\n"
                check_ins_str += f"- Blockers: {ci.get('blockers', 'None') or 'None'}\n"
                if ci.get('sentiment_score') is not None:
                    check_ins_str += f"- Sentiment: {ci['sentiment_score']:.2f}\n"

        previous_warning_str = ""
        if data.get('previous_warning'):
            pw = data['previous_warning']
            previous_warning_str = f"\n\n## PREVIOUS WARNING\n"
            previous_warning_str += f"- Issued: {pw.get('issued_at', 'Unknown')}\n"
            previous_warning_str += f"- Level: {pw.get('level', 'Unknown')}\n"
            previous_warning_str += f"- Requirements: {', '.join(pw.get('requirements', []))}\n"
            previous_warning_str += f"- Acknowledged: {'Yes' if pw.get('acknowledged') else 'No'}\n"

        return f"""Draft a {data.get('level', 'first')} warning for this fellow.

## FELLOW INFORMATION
- Name: {data.get('fellow_name', 'Unknown')}
- Role: {data.get('role', 'Unknown')}
- Program Week: {data.get('current_week', 'Unknown')}
- Warnings Count: {data.get('warnings_count', 0)}

## PRIMARY CONCERNS
{concerns_str}

{evidence_str}

{check_ins_str}

{previous_warning_str}

## YOUR TASK
Draft a {data.get('level', 'first')} warning message that:
1. Addresses the specific concerns listed
2. Uses the evidence/data provided to be specific
3. Sets clear, actionable requirements
4. Maintains an appropriate tone (supportive but serious)
5. Includes a realistic timeline for improvement

Remember: This is a real person trying to build their career. Be honest and direct, but maintain their dignity and show you believe in their potential to improve.

Provide your draft in the required JSON format."""

    async def _call_claude(self, system_prompt: str, user_prompt: str) -> str:
        """Call Claude API and return response text."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=3000,
            temperature=0.4,  # Balanced for empathetic but consistent tone
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
            required_fields = ['message', 'tone', 'key_points', 'requirements', 'timeline']
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")

            # Validate message is substantial
            if len(result['message']) < 200:
                raise ValueError("Warning message is too short")

            return result

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Response validation failed: {str(e)}")
