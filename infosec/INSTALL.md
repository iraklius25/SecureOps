# SecureOps — Installation Guide
### Ubuntu 22.04 LTS (Recommended)

---

## REQUIREMENTS

| Component | Version |
|-----------|---------|
| OS | Ubuntu 22.04 LTS |
| Node.js | 20.x (LTS) |
| PostgreSQL | 15 |
| nmap | 7.x+ |
| RAM | 4 GB minimum |
| Disk | 20 GB minimum |

---

## STEP 1 — System preparation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential
```

---

## STEP 2 — Install Node.js 20

> **Do not use `apt install nodejs`** — Ubuntu's default repos ship an older version.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # must show v20.x.x
npm --version    # must show 10.x.x
```

---

## STEP 3 — Install PostgreSQL 15

> **Do not use `apt install postgresql`** — Ubuntu 22.04 defaults to PG 14.

```bash
# Add the official PostgreSQL repo
sudo apt install -y gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-15

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
psql --version   # must show psql (PostgreSQL) 15.x
```

### Create database and user

```bash
sudo -u postgres psql << 'EOF'
CREATE USER infosec_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE infosec_db OWNER infosec_user;
GRANT ALL PRIVILEGES ON DATABASE infosec_db TO infosec_user;
\c infosec_db
GRANT ALL ON SCHEMA public TO infosec_user;
\q
EOF
```

> **Replace `CHANGE_ME_STRONG_PASSWORD` with a real password. Write it down — you will need it in Step 6.**

### Test the connection

```bash
psql -U infosec_user -d infosec_db -h localhost -c "SELECT version();"
# You will be prompted for your password.
# Expected output: PostgreSQL 15.x ...
```

---

## STEP 4 — Install nmap

```bash
sudo apt install -y nmap

# Verify
nmap --version   # must show 7.x or higher

# Allow nmap to run OS detection without root (required for scans)
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)
```

---

## STEP 5 — Install PM2 and Nginx

```bash
sudo npm install -g pm2
sudo apt install -y nginx
```

---

## STEP 6 — Clone the repository

```bash
sudo mkdir -p /opt/infosec
sudo chown $USER:$USER /opt/infosec

git clone https://github.com/iraklius25/SecureOps.git /opt/infosec
cd /opt/infosec/infosec
```

---

## STEP 7 — Load the database schema

Run all schema files in order. All commands are safe to re-run.

```bash
cd /opt/infosec/infosec/backend

psql -U infosec_user -d infosec_db -h localhost -f schema.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v2.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_features_v3.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v3_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_cve_cache.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_gap_assessment.sql
```

Enter your database password when prompted for each file.

### Verify tables were created

```bash
psql -U infosec_user -d infosec_db -h localhost -c "\dt"
# Should list 20+ tables (assets, vulnerabilities, risks, users, etc.)
```

---

## STEP 8 — Configure the backend

```bash
cd /opt/infosec/infosec/backend
cp .env.example .env
nano .env
```

Fill in these values:

```env
NODE_ENV=production
PORT=4000

# Use the password from Step 3
DATABASE_URL=postgresql://infosec_user:CHANGE_ME_STRONG_PASSWORD@localhost:5432/infosec_db

# Generate a secure secret and paste it below:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_64_CHARACTER_RANDOM_STRING_HERE

# Your server's IP or domain (no trailing slash, no port — Nginx handles port 80)
FRONTEND_URL=http://YOUR_SERVER_IP

LOG_LEVEL=info
```

### Generate the JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output and paste it as JWT_SECRET in .env
```

### Install backend dependencies

```bash
npm install
```

### Create the default admin user

```bash
npm run seed
# Output: ✓ Admin user created: admin / Admin@123!
```

> **Change this password immediately after your first login.**

---

## STEP 9 — Build the frontend

```bash
cd /opt/infosec/infosec/frontend
npm install
npm run build
# Creates a build/ folder with static files
```

---

## STEP 10 — Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/infosec
```

