# SocietyFlow Deployment Guide

Complete deployment guide for SocietyFlow (Frontend + Backend + Database + Monitoring).

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Initial Deployment](#initial-deployment)
6. [Updating Deployments](#updating-deployments)
7. [Environment-Specific Instructions](#environment-specific-instructions)
8. [Troubleshooting](#troubleshooting)

## Overview

SocietyFlow uses a containerized deployment strategy with:
- **Frontend**: Static HTML/JS served via Nginx
- **Backend API**: Node.js/Express/TypeScript application
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Reverse Proxy**: Nginx with SSL
- **Monitoring**: Prometheus + Grafana + Loki

## Architecture

```
┌─────────────┐
│   Internet  │
└──────┬──────┘
       │
┌──────▼──────────┐
│  Nginx (HTTPS)  │ ← SSL Termination, Reverse Proxy
└──────┬──────────┘
       │
       ├──────────────┐
       │              │
┌──────▼─────┐  ┌────▼────────┐
│  Frontend  │  │  Backend API│
│  (Static)  │  │  (Node.js)  │
└────────────┘  └────┬────────┘
                     │
                ┌────┼─────┐
                │    │     │
         ┌──────▼┐  │  ┌──▼───────┐
         │Postgre│  │  │  Redis   │
         │  SQL  │  │  │          │
         └───────┘  │  └──────────┘
                    │
              ┌─────▼──────┐
              │ Monitoring │
              │  Stack     │
              └────────────┘
```

## Prerequisites

### Required Software
- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **Git**: >= 2.30
- **Bash**: >= 4.0

### Server Requirements

#### Development
- 2 CPU cores
- 4 GB RAM
- 20 GB storage

#### Staging
- 2 CPU cores
- 8 GB RAM
- 50 GB storage

#### Production
- 4 CPU cores
- 16 GB RAM
- 100 GB storage (+ backup storage)

### Network Requirements
- Ports 80 and 443 for HTTP/HTTPS
- Outbound access for package installation
- Domain name with DNS configured

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/Virendrabodele/SocietyFlow.git
cd SocietyFlow
```

### 2. Create Environment Files

Copy the appropriate environment template:

```bash
# For Development
cp backend/.env.dev backend/.env

# For Staging
cp backend/.env.staging backend/.env

# For Production
cp backend/.env.production backend/.env
```

### 3. Configure Environment Variables

Edit `backend/.env` and set the following **REQUIRED** variables:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=<your-secret-here>
JWT_REFRESH_SECRET=<your-secret-here>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<your-redis-password>

# CORS
CORS_ORIGIN=https://yourdomain.com

# Email (Optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# SMS (Optional)
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=<your-number>
```

### 4. Generate Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32  # For JWT_ACCESS_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET

# Generate Redis password
openssl rand -base64 24
```

## Initial Deployment

### Development Environment

```bash
# Start all services
cd backend
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Access the application
# Frontend: http://localhost:5500 (or open app/index.html)
# API: http://localhost:3000
# Health: http://localhost:3000/health/ready
```

### Staging/Production Environment

#### Option 1: One-Click Deployment (Recommended)

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires manual approval)
./scripts/deploy.sh production
```

#### Option 2: Manual Deployment

```bash
# 1. Backup database
./scripts/backup-db.sh production full

# 2. Pull latest code
git pull origin main

# 3. Build and deploy
cd backend
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 4. Wait for health check
sleep 30
curl http://localhost:3000/health/ready

# 5. Run smoke tests
../scripts/smoke-test.sh production
```

### Setting Up SSL

```bash
# 1. Update nginx/societyflow.conf with your domain

# 2. Start nginx stack
docker-compose -f nginx/docker-compose.nginx.yml up -d

# 3. Obtain SSL certificate
./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

### Setting Up Monitoring

```bash
# Start monitoring stack
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Access services
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## Updating Deployments

### Rolling Update (Zero Downtime)

```bash
# Using deployment script
./scripts/deploy.sh production

# Or manually
cd backend
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api
```

### Rollback

```bash
# Automatic rollback to previous version
./scripts/rollback.sh production

# Manual rollback to specific version
docker tag societyflow-api:previous societyflow-api:rollback
docker-compose -f backend/docker-compose.prod.yml up -d --no-deps api
```

## Environment-Specific Instructions

### Development

- Uses local PostgreSQL and Redis via Docker
- Hot reload enabled with nodemon
- Detailed logging (debug level)
- CORS allows all origins
- No SSL required

**Start Command:**
```bash
cd backend
docker-compose up -d
npm run dev
```

### Staging

- Mirrors production configuration
- Separate database and secrets
- SSL certificate from Let's Encrypt
- Deployed automatically on merge to main
- Used for QA testing

**Deploy Command:**
```bash
./scripts/deploy.sh staging
```

### Production

- Strict security settings
- Automated backups
- Monitoring and alerts enabled
- Requires manual approval for deployment
- Health checks and smoke tests enforced

**Deploy Command:**
```bash
./scripts/deploy.sh production
```

## Database Migrations

### Running Migrations

Migrations run automatically on deployment, but you can run them manually:

```bash
# Inside the API container
docker exec -it societyflow-api-prod npx prisma migrate deploy

# Or from host
cd backend
npx prisma migrate deploy
```

### Creating New Migrations

```bash
cd backend
npx prisma migrate dev --name describe_your_change
```

### Checking Migration Status

```bash
cd backend
npx prisma migrate status
```

## Monitoring and Logs

### View Container Logs

```bash
# API logs
docker-compose -f backend/docker-compose.prod.yml logs -f api

# Database logs
docker-compose -f backend/docker-compose.prod.yml logs -f postgres

# All services
docker-compose -f backend/docker-compose.prod.yml logs -f
```

### Access Monitoring

- **Grafana**: http://monitoring.yourdomain.com (default: admin/admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100

### Health Checks

```bash
# Liveness (is app running?)
curl http://localhost:3000/health/live

# Readiness (is app ready to serve traffic?)
curl http://localhost:3000/health/ready
```

## Backup and Restore

### Create Backup

```bash
# Full backup
./scripts/backup-db.sh production full

# Schema only
./scripts/backup-db.sh production schema

# Data only
./scripts/backup-db.sh production data
```

### Restore Backup

```bash
# Restore latest backup
./scripts/restore-db.sh production latest

# Restore specific backup
./scripts/restore-db.sh production /path/to/backup.sql.gz
```

### Automated Backups

Backups are configured to run:
- **Daily**: Full backup at 2 AM (retained for 14 days)
- **Weekly**: Full backup on Sunday (retained for 8 weeks)
- **Monthly**: Full backup on 1st (retained for 6 months)

## Troubleshooting

### Service Won't Start

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api

# Check health
curl http://localhost:3000/health/ready
```

### Database Connection Issues

```bash
# Test database connection
docker exec -it societyflow-db-prod psql -U societyflow -d societyflow -c "SELECT 1"

# Check DATABASE_URL
docker exec -it societyflow-api-prod env | grep DATABASE_URL
```

### SSL Certificate Issues

```bash
# Check certificate expiry
docker exec societyflow-certbot certbot certificates

# Renew certificate
docker exec societyflow-certbot certbot renew

# Reload nginx
docker exec societyflow-nginx nginx -s reload
```

### High Memory Usage

```bash
# Check container resource usage
docker stats

# Restart specific service
docker-compose -f backend/docker-compose.prod.yml restart api
```

### Failed Deployment

```bash
# Check logs
docker-compose logs api

# Rollback to previous version
./scripts/rollback.sh production

# Restore database backup
./scripts/restore-db.sh production latest
```

## CI/CD Pipeline

Deployments are automated via GitHub Actions:

1. **On Pull Request**: Lint, test, and build
2. **On Merge to Main**: Build Docker image, deploy to staging
3. **Manual Trigger**: Deploy to production (requires approval)

### GitHub Secrets Required

```
STAGING_HOST=staging.example.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private-key>

PRODUCTION_HOST=production.example.com
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<private-key>

GITHUB_TOKEN=<auto-provided>
```

## Performance Optimization

### Connection Pooling

Database connections are pooled automatically by Prisma. Configure in `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  pool_timeout = 60
  connection_limit = 10
}
```

### Caching

Redis is configured for caching and job queues. Use it in your application:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
});
```

### CDN Integration

For production, consider using a CDN for frontend static assets:
- CloudFlare
- AWS CloudFront
- Fastly

## Security Checklist

- [ ] All environment variables set with strong secrets
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Database password changed from default
- [ ] Redis password set
- [ ] Firewall configured (only ports 80, 443 exposed)
- [ ] Regular backups running and tested
- [ ] Monitoring and alerts configured
- [ ] Security headers enabled in Nginx
- [ ] CORS restricted to allowed origins only
- [ ] Rate limiting enabled
- [ ] Non-root user running containers
- [ ] Audit logging enabled

## Support and Documentation

- **Runbook**: See `RUNBOOK.md` for operational procedures
- **Security**: See `SECURITY.md` for security guidelines
- **API Documentation**: See `backend/README.md`
- **Architecture**: See `documentation/VISUAL_GUIDE.md`

## Version Information

- **Infrastructure Version**: 1.0
- **Last Updated**: 2024-02-23
- **Minimum Docker Version**: 20.10
- **Minimum Docker Compose Version**: 2.0
