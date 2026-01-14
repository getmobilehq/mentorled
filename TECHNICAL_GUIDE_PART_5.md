# MentorLed Platform - Technical Guide (Part 5/6)
## AI Agents & Workflows

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 5)

1. [AI Agent Architecture](#ai-agent-architecture)
2. [Anthropic Claude Integration](#anthropic-claude-integration)
3. [Screening Agent](#screening-agent)
4. [Delivery Agent](#delivery-agent)
5. [Placement Agent](#placement-agent)
6. [Prompt Engineering Best Practices](#prompt-engineering-best-practices)
7. [Error Handling & Retry Logic](#error-handling--retry-logic)

---

## 1. AI Agent Architecture

### 1.1 Overview

MentorLed uses **3 AI agents** powered by Anthropic's Claude API to automate key operations:

1. **Screening Agent**: Evaluates applicant qualifications
2. **Delivery Agent**: Generates personalized learning plans
3. **Placement Agent**: Matches fellows with job opportunities

**Key Design Principles**:
- **Structured Output**: AI returns JSON for easy parsing
- **Deterministic**: Same input produces consistent output
- **Auditable**: All AI decisions logged with reasoning
- **Human-in-the-loop**: AI recommends, humans decide

### 1.2 Agent Architecture Pattern

All agents follow the same architecture:

```python
class AgentBase:
    """Base class for all AI agents."""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"  # Latest Claude model

    async def generate(self, system_prompt: str, user_prompt: str) -> dict:
        """Generate AI response with structured output."""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            temperature=0.7,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        return self.parse_response(response)

    def parse_response(self, response) -> dict:
        """Extract and validate JSON from response."""
        # Parse AI response
        # Validate against schema
        # Return structured data
        pass
```

**Flow**:
```
1. Prepare data (fetch from database)
   ↓
2. Construct prompts (system + user)
   ↓
3. Call Claude API
   ↓
4. Parse response (JSON extraction)
   ↓
5. Validate output (schema validation)
   ↓
6. Save result (database)
   ↓
7. Return to user
```

---

## 2. Anthropic Claude Integration

### 2.1 Setup

**Installation**:
```bash
pip install anthropic
```

**Environment Variable**:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Client Initialization**:
```python
import anthropic
import os

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)
```

### 2.2 Basic API Call

```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)

print(response.content[0].text)
```

### 2.3 System Prompts

**System prompts** define the AI's role and behavior:

```python
system_prompt = """You are an expert technical recruiter with 10 years of experience evaluating software engineering candidates.

Your responsibilities:
- Analyze applicant qualifications objectively
- Provide detailed reasoning for recommendations
- Identify both strengths and areas of concern
- Be fair and unbiased in your evaluations

Output Format:
You must respond with a JSON object containing:
{
  "score": <integer 0-100>,
  "recommendation": "<strong_accept|accept|maybe|reject>",
  "reasoning": "<detailed explanation>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "concerns": ["<concern1>", "<concern2>", ...]
}
"""
```

**Best Practices**:
- Define role clearly ("You are an expert...")
- List responsibilities
- Specify output format
- Include examples if needed
- Keep consistent across calls

### 2.4 User Prompts

**User prompts** provide the specific data/task:

```python
user_prompt = f"""Evaluate the following applicant for our software engineering fellowship program.

Applicant Details:
- Name: {applicant.name}
- Email: {applicant.email}
- Role: {applicant.role}
- Years of Experience: {applicant.years_of_experience}
- Skills: {', '.join(applicant.skills)}
- Interests: {', '.join(applicant.interests)}
- GitHub: {applicant.github_url}
- Portfolio: {applicant.portfolio_url}

Application Statement:
{applicant.cover_letter}

Program Requirements:
- Strong foundation in chosen technical area
- Demonstrated learning ability through projects
- Good communication skills
- Time commitment and motivation

Please provide your evaluation.
"""
```

### 2.5 Structured Output Extraction

**Method 1: JSON Extraction from Text**

```python
import json
import re

def extract_json_from_response(response_text: str) -> dict:
    """Extract JSON from Claude's response."""
    # Try to find JSON block
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            raise ValueError("Failed to parse JSON from response")
    raise ValueError("No JSON found in response")
```

**Method 2: Prompt for JSON Only**

```python
system_prompt = """...
IMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object.
"""

# Response will be pure JSON:
# {"score": 85, "recommendation": "accept", ...}
```

**Method 3: Structured Output API** (if available)

```python
# Future: Claude may support native structured output
response = client.messages.create(
    model="claude-sonnet-4",
    response_format={"type": "json_object"},
    messages=[...]
)
```

---

## 3. Screening Agent

### 3.1 Purpose

**Objective**: Automate initial applicant screening to identify the most qualified candidates.

**Inputs**:
- Applicant profile (name, email, role)
- Application materials (cover letter, resume, portfolio)
- Skills and experience
- GitHub/LinkedIn profiles

**Outputs**:
- Score (0-100): Numeric qualification score
- Recommendation (strong_accept, accept, maybe, reject)
- Reasoning: Detailed explanation
- Strengths: List of positive qualities
- Concerns: List of areas of concern

### 3.2 Implementation

**File**: `backend/app/agents/screening_agent.py`

```python
import os
import json
import anthropic
from typing import Dict, Any

class ScreeningAgent:
    """
    AI agent for screening applicants.

    Uses Claude to evaluate applicant qualifications and provide
    structured recommendations.
    """

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.model = "claude-sonnet-4-20250514"

    async def screen_applicant(self, applicant_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Screen an applicant and return evaluation.

        Args:
            applicant_data: Dictionary containing applicant information
                {
                    "name": str,
                    "email": str,
                    "role": str,
                    "years_of_experience": int,
                    "skills": List[str],
                    "interests": List[str],
                    "github_url": str,
                    "portfolio_url": str,
                    "cover_letter": str
                }

        Returns:
            Dictionary containing screening result:
                {
                    "score": int (0-100),
                    "recommendation": str (strong_accept|accept|maybe|reject),
                    "reasoning": str,
                    "strengths": List[str],
                    "concerns": List[str]
                }
        """
        system_prompt = self._get_system_prompt()
        user_prompt = self._construct_user_prompt(applicant_data)

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                temperature=0.3,  # Lower temperature for consistency
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            # Extract JSON from response
            result_text = response.content[0].text
            result = self._parse_response(result_text)

            return result

        except Exception as e:
            raise Exception(f"Screening failed: {str(e)}")

    def _get_system_prompt(self) -> str:
        """Get the system prompt for screening."""
        return """You are an expert technical recruiter with 10+ years of experience evaluating software engineering candidates for competitive fellowship programs.

Your responsibilities:
1. Analyze applicant qualifications objectively and fairly
2. Evaluate technical skills, project experience, and learning potential
3. Assess communication skills and motivation
4. Identify both strengths and areas of concern
5. Provide actionable, specific feedback

Evaluation Criteria:
- Technical Foundation: Depth of knowledge in chosen area
- Project Quality: Complexity and completeness of portfolio projects
- Learning Ability: Evidence of continuous learning and growth
- Communication: Clarity in application materials
- Motivation: Genuine interest and commitment
- Cultural Fit: Alignment with program values

Scoring Guide:
- 90-100: Exceptional candidate, strong accept
- 75-89: Strong candidate, accept
- 60-74: Borderline candidate, maybe
- 0-59: Not qualified, reject

Output Format:
Respond ONLY with a valid JSON object (no additional text):
{
  "score": <integer 0-100>,
  "recommendation": "<strong_accept|accept|maybe|reject>",
  "reasoning": "<detailed 2-3 paragraph explanation covering technical skills, projects, communication, and fit>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "concerns": ["<specific concern 1>", "<specific concern 2>"]
}
"""

    def _construct_user_prompt(self, data: Dict[str, Any]) -> str:
        """Construct user prompt with applicant data."""
        skills_str = ', '.join(data.get('skills', [])) or 'Not specified'
        interests_str = ', '.join(data.get('interests', [])) or 'Not specified'

        return f"""Evaluate the following applicant for our software engineering fellowship program.

APPLICANT PROFILE
=================
Name: {data.get('name', 'Unknown')}
Email: {data.get('email', 'Unknown')}
Applied Role: {data.get('role', 'Unknown')}
Years of Experience: {data.get('years_of_experience', 0)}

TECHNICAL BACKGROUND
===================
Skills: {skills_str}
Interests: {interests_str}
GitHub: {data.get('github_url') or 'Not provided'}
Portfolio: {data.get('portfolio_url') or 'Not provided'}

APPLICATION STATEMENT
====================
{data.get('cover_letter') or 'No cover letter provided.'}

PROGRAM REQUIREMENTS
===================
- Strong foundation in software engineering (backend, frontend, or fullstack)
- Demonstrated ability to build real projects
- Evidence of continuous learning and growth
- Good communication and collaboration skills
- Genuine interest in the program and career development
- Ability to commit 20+ hours per week for 12 weeks

Please provide your evaluation in the specified JSON format.
"""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and validate Claude's response."""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in response")

            result = json.loads(json_match.group())

            # Validate required fields
            required_fields = ['score', 'recommendation', 'reasoning', 'strengths', 'concerns']
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")

            # Validate score range
            if not (0 <= result['score'] <= 100):
                raise ValueError(f"Score out of range: {result['score']}")

            # Validate recommendation
            valid_recommendations = ['strong_accept', 'accept', 'maybe', 'reject']
            if result['recommendation'] not in valid_recommendations:
                raise ValueError(f"Invalid recommendation: {result['recommendation']}")

            return result

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Response validation failed: {str(e)}")
```

### 3.3 API Endpoint Integration

**File**: `backend/app/api/screening.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.applicant import Applicant
from app.models.screening_result import ScreeningResult
from app.core.auth import get_current_user, require_role, UserRole
from app.agents.screening_agent import ScreeningAgent

router = APIRouter()

@router.post("/screen/{applicant_id}")
async def screen_applicant(
    applicant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    """
    Screen an applicant using AI.

    Requires admin or program_manager role.

    Returns:
        ScreeningResult with score, recommendation, reasoning, etc.
    """
    # Fetch applicant
    result = await db.execute(
        select(Applicant).where(Applicant.id == applicant_id)
    )
    applicant = result.scalar_one_or_none()

    if not applicant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Applicant not found"
        )

    # Prepare applicant data for AI
    applicant_data = {
        "name": applicant.name,
        "email": applicant.email,
        "role": applicant.role,
        "years_of_experience": applicant.years_of_experience,
        "skills": applicant.skills,
        "interests": applicant.interests,
        "github_url": applicant.github_url,
        "portfolio_url": applicant.portfolio_url,
        "cover_letter": applicant.cover_letter,
    }

    # Run screening agent
    try:
        agent = ScreeningAgent()
        evaluation = await agent.screen_applicant(applicant_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Screening failed: {str(e)}"
        )

    # Save screening result
    screening_result = ScreeningResult(
        applicant_id=applicant.id,
        score=evaluation["score"],
        recommendation=evaluation["recommendation"],
        reasoning=evaluation["reasoning"],
        strengths=evaluation["strengths"],
        concerns=evaluation["concerns"]
    )

    db.add(screening_result)
    await db.commit()
    await db.refresh(screening_result)

    return screening_result
```

### 3.4 Example Output

**Input**:
```json
{
  "name": "Alice Johnson",
  "role": "fullstack_engineer",
  "years_of_experience": 2,
  "skills": ["Python", "React", "PostgreSQL", "Docker"],
  "interests": ["Web Development", "DevOps", "Open Source"],
  "github_url": "https://github.com/alicejohnson",
  "portfolio_url": "https://alicejohnson.dev",
  "cover_letter": "I am passionate about building web applications..."
}
```

**Output**:
```json
{
  "score": 82,
  "recommendation": "accept",
  "reasoning": "Alice demonstrates strong technical fundamentals with 2 years of hands-on experience in fullstack development. Her GitHub profile shows consistent contributions to open-source projects and several well-documented personal projects, including a full-stack e-commerce application using React and Django. The portfolio website showcases clean code architecture and attention to UI/UX details.\n\nHer cover letter articulates clear learning goals and genuine interest in deepening her DevOps knowledge, which aligns well with the program curriculum. The combination of frontend (React) and backend (Python) skills with database and containerization experience indicates solid fullstack capabilities.\n\nWhile her experience level is relatively early career, the quality of her projects and demonstrated learning trajectory suggest strong potential for growth in the program. Her commitment to open source and collaborative development is a positive indicator for program fit.",
  "strengths": [
    "Strong fullstack foundation with React, Python, and PostgreSQL",
    "Active GitHub profile with quality open-source contributions",
    "Well-designed portfolio demonstrating practical project experience",
    "Clear communication and articulated learning goals",
    "Experience with modern development tools (Docker, Git)"
  ],
  "concerns": [
    "Limited professional experience (2 years) compared to some applicants",
    "DevOps skills appear to be mostly theoretical from online courses",
    "No mention of experience working in agile teams or collaborative environments"
  ]
}
```

---

## 4. Delivery Agent

### 4.1 Purpose

**Objective**: Generate personalized learning and project delivery plans for accepted fellows.

**Inputs**:
- Fellow profile (skills, interests, goals)
- Cohort duration and requirements
- Preferences (learning style, focus areas)

**Outputs**:
- Structured delivery plan with milestones
- Week-by-week breakdown
- Project ideas and resources
- Assessment criteria

### 4.2 Implementation

**File**: `backend/app/agents/delivery_agent.py`

```python
import os
import json
import anthropic
from typing import Dict, Any, List

class DeliveryAgent:
    """AI agent for generating personalized delivery plans."""

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.model = "claude-sonnet-4-20250514"

    async def generate_plan(
        self,
        fellow_data: Dict[str, Any],
        preferences: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate a personalized delivery plan.

        Args:
            fellow_data: Fellow profile information
            preferences: Optional preferences for plan customization

        Returns:
            Structured delivery plan with milestones
        """
        system_prompt = self._get_system_prompt()
        user_prompt = self._construct_user_prompt(fellow_data, preferences or {})

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,  # Longer for detailed plans
                temperature=0.7,  # Some creativity for project ideas
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            result_text = response.content[0].text
            result = self._parse_response(result_text)

            return result

        except Exception as e:
            raise Exception(f"Plan generation failed: {str(e)}")

    def _get_system_prompt(self) -> str:
        """Get system prompt for delivery planning."""
        return """You are an expert learning curriculum designer with experience creating personalized software engineering learning paths.

Your responsibilities:
1. Design structured, progressive learning plans
2. Balance theory with hands-on project work
3. Adapt to individual skill levels and goals
4. Include concrete milestones and deliverables
5. Provide relevant learning resources
6. Ensure realistic timelines

Output Format:
Respond with a JSON object:
{
  "title": "<plan title>",
  "description": "<2-3 sentence overview>",
  "duration_weeks": <integer>,
  "milestones": [
    {
      "week": <integer>,
      "title": "<milestone title>",
      "description": "<what to accomplish>",
      "tasks": ["<task1>", "<task2>", ...],
      "deliverables": ["<deliverable1>", ...],
      "resources": ["<resource1>", ...]
    },
    ...
  ],
  "final_project": {
    "title": "<project title>",
    "description": "<project description>",
    "requirements": ["<req1>", "<req2>", ...],
    "assessment_criteria": ["<criteria1>", ...]
  }
}
"""

    def _construct_user_prompt(self, fellow: Dict[str, Any], prefs: Dict[str, Any]) -> str:
        """Construct user prompt with fellow data."""
        return f"""Create a personalized learning and delivery plan for the following fellow.

FELLOW PROFILE
==============
Name: {fellow.get('name')}
Current Skills: {', '.join(fellow.get('skills', []))}
Interests: {', '.join(fellow.get('interests', []))}
Background: {fellow.get('bio', 'Not provided')}

PREFERENCES
===========
Duration: {prefs.get('duration_weeks', 12)} weeks
Focus Areas: {', '.join(prefs.get('focus_areas', ['General Fullstack']))}
Learning Style: {prefs.get('learning_style', 'Project-based')}
Goals: {prefs.get('goals', 'Build production-ready projects and job skills')}

PROGRAM STRUCTURE
=================
- Weekly milestones with clear deliverables
- Balance of learning and building
- Progressive difficulty
- Final capstone project
- Regular check-ins and assessments

Please generate a comprehensive delivery plan.
"""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and validate delivery plan."""
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in response")

        result = json.loads(json_match.group())

        # Validate structure
        required_fields = ['title', 'description', 'duration_weeks', 'milestones', 'final_project']
        for field in required_fields:
            if field not in result:
                raise ValueError(f"Missing required field: {field}")

        return result
```

### 4.3 Example Output

**Output**:
```json
{
  "title": "Fullstack Web Development Journey",
  "description": "A 12-week intensive program to build production-ready fullstack applications using Python/FastAPI backend and React frontend, culminating in a deployable SaaS product.",
  "duration_weeks": 12,
  "milestones": [
    {
      "week": 1,
      "title": "Python & FastAPI Fundamentals",
      "description": "Master Python basics and build your first REST API",
      "tasks": [
        "Complete Python fundamentals (data types, functions, OOP)",
        "Build a basic CRUD API with FastAPI",
        "Learn async/await patterns",
        "Write unit tests with pytest"
      ],
      "deliverables": [
        "Simple task management API with 5 endpoints",
        "Test suite with 80%+ coverage"
      ],
      "resources": [
        "FastAPI Documentation (fastapi.tiangolo.com)",
        "Real Python tutorials",
        "Python Testing with pytest (book)"
      ]
    },
    {
      "week": 2,
      "title": "Database Design & ORM",
      "description": "Design relational databases and integrate with SQLAlchemy",
      "tasks": [
        "Learn database design principles (normalization, relationships)",
        "Set up PostgreSQL and practice SQL queries",
        "Integrate SQLAlchemy ORM with FastAPI",
        "Implement database migrations with Alembic"
      ],
      "deliverables": [
        "Enhanced API with PostgreSQL integration",
        "ER diagram for your domain model",
        "Migration scripts for schema versioning"
      ],
      "resources": [
        "PostgreSQL Tutorial",
        "SQLAlchemy Documentation",
        "Designing Data-Intensive Applications (ch 1-3)"
      ]
    },
    {
      "week": 3,
      "title": "Authentication & Security",
      "description": "Implement secure user authentication with JWT",
      "tasks": [
        "Understand JWT and OAuth2 flows",
        "Implement password hashing with bcrypt",
        "Create login/signup endpoints",
        "Add role-based access control"
      ],
      "deliverables": [
        "Complete authentication system",
        "Protected API endpoints",
        "Security documentation"
      ],
      "resources": [
        "OWASP Security Guidelines",
        "FastAPI Security docs",
        "JWT.io"
      ]
    },
    {
      "week": 4,
      "title": "React Fundamentals",
      "description": "Build interactive UIs with React and hooks",
      "tasks": [
        "Learn React components, props, and state",
        "Master hooks (useState, useEffect, useContext)",
        "Practice component composition",
        "Build reusable UI components"
      ],
      "deliverables": [
        "React component library (Button, Card, Form, Table)",
        "Interactive todo list app",
        "Component documentation"
      ],
      "resources": [
        "React Official Docs",
        "React Hooks in Action (book)",
        "Component Patterns blog series"
      ]
    }
    // ... weeks 5-11 continue
  ],
  "final_project": {
    "title": "SaaS Application MVP",
    "description": "Build and deploy a complete SaaS product with user authentication, payment integration, and core features. Examples: project management tool, CRM, marketplace, booking system.",
    "requirements": [
      "FastAPI backend with PostgreSQL database",
      "React frontend with modern UI/UX",
      "User authentication and authorization",
      "At least 3 core features fully implemented",
      "Deployed to cloud (Heroku, AWS, or Digital Ocean)",
      "Comprehensive README and documentation",
      "Test coverage > 70%"
    ],
    "assessment_criteria": [
      "Code quality and architecture",
      "Feature completeness and UX",
      "Database design and optimization",
      "Security best practices",
      "Deployment and DevOps",
      "Documentation and presentation"
    ]
  }
}
```

---

## 5. Placement Agent

### 5.1 Purpose

**Objective**: Match fellows with job opportunities based on skills, interests, and job requirements.

**Inputs**:
- Fellow profile (skills, experience, preferences)
- Opportunity details (requirements, company, role)

**Outputs**:
- Match score (0-100)
- Reasoning for match
- Strengths alignment
- Gaps to address

### 5.2 Implementation Sketch

```python
class PlacementAgent:
    """AI agent for fellow-opportunity matching."""

    async def match_fellow_to_opportunities(
        self,
        fellow_data: Dict[str, Any],
        opportunities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Match a fellow to multiple opportunities.

        Returns list of matches sorted by score.
        """
        system_prompt = """You are an expert technical recruiter specializing in matching candidates with job opportunities.

Analyze the candidate's profile and each opportunity to determine fit based on:
- Technical skills alignment
- Experience level match
- Interest alignment
- Growth potential
- Company/role fit

For each opportunity, respond with JSON:
{
  "opportunity_id": "<id>",
  "match_score": <0-100>,
  "reasoning": "<explanation>",
  "alignment": ["<strength1>", ...],
  "gaps": ["<gap1>", ...]
}
"""

        user_prompt = f"""Match the following fellow to these opportunities.

FELLOW PROFILE
==============
Skills: {fellow_data.get('skills')}
Interests: {fellow_data.get('interests')}
Experience: {fellow_data.get('bio')}

OPPORTUNITIES
=============
{self._format_opportunities(opportunities)}

Provide matching analysis for each opportunity.
"""

        # Call Claude and parse results
        # Return sorted matches
```

---

## 6. Prompt Engineering Best Practices

### 6.1 Clear Role Definition

✅ **Good**:
```
You are an expert technical recruiter with 10+ years of experience evaluating software engineering candidates.
```

❌ **Bad**:
```
You are helpful.
```

### 6.2 Structured Output

✅ **Good**:
```
Respond ONLY with valid JSON:
{
  "score": <integer 0-100>,
  "recommendation": "<strong_accept|accept|maybe|reject>"
}
```

❌ **Bad**:
```
Give me your evaluation.
```

### 6.3 Specific Instructions

✅ **Good**:
```
Evaluate based on:
1. Technical skills (weight: 40%)
2. Project quality (weight: 30%)
3. Communication (weight: 20%)
4. Motivation (weight: 10%)
```

❌ **Bad**:
```
Evaluate the candidate.
```

### 6.4 Examples (Few-Shot Learning)

```
Here are examples of good evaluations:

Example 1:
Input: [candidate with strong GitHub, 5 years exp, great projects]
Output: {"score": 95, "recommendation": "strong_accept", ...}

Example 2:
Input: [candidate with no projects, minimal experience]
Output: {"score": 45, "recommendation": "reject", ...}

Now evaluate this candidate:
[actual candidate data]
```

### 6.5 Temperature Settings

- **Low (0.0-0.3)**: Deterministic, consistent (screening, classification)
- **Medium (0.4-0.7)**: Balanced (delivery plans, creative content)
- **High (0.8-1.0)**: Creative, diverse (brainstorming, ideation)

---

## 7. Error Handling & Retry Logic

### 7.1 API Error Handling

```python
from anthropic import APIError, RateLimitError, APITimeoutError
import time

async def call_claude_with_retry(
    client: anthropic.Anthropic,
    max_retries: int = 3,
    **kwargs
) -> Any:
    """Call Claude API with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            response = await client.messages.create(**kwargs)
            return response

        except RateLimitError as e:
            # Rate limit hit, wait and retry
            wait_time = 2 ** attempt  # Exponential backoff
            print(f"Rate limited. Waiting {wait_time}s before retry...")
            time.sleep(wait_time)

        except APITimeoutError as e:
            # Timeout, retry
            print(f"API timeout. Retrying... (attempt {attempt + 1})")

        except APIError as e:
            # Other API error
            if attempt == max_retries - 1:
                raise
            print(f"API error: {e}. Retrying...")

    raise Exception("Max retries exceeded")
```

### 7.2 Response Validation

```python
def validate_screening_result(result: dict) -> None:
    """Validate screening result structure."""
    # Check required fields
    required = ['score', 'recommendation', 'reasoning', 'strengths', 'concerns']
    for field in required:
        if field not in result:
            raise ValueError(f"Missing field: {field}")

    # Validate score range
    if not isinstance(result['score'], int) or not (0 <= result['score'] <= 100):
        raise ValueError(f"Invalid score: {result['score']}")

    # Validate recommendation
    valid_recs = ['strong_accept', 'accept', 'maybe', 'reject']
    if result['recommendation'] not in valid_recs:
        raise ValueError(f"Invalid recommendation: {result['recommendation']}")

    # Validate lists
    if not isinstance(result['strengths'], list):
        raise ValueError("strengths must be a list")
    if not isinstance(result['concerns'], list):
        raise ValueError("concerns must be a list")
```

### 7.3 Fallback Strategies

```python
async def screen_applicant_with_fallback(applicant_data: dict) -> dict:
    """Screen applicant with fallback to default if AI fails."""
    try:
        # Try AI screening
        agent = ScreeningAgent()
        return await agent.screen_applicant(applicant_data)

    except Exception as e:
        # Log error
        print(f"AI screening failed: {e}")

        # Fallback to rule-based screening
        return {
            "score": calculate_rule_based_score(applicant_data),
            "recommendation": "manual_review_required",
            "reasoning": f"AI screening unavailable. Manual review needed. Error: {str(e)}",
            "strengths": [],
            "concerns": ["AI evaluation failed - requires manual review"]
        }

def calculate_rule_based_score(data: dict) -> int:
    """Simple rule-based scoring as fallback."""
    score = 50  # Base score

    # Add points for skills
    score += min(len(data.get('skills', [])) * 5, 20)

    # Add points for experience
    score += min(data.get('years_of_experience', 0) * 5, 20)

    # Add points for GitHub/portfolio
    if data.get('github_url'):
        score += 5
    if data.get('portfolio_url'):
        score += 5

    return min(score, 100)
```

---

## Summary (Part 5)

This part covered **AI agents and workflows**:

✅ AI agent architecture (3 agents, structured output)
✅ Anthropic Claude integration (API setup, system/user prompts)
✅ Screening agent (detailed implementation, example outputs)
✅ Delivery agent (learning plan generation)
✅ Placement agent (fellow-opportunity matching)
✅ Prompt engineering best practices (role definition, structured output)
✅ Error handling & retry logic (API errors, validation, fallbacks)

**Next in Part 6**: Deployment & Production Readiness
- Docker deployment
- Environment configuration
- Database setup
- Monitoring and logging
- Security hardening
- Performance optimization
- Backup and disaster recovery

---

**Navigation**:
- Part 1 - System Overview & Architecture ✓
- Part 2 - Authentication Flow Deep Dive ✓
- Part 3 - Backend APIs & Database ✓
- Part 4 - Frontend Components & State Management ✓
- **Current**: Part 5 - AI Agents & Workflows ✓
- **Next**: Part 6 - Deployment & Production Readiness
