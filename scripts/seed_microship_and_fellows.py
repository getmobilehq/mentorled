#!/usr/bin/env python3
"""
Seed microship submissions and fellows for testing
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
if not backend_path.exists():
    # Running in Docker container, use /app
    backend_path = Path("/app")
sys.path.insert(0, str(backend_path))

from app.database import AsyncSessionLocal
from app.models.applicant import Applicant
from app.models.cohort import Cohort
from app.models.fellow import Fellow
from app.models.microship import MicroshipSubmission
from sqlalchemy import select


async def seed_microship_and_fellows():
    """Seed microship submissions and create sample fellows"""
    async with AsyncSessionLocal() as session:
        # Get existing applicants and cohort
        result = await session.execute(select(Applicant))
        applicants = list(result.scalars().all())

        result = await session.execute(select(Cohort))
        cohort = result.scalar_one()

        if not applicants:
            print("❌ No applicants found. Run seed_data.py first!")
            return

        print(f"Found {len(applicants)} applicants")
        print(f"Cohort: {cohort.name}")

        # Create microship submissions for 3 applicants
        microship_data = [
            {
                "applicant": applicants[0],
                "submission_url": "https://github.com/tomwilson/mentorled-microship",
                "submission_type": "github",
                "on_time": True,
                "acknowledgment_time": datetime.utcnow() - timedelta(hours=2),
                "communication_log": [
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=48)).isoformat(),
                        "type": "email_sent",
                        "content": "Microship challenge sent"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=46)).isoformat(),
                        "type": "email_received",
                        "content": "Acknowledged - will submit by deadline"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                        "type": "submission_received",
                        "content": "Submitted GitHub repo"
                    }
                ]
            },
            {
                "applicant": applicants[1],
                "submission_url": "https://www.figma.com/file/abc123/mentorled-design",
                "submission_type": "figma",
                "on_time": True,
                "acknowledgment_time": datetime.utcnow() - timedelta(hours=4),
                "communication_log": [
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=48)).isoformat(),
                        "type": "email_sent",
                        "content": "Microship challenge sent"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=40)).isoformat(),
                        "type": "email_received",
                        "content": "Quick question about design requirements"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=38)).isoformat(),
                        "type": "email_sent",
                        "content": "Answered design question"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=4)).isoformat(),
                        "type": "submission_received",
                        "content": "Submitted Figma design"
                    }
                ]
            },
            {
                "applicant": applicants[2],
                "submission_url": "https://github.com/mariagarcia/pm-challenge",
                "submission_type": "document",
                "on_time": False,
                "acknowledgment_time": datetime.utcnow() - timedelta(hours=24),
                "communication_log": [
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=72)).isoformat(),
                        "type": "email_sent",
                        "content": "Microship challenge sent"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=24)).isoformat(),
                        "type": "email_received",
                        "content": "Sorry for delay, submitting now"
                    },
                    {
                        "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                        "type": "submission_received",
                        "content": "Submitted PRD document (late)"
                    }
                ]
            }
        ]

        # Check if microship submissions already exist
        result = await session.execute(select(MicroshipSubmission))
        existing = result.scalars().all()

        if not existing:
            print("\n📦 Creating microship submissions...")
            for data in microship_data:
                submission = MicroshipSubmission(
                    applicant_id=data["applicant"].id,
                    submission_url=data["submission_url"],
                    submission_type=data["submission_type"],
                    submitted_at=datetime.utcnow(),
                    deadline=datetime.utcnow() + timedelta(days=2),
                    on_time=data["on_time"],
                    acknowledgment_time=data["acknowledgment_time"],
                    communication_log=data["communication_log"]
                )
                session.add(submission)
                print(f"  ✅ Created microship for {data['applicant'].name}")
        else:
            print(f"\n✓ Microship submissions already exist ({len(existing)} found)")

        # Create 3 fellows from the first 3 applicants
        result = await session.execute(select(Fellow))
        existing_fellows = result.scalars().all()

        if not existing_fellows:
            print("\n👥 Creating fellows...")
            fellow_data = [
                {
                    "applicant": applicants[0],
                    "status": "active",
                    "milestone_1_score": 0.85,  # Numeric(3,2) expects 0.00-9.99
                    "milestone_2_score": 0.78,
                },
                {
                    "applicant": applicants[1],
                    "status": "active",
                    "milestone_1_score": 0.92,
                    "milestone_2_score": 0.88,
                },
                {
                    "applicant": applicants[2],
                    "status": "at_risk",
                    "milestone_1_score": 0.65,
                    "milestone_2_score": None,
                }
            ]

            for data in fellow_data:
                # Update applicant status
                applicant = data["applicant"]
                applicant.status = "accepted"

                # Create fellow
                fellow = Fellow(
                    applicant_id=applicant.id,
                    cohort_id=cohort.id,
                    role=applicant.role,
                    status=data["status"],
                    milestone_1_score=data["milestone_1_score"],
                    milestone_2_score=data["milestone_2_score"],
                    warnings_count=0,
                    started_at=datetime.utcnow()
                )
                session.add(fellow)
                print(f"  ✅ Created fellow: {applicant.name} ({data['status']})")
        else:
            print(f"\n✓ Fellows already exist ({len(existing_fellows)} found)")

        await session.commit()

        print("\n" + "="*60)
        print("✅ Microship and Fellows seeding complete!")
        print("="*60)
        print("\nYou can now test:")
        print("  • Microship evaluation at http://localhost:3000/microship")
        print("  • Fellows page at http://localhost:3000/fellows")
        print("  • Risk assessment at http://localhost:3000/delivery")
        print("  • Profile generation at http://localhost:3000/placement")


if __name__ == "__main__":
    asyncio.run(seed_microship_and_fellows())
