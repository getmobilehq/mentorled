from fastapi import APIRouter
from app.api import screening, applicants, cohorts, fellows, delivery, placement, auth, microship, check_ins, risk, warnings

api_router = APIRouter()

# Include all sub-routers
api_router.include_router(auth.router)  # No prefix here, already has /auth in the router
api_router.include_router(screening.router, tags=["Screening"])
api_router.include_router(applicants.router, tags=["Applicants"])
api_router.include_router(cohorts.router, tags=["Cohorts"])
api_router.include_router(fellows.router, tags=["Fellows"])
api_router.include_router(delivery.router, tags=["Delivery"])
api_router.include_router(placement.router, tags=["Placement"])
api_router.include_router(microship.router, prefix="/microship", tags=["Microship"])
api_router.include_router(check_ins.router, tags=["Check-ins"])
api_router.include_router(risk.router, tags=["Risk"])
api_router.include_router(warnings.router, tags=["Warnings"])
