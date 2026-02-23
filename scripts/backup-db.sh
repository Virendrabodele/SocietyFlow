#!/bin/bash

# ============================================
# Database Backup Script for SocietyFlow
# ============================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <environment> [backup_type]"
    echo ""
    echo "Arguments:"
    echo "  environment   : dev|staging|production"
    echo "  backup_type   : full|schema|data (default: full)"
    echo ""
    echo "Examples:"
    echo "  $0 production full"
    echo "  $0 staging schema"
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
if [ $# -lt 1 ]; then
    usage
fi

ENVIRONMENT=$1
BACKUP_TYPE=${2:-full}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Validate backup type
if [[ ! "$BACKUP_TYPE" =~ ^(full|schema|data)$ ]]; then
    log_error "Invalid backup type: $BACKUP_TYPE"
    usage
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
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Create backup directory
mkdir -p "$BACKUP_DIR/${ENVIRONMENT}"

# Set backup filename
BACKUP_FILE="${BACKUP_DIR}/${ENVIRONMENT}/backup_${ENVIRONMENT}_${BACKUP_TYPE}_${TIMESTAMP}.sql"
BACKUP_COMPRESSED="${BACKUP_FILE}.gz"

log_info "Starting ${BACKUP_TYPE} backup for ${ENVIRONMENT} environment"
log_info "Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
log_info "Backup file: ${BACKUP_COMPRESSED}"

# Export password for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Perform backup based on type
case "$BACKUP_TYPE" in
    full)
        log_info "Creating full backup (schema + data)..."
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --no-owner --no-acl -F p > "$BACKUP_FILE"
        ;;
    schema)
        log_info "Creating schema-only backup..."
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --no-owner --no-acl --schema-only -F p > "$BACKUP_FILE"
        ;;
    data)
        log_info "Creating data-only backup..."
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --no-owner --no-acl --data-only -F p > "$BACKUP_FILE"
        ;;
esac

# Compress backup
log_info "Compressing backup..."
gzip "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_COMPRESSED" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_COMPRESSED" | cut -f1)
    log_info "Backup completed successfully!"
    log_info "Backup size: ${BACKUP_SIZE}"
    log_info "Backup location: ${BACKUP_COMPRESSED}"
else
    log_error "Backup failed!"
    exit 1
fi

# Cleanup old backups (keep last 14 daily, 8 weekly, 6 monthly)
log_info "Cleaning up old backups..."

# Keep last 14 daily backups
find "$BACKUP_DIR/${ENVIRONMENT}" -name "backup_${ENVIRONMENT}_${BACKUP_TYPE}_*.sql.gz" -mtime +14 -type f -delete

# Create monthly archive (first backup of the month)
MONTH=$(date +%Y%m)
MONTHLY_DIR="${BACKUP_DIR}/${ENVIRONMENT}/monthly"
mkdir -p "$MONTHLY_DIR"

if [ ! -f "${MONTHLY_DIR}/backup_${ENVIRONMENT}_${BACKUP_TYPE}_${MONTH}.sql.gz" ]; then
    cp "$BACKUP_COMPRESSED" "${MONTHLY_DIR}/backup_${ENVIRONMENT}_${BACKUP_TYPE}_${MONTH}.sql.gz"
    log_info "Created monthly archive"
fi

# Cleanup monthly backups (keep last 6 months)
find "$MONTHLY_DIR" -name "backup_${ENVIRONMENT}_${BACKUP_TYPE}_*.sql.gz" -mtime +180 -type f -delete

log_info "Backup process completed successfully!"

# Output backup info for automation
echo "BACKUP_FILE=${BACKUP_COMPRESSED}"
echo "BACKUP_SIZE=${BACKUP_SIZE}"
echo "BACKUP_TIMESTAMP=${TIMESTAMP}"
