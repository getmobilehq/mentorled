"""
Seed script to populate database with sample data for development/testing.
"""
import asyncio
import sys
import random
from pathlib import Path

# Add backend to path
# Works both from host (scripts/../backend) and container (/app)
backend_path = Path(__file__).parent.parent / "backend"
if not backend_path.exists():
    # Running in Docker container, use /app
    backend_path = Path("/app")
sys.path.insert(0, str(backend_path))

from datetime import date, datetime, timedelta
from app.database import AsyncSessionLocal
from app.models.cohort import Cohort
from app.models.mentor import Mentor
from app.models.applicant import Applicant
from app.models.microship import MicroshipSubmission
from app.models.challenge import Challenge
from app.models.challenge_track_config import ChallengeTrackConfig
from app.models.team import Team
from app.models.fellow import Fellow
from app.models.sprint import Sprint, SprintStatus
from app.models.sprint_objective import SprintObjective, ObjectiveStatus
from app.models.meeting import Meeting, MeetingStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.retrospective import Retrospective
from app.models.risk_assessment import RiskAssessment
from app.models.check_in import CheckIn
from app.models.user import User, UserRole
from app.utils.auth import hash_password
from app.services.sprint_generator import generate_sprints_for_team
import secrets

async def seed_database():
    """Seed the database with sample data."""
    print("🌱 Seeding database with sample data...")

    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select

            # Check if database already has data
            result = await db.execute(select(Mentor))
            existing_mentors = result.scalars().all()

            if existing_mentors:
                print("\n⚠️  Database already contains data. Skipping seed.")
                print(f"   Found {len(existing_mentors)} existing mentors")
                print("\n💡 To re-seed, first clear the database:")
                print("   docker-compose down -v")
                print("   docker-compose up -d")
                return

            # Seed default admin user
            result = await db.execute(select(User).where(User.email == "admin@mentorled.com"))
            if not result.scalar_one_or_none():
                admin_user = User(
                    email="admin@mentorled.com",
                    username="admin",
                    full_name="Admin User",
                    hashed_password=hash_password("admin123"),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                db.add(admin_user)
                await db.flush()
                print("✅ Created admin user (admin@mentorled.com / admin123)")
            else:
                print("ℹ️  Admin user already exists")

            # Seed a viewer/fellow user (linked to Emma Wright fellow)
            result = await db.execute(select(User).where(User.email == "emma.wright@example.com"))
            if not result.scalar_one_or_none():
                fellow_user = User(
                    email="emma.wright@example.com",
                    username="emma",
                    full_name="Emma Wright",
                    hashed_password=hash_password("fellow123"),
                    role=UserRole.VIEWER,
                    is_active=True,
                    is_verified=True,
                )
                db.add(fellow_user)
                await db.flush()
                print("✅ Created fellow user (emma.wright@example.com / fellow123)")
            else:
                print("ℹ️  Fellow user already exists")

            # Seed a reviewer/mentor user (linked to Sarah Chen mentor)
            result = await db.execute(select(User).where(User.email == "sarah@example.com"))
            if not result.scalar_one_or_none():
                mentor_user = User(
                    email="sarah@example.com",
                    username="sarah",
                    full_name="Sarah Chen",
                    hashed_password=hash_password("mentor123"),
                    role=UserRole.REVIEWER,
                    is_active=True,
                    is_verified=True,
                )
                db.add(mentor_user)
                await db.flush()
                print("✅ Created mentor user (sarah@example.com / mentor123)")
            else:
                print("ℹ️  Mentor user already exists")

            # Create a cohort — set to ACTIVE for fellowship
            cohort = Cohort(
                name="2025 Spring Cohort",
                start_date=date(2025, 3, 3),  # Monday
                end_date=date(2025, 5, 23),    # 12 weeks later
                status="active",
                target_size=150
            )
            db.add(cohort)
            await db.flush()
            print(f"✓ Created cohort: {cohort.name} (active)")

            # Create mentors
            mentors = [
                Mentor(
                    email="sarah@example.com",
                    name="Sarah Chen",
                    stack="frontend",
                    capacity=2,
                    status="active"
                ),
                Mentor(
                    email="james@example.com",
                    name="James Rodriguez",
                    stack="backend",
                    capacity=2,
                    status="active"
                ),
                Mentor(
                    email="priya@example.com",
                    name="Priya Sharma",
                    stack="product",
                    capacity=2,
                    status="active"
                )
            ]
            db.add_all(mentors)
            await db.flush()
            print(f"✓ Created {len(mentors)} mentors")

            # Create teams — set to ACTIVE for fellowship
            teams = [
                Team(
                    cohort_id=cohort.id,
                    name="Team Alpha",
                    brief_title="Build a Task Management App",
                    brief_description="Create a modern task management application with real-time collaboration",
                    mentor_id=mentors[0].id,
                    slack_channel="#team-alpha",
                    github_repo="https://github.com/mentorled/team-alpha-project",
                    status="active"
                ),
                Team(
                    cohort_id=cohort.id,
                    name="Team Beta",
                    brief_title="Design a Fitness Tracker",
                    brief_description="Design and build a comprehensive fitness tracking platform",
                    mentor_id=mentors[1].id,
                    slack_channel="#team-beta",
                    github_repo="https://github.com/mentorled/team-beta-project",
                    status="active"
                )
            ]
            db.add_all(teams)
            await db.flush()
            print(f"✓ Created {len(teams)} teams (active)")

            # Create original applicants (pipeline stage)
            applicants = [
                Applicant(cohort_id=cohort.id, email="alex.johnson@example.com", name="Alex Johnson", role="frontend", status="applied", portfolio_url="https://alexjohnson.dev", github_url="https://github.com/alexjohnson", project_description="Built several React applications including an e-commerce platform.", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=30)),
                Applicant(cohort_id=cohort.id, email="maria.garcia@example.com", name="Maria Garcia", role="product_designer", status="applied", portfolio_url="https://mariagarcia.design", project_description="UX/UI designer with 2 years experience in fintech.", time_commitment=True, source="twitter", applied_at=datetime.now() - timedelta(days=28)),
                Applicant(cohort_id=cohort.id, email="kevin.chen@example.com", name="Kevin Chen", role="backend", status="microship_pending", portfolio_url="https://kevinchen.io", github_url="https://github.com/kevinchen", project_description="Built RESTful APIs using Node.js and Python.", time_commitment=True, source="referral", applied_at=datetime.now() - timedelta(days=35)),
                Applicant(cohort_id=cohort.id, email="lisa.patel@example.com", name="Lisa Patel", role="product_manager", status="applied", portfolio_url="https://lisapatel.com", project_description="Aspiring PM with background in business analytics.", time_commitment=True, source="website", applied_at=datetime.now() - timedelta(days=25)),
                Applicant(cohort_id=cohort.id, email="tom.wilson@example.com", name="Tom Wilson", role="frontend", status="applied", portfolio_url="https://tomwilson.dev", github_url="https://github.com/tomwilson", project_description="Self-taught developer using Vue.js and TypeScript.", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=20)),
            ]
            db.add_all(applicants)
            await db.flush()
            print(f"✓ Created {len(applicants)} pipeline applicants")

            # Create microship submission
            microship = MicroshipSubmission(
                applicant_id=applicants[2].id,
                challenge_id="MICROSHIP_2025_Q1",
                submission_url="https://github.com/kevinchen/microship-challenge",
                submission_type="github",
                submitted_at=datetime.now() - timedelta(hours=2),
                deadline=datetime.now() + timedelta(hours=22),
                on_time=True,
                acknowledgment_time=datetime.now() - timedelta(days=1, hours=1),
                communication_log=[
                    {"timestamp": str(datetime.now() - timedelta(days=1, hours=1)), "type": "email", "content": "Acknowledged challenge receipt."},
                    {"timestamp": str(datetime.now() - timedelta(hours=12)), "type": "email", "content": "Provided progress update."}
                ]
            )
            db.add(microship)

            # Create track configs
            backend_track = ChallengeTrackConfig(cohort_id=cohort.id, role_type="backend", total_challenges=3)
            designer_track = ChallengeTrackConfig(cohort_id=cohort.id, role_type="product_designer", total_challenges=2)
            frontend_track = ChallengeTrackConfig(cohort_id=cohort.id, role_type="frontend", total_challenges=3)
            db.add_all([backend_track, designer_track, frontend_track])
            await db.flush()

            # Create challenges
            challenges = [
                Challenge(cohort_id=cohort.id, title="Backend API Challenge", description="Build a RESTful API for a task management system.", requirements=["CRUD endpoints", "JWT auth", "Error handling", "Unit tests", "README"], role_type="backend", submission_types=["github"], deadline=datetime.now() + timedelta(days=7), status="active", share_token=secrets.token_urlsafe(32), track_config_id=backend_track.id, sequence_number=1, duration_hours=24),
                Challenge(cohort_id=cohort.id, title="Database Design Challenge", description="Design and implement a database schema for e-commerce.", requirements=["ER diagram", "Migrations", "Seed data", "Indexing strategy"], role_type="backend", submission_types=["github"], deadline=datetime.now() + timedelta(days=5), status="draft", share_token=secrets.token_urlsafe(32), track_config_id=backend_track.id, sequence_number=2, duration_hours=36),
                Challenge(cohort_id=cohort.id, title="Product Design Challenge", description="Design a mobile-first onboarding flow for a fitness app.", requirements=["User flow", "5+ screens", "Style guide", "UX rationale"], role_type="product_designer", submission_types=["figma", "document"], deadline=datetime.now() + timedelta(days=5), status="active", share_token=secrets.token_urlsafe(32), track_config_id=designer_track.id, sequence_number=1, duration_hours=24),
                Challenge(cohort_id=cohort.id, title="Frontend Dashboard Challenge", description="Build a responsive dashboard with React/Next.js and Tailwind.", requirements=["TypeScript", "Tailwind CSS", "Chart/viz", "Responsive", "Filtering"], role_type="frontend", submission_types=["github"], deadline=datetime.now() + timedelta(days=7), status="active", share_token=secrets.token_urlsafe(32), track_config_id=frontend_track.id, sequence_number=1, duration_hours=12),
            ]
            db.add_all(challenges)
            await db.flush()
            microship.challenge_ref = challenges[0].id
            print(f"✓ Created {len(challenges)} challenges with track configs")

            # =================================================================
            # FELLOWSHIP EXECUTION DATA
            # =================================================================
            print("\n--- Fellowship Execution Data ---")

            # Create 12 accepted applicants who become fellows
            fellowship_applicants = [
                # Team Alpha (6 fellows)
                Applicant(cohort_id=cohort.id, email="emma.wright@example.com", name="Emma Wright", role="product_manager", status="accepted", time_commitment=True, source="referral", applied_at=datetime.now() - timedelta(days=60)),
                Applicant(cohort_id=cohort.id, email="david.okafor@example.com", name="David Okafor", role="product_designer", status="accepted", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=58)),
                Applicant(cohort_id=cohort.id, email="nina.zhao@example.com", name="Nina Zhao", role="frontend", status="accepted", github_url="https://github.com/ninazhao", time_commitment=True, source="referral", applied_at=datetime.now() - timedelta(days=55)),
                Applicant(cohort_id=cohort.id, email="carlos.mendez@example.com", name="Carlos Mendez", role="backend", status="accepted", github_url="https://github.com/carlosmendez", time_commitment=True, source="website", applied_at=datetime.now() - timedelta(days=57)),
                Applicant(cohort_id=cohort.id, email="aisha.bello@example.com", name="Aisha Bello", role="frontend", status="accepted", github_url="https://github.com/aishabello", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=56)),
                Applicant(cohort_id=cohort.id, email="ryan.kim@example.com", name="Ryan Kim", role="qa", status="accepted", time_commitment=True, source="website", applied_at=datetime.now() - timedelta(days=54)),
                # Team Beta (6 fellows)
                Applicant(cohort_id=cohort.id, email="sophia.lee@example.com", name="Sophia Lee", role="product_manager", status="accepted", time_commitment=True, source="referral", applied_at=datetime.now() - timedelta(days=59)),
                Applicant(cohort_id=cohort.id, email="james.nkomo@example.com", name="James Nkomo", role="product_designer", status="accepted", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=58)),
                Applicant(cohort_id=cohort.id, email="priya.kumar@example.com", name="Priya Kumar", role="frontend", status="accepted", github_url="https://github.com/priyakumar", time_commitment=True, source="referral", applied_at=datetime.now() - timedelta(days=56)),
                Applicant(cohort_id=cohort.id, email="michael.brown@example.com", name="Michael Brown", role="backend", status="accepted", github_url="https://github.com/michaelbrown", time_commitment=True, source="website", applied_at=datetime.now() - timedelta(days=55)),
                Applicant(cohort_id=cohort.id, email="zara.hassan@example.com", name="Zara Hassan", role="backend", status="accepted", github_url="https://github.com/zarahassan", time_commitment=True, source="linkedin", applied_at=datetime.now() - timedelta(days=53)),
                Applicant(cohort_id=cohort.id, email="luke.taylor@example.com", name="Luke Taylor", role="qa", status="accepted", time_commitment=True, source="website", applied_at=datetime.now() - timedelta(days=52)),
            ]
            db.add_all(fellowship_applicants)
            await db.flush()
            print(f"✓ Created {len(fellowship_applicants)} accepted applicants")

            # Fellowship roles for each team
            team_roles = [
                "Product Manager", "Designer", "Frontend Developer",
                "Backend Developer", "Frontend Developer", "QA Engineer"
            ]

            # Create fellows — 6 per team
            fellows = []
            cohort_start = datetime(2025, 3, 3)
            for i, app in enumerate(fellowship_applicants[:6]):
                fellow = Fellow(
                    applicant_id=app.id,
                    cohort_id=cohort.id,
                    team_id=teams[0].id,
                    role=team_roles[i],
                    status="active",
                    started_at=cohort_start,
                )
                fellows.append(fellow)

            for i, app in enumerate(fellowship_applicants[6:]):
                fellow = Fellow(
                    applicant_id=app.id,
                    cohort_id=cohort.id,
                    team_id=teams[1].id,
                    role=team_roles[i],
                    status="active",
                    started_at=cohort_start,
                )
                fellows.append(fellow)

            db.add_all(fellows)
            await db.flush()
            print(f"✓ Created {len(fellows)} fellows (6 per team)")

            # Generate sprints and meetings for both teams
            for team in teams:
                await generate_sprints_for_team(
                    team.id, db=db, cohort_start_date=cohort.start_date
                )
            await db.flush()

            # Fetch sprints per team
            result = await db.execute(
                select(Sprint).where(Sprint.team_id == teams[0].id)
                .order_by(Sprint.sprint_number)
            )
            alpha_sprints = result.scalars().all()

            result = await db.execute(
                select(Sprint).where(Sprint.team_id == teams[1].id)
                .order_by(Sprint.sprint_number)
            )
            beta_sprints = result.scalars().all()

            print(f"✓ Generated 12 sprints (6 per team) with 72 meetings")

            # Mark Sprint 1 as completed, Sprint 2 as active
            for sprints_list in [alpha_sprints, beta_sprints]:
                sprints_list[0].status = SprintStatus.COMPLETED
                sprints_list[0].goal = "Set up project infrastructure and initial architecture"
                sprints_list[0].completion_score = 82.0
                sprints_list[1].status = SprintStatus.ACTIVE
                sprints_list[1].goal = "Build core user authentication and onboarding flow"
            await db.flush()
            print("✓ Sprint 1 → completed, Sprint 2 → active (both teams)")

            # Create sprint objectives for Sprint 1 (completed) — both teams
            sprint1_objectives_data = [
                # Team Alpha Sprint 1
                ("Set up Next.js project with TypeScript and Tailwind", "Frontend Developer", ObjectiveStatus.DONE, "https://github.com/mentorled/team-alpha/pull/1", "github"),
                ("Configure FastAPI backend with PostgreSQL", "Backend Developer", ObjectiveStatus.DONE, "https://github.com/mentorled/team-alpha/pull/2", "github"),
                ("Create initial wireframes and design system", "Designer", ObjectiveStatus.DONE, "https://figma.com/file/alpha-design-v1", "figma"),
                ("Define product requirements document", "Product Manager", ObjectiveStatus.DONE, "https://docs.google.com/document/alpha-prd", "document"),
                ("Set up CI/CD pipeline and testing framework", "QA Engineer", ObjectiveStatus.NOT_DONE, None, None),
            ]

            for team_idx, (sprints_list, team_fellows) in enumerate([
                (alpha_sprints, fellows[:6]),
                (beta_sprints, fellows[6:]),
            ]):
                for desc, role, status, evidence_url, evidence_type in sprint1_objectives_data:
                    # Find the fellow with matching role
                    owner = next((f for f in team_fellows if role.lower() in f.role.lower()), team_fellows[0])
                    obj = SprintObjective(
                        sprint_id=sprints_list[0].id,
                        description=desc,
                        owner_role=role,
                        owner_fellow_id=owner.id,
                        status=status,
                        evidence_url=evidence_url,
                        evidence_type=evidence_type,
                    )
                    db.add(obj)

            # Create objectives for Sprint 2 (active)
            sprint2_objectives_data = [
                ("Implement user login and registration UI", "Frontend Developer", ObjectiveStatus.IN_PROGRESS),
                ("Build authentication API with JWT tokens", "Backend Developer", ObjectiveStatus.IN_PROGRESS),
                ("Design onboarding user flow (5 screens)", "Designer", ObjectiveStatus.DONE),
                ("Write user stories for Sprint 3 features", "Product Manager", ObjectiveStatus.NOT_STARTED),
                ("Create test plan for authentication flows", "QA Engineer", ObjectiveStatus.NOT_STARTED),
            ]

            for sprints_list, team_fellows in [
                (alpha_sprints, fellows[:6]),
                (beta_sprints, fellows[6:]),
            ]:
                for desc, role, status in sprint2_objectives_data:
                    owner = next((f for f in team_fellows if role.lower() in f.role.lower()), team_fellows[0])
                    obj = SprintObjective(
                        sprint_id=sprints_list[1].id,
                        description=desc,
                        owner_role=role,
                        owner_fellow_id=owner.id,
                        status=status,
                    )
                    db.add(obj)

            await db.flush()
            print("✓ Created sprint objectives (5 per sprint, Sprints 1-2, both teams)")

            # Create attendance records for Sprint 1 meetings (completed)
            attendance_count = 0
            for sprints_list, team_fellows in [
                (alpha_sprints, fellows[:6]),
                (beta_sprints, fellows[6:]),
            ]:
                # Get Sprint 1 meetings
                result = await db.execute(
                    select(Meeting).where(Meeting.sprint_id == sprints_list[0].id)
                    .order_by(Meeting.scheduled_at)
                )
                sprint1_meetings = result.scalars().all()

                # Mark Sprint 1 meetings as completed
                for m in sprint1_meetings:
                    m.status = MeetingStatus.COMPLETED
                    m.is_locked = True

                # Create attendance for each fellow for each meeting
                for meeting in sprint1_meetings:
                    for j, fellow in enumerate(team_fellows):
                        # Mostly present, some variety
                        rand = random.random()
                        if j == 4 and meeting.meeting_type.value == "standup":
                            # One fellow occasionally late to standups
                            status = AttendanceStatus.LATE
                            minutes_late = random.randint(6, 12)
                        elif rand < 0.05:
                            # 5% chance absent
                            status = AttendanceStatus.ABSENT
                            minutes_late = None
                        elif rand < 0.15:
                            # 10% chance late
                            status = AttendanceStatus.LATE
                            minutes_late = random.randint(6, 15)
                        else:
                            # 85% present
                            status = AttendanceStatus.PRESENT
                            minutes_late = 0

                        att = Attendance(
                            meeting_id=meeting.id,
                            fellow_id=fellow.id,
                            status=status,
                            joined_at=meeting.scheduled_at + timedelta(minutes=minutes_late or 0) if status != AttendanceStatus.ABSENT else None,
                            minutes_late=minutes_late,
                        )
                        db.add(att)
                        attendance_count += 1

            await db.flush()
            print(f"✓ Created {attendance_count} attendance records for Sprint 1 meetings")

            # Create retrospectives for Sprint 1
            for sprints_list, team_fellows in [
                (alpha_sprints, fellows[:6]),
                (beta_sprints, fellows[6:]),
            ]:
                retro = Retrospective(
                    sprint_id=sprints_list[0].id,
                    what_worked=[
                        "Clear sprint goal helped everyone focus",
                        "Daily standups kept team aligned",
                        "Good collaboration between frontend and backend",
                    ],
                    what_didnt_work=[
                        "CI/CD setup took longer than expected",
                        "Design handoff was delayed by 2 days",
                        "Unclear requirements for some features",
                    ],
                    what_to_improve=[
                        "Start design work earlier in the sprint",
                        "Add more detail to user stories before sprint starts",
                        "Set up CI/CD in first 2 days of next sprint",
                    ],
                    team_mood="good",
                    sprint_rating=7,
                    submitted_by=team_fellows[0].id,  # PM submits
                    submitted_at=datetime(2025, 3, 14, 17, 0),
                )
                db.add(retro)

            await db.flush()
            print("✓ Created retrospectives for Sprint 1 (both teams)")

            # =================================================================
            # CHECK-INS & RISK ASSESSMENTS (7-signal format)
            # =================================================================
            print("\n--- Check-ins & Risk Assessments ---")

            # Create check-ins for weeks 1-3 for all fellows
            checkin_count = 0
            sentiments_by_fellow = {}  # Track for risk assessment seeding
            for fellow in fellows:
                fellow_sentiments = []
                for wk in range(1, 4):
                    # Vary sentiment and energy by fellow to create diverse risk profiles
                    idx = fellows.index(fellow)
                    if idx in (4, 10):
                        # These fellows will be "at risk" — lower sentiment & energy
                        base_sentiment = random.uniform(-0.3, 0.2)
                        energy = random.randint(2, 4)
                        self_assessment = random.choice(["met", "below", "below"])
                        collab = random.choice(["okay", "struggling", "okay"])
                    elif idx in (3, 9):
                        # These fellows will be "monitor" — moderate
                        base_sentiment = random.uniform(0.0, 0.5)
                        energy = random.randint(4, 6)
                        self_assessment = random.choice(["met", "met", "below"])
                        collab = random.choice(["good", "okay", "okay"])
                    else:
                        # Most fellows on track
                        base_sentiment = random.uniform(0.4, 0.9)
                        energy = random.randint(6, 9)
                        self_assessment = random.choice(["met", "met", "exceeded"])
                        collab = random.choice(["great", "good", "good"])

                    sentiment = round(base_sentiment, 2)
                    fellow_sentiments.append(sentiment)
                    risk_contrib = round(max(0, 1.0 - (sentiment + 1.0) / 2.0), 2)

                    ci = CheckIn(
                        fellow_id=fellow.id,
                        week=wk,
                        accomplishments=f"Week {wk} accomplishments for {fellow.role}.",
                        next_focus=f"Planning to work on sprint objectives for week {wk+1}.",
                        blockers="Need code review on authentication PR." if idx in (4, 10) else None,
                        needs_help="Could use pair programming session." if idx in (4, 10) else None,
                        self_assessment=self_assessment,
                        collaboration_rating=collab,
                        energy_level=energy,
                        sentiment_score=sentiment,
                        risk_contribution=risk_contrib,
                        blockers_extracted=["Authentication PR review needed"] if idx in (4, 10) else [],
                        action_items=["Schedule pair programming", "Follow up with mentor"] if idx in (4, 10) else [],
                        analyzed_at=datetime.now() - timedelta(days=(3 - wk) * 7),
                        analysis={
                            "sentiment_score": sentiment,
                            "risk_contribution": risk_contrib,
                            "engagement_level": "low" if idx in (4, 10) else "medium" if idx in (3, 9) else "high",
                            "summary": f"Week {wk} analysis for {fellow.role}.",
                        },
                    )
                    db.add(ci)
                    checkin_count += 1

                sentiments_by_fellow[fellow.id] = fellow_sentiments

            await db.flush()
            print(f"✓ Created {checkin_count} check-ins (3 weeks x {len(fellows)} fellows)")

            # Create risk assessments (week 2 and week 3) with 7-signal format
            risk_count = 0
            for fellow in fellows:
                idx = fellows.index(fellow)
                for wk in [2, 3]:
                    # Build 7 signals based on fellow profile
                    if idx in (4, 10):
                        # At-risk fellows
                        signals = {
                            "attendance_score": round(random.uniform(0.45, 0.65), 2),
                            "check_in_sentiment": round(random.uniform(0.25, 0.45), 2),
                            "check_in_completeness": round(wk / wk, 2),
                            "sprint_delivery": round(random.uniform(0.3, 0.5), 2),
                            "evidence_submission": round(random.uniform(0.3, 0.5), 2),
                            "mentor_flags": 0.5,
                            "trend": 0.3 if wk == 3 else 0.5,
                        }
                    elif idx in (3, 9):
                        # Monitor fellows
                        signals = {
                            "attendance_score": round(random.uniform(0.65, 0.80), 2),
                            "check_in_sentiment": round(random.uniform(0.45, 0.60), 2),
                            "check_in_completeness": round(wk / wk, 2),
                            "sprint_delivery": round(random.uniform(0.5, 0.7), 2),
                            "evidence_submission": round(random.uniform(0.5, 0.7), 2),
                            "mentor_flags": 1.0,
                            "trend": 0.7,
                        }
                    else:
                        # On-track fellows
                        signals = {
                            "attendance_score": round(random.uniform(0.85, 1.0), 2),
                            "check_in_sentiment": round(random.uniform(0.65, 0.90), 2),
                            "check_in_completeness": 1.0,
                            "sprint_delivery": round(random.uniform(0.7, 0.95), 2),
                            "evidence_submission": round(random.uniform(0.7, 1.0), 2),
                            "mentor_flags": 1.0,
                            "trend": round(random.uniform(0.7, 1.0), 2),
                        }

                    # Calculate weighted score
                    weights = {
                        "attendance_score": 0.20, "check_in_sentiment": 0.15,
                        "check_in_completeness": 0.10, "sprint_delivery": 0.25,
                        "evidence_submission": 0.15, "mentor_flags": 0.10, "trend": 0.05,
                    }
                    risk_score = round(sum(signals[k] * weights[k] for k in weights), 2)

                    # Determine level
                    if risk_score >= 0.70:
                        risk_level = "on_track"
                    elif risk_score >= 0.50:
                        risk_level = "monitor"
                    elif risk_score >= 0.30:
                        risk_level = "at_risk"
                    else:
                        risk_level = "critical"

                    # Generate concerns
                    concerns = []
                    if signals["attendance_score"] < 0.7:
                        concerns.append({"type": "attendance", "severity": "high" if signals["attendance_score"] < 0.5 else "medium", "description": f"Attendance below target ({round(signals['attendance_score']*100)}%)"})
                    if signals["sprint_delivery"] < 0.6:
                        concerns.append({"type": "delivery", "severity": "high" if signals["sprint_delivery"] < 0.4 else "medium", "description": f"Sprint delivery below expectations ({round(signals['sprint_delivery']*100)}%)"})
                    if signals["check_in_sentiment"] < 0.4:
                        concerns.append({"type": "engagement", "severity": "high", "description": f"Low sentiment in check-ins ({signals['check_in_sentiment']})"})

                    # Recommended action
                    if risk_level == "critical":
                        rec_action = "immediate_review"
                    elif risk_level == "at_risk":
                        rec_action = "mentor_intervention"
                    elif risk_level == "monitor":
                        rec_action = "check_in_required"
                    else:
                        rec_action = "continue_monitoring"

                    ra = RiskAssessment(
                        fellow_id=fellow.id,
                        week=wk,
                        risk_level=risk_level,
                        risk_score=risk_score,
                        signals=signals,
                        concerns=concerns,
                        recommended_action=rec_action,
                        assessed_at=datetime.now() - timedelta(days=(3 - wk) * 7),
                    )
                    db.add(ra)
                    risk_count += 1

                    # Update fellow's current risk score/level with latest week
                    if wk == 3:
                        fellow.current_risk_score = risk_score
                        fellow.current_risk_level = risk_level

            await db.flush()
            print(f"✓ Created {risk_count} risk assessments (2 weeks x {len(fellows)} fellows)")

            # ======================
            # 12. SAMPLE NOTIFICATIONS
            # ======================
            from app.models.notification import Notification

            sample_notifications = [
                Notification(
                    type="risk_alert",
                    title="High Risk: Sarah Chen",
                    message="Sarah Chen (Frontend) flagged as at_risk with score 3.2",
                    action_url="/risk",
                ),
                Notification(
                    type="warning_issued",
                    title="Warning #1 Issued",
                    message="Warning issued to David Kim (Backend) for missed deliverables",
                    action_url="/delivery",
                ),
                Notification(
                    type="evaluation",
                    title="Evaluation Reviewed: Jane Doe",
                    message="Jane Doe marked as eligible (decision: eligible)",
                    action_url="/screening",
                ),
                Notification(
                    type="acceptance",
                    title="New Acceptance: Alex Rivera",
                    message="Alex Rivera (Product Designer) accepted with score 85/100",
                    action_url="/applicants",
                ),
                Notification(
                    type="meeting",
                    title="Sprint Review Tomorrow",
                    message="Team Alpha sprint review scheduled for tomorrow at 2:00 PM",
                    action_url="/sprints",
                ),
            ]
            for n in sample_notifications:
                db.add(n)
            await db.flush()
            print(f"✓ Created {len(sample_notifications)} sample notifications")

            await db.commit()
            print("\n✅ Database seeded successfully!")
            print(f"\n📊 Summary:")
            print(f"   - Cohorts: 1 (active)")
            print(f"   - Mentors: {len(mentors)}")
            print(f"   - Teams: {len(teams)} (active)")
            print(f"   - Pipeline Applicants: {len(applicants)}")
            print(f"   - Fellowship Applicants: {len(fellowship_applicants)} (accepted)")
            print(f"   - Fellows: {len(fellows)} (6 per team)")
            print(f"   - Sprints: 12 (Sprint 1: completed, Sprint 2: active, 3-6: pending)")
            print(f"   - Meetings: 72 (36 per team, 6 per sprint)")
            print(f"   - Sprint Objectives: 20 (5 per sprint x 2 sprints x 2 teams)")
            print(f"   - Attendance Records: {attendance_count}")
            print(f"   - Retrospectives: 2 (Sprint 1, both teams)")
            print(f"   - Check-ins: {checkin_count} (3 weeks x {len(fellows)} fellows)")
            print(f"   - Risk Assessments: {risk_count} (7-signal format, weeks 2-3)")
            print(f"   - Challenges: {len(challenges)}")
            print(f"   - Microship Submissions: 1")
            print(f"   - Notifications: {len(sample_notifications)}")
            for c in challenges:
                if c.status == 'active':
                    print(f"     [{c.status}] {c.title} → /submit/{c.share_token}")
            print(f"\n🚀 Fellowship execution data ready for testing!")

        except Exception as e:
            print(f"\n❌ Error seeding database: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(seed_database())
