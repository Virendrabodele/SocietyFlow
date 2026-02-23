# SocietyFlow Operations Runbook

Operational procedures and incident response for SocietyFlow production system.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Daily Operations](#daily-operations)
3. [Deployment Procedures](#deployment-procedures)
4. [Backup and Restore](#backup-and-restore)
5. [Incident Response](#incident-response)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Emergency Procedures](#emergency-procedures)

## Quick Reference

### Essential Commands

```bash
# Health check
curl https://societyflow.com/health/ready

# View logs
docker-compose -f backend/docker-compose.prod.yml logs -f api

# Restart services
docker-compose -f backend/docker-compose.prod.yml restart

# Backup database
./scripts/backup-db.sh production full

# Rollback deployment
./scripts/rollback.sh production

# Run smoke tests
./scripts/smoke-test.sh production
```

### Key URLs

- **Production API**: https://societyflow.com/api/v1
- **Frontend**: https://societyflow.com
- **Health Check**: https://societyflow.com/health/ready
- **Monitoring**: https://monitoring.societyflow.com
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

### Contact Information

- **On-Call Engineer**: [Your contact]
- **DevOps Team**: [Team email]
- **Emergency Escalation**: [Escalation path]

## Daily Operations

### Morning Checks (Start of Day)

```bash
# 1. Check system health
curl -f https://societyflow.com/health/ready

# 2. Check service status
docker ps | grep societyflow

# 3. Review overnight logs
docker-compose -f backend/docker-compose.prod.yml logs --since 24h | grep -i error

# 4. Check disk space
df -h

# 5. Review monitoring dashboards
# Open Grafana and check:
# - API response times
# - Error rates
# - Resource usage
```

### Evening Checks (End of Day)

```bash
# 1. Verify backups completed
ls -lh backups/production/ | tail -5

# 2. Review alert history
# Check Grafana alerts

# 3. Check for pending updates
git fetch
git status

# 4. Document any issues
# Update team log
```

## Deployment Procedures

### Standard Deployment (Staging)

```bash
# 1. Verify staging is healthy
./scripts/smoke-test.sh staging

# 2. Create backup
./scripts/backup-db.sh staging full

# 3. Deploy
./scripts/deploy.sh staging

# 4. Verify deployment
./scripts/smoke-test.sh staging

# 5. Test key workflows
# - User login
# - Society creation
# - Invoice generation
```

### Production Deployment

```bash
# 1. Announce maintenance window (if needed)
# Post to team channel: "Deploying to production at HH:MM"

# 2. Create full backup
./scripts/backup-db.sh production full

# 3. Deploy with monitoring
./scripts/deploy.sh production

# 4. Monitor deployment
watch -n 2 'docker ps | grep societyflow'

# 5. Run smoke tests
./scripts/smoke-test.sh production

# 6. Monitor for 15 minutes
# Watch Grafana dashboards
# Check error logs

# 7. Announce completion
# Post to team channel: "Production deployment complete"
```

### Rollback Procedure

```bash
# 1. Assess the situation
docker-compose logs api | tail -100

# 2. Initiate rollback
./scripts/rollback.sh production

# 3. Verify rollback
curl -f https://societyflow.com/health/ready
./scripts/smoke-test.sh production

# 4. Notify team
# Post incident report

# 5. Investigate root cause
# Review logs and create post-mortem
```

## Backup and Restore

### Creating Backups

```bash
# Full backup (recommended)
./scripts/backup-db.sh production full

# Schema only
./scripts/backup-db.sh production schema

# Data only
./scripts/backup-db.sh production data

# Verify backup
ls -lh backups/production/
gunzip -t backups/production/backup_production_full_*.sql.gz
```

### Restoring from Backup

```bash
# ⚠️ WARNING: This will overwrite production data!

# 1. Create current backup first
./scripts/backup-db.sh production full

# 2. Announce maintenance
# Post: "Database restore in progress - system will be unavailable"

# 3. Stop API to prevent writes
docker-compose -f backend/docker-compose.prod.yml stop api

# 4. Restore database
./scripts/restore-db.sh production latest
# Or restore specific backup:
./scripts/restore-db.sh production /path/to/backup.sql.gz

# 5. Restart API
docker-compose -f backend/docker-compose.prod.yml start api

# 6. Verify restore
./scripts/smoke-test.sh production

# 7. Announce completion
```

### Backup Verification (Weekly)

```bash
# 1. List recent backups
ls -lh backups/production/ | tail -10

# 2. Test restore on staging
./scripts/restore-db.sh staging latest

# 3. Verify staging after restore
./scripts/smoke-test.sh staging

# 4. Document verification
echo "Backup verified: $(date)" >> backups/verification.log
```

## Incident Response

### API Down

```bash
# 1. Verify the issue
curl -I https://societyflow.com/health/ready

# 2. Check container status
docker ps | grep societyflow-api

# 3. Check logs
docker-compose logs --tail 100 api

# 4. If container is down, restart
docker-compose -f backend/docker-compose.prod.yml up -d api

# 5. If still down, check dependencies
docker-compose -f backend/docker-compose.prod.yml ps
# Verify postgres and redis are running

# 6. If persistent, rollback
./scripts/rollback.sh production

# 7. Create incident report
```

### Database Connection Failures

```bash
# 1. Check database status
docker exec -it societyflow-db-prod pg_isready

# 2. Check connections
docker exec -it societyflow-db-prod psql -U societyflow -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Check for blocking queries
docker exec -it societyflow-db-prod psql -U societyflow -c "
SELECT pid, age(clock_timestamp(), query_start), usename, query
FROM pg_stat_activity
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY query_start desc;
"

# 4. If too many connections, restart API
docker-compose -f backend/docker-compose.prod.yml restart api

# 5. If database is stuck, restart (last resort)
docker-compose -f backend/docker-compose.prod.yml restart postgres
```

### High Response Times

```bash
# 1. Check system resources
docker stats --no-stream

# 2. Check API logs for slow queries
docker-compose logs api | grep -i "slow"

# 3. Check database connections
docker exec -it societyflow-db-prod psql -U societyflow -c "
SELECT count(*) as connections, state
FROM pg_stat_activity
GROUP BY state;
"

# 4. Check for long-running queries
docker exec -it societyflow-db-prod psql -U societyflow -c "
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '1 minute';
"

# 5. If needed, scale up resources or optimize queries
```

### Disk Space Issues

```bash
# 1. Check disk usage
df -h

# 2. Find large directories
du -sh /var/lib/docker/* | sort -h | tail -10

# 3. Clean up old Docker images
docker system prune -a --volumes -f

# 4. Clean up old logs
docker-compose logs > /tmp/logs-$(date +%Y%m%d).txt
truncate -s 0 $(docker inspect --format='{{.LogPath}}' societyflow-api-prod)

# 5. Clean up old backups (keep last 14 days)
find backups/production -name "*.sql.gz" -mtime +14 -delete

# 6. If still critical, expand disk or move data
```

## Monitoring and Alerts

### Alert Responses

#### Critical: API Down
```bash
1. Acknowledge alert
2. Check health: curl https://societyflow.com/health/ready
3. Check containers: docker ps
4. Check logs: docker-compose logs api --tail 100
5. Restart if needed: docker-compose restart api
6. If persists: Execute rollback procedure
7. Escalate if not resolved in 5 minutes
```

#### Warning: High Error Rate
```bash
1. Check error logs: docker-compose logs api | grep -i error | tail -50
2. Identify error pattern
3. Check if related to recent deployment
4. Monitor error rate trend
5. If increasing, prepare for rollback
6. Investigate root cause
7. Create bug ticket
```

#### Warning: High Memory Usage
```bash
1. Check resource usage: docker stats
2. Check memory per container
3. If API container: Restart to clear memory
4. If database: Check for slow queries
5. Monitor for memory leaks
6. Scale resources if needed
```

#### Critical: Disk Space Low
```bash
1. Immediately clean up logs and old images
2. docker system prune -f
3. Clean old backups: find backups/ -mtime +30 -delete
4. Expand disk if needed
5. Set up automatic cleanup
```

### Custom Alerts Setup

Add alerts in Prometheus (`monitoring/prometheus/alerts.yml`) and configure notification channels in Grafana.

## Maintenance Tasks

### Daily
- [ ] Check system health
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Verify backup completed

### Weekly
- [ ] Review monitoring dashboards
- [ ] Test backup restore on staging
- [ ] Review and rotate logs
- [ ] Check for security updates
- [ ] Review incident reports

### Monthly
- [ ] Full disaster recovery drill
- [ ] Review and update documentation
- [ ] Audit access logs
- [ ] Review and optimize database
- [ ] Check SSL certificate expiry
- [ ] Update dependencies
- [ ] Performance review

### Quarterly
- [ ] Security audit
- [ ] Capacity planning review
- [ ] Update disaster recovery plan
- [ ] Team training on procedures
- [ ] Review and test all runbook procedures

## Emergency Procedures

### Complete System Failure

```bash
# 1. Assess the situation
# - What systems are down?
# - What was the last known working state?
# - When did it fail?

# 2. Communicate
# - Post to status page
# - Notify team
# - Start incident log

# 3. Attempt quick recovery
docker-compose -f backend/docker-compose.prod.yml restart

# 4. If restart fails, restore from backup
./scripts/restore-db.sh production latest
./scripts/rollback.sh production

# 5. If still failing, rebuild from scratch
# - Use last known good configuration
# - Restore database from backup
# - Deploy services one by one

# 6. Document everything
# - Timeline of events
# - Actions taken
# - Resolution

# 7. Post-incident review
# - Create post-mortem
# - Identify improvements
# - Update runbook
```

### Data Loss or Corruption

```bash
# 1. STOP ALL WRITES IMMEDIATELY
docker-compose -f backend/docker-compose.prod.yml stop api

# 2. Assess extent of damage
# - What data is affected?
# - When did corruption occur?
# - What is recoverable?

# 3. Restore from last good backup
./scripts/restore-db.sh production <timestamp-before-corruption>

# 4. Verify data integrity
# - Run consistency checks
# - Verify with sample queries
# - Test critical workflows

# 5. Restart services
docker-compose -f backend/docker-compose.prod.yml up -d

# 6. Monitor closely

# 7. Incident report and prevention measures
```

### Security Breach

```bash
# 1. ISOLATE IMMEDIATELY
# - Disable external access if needed
# - Stop affected services

# 2. Assess breach
# - What was compromised?
# - How did it happen?
# - What data was accessed?

# 3. Rotate all secrets
# - Database passwords
# - JWT secrets
# - API keys
# - SSH keys

# 4. Review access logs
docker-compose logs api | grep "suspicious-pattern"

# 5. Patch vulnerability

# 6. Restore from clean backup if needed

# 7. Legal and compliance notification

# 8. Post-incident security audit
```

## Secrets Rotation

### JWT Secrets

```bash
# 1. Generate new secrets
NEW_ACCESS_SECRET=$(openssl rand -base64 32)
NEW_REFRESH_SECRET=$(openssl rand -base64 32)

# 2. Update environment file
# Edit backend/.env

# 3. Restart API with rolling update
docker-compose -f backend/docker-compose.prod.yml up -d --no-deps api

# 4. Notify users of re-authentication requirement

# 5. Document rotation
echo "JWT secrets rotated: $(date)" >> security/rotation.log
```

### Database Password

```bash
# 1. Generate new password
NEW_DB_PASSWORD=$(openssl rand -base64 24)

# 2. Update database
docker exec -it societyflow-db-prod psql -U postgres -c "
ALTER USER societyflow WITH PASSWORD '${NEW_DB_PASSWORD}';
"

# 3. Update DATABASE_URL in .env

# 4. Restart API
docker-compose -f backend/docker-compose.prod.yml restart api

# 5. Verify connectivity
curl https://societyflow.com/health/ready
```

## SSL Certificate Renewal

```bash
# Automatic (runs via certbot container)
# - Checks twice daily
# - Auto-renews when < 30 days remaining

# Manual renewal
docker exec societyflow-certbot certbot renew

# Force renewal (testing)
docker exec societyflow-certbot certbot renew --force-renewal

# Reload nginx after renewal
docker exec societyflow-nginx nginx -s reload

# Check certificate expiry
docker exec societyflow-certbot certbot certificates
```

## Performance Tuning

### Database Optimization

```bash
# Analyze query performance
docker exec -it societyflow-db-prod psql -U societyflow -c "
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Vacuum database
docker exec -it societyflow-db-prod psql -U societyflow -c "VACUUM ANALYZE;"

# Rebuild indexes
docker exec -it societyflow-db-prod psql -U societyflow -c "REINDEX DATABASE societyflow;"
```

### Container Resource Limits

Edit docker-compose files to set limits:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          memory: 2G
```

## Documentation Updates

This runbook should be updated:
- After every incident
- When procedures change
- Monthly review
- After major deployments

**Last Updated**: 2024-02-23
**Version**: 1.0
**Owner**: DevOps Team
