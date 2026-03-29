#!/usr/bin/env bash
set -euo pipefail

# Lex Backup Script
# Usage: ./scripts/backup.sh [destination_dir]
# Creates a timestamped tarball of database and workspace files

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="lex-backup-${TIMESTAMP}"
TEMP_DIR="/tmp/${BACKUP_NAME}"

echo "=== Lex Backup — ${TIMESTAMP} ==="

mkdir -p "${BACKUP_DIR}" "${TEMP_DIR}"

# 1. PostgreSQL dump
echo "→ Dumping PostgreSQL..."
DB_URL="${DATABASE_URL:-postgresql://lex:lexpassword@localhost:5432/lex}"
if command -v pg_dump &>/dev/null; then
  pg_dump "${DB_URL}" --no-owner --no-acl > "${TEMP_DIR}/database.sql"
  echo "  ✓ Database dumped"
elif docker ps --format '{{.Names}}' | grep -q postgres; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
  docker exec "${CONTAINER}" pg_dump -U lex lex --no-owner --no-acl > "${TEMP_DIR}/database.sql"
  echo "  ✓ Database dumped (via Docker)"
else
  echo "  ⚠ pg_dump not available, skipping database"
fi

# 2. Workspace files
WORKSPACE="${WORKSPACE_DIR:-./workspace}"
if [ -d "${WORKSPACE}" ]; then
  echo "→ Copying workspace files..."
  cp -r "${WORKSPACE}" "${TEMP_DIR}/workspace"
  echo "  ✓ Workspace copied"
else
  echo "  ⚠ Workspace directory not found at ${WORKSPACE}"
fi

# 3. Environment file (without secrets redacted)
if [ -f ".env" ]; then
  echo "→ Backing up .env..."
  cp .env "${TEMP_DIR}/env.backup"
  echo "  ✓ .env backed up"
fi

# 4. Create tarball
echo "→ Creating archive..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C /tmp "${BACKUP_NAME}"
rm -rf "${TEMP_DIR}"

SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo ""
echo "=== Backup Complete ==="
echo "  File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "  Size: ${SIZE}"
echo ""
echo "To restore: ./scripts/restore.sh ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
