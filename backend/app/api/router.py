from fastapi import APIRouter
from app.api import screening, applicants, cohorts, fellows, delivery, placement, microship, challenges, track_configs, check_ins, risk, warnings, bulk, analytics, auth, email_templates, sprints, meetings, attendance, teams, mentors, notifications, websocket, absence_requests

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
api_router.include_router(challenges.router, tags=["Challenges"])
api_router.include_router(track_configs.router, tags=["Track Configs"])
api_router.include_router(check_ins.router, tags=["Check-ins"])
api_router.include_router(risk.router, tags=["Risk"])
api_router.include_router(warnings.router, tags=["Warnings"])
api_router.include_router(bulk.router, tags=["Bulk Operations"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(email_templates.router, tags=["Email Templates"])
api_router.include_router(sprints.router, tags=["Sprints"])
api_router.include_router(meetings.router, tags=["Meetings"])
api_router.include_router(attendance.router, tags=["Attendance"])
api_router.include_router(teams.router, tags=["Teams"])
api_router.include_router(mentors.router, tags=["Mentors"])
api_router.include_router(notifications.router, tags=["Notifications"])
api_router.include_router(websocket.router, tags=["WebSocket"])
api_router.include_router(absence_requests.router, tags=["Absence Requests"])
