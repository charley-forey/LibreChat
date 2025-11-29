#!/bin/bash

# LibreChat Deployment Script for app.construct.chat
# This script automates the deployment process

set -e  # Exit on error

echo "🚀 Starting LibreChat Deployment for app.construct.chat"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit .env file and update the security secrets before continuing!${NC}"
        echo -e "${YELLOW}   Run: nano .env${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Check if librechat.yaml exists
if [ ! -f librechat.yaml ]; then
    echo -e "${RED}❌ librechat.yaml not found. Please create it first.${NC}"
    exit 1
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use.${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available.${NC}"
        return 0
    fi
}

# Check required ports
echo ""
echo "Checking required ports..."
check_port 3081 || echo -e "${YELLOW}   This is expected if the app is already running.${NC}"
check_port 3082 || echo -e "${YELLOW}   This is expected if the app is already running.${NC}"

# Start Docker if not running
if ! sudo systemctl is-active --quiet docker; then
    echo ""
    echo "Starting Docker service..."
    sudo systemctl start docker
fi

# Determine compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Ask user what they want to do
echo ""
echo "What would you like to do?"
echo "1) Build and start (builds image from source)"
echo "2) Start only (uses existing/pre-built image)"
echo "3) Stop containers"
echo "4) View logs"
echo "5) Restart containers"
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "🔨 Building and starting containers..."
        sudo $COMPOSE_CMD -f ./deploy-compose.yml up -d --build
        ;;
    2)
        echo ""
        echo "▶️  Starting containers..."
        sudo $COMPOSE_CMD -f ./deploy-compose.yml up -d
        ;;
    3)
        echo ""
        echo "⏹️  Stopping containers..."
        sudo $COMPOSE_CMD -f ./deploy-compose.yml down
        echo -e "${GREEN}✅ Containers stopped.${NC}"
        exit 0
        ;;
    4)
        echo ""
        echo "📋 Showing logs (Press Ctrl+C to exit)..."
        sudo $COMPOSE_CMD -f ./deploy-compose.yml logs -f
        exit 0
        ;;
    5)
        echo ""
        echo "🔄 Restarting containers..."
        sudo $COMPOSE_CMD -f ./deploy-compose.yml restart
        echo -e "${GREEN}✅ Containers restarted.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice.${NC}"
        exit 1
        ;;
esac

# Wait a moment for containers to start
sleep 3

# Check container status
echo ""
echo "📊 Container Status:"
sudo $COMPOSE_CMD -f ./deploy-compose.yml ps

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🌐 Your app should be accessible at: https://app.construct.chat"
echo ""
echo "📝 Useful commands:"
echo "   View logs:        sudo $COMPOSE_CMD -f ./deploy-compose.yml logs -f"
echo "   Stop containers:  sudo $COMPOSE_CMD -f ./deploy-compose.yml down"
echo "   Restart:          sudo $COMPOSE_CMD -f ./deploy-compose.yml restart"
echo "   Check status:     sudo $COMPOSE_CMD -f ./deploy-compose.yml ps"
echo ""

