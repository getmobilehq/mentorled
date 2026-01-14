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
from app.models.team import Team

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

            await db.commit()
            print("\n✅ Database seeded successfully!")
            print(f"\n📊 Summary:")
            print(f"   - Cohorts: 1")
            print(f"   - Mentors: {len(mentors)}")
            print(f"   - Teams: {len(teams)}")
            print(f"   - Applicants: {len(applicants)}")
            print(f"   - Microship Submissions: 1")
            print(f"\n🚀 You can now test the screening agent with these applicants!")

        except Exception as e:
            print(f"\n❌ Error seeding database: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(seed_database())
