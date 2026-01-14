"""Microship Challenge Evaluator using Claude AI."""
import os
import json
import re
from typing import Dict, Any
from anthropic import Anthropic


class MicroshipEvaluator:
    """
    AI agent for evaluating Microship Challenge submissions.

    Evaluates submissions based on role-specific criteria and provides
    structured feedback with scores, evidence, and recommendations.
    """

    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"

    async def evaluate_code_submission(self, submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate code submission (Frontend/Backend/Fullstack roles).

        Args:
            submission_data: Dictionary containing submission information

        Returns:
            Dictionary with evaluation results
        """
        system_prompt = """You are a senior engineer evaluating a Microship Challenge submission.

The Microship is a 24-hour individual challenge to assess readiness for team-based work experience.

SCORING SCALE (1-4):
- 4: Exceeds expectations - Would be a strong contributor
- 3: Meets expectations - Ready for the program
- 2: Below expectations - Significant gaps exist
- 1: Does not meet - Not ready for team work

A score of 3 is the target. Don't inflate scores - be honest and fair.

EVALUATION CRITERIA:

1. **Technical Execution (40% weight)**
   - 4: Functionally correct, well-structured code, thoughtful beyond requirements
   - 3: Works correctly, clean code, meets all requirements
   - 2: Partially works, has significant technical issues
   - 1: Does not work, misses core requirements

2. **Execution Discipline (25% weight)**
   - 4: Submitted on time, excellent scope management, clearly prioritized
   - 3: On time, reasonable scope decisions, completed core features
   - 2: Late submission OR poor scope management
   - 1: Very late, poor planning, unrealistic scope

3. **Professional Behavior (25% weight)**
   - 4: Proactive communication, acknowledged promptly, provided updates
   - 3: Acknowledged receipt within 2 hours, communicated issues appropriately
   - 2: Minimal communication, only reactive
   - 1: No communication, unprofessional behavior

4. **Instruction Following (10% weight)**
   - 4: All instructions followed precisely, submitted via correct channel
   - 3: Minor deviations from instructions
   - 2: Some instructions missed
   - 1: Instructions largely ignored

DISQUALIFIERS (automatic do_not_progress):
- No submission or submitted >48 hours late
- Plagiarized code or AI-generated without attribution
- Submission doesn't match the assigned challenge
- Rude or unprofessional communication
- No acknowledgment of receipt

WEIGHTED SCORE CALCULATION:
- Multiply each score by its weight
- Sum the weighted scores
- Round to 2 decimal places (e.g., 3.15)

OUTCOME DETERMINATION:
- Weighted Score >= 3.0 → "progress"
- Weighted Score 2.5-2.9 → "borderline" (discuss with team)
- Weighted Score < 2.5 → "do_not_progress"

Respond ONLY with valid JSON (no markdown, no code blocks):
{
    "scores": {
        "technical_execution": <1-4>,
        "execution_discipline": <1-4>,
        "professional_behavior": <1-4>,
        "instruction_following": <1-4>
    },
    "weighted_score": <calculated weighted average as decimal>,
    "outcome": "<progress|borderline|do_not_progress>",
    "evidence": {
        "technical": "<specific observations about code quality, functionality, structure>",
        "execution": "<observations about time management, scope decisions>",
        "professional": "<observations about communication, acknowledgment timing>",
        "instructions": "<observations about following submission guidelines>"
    },
    "disqualifiers": ["<list any disqualifiers>"] or null,
    "strengths": ["<2-3 specific notable positives>"],
    "concerns": ["<any red flags or areas of concern>"],
    "confidence": <0.0-1.0, confidence in this evaluation>,
    "reasoning": "<2-3 sentence overall assessment justifying the outcome>"
}"""

        user_prompt = self._build_code_evaluation_prompt(submission_data)

        try:
            response = await self._call_claude(system_prompt, user_prompt)
            evaluation = self._parse_and_validate_response(response)
            return evaluation
        except Exception as e:
            raise Exception(f"Microship evaluation failed: {str(e)}")

    async def evaluate_prd_submission(self, submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate PRD submission (Product Manager role).

        Args:
            submission_data: Dictionary containing submission information

        Returns:
            Dictionary with evaluation results
        """
        system_prompt = """You are a senior product manager evaluating a Microship Challenge PRD submission.

SCORING SCALE (1-4):
- 4: Exceeds expectations
- 3: Meets expectations (target)
- 2: Below expectations
- 1: Does not meet

EVALUATION CRITERIA:

1. **Problem Definition & Research (40% weight)**
   - Clear user pain points identified
   - Market/competitive research
   - Data-driven insights

2. **Solution Quality (25% weight)**
   - Clear product vision
   - Well-defined features
   - Realistic scope

3. **Professional Presentation (25% weight)**
   - Clear structure and formatting
   - Professional communication
   - Timely submission

4. **Instruction Following (10% weight)**
   - All required sections included
   - Correct format/template used

Respond with the same JSON structure as code evaluations."""

        user_prompt = self._build_prd_evaluation_prompt(submission_data)

        try:
            response = await self._call_claude(system_prompt, user_prompt)
            evaluation = self._parse_and_validate_response(response)
            return evaluation
        except Exception as e:
            raise Exception(f"PRD evaluation failed: {str(e)}")

    async def evaluate_design_submission(self, submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate design submission (Designer role).

        Args:
            submission_data: Dictionary containing submission information

        Returns:
            Dictionary with evaluation results
        """
        system_prompt = """You are a senior product designer evaluating a Microship Challenge design submission.

SCORING SCALE (1-4):
- 4: Exceeds expectations
- 3: Meets expectations (target)
- 2: Below expectations
- 1: Does not meet

EVALUATION CRITERIA:

1. **Design Quality (40% weight)**
   - Visual hierarchy and clarity
   - User flow completeness
   - Attention to UX details

2. **Execution & Craft (25% weight)**
   - Use of Figma components
   - Professional presentation
   - Design system thinking

3. **Professional Behavior (25% weight)**
   - Timely submission
   - Communication quality
   - File organization

4. **Instruction Following (10% weight)**
   - All required screens/flows
   - Correct deliverable format

Respond with the same JSON structure as code evaluations."""

        user_prompt = self._build_design_evaluation_prompt(submission_data)

        try:
            response = await self._call_claude(system_prompt, user_prompt)
            evaluation = self._parse_and_validate_response(response)
            return evaluation
        except Exception as e:
            raise Exception(f"Design evaluation failed: {str(e)}")

    def _build_code_evaluation_prompt(self, data: Dict[str, Any]) -> str:
        """Build evaluation prompt for code submissions."""
        communication_log_str = "\n".join([
            f"- {entry.get('timestamp', 'Unknown time')}: {entry.get('content', '')}"
            for entry in data.get('communication_log', [])
        ]) if data.get('communication_log') else "No communication logged"

        return f"""Evaluate this Microship code submission.

## SUBMISSION DETAILS
- Applicant: {data.get('applicant_name', 'Unknown')}
- Role: {data.get('role', 'Unknown')}
- Submission URL: {data.get('submission_url', 'Not provided')}
- Submission Type: {data.get('submission_type', 'Unknown')}
- Submitted: {data.get('submitted_at', 'Not recorded')}
- Deadline: {data.get('deadline', 'Not specified')}
- On Time: {'Yes' if data.get('on_time') else 'No'}
- Acknowledgment Time: {data.get('acknowledgment_time', 'Not recorded')}

## COMMUNICATION LOG
{communication_log_str}

## CHALLENGE CONTEXT
This was a 24-hour challenge to build a functional feature. The candidate needed to:
1. Acknowledge receipt within 2 hours
2. Submit working code before the deadline
3. Follow all instructions precisely
4. Demonstrate professional communication

## YOUR TASK
Based on the information above, provide a fair and thorough evaluation using the rubric in your system prompt.

Calculate the weighted score precisely:
- Technical (40%): score × 0.40
- Execution (25%): score × 0.25
- Professional (25%): score × 0.25
- Instructions (10%): score × 0.10
Total = sum of weighted scores

Provide your evaluation in the required JSON format."""

    def _build_prd_evaluation_prompt(self, data: Dict[str, Any]) -> str:
        """Build evaluation prompt for PRD submissions."""
        return f"""Evaluate this Microship PRD submission.

## SUBMISSION DETAILS
- Applicant: {data.get('applicant_name', 'Unknown')}
- Document URL: {data.get('submission_url', 'Not provided')}
- Submitted: {data.get('submitted_at', 'Not recorded')}
- On Time: {'Yes' if data.get('on_time') else 'No'}

## COMMUNICATION LOG
{self._format_communication_log(data.get('communication_log', []))}

Evaluate based on problem definition, solution quality, presentation, and instruction following.
Provide your evaluation in the required JSON format."""

    def _build_design_evaluation_prompt(self, data: Dict[str, Any]) -> str:
        """Build evaluation prompt for design submissions."""
        return f"""Evaluate this Microship design submission.

## SUBMISSION DETAILS
- Applicant: {data.get('applicant_name', 'Unknown')}
- Figma URL: {data.get('submission_url', 'Not provided')}
- Submitted: {data.get('submitted_at', 'Not recorded')}
- On Time: {'Yes' if data.get('on_time') else 'No'}

## COMMUNICATION LOG
{self._format_communication_log(data.get('communication_log', []))}

Evaluate based on design quality, execution/craft, professional behavior, and instruction following.
Provide your evaluation in the required JSON format."""

    def _format_communication_log(self, log: list) -> str:
        """Format communication log for prompt."""
        if not log:
            return "No communication logged"
        return "\n".join([
            f"- {entry.get('timestamp', 'Unknown')}: {entry.get('content', '')}"
            for entry in log
        ])

    async def _call_claude(self, system_prompt: str, user_prompt: str) -> str:
        """Call Claude API and return response text."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            temperature=0.2,  # Low temperature for consistent scoring
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
            required_fields = ['scores', 'weighted_score', 'outcome', 'evidence', 'strengths', 'confidence', 'reasoning']
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")

            # Validate scores
            scores = result['scores']
            for score_type in ['technical_execution', 'execution_discipline', 'professional_behavior', 'instruction_following']:
                if score_type not in scores:
                    raise ValueError(f"Missing score: {score_type}")
                if not (1 <= scores[score_type] <= 4):
                    raise ValueError(f"Score out of range: {score_type} = {scores[score_type]}")

            # Validate weighted score
            if not (1.0 <= result['weighted_score'] <= 4.0):
                raise ValueError(f"Weighted score out of range: {result['weighted_score']}")

            # Validate outcome
            if result['outcome'] not in ['progress', 'borderline', 'do_not_progress']:
                raise ValueError(f"Invalid outcome: {result['outcome']}")

            # Validate confidence
            if not (0.0 <= result['confidence'] <= 1.0):
                raise ValueError(f"Confidence out of range: {result['confidence']}")

            return result

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Response validation failed: {str(e)}")
