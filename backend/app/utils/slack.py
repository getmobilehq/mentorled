"""
Slack notification utility for sending alerts to Slack channels.
"""
import aiohttp
import logging
from typing import Dict, List, Optional
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


class SlackNotifier:
    """Service for sending notifications to Slack via webhooks"""

    def __init__(self):
        self.webhook_url = settings.SLACK_WEBHOOK_URL
        self.enabled = settings.ENABLE_SLACK_NOTIFICATIONS
        self.mention_user = settings.SLACK_MENTION_USER

    async def send_message(
        self,
        text: str,
        blocks: Optional[List[Dict]] = None,
        channel: Optional[str] = None
    ) -> bool:
        """
        Send a message to Slack.

        Args:
            text: Plain text message (fallback for notifications)
            blocks: Rich message blocks (Slack Block Kit format)
            channel: Optional channel override

        Returns:
            bool: True if message sent successfully
        """
        if not self.enabled:
            logger.info(f"Slack notifications disabled. Would have sent: {text}")
            return False

        if not self.webhook_url:
            logger.warning("Slack webhook URL not configured. Skipping notification.")
            return False

        payload = {"text": text}

        if blocks:
            payload["blocks"] = blocks

        if channel:
            payload["channel"] = channel

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=payload) as response:
                    if response.status == 200:
                        logger.info(f"Slack message sent successfully: {text[:50]}...")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Slack API error: {response.status} - {error_text}")
                        return False

        except Exception as e:
            logger.error(f"Failed to send Slack message: {str(e)}")
            return False

    async def notify_high_risk_fellow(
        self,
        fellow_id: str,
        fellow_name: str,
        role: str,
        risk_level: str,
        risk_score: float,
        concerns: List[str]
    ) -> bool:
        """Send alert for high-risk fellow detection"""

        emoji = "🔴" if risk_level == "critical" else "⚠️"
        text = f"{emoji} High Risk Fellow Alert: {fellow_name}"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} High Risk Fellow Detected"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Fellow:*\n{fellow_name}"},
                    {"type": "mrkdwn", "text": f"*Role:*\n{role}"},
                    {"type": "mrkdwn", "text": f"*Risk Level:*\n{risk_level.upper()}"},
                    {"type": "mrkdwn", "text": f"*Risk Score:*\n{risk_score:.2f}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Concerns:*\n" + "\n".join([f"• {c}" for c in concerns])
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Fellow ID: `{fellow_id}` | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
                    }
                ]
            }
        ]

        if self.mention_user:
            blocks.insert(1, {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"<@{self.mention_user}> Please review this fellow immediately."
                }
            })

        return await self.send_message(text, blocks)

    async def notify_application_batch_complete(
        self,
        batch_size: int,
        eligible: int,
        not_eligible: int,
        requires_review: int
    ) -> bool:
        """Send notification when bulk application processing completes"""

        text = f"✅ Batch Processing Complete: {batch_size} applications evaluated"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✅ Batch Processing Complete"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"Processed *{batch_size}* applications"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Eligible:*\n{eligible}"},
                    {"type": "mrkdwn", "text": f"*Not Eligible:*\n{not_eligible}"},
                    {"type": "mrkdwn", "text": f"*Requires Review:*\n{requires_review}"}
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
                    }
                ]
            }
        ]

        return await self.send_message(text, blocks)

    async def notify_warning_issued(
        self,
        fellow_name: str,
        warning_number: int,
        message: str,
        risk_level: str
    ) -> bool:
        """Send notification when a warning is issued to a fellow"""

        emoji = "⚠️" if warning_number == 1 else "🔴"
        text = f"{emoji} Warning #{warning_number} issued to {fellow_name}"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} Warning #{warning_number} Issued"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Fellow:*\n{fellow_name}"},
                    {"type": "mrkdwn", "text": f"*Warning Number:*\n{warning_number}"},
                    {"type": "mrkdwn", "text": f"*Risk Level:*\n{risk_level}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Message Preview:*\n_{message[:200]}..._"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
                    }
                ]
            }
        ]

        return await self.send_message(text, blocks)

    async def notify_daily_summary(
        self,
        new_applicants: int,
        evaluations_completed: int,
        high_risk_fellows: int,
        warnings_issued: int,
        ai_cost: float
    ) -> bool:
        """Send daily summary notification"""

        text = f"📊 Daily Summary: {new_applicants} new applicants, {evaluations_completed} evaluations"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 Daily Summary Report"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*New Applicants:*\n{new_applicants}"},
                    {"type": "mrkdwn", "text": f"*Evaluations Completed:*\n{evaluations_completed}"},
                    {"type": "mrkdwn", "text": f"*High Risk Fellows:*\n{high_risk_fellows}"},
                    {"type": "mrkdwn", "text": f"*Warnings Issued:*\n{warnings_issued}"},
                    {"type": "mrkdwn", "text": f"*AI Cost (24h):*\n${ai_cost:.2f}"}
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Report for {datetime.utcnow().strftime('%Y-%m-%d')}"
                    }
                ]
            }
        ]

        return await self.send_message(text, blocks)

    async def notify_applicant_accepted(
        self,
        applicant_name: str,
        role: str,
        score: float
    ) -> bool:
        """Send notification when an applicant is accepted"""

        text = f"🎉 New Acceptance: {applicant_name} ({role})"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🎉 New Applicant Accepted!"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Name:*\n{applicant_name}"},
                    {"type": "mrkdwn", "text": f"*Role:*\n{role}"},
                    {"type": "mrkdwn", "text": f"*Score:*\n{score}/100"}
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
                    }
                ]
            }
        ]

        return await self.send_message(text, blocks)


# Global Slack notifier instance
slack_notifier = SlackNotifier()
