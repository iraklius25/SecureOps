# SecureOps — InfoSec Risk Management Platform
## Complete Installation & Deployment Guide
### Ubuntu 22.04 LTS (Recommended)

---

## OVERVIEW

This platform provides:
- Network asset discovery via nmap
- Automatic vulnerability detection (SSH versions, TLS, open databases, etc.)
- ALE / ARO / SLE risk quantification
- Risk register with NIST likelihood × impact scoring
- Executive reports and dashboards
- Role-based access: admin, analyst, auditor, viewer

**Architecture:**
```
Browser → React Frontend (port 3000) → Node.js API (port 4000) → PostgreSQL (port 5432)
                                         ↓
                                      nmap scanner
```

---

## STEP 1 — SYSTEM REQUIREMENTS

**Minimum hardware:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB
- OS: Ubuntu 22.04 LTS (also works on 20.04, Debian 11, RHEL 9)

**Update your system first:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential
```

---

## STEP 2 — INSTALL Node.js 20

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # should show v20.x.x
npm --version    # should show 10.x.x
```

---

## STEP 3 — INSTALL PostgreSQL 15

```bash
# Add PostgreSQL official repo
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
sudo systemctl status postgresql
```

### Create database and user:
```bash
sudo -u postgres psql << 'EOF'
-- Create dedicated user (change the password!)
CREATE USER infosec_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD_HERE';

-- Create database
CREATE DATABASE infosec_db OWNER infosec_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE infosec_db TO infosec_user;

-- Connect and grant schema privileges
\c infosec_db
GRANT ALL ON SCHEMA public TO infosec_user;

\q
EOF
```

### Load the database schema:
```bash
# From the project root
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql
# Enter the password you set above when prompted
```

### Test connection:
```bash
psql -U infosec_user -d infosec_db -h localhost -c "SELECT version();"
```

---

## STEP 4 — INSTALL nmap (Required for scanning)

```bash
sudo apt install -y nmap

# Verify
nmap --version   # should show 7.x or higher

# IMPORTANT: The API runs as a non-root user but nmap needs root for OS detection
# Grant nmap capabilities (safer than running API as root):
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)

# Alternative: add your app user to a group and use sudo rules
# See security hardening section below
```

---

## STEP 5 — CLONE / COPY PROJECT FILES

```bash
# Create app directory
sudo mkdir -p /opt/infosec
sudo chown $USER:$USER /opt/infosec

# Copy project files (if you have the zip/folder)
cp -r infosec/* /opt/infosec/

# OR clone from your internal git
# git clone https://your-git-server/infosec.git /opt/infosec
```

---

## STEP 6 — CONFIGURE BACKEND

```bash
cd /opt/infosec/backend

# Copy and edit environment file
cp .env.example .env
nano .env
```

Edit these values in `.env`:
```env
NODE_ENV=production
PORT=4000

# Use the password you created in Step 3
DATABASE_URL=postgresql://infosec_user:CHANGE_ME_STRONG_PASSWORD_HERE@localhost:5432/infosec_db

# Generate a secure JWT secret:
# Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_YOUR_64_CHARACTER_RANDOM_STRING_HERE

FRONTEND_URL=http://YOUR_SERVER_IP:3000
LOG_LEVEL=info
```

### Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output and paste it as JWT_SECRET in .env
```

### Install backend dependencies:
```bash
cd /opt/infosec/backend
npm install --production
```

### Seed the admin user:
```bash
npm run seed
# Output: ✓ Admin user created: admin / Admin@123!
# !! CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN !!
```

---

## STEP 7 — INSTALL AND BUILD FRONTEND

```bash
cd /opt/infosec/frontend
npm install
npm run build
# This creates a 'build/' folder with static files
```

---

## STEP 8 — INSTALL NGINX (Production Web Server)

```bash
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/infosec
```

Paste this config:
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP_OR_DOMAIN;

    # Serve React frontend
    root /opt/infosec/frontend/build;
    index index.html;

    # React router — serve index.html for all non-API paths
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;    # Long timeout for scans
    }

    location /health {
        proxy_pass http://localhost:4000;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/infosec /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## STEP 9 — RUN BACKEND WITH PM2

PM2 keeps the Node.js server running and restarts it if it crashes.

```bash
sudo npm install -g pm2

