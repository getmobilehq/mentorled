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
from app.agents.screening_agent import screening_agent
from app.agents.delivery_agent import DeliveryAgent
from app.utils.email import email_service

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
        Daily task: Run risk assessment for all active fellows.
        Identify fellows who need intervention.
        """
        logger.info("Running daily risk assessment...")

        async with AsyncSessionLocal() as db:
            try:
                # Get all active fellows
                result = await db.execute(
                    select(Fellow).where(Fellow.status == 'active')
                )
                fellows = result.scalars().all()

                high_risk_count = 0
                for fellow in fellows:
                    try:
                        # Get recent check-ins
                        result = await db.execute(
                            select(CheckIn)
                            .where(CheckIn.fellow_id == fellow.id)
                            .order_by(CheckIn.week_number.desc())
                            .limit(4)
                        )
                        check_ins = list(result.scalars().all())

                        # Run risk assessment
                        delivery_agent = DeliveryAgent(db)
                        assessment = await delivery_agent.assess_risk(fellow, check_ins)

                        # Update fellow's risk level
                        fellow.current_risk_level = assessment["risk_level"]

                        # Flag high-risk fellows for human review
                        if assessment["risk_level"] in ["at_risk", "critical"]:
                            high_risk_count += 1
                            logger.warning(f"High risk fellow detected: {fellow.id} - {assessment['risk_level']}")

                    except Exception as e:
                        logger.error(f"Error assessing fellow {fellow.id}: {str(e)}")

                await db.commit()
                logger.info(f"Risk assessment complete. {high_risk_count} high-risk fellows identified")

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
                # Get current week number (simplified)
                current_week = datetime.utcnow().isocalendar()[1]

                # Get active fellows
                result = await db.execute(
                    select(Fellow).where(Fellow.status == 'active')
                )
                fellows = result.scalars().all()

                missing_count = 0
                for fellow in fellows:
                    # Check if check-in exists for current week
                    result = await db.execute(
                        select(CheckIn).where(
                            CheckIn.fellow_id == fellow.id,
                            CheckIn.week_number == current_week
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
