# SecureOps — InfoSec Risk Management Platform

A self-hosted network security platform for asset discovery, vulnerability management, risk quantification, and compliance tracking.

## Features

- **Network Scanning** — nmap-powered asset discovery with service/OS detection
- **Vulnerability Management** — automatic CVE detection, CVSS scoring, SLA tracking
- **Risk Register** — NIST-based ALE/ARO/SLE risk quantification
- **Patch Tracker** — track patch status across assets with coverage reporting
- **Compliance** — NIST, ISO 27001, SOC 2 control mapping with evidence upload
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

## Quick Start

See **[INSTALL.md](infosec/INSTALL.md)** for the full installation guide.

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/infosec-platform.git
cd infosec-platform/infosec

# 2. Database setup
sudo -u postgres psql -c "CREATE USER infosec_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE infosec_db OWNER infosec_user;"
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql

# 3. Backend
cd backend
cp .env.example .env   # edit with your DB password and JWT secret
npm install
npm run seed           # creates admin / Admin@123!
pm2 start server.js --name infosec-api

# 4. Frontend
cd ../frontend
npm install && npm run build
sudo cp -r build/* /opt/infosec/frontend/build/

# 5. Open http://YOUR_SERVER_IP/
```

Default login: `admin` / `Admin@123!` — **change immediately after first login.**

## Requirements

- Ubuntu 22.04 LTS (recommended)
- Node.js 20+
- PostgreSQL 15+
- nmap 7+
- 4 GB RAM, 20 GB disk

## Releases

Download the latest release from the [Releases](../../releases) page. Each release includes a changelog and installation notes.

## License

Private — all rights reserved.
