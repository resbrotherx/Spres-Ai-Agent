@echo off
REM Brainbox Backend Setup Script for Windows

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Brainbox Backend Setup for Windows
echo ========================================
echo.

REM Check Python
echo Checking Python installation...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found. Please install Python 3.11+ from https://www.python.org
    exit /b 1
)
python --version
echo.

REM Create virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo Virtual environment created.
)
echo.

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Install dependencies
echo Installing dependencies...
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
echo Dependencies installed.
echo.

REM Check Docker
echo Checking Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Docker not found. Install from https://www.docker.com/products/docker-desktop
) else (
    docker --version
    docker-compose --version
)
echo.

REM Suggest next steps
echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Start Docker services: docker-compose up -d
echo   2. Wait for services to start (30-60 seconds)
echo   3. In another terminal, start FastAPI:
echo      uvicorn app.main:app --reload
echo   4. In another terminal, start Celery:
echo      celery -A app.celery_app.celery worker --loglevel=info
echo.
echo API Documentation: http://localhost:8000/docs
echo.
pause
