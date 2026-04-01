#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Ginkgo Leaf — VPS Deploy Script
# Deploys Docker infrastructure on Hostinger KVM 4
# Usage: bash infra/docker/deploy.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🌿 Ginkgo Leaf — Docker Deploy"
echo "───────────────────────────────"

# 1. Check .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found. Copy .env.example and fill values:"
  echo "   cp .env.example .env"
  exit 1
fi

# 2. Check Docker is available
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker first."
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose V2 not found."
  exit 1
fi

# 3. Pull latest images
echo ""
echo "📦 Pulling latest images..."
docker compose pull

# 4. Start services
echo ""
echo "🚀 Starting services..."
docker compose up -d

# 5. Health check
echo ""
echo "⏳ Waiting for services to become healthy (30s)..."
sleep 30

echo ""
echo "📊 Service status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ Deploy complete."
echo ""
echo "Services:"
echo "  Traefik dashboard : check docker logs ginkgo-traefik"
echo "  n8n               : https://n8n.ginkgosystems.tech"
echo "  Evolution API     : https://wa.ginkgosystems.tech"
echo "  Chatwoot           : https://chat.ginkgosystems.tech"
echo "  Redis             : internal only (redis:6379)"
echo ""
echo "Logs: docker compose logs -f <service>"