Paste this configuration (replace `YOUR_SERVER_IP` with your actual IP or domain):

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    root /opt/infosec/infosec/frontend/build;
    index index.html;

    # React router — serve index.html for all non-API paths
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Node.js
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    location /health {
        proxy_pass http://localhost:4000;
    }
}
```

```bash
# Enable and activate
sudo ln -s /etc/nginx/sites-available/infosec /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t        # must say "syntax is ok"
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## STEP 11 — Start the backend

```bash
cd /opt/infosec/infosec/backend
pm2 start server.js --name infosec-api

# Persist across reboots
pm2 save
pm2 startup
# Run the command that pm2 startup prints (it looks like: sudo env PATH=... pm2 startup ...)
```

---

## STEP 12 — Verify everything is running

```bash
# 1. Backend health check
curl http://localhost:4000/health
# Expected: {"status":"ok",...}

# 2. Database connection
node -e "require('./db').query('SELECT NOW()').then(r=>console.log('DB OK:', r.rows[0].now)).catch(e=>console.error('DB FAIL:', e.message))"

# 3. Nginx serving frontend
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# 4. PM2 process status
pm2 status
# infosec-api should show status: online
```

### Open in browser

```
http://YOUR_SERVER_IP/
Login: admin / Admin@123!
```

---

## STEP 13 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp    # if you add HTTPS later
sudo ufw deny 4000/tcp    # block direct API access
sudo ufw deny 5432/tcp    # block direct DB access
sudo ufw enable
sudo ufw status
```

---

## STEP 14 — HTTPS (recommended for production)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.example.com

# Auto-renew
echo "0 3 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot-renew
```

---

## TROUBLESHOOTING

### Backend won't start
```bash
pm2 logs infosec-api --lines 50
# Common causes:
# - Wrong password in DATABASE_URL
# - JWT_SECRET not set or too short
# - Port 4000 already in use: sudo lsof -i :4000
```

### "relation does not exist" error
```bash
# One or more schema files were not loaded. Re-run all of them:
cd /opt/infosec/infosec/backend
psql -U infosec_user -d infosec_db -h localhost -f schema.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v2.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_features_v3.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v3_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_cve_cache.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_gap_assessment.sql
```

### Scans fail immediately
```bash
which nmap           # must return a path
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)
nmap -v localhost    # test nmap works
```

### Frontend shows blank page
```bash
# Check Nginx root path matches where the build actually is
ls /opt/infosec/infosec/frontend/build/index.html   # must exist
sudo nginx -t && sudo systemctl reload nginx
```

### "permission denied" on port 80
Nginx runs on port 80 which requires root — this is normal. PM2 / Node.js runs on port 4000 as a regular user and Nginx proxies to it.

### psql: connection refused
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

---

## UPGRADING

```bash
cd /opt/infosec
git pull

# Backend
cd infosec/backend
npm install
pm2 restart infosec-api

# Frontend
cd ../frontend
npm install && npm run build

# Apply any new schema files that appeared
psql -U infosec_user -d infosec_db -h localhost -f backend/schema.sql
# (repeat for any new schema_*.sql files in the release notes)
```

---

## DAILY BACKUP

```bash
# Manual
pg_dump -U infosec_user -h localhost infosec_db > ~/backup_$(date +%Y%m%d).sql

# Automated (runs at 03:00 every night)
echo "0 3 * * * infosec_user pg_dump -U infosec_user -h localhost infosec_db > /opt/infosec/backups/db_\$(date +\%Y\%m\%d).sql" | sudo tee /etc/cron.d/infosec-backup
sudo mkdir -p /opt/infosec/backups
```

---

## SECURITY CHECKLIST

- [ ] Changed default `admin` password after first login
- [ ] Set a random 64-char `JWT_SECRET` in `.env`
- [ ] Firewall enabled (`ufw status` shows active)
- [ ] Ports 4000 and 5432 are blocked externally
- [ ] HTTPS configured (Let's Encrypt or internal CA)
- [ ] PostgreSQL allows only localhost connections (`pg_hba.conf`)
- [ ] Daily DB backups configured

---

## USER ROLES

| Role | Access |
|------|--------|
| admin | Full access — users, config, scans, all data |
| analyst | Run scans, manage vulnerabilities and risks |
| auditor | Read-only + generate and export reports |
| viewer | Read-only |

---

*SecureOps — Use responsibly on networks you own or are authorised to test.*
