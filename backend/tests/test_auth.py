"""
Tests for authentication system.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_first_user(client: AsyncClient):
    """Test that first user becomes admin."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "first@test.com",
            "username": "firstuser",
            "full_name": "First User",
            "password": "password123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "first@test.com"
    assert data["username"] == "firstuser"
    assert data["role"] == "admin"  # First user should be admin
    assert data["is_verified"] is True  # First user auto-verified


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_admin_user):
    """Test that duplicate email is rejected."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": test_admin_user.email,
            "username": "newuser",
            "full_name": "New User",
            "password": "password123"
        }
    )
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_admin_user):
    """Test successful login."""
    response = await client.post(
        "/api/auth/login",
        json={
            "username": "testadmin",
            "password": "adminpass123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_admin_user):
    """Test login with wrong password."""
    response = await client.post(
        "/api/auth/login",
        json={
            "username": "testadmin",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, admin_token):
    """Test getting current user info."""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testadmin"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    """Test that protected endpoints reject unauthorized access."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 403
    assert "Not authenticated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_users_admin_only(client: AsyncClient, admin_token):
    """Test that only admins can list users."""
    response = await client.get(
        "/api/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
