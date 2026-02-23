#!/bin/bash

# ============================================
# SSL Certificate Setup Script
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage
usage() {
    echo "Usage: $0 <domain> <email>"
    echo ""
    echo "Example: $0 societyflow.com admin@societyflow.com"
    exit 1
}

if [ $# -lt 2 ]; then
    usage
fi

DOMAIN=$1
EMAIL=$2

log_info "Setting up SSL certificate for ${DOMAIN}"

# Check if certbot is running
if ! docker ps | grep -q societyflow-certbot; then
    log_error "Certbot container is not running. Please start nginx stack first."
    exit 1
fi

# Obtain certificate
log_info "Obtaining SSL certificate..."
docker exec societyflow-certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -eq 0 ]; then
    log_info "✓ SSL certificate obtained successfully"
    log_info "Reloading nginx..."
    docker exec societyflow-nginx nginx -s reload
    log_info "✓ Certificate setup complete"
else
    log_error "Failed to obtain SSL certificate"
    exit 1
fi
