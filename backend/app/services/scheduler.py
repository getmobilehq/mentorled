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
from app.models.meeting import Meeting, MeetingStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.services.event_service import event_publisher

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

        # Hourly: Auto-mark absent fellows for completed meetings
        self.scheduler.add_job(
            self.auto_mark_absent_meetings,
            CronTrigger(minute=0),
            id="auto_mark_absent",
            name="Auto-Mark Absent Meetings",
            replace_existing=True
        )

        # Every minute: Manage meeting lock states (unlock/activate/complete)
        self.scheduler.add_job(
            self.manage_meeting_locks,
            CronTrigger(second=0),  # Every minute at :00 seconds
            id="manage_meeting_locks",
            name="Meeting Lock Management",
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
        Send reminder emails for overdue check-ins.
        """
        logger.info("Checking for missing check-ins...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy.orm import selectinload

                # Get active fellows with applicant and cohort
                result = await db.execute(
                    select(Fellow)
                    .options(selectinload(Fellow.applicant), selectinload(Fellow.cohort))
                    .where(Fellow.status == 'active')
                )
                fellows = result.scalars().all()

                missing_count = 0
                reminded_count = 0
                for fellow in fellows:
                    cohort = fellow.cohort
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

                        # Send reminder email
                        if fellow.applicant and fellow.applicant.email:
                            try:
                                await email_service.send_check_in_reminder(
                                    fellow_email=fellow.applicant.email,
                                    fellow_name=fellow.applicant.name or "Fellow",
                                    current_week=current_week,
                                    cohort_name=cohort.name,
                                )
                                reminded_count += 1
                            except Exception as e:
                                logger.error(f"Failed to send check-in reminder to {fellow.applicant.email}: {e}")

                logger.info(f"Found {missing_count} fellows with missing check-ins, sent {reminded_count} reminders")

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
        Weekly task: Generate analytics report and send via Slack.
        """
        logger.info("Generating weekly analytics report...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy import func
                from app.models.risk_assessment import RiskAssessment
                from app.models.warning import Warning
                from app.utils.slack import slack_notifier

                # Count new applicants in last 7 days
                week_ago = datetime.utcnow() - timedelta(days=7)
                new_applicants_result = await db.execute(
                    select(func.count()).select_from(Applicant).where(
                        Applicant.created_at >= week_ago
                    )
                )
                new_applicants = new_applicants_result.scalar() or 0

                # Count evaluations in last 7 days
                from app.models.evaluation import ApplicationEvaluation
                evals_result = await db.execute(
                    select(func.count()).select_from(ApplicationEvaluation).where(
                        ApplicationEvaluation.created_at >= week_ago
                    )
                )
                evaluations_completed = evals_result.scalar() or 0

                # Count high-risk fellows (at_risk or critical)
                high_risk_result = await db.execute(
                    select(func.count()).select_from(Fellow).where(
                        Fellow.current_risk_level.in_(["at_risk", "critical"])
                    )
                )
                high_risk_fellows = high_risk_result.scalar() or 0

                # Count warnings issued in last 7 days
                warnings_result = await db.execute(
                    select(func.count()).select_from(Warning).where(
                        Warning.issued_at >= week_ago,
                        Warning.issued_at.isnot(None),
                    )
                )
                warnings_issued = warnings_result.scalar() or 0

                # Get AI cost for last 7 days
                from app.models.audit_log import AuditLog
                cost_result = await db.execute(
                    select(func.coalesce(func.sum(AuditLog.ai_cost_usd), 0)).where(
                        AuditLog.timestamp >= week_ago
                    )
                )
                ai_cost = float(cost_result.scalar() or 0)

                logger.info(
                    f"Weekly Report: {new_applicants} new applicants, "
                    f"{evaluations_completed} evaluations, {high_risk_fellows} high-risk, "
                    f"{warnings_issued} warnings, ${ai_cost:.2f} AI cost"
                )

                # Send via Slack
                await slack_notifier.notify_daily_summary(
                    new_applicants=new_applicants,
                    evaluations_completed=evaluations_completed,
                    high_risk_fellows=high_risk_fellows,
                    warnings_issued=warnings_issued,
                    ai_cost=ai_cost,
                )

            except Exception as e:
                logger.error(f"Error in weekly_analytics_report: {str(e)}")

    async def weekly_cost_report(self):
        """
        Weekly task: Generate AI cost report and send via Slack.
        """
        logger.info("Generating weekly cost report...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy import func
                from app.models.audit_log import AuditLog
                from app.utils.slack import slack_notifier

                week_ago = datetime.utcnow() - timedelta(days=7)

                # Total cost
                cost_result = await db.execute(
                    select(func.coalesce(func.sum(AuditLog.ai_cost_usd), 0)).where(
                        AuditLog.timestamp >= week_ago
                    )
                )
                total_cost = float(cost_result.scalar() or 0)

                # Total API calls
                calls_result = await db.execute(
                    select(func.count()).select_from(AuditLog).where(
                        AuditLog.timestamp >= week_ago,
                        AuditLog.actor_type == 'ai_agent',
                    )
                )
                total_calls = calls_result.scalar() or 0

                # Total tokens
                tokens_result = await db.execute(
                    select(
                        func.coalesce(func.sum(AuditLog.ai_prompt_tokens), 0),
                        func.coalesce(func.sum(AuditLog.ai_completion_tokens), 0),
                    ).where(AuditLog.timestamp >= week_ago)
                )
                row = tokens_result.one()
                prompt_tokens = int(row[0])
                completion_tokens = int(row[1])

                logger.info(
                    f"Weekly Cost Report: ${total_cost:.4f}, "
                    f"{total_calls} API calls, {prompt_tokens + completion_tokens} tokens"
                )

                # Send Slack summary
                await slack_notifier.send_message(
                    text=f"Weekly AI Cost Report: ${total_cost:.2f} ({total_calls} calls, {prompt_tokens + completion_tokens} tokens)"
                )

            except Exception as e:
                logger.error(f"Error in weekly_cost_report: {str(e)}")

    async def manage_meeting_locks(self):
        """
        Every minute: Transition meeting states.
        - SCHEDULED → UNLOCKED when current time >= unlock_time
        - UNLOCKED → ACTIVE when current time >= scheduled_at
        - ACTIVE → COMPLETED when current time >= scheduled_at + duration (handled by auto_mark_absent hourly)
        """
        async with AsyncSessionLocal() as db:
            try:
                now = datetime.utcnow()

                # 1. Unlock meetings whose unlock_time has passed
                result = await db.execute(
                    select(Meeting)
                    .where(Meeting.status == MeetingStatus.SCHEDULED)
                    .where(Meeting.unlock_time <= now)
                )
                to_unlock = result.scalars().all()
                for meeting in to_unlock:
                    meeting.status = MeetingStatus.UNLOCKED
                    meeting.is_locked = False

                # 2. Activate meetings whose scheduled_at has arrived
                result = await db.execute(
                    select(Meeting)
                    .where(Meeting.status == MeetingStatus.UNLOCKED)
                    .where(Meeting.scheduled_at <= now)
                )
                to_activate = result.scalars().all()
                for meeting in to_activate:
                    meeting.status = MeetingStatus.ACTIVE

                if to_unlock or to_activate:
                    await db.commit()
                    if to_unlock:
                        logger.info(f"Unlocked {len(to_unlock)} meeting(s)")
                        for m in to_unlock:
                            await event_publisher.meeting_unlocked(
                                meeting_id=str(m.id),
                                team_id=str(m.team_id),
                                meeting_type=m.meeting_type if isinstance(m.meeting_type, str) else m.meeting_type.value,
                            )
                    if to_activate:
                        logger.info(f"Activated {len(to_activate)} meeting(s)")

            except Exception as e:
                logger.error(f"Error in manage_meeting_locks: {str(e)}")

    async def auto_mark_absent_meetings(self):
        """
        Hourly task: Mark absent fellows for meetings past 3-hour join window,
        then transition those meetings to COMPLETED status.
        """
        logger.info("Running auto-mark-absent for meetings...")

        async with AsyncSessionLocal() as db:
            try:
                cutoff = datetime.utcnow() - timedelta(hours=3)

                # Find meetings past join window that aren't completed yet
                result = await db.execute(
                    select(Meeting)
                    .where(Meeting.scheduled_at <= cutoff)
                    .where(Meeting.status != MeetingStatus.COMPLETED)
                )
                meetings = result.scalars().all()

                if not meetings:
                    logger.info("No meetings to finalize")
                    return

                total_absent = 0
                for meeting in meetings:
                    # Get all fellows on this team
                    fellows_result = await db.execute(
                        select(Fellow).where(Fellow.team_id == meeting.team_id)
                    )
                    fellows = fellows_result.scalars().all()

                    for fellow in fellows:
                        # Check if attendance already recorded
                        existing = await db.execute(
                            select(Attendance.id)
                            .where(Attendance.meeting_id == meeting.id)
                            .where(Attendance.fellow_id == fellow.id)
                        )
                        if existing.scalar_one_or_none():
                            continue

                        # Mark absent
                        db.add(Attendance(
                            meeting_id=meeting.id,
                            fellow_id=fellow.id,
                            status=AttendanceStatus.ABSENT,
                        ))
                        total_absent += 1

                    # Mark meeting completed
                    meeting.status = MeetingStatus.COMPLETED

                await db.commit()
                logger.info(f"Finalized {len(meetings)} meetings, marked {total_absent} absences")

            except Exception as e:
                logger.error(f"Error in auto_mark_absent_meetings: {str(e)}")


# Global scheduler instance
scheduler_service = SchedulerService()
