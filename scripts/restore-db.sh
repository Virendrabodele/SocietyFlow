#!/bin/bash

# ============================================
# Database Restore Script for SocietyFlow
# ============================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <environment> <backup_file>"
    echo ""
    echo "Arguments:"
    echo "  environment   : dev|staging|production"
    echo "  backup_file   : Path to backup file (.sql.gz)"
    echo ""
    echo "Examples:"
    echo "  $0 staging /path/to/backup.sql.gz"
    echo "  $0 production latest  # Restores latest backup"
    exit 1
}

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate arguments
if [ $# -lt 2 ]; then
    usage
fi

ENVIRONMENT=$1
BACKUP_FILE=$2

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Find latest backup if requested
if [ "$BACKUP_FILE" == "latest" ]; then
    BACKUP_FILE=$(find "$BACKUP_DIR/${ENVIRONMENT}" -name "backup_${ENVIRONMENT}_full_*.sql.gz" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -z "$BACKUP_FILE" ]; then
        log_error "No backups found for environment: $ENVIRONMENT"
        exit 1
    fi
    log_info "Using latest backup: $BACKUP_FILE"
fi

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
ENV_FILE="${PROJECT_ROOT}/backend/.env.${ENVIRONMENT}"
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

# Export DATABASE_URL from env file
export $(grep DATABASE_URL "$ENV_FILE" | xargs)

if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL not found in $ENV_FILE"
    exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Confirmation prompt for production
if [ "$ENVIRONMENT" == "production" ]; then
    log_warn "⚠️  WARNING: You are about to restore production database!"
    log_warn "This will overwrite all current data in the production database."
    read -p "Type 'RESTORE PRODUCTION' to continue: " confirmation
    if [ "$confirmation" != "RESTORE PRODUCTION" ]; then
        log_error "Restore cancelled."
        exit 1
    fi
fi

log_info "Starting database restore for ${ENVIRONMENT} environment"
log_info "Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
log_info "Backup file: ${BACKUP_FILE}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Create a backup before restore
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="${BACKUP_DIR}/${ENVIRONMENT}/pre_restore_backup_${TIMESTAMP}.sql.gz"

log_info "Creating pre-restore backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose --no-owner --no-acl -F p | gzip > "$PRE_RESTORE_BACKUP"

log_info "Pre-restore backup saved: ${PRE_RESTORE_BACKUP}"

# Decompress backup
TEMP_SQL="/tmp/restore_${TIMESTAMP}.sql"
log_info "Decompressing backup..."
gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"

# Drop existing connections
log_info "Dropping existing connections..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true

# Restore database
log_info "Restoring database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$TEMP_SQL"

# Cleanup temp file
rm -f "$TEMP_SQL"

# Verify restore
log_info "Verifying restore..."
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

log_info "Database restored successfully!"
log_info "Tables restored: ${TABLE_COUNT}"
log_info "Pre-restore backup saved at: ${PRE_RESTORE_BACKUP}"

log_warn "Please verify the application is working correctly."
log_warn "If issues occur, you can restore the pre-restore backup."
