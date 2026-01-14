# MentorLed Platform - User Flows & Data Entry

## 🎯 Overview

The platform supports **3 main user types** and **6 major workflows**:

### User Types
1. **Program Managers** - Admins who run the program
2. **Fellows** - Participants in the program
3. **Applicants** - People applying to join

---

## 📊 Complete Data Flow (Applicant → Placement)

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. APPLICATION PHASE                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    [Applicant fills form] → [Data enters system] → [AI screening]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    2. MICROSHIP PHASE                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    [24hr challenge sent] → [Submission received] → [AI evaluation]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    3. ONBOARDING PHASE                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    [Applicant accepted] → [Becomes Fellow] → [Assigned to team]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    4. DELIVERY PHASE (12 weeks)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    [Weekly check-ins] → [AI analysis] → [Risk detection] → [Warnings if needed]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    5. PLACEMENT PHASE                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    [Profile generated] → [Match with jobs] → [Introductions sent]
```

---

## 🚪 Data Entry Points (How Data Gets In)

### **Option 1: Manual Entry (Current MVP)**
Program managers manually enter data through the UI

### **Option 2: Form Submissions (Recommended)**
External forms feed data into the platform

### **Option 3: API Integration (Advanced)**
Connect to external systems (Typeform, Airtable, etc.)

### **Option 4: Bulk Import (Admin)**
CSV/Excel import for batch operations

---

## 🎨 Frontend Screens & User Flows

### **Phase 1: Application & Screening**

#### 1. **Applicants List** (`/applicants`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Applicants                                    [+ Add New]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Applied: 45  │  Screening: 12  │  Accepted: 8   │
│                                                             │
│  Filters: [All] [Applied] [Screening] [Accepted]          │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Name        Role      Email          Status   Actions│ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe    Frontend  john@...      Applied  [View] │ │
│  │ Jane Smith  Designer  jane@...      Screening [View]│ │
│  │ Bob Lee     Backend   bob@...       Accepted  [View]│ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Data Entry Flow**:
```javascript
// Manual Entry
Click [+ Add New]
  ↓
Fill Form:
  - Name
  - Email
  - Role (Frontend/Backend/Designer/PM/QA)
  - Portfolio URL
  - GitHub URL
  - LinkedIn
  - Why interested?
  - Time commitment
  ↓
[Submit] → Creates applicant in database
```

**Alternative (Better UX)**:
```
External Application Form (Google Forms, Typeform, etc.)
  ↓
Webhook/API → POST /api/applicants
  ↓
Applicant appears in dashboard
```

---

#### 2. **Screening Queue** (`/screening`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Screening Queue                                            │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Pending: 12  │  Today: 5  │  Avg Time: 8min     │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Applicant      Applied    Links         Actions      │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe       2d ago     [Portfolio]  [Evaluate AI] │ │
│  │ Jane Smith     5d ago     [Figma]      [Evaluate AI] │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**User Flow**:
```
1. Manager clicks [Evaluate AI] on John Doe
   ↓
2. AI analyzes portfolio, GitHub, LinkedIn, answers
   ↓
3. Modal shows results:
   ┌──────────────────────────────────────────┐
   │ AI Evaluation - John Doe                  │
   ├──────────────────────────────────────────┤
   │ Overall Score: 78/100                     │
   │ Recommendation: PROGRESS TO MICROSHIP     │
   │                                           │
   │ Scores:                                   │
   │   Technical Skills: 8/10                  │
   │   Motivation: 9/10                        │
   │   Communication: 7/10                     │
   │                                           │
   │ Strengths:                                │
   │   - Strong portfolio                      │
   │   - Clear learning goals                  │
   │                                           │
   │ Concerns:                                 │
   │   - Limited team experience               │
   │                                           │
   │ [Reject]  [Send Microship Challenge]     │
   └──────────────────────────────────────────┘

4. Manager clicks [Send Microship Challenge]
   ↓
5. Email sent to applicant with challenge link
   ↓
6. Applicant status → "microship_pending"
```

---

### **Phase 2: Microship Challenge**

#### 3. **Microship Submissions** (`/microship`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Microship Submissions                                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Total: 28  │  Pending: 8  │  Progress: 18       │
│          Borderline: 2  │  No Progress: 0                 │
│                                                             │
│  Filters: [All] [Pending] [Evaluated]                     │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Applicant  Challenge  On Time  Outcome      Actions  │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe   FE-001    ✓ Yes    Progress 3.2  [View]  │ │
│  │ Jane S.    Design    ✓ Yes    Borderline   [Review] │ │
│  │ Bob Lee    BE-001    ✗ No     Not Eval     [Eval AI]│ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Data Entry Flow**:
```
External Process:
1. Applicant receives email with challenge
2. Applicant submits GitHub link via form/email
   ↓
Manager enters manually OR webhook creates record:
   ↓
Click [+ Record Submission]
  ↓
Fill form:
  - Applicant (dropdown)
  - Challenge ID
  - Submission URL (GitHub/Figma/Google Doc)
  - Submission Type
  - Submitted At
  - Deadline
  - On Time? (auto-calculated)
  - Communication Log (optional)
  ↓
