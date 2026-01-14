"""
Seed script to populate the database with realistic demo data.

This creates:
- Admin user
- 2 cohorts (one current, one past)
- 50 applicants with microship submissions
- 30 fellows from accepted applicants
- Weekly check-ins for fellows (varied sentiments)
- Milestones for fellows
- Warnings for at-risk fellows
- Risk assessments

Run with: python backend/scripts/seed_data.py
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from uuid import uuid4
import random

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session, engine, Base
from app.models.user import User, UserRole
from app.models.applicant import Applicant
from app.models.microship import MicroshipSubmission
from app.models.cohort import Cohort
from app.models.fellow import Fellow
from app.models.check_in import CheckIn
from app.models.milestone import Milestone
from app.models.warning import Warning
from app.models.risk_assessment import RiskAssessment
from app.core.security import get_password_hash


# Sample data pools
FIRST_NAMES = [
    "Amara", "Kofi", "Zuri", "Jabari", "Nia", "Kwame", "Aisha", "Chidi",
    "Folami", "Ayo", "Simba", "Imani", "Kwesi", "Zola", "Obi", "Amina",
    "Tunde", "Nala", "Jamal", "Kemi", "Sekou", "Ife", "Malik", "Zahara",
    "Bakari", "Sanaa", "Omar", "Kamaria", "Rashid", "Eshe", "Tariq", "Asha",
    "Kofi", "Makena", "Ibrahim", "Zainab", "Hassan", "Fatima", "Ali", "Mariam",
    "Yusuf", "Halima", "Mustafa", "Safiya", "Ahmed", "Layla", "Mohamed", "Yasmin",
    "Idris", "Aaliyah"
]

LAST_NAMES = [
    "Okonkwo", "Adeyemi", "Mensah", "Kamau", "Ndlovu", "Diallo", "Traore",
    "Okeke", "Mwangi", "Nkrumah", "Banda", "Juma", "Kone", "Osei", "Mutombo",
    "Sisay", "Ngozi", "Olawale", "Tembo", "Abimbola", "Chukwu", "Kipchoge",
    "Musa", "Eze", "Afolayan", "Wanjiru", "Balogun", "Owusu", "Kimani", "Adewale",
    "Keita", "Okafor", "Muthoni", "Bello", "Anyiam", "Githinji", "Ibrahim",
    "Onyango", "Koroma", "Adeyanju", "Waweru", "Yeboah", "Nwosu", "Kariuki",
    "Sanusi", "Oladipo", "Njoroge", "Hassan", "Ogundele", "Kiplagat"
]

UNIVERSITIES = [
    "University of Lagos", "University of Nairobi", "University of Ghana",
    "Makerere University", "University of Cape Town", "Addis Ababa University",
    "University of Dar es Salaam", "Kwame Nkrumah University",
    "University of Ibadan", "Kenyatta University", "Obafemi Awolowo University",
    "University of the Witwatersrand", "American University in Cairo",
    "Ashesi University", "African Leadership University", "Covenant University"
]

ROLES_INTERESTED = [
    "Software Engineer", "Full Stack Developer", "Backend Engineer",
    "Frontend Developer", "Mobile Developer", "DevOps Engineer",
    "Data Scientist", "ML Engineer", "Product Manager", "UX Designer"
]

GITHUB_URLS = [
    "https://github.com/user{}/microship-project",
    "https://github.com/{}-dev/microship-challenge",
    "https://github.com/code-{}/project",
]

ACCOMPLISHMENTS = [
    "Completed authentication module with JWT tokens",
    "Built RESTful API with 15 endpoints",
    "Integrated payment gateway (Stripe/Paystack)",
    "Deployed app to production on AWS",
    "Implemented real-time chat with WebSockets",
    "Created responsive dashboard with React",
    "Optimized database queries, reduced latency by 60%",
    "Set up CI/CD pipeline with GitHub Actions",
    "Built mobile app with React Native",
    "Implemented caching layer with Redis"
]

BLOCKERS = [
    "Struggling with async/await patterns in Python",
    "Database migration conflicts",
    "CORS issues between frontend and backend",
    "Docker container not starting properly",
    "Authentication tokens expiring too quickly",
    "API rate limiting from third-party service",
    "Deployment failures on cloud platform",
    "Team communication delays",
    "Unclear requirements for feature X",
    "Limited access to testing environment"
]

NEXT_FOCUS = [
    "Complete user profile management",
    "Add real-time notifications",
    "Improve error handling and validation",
    "Write comprehensive tests",
    "Refactor codebase for better structure",
    "Implement search and filtering",
    "Add data export functionality",
    "Optimize frontend performance",
    "Complete API documentation",
    "Prepare for production deployment"
]


async def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ Tables created")


async def create_admin_user(db: AsyncSession) -> User:
    """Create admin user if doesn't exist."""
    from sqlalchemy import select

    result = await db.execute(
        select(User).where(User.email == "admin@mentorled.com")
    )
    existing_admin = result.scalar_one_or_none()

    if existing_admin:
        print("✓ Admin user already exists")
        return existing_admin

    admin = User(
        id=uuid4(),
        email="admin@mentorled.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Program Manager",
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    print(f"✓ Admin user created: admin@mentorled.com / admin123")
    return admin


async def create_cohorts(db: AsyncSession) -> tuple[Cohort, Cohort]:
    """Create current and past cohorts."""
    print("\nCreating cohorts...")

    # Current cohort (Week 8 of 12)
    current_cohort = Cohort(
        id=uuid4(),
        name="2024 Q4 Cohort",
        start_date=datetime.utcnow() - timedelta(weeks=8),
        end_date=datetime.utcnow() + timedelta(weeks=4),
        program_duration_weeks=12,
        target_size=30,
        actual_size=30,
        is_active=True,
        description="Current cohort in Week 8 of fellowship"
    )

    # Past cohort (completed)
    past_cohort = Cohort(
        id=uuid4(),
        name="2024 Q2 Cohort",
        start_date=datetime.utcnow() - timedelta(weeks=20),
        end_date=datetime.utcnow() - timedelta(weeks=8),
        program_duration_weeks=12,
        target_size=25,
        actual_size=25,
        is_active=False,
        description="Completed cohort from Q2 2024"
    )

    db.add_all([current_cohort, past_cohort])
    await db.commit()
    await db.refresh(current_cohort)
    await db.refresh(past_cohort)

    print(f"✓ Created cohort: {current_cohort.name} (active, week 8/12)")
    print(f"✓ Created cohort: {past_cohort.name} (completed)")

    return current_cohort, past_cohort


async def create_applicants_and_submissions(db: AsyncSession, count: int = 50):
    """Create applicants with microship submissions."""
    print(f"\nCreating {count} applicants with microship submissions...")

    applicants = []
    submissions = []

    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        email = f"{first_name.lower()}.{last_name.lower()}{i}@example.com"

        applicant = Applicant(
            id=uuid4(),
            email=email,
            full_name=f"{first_name} {last_name}",
            phone=f"+234{random.randint(8000000000, 8999999999)}",
            university=random.choice(UNIVERSITIES),
            graduation_year=random.choice([2023, 2024, 2025]),
            degree_program=random.choice(["Computer Science", "Software Engineering", "Information Technology"]),
            role_interested=random.choice(ROLES_INTERESTED),
            linkedin_url=f"https://linkedin.com/in/{first_name.lower()}-{last_name.lower()}{i}",
            github_url=f"https://github.com/{first_name.lower()}{last_name.lower()}{i}",
            portfolio_url=f"https://{first_name.lower()}{last_name.lower()}.dev",
            application_status="microship_sent",
            created_at=datetime.utcnow() - timedelta(days=random.randint(30, 90))
        )
        applicants.append(applicant)

        # Create microship submission
        on_time = random.random() > 0.2  # 80% submit on time
        submitted = random.random() > 0.1  # 90% submit

        if submitted:
            submission = MicroshipSubmission(
                id=uuid4(),
                applicant_id=applicant.id,
                submission_url=random.choice(GITHUB_URLS).format(i, first_name.lower(), last_name.lower()),
                submission_type="github",
                submitted_at=datetime.utcnow() - timedelta(days=random.randint(15, 45)),
                deadline=datetime.utcnow() - timedelta(days=random.randint(10, 40)),
                on_time=on_time,
                acknowledgment_time=f"{random.randint(1, 48)} hours",
                communication_log=[
                    {
                        "timestamp": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                        "type": "email",
                        "content": "Challenge instructions sent"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(days=29)).isoformat(),
                        "type": "email",
                        "content": "Acknowledged challenge receipt"
                    }
                ],
                created_at=datetime.utcnow() - timedelta(days=random.randint(20, 50))
            )
            submissions.append(submission)

    db.add_all(applicants)
    db.add_all(submissions)
    await db.commit()

    print(f"✓ Created {len(applicants)} applicants")
    print(f"✓ Created {len(submissions)} microship submissions")

    return applicants, submissions


