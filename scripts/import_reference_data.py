#!/usr/bin/env python3
"""
Import real MentorLed data from the spreadsheets in ./reference into the database.

Sources (all in ./reference):
  - "MentorLed 2.0 Master list.xlsx"           -> MentorLed 2.0 alumni (graduated fellows)
  - "Mentorled WEA Registration 2025.xlsx"     -> WEA 2025 applications (Batch 1-3, with Yes/No/Maybe
                                                  screening decision) + Univelcity-alumni registrations
  - "Mentorled Work Experience Pledge Form (Responses).xlsx" -> marks pledge signers as time-committed

Idempotent: each run deletes and recreates the cohorts it owns (matched by name), so re-running
after the spreadsheets change is safe. Seed/demo data and other cohorts are left untouched.

Run (from repo root):
  docker cp reference mentorled-backend-1:/tmp/reference
  docker-compose exec backend python /scripts/import_reference_data.py --dir /tmp/reference
"""
import argparse
import asyncio
import re
import sys
import warnings
from datetime import date, datetime
from pathlib import Path

import pandas as pd

backend_path = Path(__file__).parent.parent / "backend"
if not backend_path.exists():
    backend_path = Path("/app")
sys.path.insert(0, str(backend_path))

from sqlalchemy import select, text  # noqa: E402

from app.database import AsyncSessionLocal, engine  # noqa: E402
from app.models.applicant import Applicant, ApplicantRole, ApplicantStatus  # noqa: E402
from app.models.cohort import Cohort, CohortStatus  # noqa: E402
from app.models.fellow import Fellow, FellowStatus  # noqa: E402

warnings.filterwarnings("ignore")

MASTER_FILE = "MentorLed 2.0 Master list.xlsx"
WEA_FILE = "Mentorled WEA Registration 2025.xlsx"
PLEDGE_FILE = "Mentorled Work Experience Pledge Form (Responses).xlsx"

# Cohorts owned by this importer. Dates for the alumni cohort are not in the source
# files — they are placeholders to correct on the Cohorts page.
COHORTS = {
    "alumni": dict(name="MentorLed 2.0 Alumni", start_date=date(2024, 6, 3), end_date=date(2024, 8, 30),
                   status=CohortStatus.COMPLETED, target_size=60),
    "wea": dict(name="WEA 2025 Intake", start_date=date(2025, 3, 3), end_date=date(2025, 5, 23),
                status=CohortStatus.COMPLETED, target_size=250),
    "univelcity": dict(name="WEA 2025 · Univelcity Alumni Intake", start_date=date(2025, 9, 1),
                       end_date=date(2025, 11, 21), status=CohortStatus.COMPLETED, target_size=40),
}

TRACK_PATTERNS = [
    (r"project\s*m", ApplicantRole.PROJECT_MANAGER),
    (r"product\s*man|product\s*mgt|\bpm\b", ApplicantRole.PRODUCT_MANAGER),
    (r"design", ApplicantRole.PRODUCT_DESIGNER),
    (r"front", ApplicantRole.FRONTEND),
    (r"back", ApplicantRole.BACKEND),
    (r"qa|quality|test", ApplicantRole.QA),
]

DECISION_TO_STATUS = {
    "yes": ApplicantStatus.ELIGIBLE,
    "no": ApplicantStatus.NOT_ELIGIBLE,
    "maybe": ApplicantStatus.SCREENING,
}


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    return s or None


def norm_email(v):
    s = clean(v)
    return s.lower() if s and "@" in s else None


def to_role(v):
    s = (clean(v) or "").lower()
    # Multi-select answers ("Backend Development, Frontend Development") -> first listed track
    first = s.split(",")[0]
    for pattern, role in TRACK_PATTERNS:
        if re.search(pattern, first):
            return role
    return None


def to_dt(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        ts = pd.to_datetime(v)
        return None if pd.isna(ts) else ts.to_pydatetime().replace(tzinfo=None)
    except Exception:
        return None


def col(df, prefix):
    """Find a column by (case-insensitive) prefix — headers in the forms are long questions."""
    for c in df.columns:
        if str(c).strip().lower().startswith(prefix.lower()):
            return c
    return None


async def ensure_enum_values():
    """Project Management is a real WEA track but was missing from the role enum."""
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text("ALTER TYPE applicantrole ADD VALUE IF NOT EXISTS 'PROJECT_MANAGER'"))


