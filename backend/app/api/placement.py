from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.fellow import Fellow
from app.models.fellow_profile import FellowProfile
from app.models.job_opportunity import JobOpportunity
from app.models.placement_match import PlacementMatch
from app.agents.placement_agent import PlacementAgent

router = APIRouter(prefix="/placement")


class ProfileGenerateRequest(BaseModel):
    fellow_id: UUID


class OpportunityMatchRequest(BaseModel):
    fellow_id: UUID
    opportunity_ids: Optional[List[UUID]] = None


class IntroductionDraftRequest(BaseModel):
    match_id: UUID


class OpportunityCreateRequest(BaseModel):
    title: str
    employer_name: str
    employer_contact_email: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    remote_ok: bool = True


class OpportunityUpdateRequest(BaseModel):
    title: Optional[str] = None
    employer_name: Optional[str] = None
    employer_contact_email: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    remote_ok: Optional[bool] = None


class StatusUpdateRequest(BaseModel):
    status: str


class MatchStatusUpdateRequest(BaseModel):
    status: str


@router.post("/profile/generate")
async def generate_profile(
    request: ProfileGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate a professional profile for a fellow using AI."""
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.id == request.fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Build fellow_data dict for the agent
    fellow_data = {
        "name": fellow.applicant.name if fellow.applicant else "Fellow",
        "role": fellow.role,
        "project_description": fellow.applicant.project_description if fellow.applicant else "N/A",
        "portfolio_url": fellow.applicant.portfolio_url if fellow.applicant else "N/A",
        "github_url": fellow.applicant.github_url if fellow.applicant else "N/A",
        "team_project": {"title": "N/A", "description": "N/A", "contribution": "N/A"},
        "skills_demonstrated": [],
        "microship_score": str(fellow.microship_score) if fellow.microship_score else "N/A",
        "milestone_scores": {
            "milestone_1": str(fellow.milestone_1_score) if fellow.milestone_1_score else "N/A",
            "milestone_2": str(fellow.milestone_2_score) if fellow.milestone_2_score else "N/A",
        },
    }

    placement_agent = PlacementAgent()
    profile_data = await placement_agent.generate_profile(fellow.id, fellow_data)

    # Create or update profile using correct model fields
    result = await db.execute(
        select(FellowProfile).where(FellowProfile.fellow_id == request.fellow_id)
    )
    existing_profile = result.scalar_one_or_none()

    if existing_profile:
        existing_profile.headline = profile_data.get("headline", "")
        existing_profile.summary = profile_data.get("summary", "")
        existing_profile.skills = profile_data.get("skills")
        existing_profile.projects = profile_data.get("projects")
        existing_profile.linkedin_summary = profile_data.get("linkedin_summary", "")
        existing_profile.version = (existing_profile.version or 0) + 1
        profile = existing_profile
    else:
        profile = FellowProfile(
            fellow_id=fellow.id,
            headline=profile_data.get("headline", ""),
            summary=profile_data.get("summary", ""),
            skills=profile_data.get("skills"),
            projects=profile_data.get("projects"),
            linkedin_summary=profile_data.get("linkedin_summary", ""),
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)

    return {
        "profile_id": str(profile.id),
        "fellow_id": str(fellow.id),
        "profile": profile_data
    }


@router.post("/opportunities/match")
async def match_opportunities(
    request: OpportunityMatchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Match a fellow with job opportunities using AI."""
    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.id == request.fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    result = await db.execute(
        select(FellowProfile).where(FellowProfile.fellow_id == request.fellow_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No profile found. Generate profile first using /placement/profile/generate"
        )

    if request.opportunity_ids:
        query = select(JobOpportunity).where(
            JobOpportunity.id.in_(request.opportunity_ids),
            JobOpportunity.status == "active"
        )
    else:
        query = select(JobOpportunity).where(JobOpportunity.status == "active")

    result = await db.execute(query)
    opportunities = list(result.scalars().all())

    if not opportunities:
        raise HTTPException(status_code=404, detail="No active opportunities found")

    # Build dicts for the agent
    fellow_profile_dict = {
        "name": fellow.applicant.name if fellow.applicant else "Fellow",
        "role": fellow.role,
        "headline": profile.headline or "",
        "summary": profile.summary or "",
        "skills": profile.skills or [],
    }

    opportunities_dicts = [
        {
            "id": str(opp.id),
            "title": opp.title,
            "employer_name": opp.employer_name,
            "requirements": opp.requirements or [],
            "preferred_skills": opp.preferred_skills or [],
            "experience_level": opp.experience_level or "entry",
        }
        for opp in opportunities
    ]

    placement_agent = PlacementAgent()
    matches = await placement_agent.match_opportunities(
        fellow.id, fellow_profile_dict, opportunities_dicts
    )

    created_matches = []
    for match_data in matches:
        opportunity = next(
            (opp for opp in opportunities if str(opp.id) == match_data.get("opportunity_id")),
            None
        )
        if not opportunity:
            continue

        result = await db.execute(
            select(PlacementMatch).where(
                PlacementMatch.fellow_id == request.fellow_id,
                PlacementMatch.opportunity_id == opportunity.id
            )
        )
        existing_match = result.scalar_one_or_none()

        if existing_match:
            existing_match.match_score = match_data.get("match_score")
            existing_match.match_reasoning = match_data.get("reasoning", "")
            placement_match = existing_match
        else:
            placement_match = PlacementMatch(
                fellow_id=fellow.id,
                opportunity_id=opportunity.id,
                match_score=match_data.get("match_score"),
                match_reasoning=match_data.get("reasoning", ""),
                status="suggested"
            )
            db.add(placement_match)

        await db.flush()
        created_matches.append({
            "match_id": str(placement_match.id),
            "opportunity_id": str(opportunity.id),
            "opportunity_title": opportunity.title,
            "employer_name": opportunity.employer_name,
            "match_score": match_data.get("match_score", 0),
            "match_reasoning": match_data.get("reasoning", ""),
            "skill_gaps": match_data.get("gaps", []),
            "status": placement_match.status,
            "introduction_sent": placement_match.introduction_sent_at is not None,
        })

    await db.commit()

    return {
        "fellow_id": str(fellow.id),
        "matches_count": len(created_matches),
        "matches": created_matches
    }


@router.post("/introduction/draft")
async def draft_introduction(
    request: IntroductionDraftRequest,
    db: AsyncSession = Depends(get_db)
):
    """Draft an introduction email for a placement match using AI."""
    result = await db.execute(
        select(PlacementMatch).where(PlacementMatch.id == request.match_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    result = await db.execute(
        select(Fellow)
        .options(selectinload(Fellow.applicant))
        .where(Fellow.id == match.fellow_id)
    )
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    result = await db.execute(
        select(FellowProfile).where(FellowProfile.fellow_id == match.fellow_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    result = await db.execute(
        select(JobOpportunity).where(JobOpportunity.id == match.opportunity_id)
    )
    opportunity = result.scalar_one_or_none()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    # Build dicts for the agent
    fellow_profile_dict = {
        "name": fellow.applicant.name if fellow.applicant else "Fellow",
        "role": fellow.role,
        "headline": profile.headline or "",
        "summary": profile.summary or "",
        "projects": [
            {"description": p.get("description", "N/A")}
            for p in (profile.projects if isinstance(profile.projects, list) else [])
        ] if profile.projects else [],
    }

    opportunity_dict = {
        "employer_name": opportunity.employer_name,
        "title": opportunity.title,
        "requirements": opportunity.requirements or [],
    }

    placement_agent = PlacementAgent()
    draft = await placement_agent.draft_introduction(
        fellow.id, fellow_profile_dict, opportunity_dict
    )

    # Update match with draft using correct model field
    match.introduction_draft = draft.get("email_body", draft.get("email", ""))

    await db.commit()
    await db.refresh(match)

    return {
        "match_id": str(match.id),
        "fellow_id": str(fellow.id),
        "opportunity_id": str(opportunity.id),
        "draft": draft
    }


@router.get("/profiles")
async def list_profiles(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all fellow profiles."""
    query = select(FellowProfile)
    if cohort_id:
        query = query.join(Fellow).where(Fellow.cohort_id == cohort_id)

    result = await db.execute(query)
    profiles = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "fellow_id": str(p.fellow_id),
            "headline": p.headline,
            "summary": p.summary,
            "skills": p.skills,
            "projects": p.projects,
            "linkedin_summary": p.linkedin_summary,
            "generated_at": p.generated_at.isoformat() if p.generated_at else None,
            "version": p.version,
        }
        for p in profiles
    ]


@router.get("/opportunities")
async def list_opportunities(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all job opportunities."""
    query = select(JobOpportunity)
    if status:
        query = query.where(JobOpportunity.status == status)

    result = await db.execute(query.order_by(JobOpportunity.created_at.desc()))
    opportunities = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "title": o.title,
            "employer_name": o.employer_name,
            "employer_contact_email": o.employer_contact_email,
            "description": o.description,
            "requirements": o.requirements,
            "preferred_skills": o.preferred_skills,
            "experience_level": o.experience_level,
            "location": o.location,
            "remote_ok": o.remote_ok,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in opportunities
    ]


@router.post("/opportunities")
async def create_opportunity(
    request: OpportunityCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new job opportunity."""
    opportunity = JobOpportunity(
        title=request.title,
        employer_name=request.employer_name,
        employer_contact_email=request.employer_contact_email,
        description=request.description,
        requirements=request.requirements,
        preferred_skills=request.preferred_skills,
        experience_level=request.experience_level,
        location=request.location,
        remote_ok=request.remote_ok,
    )
    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)

    return {
        "id": str(opportunity.id),
        "title": opportunity.title,
        "employer_name": opportunity.employer_name,
        "status": opportunity.status,
        "created_at": opportunity.created_at.isoformat(),
    }


@router.put("/opportunities/{opportunity_id}")
async def update_opportunity(
    opportunity_id: UUID,
    request: OpportunityUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update a job opportunity."""
    result = await db.execute(
        select(JobOpportunity).where(JobOpportunity.id == opportunity_id)
    )
    opportunity = result.scalar_one_or_none()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(opportunity, field, value)

    await db.commit()
    await db.refresh(opportunity)

    return {
        "id": str(opportunity.id),
        "title": opportunity.title,
        "employer_name": opportunity.employer_name,
        "status": opportunity.status,
    }


@router.patch("/opportunities/{opportunity_id}/status")
async def update_opportunity_status(
    opportunity_id: UUID,
    request: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update opportunity status."""
    valid_statuses = ["active", "filled", "closed"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    result = await db.execute(
        select(JobOpportunity).where(JobOpportunity.id == opportunity_id)
    )
    opportunity = result.scalar_one_or_none()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    opportunity.status = request.status
    await db.commit()

    return {"id": str(opportunity.id), "status": opportunity.status}


@router.get("/matches/{fellow_id}")
async def get_fellow_matches(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all placement matches for a fellow."""
    result = await db.execute(
        select(PlacementMatch)
        .options(selectinload(PlacementMatch.opportunity))
        .where(PlacementMatch.fellow_id == fellow_id)
        .order_by(PlacementMatch.match_score.desc())
    )
    matches = result.scalars().all()
    return [
        {
            "match_id": str(m.id),
            "opportunity_id": str(m.opportunity_id),
            "opportunity_title": m.opportunity.title if m.opportunity else None,
            "employer_name": m.opportunity.employer_name if m.opportunity else None,
            "match_score": m.match_score,
            "match_reasoning": m.match_reasoning,
            "status": m.status,
            "introduction_sent": m.introduction_sent_at is not None,
            "introduction_draft": m.introduction_draft,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in matches
    ]


@router.patch("/matches/{match_id}/status")
async def update_match_status(
    match_id: UUID,
    request: MatchStatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update placement match status."""
    valid_statuses = [
        "suggested", "approved", "introduced", "interviewing",
        "offered", "hired", "rejected", "withdrawn"
    ]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    result = await db.execute(
        select(PlacementMatch).where(PlacementMatch.id == match_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.status = request.status
    if request.status == "introduced" and not match.introduction_sent_at:
        match.introduction_sent_at = datetime.utcnow()

    await db.commit()

    return {"match_id": str(match.id), "status": match.status}
