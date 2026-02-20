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
from app.models.sprint import Sprint, SprintStatus
from app.models.risk_assessment import RiskAssessment
from app.models.warning import Warning, WarningLevel
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

        # Daily 6 PM: Detect attendance patterns (3+ absences, 5+ late, declining trend)
        self.scheduler.add_job(
            self.detect_attendance_patterns,
            CronTrigger(hour=18, minute=30),
            id="detect_attendance_patterns",
            name="Attendance Pattern Detection",
            replace_existing=True
        )

        # Daily 11 AM: Auto-escalate warnings for persistent at-risk fellows
        self.scheduler.add_job(
            self.auto_escalate_warnings,
            CronTrigger(hour=11, minute=0),
            id="auto_escalate_warnings",
            name="Auto-Escalate Warnings",
            replace_existing=True
        )

        # Daily 7 AM: Flag low sprint completion scores
        self.scheduler.add_job(
            self.flag_sprint_completion,
            CronTrigger(hour=7, minute=0),
            id="flag_sprint_completion",
            name="Sprint Completion Flagging",
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

                        # Fellows with active emergency absence get approved_absence
                        if fellow.emergency_absence_until and fellow.emergency_absence_until > meeting.scheduled_at:
                            db.add(Attendance(
                                meeting_id=meeting.id,
                                fellow_id=fellow.id,
                                status=AttendanceStatus.APPROVED_ABSENCE,
                            ))
                        else:
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


    async def detect_attendance_patterns(self):
        """
        Daily 6:30 PM: Detect concerning attendance patterns for active fellows.
        - 3+ absences in last 2 weeks → HIGH severity alert
        - 5+ late/very_late in last 2 weeks → MEDIUM severity alert
        - Declining attendance trend (last 2 weeks worse than prior 2 weeks) → MEDIUM alert
        Creates in-app notifications for ops/mentors.
        """
        logger.info("Running attendance pattern detection...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy.orm import selectinload
                from sqlalchemy import func as sqlfunc
                from app.services.notification_service import create_notification

                two_weeks_ago = datetime.utcnow() - timedelta(days=14)
                four_weeks_ago = datetime.utcnow() - timedelta(days=28)

                result = await db.execute(
                    select(Fellow)
                    .options(selectinload(Fellow.applicant))
                    .where(Fellow.status == 'active')
                )
                fellows = result.scalars().all()

                alerts_created = 0
                for fellow in fellows:
                    # Skip fellows with active emergency absence
                    if fellow.emergency_absence_until and fellow.emergency_absence_until > datetime.utcnow():
                        continue

                    name = fellow.applicant.name if fellow.applicant else "Unknown"

                    # Get attendance in last 2 weeks
                    att_result = await db.execute(
                        select(Attendance)
                        .join(Meeting)
                        .where(Attendance.fellow_id == fellow.id)
                        .where(Meeting.scheduled_at >= two_weeks_ago)
                    )
                    recent = att_result.scalars().all()

                    absences = sum(1 for a in recent if (a.status.value if hasattr(a.status, 'value') else a.status) == 'absent')
                    lates = sum(1 for a in recent if (a.status.value if hasattr(a.status, 'value') else a.status) in ('late', 'very_late'))

                    # 3+ absences → HIGH
                    if absences >= 3:
                        await create_notification(
                            db, type="risk_alert",
                            title=f"HIGH: {name} — {absences} absences in 2 weeks",
                            message=f"{name} has {absences} absences in the last 14 days. Immediate review recommended.",
                            action_url="/risk",
                        )
                        alerts_created += 1

                    # 5+ late → MEDIUM
                    if lates >= 5:
                        await create_notification(
                            db, type="risk_alert",
                            title=f"MEDIUM: {name} — {lates} late arrivals in 2 weeks",
                            message=f"{name} has been late {lates} times in the last 14 days.",
                            action_url="/risk",
                        )
                        alerts_created += 1

                    # Declining trend: compare last 2 weeks vs prior 2 weeks
                    prior_result = await db.execute(
                        select(Attendance)
                        .join(Meeting)
                        .where(Attendance.fellow_id == fellow.id)
                        .where(Meeting.scheduled_at >= four_weeks_ago)
                        .where(Meeting.scheduled_at < two_weeks_ago)
                    )
                    prior = prior_result.scalars().all()

                    if len(recent) >= 3 and len(prior) >= 3:
                        score_map = {'present': 1.0, 'late': 0.8, 'very_late': 0.5, 'absent': 0.0, 'approved_absence': 0.7}
                        recent_avg = sum(score_map.get(a.status.value if hasattr(a.status, 'value') else a.status, 0.5) for a in recent) / len(recent)
                        prior_avg = sum(score_map.get(a.status.value if hasattr(a.status, 'value') else a.status, 0.5) for a in prior) / len(prior)

                        if prior_avg - recent_avg > 0.15:
                            await create_notification(
                                db, type="risk_alert",
                                title=f"MEDIUM: {name} — declining attendance trend",
                                message=f"Attendance score dropped from {prior_avg:.0%} to {recent_avg:.0%} over the last 2 weeks.",
                                action_url="/risk",
                            )
                            alerts_created += 1

                logger.info(f"Attendance pattern detection: {alerts_created} alert(s) created for {len(fellows)} fellows")

            except Exception as e:
                logger.error(f"Error in detect_attendance_patterns: {str(e)}")

    async def auto_escalate_warnings(self):
        """
        Daily 11 AM: Auto-generate warning drafts for persistent at-risk fellows.
        - 2+ consecutive weeks AT_RISK → auto-generate first warning draft
        - 2+ consecutive weeks CRITICAL → auto-generate final warning draft
        Only creates a warning if one doesn't already exist for that level.
        """
        logger.info("Running auto-escalation for persistent at-risk fellows...")

        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy.orm import selectinload
                from app.services.notification_service import create_notification

                result = await db.execute(
                    select(Fellow)
                    .options(selectinload(Fellow.applicant))
                    .where(Fellow.current_risk_level.in_(["at_risk", "critical"]))
                )
                fellows = result.scalars().all()

                warnings_created = 0
                for fellow in fellows:
                    # Skip fellows with active emergency absence
                    if fellow.emergency_absence_until and fellow.emergency_absence_until > datetime.utcnow():
                        continue

                    name = fellow.applicant.name if fellow.applicant else "Unknown"

                    # Get last 3 risk assessments ordered by week
                    risk_result = await db.execute(
                        select(RiskAssessment)
                        .where(RiskAssessment.fellow_id == fellow.id)
                        .order_by(RiskAssessment.week.desc())
                        .limit(3)
                    )
                    assessments = risk_result.scalars().all()

                    if len(assessments) < 2:
                        continue

                    # Check for 2+ consecutive weeks at same level
                    levels = [a.risk_level if isinstance(a.risk_level, str) else a.risk_level.value for a in assessments[:2]]

                    if all(l == "at_risk" for l in levels):
                        target_level = WarningLevel.FIRST
                    elif all(l == "critical" for l in levels):
                        target_level = WarningLevel.FINAL
                    else:
                        continue

                    # Check if warning at this level already exists
                    existing = await db.execute(
                        select(Warning.id)
                        .where(Warning.fellow_id == fellow.id)
                        .where(Warning.level == target_level)
                    )
                    if existing.scalar_one_or_none():
                        continue

                    # Create warning draft
                    if target_level == WarningLevel.FIRST:
                        concerns = [
                            f"Fellow has been at-risk for 2+ consecutive weeks",
                            f"Current risk level: {fellow.current_risk_level}",
                        ]
                        requirements = [
                            "Attend all scheduled meetings for the next 2 weeks",
                            "Submit all check-ins on time",
                            "Meet with mentor to discuss improvement plan",
                        ]
                        draft = f"Dear {name},\n\nThis is a first warning regarding your performance in the fellowship program. You have been assessed as at-risk for two consecutive weeks. Please review the requirements below and take immediate action to improve.\n\nRegards,\nMentorLed Team"
                    else:
                        concerns = [
                            f"Fellow has been critical for 2+ consecutive weeks",
                            f"Prior first warning was issued",
                        ]
                        requirements = [
                            "Mandatory daily check-ins for the next week",
                            "Attend all meetings — zero absences tolerated",
                            "Submit improvement plan within 48 hours",
                        ]
                        draft = f"Dear {name},\n\nThis is a final warning regarding your continued critical-level performance. Failure to meet the requirements below may result in removal from the program.\n\nRegards,\nMentorLed Team"

                    warning = Warning(
                        fellow_id=fellow.id,
                        level=target_level,
                        concerns=concerns,
                        requirements=requirements,
                        draft_message=draft,
                        review_deadline=datetime.utcnow() + timedelta(days=7),
                    )
                    db.add(warning)
                    warnings_created += 1

                    await create_notification(
                        db, type="warning_issued",
                        title=f"Auto-generated {target_level.value} warning for {name}",
                        message=f"A {target_level.value} warning draft has been created for {name} due to {len(levels)} consecutive weeks at {levels[0]} level. Review and approve before issuing.",
                        action_url="/delivery",
                    )

                if warnings_created:
                    await db.commit()
                logger.info(f"Auto-escalation: {warnings_created} warning draft(s) created for {len(fellows)} at-risk fellows")

            except Exception as e:
                logger.error(f"Error in auto_escalate_warnings: {str(e)}")

    async def flag_sprint_completion(self):
        """
        Daily 7 AM: Flag sprints with low completion scores.
        - Any completed sprint < 40% → HIGH alert (immediate review)
        - 2 consecutive completed sprints < 60% for same team → HIGH alert (mentor intervention)
        """
        logger.info("Running sprint completion flagging...")

        async with AsyncSessionLocal() as db:
            try:
                from app.services.notification_service import create_notification
                from sqlalchemy.orm import selectinload

                # Get recently completed sprints (last 7 days)
                week_ago = datetime.utcnow() - timedelta(days=7)
                result = await db.execute(
                    select(Sprint)
                    .options(selectinload(Sprint.team))
                    .where(Sprint.status == SprintStatus.COMPLETED)
                    .where(Sprint.updated_at >= week_ago)
                )
                recent_sprints = result.scalars().all()

                alerts = 0
                for sprint in recent_sprints:
                    team_name = sprint.team.name if sprint.team else "Unknown Team"
                    score = float(sprint.completion_score or 0)

                    # Sprint < 40% → HIGH
                    if score < 40:
                        await create_notification(
                            db, type="risk_alert",
                            title=f"HIGH: {team_name} Sprint {sprint.sprint_number} — {score:.0f}% completion",
                            message=f"Sprint {sprint.sprint_number} for {team_name} completed with only {score:.0f}%. Immediate review needed.",
                            action_url="/sprints",
                        )
                        alerts += 1

                # Check for 2 consecutive low sprints per team
                result = await db.execute(
                    select(Sprint)
                    .options(selectinload(Sprint.team))
                    .where(Sprint.status == SprintStatus.COMPLETED)
                    .order_by(Sprint.team_id, Sprint.sprint_number.desc())
                )
                all_completed = result.scalars().all()

                # Group by team
                teams: dict[str, list] = {}
                for s in all_completed:
                    tid = str(s.team_id)
                    if tid not in teams:
                        teams[tid] = []
                    teams[tid].append(s)

                for tid, sprints in teams.items():
                    if len(sprints) < 2:
                        continue
                    # Check last 2 completed sprints
                    last_two = sorted(sprints, key=lambda s: s.sprint_number, reverse=True)[:2]
                    scores = [float(s.completion_score or 0) for s in last_two]
                    if all(sc < 60 for sc in scores):
                        team_name = last_two[0].team.name if last_two[0].team else "Unknown Team"
                        await create_notification(
                            db, type="risk_alert",
                            title=f"HIGH: {team_name} — 2 consecutive sprints below 60%",
                            message=f"Sprints {last_two[1].sprint_number} ({scores[1]:.0f}%) and {last_two[0].sprint_number} ({scores[0]:.0f}%) both below 60%. Mentor intervention recommended.",
                            action_url="/sprints",
                        )
                        alerts += 1

                if alerts:
                    await db.commit()
                logger.info(f"Sprint completion flagging: {alerts} alert(s) created")

            except Exception as e:
                logger.error(f"Error in flag_sprint_completion: {str(e)}")


# Global scheduler instance
scheduler_service = SchedulerService()
