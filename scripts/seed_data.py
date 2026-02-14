"""
Seed script to populate database with sample data for development/testing.
"""
import asyncio
import sys
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
from app.models.user import User, UserRole
from app.utils.auth import hash_password
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

            # Create a cohort
            cohort = Cohort(
                name="2025 Spring Cohort",
                start_date=date(2025, 3, 1),
                end_date=date(2025, 6, 1),
                status="applications_open",
                target_size=150
            )
            db.add(cohort)
            await db.flush()
            print(f"✓ Created cohort: {cohort.name}")

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

            # Create teams
            teams = [
                Team(
                    cohort_id=cohort.id,
                    name="Team Alpha",
                    brief_title="Build a Task Management App",
                    brief_description="Create a modern task management application with real-time collaboration",
                    mentor_id=mentors[0].id,
                    status="forming"
                ),
                Team(
                    cohort_id=cohort.id,
                    name="Team Beta",
                    brief_title="Design a Fitness Tracker",
                    brief_description="Design and build a comprehensive fitness tracking platform",
                    mentor_id=mentors[1].id,
                    status="forming"
                )
            ]
            db.add_all(teams)
            await db.flush()
            print(f"✓ Created {len(teams)} teams")

            # Create sample applicants
            applicants = [
                Applicant(
                    cohort_id=cohort.id,
                    email="alex.johnson@example.com",
                    name="Alex Johnson",
                    role="frontend",
                    status="applied",
                    portfolio_url="https://alexjohnson.dev",
                    github_url="https://github.com/alexjohnson",
                    project_description="Built several React applications including an e-commerce platform and a social media dashboard. Strong focus on performance optimization and accessibility.",
                    time_commitment=True,
                    source="linkedin",
                    applied_at=datetime.now() - timedelta(days=2)
                ),
                Applicant(
                    cohort_id=cohort.id,
                    email="maria.garcia@example.com",
                    name="Maria Garcia",
                    role="product_designer",
                    status="applied",
                    portfolio_url="https://mariagarcia.design",
                    github_url=None,
                    project_description="UX/UI designer with 2 years experience. Portfolio includes mobile app designs for fintech and healthcare. Focused on user research and iterative design.",
                    time_commitment=True,
                    source="twitter",
                    applied_at=datetime.now() - timedelta(days=1)
                ),
                Applicant(
                    cohort_id=cohort.id,
                    email="kevin.chen@example.com",
                    name="Kevin Chen",
                    role="backend",
                    status="microship_pending",
                    portfolio_url="https://kevinchen.io",
                    github_url="https://github.com/kevinchen",
                    project_description="Built RESTful APIs using Node.js and Python. Experience with PostgreSQL, MongoDB, and Redis. Interested in distributed systems and scalability.",
                    time_commitment=True,
                    source="referral",
                    applied_at=datetime.now() - timedelta(days=5)
                ),
                Applicant(
                    cohort_id=cohort.id,
                    email="lisa.patel@example.com",
                    name="Lisa Patel",
                    role="product_manager",
                    status="applied",
                    portfolio_url="https://lisapatel.com",
                    github_url=None,
                    project_description="Aspiring PM with background in business analytics. Led university project coordinating 10-person team. Strong documentation and stakeholder communication skills.",
                    time_commitment=True,
                    source="website",
                    applied_at=datetime.now() - timedelta(hours=12)
                ),
                Applicant(
                    cohort_id=cohort.id,
                    email="tom.wilson@example.com",
                    name="Tom Wilson",
                    role="frontend",
                    status="applied",
                    portfolio_url="https://tomwilson.dev",
                    github_url="https://github.com/tomwilson",
                    project_description="Self-taught developer. Built personal projects using Vue.js and TypeScript. Working through freeCodeCamp curriculum.",
                    time_commitment=True,
                    source="linkedin",
                    applied_at=datetime.now() - timedelta(hours=6)
                )
            ]
            db.add_all(applicants)
            await db.flush()
            print(f"✓ Created {len(applicants)} applicants")

            # Create a sample microship submission
            microship = MicroshipSubmission(
                applicant_id=applicants[2].id,  # Kevin Chen
                challenge_id="MICROSHIP_2025_Q1",
                submission_url="https://github.com/kevinchen/microship-challenge",
                submission_type="github",
                submitted_at=datetime.now() - timedelta(hours=2),
                deadline=datetime.now() + timedelta(hours=22),
                on_time=True,
                acknowledgment_time=datetime.now() - timedelta(days=1, hours=1),
                communication_log=[
                    {
                        "timestamp": str(datetime.now() - timedelta(days=1, hours=1)),
                        "type": "email",
                        "content": "Acknowledged challenge receipt. Clarified a requirement about API endpoints."
                    },
                    {
                        "timestamp": str(datetime.now() - timedelta(hours=12)),
                        "type": "email",
                        "content": "Provided progress update. Mentioned encountering and resolving a CORS issue."
                    }
                ]
            )
            db.add(microship)
            print(f"✓ Created microship submission for {applicants[2].name}")

            # Create track configs
            backend_track = ChallengeTrackConfig(
                cohort_id=cohort.id,
                role_type="backend",
                total_challenges=3,
            )
            designer_track = ChallengeTrackConfig(
                cohort_id=cohort.id,
                role_type="product_designer",
                total_challenges=2,
            )
            frontend_track = ChallengeTrackConfig(
                cohort_id=cohort.id,
                role_type="frontend",
                total_challenges=3,
            )
            db.add_all([backend_track, designer_track, frontend_track])
            await db.flush()
            print(f"✓ Created 3 track configs (Backend: 3, Product Designer: 2, Frontend: 3)")

            # Create sample challenges linked to tracks
            challenges = [
                Challenge(
                    cohort_id=cohort.id,
                    title="Backend API Challenge",
                    description="Build a RESTful API for a task management system. The API should support CRUD operations for tasks, user authentication, and proper error handling. Use Python/FastAPI or Node.js/Express.",
                    requirements=[
                        "Implement CRUD endpoints for tasks (create, read, update, delete)",
                        "Add user authentication with JWT tokens",
                        "Include input validation and error handling",
                        "Write at least 3 unit tests",
                        "Provide a README with setup instructions",
                    ],
                    role_type="backend",
                    submission_types=["github"],
                    deadline=datetime.now() + timedelta(days=7),
                    status="active",
                    share_token=secrets.token_urlsafe(32),
                    track_config_id=backend_track.id,
                    sequence_number=1,
                    duration_hours=24,
                ),
                Challenge(
                    cohort_id=cohort.id,
                    title="Database Design Challenge",
                    description="Design and implement a database schema for an e-commerce platform. Include proper normalization, indexing strategies, and write migration scripts.",
                    requirements=[
                        "Design an ER diagram with at least 6 tables",
                        "Write SQL migration scripts",
                        "Include sample seed data",
                        "Document indexing strategy",
                    ],
                    role_type="backend",
                    submission_types=["github"],
                    deadline=datetime.now() + timedelta(days=5),
                    status="draft",
                    share_token=secrets.token_urlsafe(32),
                    track_config_id=backend_track.id,
                    sequence_number=2,
                    duration_hours=36,
                ),
                Challenge(
                    cohort_id=cohort.id,
                    title="Product Design Challenge",
                    description="Design a mobile-first onboarding flow for a fitness tracking app. Create high-fidelity mockups for at least 5 screens covering signup, goal setting, and the main dashboard.",
                    requirements=[
                        "Create a user flow diagram",
                        "Design at least 5 high-fidelity screens",
                        "Include a style guide (colors, typography, components)",
                        "Write brief UX rationale for key decisions",
                        "Export as Figma link or PDF",
                    ],
                    role_type="product_designer",
                    submission_types=["figma", "document"],
                    deadline=datetime.now() + timedelta(days=5),
                    status="active",
                    share_token=secrets.token_urlsafe(32),
                    track_config_id=designer_track.id,
                    sequence_number=1,
                    duration_hours=24,
                ),
                Challenge(
                    cohort_id=cohort.id,
                    title="Frontend Dashboard Challenge",
                    description="Build a responsive dashboard component using React/Next.js and Tailwind CSS. The dashboard should display sample data with charts, tables, and filtering capabilities.",
                    requirements=[
                        "Use React or Next.js with TypeScript",
                        "Style with Tailwind CSS",
                        "Include at least one chart/visualization",
                        "Implement responsive design (mobile + desktop)",
                        "Add data filtering functionality",
                    ],
                    role_type="frontend",
                    submission_types=["github"],
                    deadline=datetime.now() + timedelta(days=7),
                    status="active",
                    share_token=secrets.token_urlsafe(32),
                    track_config_id=frontend_track.id,
                    sequence_number=1,
                    duration_hours=12,
                ),
            ]
            db.add_all(challenges)
            await db.flush()
            print(f"✓ Created {len(challenges)} challenges (with track assignments)")

            # Link Kevin's microship to a challenge
            microship.challenge_ref = challenges[0].id

            await db.commit()
            print("\n✅ Database seeded successfully!")
            print(f"\n📊 Summary:")
            print(f"   - Cohorts: 1")
            print(f"   - Mentors: {len(mentors)}")
            print(f"   - Teams: {len(teams)}")
            print(f"   - Applicants: {len(applicants)}")
            print(f"   - Microship Submissions: 1")
            print(f"   - Track Configs: 3 (Backend: 3, Product Designer: 2, Frontend: 3)")
            print(f"   - Challenges: {len(challenges)}")
            for c in challenges:
                seq_info = f" [#{c.sequence_number}]" if c.sequence_number else ""
                dur_info = f" ({c.duration_hours}h)" if c.duration_hours else ""
                print(f"     [{c.status}]{seq_info}{dur_info} {c.title}")
                if c.status == 'active':
                    print(f"       Link: /submit/{c.share_token}")
            print(f"\n🚀 You can now test the screening agent with these applicants!")

        except Exception as e:
            print(f"\n❌ Error seeding database: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(seed_database())