def load(dir_: Path):
    wea = pd.read_excel(dir_ / WEA_FILE, sheet_name=None)
    master = pd.read_excel(dir_ / MASTER_FILE, sheet_name="Sheet1")
    pledge = pd.read_excel(dir_ / PLEDGE_FILE)

    pledge_emails = set()
    for c in (col(pledge, "Email"), col(pledge, "Email Address")):
        if c is not None:
            pledge_emails |= {e for e in pledge[c].map(norm_email) if e}

    # WEA batches -> applications with screening decisions
    wea_rows = {}
    for sheet, df in wea.items():
        if not sheet.lower().startswith("batch"):
            continue
        df = df.rename(columns=lambda c: str(c).strip())
        c_track, c_status = col(df, "Choose your track"), col(df, "Status")
        for _, r in df.iterrows():
            email = norm_email(r.get("Email"))
            role = to_role(r.get(c_track))
            if not email or not role or email in wea_rows:  # skip blanks + duplicates (first wins)
                continue
            decision = (clean(r.get(c_status)) or "").lower()
            wea_rows[email] = dict(
                email=email,
                name=clean(r.get("Name")) or email,
                role=role,
                status=DECISION_TO_STATUS.get(decision, ApplicantStatus.APPLIED),
                linkedin_url=clean(r.get(col(df, "What's your LinkedIn"))),
                portfolio_url=clean(r.get(col(df, "Portf"))),
                applied_at=to_dt(r.get("Submission Create Date")),
                source=f"wea_2025_{sheet.split()[0].lower()}{sheet.split()[1]}",
                time_commitment=email in pledge_emails,
            )

    # Univelcity-alumni registration form
    form = wea.get("Form Responses 1")
    uni_rows = {}
    if form is not None:
        c_stack, c_40 = col(form, "Please select your tech stack"), col(form, "Can you dedicate 40")
        for _, r in form.iterrows():
            email = norm_email(r.get("Email Address"))
            role = to_role(r.get(c_stack))
            if not email or not role or email in uni_rows:
                continue
            uni_rows[email] = dict(
                email=email,
                name=clean(r.get("Full Name")) or email,
                role=role,
                status=ApplicantStatus.APPLIED,
                linkedin_url=clean(r.get(col(form, "Upload your LinkedIn"))),
                portfolio_url=clean(r.get(col(form, "Upload your Portfolio"))),
                applied_at=to_dt(r.get("Timestamp")),
                source="univelcity_alumni_form",
                time_commitment=(clean(r.get(c_40)) or "").lower() == "yes" or email in pledge_emails,
            )

    # MentorLed 2.0 alumni
    alumni_rows = {}
    for _, r in master.iterrows():
        email = norm_email(r.get("Email"))
        role = to_role(r.get("Skill"))
        if not email or not role or email in alumni_rows:
            continue
        name = " ".join(p for p in (clean(r.get("First Name")), clean(r.get("Last Name"))) if p)
        alumni_rows[email] = dict(
            email=email, name=name or email, role=role, status=ApplicantStatus.ACCEPTED,
            linkedin_url=None, portfolio_url=None, applied_at=None,
            source="mentorled_2_master_list", time_commitment=True,
        )

    return alumni_rows, wea_rows, uni_rows


async def replace_cohort(session, spec):
    existing = (await session.execute(select(Cohort).where(Cohort.name == spec["name"]))).scalars().all()
    for c in existing:
        await session.delete(c)  # cascades to applicants + fellows
    await session.flush()
    cohort = Cohort(**spec)
    session.add(cohort)
    await session.flush()
    return cohort


async def main(dir_: Path):
    await ensure_enum_values()
    alumni_rows, wea_rows, uni_rows = load(dir_)

    async with AsyncSessionLocal() as session:
        counts = {}
        for key, rows in (("alumni", alumni_rows), ("wea", wea_rows), ("univelcity", uni_rows)):
            spec = COHORTS[key]
            cohort = await replace_cohort(session, spec)
            for row in rows.values():
                applied_at = row.pop("applied_at") or datetime.combine(spec["start_date"], datetime.min.time())
                applicant = Applicant(cohort_id=cohort.id, applied_at=applied_at, created_at=applied_at, **row)
                session.add(applicant)
                if key == "alumni":
                    await session.flush()
                    session.add(Fellow(
                        applicant_id=applicant.id, cohort_id=cohort.id, role=applicant.role.value,
                        status=FellowStatus.GRADUATED,
                        started_at=datetime.combine(spec["start_date"], datetime.min.time()),
                        ended_at=datetime.combine(spec["end_date"], datetime.min.time()),
                    ))
            counts[spec["name"]] = len(rows)
        await session.commit()

    for name, n in counts.items():
        print(f"✓ {name}: {n} records")
    print(f"  pledge signers flagged time-committed where emails matched")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="/tmp/reference", help="folder containing the reference spreadsheets")
    asyncio.run(main(Path(ap.parse_args().dir)))
