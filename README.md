# SecureOps — InfoSec Risk Management Platform

A self-hosted, enterprise-grade information security platform covering the full lifecycle from network discovery through risk quantification, compliance management, and governance.

---

## Overview

SecureOps brings together network scanning, vulnerability management, risk quantification, compliance tracking, and governance tooling into a single platform. It is built for security teams that need full visibility into their environment without relying on third-party SaaS.

---

## Feature Set

### Network & Asset Management
- **Network Scanning** — nmap-powered asset discovery with service and OS fingerprinting (`-sV -sC -O`), automatic upsert of assets and open ports
- **Asset Inventory** — track hosts, IP addresses, OS, criticality, and asset value; group assets for scoped access
- **Network Topology** — interactive visual map of discovered assets and their relationships

### Vulnerability Management
- **Automatic Detection** — rule-based engine matches port/banner/version data against a DB-driven `vuln_rules` table; no manual tagging required
- **CVE Integration** — link findings to CVE identifiers with CVSS scoring
- **SLA Tracking** — configurable remediation deadlines by severity; overdue alerts
- **Patch Tracker** — record and report patch status per asset with coverage metrics

### Risk Quantification
- **NIST-Based Risk Register** — ALE / ARO / SLE auto-calculated from asset value and exposure factor
- **Risk Scoring** — likelihood × impact matrix; automatic risk level (critical / high / medium / low)
- **Excel Export** — one-click export of the full risk register with filters and sorting
- **Audit Trail** — every create/edit/delete logged with user and timestamp

### Compliance & GRC
- **NIST CSF 2.0 + ISO 27001:2022** — control mapping with status tracking (implemented / partial / planned / not applicable)
- **Evidence Upload** — attach PDFs, images, and documents to controls; stored server-side
- **GRC Hub** — centralised governance, risk, and compliance document library with file upload
- **Maturity Assessment** — score organisational security maturity across domains
- **Certification Tracker** — track ISO, SOC 2, PCI-DSS and other certification milestones
- **Approvals Workflow** — structured review and sign-off process for GRC artefacts

### Threat Intelligence
- **Threat Feed Integration** — ingest and display external threat intelligence
- **Metrics & KPIs** — track security programme metrics over time with trend charts

### Governance
- **ISSC Meetings** — schedule Information Security Steering Committee meetings, select members, send `.ics` calendar invites, record minutes and decisions, distribute by email
- **Supplier Management** — maintain a vendor/supplier register with risk ratings
- **AI Systems Register** — catalogue AI systems in use for ISO 42001 alignment

### Platform
- **Executive Dashboard** — risk score summary, vulnerability trends, compliance posture at a glance
- **Reports** — generate and export security reports
- **Activity & Audit Log** — full platform audit log; searchable by user, action, and resource
- **Notifications** — in-app and email alerts for critical findings, SLA breaches, approvals, and GRC updates
- **API Keys** — generate scoped API keys for integrations
- **User Groups** — group users and assets for delegated access control

### Security & Access Control
- **Role-Based Access** — four roles enforced server-side: `admin`, `analyst`, `auditor`, `viewer`
- **2FA / TOTP** — time-based one-time password support for all accounts
- **JWT Authentication** — stateless auth with configurable secret; auto-redirect on token expiry
- **Rate Limiting** — 200 requests / 15 min per IP; Helmet security headers on all responses
- **Forced Password Change** — new accounts must change password on first login

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Backend | Node.js 20 + Express |
| Database | PostgreSQL 15 |
| Scanner | nmap |
| Process Manager | PM2 |
| Web Server | Nginx |

---

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

# 4. Load all schema files (single script handles everything)
cd backend && bash install_db.sh

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

---

## Requirements

- Ubuntu 22.04 LTS (recommended)
- Node.js 20.x (via NodeSource — not the Ubuntu package)
- PostgreSQL 14 or 15 (via the official PostgreSQL repo)
- nmap 7+
- 4 GB RAM, 20 GB disk

---

## Default Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@123!` |

Change the password immediately after first login. The platform will prompt you on first access.

---

## Environment Variables (backend `.env`)

```
DATABASE_URL=postgresql://infosec_user:<password>@localhost:5432/infosec_db
JWT_SECRET=<64-char random hex>
PORT=4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development|production
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Releases

Download the latest release from the [Releases](../../releases) page.

---

## License

Private — all rights reserved.
