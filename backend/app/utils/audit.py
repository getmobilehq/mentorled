from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from app.models.audit_log import AuditLog, ActorType
from app.models.decision import Decision
from app.config import settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def log_ai_call(
    model: str,
    action: str,
    input_tokens: int,
    output_tokens: int,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log an AI API call to the audit log.

    Args:
        model: The AI model used
        action: The action performed
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        entity_type: Type of entity affected
        entity_id: ID of entity affected
        actor_id: ID of the actor making the call
        details: Additional details
    """
    # Calculate cost (approximate)
    cost_usd = (
        (input_tokens / 1_000_000) * settings.COST_PER_1M_INPUT_TOKENS +
        (output_tokens / 1_000_000) * settings.COST_PER_1M_OUTPUT_TOKENS
    )

    try:
        async with AsyncSessionLocal() as db:
            log_entry = AuditLog(
                actor_type=ActorType.AI_AGENT,
                actor_id=actor_id or "system",
                action=action,
                entity_type=entity_type,
                entity_id=UUID(entity_id) if entity_id else None,
                details=details,
                ai_model=model,
                ai_prompt_tokens=input_tokens,
                ai_completion_tokens=output_tokens,
                ai_cost_usd=cost_usd
            )
            db.add(log_entry)
            await db.commit()

            logger.info(
                f"AI Call logged: {action} | Model: {model} | "
                f"Tokens: {input_tokens}+{output_tokens} | Cost: ${cost_usd:.6f}"
            )
    except Exception as e:
        logger.error(f"Failed to log AI call: {e}")

async def log_decision(
    entity_type: str,
    entity_id: UUID,
    decision_type: str,
    decision: str,
    rationale: str,
    made_by: Optional[UUID] = None,
    made_by_name: Optional[str] = None,
    ai_assisted: bool = False,
    ai_recommendation: Optional[str] = None,
    ai_confidence: Optional[float] = None,
    evidence_refs: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log a decision to the decisions table.

    Args:
        entity_type: Type of entity (applicant, fellow, team)
        entity_id: ID of the entity
        decision_type: Type of decision (e.g., 'application_screening')
        decision: The decision made
        rationale: Reasoning for the decision
        made_by: ID of person who made decision
        made_by_name: Name of person who made decision
        ai_assisted: Whether AI was involved
        ai_recommendation: What AI recommended
        ai_confidence: AI's confidence score
        evidence_refs: References to supporting evidence
    """
    try:
        async with AsyncSessionLocal() as db:
            decision_entry = Decision(
                entity_type=entity_type,
                entity_id=entity_id,
                decision_type=decision_type,
                decision=decision,
                rationale=rationale,
                made_by=made_by,
                made_by_name=made_by_name or "system",
                ai_assisted=ai_assisted,
                ai_recommendation=ai_recommendation,
                ai_confidence=ai_confidence,
                evidence_refs=evidence_refs
            )
            db.add(decision_entry)
            await db.commit()

            logger.info(
                f"Decision logged: {decision_type} | Entity: {entity_type}:{entity_id} | "
                f"Decision: {decision} | AI Assisted: {ai_assisted}"
            )
    except Exception as e:
        logger.error(f"Failed to log decision: {e}")

async def log_user_action(
    actor_id: str,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log a user action to the audit log.

    Args:
        actor_id: ID of the user
        action: The action performed
        entity_type: Type of entity affected
        entity_id: ID of entity affected
        details: Additional details
    """
    try:
        async with AsyncSessionLocal() as db:
            log_entry = AuditLog(
                actor_type=ActorType.USER,
                actor_id=actor_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details
            )
            db.add(log_entry)
            await db.commit()

            logger.info(f"User action logged: {actor_id} | {action}")
    except Exception as e:
        logger.error(f"Failed to log user action: {e}")