async def create_fellows(db: AsyncSession, cohort: Cohort, applicants: list[Applicant], count: int = 30):
    """Create fellows from top applicants."""
    print(f"\nCreating {count} fellows...")

    fellows = []
    selected_applicants = random.sample(applicants, min(count, len(applicants)))

    for i, applicant in enumerate(selected_applicants):
        # Determine fellow status based on progression
        if i < 25:  # Most are on track
            status = "active"
            warnings_count = 0
        elif i < 28:  # Some have warnings
            status = "active"
            warnings_count = random.randint(1, 2)
        else:  # A few are at risk
            status = "at_risk"
            warnings_count = random.randint(2, 3)

        fellow = Fellow(
            id=uuid4(),
            applicant_id=applicant.id,
            cohort_id=cohort.id,
            user_id=None,  # Would be created when fellow gets account
            status=status,
            warnings_count=warnings_count,
            placement_status="not_started",
            created_at=cohort.start_date,
            onboarding_completed_at=cohort.start_date + timedelta(days=3)
        )
        fellows.append(fellow)

    db.add_all(fellows)
    await db.commit()

    for fellow in fellows:
        await db.refresh(fellow)

    print(f"✓ Created {len(fellows)} fellows")
    print(f"  - {sum(1 for f in fellows if f.status == 'active' and f.warnings_count == 0)} on track")
    print(f"  - {sum(1 for f in fellows if f.warnings_count > 0 and f.status == 'active')} with warnings")
    print(f"  - {sum(1 for f in fellows if f.status == 'at_risk')} at risk")

    return fellows


