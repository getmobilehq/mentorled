#!/bin/bash
# MentorLed AI-Ops Platform - Automated Startup Script

set -e

echo "🚀 MentorLed AI-Ops Platform - Startup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo ""
    echo "Please start Docker Desktop:"
    echo "  1. Open Docker Desktop from Applications"
    echo "  2. Wait for Docker to start (icon in menu bar)"
    echo "  3. Run this script again"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Start services
echo ""
echo "🐳 Starting services..."
docker-compose up -d

# Wait for backend to be ready
echo ""
echo "⏳ Waiting for backend to be ready..."
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo "Check logs with: docker-compose logs backend"
        exit 1
    fi
    echo -n "."
    sleep 2
done

# Seed database
echo ""
echo "🌱 Seeding database with sample data..."
docker-compose exec -T backend python /scripts/seed_data.py

# Health check
echo ""
echo "🏥 Running health check..."
health=$(curl -s http://localhost:8000/health)
echo "$health" | jq '.' 2>/dev/null || echo "$health"

# Get an applicant for testing
echo ""
echo "👥 Getting sample applicant..."
APPLICANT_ID=$(curl -s http://localhost:8000/api/applicants/ | jq -r '.[0].id')
APPLICANT_NAME=$(curl -s http://localhost:8000/api/applicants/ | jq -r '.[0].name')

echo -e "${GREEN}✓ Sample applicant: $APPLICANT_NAME${NC}"
echo -e "${BLUE}Applicant ID: $APPLICANT_ID${NC}"

# Test AI agent
echo ""
echo "🤖 Testing AI Screening Agent..."
echo "This will evaluate $APPLICANT_NAME's application using Claude AI..."
echo ""

curl -X POST "http://localhost:8000/api/screening/application/evaluate" \
  -H "Content-Type: application/json" \
  -d "{\"applicant_id\": \"$APPLICANT_ID\"}" \
  -s | jq '.' > /tmp/mentorled_evaluation.json

if [ -f /tmp/mentorled_evaluation.json ]; then
    echo -e "${GREEN}✓ AI Evaluation Complete!${NC}"
    echo ""
    echo "📊 Results:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    overall_score=$(jq -r '.overall_score' /tmp/mentorled_evaluation.json)
    eligibility=$(jq -r '.eligibility' /tmp/mentorled_evaluation.json)
    confidence=$(jq -r '.confidence' /tmp/mentorled_evaluation.json)
    recommended_action=$(jq -r '.recommended_action' /tmp/mentorled_evaluation.json)

    echo "Overall Score: $overall_score/100"
    echo "Eligibility: $eligibility"
    echo "Confidence: $confidence"
    echo "Recommended Action: $recommended_action"
    echo ""
    echo "Reasoning:"
    jq -r '.reasoning' /tmp/mentorled_evaluation.json
    echo ""
    echo "Full results saved to: /tmp/mentorled_evaluation.json"
fi

# Show access points
echo ""
echo "======================================"
echo "✅ Platform is Running!"
echo "======================================"
echo ""
echo "🌐 Access Points:"
echo "  • API Documentation: ${BLUE}http://localhost:8000/docs${NC}"
echo "  • Health Check: ${BLUE}http://localhost:8000/health${NC}"
echo "  • API Base: ${BLUE}http://localhost:8000/api${NC}"
echo ""
echo "📊 Quick Commands:"
echo "  • View applicants: ${YELLOW}curl http://localhost:8000/api/applicants/ | jq '.'${NC}"
echo "  • Check queue: ${YELLOW}curl http://localhost:8000/api/screening/queue | jq '.'${NC}"
echo "  • View logs: ${YELLOW}docker-compose logs -f backend${NC}"
echo "  • Stop platform: ${YELLOW}docker-compose down${NC}"
echo ""
echo "📚 Documentation:"
echo "  • START_HERE.md - Getting started guide"
echo "  • TESTING.md - Comprehensive testing"
echo "  • BUILD_SUMMARY.md - Architecture overview"
echo ""
echo "💰 View AI Costs:"
echo "  ${YELLOW}docker-compose exec db psql -U mentorled -c \"SELECT action, COUNT(*), SUM(ai_cost_usd) FROM audit_log WHERE actor_type = 'ai_agent' GROUP BY action;\"${NC}"
echo ""
echo "🎉 Ready to use! Visit http://localhost:8000/docs to explore the API"
echo ""
