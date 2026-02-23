#!/bin/bash

# ============================================
# Rollback Script for SocietyFlow
# ============================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <environment>"
    echo ""
    echo "Arguments:"
    echo "  environment   : staging|production"
    echo ""
    echo "This script will:"
    echo "  1. Stop the current API container"
    echo "  2. Restore the previous Docker image"
    echo "  3. Restore the database from the latest backup"
    echo "  4. Restart services"
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Confirmation prompt
log_warn "⚠️  WARNING: You are about to rollback ${ENVIRONMENT} environment!"
log_warn "This will:"
log_warn "  - Stop current services"
log_warn "  - Revert to previous Docker image"
log_warn "  - Restore database from latest backup"
read -p "Type 'ROLLBACK' to continue: " confirmation
if [ "$confirmation" != "ROLLBACK" ]; then
    log_error "Rollback cancelled."
    exit 1
fi

cd "$PROJECT_ROOT"

log_info "Starting rollback for ${ENVIRONMENT} environment..."

# Determine compose file
if [ "$ENVIRONMENT" == "staging" ]; then
    COMPOSE_FILE="backend/docker-compose.staging.yml"
    CONTAINER_NAME="societyflow-api-staging"
else
    COMPOSE_FILE="backend/docker-compose.prod.yml"
    CONTAINER_NAME="societyflow-api-prod"
fi

# Stop current container
log_info "Stopping current API container..."
docker-compose -f "$COMPOSE_FILE" stop api

# Get previous image
log_info "Finding previous Docker image..."
PREVIOUS_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep societyflow-api | head -2 | tail -1)

if [ -z "$PREVIOUS_IMAGE" ]; then
    log_error "No previous image found!"
    log_error "Attempting to restore from backup only..."
else
    log_info "Previous image: ${PREVIOUS_IMAGE}"

    # Tag previous image as rollback
    docker tag "$PREVIOUS_IMAGE" "societyflow-api:rollback-${ENVIRONMENT}"

    # Update docker-compose to use rollback image
    export VERSION="rollback-${ENVIRONMENT}"
fi

# Restore database from latest backup
log_info "Restoring database from latest backup..."
"${SCRIPT_DIR}/restore-db.sh" "$ENVIRONMENT" latest

if [ $? -ne 0 ]; then
    log_error "Database restore failed!"
    exit 1
fi

# Restart services
log_info "Restarting services..."
docker-compose -f "$COMPOSE_FILE" up -d api

# Wait for health check
log_info "Waiting for services to be healthy..."
sleep 30

# Check health
log_info "Checking API health..."
HEALTH_CHECK=$(docker exec "$CONTAINER_NAME" wget -q -O - http://localhost:3000/health/ready || echo "FAILED")

if [[ "$HEALTH_CHECK" == *"ready"* ]] || [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    log_info "✅ Rollback completed successfully!"
    log_info "Services are healthy and running."
else
    log_error "❌ Rollback completed but health check failed!"
    log_error "Please investigate manually."
    exit 1
fi

log_info "Rollback process completed for ${ENVIRONMENT} environment."
log_warn "Please verify the application is working correctly."