async def create_check_ins(db: AsyncSession, fellows: list[Fellow], current_week: int = 8):
    """Create weekly check-ins for fellows."""
    print(f"\nCreating check-ins for weeks 1-{current_week}...")

    check_ins = []

    for fellow in fellows:
        # Create check-ins for each week
        for week in range(1, current_week + 1):
            # Some fellows miss check-ins (more misses = higher risk)
            miss_probability = 0.05 if fellow.warnings_count == 0 else 0.15 if fellow.warnings_count == 1 else 0.3
            if random.random() < miss_probability:
                continue  # Skip this week

            # Sentiment varies by fellow status
            if fellow.status == "active" and fellow.warnings_count == 0:
                # On track - positive sentiment
                energy_level = random.randint(7, 10)
                sentiment_base = random.uniform(0.3, 0.9)
                has_blockers = random.random() < 0.2
            elif fellow.warnings_count > 0:
                # Has warnings - mixed sentiment
                energy_level = random.randint(5, 8)
                sentiment_base = random.uniform(-0.2, 0.5)
                has_blockers = random.random() < 0.5
            else:
                # At risk - negative sentiment
                energy_level = random.randint(3, 6)
                sentiment_base = random.uniform(-0.7, 0.2)
                has_blockers = random.random() < 0.7

            check_in = CheckIn(
                id=uuid4(),
                fellow_id=fellow.id,
                week=week,
                accomplishments=random.choice(ACCOMPLISHMENTS),
                next_focus=random.choice(NEXT_FOCUS),
                blockers=random.choice(BLOCKERS) if has_blockers else None,
                needs_help="Yes, need technical support" if has_blockers else "No blockers currently",
                self_assessment=random.choice(["On track", "Slightly behind", "Need support"]),
                collaboration_rating=random.choice(["Excellent", "Good", "Needs improvement"]),
                energy_level=energy_level,
                submitted_at=datetime.utcnow() - timedelta(weeks=current_week - week, days=random.randint(0, 2)),
                sentiment_score=sentiment_base + random.uniform(-0.1, 0.1),
                risk_contribution=max(0, min(1, (10 - energy_level) / 10 + (0.3 if has_blockers else 0))),
                blockers_extracted=[random.choice(BLOCKERS)] if has_blockers else [],
                action_items=["Schedule 1:1 with mentor", "Review documentation"] if has_blockers else []
            )
            check_ins.append(check_in)

    db.add_all(check_ins)
    await db.commit()

    print(f"✓ Created {len(check_ins)} check-ins across {current_week} weeks")
    print(f"  - Avg check-ins per fellow: {len(check_ins) / len(fellows):.1f}/{current_week}")

    return check_ins