[Save] → Creates microship_submission
  ↓
[Evaluate AI] → AI analyzes submission
  ↓
Modal shows detailed scores
```

---

### **Phase 3: Fellows Management**

#### 4. **Fellows Dashboard** (`/fellows`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Fellows - Cohort 2025 Q1                    [Switch Cohort]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Active: 42  │  On Track: 35  │  At Risk: 7      │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Name      Role      Team    Risk      Week   Actions │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe  Frontend  Team A  ⚠️ Monitor  5/12  [View] │ │
│  │ Jane S.   Designer  Team B  ✅ On Track 5/12  [View] │ │
│  │ Bob Lee   Backend   Team A  🔴 At Risk  5/12  [View] │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Data Entry Flow (Onboarding)**:
```
After accepting from Microship:
  ↓
Click applicant → [Accept to Program]
  ↓
Modal:
  - Select Cohort
  - Assign Team (optional)
  - Start Date
  ↓
[Confirm] → Creates Fellow record
  ↓
Fellow appears in dashboard
```

---

#### 5. **Check-ins Dashboard** (`/check-ins`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Weekly Check-ins                          Week: [5 ▼]      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Total: 42  │  Pending Analysis: 8  │  At Risk: 3│
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Fellow    Week Energy Sentiment Risk      Actions    │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe  5    7/10   😊 0.6    ✅ Low    [Analyze] │ │
│  │ Jane S.   5    8/10   😄 0.8    ✅ Low    [View]    │ │
│  │ Bob Lee   5    3/10   😟 -0.4   🔴 High   [Review]  │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Data Entry Flow**:
```
Option A - Fellow Self-Service (Recommended):
  ↓
Fellow logs in to /my-check-in
  ↓
Fills weekly form:
  - What did you accomplish this week?
  - What are you focusing on next week?
  - Any blockers?
  - Do you need help?
  - Self-assessment (Exceeded/Met/Below)
  - Team collaboration (Great/Good/Okay/Struggling)
  - Energy level (1-10)
  ↓
[Submit] → Creates check_in record
  ↓
Manager sees new check-in
  ↓
[Analyze AI] → AI analyzes sentiment, risk, blockers
  ↓
Results show in dashboard

Option B - Manual Entry:
Manager clicks [+ Add Check-in]
  ↓
Selects fellow, enters data
```

---

#### 6. **Risk Dashboard** (`/risk`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Risk Dashboard - Week 5                                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┬────────────┬────────────┬────────────┐   │
│  │ ✅ On Track│ ⚠️ Monitor │ 🟠 At Risk │ 🔴 Critical│   │
│  │     35     │     4      │     3      │     0      │   │
│  └────────────┴────────────┴────────────┴────────────┘   │
│                                                             │
│  Filter: [All] [On Track] [Monitor] [At Risk] [Critical]  │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Fellow    Risk    Score  M1   M2   Warnings Actions  │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe  Monitor  0.35  3.2  -    0        [Assess]│ │
│  │ Bob Lee   At Risk  0.68  2.1  2.3  1        [Warn]  │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**How Risk is Calculated (Auto)**:
```
System automatically combines:
  - Check-in frequency (missed check-ins = risk ↑)
  - Sentiment scores (negative = risk ↑)
  - Energy levels (low energy = risk ↑)
  - Collaboration issues (struggling = risk ↑)
  - Milestone scores (below 2.5/4 = risk ↑)
  - Warning count (warnings = risk ↑)
  ↓
Produces Risk Score (0.0 - 1.0)
  ↓
Categorized as: On Track / Monitor / At Risk / Critical
```

**User Flow**:
```
Manager reviews dashboard weekly
  ↓
Sees Bob Lee is "At Risk"
  ↓
Clicks [View] to see details:
  - Recent check-ins
  - Risk trend over time
  - Specific concerns
  - Recommended action
  ↓
Decides to issue warning
  ↓
