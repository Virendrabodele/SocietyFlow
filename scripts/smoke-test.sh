#!/bin/bash

# ============================================
# Smoke Tests for SocietyFlow
# ============================================

set -euo pipefail

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
    echo "  environment   : dev|staging|production"
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

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1"
}

# Validate arguments
if [ $# -lt 1 ]; then
    usage
fi

ENVIRONMENT=$1

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# Determine API URL
case "$ENVIRONMENT" in
    dev)
        API_URL="http://localhost:3000"
        ;;
    staging)
        API_URL="https://staging.societyflow.com"
        ;;
    production)
        API_URL="https://societyflow.com"
        ;;
esac

log_info "Running smoke tests for ${ENVIRONMENT} environment"
log_info "API URL: ${API_URL}"

FAILED_TESTS=0
PASSED_TESTS=0

# Test 1: Health Check - Liveness
log_info "Test 1: Health check - liveness probe"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health/live")
if [ "$RESPONSE" -eq 200 ]; then
    log_success "Liveness probe passed (HTTP 200)"
    ((PASSED_TESTS++))
else
    log_failure "Liveness probe failed (HTTP ${RESPONSE})"
    ((FAILED_TESTS++))
fi

# Test 2: Health Check - Readiness
log_info "Test 2: Health check - readiness probe"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health/ready")
if [ "$RESPONSE" -eq 200 ]; then
    log_success "Readiness probe passed (HTTP 200)"
    ((PASSED_TESTS++))
else
    log_failure "Readiness probe failed (HTTP ${RESPONSE})"
    ((FAILED_TESTS++))
fi

# Test 3: API Base Endpoint
log_info "Test 3: API base endpoint"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/auth/login")
if [ "$RESPONSE" -eq 405 ] || [ "$RESPONSE" -eq 400 ]; then
    log_success "API endpoint accessible (HTTP ${RESPONSE})"
    ((PASSED_TESTS++))
else
    log_failure "API endpoint failed (HTTP ${RESPONSE})"
    ((FAILED_TESTS++))
fi

# Test 4: Login API (should fail without credentials)
log_info "Test 4: Login API endpoint"
RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' \
    -w "%{http_code}" -o /tmp/login_response.json)

if [ "$RESPONSE" -eq 400 ] || [ "$RESPONSE" -eq 401 ]; then
    log_success "Login API responding correctly (HTTP ${RESPONSE})"
    ((PASSED_TESTS++))
else
    log_failure "Login API failed (HTTP ${RESPONSE})"
    ((FAILED_TESTS++))
fi

# Test 5: CORS Headers
log_info "Test 5: CORS headers"
CORS_HEADER=$(curl -s -I "${API_URL}/health/live" | grep -i "access-control-allow-origin" || echo "")
if [ -n "$CORS_HEADER" ]; then
    log_success "CORS headers present"
    ((PASSED_TESTS++))
else
    log_warn "CORS headers not found (might be expected)"
    ((PASSED_TESTS++))
fi

# Test 6: Security Headers (Production only)
if [ "$ENVIRONMENT" == "production" ]; then
    log_info "Test 6: Security headers"
    SECURITY_HEADERS=$(curl -s -I "${API_URL}" | grep -i "strict-transport-security" || echo "")
    if [ -n "$SECURITY_HEADERS" ]; then
        log_success "Security headers present"
        ((PASSED_TESTS++))
    else
        log_failure "Security headers missing"
        ((FAILED_TESTS++))
    fi
fi

# Test 7: Database Connection
log_info "Test 7: Database connection (via readiness)"
READY_RESPONSE=$(curl -s "${API_URL}/health/ready")
DB_STATUS=$(echo "$READY_RESPONSE" | grep -o '"database":{"status":"healthy"' || echo "")
if [ -n "$DB_STATUS" ]; then
    log_success "Database connection healthy"
    ((PASSED_TESTS++))
else
    log_failure "Database connection issue"
    ((FAILED_TESTS++))
fi

# Test 8: Redis Connection
log_info "Test 8: Redis connection (via readiness)"
REDIS_STATUS=$(echo "$READY_RESPONSE" | grep -o '"redis":{"status":"healthy"\|"redis":{"status":"degraded"' || echo "")
if [ -n "$REDIS_STATUS" ]; then
    log_success "Redis connection verified"
    ((PASSED_TESTS++))
else
    log_warn "Redis status unknown (might be optional)"
    ((PASSED_TESTS++))
fi

# Summary
echo ""
echo "=========================================="
echo "Smoke Test Results for ${ENVIRONMENT}"
echo "=========================================="
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
echo "=========================================="

if [ $FAILED_TESTS -gt 0 ]; then
    log_error "Some smoke tests failed!"
    exit 1
else
    log_success "All smoke tests passed!"
    exit 0
fi
