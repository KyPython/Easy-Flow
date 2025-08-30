#!/bin/bash

echo "🚀 Deploying EasyFlow RPA System..."

# Exit on error
set -euo pipefail

# Helper to print status
step() { echo -e "\n🔹 $1"; }
ok() { echo "✅ $1"; }
warn() { echo "⚠️  $1"; }

# Ensure apt exists (Debian/Ubuntu expected on GCP image)
if ! command -v apt-get >/dev/null 2>&1; then
    warn "This script expects Debian/Ubuntu with apt-get. If you're on another distro, install Docker and Node manually."
fi


# Install Docker if missing
step "Ensuring Docker is installed..."
if ! command -v docker >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y docker.io docker-compose-plugin
    sudo systemctl enable --now docker || true
    sudo usermod -aG docker "$USER" || true
    newgrp docker <<'EOF'
echo "Switched to docker group"
EOF
fi
ok "Docker $(docker --version 2>/dev/null || echo installed)"

# Install Node.js if not present (for building React on server)
step "Ensuring Node.js is installed..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found after Node.js installation!"; exit 1
fi
ok "Node.js $(node --version) and npm $(npm --version) are available"

# Build the React dashboard
step "Building React dashboard..."
cd rpa-dashboard
npm install
npm run build
cd ..

# Check if build was successful
if [ ! -d "rpa-dashboard/build" ]; then
    echo "❌ React build failed!"
    exit 1
fi

echo "✅ React dashboard built successfully!"

# Start Docker containers
step "Preflight: checking .env values..."
if [ ! -f .env ]; then
    warn ".env not found. Copying from .env.example. You must edit it with real values."
    cp .env.example .env
fi

grep -q "CHANGEME_" .env && warn "Your .env contains CHANGEME_ placeholders. Backend may not fully work until you replace them."

step "Starting Docker containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml down || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

ok "Deployment complete!"
echo "🌐 API health (server): curl http://localhost:3030/health"
echo "🌐 If proxied with Nginx: https://<your-domain-or-duckdns>/health"
