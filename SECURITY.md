# SocietyFlow Security Guide

Comprehensive security guidelines and best practices for SocietyFlow deployment.

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Network Security](#network-security)
4. [Data Security](#data-security)
5. [Container Security](#container-security)
6. [Application Security](#application-security)
7. [Monitoring and Auditing](#monitoring-and-auditing)
8. [Incident Response](#incident-response)
9. [Compliance](#compliance)
10. [Security Checklist](#security-checklist)

## Security Overview

### Security Principles

SocietyFlow follows these security principles:

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Minimal permissions required
3. **Fail Secure**: Secure by default, fail closed
4. **Separation of Duties**: Role-based access control
5. **Regular Auditing**: Continuous monitoring and logging

### Security Architecture

```
┌─────────────────────────────────────┐
│  Internet (Untrusted)               │
└──────────────┬──────────────────────┘
               │ Firewall (Ports 80,443)
               │
┌──────────────▼──────────────────────┐
│  Nginx (SSL Termination)            │
│  - TLS 1.2+                        │
│  - Rate Limiting                    │
│  - Security Headers                 │
└──────────────┬──────────────────────┘
               │ Internal Network
               │
┌──────────────▼──────────────────────┐
│  API (Non-root user)                │
│  - JWT Authentication               │
│  - Input Validation                 │
│  - CORS Restrictions                │
└──────────────┬──────────────────────┘
               │ Encrypted Connection
               │
┌──────────────▼──────────────────────┐
│  Database (Least Privilege User)    │
│  - Encrypted at Rest                │
│  - Connection Pooling               │
│  - Query Parameterization           │
└─────────────────────────────────────┘
```

## Authentication and Authorization

### JWT Configuration

**Current Implementation:**
- Access Token: 15 minutes expiry
- Refresh Token: 7 days expiry
- RS256 algorithm (asymmetric) recommended for production
- Secure token storage

**Best Practices:**

```typescript
// Strong secret generation
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

// Token validation
- Verify signature
- Check expiration
- Validate issuer and audience
- Check token revocation list
```

### Password Security

**Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Implementation:**
```typescript
// Password hashing with bcrypt
const hashedPassword = await bcrypt.hash(password, 12);

// Never store plain text passwords
// Never log passwords
// Use secure password reset flow
```

### Role-Based Access Control (RBAC)

**Roles:**
1. **MASTER_ADMIN**: Full system access
2. **SOCIETY_ADMIN**: Society-level access
3. **COMMITTEE_USER**: Limited society access
4. **RESIDENT**: View-only access

**Access Control:**
```typescript
// Middleware checks
- Authentication (valid JWT)
- Authorization (correct role)
- Resource ownership (societyId)
- Action permission (CRUD)
```

## Network Security

### Firewall Configuration

**Required Rules:**

```bash
# Allow HTTP (redirect to HTTPS)
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow SSH (restricted to specific IPs)
ufw allow from <your-ip> to any port 22

# Deny all other incoming
ufw default deny incoming

# Allow all outgoing
ufw default allow outgoing

# Enable firewall
ufw enable
```

### SSL/TLS Configuration

**Requirements:**
- TLS 1.2 minimum (TLS 1.3 preferred)
- Strong cipher suites only
- HTTP Strict Transport Security (HSTS)
- Certificate auto-renewal

**Nginx Configuration:**

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**SSL Certificate Checklist:**
- [ ] Valid SSL certificate installed
- [ ] Certificate covers all domains (www and non-www)
- [ ] Auto-renewal configured
- [ ] Certificate expiry monitoring
- [ ] Strong cipher suites
- [ ] OCSP stapling enabled

### CORS Configuration

**Principle: Whitelist Only**

```typescript
// Development
CORS_ORIGIN=http://localhost:3001,http://localhost:5500

// Staging
CORS_ORIGIN=https://staging.societyflow.com

// Production
CORS_ORIGIN=https://societyflow.com

// Never use: CORS_ORIGIN=*
```

### Rate Limiting

**Implemented Limits:**

```nginx
# Global API limit: 10 requests/second
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Auth endpoints: 5 requests/minute
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# Connection limit: 20 concurrent per IP
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

**Application-Level Rate Limiting:**

```typescript
// Express rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: 'Too many requests from this IP',
});

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
});
```

## Data Security

### Database Security

**PostgreSQL Hardening:**

```sql
-- Create application user with minimal privileges
CREATE USER societyflow_app WITH PASSWORD 'strong-password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE societyflow TO societyflow_app;
GRANT USAGE ON SCHEMA public TO societyflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO societyflow_app;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM societyflow_app;

-- Enable SSL connections
ALTER SYSTEM SET ssl = on;
```

**Connection Security:**

```env
# Use SSL connection
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Limit connections
max_connections = 100
```

### Encryption

**Data at Rest:**
- Database: PostgreSQL with encryption at rest
- Backups: Encrypted backup files
- Secrets: Encrypted environment variables

**Data in Transit:**
- HTTPS/TLS for all external connections
- Encrypted database connections
- Encrypted Redis connections (if needed)

**Sensitive Data Handling:**

```typescript
// Never log sensitive data
logger.info('User login', { userId, /* NOT password */ });

// Sanitize error messages
try {
  // operation
} catch (error) {
  // Don't expose stack traces to clients
  res.status(500).json({ message: 'Internal server error' });
  logger.error('Error details', error); // Log internally only
}

// Mask sensitive data in responses
const user = {
  id: user.id,
  email: maskEmail(user.email), // user@*****.com
  // Don't return: passwordHash, tokens, etc.
};
```

### Backup Security

**Backup Encryption:**

```bash
# Encrypt backups
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# Decrypt for restore
gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
```

**Backup Storage:**
- Store in secure location
- Separate from production system
- Access control (IAM policies)
- Encryption at rest
- Regular integrity checks

### Audit Logging

**What to Log:**
- Authentication attempts (success and failure)
- Authorization failures
- Data access (who accessed what, when)
- Data modifications (create, update, delete)
- Configuration changes
- Security events

**What NOT to Log:**
- Passwords (plain or hashed)
- JWT tokens
- Credit card numbers
- Personal identification numbers
- API keys or secrets

**Log Format:**

```json
{
  "timestamp": "2024-02-23T10:30:00Z",
  "level": "info",
  "action": "user_login",
  "userId": "uuid",
  "societyId": "uuid",
  "ipAddress": "1.2.3.4",
  "userAgent": "Mozilla...",
  "result": "success",
  "requestId": "uuid"
}
```

## Container Security

### Docker Security Best Practices

**Dockerfile Hardening:**

```dockerfile
# Use specific versions, not 'latest'
FROM node:20-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Use multi-stage builds
FROM node:20-alpine AS builder
# Build stage
FROM node:20-alpine AS runner
# Runtime stage (smaller, fewer vulnerabilities)

# Security scanning
# Use: docker scan image-name
```

**Container Runtime Security:**

```yaml
# docker-compose.yml
services:
  api:
    # Drop unnecessary capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

    # Read-only root filesystem
    read_only: true
    tmpfs:
      - /tmp

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

    # Security options
    security_opt:
      - no-new-privileges:true

    # Don't run as root
    user: nodejs
```

**Image Security:**

```bash
# Regular image updates
docker-compose pull

# Scan for vulnerabilities
docker scan societyflow-api:latest

# Use trusted base images
# - Official images from Docker Hub
# - Verified publishers
# - Minimal images (alpine)

# Remove unused images
docker image prune -a
```

### Secrets Management

**Never commit secrets to Git:**

```bash
# Use .gitignore
.env
.env.*
*.key
*.pem
secrets/
```

**Environment Variable Security:**

```bash
# Use separate secrets per environment
.env.dev      # Development secrets
.env.staging  # Staging secrets
.env.production  # Production secrets (never committed)

# Use secret management tools
# - Docker Secrets
# - Kubernetes Secrets
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
```

**Secret Rotation:**

```bash
# Rotate secrets regularly (quarterly minimum)
- JWT secrets
- Database passwords
- API keys
- SSL certificates
- SSH keys
```

## Application Security

### Input Validation

**Always validate and sanitize input:**

```typescript
import { z } from 'zod';

// Schema validation
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
});

// Validate before processing
const { email, password } = loginSchema.parse(req.body);
```

**SQL Injection Prevention:**

```typescript
// ✅ GOOD: Parameterized queries (Prisma does this automatically)
const users = await prisma.user.findMany({
  where: { email: userEmail }
});

// ❌ BAD: String concatenation
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

**XSS Prevention:**

```typescript
// Helmet middleware (already configured)
app.use(helmet());

// Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
  }
}));

// Sanitize user input before displaying
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirtyInput);
```

### Security Headers

**Required Headers (configured in Nginx):**

```nginx
# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
```

### Dependency Management

**Keep dependencies updated:**

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

**Regular Security Updates:**
- Review npm audit weekly
- Update critical security patches immediately
- Test thoroughly before deploying updates
- Monitor security advisories

## Monitoring and Auditing

### Security Monitoring

**What to Monitor:**

1. **Failed Authentication Attempts**
   - Multiple failures from same IP
   - Brute force patterns
   - Invalid tokens

2. **Unusual Access Patterns**
   - Access from new locations
   - Unusual time of day
   - Rapid API calls

3. **System Security**
   - Unauthorized access attempts
   - Configuration changes
   - File system modifications

4. **Application Security**
   - SQL injection attempts
   - XSS attempts
   - CSRF attempts

**Alerting Rules:**

```yaml
# Prometheus alerts
- alert: MultipleFailedLogins
  expr: rate(login_failed_total[5m]) > 5
  labels:
    severity: warning
  annotations:
    summary: "Multiple failed login attempts"

- alert: UnauthorizedAccessAttempt
  expr: rate(http_requests_total{status="401"}[5m]) > 10
  labels:
    severity: critical
  annotations:
    summary: "High rate of unauthorized access attempts"
```

### Log Management

**Secure Logging:**

```typescript
// Structured logging with security context
logger.info('API request', {
  requestId: req.id,
  userId: req.user?.id,
  societyId: req.params.societyId,
  method: req.method,
  path: req.path,
  ip: req.ip,
  userAgent: req.get('user-agent'),
  // Never log: passwords, tokens, credit cards
});
```

**Log Retention:**
- Application logs: 30 days
- Audit logs: 1 year (or per compliance requirements)
- Security logs: 1 year
- Access logs: 90 days

## Incident Response

### Security Incident Response Plan

**Phase 1: Detection and Analysis**
1. Identify the incident
2. Determine scope and severity
3. Document initial findings
4. Assemble response team

**Phase 2: Containment**
1. Isolate affected systems
2. Preserve evidence
3. Implement short-term containment
4. Implement long-term containment

**Phase 3: Eradication**
1. Remove malware/threat
2. Close vulnerabilities
3. Patch systems
4. Strengthen defenses

**Phase 4: Recovery**
1. Restore systems from clean backups
2. Verify system integrity
3. Monitor for reinfection
4. Return to normal operations

**Phase 5: Post-Incident**
1. Document incident fully
2. Create post-mortem report
3. Update security measures
4. Train team on lessons learned

### Security Breach Response

```bash
# 1. IMMEDIATE ACTIONS
# - Isolate affected systems
# - Change all passwords and secrets
# - Enable additional logging
# - Notify team

# 2. ASSESS DAMAGE
# - What was accessed?
# - What was modified?
# - Who was affected?

# 3. CONTAIN
# - Block malicious IPs
# - Revoke compromised credentials
# - Apply emergency patches

# 4. RECOVER
./scripts/restore-db.sh production <clean-backup>

# 5. INVESTIGATE
# - Review audit logs
# - Identify attack vector
# - Document timeline

# 6. NOTIFY
# - Affected users
# - Legal team
# - Regulatory bodies (if required)
```

## Compliance

### GDPR Compliance

- **Right to Access**: Users can request their data
- **Right to Erasure**: Users can request data deletion
- **Right to Portability**: Users can export their data
- **Data Minimization**: Only collect necessary data
- **Consent**: Explicit consent for data processing
- **Breach Notification**: 72-hour notification requirement

**Implementation:**
```typescript
// Data export
GET /api/v1/users/:id/export

// Data deletion
DELETE /api/v1/users/:id

// Consent management
POST /api/v1/users/:id/consent
```

### Data Retention

| Data Type | Retention Period | Purpose |
|-----------|-----------------|---------|
| User accounts | Active + 2 years | Business operations |
| Audit logs | 1 year | Security and compliance |
| Backups | 6 months | Disaster recovery |
| Application logs | 30 days | Debugging and monitoring |
| Transaction records | 7 years | Legal requirements |

## Security Checklist

### Pre-Deployment Security Checklist

- [ ] **Authentication**
  - [ ] Strong JWT secrets configured
  - [ ] Password requirements enforced
  - [ ] Multi-factor authentication available (future)

- [ ] **Network Security**
  - [ ] Firewall configured (ports 80, 443 only)
  - [ ] SSL certificate installed and valid
  - [ ] HTTPS enforced (HTTP redirects)
  - [ ] CORS properly configured
  - [ ] Rate limiting enabled

- [ ] **Database Security**
  - [ ] Strong database password
  - [ ] Database user has minimal privileges
  - [ ] SSL connection enforced
  - [ ] Regular backups configured
  - [ ] Backup encryption enabled

- [ ] **Application Security**
  - [ ] Input validation on all endpoints
  - [ ] Security headers configured
  - [ ] Error messages don't expose internals
  - [ ] Audit logging enabled
  - [ ] Dependencies up to date

- [ ] **Container Security**
  - [ ] Running as non-root user
  - [ ] Resource limits set
  - [ ] Images scanned for vulnerabilities
  - [ ] Unnecessary capabilities dropped

- [ ] **Secrets Management**
  - [ ] No secrets in code or Git
  - [ ] Environment variables properly set
  - [ ] Secrets rotation schedule defined

- [ ] **Monitoring**
  - [ ] Security monitoring enabled
  - [ ] Alerts configured
  - [ ] Log aggregation set up
  - [ ] Incident response plan documented

### Monthly Security Review

- [ ] Review access logs for anomalies
- [ ] Update dependencies and patch vulnerabilities
- [ ] Verify backup integrity
- [ ] Review and rotate secrets
- [ ] Check SSL certificate expiry
- [ ] Review security alerts and incidents
- [ ] Update security documentation
- [ ] Test incident response procedures

### Quarterly Security Audit

- [ ] Full security assessment
- [ ] Penetration testing
- [ ] Code security review
- [ ] Compliance review
- [ ] Update threat model
- [ ] Security training for team
- [ ] Review and update policies

## Security Contacts

- **Security Team**: security@societyflow.com
- **Vulnerability Reports**: security@societyflow.com
- **Emergency Contact**: [24/7 on-call]

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Version Information

- **Document Version**: 1.0
- **Last Updated**: 2024-02-23
- **Next Review**: 2024-05-23
- **Owner**: Security Team

---

**Remember**: Security is everyone's responsibility. When in doubt, ask!