cd /opt/infosec/backend
pm2 start server.js --name infosec-api

# Save process list (survive reboots)
pm2 save
pm2 startup   # Run the output command as instructed

# Monitor
pm2 status
pm2 logs infosec-api
```

---

## STEP 10 — VERIFY INSTALLATION

```bash
# Check API health
curl http://localhost:4000/health
# Expected: {"status":"ok","version":"1.0.0",...}

# Check Nginx is serving frontend
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# Check database connection
cd /opt/infosec/backend && node -e "require('./db').query('SELECT NOW()').then(r=>console.log('DB OK:', r.rows[0].now)).catch(e=>console.error('DB FAIL:', e.message))"
```

### Open in browser:
```
http://YOUR_SERVER_IP/
Login: admin / Admin@123!
```

---

## STEP 11 — FIREWALL SETUP

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp   # if you add HTTPS later
sudo ufw deny 4000/tcp   # Don't expose API port directly
sudo ufw deny 5432/tcp   # Don't expose PostgreSQL
sudo ufw enable
sudo ufw status
```

---

## STEP 12 — HTTPS WITH LET'S ENCRYPT (Recommended for production)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Replace with your actual domain
sudo certbot --nginx -d yourdomain.company.com

# Auto-renew
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

---

## USING THE SCANNER

### How to run a scan:
1. Log in → click **Scans** → **+ New Scan**
2. Enter target: single IP, CIDR range, or IP range
   - Single host: `192.168.1.50`
   - Subnet: `192.168.1.0/24`
   - Range: `10.0.0.1-254`
3. Select scan type: **Full scan** recommended
4. Click **▶ Start Scan**

### What gets detected automatically:
| Finding | Risk Level | Example |
|---------|-----------|---------|
| SSH v1 or version ≤ 2.1 | Critical/High | SSH-1.99, OpenSSH 2.0 |
| Telnet exposed | Critical | Port 23 open |
| RDP exposed to network | Critical | Port 3389 open |
| SMBv1 (EternalBlue/WannaCry) | Critical | Port 445 + SMBv1 |
| MongoDB/Redis no auth | Critical | Ports 27017/6379 open |
| SSL v2/v3 enabled | Critical | POODLE/DROWN |
| FTP anonymous login | High | Banner "Anonymous" |
| OpenSSH < 8.0 | High | Version detected |
| TLS 1.0/1.1 | High | Deprecated TLS |
| MySQL/PostgreSQL exposed | High | Ports 3306/5432 open |
| HTTP without HTTPS | Medium | Port 80 no redirect |
| SNMP default strings | High | Community "public" |

### ALE auto-calculation per finding:
| Severity | EF | ARO | Example ALE (on $50k asset) |
|---------|----|-----|-----|
| Critical | 80% | 0.9/yr | $36,000/yr |
| High | 60% | 0.5/yr | $15,000/yr |
| Medium | 40% | 0.25/yr | $5,000/yr |
| Low | 20% | 0.1/yr | $1,000/yr |

You can override EF, ARO and asset value per vulnerability in the detail view.

---

## DATABASE BACKUP

```bash
# Manual backup
pg_dump -U infosec_user -h localhost infosec_db > /backup/infosec_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
sudo crontab -e
# Add: 0 3 * * * pg_dump -U infosec_user -h localhost infosec_db > /backup/infosec_$(date +\%Y\%m\%d).sql

# Restore from backup
psql -U infosec_user -h localhost -d infosec_db < /backup/infosec_20250101.sql
```

---

## TROUBLESHOOTING

### Backend won't start:
```bash
pm2 logs infosec-api --lines 50
# Common causes:
# - Wrong DATABASE_URL password
# - JWT_SECRET not set
# - Port 4000 already in use: lsof -i :4000
```

### Scans fail immediately:
```bash
which nmap           # must return a path
nmap -v localhost    # test nmap works
# If nmap not found: sudo apt install nmap
```

