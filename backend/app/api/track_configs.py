"""Challenge track configuration API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from uuid import UUID
from typing import List

from app.database import get_db
from app.models.challenge_track_config import ChallengeTrackConfig
from app.models.challenge import Challenge
from app.schemas.challenge import (
    TrackConfigCreate,
    TrackConfigUpdate,
    TrackConfigResponse,
)

VALID_ROLE_TYPES = {"frontend", "backend", "product_designer", "product_manager", "qa"}

router = APIRouter(prefix="/track-configs")


@router.post("/", response_model=TrackConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_track_config(
    config: TrackConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a track configuration for a cohort + role."""
    if config.role_type not in VALID_ROLE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role_type. Must be one of: {sorted(VALID_ROLE_TYPES)}"
        )

    # Check uniqueness
    result = await db.execute(
        select(ChallengeTrackConfig).where(
            ChallengeTrackConfig.cohort_id == config.cohort_id,
            ChallengeTrackConfig.role_type == config.role_type,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Track config already exists for this cohort and role_type '{config.role_type}'"
        )

    new_config = ChallengeTrackConfig(
        cohort_id=config.cohort_id,
        role_type=config.role_type,
        total_challenges=config.total_challenges,
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return TrackConfigResponse(
        id=new_config.id,
        cohort_id=new_config.cohort_id,
        role_type=new_config.role_type,
        total_challenges=new_config.total_challenges,
        challenges_created=0,
        created_at=new_config.created_at,
        updated_at=new_config.updated_at,
    )


@router.get("/", response_model=List[TrackConfigResponse])
async def list_track_configs(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """List track configs for a cohort, with challenge counts."""
    result = await db.execute(
        select(ChallengeTrackConfig)
        .where(ChallengeTrackConfig.cohort_id == cohort_id)
        .order_by(ChallengeTrackConfig.role_type)
    )
    configs = result.scalars().all()

    response = []
    for cfg in configs:
        count_result = await db.execute(
            select(sqlfunc.count(Challenge.id))
            .where(Challenge.track_config_id == cfg.id)
        )
        challenges_created = count_result.scalar() or 0

        response.append(TrackConfigResponse(
            id=cfg.id,
            cohort_id=cfg.cohort_id,
            role_type=cfg.role_type,
            total_challenges=cfg.total_challenges,
            challenges_created=challenges_created,
            created_at=cfg.created_at,
            updated_at=cfg.updated_at,
        ))

    return response


@router.get("/{config_id}", response_model=TrackConfigResponse)
async def get_track_config(
    config_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single track config."""
    result = await db.execute(
        select(ChallengeTrackConfig).where(ChallengeTrackConfig.id == config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track config not found")

    count_result = await db.execute(
        select(sqlfunc.count(Challenge.id)).where(Challenge.track_config_id == cfg.id)
    )
    challenges_created = count_result.scalar() or 0

    return TrackConfigResponse(
        id=cfg.id,
        cohort_id=cfg.cohort_id,
        role_type=cfg.role_type,
        total_challenges=cfg.total_challenges,
        challenges_created=challenges_created,
        created_at=cfg.created_at,
        updated_at=cfg.updated_at,
    )


@router.put("/{config_id}", response_model=TrackConfigResponse)
async def update_track_config(
    config_id: UUID,
    update: TrackConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update total_challenges (must be >= existing challenge count)."""
    result = await db.execute(
        select(ChallengeTrackConfig).where(ChallengeTrackConfig.id == config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track config not found")

    count_result = await db.execute(
        select(sqlfunc.count(Challenge.id)).where(Challenge.track_config_id == cfg.id)
    )
    challenges_created = count_result.scalar() or 0

    if update.total_challenges < challenges_created:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot set total_challenges to {update.total_challenges}, "
                   f"already {challenges_created} challenges created"
        )

    cfg.total_challenges = update.total_challenges
    await db.commit()
    await db.refresh(cfg)

    return TrackConfigResponse(
        id=cfg.id,
        cohort_id=cfg.cohort_id,
        role_type=cfg.role_type,
        total_challenges=cfg.total_challenges,
        challenges_created=challenges_created,
        created_at=cfg.created_at,
        updated_at=cfg.updated_at,
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track_config(
    config_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a track config (only if no challenges linked)."""
    result = await db.execute(
        select(ChallengeTrackConfig).where(ChallengeTrackConfig.id == config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track config not found")

    count_result = await db.execute(
        select(sqlfunc.count(Challenge.id)).where(Challenge.track_config_id == cfg.id)
    )
    challenges_created = count_result.scalar() or 0

    if challenges_created > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete: {challenges_created} challenges linked to this track config"
        )

    await db.delete(cfg)
    await db.commit()


@router.get("/cohort/{cohort_id}/summary")
async def get_cohort_track_summary(
    cohort_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all tracks for a cohort with their challenges ordered by sequence."""
    result = await db.execute(
        select(ChallengeTrackConfig)
        .where(ChallengeTrackConfig.cohort_id == cohort_id)
        .order_by(ChallengeTrackConfig.role_type)
    )
    configs = result.scalars().all()

    tracks = []
    for cfg in configs:
        challenges_result = await db.execute(
            select(Challenge)
            .where(Challenge.track_config_id == cfg.id)
            .order_by(Challenge.sequence_number.asc())
        )
        challenges = challenges_result.scalars().all()

        tracks.append({
            "id": str(cfg.id),
            "cohort_id": str(cfg.cohort_id),
            "role_type": cfg.role_type,
            "total_challenges": cfg.total_challenges,
            "challenges_created": len(challenges),
            "created_at": cfg.created_at.isoformat(),
            "updated_at": cfg.updated_at.isoformat(),
            "challenges": [
                {
                    "id": str(c.id),
                    "title": c.title,
                    "description": c.description,
                    "status": c.status,
                    "sequence_number": c.sequence_number,
                    "duration_hours": c.duration_hours,
                    "deadline": c.deadline.isoformat(),
                    "share_token": c.share_token,
                    "role_type": c.role_type,
                    "submission_types": c.submission_types or [],
                    "requirements": c.requirements or [],
                }
                for c in challenges
            ],
        })

    return tracks
