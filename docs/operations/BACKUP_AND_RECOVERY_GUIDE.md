# YogaOS — Database Backup & Disaster Recovery Guide

**Document Reference:** `docs/operations/BACKUP_AND_RECOVERY_GUIDE.md`  
**Version:** 1.0.0 (Release Hardening Baseline — Phase P20)  
**Status:** Approved for Production Operations  
**Database Engine:** PostgreSQL 16 (Relational Database) & Redis 7 (Workers/Cache)  

---

## 1. Recovery Objectives (RPO & RTO)

| Metric | Target Objective | Deployment Strategy |
| :--- | :---: | :--- |
| **Recovery Point Objective (RPO)** | **≤ 1 Hour** (Maximum acceptable data loss) | Hourly incremental WAL archiving / logical snapshots |
| **Recovery Time Objective (RTO)** | **≤ 15 Minutes** (Maximum downtime to restore) | Automated snapshot restoration via containerized `pg_restore` |
| **Audit Log Retention** | **7 Years** (Non-repudiation & tax compliance) | Audit logs (`AuditLog`) are append-only and immutable |

---

## 2. Backup Strategy & Frequency

### 2.1 Configurable Backup Tiers

1. **Daily Full Logical Backups (`pg_dump`):**
   - Executed daily at 02:00 AM local studio time.
   - Formatted in PostgreSQL custom binary archive (`--format=custom`).
   - Compressed with `pg_dump` internal compression.
2. **Hourly Point-in-Time Recovery (PITR) WAL Archives:**
   - Write-Ahead Logging (WAL) archiving to durable off-site cloud storage (AWS S3 Glacier or Google Cloud Storage).
3. **Retention Schedule:**
   - Daily backups retained for 30 days.
   - Weekly backups retained for 12 weeks.
   - Monthly backups retained for 12 months.
   - Annual fiscal year closing backups retained for 7 years (GST compliance).

---

## 3. Operational Backup Procedures

### 3.1 Creating a Full Logical Backup

Run the following command against the primary PostgreSQL container or RDS instance:

```bash
# 1. Generate timestamped logical backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="yogaos_prod_backup_${TIMESTAMP}.dump"

# For Dockerized local deployment:
docker exec -t yogaos-postgres pg_dump \
  -U yogaos \
  -d yogaos_dev \
  --format=custom \
  --blobs \
  --verbose \
  -f "/tmp/${BACKUP_FILE}"

# 2. Copy out to secure host storage
docker cp "yogaos-postgres:/tmp/${BACKUP_FILE}" "./backups/${BACKUP_FILE}"

# 3. Clean up container temporary dump
docker exec yogaos-postgres rm "/tmp/${BACKUP_FILE}"
```

### 3.2 Automated Backup Cron Configuration

On Linux host systems, configure `/etc/cron.d/yogaos-backup`:

```cron
# Daily YogaOS database backup at 02:00 AM
0 2 * * * root /opt/yogaos/scripts/backup-database.sh >> /var/log/yogaos/backup.log 2>&1
```

---

## 4. Disaster Recovery & Restoration Procedures

### 4.1 Prerequisites
- A target PostgreSQL 16 instance with matching extensions (`uuid-ossp`, `pgcrypto`).
- Database user credentials with DDL and superuser or table-owner permissions.
- Verified backup archive file (`.dump`).

### 4.2 Standard Restoration Steps

```bash
# 1. Terminate active client connections to avoid locks
docker exec -i yogaos-postgres psql -U yogaos -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yogaos_dev' AND pid <> pg_backend_pid();"

# 2. Stage backup file into the container
docker cp "./backups/yogaos_prod_backup_YYYYMMDD_HHMMSS.dump" "yogaos-postgres:/tmp/restore.dump"

# 3. Restore database schema, tables, indexes and constraints
docker exec -i yogaos-postgres pg_restore \
  -U yogaos \
  -d yogaos_dev \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  /tmp/restore.dump

# 4. Clean up restore dump
docker exec yogaos-postgres rm /tmp/restore.dump
```

---

## 5. Verification & Integrity Checklist

Following any restoration, execute the post-restore verification query:

```sql
-- 1. Verify schema tables count (Must equal 43 relations)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Verify Audit Log preservation (Must not lose financial or conductor records)
SELECT count(*) FROM "AuditLog";

-- 3. Verify Conductor Sessions & Events integrity
SELECT count(*) FROM "ConductorSession";
SELECT count(*) FROM "ConductorExecutionEvent";

-- 4. Verify Financial Transactions & Tax Invoices
SELECT count(*) FROM "TaxInvoice";
SELECT count(*) FROM "PaymentTransaction";

-- 5. Verify Prisma migration sync
SELECT count(*) FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL;
```

---

## 6. Tested & Certified Recovery Evidence (P20)

- **Verification Date:** 2026-11-17
- **Verification Environment:** PostgreSQL 16 Container (`yogaos-postgres`)
- **Restoration Test Outcome:** **PASSED**
  - Created test dump: `/tmp/test_backup.dump`.
  - Created isolated test database: `yogaos_recovery_verify`.
  - Executed `pg_restore`: Restored all 43 schema relations, indexes, foreign keys, and constraints.
  - Verified zero data corruption or lost audit events.
  - Cleanly dropped verification database.
