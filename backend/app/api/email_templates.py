from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import Optional, Dict, Any
from pydantic import BaseModel
from jinja2 import TemplateSyntaxError

from app.database import get_db
from app.config import settings
from app.models.email_template_override import EmailTemplateOverride
from app.utils.email_templates import TEMPLATE_REGISTRY, get_sample_context
from app.utils.email import jinja_env, email_service

router = APIRouter(prefix="/email-templates")


class TemplateUpdateRequest(BaseModel):
    subject: Optional[str] = None
    content: str


class TestSendRequest(BaseModel):
    to_email: str


@router.get("/")
async def list_templates(db: AsyncSession = Depends(get_db)):
    """List all email templates with metadata."""
    # Get all overrides to check which templates have been customized
    result = await db.execute(select(EmailTemplateOverride.template_key))
    override_keys = {row[0] for row in result.all()}

    templates = []
    for key, info in TEMPLATE_REGISTRY.items():
        templates.append({
            "key": key,
            "name": info["name"],
            "description": info["description"],
            "category": info["category"],
            "default_subject": info["default_subject"],
            "has_override": key in override_keys,
            "variable_count": len(info["variables"]),
        })

    return templates


@router.get("/config")
async def get_config():
    """Get SMTP configuration status."""
    return {
        "enabled": settings.ENABLE_EMAIL,
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_from_email": settings.SMTP_FROM_EMAIL or "",
        "smtp_from_name": settings.SMTP_FROM_NAME,
        "has_credentials": bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
    }


@router.get("/{template_key}")
async def get_template(template_key: str, db: AsyncSession = Depends(get_db)):
    """Get detailed template information including content."""
    if template_key not in TEMPLATE_REGISTRY:
        raise HTTPException(status_code=404, detail="Template not found")

    info = TEMPLATE_REGISTRY[template_key]

    # Read default content from disk
    try:
        disk_template = jinja_env.loader.get_source(jinja_env, info["template_file"])
        default_content = disk_template[0]
    except Exception:
        default_content = ""

    # Check for DB override
    result = await db.execute(
        select(EmailTemplateOverride).where(
            EmailTemplateOverride.template_key == template_key
        )
    )
    override = result.scalar_one_or_none()

    return {
        "key": template_key,
        "name": info["name"],
        "description": info["description"],
        "category": info["category"],
        "default_subject": info["default_subject"],
        "current_subject": override.subject if override and override.subject else info["default_subject"],
        "default_content": default_content,
        "current_content": override.content if override else default_content,
        "has_override": override is not None,
        "variables": info["variables"],
        "updated_at": override.updated_at.isoformat() if override and override.updated_at else None,
    }


@router.get("/{template_key}/preview")
async def preview_template(template_key: str, db: AsyncSession = Depends(get_db)):
    """Render template with sample data and return HTML."""
    if template_key not in TEMPLATE_REGISTRY:
        raise HTTPException(status_code=404, detail="Template not found")

    info = TEMPLATE_REGISTRY[template_key]
    sample_context = get_sample_context(template_key)

    # Check for DB override
    result = await db.execute(
        select(EmailTemplateOverride).where(
            EmailTemplateOverride.template_key == template_key
        )
    )
    override = result.scalar_one_or_none()

    subject = override.subject if override and override.subject else info["default_subject"]
    sample_context["subject"] = subject

    try:
        if override:
            template = jinja_env.from_string(override.content)
        else:
            template = jinja_env.get_template(info["template_file"])

        html = template.render(**sample_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template render error: {str(e)}")

    return {"html": html, "subject": subject}


@router.put("/{template_key}")
async def update_template(
    template_key: str,
    request: TemplateUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Save a template override. Validates Jinja2 syntax before saving."""
    if template_key not in TEMPLATE_REGISTRY:
        raise HTTPException(status_code=404, detail="Template not found")

    # Validate Jinja2 syntax
    try:
        jinja_env.parse(request.content)
    except TemplateSyntaxError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid Jinja2 template syntax at line {e.lineno}: {e.message}",
        )

    # Upsert override
    result = await db.execute(
        select(EmailTemplateOverride).where(
            EmailTemplateOverride.template_key == template_key
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.content = request.content
        if request.subject is not None:
            existing.subject = request.subject
    else:
        override = EmailTemplateOverride(
            template_key=template_key,
            subject=request.subject,
            content=request.content,
        )
        db.add(override)

    await db.commit()

    return {"status": "saved", "template_key": template_key}


@router.delete("/{template_key}/override")
async def revert_template(template_key: str, db: AsyncSession = Depends(get_db)):
    """Revert template to default by deleting the override."""
    if template_key not in TEMPLATE_REGISTRY:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.execute(
        delete(EmailTemplateOverride).where(
            EmailTemplateOverride.template_key == template_key
        )
    )
    await db.commit()

    return {"status": "reverted", "template_key": template_key}


@router.post("/{template_key}/test-send")
async def test_send_template(
    template_key: str,
    request: TestSendRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a test email using the current template (override or default) with sample data."""
    if template_key not in TEMPLATE_REGISTRY:
        raise HTTPException(status_code=404, detail="Template not found")

    info = TEMPLATE_REGISTRY[template_key]
    sample_context = get_sample_context(template_key)

    # Check for subject override
    result = await db.execute(
        select(EmailTemplateOverride).where(
            EmailTemplateOverride.template_key == template_key
        )
    )
    override = result.scalar_one_or_none()
    subject = override.subject if override and override.subject else info["default_subject"]

    # send_email handles override lookup internally
    success = await email_service.send_email(
        to_email=request.to_email,
        subject=f"[TEST] {subject}",
        template_name=info["template_file"],
        context=sample_context,
    )

    if not success:
        if not settings.ENABLE_EMAIL:
            return {
                "status": "skipped",
                "message": "Email sending is disabled. Enable ENABLE_EMAIL in environment to send test emails.",
            }
        return {"status": "failed", "message": "Failed to send test email. Check SMTP configuration."}

    return {"status": "sent", "message": f"Test email sent to {request.to_email}"}
