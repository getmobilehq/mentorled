"""Peer feedback API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.peer_feedback import PeerFeedback
from app.models.fellow import Fellow

router = APIRouter(prefix="/peer-feedback")


class PeerFeedbackCreate(BaseModel):
    giver_id: UUID
    receiver_id: UUID
    sprint_id: Optional[UUID] = None
    strengths: str
    areas_to_improve: str
    collaboration_rating: int = Field(ge=1, le=5)
    communication_rating: int = Field(ge=1, le=5)
    technical_rating: int = Field(ge=1, le=5)
    overall_rating: int = Field(ge=1, le=5)
    anonymous: bool = True


@router.post("/")
async def create_peer_feedback(
    feedback: PeerFeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit peer feedback for a fellow."""
    # Verify giver and receiver exist and are different
    if feedback.giver_id == feedback.receiver_id:
        raise HTTPException(status_code=400, detail="Cannot give feedback to yourself")

    for fid, label in [(feedback.giver_id, "Giver"), (feedback.receiver_id, "Receiver")]:
        result = await db.execute(select(Fellow).where(Fellow.id == fid))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"{label} fellow not found")

    new_feedback = PeerFeedback(
        giver_id=feedback.giver_id,
        receiver_id=feedback.receiver_id,
        sprint_id=feedback.sprint_id,
        strengths=feedback.strengths,
        areas_to_improve=feedback.areas_to_improve,
        collaboration_rating=feedback.collaboration_rating,
        communication_rating=feedback.communication_rating,
        technical_rating=feedback.technical_rating,
        overall_rating=feedback.overall_rating,
        anonymous=feedback.anonymous,
    )
    db.add(new_feedback)
    await db.commit()
    await db.refresh(new_feedback)

    return {"id": str(new_feedback.id), "status": "submitted"}


@router.get("/fellow/{fellow_id}/received")
async def get_received_feedback(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all feedback received by a fellow."""
    result = await db.execute(
        select(PeerFeedback)
        .options(
            selectinload(PeerFeedback.giver).selectinload(Fellow.applicant),
            selectinload(PeerFeedback.sprint),
        )
        .where(PeerFeedback.receiver_id == fellow_id)
        .order_by(desc(PeerFeedback.created_at))
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "giver_name": (f.giver.applicant.name if f.giver and f.giver.applicant else "Anonymous") if not f.anonymous else "Anonymous",
            "sprint_name": f.sprint.name if f.sprint else None,
            "strengths": f.strengths,
            "areas_to_improve": f.areas_to_improve,
            "collaboration_rating": f.collaboration_rating,
            "communication_rating": f.communication_rating,
            "technical_rating": f.technical_rating,
            "overall_rating": f.overall_rating,
            "anonymous": f.anonymous,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]


@router.get("/fellow/{fellow_id}/given")
async def get_given_feedback(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all feedback given by a fellow."""
    result = await db.execute(
        select(PeerFeedback)
        .options(
            selectinload(PeerFeedback.receiver).selectinload(Fellow.applicant),
            selectinload(PeerFeedback.sprint),
        )
        .where(PeerFeedback.giver_id == fellow_id)
        .order_by(desc(PeerFeedback.created_at))
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "receiver_name": f.receiver.applicant.name if f.receiver and f.receiver.applicant else "Unknown",
            "sprint_name": f.sprint.name if f.sprint else None,
            "strengths": f.strengths,
            "areas_to_improve": f.areas_to_improve,
            "overall_rating": f.overall_rating,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]


@router.get("/fellow/{fellow_id}/summary")
async def get_feedback_summary(
    fellow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated feedback summary for a fellow."""
    result = await db.execute(
        select(PeerFeedback).where(PeerFeedback.receiver_id == fellow_id)
    )
    feedbacks = result.scalars().all()

    if not feedbacks:
        return {
            "total_received": 0,
            "avg_overall": None,
            "avg_collaboration": None,
            "avg_communication": None,
            "avg_technical": None,
        }

    return {
        "total_received": len(feedbacks),
        "avg_overall": round(sum(f.overall_rating for f in feedbacks) / len(feedbacks), 2),
        "avg_collaboration": round(sum(f.collaboration_rating for f in feedbacks) / len(feedbacks), 2),
        "avg_communication": round(sum(f.communication_rating for f in feedbacks) / len(feedbacks), 2),
        "avg_technical": round(sum(f.technical_rating for f in feedbacks) / len(feedbacks), 2),
    }
