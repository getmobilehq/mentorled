from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

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

@router.post("/profile/generate")
async def generate_profile(
    request: ProfileGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate a professional profile for a fellow using AI."""
    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == request.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Generate profile using AI
    placement_agent = PlacementAgent(db)
    profile_data = await placement_agent.generate_profile(fellow)

    # Create or update profile
    result = await db.execute(select(FellowProfile).where(FellowProfile.fellow_id == request.fellow_id))
    existing_profile = result.scalar_one_or_none()

    if existing_profile:
        # Update existing profile
        existing_profile.summary = profile_data["summary"]
        existing_profile.skills = profile_data["skills"]
        existing_profile.work_samples = profile_data.get("work_samples", [])
        existing_profile.ai_generated_content = profile_data
        profile = existing_profile
    else:
        # Create new profile
        profile = FellowProfile(
            fellow_id=fellow.id,
            summary=profile_data["summary"],
            skills=profile_data["skills"],
            work_samples=profile_data.get("work_samples", []),
            ai_generated_content=profile_data
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
    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == request.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Get fellow's profile
    result = await db.execute(select(FellowProfile).where(FellowProfile.fellow_id == request.fellow_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No profile found. Generate profile first using /placement/profile/generate"
        )

    # Get opportunities to match against
    if request.opportunity_ids:
        query = select(JobOpportunity).where(
            JobOpportunity.id.in_(request.opportunity_ids),
            JobOpportunity.status == "open"
        )
    else:
        # Get all open opportunities
        query = select(JobOpportunity).where(JobOpportunity.status == "open")

    result = await db.execute(query)
    opportunities = list(result.scalars().all())

    if not opportunities:
        raise HTTPException(status_code=404, detail="No open opportunities found")

    # Run AI matching
    placement_agent = PlacementAgent(db)
    matches = await placement_agent.match_opportunities(fellow, profile, opportunities)

    # Create placement match records
    created_matches = []
    for match_data in matches:
        # Find the opportunity
        opportunity = next(
            (opp for opp in opportunities if str(opp.id) == match_data["opportunity_id"]),
            None
        )
        if not opportunity:
            continue

        # Create or update match
        result = await db.execute(
            select(PlacementMatch).where(
                PlacementMatch.fellow_id == request.fellow_id,
                PlacementMatch.opportunity_id == opportunity.id
            )
        )
        existing_match = result.scalar_one_or_none()

        if existing_match:
            existing_match.match_score = match_data["match_score"]
            existing_match.ai_reasoning = match_data["reasoning"]
            existing_match.skill_gaps = match_data.get("gaps", [])
            placement_match = existing_match
        else:
            placement_match = PlacementMatch(
                fellow_id=fellow.id,
                opportunity_id=opportunity.id,
                match_score=match_data["match_score"],
                ai_reasoning=match_data["reasoning"],
                skill_gaps=match_data.get("gaps", []),
                status="suggested"
            )
            db.add(placement_match)

        await db.flush()
        created_matches.append({
            "match_id": str(placement_match.id),
            "opportunity_id": str(opportunity.id),
            "opportunity_title": opportunity.title,
            "company": opportunity.company,
            **match_data
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
    # Get match
    result = await db.execute(select(PlacementMatch).where(PlacementMatch.id == request.match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Get fellow
    result = await db.execute(select(Fellow).where(Fellow.id == match.fellow_id))
    fellow = result.scalar_one_or_none()
    if not fellow:
        raise HTTPException(status_code=404, detail="Fellow not found")

    # Get profile
    result = await db.execute(select(FellowProfile).where(FellowProfile.fellow_id == match.fellow_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Get opportunity
    result = await db.execute(select(JobOpportunity).where(JobOpportunity.id == match.opportunity_id))
    opportunity = result.scalar_one_or_none()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    # Draft introduction using AI
    placement_agent = PlacementAgent(db)
    draft = await placement_agent.draft_introduction(fellow, profile, opportunity, match)

    # Update match with draft
    match.ai_introduction_draft = draft["email"]
    match.introduction_sent = False

    await db.commit()
    await db.refresh(match)

    return {
        "match_id": str(match.id),
        "fellow_id": str(fellow.id),
        "opportunity_id": str(opportunity.id),
        "draft": draft
    }

@router.get("/profiles", response_model=List[dict])
async def list_profiles(
    cohort_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all fellow profiles."""
    query = select(FellowProfile)
    # Join with Fellow to filter by cohort
    if cohort_id:
        query = query.join(Fellow).where(Fellow.cohort_id == cohort_id)

    result = await db.execute(query)
    profiles = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "fellow_id": str(p.fellow_id),
            "summary": p.summary,
            "skills": p.skills,
            "created_at": p.created_at.isoformat()
        }
        for p in profiles
    ]

@router.get("/opportunities", response_model=List[dict])
async def list_opportunities(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all job opportunities."""
    query = select(JobOpportunity)
    if status:
        query = query.where(JobOpportunity.status == status)

    result = await db.execute(query.order_by(JobOpportunity.posted_date.desc()))
    opportunities = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "title": o.title,
            "company": o.company,
            "location": o.location,
            "job_type": o.job_type,
            "required_skills": o.required_skills,
            "status": o.status,
            "posted_date": o.posted_date.isoformat() if o.posted_date else None
        }
        for o in opportunities
    ]

@router.get("/matches/{fellow_id}")
async def get_fellow_matches(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all placement matches for a fellow."""
    result = await db.execute(
        select(PlacementMatch)
        .where(PlacementMatch.fellow_id == fellow_id)
        .order_by(PlacementMatch.match_score.desc())
    )
    matches = result.scalars().all()
    return [
        {
            "match_id": str(m.id),
            "opportunity_id": str(m.opportunity_id),
            "match_score": m.match_score,
            "status": m.status,
            "introduction_sent": m.introduction_sent
        }
        for m in matches
    ]
