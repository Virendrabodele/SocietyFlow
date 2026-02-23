#!/bin/bash

# ============================================
# One-Click Deployment Script for SocietyFlow
# ============================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <environment> [options]"
    echo ""
    echo "Arguments:"
    echo "  environment   : dev|staging|production"
    echo ""
    echo "Options:"
    echo "  --skip-backup      Skip database backup before deployment"
    echo "  --no-migrations    Skip database migrations"
    echo "  --force           Force deployment without confirmation"
    echo ""
    echo "Examples:"
    echo "  $0 staging"
    echo "  $0 production --force"
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validate prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log_info "✓ All prerequisites met"
}

# Parse arguments
SKIP_BACKUP=false
NO_MIGRATIONS=false
FORCE=false

if [ $# -lt 1 ]; then
    usage
fi

ENVIRONMENT=$1
shift

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --no-migrations)
            NO_MIGRATIONS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Check prerequisites
check_prerequisites

# Confirmation prompt (skip for dev or if forced)
if [ "$ENVIRONMENT" != "dev" ] && [ "$FORCE" = false ]; then
    log_warn "You are about to deploy to ${ENVIRONMENT} environment!"
    read -p "Continue? (yes/no): " confirmation
    if [ "$confirmation" != "yes" ]; then
        log_error "Deployment cancelled."
        exit 1
    fi
fi

cd "$PROJECT_ROOT"

log_info "=========================================="
log_info "Deploying SocietyFlow to ${ENVIRONMENT}"
log_info "=========================================="

# Determine compose file
case "$ENVIRONMENT" in
    dev)
        COMPOSE_FILE="backend/docker-compose.yml"
        ;;
    staging)
        COMPOSE_FILE="backend/docker-compose.staging.yml"
        ;;
    production)
        COMPOSE_FILE="backend/docker-compose.prod.yml"
        ;;
esac

# Step 1: Backup database (if not skipped and not dev)
if [ "$ENVIRONMENT" != "dev" ] && [ "$SKIP_BACKUP" = false ]; then
    log_step "Step 1: Creating database backup..."
    "${SCRIPT_DIR}/backup-db.sh" "$ENVIRONMENT" full
    if [ $? -ne 0 ]; then
        log_error "Backup failed! Aborting deployment."
        exit 1
    fi
    log_info "✓ Backup completed"
else
    log_info "Step 1: Skipping database backup"
fi

# Step 2: Pull latest code (if not dev)
if [ "$ENVIRONMENT" != "dev" ]; then
    log_step "Step 2: Pulling latest code from git..."
    git fetch origin
    git pull origin main
    log_info "✓ Code updated"
else
    log_info "Step 2: Skipping git pull (dev environment)"
fi

# Step 3: Build Docker images
log_step "Step 3: Building Docker images..."
docker-compose -f "$COMPOSE_FILE" build
log_info "✓ Images built"

# Step 4: Stop existing containers
log_step "Step 4: Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down
log_info "✓ Containers stopped"

# Step 5: Start new containers
log_step "Step 5: Starting new containers..."
docker-compose -f "$COMPOSE_FILE" up -d
log_info "✓ Containers started"

# Step 6: Wait for services to be healthy
log_step "Step 6: Waiting for services to be healthy..."
sleep 30

# Determine API URL
case "$ENVIRONMENT" in
    dev)
        API_URL="http://localhost:3000"
        ;;
    staging)
        API_URL="http://localhost:3000"
        ;;
    production)
        API_URL="http://localhost:3000"
        ;;
esac

# Check health
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health/ready" || echo "000")

if [ "$HEALTH_STATUS" -eq 200 ]; then
    log_info "✓ Services are healthy"
else
    log_error "Health check failed (HTTP ${HEALTH_STATUS})!"
    log_error "Check logs with: docker-compose -f ${COMPOSE_FILE} logs"

    # Offer to rollback
    if [ "$ENVIRONMENT" != "dev" ]; then
        read -p "Do you want to rollback? (yes/no): " rollback_choice
        if [ "$rollback_choice" = "yes" ]; then
            log_warn "Initiating rollback..."
            "${SCRIPT_DIR}/rollback.sh" "$ENVIRONMENT"
        fi
    fi
    exit 1
fi

# Step 7: Run smoke tests
log_step "Step 7: Running smoke tests..."
"${SCRIPT_DIR}/smoke-test.sh" "$ENVIRONMENT"
if [ $? -ne 0 ]; then
    log_warn "Smoke tests failed! Please investigate."

    # Offer to rollback
    if [ "$ENVIRONMENT" != "dev" ]; then
        read -p "Do you want to rollback? (yes/no): " rollback_choice
        if [ "$rollback_choice" = "yes" ]; then
            log_warn "Initiating rollback..."
            "${SCRIPT_DIR}/rollback.sh" "$ENVIRONMENT"
        fi
    fi
    exit 1
fi

log_info "✓ All smoke tests passed"

# Step 8: Display summary
log_info ""
log_info "=========================================="
log_info "Deployment to ${ENVIRONMENT} completed!"
log_info "=========================================="
log_info "Environment: ${ENVIRONMENT}"
log_info "API URL: ${API_URL}"
log_info "Health: ${API_URL}/health/ready"
log_info ""
log_info "Useful commands:"
log_info "  View logs:     docker-compose -f ${COMPOSE_FILE} logs -f"
log_info "  Stop services: docker-compose -f ${COMPOSE_FILE} down"
log_info "  Restart:       docker-compose -f ${COMPOSE_FILE} restart"
log_info "  Rollback:      ${SCRIPT_DIR}/rollback.sh ${ENVIRONMENT}"
log_info "=========================================="