Clicks [Draft Warning]
```

---

### **Phase 4: Warning Workflow**

#### 7. **Warnings Management** (`/warnings` - TO BUILD)
**Who sees it**: Program Managers

**What it would show**:
```
┌────────────────────────────────────────────────────────────┐
│ Warnings                                                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Active: 5  │  Acknowledged: 12  │  Resolved: 8  │
│                                                             │
│  Table:                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Fellow    Level  Issued    Ack'd   Status   Actions  │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ Bob Lee   First  2d ago    ✗ No    Pending  [View]  │ │
│  │ Sam Park  Final  1w ago    ✓ Yes   Resolved [View]  │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**User Flow**:
```
From Risk Dashboard:
  ↓
Manager clicks [Draft Warning] for Bob Lee
  ↓
Modal: Draft Warning
  ┌──────────────────────────────────────────┐
  │ Draft Warning - Bob Lee                   │
  ├──────────────────────────────────────────┤
  │ Level: ● First Warning  ○ Final Warning   │
  │                                           │
  │ Concerns:                                 │
  │ [x] Missed 2 of 3 check-ins               │
  │ [x] Low energy (avg 3.5/10)               │
  │ [x] Collaboration struggling              │
  │                                           │
  │ [Generate AI Draft] ← Clicks this         │
  └──────────────────────────────────────────┘
  ↓
AI generates empathetic message:
  ┌──────────────────────────────────────────┐
  │ Hi Bob,                                   │
  │                                           │
  │ I wanted to check in with you. I've      │
  │ noticed you've missed a couple weekly     │
  │ check-ins and your energy levels seem    │
  │ lower than usual. I'm concerned and      │
  │ want to make sure you have the support   │
  │ you need.                                 │
  │                                           │
  │ Requirements for next 2 weeks:            │
  │ 1. Submit all weekly check-ins on time   │
  │ 2. Schedule 1-on-1 meeting within 3 days │
  │ 3. Share any blockers you're facing      │
  │                                           │
  │ I believe in your potential...            │
  │                                           │
  │ [Edit Message] [Issue Warning]            │
  └──────────────────────────────────────────┘
  ↓
Manager reviews, optionally edits
  ↓
Clicks [Issue Warning]
  ↓
Email sent to Bob
  ↓
Warning appears in Bob's dashboard
  ↓
Bob acknowledges warning
```

---

### **Phase 5: Placement**

#### 8. **Placement Dashboard** (`/placement`)
**Who sees it**: Program Managers

**What it shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Placement & Job Matching                                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stats:  Ready: 35  │  Matched: 18  │  Placed: 12         │
│                                                             │
│  Tabs: [Fellows Ready] [Job Opportunities] [Matches]      │
│                                                             │
│  Fellows Ready for Placement:                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Fellow    Role      Profile  Matches    Actions      │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ John Doe  Frontend  ✓ Ready  5 matched  [View]      │ │
│  │ Jane S.   Designer  ✗ Draft  2 matched  [Generate]  │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 🎬 Complete Demo Scenario

### **Realistic 12-Week Fellow Journey**

```
Week 0: Application
  ↓ Manual entry or form → applicants table

Week 1: Screening
  ↓ Manager evaluates → screening_results table
  ↓ Send Microship challenge

Week 2: Microship
  ↓ Applicant submits → microship_submissions table
  ↓ AI evaluates → raw_analysis stored
  ↓ Manager accepts → fellow created

Week 3: Onboarding
  ↓ Fellow assigned to team
  ↓ First check-in submitted → check_ins table

Weeks 4-10: Active Program
  ↓ Weekly check-ins → AI analyzes
  ↓ Risk assessments run → risk_assessments table
  ↓ Milestones graded → milestone_scores updated

Week 8: Warning (if needed)
  ↓ Risk detected → warning drafted
  ↓ Manager issues → warnings table
  ↓ Fellow acknowledges

Week 11: Placement Prep
  ↓ Profile generated → fellow_profiles table
  ↓ Jobs matched → placement_matches table

Week 12: Graduation
  ↓ Final assessment
  ↓ Introductions sent
  ↓ Fellow status → "completed" or "placed"
```

---

## 💡 Missing Pieces for Full User Experience

### **Currently Missing (Would Improve UX)**:

1. **Fellow Portal** (`/fellow-dashboard`)
   - Fellows can't login yet
   - Need self-service check-in submission
   - View their own risk status
   - Acknowledge warnings

2. **Public Application Form**
   - External form that feeds into `/applicants`
   - Could be Google Forms → Zapier → API
   - Or custom Next.js page at `/apply`

3. **Email Notifications**
   - Send Microship challenges
   - Send warnings
   - Send job introductions
   - Currently just API - no email integration

4. **Warning UI Page** (`/warnings/page.tsx`)
   - API exists
   - No frontend UI yet
   - Managers can't draft/issue from UI (only API)

5. **Bulk Import**
   - Import applicants from CSV
   - Import check-ins from spreadsheet

6. **Data Seeding Script**
   - Populate realistic demo data
   - Currently empty database

---

## 🎯 Recommended Next Steps

### **Option A: Minimal Demo (1 hour)**
1. Create seed data script
2. Populate with realistic data
3. Login and click through features
4. Show AI evaluation on sample data

### **Option B: Fellow Portal (3-4 hours)**
1. Create `/fellow-dashboard/page.tsx`
2. Add check-in submission form
3. Add warning acknowledgment
4. Show fellow's own stats

### **Option C: Warning UI (2-3 hours)**
1. Create `/warnings/page.tsx`
2. List warnings table
3. Draft warning modal with AI
4. Issue warning workflow

### **Option D: Application Form (2 hours)**
1. Create `/apply/page.tsx` (public route)
2. Form with all applicant fields
3. Submit → creates applicant
4. Confirmation email (optional)

---

## 🤔 Which Direction Makes Most Sense?

**For Demo/Portfolio**: Option A (seed data)
**For Usability**: Option B (fellow portal)
**For Completeness**: Option C (warning UI)
**For Real Use**: Option D (application form)

**What would be most valuable for you?**
