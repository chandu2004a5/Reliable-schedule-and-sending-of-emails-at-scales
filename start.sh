#!/bin/bash

# ReachInbox Outbox - Startup Script
# This script helps you get the application running quickly

set -e  # Exit on error

echo "🚀 ReachInbox Outbox - Startup Script"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your credentials:"
    echo "   1. Get Ethereal Email credentials: https://ethereal.email/"
    echo "   2. Get Google OAuth credentials: https://console.cloud.google.com/"
    echo "   3. Generate NextAuth secret: openssl rand -base64 32"
    echo ""
    echo "Press Enter after you've updated .env, or Ctrl+C to exit..."
    read
fi

echo "📦 Starting Docker containers..."
echo ""

# Start services
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
echo ""

# Wait for PostgreSQL
echo "Checking PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " ✅ PostgreSQL ready"

# Wait for Redis
echo "Checking Redis..."
until docker-compose exec -T redis redis-cli ping &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " ✅ Redis ready"

# Wait for backend
echo "Checking Backend API..."
until curl -s http://localhost:3001/health &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " ✅ Backend API ready"

# Wait for frontend
echo "Checking Frontend..."
until curl -s http://localhost:3000 &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " ✅ Frontend ready"

echo ""
echo "✅ All services are running!"
echo ""
echo "📋 Service URLs:"
echo "   - Frontend:   http://localhost:3000"
echo "   - Backend:    http://localhost:3001"
echo "   - API Health: http://localhost:3001/health"
echo ""
echo "📊 View logs:"
echo "   - All:        docker-compose logs -f"
echo "   - Worker:     docker-compose logs -f worker"
echo "   - Backend:    docker-compose logs -f backend"
echo "   - Frontend:   docker-compose logs -f frontend"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""
echo "📧 Test emails will be visible at:"
echo "   https://ethereal.email/ (login with your SMTP credentials)"
echo ""
echo "Happy scheduling! 🎉"
