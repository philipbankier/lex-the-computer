#!/usr/bin/env bash
set -euo pipefail

# Lex Deploy Script
# One-line deploy: pull, migrate, restart, verify

echo "=== Lex Deploy ==="

# 1. Pull latest images
echo "→ Pulling latest images..."
docker compose pull 2>/dev/null || echo "  (no remote images, using local build)"

# 2. Build if needed
echo "→ Building..."
docker compose build

# 3. Run database migrations
echo "→ Running migrations..."
docker compose run --rm core pnpm migrate 2>/dev/null || echo "  (migrations skipped — will run on start)"

# 4. Restart services
echo "→ Restarting services..."
docker compose up -d

# 5. Wait for health check
echo "→ Waiting for health check..."
RETRIES=30
CORE_URL="${CORE_URL:-http://localhost:3001}"
for i in $(seq 1 $RETRIES); do
  if curl -sf "${CORE_URL}/health" > /dev/null 2>&1; then
    echo "  ✓ Health check passed"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "  ✗ Health check failed after ${RETRIES} attempts"
    echo "    Check logs: docker compose logs core"
    exit 1
  fi
  sleep 2
done

# 6. Verify readiness
if curl -sf "${CORE_URL}/ready" > /dev/null 2>&1; then
  echo "  ✓ Readiness check passed"
else
  echo "  ⚠ Readiness check failed (DB/Redis may still be starting)"
fi

echo ""
echo "=== Deploy Complete ==="
echo "  Web:  http://localhost:3000"
echo "  API:  ${CORE_URL}"
echo "  Logs: docker compose logs -f"
