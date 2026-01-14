#!/bin/bash
# Quick validation script for MentorLed AI-Ops Platform

set -e

echo "🔍 MentorLed AI-Ops Platform - Quick Validation"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if services are up
echo ""
echo "🚀 Checking services..."

if docker-compose ps | grep -q "backend.*Up"; then
    echo -e "${GREEN}✓ Backend service is up${NC}"
else
    echo -e "${RED}❌ Backend service is not running${NC}"
    echo -e "${YELLOW}Run: docker-compose up -d${NC}"
    exit 1
fi

if docker-compose ps | grep -q "db.*Up"; then
    echo -e "${GREEN}✓ Database service is up${NC}"
else
    echo -e "${RED}❌ Database service is not running${NC}"
    exit 1
fi

# Wait for backend to be ready
echo ""
echo "⏳ Waiting for backend to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo "Check logs with: docker-compose logs backend"
        exit 1
    fi
    sleep 2
done

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
health_response=$(curl -s http://localhost:8000/health)
if echo "$health_response" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi

# Check database tables
echo ""
echo "🗄️  Checking database tables..."
table_count=$(docker-compose exec -T db psql -U mentorled -t -c "\dt" | grep -c "public" || echo "0")
if [ "$table_count" -gt 10 ]; then
    echo -e "${GREEN}✓ Database tables created ($table_count tables)${NC}"
else
    echo -e "${YELLOW}⚠ Only $table_count tables found. Expected 15+${NC}"
    echo -e "${YELLOW}Run seed script: docker-compose exec backend python /app/../scripts/seed_data.py${NC}"
fi

# Check for seeded data
echo ""
echo "🌱 Checking seeded data..."
applicant_count=$(docker-compose exec -T db psql -U mentorled -t -c "SELECT COUNT(*) FROM applicants;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$applicant_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $applicant_count applicants in database${NC}"
else
    echo -e "${YELLOW}⚠ No applicants found. Run seed script.${NC}"
fi

# Check .env file
echo ""
echo "🔐 Checking configuration..."
if [ -f ".env" ]; then
    if grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        echo -e "${GREEN}✓ Anthropic API key configured${NC}"
    else
        echo -e "${YELLOW}⚠ Anthropic API key not set in .env${NC}"
        echo -e "${YELLOW}Add your key: ANTHROPIC_API_KEY=sk-ant-your-key-here${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}Copy from template: cp .env.example .env${NC}"
fi

# Final summary
echo ""
echo "================================================"
echo "📊 Validation Summary"
echo "================================================"
echo -e "${GREEN}Backend API:${NC} http://localhost:8000"
echo -e "${GREEN}API Docs:${NC} http://localhost:8000/docs"
echo -e "${GREEN}Database:${NC} PostgreSQL on port 5432"
echo ""
echo "✅ Basic validation complete!"
echo ""
echo "📖 Next steps:"
echo "1. Visit http://localhost:8000/docs to explore the API"
echo "2. Run TESTING.md tests to validate AI agents"
echo "3. Check README.md for full documentation"
echo ""
