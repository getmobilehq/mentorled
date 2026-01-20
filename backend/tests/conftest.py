"""
Pytest configuration and fixtures for testing.
"""
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.utils.auth import hash_password, create_access_token

# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://mentorled:mentorled_dev@localhost:5432/mentorled_test"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db():
    """Create a test database and session."""
    # Create test engine
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session factory
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        yield session
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
async def client(test_db):
    """Create a test client."""
    async def override_get_db():
        yield test_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
async def test_admin_user(test_db):
    """Create a test admin user."""
    user = User(
        email="admin@test.com",
        username="testadmin",
        full_name="Test Admin",
        hashed_password=hash_password("adminpass123"),
        role="admin",
        is_active=True,
        is_verified=True
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def admin_token(test_admin_user):
    """Create an admin auth token."""
    token_data = {
        "user_id": str(test_admin_user.id),
        "username": test_admin_user.username,
        "role": test_admin_user.role
    }
    return create_access_token(token_data)


@pytest.fixture
async def test_viewer_user(test_db):
    """Create a test viewer user."""
    user = User(
        email="viewer@test.com",
        username="testviewer",
        full_name="Test Viewer",
        hashed_password=hash_password("viewerpass123"),
        role="viewer",
        is_active=True,
        is_verified=True
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user
