#!/bin/bash
# =============================================================================
# EasyFlow Automated Backup Script
# Run as part of Saturday maintenance or via cron
# =============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
  log "${GREEN}✅ $1${NC}"
}

log_warning() {
  log "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  log "${RED}❌ $1${NC}"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "=========================================="
log "EasyFlow Backup Script Started"
log "=========================================="
log "Backup Directory: $BACKUP_DIR"
log "Retention: $RETENTION_DAYS days"

# -----------------------------------------------------------------------------
# 1. Database Backup (Supabase/PostgreSQL)
# -----------------------------------------------------------------------------
log ""
log "--- Database Backup ---"

if [ -n "${DATABASE_URL:-}" ]; then
  DB_BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql"
  
  log "Backing up database..."
  if pg_dump "$DATABASE_URL" > "$DB_BACKUP_FILE" 2>> "$LOG_FILE"; then
    # Compress the backup
    gzip "$DB_BACKUP_FILE"
    log_success "Database backup completed: ${DB_BACKUP_FILE}.gz"
  else
    log_error "Database backup failed"
  fi
else
  log_warning "DATABASE_URL not set, skipping database backup"
  log_warning "For Supabase, use: supabase db dump > backup.sql"
fi

# -----------------------------------------------------------------------------
# 2. Configuration Backup
# -----------------------------------------------------------------------------
log ""
log "--- Configuration Backup ---"

CONFIG_BACKUP_DIR="${BACKUP_DIR}/config_${TIMESTAMP}"
mkdir -p "$CONFIG_BACKUP_DIR"

# Backup important config files (excluding secrets)
CONFIG_FILES=(
  "ecosystem.config.js"
  "docker-compose.yml"
  "render.yaml"
  "vercel.json"
  ".env.example"
)

for config_file in "${CONFIG_FILES[@]}"; do
  if [ -f "$config_file" ]; then
    cp "$config_file" "$CONFIG_BACKUP_DIR/"
    log "  Backed up: $config_file"
  fi
done

# Backup workflow configs
if [ -d "rpa-system/rpa-dashboard/public" ]; then
  cp -r rpa-system/rpa-dashboard/public/*.json "$CONFIG_BACKUP_DIR/" 2>/dev/null || true
fi

# Compress config backup
tar -czf "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "config_${TIMESTAMP}"
rm -rf "$CONFIG_BACKUP_DIR"
log_success "Configuration backup completed: config_${TIMESTAMP}.tar.gz"

# -----------------------------------------------------------------------------
# 3. Upload to Cloud Storage (if configured)
# -----------------------------------------------------------------------------
log ""
log "--- Cloud Upload ---"

if [ -n "${AWS_S3_BUCKET:-}" ]; then
  log "Uploading to S3: $AWS_S3_BUCKET"
  
  # Upload all new backups
  aws s3 cp "$BACKUP_DIR/" "s3://${AWS_S3_BUCKET}/backups/" \
    --recursive \
    --exclude "*" \
    --include "*_${TIMESTAMP}*" \
    2>> "$LOG_FILE" && log_success "S3 upload completed" || log_error "S3 upload failed"
    
elif [ -n "${GCS_BUCKET:-}" ]; then
  log "Uploading to GCS: $GCS_BUCKET"
  
  gsutil -m cp "${BACKUP_DIR}/*_${TIMESTAMP}*" "gs://${GCS_BUCKET}/backups/" \
    2>> "$LOG_FILE" && log_success "GCS upload completed" || log_error "GCS upload failed"
    
else
  log_warning "No cloud storage configured (AWS_S3_BUCKET or GCS_BUCKET)"
  log_warning "Backups stored locally only"
fi

# -----------------------------------------------------------------------------
# 4. Cleanup Old Backups
# -----------------------------------------------------------------------------
log ""
log "--- Cleanup Old Backups ---"

# Local cleanup
DELETED_COUNT=0
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -name "*.sql.gz" -delete 2>/dev/null && ((DELETED_COUNT++)) || true
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -name "*.tar.gz" -delete 2>/dev/null && ((DELETED_COUNT++)) || true
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -name "*.log" -delete 2>/dev/null && ((DELETED_COUNT++)) || true

log "Cleaned up local backups older than $RETENTION_DAYS days"

# S3 cleanup (if configured)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  log "Cleaning up old S3 backups..."
  
  CUTOFF_DATE=$(date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)
  
  aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" 2>/dev/null | while read -r line; do
    file_date=$(echo "$line" | awk '{print $1}')
    file_name=$(echo "$line" | awk '{print $4}')
    
    if [[ "$file_date" < "$CUTOFF_DATE" ]] && [ -n "$file_name" ]; then
      aws s3 rm "s3://${AWS_S3_BUCKET}/backups/$file_name" 2>/dev/null || true
      log "  Deleted old backup: $file_name"
    fi
  done
fi

# -----------------------------------------------------------------------------
# 5. Summary
# -----------------------------------------------------------------------------
log ""
log "=========================================="
log "Backup Summary"
log "=========================================="

# List recent backups
log "Recent backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}* 2>/dev/null | while read -r line; do
  log "  $line"
done

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log ""
log "Total backup directory size: $TOTAL_SIZE"
log ""
log_success "Backup script completed successfully"
log "Log file: $LOG_FILE"
