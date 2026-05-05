# SecureOps — Installation Guide
### Ubuntu 22.04 LTS (Recommended)

---

## REQUIREMENTS

| Component | Version |
|-----------|---------|
| OS | Ubuntu 22.04 LTS |
| Node.js | 20.x (LTS) |
| PostgreSQL | 14 or 15 |
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

> **Do not use `apt install nodejs`** — Ubuntu's default repos ship an old version (12.x).

### Option A — NodeSource (standard internet access)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Option B — Binary download (corporate/restricted networks where NodeSource is blocked)

```bash
cd ~
wget --no-check-certificate https://nodejs.org/dist/v20.19.1/node-v20.19.1-linux-x64.tar.xz
tar -xf node-v20.19.1-linux-x64.tar.xz
sudo cp -r node-v20.19.1-linux-x64/{bin,lib,include,share} /usr/local/
```

### Verify

```bash
node --version   # must show v20.x.x
npm --version    # must show 10.x.x
```

---

## STEP 3 — Install PostgreSQL

Ubuntu's default repo ships PostgreSQL 14 which is fully compatible with this application.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
psql --version   # should show PostgreSQL 14.x
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

> **Replace `CHANGE_ME_STRONG_PASSWORD` with a real password. Write it down — you will need it in Step 7.**

### Avoid repeated password prompts (recommended)

```bash
# Use single quotes — double quotes would expand $ in the password
echo 'localhost:5432:infosec_db:infosec_user:CHANGE_ME_STRONG_PASSWORD' > ~/.pgpass
chmod 600 ~/.pgpass
```

### Test the connection

```bash
psql -U infosec_user -d infosec_db -h localhost -c "SELECT version();"
# Expected: PostgreSQL 14.x ...
```

---

## STEP 4 — Install nmap

```bash
sudo apt install -y nmap
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)
nmap --version   # must show 7.x or higher
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
psql -U infosec_user -d infosec_db -h localhost -f schema_force_password.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_maturity.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_grc.sql
```

### Verify — must show 35 tables

```bash
psql -U infosec_user -d infosec_db -h localhost -c "\dt"
# Expected: 35 rows
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
# IMPORTANT: if your password contains $, escape it as \$
# Example: S3cur30ps$2026 → S3cur30ps\$2026
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
# Deprecation warnings are normal — not errors
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
# Creates a build/ folder. Deprecation warnings are normal.
```

---

## STEP 10 — Configure Nginx

Get your server IP first:

```bash
hostname -I | awk '{print $1}'
```

```bash
sudo nano /etc/nginx/sites-available/infosec
```

Paste this configuration (replace `YOUR_SERVER_IP` with the IP from above):

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    root /opt/infosec/infosec/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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
sudo ln -s /etc/nginx/sites-available/infosec /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t        # must say "syntax is ok"
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## STEP 11 — Start the backend

```bash
cd /opt/infosec/infosec/backend
pm2 start server.js --name infosec-api
pm2 save
pm2 startup
```

> **Important:** `pm2 startup` prints a `sudo env PATH=...` command. Copy and run that command exactly as printed — this makes the backend survive reboots.

---

## STEP 12 — Verify everything is running

```bash
# Backend health
curl http://localhost:4000/health
# Expected: {"status":"ok",...}

# Frontend via Nginx
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# PM2 status
pm2 status
# infosec-api should show: online
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
echo "0 3 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot-renew
```

---

## TROUBLESHOOTING

### "password authentication failed" when running seed or psql
**Cause A — special character in password:** The password contains `$` which must be escaped in `.env`.
Change `$` to `\$` in the `DATABASE_URL` value (e.g. `S3cur30ps$2026` → `S3cur30ps\$2026`).

**Cause B — re-running setup on an existing install:** If `CREATE USER` printed `ERROR: role "infosec_user" already exists`, the `WITH PASSWORD` clause was skipped and the role kept its old password. Fix by resetting it manually:
```bash
sudo -u postgres psql -c "ALTER USER infosec_user WITH PASSWORD 'YOUR_PASSWORD';"
```
Then rewrite `.pgpass` using **single quotes** to prevent shell expansion of `$`:
```bash
echo 'localhost:5432:infosec_db:infosec_user:YOUR_PASSWORD' > ~/.pgpass
chmod 600 ~/.pgpass
```

### Backend won't start
```bash
pm2 logs infosec-api --lines 50
# Common causes:
# - Wrong password in DATABASE_URL (escape $ as \$)
# - JWT_SECRET not set
# - Port 4000 already in use: sudo lsof -i :4000
```

### "relation does not exist" error
One or more schema files were not loaded. Re-run all of them (safe to repeat):
```bash
cd /opt/infosec/infosec/backend
psql -U infosec_user -d infosec_db -h localhost -f schema.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v2.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_features_v3.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_v3_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_fix.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_cve_cache.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_gap_assessment.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_force_password.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_maturity.sql
psql -U infosec_user -d infosec_db -h localhost -f schema_grc.sql
```

### Table count is less than 35
Some schema files failed. Drop and recreate the database, then reload all schemas:
```bash
sudo -u postgres psql -c "DROP DATABASE IF EXISTS infosec_db;"
sudo -u postgres psql -c "CREATE DATABASE infosec_db OWNER infosec_user;"
sudo -u postgres psql -c "\c infosec_db" -c "GRANT ALL ON SCHEMA public TO infosec_user;"
# Then run all 10 psql -f commands above
```

### NodeSource blocked (corporate network)
Use the binary download method in Step 2 Option B instead.

### PostgreSQL apt repo blocked (corporate network)
Use `sudo apt install -y postgresql postgresql-contrib` — Ubuntu's default repo gives
PostgreSQL 14 which is fully compatible.

### Scans fail immediately
```bash
which nmap
sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)
```

### Frontend shows blank page
```bash
ls /opt/infosec/infosec/frontend/build/index.html   # must exist
sudo nginx -t && sudo systemctl reload nginx
```

### psql: connection refused
```bash
sudo systemctl start postgresql
```

---

## UPGRADING

```bash
cd /opt/infosec && git pull
cd infosec/backend && npm install
pm2 restart infosec-api
cd ../frontend && npm install && npm run build
# Apply any new schema_*.sql files mentioned in the release notes
```

---

## DAILY BACKUP

```bash
# Automated backup at 03:00 every night
sudo mkdir -p /opt/infosec/backups
echo "0 3 * * * amsadmin pg_dump -U infosec_user -h localhost infosec_db > /opt/infosec/backups/db_\$(date +\%Y\%m\%d).sql" | sudo tee /etc/cron.d/infosec-backup
```

---

## SECURITY CHECKLIST

- [ ] Changed default `admin` password after first login
- [ ] Set a random 64-char `JWT_SECRET` in `.env`
- [ ] Firewall enabled (`ufw status` shows active)
- [ ] Ports 4000 and 5432 blocked externally
- [ ] HTTPS configured
- [ ] PostgreSQL allows only localhost (`pg_hba.conf`)
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
