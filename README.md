# SecureOps — InfoSec Risk Management Platform

A self-hosted network security platform for asset discovery, vulnerability management, risk quantification, and compliance tracking.

## Features

- **Network Scanning** — nmap-powered asset discovery with service/OS detection
- **Vulnerability Management** — automatic CVE detection, CVSS scoring, SLA tracking
- **Risk Register** — NIST-based ALE/ARO/SLE risk quantification
- **Patch Tracker** — track patch status across assets with coverage reporting
- **Compliance** — NIST CSF 2.0 + ISO 27001:2022 control mapping with evidence upload
- **Threat Intelligence** — external threat feed integration
- **Executive Dashboards** — risk scores, trends, and exportable reports
- **Role-Based Access** — admin, analyst, auditor, viewer roles
- **2FA Support** — TOTP-based two-factor authentication

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Backend | Node.js 20 + Express |
| Database | PostgreSQL 15 |
| Scanner | nmap |
| Process Manager | PM2 |
| Web Server | Nginx |

## Installation

See **[INSTALL.md](infosec/INSTALL.md)** for the complete step-by-step installation guide.

**Quick overview (Ubuntu 22.04):**

```bash
# 1. Clone
git clone https://github.com/iraklius25/SecureOps.git /opt/infosec
cd /opt/infosec/infosec

# 2. Install Node.js 20 (do NOT use apt install nodejs — it gives an old version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL 15 and create the database
#    See INSTALL.md Step 3 for the full repo setup

# 4. Load all schema files (there are 7 — see INSTALL.md Step 7)
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql
# ... (+ schema_v2.sql, schema_features_v3.sql, schema_v3_fix.sql,
#       schema_fix.sql, schema_cve_cache.sql, schema_gap_assessment.sql)

# 5. Configure backend
cd backend && cp .env.example .env   # edit DATABASE_URL and JWT_SECRET

# 6. Install, seed, and start
npm install && npm run seed
pm2 start server.js --name infosec-api && pm2 save

# 7. Build frontend
cd ../frontend && npm install && npm run build

# 8. Configure Nginx (see INSTALL.md Step 10)

# Open http://YOUR_SERVER_IP/  →  admin / Admin@123!
```

> **Change the default password immediately after first login.**

## Requirements

- Ubuntu 22.04 LTS (recommended)
- Node.js 20.x (via NodeSource — not the Ubuntu package)
- PostgreSQL 15 (via the official PostgreSQL repo — not the Ubuntu package)
- nmap 7+
- 4 GB RAM, 20 GB disk

## Releases

Download the latest release from the [Releases](../../releases) page.

## License

Private — all rights reserved.
