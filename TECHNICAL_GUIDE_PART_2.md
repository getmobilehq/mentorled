# MentorLed Platform - Technical Guide (Part 2/6)
## Authentication Flow Deep Dive

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 2)

1. [Authentication Architecture](#authentication-architecture)
2. [JWT Token System](#jwt-token-system)
3. [Password Security](#password-security)
4. [Role-Based Access Control (RBAC)](#role-based-access-control)
5. [Backend Authentication Implementation](#backend-authentication-implementation)
6. [Frontend Authentication Implementation](#frontend-authentication-implementation)
7. [Authentication Flows](#authentication-flows)
8. [Security Considerations](#security-considerations)

---

## 1. Authentication Architecture

### 1.1 Overview

MentorLed uses a **stateless JWT-based authentication** system with:
- Access tokens (short-lived, 30 minutes)
- Refresh tokens (long-lived, 7 days)
- Automatic token refresh
- Role-based access control (RBAC)
- Permission-based access control

### 1.2 Authentication Components

**Backend Components**:
1. **User Model** (`models/user.py`) - Database representation
2. **Security Module** (`core/security.py`) - JWT & password utilities
3. **Auth Module** (`core/auth.py`) - Middleware & RBAC decorators
4. **Auth API** (`api/auth.py`) - Authentication endpoints

**Frontend Components**:
1. **AuthContext** (`contexts/AuthContext.tsx`) - Global auth state
2. **ProtectedRoute** (`components/auth/ProtectedRoute.tsx`) - Route guards
3. **AppLayout** (`components/layout/AppLayout.tsx`) - Protected layout
4. **Axios Interceptors** - Automatic token handling

### 1.3 Authentication State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    UNAUTHENTICATED                          │
│  - No tokens in localStorage                                │
│  - user = null in AuthContext                               │
│  - All protected routes redirect to /login                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User submits login form
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATING                           │
│  - POST /api/auth/login                                     │
│  - Backend validates credentials                            │
│  - Backend generates tokens                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
              Valid │               │ Invalid
                    ↓               ↓
┌──────────────────────────────┐  ┌────────────────────────┐
│      AUTHENTICATED           │  │   LOGIN FAILED         │
│  - Tokens stored             │  │  - Show error message  │
│  - user set in context       │  │  - Retry login         │
│  - Redirect to dashboard     │  └────────────────────────┘
└──────────────────────────────┘
                    │
                    │ Access protected resources
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                    MAKING REQUESTS                          │
│  - All requests include: Authorization: Bearer <token>     │
│  - Backend validates token on each request                  │
│  - If valid → Return data                                   │
│  - If expired → Return 401                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
              Valid │               │ 401 Unauthorized
                    ↓               ↓
         ┌─────────────────┐  ┌────────────────────────────┐
         │  Continue using │  │   AUTO-REFRESH             │
         │  the app        │  │  - Interceptor catches 401 │
         └─────────────────┘  │  - POST /api/auth/refresh  │
                              │  - Get new access token    │
                              │  - Retry original request  │
                              └────────────────────────────┘
                                          │
                                  ┌───────┴───────┐
                                  │               │
                            Valid │               │ Refresh failed
                                  ↓               ↓
                     ┌─────────────────────┐  ┌──────────────────┐
                     │  Token refreshed    │  │   LOGOUT         │
                     │  Continue using app │  │  - Clear tokens  │
                     └─────────────────────┘  │  - Redirect login│
                                              └──────────────────┘
```

---

## 2. JWT Token System

### 2.1 What is JWT?

**JWT (JSON Web Token)** is a compact, URL-safe token format that contains:
- **Header**: Algorithm and token type
- **Payload**: Claims (user data)
- **Signature**: Cryptographic signature to verify authenticity

**Structure**:
```
header.payload.signature
```

**Example JWT**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Decoded Payload**:
```json
{
  "sub": "uuid-of-user",
  "exp": 1735123456,
  "type": "access"
}
```

### 2.2 Token Types

MentorLed uses **two types of tokens**:

#### Access Token
- **Purpose**: Authenticate API requests
- **Lifetime**: 30 minutes
- **Storage**: localStorage
- **Usage**: Sent with every API request
- **Payload**:
  ```json
  {
    "sub": "user-uuid",
    "exp": 1735123456,
    "type": "access"
  }
  ```

#### Refresh Token
- **Purpose**: Obtain new access tokens
- **Lifetime**: 7 days
- **Storage**: localStorage
- **Usage**: Only sent to /api/auth/refresh endpoint
- **Payload**:
  ```json
  {
    "sub": "user-uuid",
    "exp": 1735678901,
    "type": "refresh"
  }
  ```

### 2.3 Token Generation (Backend)

**File**: `backend/app/core/security.py`

```python
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from jose import jwt

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing claims (e.g., {"sub": "user-id"})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()

    # Calculate expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Add expiration and token type to payload
    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    # Encode and sign the token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT refresh token.

    Args:
        data: Dictionary containing claims (e.g., {"sub": "user-id"})

    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

**How it works**:
1. Takes user data (e.g., user ID) as input
2. Copies data to avoid mutation
3. Adds expiration time to payload
4. Adds token type ("access" or "refresh")
5. Encodes payload with secret key using HS256 algorithm
6. Returns signed JWT string

### 2.4 Token Validation (Backend)

**File**: `backend/app/core/security.py`

```python
from jose import JWTError

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT string to decode

    Returns:
        Decoded payload if valid, None if invalid
    """
    try:
        # Decode token with secret key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        # Invalid token (expired, wrong signature, malformed)
        print(f"JWT Error: {e}")
        return None
```

**Validation checks performed**:
1. **Signature verification**: Ensures token wasn't tampered with
2. **Expiration check**: Ensures token hasn't expired
3. **Algorithm check**: Ensures correct algorithm was used

**What happens on validation**:
- ✅ **Valid**: Returns decoded payload
- ❌ **Invalid signature**: Returns None
- ❌ **Expired**: Returns None
- ❌ **Malformed**: Returns None

### 2.5 Token Usage in Requests

**Client → Server**:
```http
GET /api/applicants HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Server validates**:
1. Extract token from `Authorization` header
2. Decode token with secret key
3. Verify signature and expiration
4. Extract user ID from `sub` claim
5. Query database for user
6. Check if user is active
7. If all checks pass → Allow request

---

## 3. Password Security

### 3.1 Password Hashing

MentorLed uses **bcrypt** for password hashing:
- Industry-standard algorithm
- Built-in salting (random data added to password)
- Computationally expensive (prevents brute-force attacks)
- Adaptive (cost factor can be increased over time)

### 3.2 Hash Generation

**File**: `backend/app/core/security.py`

```python
import bcrypt

def get_password_hash(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.

    Args:
        password: Plain-text password string

    Returns:
        Hashed password (bcrypt format)

    Example:
        >>> hash = get_password_hash("admin123")
        >>> print(hash)
        '$2b$12$AbCdEf...'
    """
    # Generate a random salt
    salt = bcrypt.gensalt()

    # Hash the password with the salt
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)

    # Decode bytes to string for database storage
    return hashed.decode('utf-8')
```

**What happens**:
1. `bcrypt.gensalt()` generates a random salt (e.g., `$2b$12$AbCdEf...`)
2. `bcrypt.hashpw()` combines password + salt and hashes them
3. Result is a string like: `$2b$12$salt...hash...`

**Key properties**:
- **Same password, different hashes**: Due to random salt
  ```python
  hash1 = get_password_hash("admin123")  # $2b$12$ABC...
  hash2 = get_password_hash("admin123")  # $2b$12$XYZ...
  # hash1 != hash2 (different salts)
  ```
- **One-way**: Cannot reverse hash to get original password
- **Deterministic verification**: Can verify password against hash

### 3.3 Password Verification

**File**: `backend/app/core/security.py`

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a hashed password.

    Args:
        plain_password: User-provided password
        hashed_password: Stored password hash from database

    Returns:
        True if password matches, False otherwise

    Example:
        >>> stored_hash = "$2b$12$..."
        >>> verify_password("admin123", stored_hash)
        True
        >>> verify_password("wrongpass", stored_hash)
        False
    """
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
    )
```

**How verification works**:
1. Extract salt from stored hash
2. Hash the plain password with the same salt
3. Compare the new hash with the stored hash
4. Return True if they match, False otherwise

**Security benefits**:
- Password never stored in plain text
- Even if database is compromised, passwords remain secure
- Each user has a unique salt

### 3.4 Password Storage

**Database Schema** (`models/user.py`):
```python
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)  # Stores bcrypt hash
    full_name = Column(String, nullable=False)
    # ... other fields
```

**Example stored hash**:
```
$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqgOZ1nEpu
```

**Format breakdown**:
- `$2b$` - bcrypt version
- `12$` - Cost factor (2^12 iterations)
- `LQv3c1yqBWVHxkd0LHAkCO` - Salt (22 chars)
- `Yz6TtxMQJqhN8/LewY5GyYqgOZ1nEpu` - Hash (31 chars)

---

## 4. Role-Based Access Control (RBAC)

### 4.1 User Roles

MentorLed defines **5 user roles** with hierarchical permissions:

| Role | Level | Description | Permissions |
|------|-------|-------------|-------------|
| **admin** | 5 (highest) | Full system access | All operations |
| **program_manager** | 4 | Manage program operations | CRUD applicants, fellows, delivery, placement |
| **mentor** | 3 | View and guide fellows | Read fellows, update delivery plans |
| **fellow** | 2 | View own information | Read own profile, opportunities |
| **readonly** | 1 (lowest) | View-only access | Read-only access to public data |

### 4.2 Role Definition (Backend)

**File**: `backend/app/models/user.py`

```python
import enum
from sqlalchemy import Column, String, Enum as SQLEnum

class UserRole(str, enum.Enum):
    """
    User role enumeration.

    Defines the 5 roles with increasing privilege levels.
    """
    ADMIN = "admin"
    PROGRAM_MANAGER = "program_manager"
    MENTOR = "mentor"
    FELLOW = "fellow"
    READONLY = "readonly"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.READONLY)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)  # Bypass all checks
    permissions = Column(ARRAY(String), default=list, nullable=True)  # Custom permissions
    # ... other fields
```

### 4.3 Permission Checking (Backend)

**File**: `backend/app/core/auth.py`

#### Get Current User (Dependency)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.core.security import decode_token
from app.database import get_db

# Security scheme for extracting Bearer token from header
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Extract and validate JWT token, return authenticated user.

    This dependency is used in all protected endpoints.

    Args:
        credentials: Extracted from Authorization header
        db: Database session

    Returns:
        User object if authenticated

    Raises:
        HTTPException 401 if token invalid or user not found
        HTTPException 401 if user is inactive
    """
    # Extract token from credentials
    token = credentials.credentials

    # Decode and validate token
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # Extract user ID from token
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Query database for user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )

    return user
```

#### Role-Based Access Decorator

```python
from typing import List
from app.models.user import User, UserRole

def require_role(*roles: UserRole):
    """
    Create a dependency that checks if user has one of the required roles.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(require_role(UserRole.ADMIN))
        ):
            return {"message": "Admin access granted"}

    Args:
        *roles: One or more required roles

    Returns:
        FastAPI dependency function
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        # Superusers bypass all role checks
        if current_user.is_superuser:
            return current_user

        # Check if user's role is in required roles
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {[r.value for r in roles]}",
            )

        return current_user

    return role_checker
```

### 4.4 Using RBAC in Endpoints

**Example 1: Public endpoint (no auth)**
```python
@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    # No authentication required
    # Anyone can access
    pass
```

**Example 2: Authenticated endpoint (any logged-in user)**
```python
@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    # Must be authenticated
    # Any role can access
    return current_user
```

**Example 3: Role-restricted endpoint (admin only)**
```python
@router.get("/users", dependencies=[Depends(require_role(UserRole.ADMIN))])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Must be authenticated AND have admin role
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users
```

**Example 4: Multiple roles allowed**
```python
@router.post("/applicants")
async def create_applicant(
    applicant_data: ApplicantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.PROGRAM_MANAGER))
):
    # Must be admin OR program_manager
    # Fellow/mentor/readonly cannot access
    pass
```

### 4.5 Permission Matrix

| Endpoint | Admin | Program Manager | Mentor | Fellow | Readonly |
|----------|-------|----------------|--------|--------|----------|
| **Authentication** |
| POST /auth/signup | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /auth/users | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Applicants** |
| GET /applicants | ✅ | ✅ | ✅ | ❌ | ✅ |
| POST /applicants | ✅ | ✅ | ❌ | ❌ | ❌ |
| PUT /applicants/{id} | ✅ | ✅ | ❌ | ❌ | ❌ |
| DELETE /applicants/{id} | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Fellows** |
| GET /fellows | ✅ | ✅ | ✅ | ✅* | ✅ |
| POST /fellows | ✅ | ✅ | ❌ | ❌ | ❌ |
| PUT /fellows/{id} | ✅ | ✅ | ✅** | ❌ | ❌ |
| **Screening** |
| POST /screening/screen | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /screening/results | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Delivery** |
| POST /delivery/generate | ✅ | ✅ | ✅ | ❌ | ❌ |
| PUT /delivery/{id} | ✅ | ✅ | ✅** | ❌ | ❌ |
| **Placement** |
| POST /placement/match | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /placement/matches | ✅ | ✅ | ✅ | ✅* | ✅ |

**Notes**:
- \* Fellow can only view their own data
- \*\* Mentor can only update data for assigned fellows

---

## 5. Backend Authentication Implementation

### 5.1 User Model

**File**: `backend/app/models/user.py` (complete)

```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROGRAM_MANAGER = "program_manager"
    MENTOR = "mentor"
    FELLOW = "fellow"
    READONLY = "readonly"

class User(Base):
    __tablename__ = "users"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Authentication
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)

    # Profile
    full_name = Column(String, nullable=False)

    # Authorization
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.READONLY)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    permissions = Column(ARRAY(String), default=list, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"
```

### 5.2 Authentication API Endpoints

**File**: `backend/app/api/auth.py` (key endpoints)

#### Signup Endpoint

```python
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: SignupRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user account.

    Request body:
    {
        "email": "user@example.com",
        "password": "securepass123",
        "full_name": "John Doe",
        "role": "fellow"  # optional, defaults to "readonly"
    }

    Response:
    {
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "token_type": "bearer",
        "user": {...}
    }
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    user = User(
        email=request.email,
        hashed_password=get_password_hash(request.password),
        full_name=request.full_name,
        role=UserRole(request.role) if request.role else UserRole.READONLY,
        is_active=True,
        is_superuser=False,
        permissions=[]
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "permissions": user.permissions
        }
    }
```

#### Login Endpoint

```python
@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return JWT tokens.

    Request body:
    {
        "email": "user@example.com",
        "password": "securepass123"
    }

    Response:
    {
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "token_type": "bearer",
        "user": {...}
    }
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # Verify user exists and password is correct
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    # Update last login timestamp
    user.last_login = datetime.utcnow()
    await db.commit()

    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "permissions": user.permissions
        }
    }
```

#### Token Refresh Endpoint

```python
@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    Request body:
    {
        "refresh_token": "eyJ..."
    }

    Response:
    {
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "token_type": "bearer"
    }
    """
    # Decode refresh token
    payload = decode_token(request.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Extract user ID
    user_id = payload.get("sub")

    # Verify user exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Generate new tokens
    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }
```

#### Get Current User Endpoint

```python
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information.

    Requires: Valid access token in Authorization header

    Response:
    {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "role": "fellow",
        "is_active": true,
        "is_superuser": false,
        "permissions": []
    }
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "permissions": current_user.permissions
    }
```

---

## 6. Frontend Authentication Implementation

### 6.1 AuthContext Provider

**File**: `frontend/contexts/AuthContext.tsx` (complete)

```typescript
'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Type definitions
interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, role?: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  isAuthenticated: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token management utilities
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
};

const getRefreshToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
};

const setTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          // Fetch current user with stored token
          const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setUser(response.data);
        } catch (error) {
          console.error('Failed to fetch user:', error);
          // Try to refresh token
          await refreshAccessToken();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      // Store tokens
      setTokens(access_token, refresh_token);

      // Update user state
      setUser(userData);

      // Redirect to dashboard
      router.push('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  // Signup function
  const signup = async (email: string, password: string, fullName: string, role?: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, {
        email,
        password,
        full_name: fullName,
        role: role || 'readonly',
      });

      const { access_token, refresh_token, user: userData } = response.data;

      setTokens(access_token, refresh_token);
      setUser(userData);
      router.push('/');
    } catch (error: any) {
      console.error('Signup failed:', error);
      throw new Error(error.response?.data?.detail || 'Signup failed');
    }
  };

  // Logout function
  const logout = () => {
    clearTokens();
    setUser(null);
    router.push('/login');
  };

  // Refresh access token
  const refreshAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;
      setTokens(access_token, newRefreshToken);

      // Fetch user with new token
      const userResponse = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      setUser(userResponse.data);
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshAccessToken,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export token getters for use in API calls
export { getAccessToken, getRefreshToken };
```

### 6.2 Axios Interceptors (Automatic Token Refresh)

**File**: `frontend/lib/axios.ts`

```typescript
import axios from 'axios';
import { getAccessToken, getRefreshToken } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Request interceptor: Add access token to all requests
axios.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Auto-refresh on 401
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          // Call refresh endpoint
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token: newRefreshToken } = response.data;

          // Update tokens in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', newRefreshToken);
          }

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
```

**How it works**:
1. **Request interceptor**: Automatically adds `Authorization: Bearer <token>` to every request
2. **Response interceptor**:
   - If response is 401 (Unauthorized)
   - And we haven't tried refreshing yet (`!originalRequest._retry`)
   - Try to refresh the access token
   - If refresh succeeds: Update tokens, retry original request
   - If refresh fails: Clear tokens, redirect to login

### 6.3 Protected Route Component

**File**: `frontend/components/auth/ProtectedRoute.tsx` (complete)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: string[];
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Check role requirement
  useEffect(() => {
    if (!loading && isAuthenticated && requireRole && user) {
      if (!requireRole.includes(user.role)) {
        // User doesn't have required role, redirect to dashboard
        router.push('/');
      }
    }
  }, [loading, isAuthenticated, user, requireRole, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Don't render if role requirement not met
  if (requireRole && user && !requireRole.includes(user.role)) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
```

### 6.4 AppLayout (Protected Layout Wrapper)

**File**: `frontend/components/layout/AppLayout.tsx`

```typescript
'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ProtectedRoute } from '../auth/ProtectedRoute';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
```

**Usage in pages**:
```typescript
// app/applicants/page.tsx
import { AppLayout } from '@/components/layout/AppLayout';

export default function ApplicantsPage() {
  return (
    <AppLayout>
      {/* Page content - automatically protected */}
      <div>Applicants content</div>
    </AppLayout>
  );
}
```

---

## 7. Authentication Flows

### 7.1 Login Flow (Step-by-Step)

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: User submits login form                             │
├──────────────────────────────────────────────────────────────┤
│ • User enters email and password on /login page              │
│ • Clicks "Sign In" button                                    │
│ • Form submission prevented (e.preventDefault())             │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend calls login function                       │
├──────────────────────────────────────────────────────────────┤
│ Code: await login(email, password);                          │
│                                                              │
│ Function: AuthContext.login()                                │
│ HTTP: POST http://localhost:8000/api/auth/login              │
│ Body: { email, password }                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Backend receives login request                      │
├──────────────────────────────────────────────────────────────┤
│ Endpoint: POST /api/auth/login                               │
│ Handler: api/auth.py::login()                                │
│                                                              │
│ Actions:                                                     │
│ 1. Query database for user by email                         │
│ 2. If not found → 401 error                                 │
│ 3. If found → verify_password(input, stored_hash)           │
│ 4. If wrong password → 401 error                            │
│ 5. If inactive user → 403 error                             │
│ 6. If valid → continue                                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Backend generates JWT tokens                        │
├──────────────────────────────────────────────────────────────┤
│ Access Token:                                                │
│ • Payload: { sub: user.id, exp: now + 30min, type: "access"}│
│ • Signed with SECRET_KEY                                     │
│                                                              │
│ Refresh Token:                                               │
│ • Payload: { sub: user.id, exp: now + 7days, type: "refresh"}│
│ • Signed with SECRET_KEY                                     │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Backend updates last_login and returns response     │
├──────────────────────────────────────────────────────────────┤
│ SQL: UPDATE users SET last_login = NOW() WHERE id = ?       │
│                                                              │
│ Response: 200 OK                                             │
│ {                                                            │
│   "access_token": "eyJ...",                                  │
│   "refresh_token": "eyJ...",                                 │
│   "token_type": "bearer",                                    │
│   "user": {                                                  │
│     "id": "uuid",                                            │
│     "email": "admin@mentorled.com",                          │
│     "full_name": "Admin User",                               │
│     "role": "admin",                                         │
│     "is_active": true,                                       │
│     "is_superuser": true,                                    │
│     "permissions": []                                        │
│   }                                                          │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Frontend receives and stores tokens                 │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ const { access_token, refresh_token, user } = response.data;│
│                                                              │
│ localStorage.setItem('access_token', access_token);          │
│ localStorage.setItem('refresh_token', refresh_token);        │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 7: Frontend updates auth state                         │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ setUser(userData);  // Update AuthContext state             │
│                                                              │
│ Result:                                                      │
│ • user state changes from null to User object               │
│ • isAuthenticated changes from false to true                │
│ • All components re-render with new auth state              │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 8: Redirect to dashboard                               │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ router.push('/');                                            │
│                                                              │
│ Result:                                                      │
│ • Browser navigates to http://localhost:3002/               │
│ • Dashboard page loads                                       │
│ • ProtectedRoute sees user is authenticated                  │
│ • Dashboard content renders                                  │
└──────────────────────────────────────────────────────────────┘
```

**Timeline**:
- Step 1-2: Instant (< 10ms)
- Step 3-5: Network + DB + crypto (~100-300ms)
- Step 6-7: Instant (< 10ms)
- Step 8: Route transition (~50-100ms)
- **Total**: ~200-500ms

### 7.2 Protected Page Access Flow

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: User navigates to protected page                    │
├──────────────────────────────────────────────────────────────┤
│ Action: User clicks "Applicants" in sidebar                 │
│ URL: http://localhost:3002/applicants                        │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Next.js router loads page component                 │
├──────────────────────────────────────────────────────────────┤
│ File: app/applicants/page.tsx                                │
│ Component tree:                                              │
│ ApplicantsPage                                               │
│   └─> ErrorBoundary                                          │
│        └─> ApplicantsPageContent                             │
│             └─> AppLayout                                    │
│                  └─> ProtectedRoute                          │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: ProtectedRoute checks authentication                │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ const { user, loading, isAuthenticated } = useAuth();       │
│                                                              │
│ Check 1: Is loading complete?                                │
│ • If loading → Show loading spinner                          │
│ • If not loading → Continue                                  │
│                                                              │
│ Check 2: Is user authenticated?                              │
│ • If !isAuthenticated → router.push('/login')               │
│ • If isAuthenticated → Continue                              │
│                                                              │
│ Check 3: Does user have required role? (if specified)       │
│ • If role doesn't match → router.push('/')                   │
│ • If role matches → Continue                                 │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Page component mounts and fetches data              │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ useEffect(() => {                                            │
│   fetchApplicants();                                         │
│ }, []);                                                      │
│                                                              │
│ HTTP Request:                                                │
│ GET http://localhost:8000/api/applicants                     │
│ Headers:                                                     │
│   Authorization: Bearer eyJ...                               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Backend validates token                             │
├──────────────────────────────────────────────────────────────┤
│ Endpoint: GET /api/applicants                                │
│ Dependency: current_user = Depends(get_current_user)        │
│                                                              │
│ Actions in get_current_user():                               │
│ 1. Extract token from Authorization header                  │
│ 2. Decode token with SECRET_KEY                              │
│ 3. Verify signature and expiration                           │
│ 4. Extract user_id from 'sub' claim                         │
│ 5. Query database for user                                   │
│ 6. Check if user is active                                   │
│ 7. If all valid → Return user object                        │
│ 8. If any invalid → Raise 401 error                         │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Backend queries applicants and returns data         │
├──────────────────────────────────────────────────────────────┤
│ SQL:                                                         │
│ SELECT * FROM applicants ORDER BY applied_at DESC;          │
│                                                              │
│ Response: 200 OK                                             │
│ [                                                            │
│   {                                                          │
│     "id": "uuid",                                            │
│     "name": "John Doe",                                      │
│     "email": "john@example.com",                             │
│     "role": "backend_engineer",                              │
│     "status": "applied",                                     │
│     ...                                                      │
│   },                                                         │
│   ...                                                        │
│ ]                                                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 7: Frontend receives data and renders page             │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ setApplicants(response.data);                                │
│ setLoading(false);                                           │
│                                                              │
│ Result:                                                      │
│ • Applicants table renders with data                         │
│ • Search/filter controls render                              │
│ • Pagination renders                                         │
│ • User can interact with page                                │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Token Refresh Flow (Automatic)

```
┌──────────────────────────────────────────────────────────────┐
│ SCENARIO: User has been active for 30+ minutes              │
│ • Access token has expired                                   │
│ • Refresh token is still valid (< 7 days old)               │
│ • User tries to fetch data                                   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend makes API request with expired token       │
├──────────────────────────────────────────────────────────────┤
│ HTTP: GET /api/applicants                                    │
│ Headers: Authorization: Bearer <expired_token>               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Backend validates token and returns 401             │
├──────────────────────────────────────────────────────────────┤
│ Code: decode_token(token) → Returns None (expired)          │
│                                                              │
│ Response: 401 Unauthorized                                   │
│ {                                                            │
│   "detail": "Invalid or expired token"                       │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Axios interceptor catches 401 error                 │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ axios.interceptors.response.use(                             │
│   (response) => response,                                    │
│   async (error) => {                                         │
│     if (error.response?.status === 401 &&                    │
│         !originalRequest._retry) {                           │
│       // Auto-refresh logic                                  │
│     }                                                        │
│   }                                                          │
│ );                                                           │
│                                                              │
│ Action:                                                      │
│ • Set originalRequest._retry = true (prevent infinite loop) │
│ • Get refresh_token from localStorage                        │
│ • Call refresh endpoint                                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Frontend calls refresh endpoint                     │
├──────────────────────────────────────────────────────────────┤
│ HTTP: POST /api/auth/refresh                                 │
│ Body: { refresh_token: "eyJ..." }                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Backend validates refresh token and generates new   │
│         tokens                                               │
├──────────────────────────────────────────────────────────────┤
│ Actions:                                                     │
│ 1. Decode refresh_token                                      │
│ 2. Verify type === "refresh"                                 │
│ 3. Extract user_id from 'sub'                                │
│ 4. Query database for user                                   │
│ 5. Verify user is active                                     │
│ 6. Generate new access_token (30min)                         │
│ 7. Generate new refresh_token (7 days)                       │
│                                                              │
│ Response: 200 OK                                             │
│ {                                                            │
│   "access_token": "eyJ...",                                  │
│   "refresh_token": "eyJ...",                                 │
│   "token_type": "bearer"                                     │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Interceptor updates tokens in localStorage          │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ localStorage.setItem('access_token', access_token);          │
│ localStorage.setItem('refresh_token', newRefreshToken);      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 7: Interceptor retries original request with new token │
├──────────────────────────────────────────────────────────────┤
│ Code:                                                        │
│ originalRequest.headers.Authorization = `Bearer ${new_token}`;│
│ return axios(originalRequest);                               │
│                                                              │
│ HTTP: GET /api/applicants (RETRY)                            │
│ Headers: Authorization: Bearer <new_token>                   │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 8: Backend validates new token and returns data        │
├──────────────────────────────────────────────────────────────┤
│ Token validation: ✅ Valid                                   │
│                                                              │
│ Response: 200 OK                                             │
│ [{ applicant data... }]                                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 9: Frontend receives data and updates UI               │
├──────────────────────────────────────────────────────────────┤
│ Result:                                                      │
│ • User never saw an error                                    │
│ • Data loads normally                                        │
│ • Tokens silently refreshed in background                    │
│ • User can continue working seamlessly                       │
└──────────────────────────────────────────────────────────────┘
```

**Key Points**:
- Entire refresh process is automatic and invisible to user
- No interruption to user experience
- Only happens when access token expires
- If refresh token also expired → User redirected to login

---

## 8. Security Considerations

### 8.1 Current Security Measures

✅ **Password Security**:
- bcrypt hashing with automatic salting
- Passwords never stored in plain text
- Cannot reverse hash to get original password

✅ **Token Security**:
- JWT signed with secret key (prevents tampering)
- Short-lived access tokens (30 min)
- Separate refresh tokens for renewal
- Token type validation ("access" vs "refresh")
- Expiration time enforcement

✅ **API Security**:
- Authentication required for all protected endpoints
- Role-based access control (RBAC)
- User activity validation (is_active check)
- SQL injection prevention (SQLAlchemy ORM)

✅ **CORS Configuration**:
- Restricted origins (only frontend allowed)
- Credentials allowed for cookies/auth headers
- Specific methods and headers allowed

✅ **Input Validation**:
- Pydantic schemas validate all request data
- Type checking prevents invalid data
- Email format validation
- Password strength requirements (can be added)

### 8.2 Security Recommendations for Production

⚠️ **IMPORTANT: Before deploying to production:**

1. **Environment Variables**:
   - Change `JWT_SECRET_KEY` to a strong, random value (64+ characters)
   - Use secrets management (AWS Secrets Manager, Azure Key Vault)
   - Never commit secrets to git

2. **HTTPS Only**:
   - Enable HTTPS for both frontend and backend
   - Set `secure=True` on cookies
   - Add HSTS headers

3. **Token Storage**:
   - Consider using httpOnly cookies instead of localStorage
   - Prevents XSS attacks from stealing tokens
   - Requires backend cookie handling

4. **Password Requirements**:
   - Minimum length (8+ characters)
   - Complexity requirements (uppercase, lowercase, numbers, symbols)
   - Password strength meter on signup

5. **Rate Limiting**:
   - Limit login attempts (5 tries per 15 minutes)
   - Limit API requests per user
   - Prevent brute-force attacks

6. **Account Security**:
   - Email verification on signup
   - Password reset flow
   - Two-factor authentication (2FA)
   - Account lockout after failed attempts

7. **Session Management**:
   - Track active sessions
   - Allow users to revoke sessions
   - Logout from all devices
   - Session timeout on inactivity

8. **Database Security**:
   - Use database user with minimal permissions
   - Enable SSL for database connections
   - Regular backups
   - Encrypt sensitive data at rest

9. **Logging & Monitoring**:
   - Log all authentication events
   - Monitor for suspicious activity
   - Alert on unusual patterns
   - Audit log retention

10. **API Security Headers**:
    - X-Content-Type-Options
    - X-Frame-Options
    - Content-Security-Policy
    - X-XSS-Protection

### 8.3 Common Attack Vectors & Mitigations

**SQL Injection**:
- ✅ Mitigated: Using SQLAlchemy ORM (parameterized queries)
- All user input properly escaped

**Cross-Site Scripting (XSS)**:
- ✅ Mitigated: React escapes all rendered content by default
- Recommendation: Add Content-Security-Policy headers

**Cross-Site Request Forgery (CSRF)**:
- ⚠️ Partial: CORS restricts origins
- Recommendation: Add CSRF tokens for state-changing operations

**Brute Force Attacks**:
- ⚠️ Not fully mitigated
- Recommendation: Implement rate limiting on login endpoint

**Session Hijacking**:
- ✅ Mitigated: Short-lived access tokens
- Recommendation: Use httpOnly cookies, HTTPS only

**Man-in-the-Middle (MITM)**:
- ⚠️ Vulnerable in development (HTTP)
- Recommendation: HTTPS in production

---

## Summary (Part 2)

This part covered the **authentication flow deep dive**:

✅ JWT token system (access + refresh tokens)
✅ Password security (bcrypt hashing)
✅ Role-based access control (5 roles)
✅ Backend authentication implementation (User model, endpoints, middleware)
✅ Frontend authentication implementation (AuthContext, ProtectedRoute, interceptors)
✅ Detailed authentication flows (login, protected access, token refresh)
✅ Security considerations and production recommendations

**Next in Part 3**: Backend APIs & Database
- Complete API endpoint documentation
- Database schema deep dive
- SQLAlchemy models and relationships
- API design patterns
- Data validation with Pydantic
- Database migrations with Alembic

---

**Navigation**:
- Part 1 - System Overview & Architecture ✓
- **Current**: Part 2 - Authentication Flow Deep Dive ✓
- **Next**: Part 3 - Backend APIs & Database
- Part 4 - Frontend Components & State Management
- Part 5 - AI Agents & Workflows
- Part 6 - Deployment & Production Readiness
