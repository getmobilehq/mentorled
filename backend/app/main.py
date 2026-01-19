from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import engine, Base
from app.api.router import api_router
from app.services.scheduler import scheduler_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting MentorLed AI-Ops Platform...")
    logger.info(f"Database URL: {settings.DATABASE_URL.split('@')[-1]}")  # Don't log credentials

    # Create tables if they don't exist (dev only - use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database tables created/verified")

    # Start background scheduler
    scheduler_service.start()
    logger.info("Background scheduler started")

    logger.info("API ready to accept requests")
    yield

    # Shutdown
    logger.info("Shutting down MentorLed AI-Ops Platform...")
    scheduler_service.shutdown()
    logger.info("Scheduler shutdown complete")
    await engine.dispose()

app = FastAPI(
    title="MentorLed AI-Ops Platform",
    description="AI-augmented operations platform for scaling work-experience programs",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================================
# CORS Middleware Configuration
# ============================================================================
# CORS (Cross-Origin Resource Sharing) allows the frontend (running on a
# different port/origin) to make requests to this API.
#
# Why CORS is needed:
# - Browser security prevents cross-origin requests by default
# - Our frontend (localhost:3000/3001/3002) needs to call this API (localhost:8000)
# - Without CORS headers, the browser blocks these requests
#
# How it works:
# 1. Browser sends OPTIONS preflight request before POST/PUT/DELETE
# 2. CORSMiddleware automatically responds with proper Access-Control-* headers
# 3. Browser sees headers and allows the actual request to proceed
#
# Production configuration:
# - Update CORS_ORIGINS in .env to include your production frontend domain
# - Example: CORS_ORIGINS='["https://app.mentorled.com"]'
# - Never use ["*"] in production - be explicit about allowed origins
# - Consider setting allow_credentials=False if not using cookies
#
# Development alternative:
# - You can avoid CORS by proxying API requests through Next.js rewrites
# - In next.config.js: rewrites: [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]
# - This makes frontend and backend appear to be on the same origin
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    # Allow requests from these origins (configured via environment variable)
    # Defaults: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
    allow_origins=settings.CORS_ORIGINS,

    # Allow cookies and authorization headers to be sent cross-origin
    # Set to False if you're only using Authorization header (not cookies)
    allow_credentials=True,

    # Allow all HTTP methods (GET, POST, PUT, DELETE, OPTIONS, etc.)
    # In production, you might want to be more restrictive: ["GET", "POST", "PUT", "DELETE"]
    allow_methods=["*"],

    # Allow all headers in requests
    # This includes Content-Type, Authorization, and any custom headers
    # In production, you might want to be more restrictive: ["Content-Type", "Authorization"]
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "MentorLed AI-Ops Platform"
    }

@app.get("/")
async def root():
    return {
        "message": "MentorLed AI-Ops Platform API",
        "docs": "/docs",
        "health": "/health",
        "api": "/api"
    }
