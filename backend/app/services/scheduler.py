"""
Background scheduler for automated tasks using APScheduler.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from datetime import datetime, timedelta

from app.database import AsyncSessionLocal
from app.models.applicant import Applicant
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.challenge import Challenge, ChallengeStatus
from app.models.microship import MicroshipSubmission
from app.models.cohort import Cohort
from app.agents.screening_agent import screening_agent
from app.utils.email import email_service
from app.services.risk_service import RiskDetectionService

logger = logging.getLogger(__name__)

class SchedulerService:
    """Service for managing scheduled background tasks"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self):
        """Start the scheduler with all configured jobs"""
        logger.info("Starting scheduler service...")

        # Daily: Process pending applications (9 AM)
        self.scheduler.add_job(
            self.process_pending_applications,
            CronTrigger(hour=9, minute=0),
            id="daily_process_applications",
            name="Daily Application Processing",
            replace_existing=True
        )

        # Daily: Run risk assessments for all active fellows (10 AM)
        self.scheduler.add_job(
            self.daily_risk_assessment,
            CronTrigger(hour=10, minute=0),
            id="daily_risk_assessment",
            name="Daily Risk Assessment",
            replace_existing=True
        )

        # Daily: Check for missing check-ins (6 PM)
        self.scheduler.add_job(
            self.check_missing_checkins,
            CronTrigger(hour=18, minute=0),
            id="check_missing_checkins",
            name="Check Missing Check-ins",
            replace_existing=True
        )

        # Daily: Check for upcoming challenge deadlines (9:30 AM)
        self.scheduler.add_job(
            self.check_deadline_reminders,
            CronTrigger(hour=9, minute=30),
            id="check_deadline_reminders",
            name="Challenge Deadline Reminders",
            replace_existing=True
        )

        # Weekly: Generate analytics report (Monday 8 AM)
        self.scheduler.add_job(
            self.weekly_analytics_report,
            CronTrigger(day_of_week='mon', hour=8, minute=0),
            id="weekly_analytics",
            name="Weekly Analytics Report",
            replace_existing=True
        )

        # Weekly: Cost tracking report (Friday 5 PM)
        self.scheduler.add_job(
            self.weekly_cost_report,
            CronTrigger(day_of_week='fri', hour=17, minute=0),
            id="weekly_cost_report",
            name="Weekly Cost Report",
            replace_existing=True
        )

        self.scheduler.start()
        logger.info("Scheduler started successfully")

    def shutdown(self):
        """Shutdown the scheduler"""
        logger.info("Shutting down scheduler...")
        self.scheduler.shutdown()

    async def process_pending_applications(self):
        """
        Daily task: Process applications that have been pending for 24+ hours.
        Auto-evaluate applications that are in 'applied' status.
        """
        logger.info("Running daily application processing...")

        async with AsyncSessionLocal() as db:
            try:
                # Get applications that are still in 'applied' status for 24+ hours
                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                result = await db.execute(
                    select(Applicant).where(
                        Applicant.status == 'applied',
                        Applicant.created_at < cutoff_time
                    ).limit(10)  # Process in batches
                )
                applicants = result.scalars().all()

                processed_count = 0
                for applicant in applicants:
                    try:
                        # Prepare data
                        applicant_data = {
                            "name": applicant.name,
                            "email": applicant.email,
                            "role": applicant.role,
                            "portfolio_url": applicant.portfolio_url,
                            "github_url": applicant.github_url,
                            "project_description": applicant.project_description,
                            "time_commitment": applicant.time_commitment
                        }

                        # Run evaluation
                        evaluation = await screening_agent.evaluate_application(
                            applicant_id=applicant.id,
                            applicant_data=applicant_data
                        )

                        # Update status
                        applicant.status = "screening"
                        processed_count += 1

                    except Exception as e:
                        logger.error(f"Error processing applicant {applicant.id}: {str(e)}")

                await db.commit()
                logger.info(f"Processed {processed_count} pending applications")

            except Exception as e:
                logger.error(f"Error in process_pending_applications: {str(e)}")

    async def daily_risk_assessment(self):
        """
        Daily task: Run 7-signal risk assessment for all active fellows.
        Uses RiskDetectionService.assess_cohort_bulk() per cohort.
        """
        logger.info("Running daily risk assessment...")

        async with AsyncSessionLocal() as db:
            try:
                # Get active cohorts
                result = await db.execute(
                    select(Cohort).where(Cohort.status == 'active')
                )
                cohorts = result.scalars().all()

                # Estimate current program week (weeks since cohort start)
                risk_service = RiskDetectionService(db)
                total_assessed = 0
                total_high_risk = 0

                for cohort in cohorts:
                    try:
                        # Calculate current week from cohort start
                        days_elapsed = (datetime.utcnow().date() - cohort.start_date).days
                        current_week = max(1, (days_elapsed // 7) + 1)

                        result = await risk_service.assess_cohort_bulk(cohort.id, current_week)
                        total_assessed += result["assessed"]
                        total_high_risk += result["summary"].get("at_risk", 0) + result["summary"].get("critical", 0)

                        if total_high_risk > 0:
                            logger.warning(
                                f"Cohort {cohort.name}: {total_high_risk} high-risk fellows in week {current_week}"
                            )
                    except Exception as e:
                        logger.error(f"Error assessing cohort {cohort.id}: {str(e)}")

                logger.info(f"Risk assessment complete. {total_assessed} assessed, {total_high_risk} high-risk")

            except Exception as e:
                logger.error(f"Error in daily_risk_assessment: {str(e)}")

    async def check_missing_checkins(self):
        """
        Daily task: Check for fellows who haven't submitted check-ins.
        Send reminders for overdue check-ins.
        """
        logger.info("Checking for missing check-ins...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy.orm import selectinload

                # Get active fellows with their cohort to calculate current week
                result = await db.execute(
                    select(Fellow)
                    .options(selectinload(Fellow.applicant))
                    .where(Fellow.status == 'active')
                )
                fellows = result.scalars().all()

                missing_count = 0
                for fellow in fellows:
                    # Get cohort to calculate program week
                    cohort_result = await db.execute(
                        select(Cohort).where(Cohort.id == fellow.cohort_id)
                    )
                    cohort = cohort_result.scalar_one_or_none()
                    if not cohort:
                        continue

                    days_elapsed = (datetime.utcnow().date() - cohort.start_date).days
                    current_week = max(1, (days_elapsed // 7) + 1)

                    # Check if check-in exists for current week
                    result = await db.execute(
                        select(CheckIn).where(
                            CheckIn.fellow_id == fellow.id,
                            CheckIn.week == current_week
                        )
                    )
                    check_in = result.scalar_one_or_none()

                    if not check_in:
                        missing_count += 1
                        logger.info(f"Fellow {fellow.id} missing check-in for week {current_week}")
                        # TODO: Send reminder email

                logger.info(f"Found {missing_count} fellows with missing check-ins")

            except Exception as e:
                logger.error(f"Error in check_missing_checkins: {str(e)}")

    async def check_deadline_reminders(self):
        """
        Daily task: Send reminder emails for challenges with deadlines in the next 24 hours.
        Only sends to applicants in the challenge's cohort who have NOT yet submitted.
        """
        logger.info("Checking for upcoming challenge deadlines...")

        async with AsyncSessionLocal() as db:
            try:
                now = datetime.utcnow()
                cutoff = now + timedelta(hours=24)

                # Find active challenges with deadlines in the next 24 hours
                result = await db.execute(
                    select(Challenge).where(
                        Challenge.status == ChallengeStatus.ACTIVE.value,
                        Challenge.deadline > now,
                        Challenge.deadline <= cutoff,
                        Challenge.cohort_id.isnot(None),
                    )
                )
                challenges = result.scalars().all()

                if not challenges:
                    logger.info("No challenges with upcoming deadlines found")
                    return

                total_reminders = 0

                for challenge in challenges:
                    hours_remaining = int((challenge.deadline - now).total_seconds() / 3600)
                    deadline_str = challenge.deadline.strftime("%B %d, %Y at %I:%M %p UTC")
                    submission_url = f"/submit/{challenge.share_token}"

                    # Get all applicants in the cohort
                    applicants_result = await db.execute(
                        select(Applicant).where(
                            Applicant.cohort_id == challenge.cohort_id
                        )
                    )
                    applicants = applicants_result.scalars().all()

                    for applicant in applicants:
                        # Check if this applicant already submitted
                        sub_result = await db.execute(
                            select(MicroshipSubmission.id).where(
                                MicroshipSubmission.applicant_id == applicant.id,
                                MicroshipSubmission.challenge_ref == challenge.id,
                                MicroshipSubmission.submitted_at.isnot(None),
                            )
                        )
                        if sub_result.scalar_one_or_none():
                            continue  # Already submitted

                        # Send reminder
                        await email_service.send_deadline_reminder(
                            applicant_email=applicant.email,
                            applicant_name=applicant.name,
                            challenge_title=challenge.title,
                            deadline=deadline_str,
                            hours_remaining=hours_remaining,
                            submission_url=submission_url,
                        )
                        total_reminders += 1

                logger.info(
                    f"Sent {total_reminders} deadline reminder(s) "
                    f"for {len(challenges)} challenge(s)"
                )

            except Exception as e:
                logger.error(f"Error in check_deadline_reminders: {str(e)}")

    async def weekly_analytics_report(self):
        """
        Weekly task: Generate analytics report for program metrics.
        """
        logger.info("Generating weekly analytics report...")

        async with AsyncSessionLocal() as db:
            try:
                # Collect metrics
                applicants_result = await db.execute(select(Applicant))
                fellows_result = await db.execute(select(Fellow))

                total_applicants = len(list(applicants_result.scalars().all()))
                total_fellows = len(list(fellows_result.scalars().all()))

                logger.info(f"Weekly Report: {total_applicants} applicants, {total_fellows} fellows")
                # TODO: Send report email to program team

            except Exception as e:
                logger.error(f"Error in weekly_analytics_report: {str(e)}")

    async def weekly_cost_report(self):
        """
        Weekly task: Generate AI cost report.
        """
        logger.info("Generating weekly cost report...")

        try:
            # TODO: Query audit log for AI usage
            # TODO: Calculate total costs
            # TODO: Send report to admin team

            logger.info("Weekly cost report generated")

        except Exception as e:
            logger.error(f"Error in weekly_cost_report: {str(e)}")


# Global scheduler instance
scheduler_service = SchedulerService()
