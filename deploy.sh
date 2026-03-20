#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================"
echo "🚀 Starting Deployment Pipeline..."
echo "========================================"

# 1. Pull latest code from GitHub
echo "📥 Pulling latest code from origin/main..."
git pull origin main

# Log the latest commit
echo "📝 Latest Commit:"
git log -1 --stat

# 2. Install Backend Dependencies
echo "⚙️ Installing Backend Dependencies..."
cd backend
npm install
cd ..

# 3. Install Frontend Dependencies & Build
echo "🎨 Installing Frontend Dependencies..."
cd frontend
npm install

echo "🏗️ Building Frontend (Vite)..."
npm run build
cd ..

# 4. Restarting the Application
echo "🔄 Restarting Application..."
# -------------------------------------------------------------------------
# INSTRUCTION FOR USER: Uncomment and modify the correct restart command below
# depending on your Linux server environment.
# -------------------------------------------------------------------------

# Option A: If using PM2 for the backend
# pm2 restart backend-app-name

# Option B: If using systemd service
# sudo systemctl restart your-backend-service

# Option C: If using Docker Compose
# docker-compose down
# docker-compose up -d --build

echo "========================================"
echo "✅ Deployment Successful!"
echo "========================================"
