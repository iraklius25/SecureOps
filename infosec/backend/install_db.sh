#!/usr/bin/env bash
# SecureOps — Database schema installer
# Run this once on a fresh install to create all tables.
# Safe to re-run on an existing database (all statements are idempotent).
#
# Usage:
#   bash install_db.sh
# Or with explicit credentials:
#   PGUSER=infosec_user PGDATABASE=infosec_db PGHOST=localhost bash install_db.sh

set -e

PGUSER="${PGUSER:-infosec_user}"
PGDATABASE="${PGDATABASE:-infosec_db}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

PSQL="psql -U $PGUSER -d $PGDATABASE -h $PGHOST -p $PGPORT"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== SecureOps DB installer ==="
echo "    Host:     $PGHOST:$PGPORT"
echo "    Database: $PGDATABASE"
echo "    User:     $PGUSER"
echo ""

run() {
  local file="$DIR/$1"
  if [ ! -f "$file" ]; then
    echo "  [SKIP] $1 (file not found)"
    return
  fi
  echo "  [APPLY] $1"
  $PSQL -f "$file" > /dev/null 2>&1 || $PSQL -f "$file" 2>&1 | grep "^psql:.*ERROR" | grep -v "already exists" || true
}

# ── Core schema (must be first) ──────────────────────────────────
run schema.sql

# ── Feature migrations (order matters — do not reorder) ──────────
run schema_v2.sql
run schema_platform_v2.sql
run schema_features_v3.sql
run schema_v3_fix.sql
run schema_fix.sql
run schema_audit_log.sql
run schema_force_password.sql
run schema_ldap.sql
run schema_cve_cache.sql
run schema_gap_assessment.sql
run schema_gap_framework.sql
run schema_assets_iso27001.sql
run schema_assets_ip_nullable.sql
run schema_maturity.sql
run schema_grc.sql
run schema_governance.sql
run schema_raci.sql
run schema_risk_history.sql
run schema_risk_notes.sql
run schema_suppliers.sql
run schema_ai_systems.sql
run schema_certifications.sql        # creates cert_organizations
run schema_maturity_org.sql          # depends on cert_organizations
run schema_metrics.sql
run schema_issc_member_ids.sql

echo ""
echo "=== Done. Verifying table count... ==="
TABLE_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d ' ')
echo "    Tables in database: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 30 ] 2>/dev/null; then
  echo "    WARNING: expected 30+ tables. Some schema files may have failed."
  echo "    Run: psql -U $PGUSER -d $PGDATABASE -h $PGHOST -c '\dt'"
else
  echo "    OK — schema is complete."
fi
echo ""
