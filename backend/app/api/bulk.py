"""
Bulk operations API endpoints for batch processing.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from pydantic import BaseModel
import pandas as pd
import io
import csv

from app.database import get_db
from app.models.applicant import Applicant
from app.models.fellow import Fellow
from app.models.evaluation import ApplicationEvaluation
from app.agents.screening_agent import screening_agent
from app.agents.delivery_agent import DeliveryAgent

router = APIRouter(prefix="/bulk")

class BulkEvaluateRequest(BaseModel):
    applicant_ids: List[UUID]
    auto_process: bool = False  # Auto-approve eligible applicants

class BulkStatusUpdateRequest(BaseModel):
    applicant_ids: List[UUID]
    new_status: str

@router.post("/evaluate")
async def bulk_evaluate_applications(
    request: BulkEvaluateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk evaluate multiple applications.
    Runs evaluations in the background and returns immediately.
    """
    # Validate applicants exist
    result = await db.execute(
        select(Applicant).where(Applicant.id.in_(request.applicant_ids))
    )
    applicants = list(result.scalars().all())

    if len(applicants) != len(request.applicant_ids):
        raise HTTPException(
            status_code=404,
            detail=f"Some applicants not found. Found {len(applicants)} of {len(request.applicant_ids)}"
        )

    # Queue evaluations as background tasks
    for applicant in applicants:
        background_tasks.add_task(
            _evaluate_applicant,
            applicant.id,
            request.auto_process
        )

    return {
        "message": f"Queued {len(applicants)} applications for evaluation",
        "applicant_ids": [str(a.id) for a in applicants],
        "status": "processing"
    }

async def _evaluate_applicant(applicant_id: UUID, auto_process: bool = False):
    """Background task to evaluate a single applicant"""
    async with get_db() as db:
        result = await db.execute(select(Applicant).where(Applicant.id == applicant_id))
        applicant = result.scalar_one_or_none()

        if not applicant:
            return

        applicant_data = {
            "name": applicant.name,
            "email": applicant.email,
            "role": applicant.role,
            "portfolio_url": applicant.portfolio_url,
            "github_url": applicant.github_url,
            "project_description": applicant.project_description,
            "time_commitment": applicant.time_commitment
        }

        evaluation = await screening_agent.evaluate_application(
            applicant_id=applicant.id,
            applicant_data=applicant_data
        )

        # Save evaluation
        db_evaluation = ApplicationEvaluation(
            applicant_id=applicant.id,
            evaluation_type="application",
            scores=evaluation.get("scores"),
            overall_score=evaluation.get("overall_score"),
            outcome=evaluation.get("eligibility"),
            reasoning=evaluation.get("reasoning"),
            flags=evaluation.get("flags"),
            confidence=evaluation.get("confidence"),
            evaluated_by="ai_screening_agent",
            ai_generated=True,
            human_reviewed=auto_process
        )
        db.add(db_evaluation)

        # Auto-process if requested
        if auto_process and evaluation.get("eligibility") == "eligible":
            applicant.status = "eligible"
        else:
            applicant.status = "screening"

        await db.commit()

@router.post("/status/update")
async def bulk_update_status(
    request: BulkStatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Bulk update applicant status"""
    result = await db.execute(
        select(Applicant).where(Applicant.id.in_(request.applicant_ids))
    )
    applicants = list(result.scalars().all())

    for applicant in applicants:
        applicant.status = request.new_status

    await db.commit()

    return {
        "message": f"Updated status for {len(applicants)} applicants",
        "new_status": request.new_status,
        "updated_count": len(applicants)
    }

@router.post("/import/applicants")
async def import_applicants_csv(
    file: UploadFile = File(...),
    cohort_id: UUID = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Import applicants from CSV file.
    Expected columns: name, email, role, portfolio_url, github_url, project_description, time_commitment
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    required_columns = ['name', 'email', 'role']
    if not all(col in df.columns for col in required_columns):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {', '.join(required_columns)}"
        )

    created_count = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            applicant = Applicant(
                cohort_id=cohort_id,
                name=row['name'],
                email=row['email'],
                role=row['role'],
                portfolio_url=row.get('portfolio_url'),
                github_url=row.get('github_url'),
                linkedin_url=row.get('linkedin_url'),
                project_description=row.get('project_description'),
                time_commitment=row.get('time_commitment', True),
                status='applied',
                source='csv_import'
            )
            db.add(applicant)
            created_count += 1
        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")

    await db.commit()

    return {
        "message": f"Imported {created_count} applicants",
        "created_count": created_count,
        "errors": errors if errors else None
    }

@router.get("/export/applicants")
async def export_applicants_csv(
    cohort_id: UUID = None,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Export applicants to CSV"""
    query = select(Applicant)

    if cohort_id:
        query = query.where(Applicant.cohort_id == cohort_id)
    if status:
        query = query.where(Applicant.status == status)

    result = await db.execute(query)
    applicants = result.scalars().all()

    # Convert to DataFrame
    data = []
    for app in applicants:
        data.append({
            'id': str(app.id),
            'name': app.name,
            'email': app.email,
            'role': app.role,
            'status': app.status,
            'portfolio_url': app.portfolio_url,
            'github_url': app.github_url,
            'linkedin_url': app.linkedin_url,
            'project_description': app.project_description,
            'time_commitment': app.time_commitment,
            'source': app.source,
            'applied_at': app.applied_at,
            'created_at': app.created_at
        })

    df = pd.DataFrame(data)

    # Create CSV in memory
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=applicants_{status or 'all'}.csv"}
    )

@router.get("/export/fellows")
async def export_fellows_csv(
    cohort_id: UUID = None,
    db: AsyncSession = Depends(get_db)
):
    """Export fellows to CSV"""
    query = select(Fellow)

    if cohort_id:
        query = query.where(Fellow.cohort_id == cohort_id)

    result = await db.execute(query)
    fellows = result.scalars().all()

    # Convert to DataFrame
    data = []
    for fellow in fellows:
        data.append({
            'id': str(fellow.id),
            'applicant_id': str(fellow.applicant_id),
            'cohort_id': str(fellow.cohort_id),
            'role': fellow.role,
            'status': fellow.status,
            'current_risk_level': fellow.current_risk_level,
            'warnings_count': fellow.warnings_count,
            'milestone_1_score': fellow.milestone_1_score,
            'milestone_2_score': fellow.milestone_2_score,
            'milestone_3_score': fellow.milestone_3_score,
            'final_score': fellow.final_score,
            'started_at': fellow.started_at,
            'created_at': fellow.created_at
        })

    df = pd.DataFrame(data)

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fellows.csv"}
    )
