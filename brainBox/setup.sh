#!/bin/bash

set -e

echo "🚀 Brainbox Backend Setup Script"
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

# Check Python version
echo -e "${BLUE}Checking Python version...${NC}"
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" = "$required_version" ]; then
    echo -e "${GREEN}✓ Python $python_version${NC}"
else
    echo -e "${YELLOW}⚠ Python 3.11+ required (found $python_version)${NC}"
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo -e "${BLUE}Creating virtual environment...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}Activating virtual environment...${NC}"
source venv/bin/activate || . venv/Scripts/activate

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Check Docker
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker installed${NC}"
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose installed${NC}"
    else
        echo -e "${YELLOW}⚠ Docker Compose not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Docker not installed${NC}"
fi

# Initialize database
echo -e "${BLUE}Setting up database...${NC}"
python3 -c "from app.db.session import init_db; init_db()" 2>/dev/null && echo -e "${GREEN}✓ Database initialized${NC}" || echo -e "${YELLOW}⚠ Database initialization skipped (service not running)${NC}"

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Start services: docker-compose up -d"
echo "2. Start FastAPI: uvicorn app.main:app --reload"
echo "3. Start Celery (in another terminal): celery -A app.celery_app.celery worker --loglevel=info"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "- API: http://localhost:8000/docs"
echo "- README: ./README.md"
