"""
Email utility for sending notifications using SMTP and Jinja2 templates.
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from typing import Dict, List, Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Jinja2 environment
template_dir = Path(__file__).parent.parent / "templates" / "emails"
jinja_env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(['html', 'xml'])
)


class EmailService:
    """Service for sending emails with templates"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.enabled = settings.ENABLE_EMAIL

    async def send_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        context: Dict,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        Send an email using a Jinja2 template.

        Args:
            to_email: Recipient email address
            subject: Email subject
            template_name: Name of the template file (e.g., "evaluation_result.html")
            context: Dictionary of variables to pass to the template
            cc: Optional list of CC addresses
            bcc: Optional list of BCC addresses

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.enabled:
            logger.info(f"Email sending is disabled. Would have sent to {to_email}: {subject}")
            return False

        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured. Skipping email send.")
            return False

        try:
            # Render template
            template = jinja_env.get_template(template_name)
            context['subject'] = subject  # Make subject available to template
            html_content = template.render(**context)

            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email

            if cc:
                message["Cc"] = ", ".join(cc)
            if bcc:
                message["Bcc"] = ", ".join(bcc)

            # Add HTML content
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)

            # Send email
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                start_tls=True
            )

            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def send_evaluation_result(
        self,
        applicant_email: str,
        applicant_name: str,
        overall_score: float,
        eligibility: str,
        reasoning: str,
        strengths: Optional[List[str]] = None,
        concerns: Optional[List[str]] = None,
        confidence: Optional[float] = None,
        recommended_action: Optional[str] = None
    ) -> bool:
        """Send application evaluation result email"""
        subject = "MentorLed Application Update"

        context = {
            "applicant_name": applicant_name,
            "overall_score": round(overall_score, 1),
            "eligibility": eligibility,
            "reasoning": reasoning,
            "strengths": strengths or [],
            "concerns": concerns or [],
            "confidence": confidence,
            "recommended_action": recommended_action
        }

        return await self.send_email(
            to_email=applicant_email,
            subject=subject,
            template_name="evaluation_result.html",
            context=context
        )

    async def send_fellow_warning(
        self,
        fellow_email: str,
        fellow_name: str,
        warning_number: int,
        message: str,
        risk_level: Optional[str] = None,
        required_actions: Optional[List[str]] = None,
        consequences: Optional[str] = None
    ) -> bool:
        """Send warning email to fellow"""
        if warning_number == 1:
            subject = "MentorLed: Important Progress Update"
        elif warning_number == 2:
            subject = "MentorLed: Final Warning - Immediate Action Required"
        else:
            subject = "MentorLed: Progress Notice"

        context = {
            "fellow_name": fellow_name,
            "warning_number": warning_number,
            "message": message,
            "risk_level": risk_level,
            "required_actions": required_actions or [],
            "consequences": consequences
        }

        return await self.send_email(
            to_email=fellow_email,
            subject=subject,
            template_name="fellow_warning.html",
            context=context
        )

    async def send_risk_alert(
        self,
        fellow_id: str,
        fellow_name: str,
        role: str,
        risk_level: str,
        risk_score: float,
        contributing_factors: Dict,
        ai_concerns: List[str],
        recommended_action: str,
        team_emails: List[str]
    ) -> bool:
        """Send risk alert to program team"""
        subject = f"Risk Alert: {fellow_name} - {risk_level.upper()}"

        context = {
            "fellow_id": fellow_id,
            "fellow_name": fellow_name,
            "role": role,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "contributing_factors": contributing_factors,
            "ai_concerns": ai_concerns,
            "recommended_action": recommended_action
        }

        # Send to all team members
        success = True
        for email in team_emails:
            result = await self.send_email(
                to_email=email,
                subject=subject,
                template_name="risk_alert.html",
                context=context
            )
            success = success and result

        return success


# Global email service instance
email_service = EmailService()
