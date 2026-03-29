#!/usr/bin/env bash
set -euo pipefail

# Lex Restore Script
# Usage: ./scripts/restore.sh <backup_file.tar.gz>

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.tar.gz>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "=== Lex Restore ==="
echo "  From: ${BACKUP_FILE}"
echo ""
read -p "This will overwrite existing data. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

TEMP_DIR="/tmp/lex-restore-$$"
mkdir -p "${TEMP_DIR}"

echo "→ Extracting archive..."
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"
BACKUP_DIR=$(ls "${TEMP_DIR}" | head -1)

# 1. Restore database
if [ -f "${TEMP_DIR}/${BACKUP_DIR}/database.sql" ]; then
  echo "→ Restoring PostgreSQL..."
  DB_URL="${DATABASE_URL:-postgresql://lex:lexpassword@localhost:5432/lex}"
  if command -v psql &>/dev/null; then
    psql "${DB_URL}" < "${TEMP_DIR}/${BACKUP_DIR}/database.sql"
    echo "  ✓ Database restored"
  elif docker ps --format '{{.Names}}' | grep -q postgres; then
    CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
    docker exec -i "${CONTAINER}" psql -U lex lex < "${TEMP_DIR}/${BACKUP_DIR}/database.sql"
    echo "  ✓ Database restored (via Docker)"
  else
    echo "  ⚠ psql not available, skipping database restore"
  fi
fi

# 2. Restore workspace
if [ -d "${TEMP_DIR}/${BACKUP_DIR}/workspace" ]; then
  WORKSPACE="${WORKSPACE_DIR:-./workspace}"
  echo "→ Restoring workspace files..."
  mkdir -p "${WORKSPACE}"
  cp -r "${TEMP_DIR}/${BACKUP_DIR}/workspace/"* "${WORKSPACE}/"
  echo "  ✓ Workspace restored to ${WORKSPACE}"
fi

# 3. Restore .env
if [ -f "${TEMP_DIR}/${BACKUP_DIR}/env.backup" ]; then
  echo "→ .env backup found at: ${TEMP_DIR}/${BACKUP_DIR}/env.backup"
  echo "  Review and copy manually if needed."
fi

rm -rf "${TEMP_DIR}"

echo ""
echo "=== Restore Complete ==="
echo "  Restart services: docker compose restart"