async def create_milestones(db: AsyncSession, fellows: list[Fellow], cohort: Cohort):
    """Create milestones for fellows."""
    print(f"\nCreating milestones...")

    milestones = []
    milestone_templates = [
        {"name": "Complete Onboarding", "week": 1, "weight": 0.1},
        {"name": "First Project Demo", "week": 3, "weight": 0.15},
        {"name": "Mid-Program Review", "week": 6, "weight": 0.2},
        {"name": "Final Project Kickoff", "week": 8, "weight": 0.25},
        {"name": "Final Project Demo", "week": 11, "weight": 0.3},
    ]

    current_week = 8

    for fellow in fellows:
        for template in milestone_templates:
            if template["week"] <= current_week:
                # Determine completion based on fellow status
                if fellow.status == "active" and fellow.warnings_count == 0:
                    completed = random.random() > 0.05  # 95% complete
                elif fellow.warnings_count > 0:
                    completed = random.random() > 0.2  # 80% complete
                else:
                    completed = random.random() > 0.4  # 60% complete

                milestone = Milestone(
                    id=uuid4(),
                    fellow_id=fellow.id,
                    name=template["name"],
                    description=f"{template['name']} for fellowship program",
                    due_date=cohort.start_date + timedelta(weeks=template["week"]),
                    completed=completed,
                    completed_at=cohort.start_date + timedelta(weeks=template["week"], days=random.randint(-2, 2)) if completed else None,
                    weight=template["weight"]
                )
                milestones.append(milestone)

    db.add_all(milestones)
    await db.commit()

    completed_count = sum(1 for m in milestones if m.completed)
    print(f"✓ Created {len(milestones)} milestones")
    print(f"  - {completed_count} completed ({completed_count*100//len(milestones)}%)")

    return milestones


async def create_warnings(db: AsyncSession, fellows: list[Fellow]):
    """Create warnings for at-risk fellows."""
    print(f"\nCreating warnings...")

    warnings = []
    fellows_with_warnings = [f for f in fellows if f.warnings_count > 0]

    for fellow in fellows_with_warnings:
        for i in range(fellow.warnings_count):
            warning_level = "first" if i == 0 else "final"
            issued = random.random() > 0.3  # 70% issued, 30% still drafted

            warning = Warning(
                id=uuid4(),
                fellow_id=fellow.id,
                warning_level=warning_level,
                reason=random.choice([
                    "Missed multiple check-ins",
                    "Milestone completion delays",
                    "Low engagement scores",
                    "Communication responsiveness"
                ]),
                ai_draft={
                    "message": f"Dear {fellow.applicant.full_name},\n\nWe've noticed some concerns...",
                    "tone": "supportive" if warning_level == "first" else "serious",
                    "key_points": ["Check-in consistency", "Milestone completion", "Communication"],
                    "requirements": ["Submit weekly check-ins", "Complete pending milestones"],
                    "timeline": "2 weeks",
                    "recommended_followup": "1:1 meeting with program manager"
                },
                final_message=f"Final message for {warning_level} warning..." if issued else None,
                issued_at=datetime.utcnow() - timedelta(days=random.randint(7, 30)) if issued else None,
                response_deadline=datetime.utcnow() + timedelta(days=14) if issued else None,
                created_at=datetime.utcnow() - timedelta(days=random.randint(10, 40))
            )
            warnings.append(warning)

    db.add_all(warnings)
    await db.commit()

    issued_count = sum(1 for w in warnings if w.issued_at is not None)
    print(f"✓ Created {len(warnings)} warnings")
    print(f"  - {issued_count} issued, {len(warnings) - issued_count} drafted")

    return warnings


