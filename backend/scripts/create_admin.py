"""Create an admin user for testing."""
import asyncio
import sys
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.database import get_db_session
from app.models.user import User, UserRole
from app.core.security import get_password_hash


async def create_admin_user():
    """Create a default admin user."""
    async for db in get_db_session():
        # Check if admin already exists
        result = await db.execute(
            select(User).where(User.email == "admin@mentorled.com")
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print("✅ Admin user already exists!")
            print(f"   Email: admin@mentorled.com")
            print(f"   Role: {existing_user.role.value}")
            return

        # Create admin user
        admin = User(
            email="admin@mentorled.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin User",
            role=UserRole.ADMIN,
            is_active=True,
            is_superuser=True
        )

        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        print("✅ Admin user created successfully!")
        print(f"   Email: admin@mentorled.com")
        print(f"   Password: admin123")
        print(f"   Role: {admin.role.value}")
        print(f"   ID: {admin.id}")
        print("\n🔐 You can now login with these credentials.")


if __name__ == "__main__":
    asyncio.run(create_admin_user())
