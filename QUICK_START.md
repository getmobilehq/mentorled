# Quick Start Guide - Setup & Fix Common Issues

## Issue 1: CORS Error (Frontend can't connect to Backend)

**Error**: `Access to XMLHttpRequest at 'http://localhost:8000/api/auth/login' from origin 'http://localhost:3002' has been blocked by CORS policy`

### Solution: Configure Backend CORS

I've created a `.env` file for you at `backend/.env`. You need to:

1. **Add your Anthropic API Key**:
   ```bash
   cd backend
   nano .env  # or use your preferred editor
   ```

2. **Update the `ANTHROPIC_API_KEY` line**:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
   ```
   Get your API key from: https://console.anthropic.com/

3. **Restart the backend**:
   ```bash
   # Stop the current backend (Ctrl+C)
   # Then restart it
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

4. **Verify CORS is working**:
   - Open http://localhost:3002/login
   - Try logging in again
   - The error should be gone!

---

## Issue 2: Login Credentials Don't Work

The login credentials don't work because **no users exist in the database yet**. Here's how to fix it:

---

## Solution 1: Create Admin User via API (Fastest)

Since your backend is already running, use the signup endpoint:

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mentorled.com",
    "password": "admin123",
    "full_name": "Admin User",
    "role": "admin"
  }'
```

**Expected Response**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhb...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhb...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-here",
    "email": "admin@mentorled.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true,
    "is_superuser": true
  }
}
```

✅ **Done! Now you can login with:**
- Email: `admin@mentorled.com`
- Password: `admin123`

---

## Solution 2: Run the Admin Creation Script

If you prefer using Python:

```bash
# Navigate to backend
cd /Users/josephagunbiade/Desktop/studio/mentorled/backend

# Activate virtual environment
source venv/bin/activate

# Run the script
python scripts/create_admin.py
```

**Expected Output**:
```
✅ Admin user created successfully!
   Email: admin@mentorled.com
   Password: admin123
   Role: admin
   ID: <uuid>

🔐 You can now login with these credentials.
```

---

## Now Test Login

```bash
# Get access token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mentorled.com","password":"admin123"}'
```

**Expected Response**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbG...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbG...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@mentorled.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true,
    "is_superuser": true,
    "permissions": null
  }
}
```

---

## Save Token for Future Use

```bash
# Extract and save the token
export TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mentorled.com","password":"admin123"}' | jq -r '.access_token')

# Verify it's set
echo $TOKEN

# Use it in API calls
curl http://localhost:8000/api/applicants \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Login

1. Open http://localhost:3002/login
2. Enter:
   - Email: `admin@mentorled.com`
   - Password: `admin123`
3. Click "Sign In"

You should now be logged in and able to access all features!

---

## What Happened?

- The system has no default users
- You need to create at least one admin user first
- The signup endpoint is open (in production, you'd restrict this)
- Once created, the credentials work for both API and frontend

---

## Issue 3: Empty Database - Need Demo Data

After creating the admin user, you'll have an empty database with no applicants, fellows, or check-ins to view.

### Solution: Run the Seed Data Script

The seed script creates realistic demo data including:
- 50 applicants with microship submissions
- 30 fellows in an active cohort (Week 8/12)
- 200+ check-ins with varied sentiments
- Milestones, warnings, and risk assessments
- Fellows in different states (on track, warnings, at-risk)

**Run the seed script**:

```bash
# Navigate to backend
cd /Users/josephagunbiade/Desktop/studio/mentorled/backend

# Activate virtual environment
source venv/bin/activate

# Run the seed script
python scripts/seed_data.py
```

**Expected Output**:
```
============================================================
MentorLed Platform - Database Seeding Script
============================================================
Creating database tables...
✓ Tables created
✓ Admin user created: admin@mentorled.com / admin123
✓ Created cohort: 2024 Q4 Cohort (active, week 8/12)
✓ Created cohort: 2024 Q2 Cohort (completed)
✓ Created 50 applicants
✓ Created 45 microship submissions
✓ Created 30 fellows
✓ Created 220 check-ins across 8 weeks
✓ Created 150 milestones
✓ Created 12 warnings
✓ Created 30 risk assessments

✅ SEEDING COMPLETE!

Summary:
  - Applicants: 50
  - Fellows: 30 (25 on track, 3 with warnings, 2 at risk)
  - Check-ins: 220
  - Milestones: 150
  - Warnings: 12
  - Risk Assessments: 30
```

**Now explore the platform**:

1. **Applicants** → http://localhost:3002/applicants
   - View 50 applicants with various backgrounds

2. **Microship Submissions** → http://localhost:3002/microship
   - See ~45 submissions ready for AI evaluation
   - Click "Evaluate" to run AI scoring

3. **Fellows Dashboard** → http://localhost:3002/fellows
   - View 30 active fellows in Week 8 of fellowship

4. **Check-ins** → http://localhost:3002/check-ins
   - Filter by week, see sentiment scores
   - Click "Analyze" to run AI analysis

5. **Risk Dashboard** → http://localhost:3002/risk
   - See cohort-wide risk assessment
   - Fellows categorized: on track / monitor / at-risk / critical

---

## Next Steps

1. ✅ Create admin user (you just did this)
2. ✅ Populate demo data (run seed script)
3. Login: http://localhost:3002/login
   - Email: `admin@mentorled.com`
   - Password: `admin123`
4. Explore all features with live data!
5. Test AI features (microship evaluation, check-in analysis)
6. See `TESTING_GUIDE.md` for comprehensive testing

---

**Need help?** Check `TESTING_GUIDE.md` for full testing instructions.