### "relation does not exist" DB error:
```bash
# Schema not loaded — run again:
psql -U infosec_user -d infosec_db -h localhost -f /opt/infosec/backend/schema.sql
```

### Frontend shows blank page:
```bash
cd /opt/infosec/frontend && npm run build
sudo nginx -t && sudo systemctl reload nginx
```

### Permission denied for nmap:
```bash
# Option 1: set capabilities
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)

# Option 2: allow via sudoers (more controlled)
echo "$(whoami) ALL=(root) NOPASSWD: $(which nmap)" | sudo tee /etc/sudoers.d/infosec-nmap
```

---

## USER ROLES

| Role | Capabilities |
|------|-------------|
| admin | Everything: users, scans, edit/delete assets, config |
| analyst | Run scans, manage vulnerabilities and risks, edit assets |
| auditor | Read everything + generate reports |
| viewer | Read-only: assets, vulnerabilities, risks |

---

## UPGRADE PROCEDURE

```bash
cd /opt/infosec
git pull   # or copy new files

# Backend
cd backend && npm install --production
pm2 restart infosec-api

# Frontend
cd ../frontend && npm install && npm run build

# If schema changed
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql
```

---

## SECURITY HARDENING CHECKLIST

- [ ] Change default admin password immediately after first login
- [ ] Set a strong random JWT_SECRET (64+ chars)
- [ ] Use HTTPS (Let's Encrypt or internal CA)
- [ ] Restrict PostgreSQL: ensure pg_hba.conf allows only localhost
- [ ] Enable UFW firewall — block ports 4000 and 5432 externally
- [ ] Run the Node.js process as a dedicated non-root user
- [ ] Enable PostgreSQL audit logging for compliance
- [ ] Set up daily DB backups to an offsite location
- [ ] Restrict scan permissions — only authorised staff should run scans
- [ ] Review nmap sudoers rule: scope to specific hosts/ranges if possible
- [ ] Monitor PM2 logs: pm2 logs infosec-api

---

## FILE STRUCTURE REFERENCE

```
infosec/
├── backend/
│   ├── server.js          ← Express app entry point
│   ├── db.js              ← PostgreSQL connection pool
│   ├── schema.sql         ← Full DB schema + vulnerability rules
│   ├── seed.js            ← Creates admin user
│   ├── .env               ← Your secrets (never commit this)
│   ├── services/
│   │   ├── scanner.js     ← nmap wrapper + vuln rule engine
│   │   └── logger.js      ← Winston logger
│   ├── middleware/
│   │   └── auth.js        ← JWT auth + role enforcement
│   └── routes/
│       ├── auth.js        ← /api/auth/*
│       ├── assets.js      ← /api/assets/*
│       ├── scans.js       ← /api/scans/*
│       ├── vulnerabilities.js
│       ├── risks.js
│       ├── dashboard.js
│       ├── reports.js
│       └── users.js
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js         ← Router + auth context
        ├── App.css        ← All styles
        └── pages/
            ├── Login.js
            ├── Dashboard.js
            ├── Assets.js
            ├── Scans.js
            ├── Vulnerabilities.js
            ├── Risks.js
            ├── Reports.js
            └── Users.js
```

---

## QUICK START SUMMARY

```bash
# 1. Install dependencies
sudo apt update && sudo apt install -y nodejs npm postgresql nmap nginx
sudo npm install -g pm2

# 2. Database
sudo -u postgres psql -c "CREATE USER infosec_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE infosec_db OWNER infosec_user;"
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql

# 3. Backend
cd backend && cp .env.example .env  # edit .env with your DB password + JWT secret
npm install && npm run seed
pm2 start server.js --name infosec-api && pm2 save

# 4. Frontend
cd ../frontend && npm install && npm run build

# 5. Nginx
sudo cp /path/to/nginx.conf /etc/nginx/sites-available/infosec
sudo ln -s /etc/nginx/sites-available/infosec /etc/nginx/sites-enabled/
sudo systemctl reload nginx

# 6. Open browser → http://YOUR_IP/  → admin / Admin@123!
```

---

*SecureOps v1.0 — Built for InfoSec teams. Use responsibly.*