async def create_risk_assessments(db: AsyncSession, fellows: list[Fellow], current_week: int = 8):
    """Create risk assessments for fellows."""
    print(f"\nCreating risk assessments for week {current_week}...")

    assessments = []

    for fellow in fellows:
        # Calculate risk score based on fellow status
        if fellow.status == "active" and fellow.warnings_count == 0:
            risk_score = random.uniform(0.0, 0.3)
            risk_level = "on_track"
        elif fellow.warnings_count == 1:
            risk_score = random.uniform(0.25, 0.5)
            risk_level = "monitor"
        elif fellow.warnings_count == 2:
            risk_score = random.uniform(0.45, 0.7)
            risk_level = "at_risk"
        else:
            risk_score = random.uniform(0.65, 1.0)
            risk_level = "critical"

        concerns = []
        if risk_score > 0.3:
            concerns.append("Check-in submission consistency")
        if risk_score > 0.5:
            concerns.append("Milestone completion delays")
        if risk_score > 0.7:
            concerns.append("Low engagement and energy levels")

        assessment = RiskAssessment(
            id=uuid4(),
            fellow_id=fellow.id,
            week=current_week,
            risk_score=risk_score,
            risk_level=risk_level,
            signals={
                "check_in_frequency": random.uniform(0.6, 1.0),
                "check_in_risk": risk_score,
                "sentiment_score": random.uniform(-0.5, 0.8),
                "energy_level": random.uniform(0.3, 1.0),
                "milestone_completion": random.uniform(0.5, 1.0),
                "collaboration_rating": random.uniform(0.6, 1.0),
                "warnings_issued": fellow.warnings_count
            },
            concerns=concerns,
            recommended_action="Continue monitoring" if risk_level == "on_track" else
                               "Schedule check-in" if risk_level == "monitor" else
                               "Issue warning and 1:1 meeting" if risk_level == "at_risk" else
                               "Immediate intervention required",
            created_at=datetime.utcnow() - timedelta(days=random.randint(0, 7))
        )
        assessments.append(assessment)

    db.add_all(assessments)
    await db.commit()

    print(f"✓ Created {len(assessments)} risk assessments")
    print(f"  - On track: {sum(1 for a in assessments if a.risk_level == 'on_track')}")
    print(f"  - Monitor: {sum(1 for a in assessments if a.risk_level == 'monitor')}")
    print(f"  - At risk: {sum(1 for a in assessments if a.risk_level == 'at_risk')}")
    print(f"  - Critical: {sum(1 for a in assessments if a.risk_level == 'critical')}")

    return assessments


async def main():
    """Main seeding function."""
    print("=" * 60)
    print("MentorLed Platform - Database Seeding Script")
    print("=" * 60)

    # Create tables
    await create_tables()

    # Create all seed data
    async with async_session() as db:
        try:
            # 1. Admin user
            admin = await create_admin_user(db)

            # 2. Cohorts
            current_cohort, past_cohort = await create_cohorts(db)

            # 3. Applicants and Microship submissions
            applicants, submissions = await create_applicants_and_submissions(db, count=50)

            # 4. Fellows
            fellows = await create_fellows(db, current_cohort, applicants, count=30)

            # 5. Check-ins
            check_ins = await create_check_ins(db, fellows, current_week=8)

            # 6. Milestones
            milestones = await create_milestones(db, fellows, current_cohort)

            # 7. Warnings
            warnings = await create_warnings(db, fellows)

            # 8. Risk assessments
            assessments = await create_risk_assessments(db, fellows, current_week=8)

            print("\n" + "=" * 60)
            print("✅ SEEDING COMPLETE!")
            print("=" * 60)
            print(f"""
Summary:
  - Admin User: admin@mentorled.com / admin123
  - Cohorts: 2 (1 active, 1 past)
  - Applicants: {len(applicants)}
  - Microship Submissions: {len(submissions)}
  - Fellows: {len(fellows)}
  - Check-ins: {len(check_ins)}
  - Milestones: {len(milestones)}
  - Warnings: {len(warnings)}
  - Risk Assessments: {len(assessments)}

Next Steps:
  1. Start backend: cd backend && uvicorn app.main:app --reload
  2. Start frontend: cd frontend && npm run dev
  3. Login: admin@mentorled.com / admin123
  4. Explore:
     - /applicants - View all applicants
     - /microship - See submissions (run AI evaluation)
     - /fellows - Active fellows dashboard
     - /check-ins - Weekly check-in analysis
     - /risk - Risk dashboard with live data
     - /warnings - Warning workflow system

The platform is now ready for demo! 🎉
            """)

        except Exception as e:
            print(f"\n❌ Error during seeding: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
