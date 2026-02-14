"""
Email template registry with metadata and sample data for preview rendering.
"""

TEMPLATE_REGISTRY = {
    "evaluation_result": {
        "name": "Evaluation Result",
        "description": "Sent to applicants after AI screening or microship evaluation completes",
        "category": "Screening",
        "default_subject": "MentorLed Application Update",
        "template_file": "evaluation_result.html",
        "variables": [
            {"name": "applicant_name", "type": "string", "description": "Applicant's full name", "sample": "Jane Doe"},
            {"name": "overall_score", "type": "number", "description": "Score out of 100", "sample": 82.5},
            {"name": "eligibility", "type": "string", "description": "Eligibility status: eligible, not_eligible, or review", "sample": "eligible"},
            {"name": "reasoning", "type": "string", "description": "AI evaluation reasoning summary", "sample": "Strong technical background with demonstrated experience in frontend development and design thinking."},
            {"name": "strengths", "type": "list", "description": "List of identified strengths", "sample": ["Strong portfolio with 5+ projects", "Clear communication skills", "Good problem-solving approach"]},
            {"name": "concerns", "type": "list", "description": "List of identified concerns", "sample": ["Limited backend experience", "No team project examples"]},
            {"name": "confidence", "type": "number", "description": "AI confidence score (0-1)", "sample": 0.85},
            {"name": "recommended_action", "type": "string", "description": "Recommended next action", "sample": "accept"},
        ],
    },
    "fellow_warning": {
        "name": "Fellow Warning",
        "description": "Warning sent to fellows about performance concerns requiring action",
        "category": "Delivery",
        "default_subject": "MentorLed: Important Progress Update",
        "template_file": "fellow_warning.html",
        "variables": [
            {"name": "fellow_name", "type": "string", "description": "Fellow's full name", "sample": "John Smith"},
            {"name": "warning_number", "type": "number", "description": "Warning number (1 = first warning, 2 = final warning)", "sample": 1},
            {"name": "message", "type": "string", "description": "Detailed warning message body", "sample": "Your recent check-ins indicate declining engagement and missed deliverables. We want to support you in getting back on track."},
            {"name": "risk_level", "type": "string", "description": "Current risk level assessment", "sample": "at_risk"},
            {"name": "required_actions", "type": "list", "description": "List of required actions", "sample": ["Submit weekly check-in by Friday", "Schedule a 1:1 meeting with your mentor", "Complete outstanding deliverables"]},
            {"name": "consequences", "type": "string", "description": "Consequences if actions are not taken", "sample": "Failure to address these concerns may result in a final warning or removal from the program."},
        ],
    },
    "risk_alert": {
        "name": "Risk Alert",
        "description": "Alert sent to program team when a fellow's risk level requires attention",
        "category": "Delivery",
        "default_subject": "Risk Alert: Fellow Name - AT_RISK",
        "template_file": "risk_alert.html",
        "variables": [
            {"name": "fellow_name", "type": "string", "description": "Fellow's full name", "sample": "Alex Johnson"},
            {"name": "fellow_id", "type": "string", "description": "Fellow's unique ID", "sample": "f47ac10b-58cc-4372-a567-0e02b2c3d479"},
            {"name": "role", "type": "string", "description": "Fellow's role in the program", "sample": "frontend"},
            {"name": "risk_level", "type": "string", "description": "Current risk level", "sample": "critical"},
            {"name": "risk_score", "type": "number", "description": "Numeric risk score (0-100)", "sample": 78.5},
            {"name": "contributing_factors", "type": "object", "description": "Key-value pairs of contributing risk factors", "sample": {"missed_check_ins": 3, "declining_sentiment": -0.4, "no_code_commits": 7}},
            {"name": "ai_concerns", "type": "list", "description": "AI-identified concerns", "sample": ["No check-in submitted for 3 consecutive weeks", "Sentiment declining sharply", "Mentor reports lack of communication"]},
            {"name": "recommended_action", "type": "string", "description": "Recommended action for program team", "sample": "Schedule immediate intervention meeting and consider issuing first warning."},
        ],
    },
    "challenge_activated": {
        "name": "Challenge Activated",
        "description": "Notification sent to cohort applicants when a new challenge becomes active",
        "category": "Challenges",
        "default_subject": "MentorLed: New Challenge Available - Sample Challenge",
        "template_file": "challenge_activated.html",
        "variables": [
            {"name": "applicant_name", "type": "string", "description": "Applicant's full name", "sample": "Sarah Chen"},
            {"name": "challenge_title", "type": "string", "description": "Title of the challenge", "sample": "Frontend Portfolio Review"},
            {"name": "challenge_description", "type": "string", "description": "Description of the challenge", "sample": "Build a responsive portfolio page showcasing your best work. Include at least 3 projects with descriptions."},
            {"name": "role_type", "type": "string", "description": "Target role type for the challenge", "sample": "frontend"},
            {"name": "deadline", "type": "string", "description": "Submission deadline", "sample": "February 15, 2026 at 11:59 PM UTC"},
            {"name": "submission_url", "type": "string", "description": "URL for submitting the challenge", "sample": "https://mentorled.com/submit/abc123"},
            {"name": "duration_hours", "type": "number", "description": "Expected duration in hours", "sample": 48},
            {"name": "requirements", "type": "list", "description": "List of challenge requirements", "sample": ["Responsive design (mobile + desktop)", "At least 3 project showcases", "Clean, semantic HTML", "Deployed to a public URL"]},
        ],
    },
    "deadline_reminder": {
        "name": "Deadline Reminder",
        "description": "Reminder sent to applicants 24 hours before a challenge deadline",
        "category": "Challenges",
        "default_subject": "Reminder: Challenge Title - Deadline in 24h",
        "template_file": "deadline_reminder.html",
        "variables": [
            {"name": "applicant_name", "type": "string", "description": "Applicant's full name", "sample": "Michael Park"},
            {"name": "challenge_title", "type": "string", "description": "Title of the challenge", "sample": "Backend API Design Challenge"},
            {"name": "deadline", "type": "string", "description": "Submission deadline", "sample": "February 15, 2026 at 11:59 PM UTC"},
            {"name": "hours_remaining", "type": "number", "description": "Hours remaining until deadline", "sample": 24},
            {"name": "submission_url", "type": "string", "description": "URL for submitting the challenge", "sample": "https://mentorled.com/submit/xyz789"},
        ],
    },
    "submission_confirmation": {
        "name": "Submission Confirmation",
        "description": "Confirmation sent to applicants after they submit a challenge",
        "category": "Challenges",
        "default_subject": "MentorLed: Submission Received - Challenge Title",
        "template_file": "submission_confirmation.html",
        "variables": [
            {"name": "applicant_name", "type": "string", "description": "Applicant's full name", "sample": "Emily Rodriguez"},
            {"name": "challenge_title", "type": "string", "description": "Title of the challenge", "sample": "Product Design Case Study"},
            {"name": "submitted_at", "type": "string", "description": "Submission timestamp", "sample": "February 14, 2026 at 3:45 PM UTC"},
            {"name": "on_time", "type": "boolean", "description": "Whether submission was on time", "sample": True},
        ],
    },
}


def get_sample_context(template_key: str) -> dict:
    """Build a sample context dict from the registry's sample values."""
    template_info = TEMPLATE_REGISTRY.get(template_key)
    if not template_info:
        return {}
    return {
        var["name"]: var["sample"]
        for var in template_info["variables"]
    }
