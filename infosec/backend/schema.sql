-- InfoSec Risk Management Platform
-- PostgreSQL Schema v1.0
-- Run: psql -U infosec_user -d infosec_db -f schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(100) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    role        VARCHAR(50) NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin','analyst','viewer','auditor')),
    department  VARCHAR(100),
    is_active   BOOLEAN DEFAULT TRUE,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ASSETS & INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname        VARCHAR(255),
    ip_address      INET NOT NULL,
    mac_address     VARCHAR(17),
    asset_type      VARCHAR(50) DEFAULT 'unknown' CHECK (asset_type IN ('server','workstation','network_device','iot','cloud','mobile','unknown')),
    os_name         VARCHAR(255),
    os_version      VARCHAR(100),
    os_cpe          VARCHAR(500),
    department      VARCHAR(100),
    owner           VARCHAR(255),
    location        VARCHAR(255),
    criticality     VARCHAR(20) DEFAULT 'medium' CHECK (criticality IN ('critical','high','medium','low')),
    asset_value     NUMERIC(15,2) DEFAULT 0,
    status          VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','inactive','decommissioned','unknown')),
    first_seen      TIMESTAMPTZ DEFAULT NOW(),
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    last_scanned    TIMESTAMPTZ,
    tags            TEXT[],
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_ip ON assets(ip_address);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets(criticality);

-- ============================================================
-- OPEN PORTS & SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_ports (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
    port        INTEGER NOT NULL,
    protocol    VARCHAR(10) DEFAULT 'tcp',
    service     VARCHAR(100),
    product     VARCHAR(255),
    version     VARCHAR(100),
    state       VARCHAR(20) DEFAULT 'open',
    banner      TEXT,
    cpe         VARCHAR(500),
    scanned_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ports_asset ON asset_ports(asset_id);
CREATE INDEX IF NOT EXISTS idx_ports_port ON asset_ports(port);

-- ============================================================
-- VULNERABILITIES (CVE-aware)
-- ============================================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id        UUID REFERENCES assets(id) ON DELETE CASCADE,
    port_id         UUID REFERENCES asset_ports(id) ON DELETE SET NULL,
    vuln_type       VARCHAR(100) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    cve_id          VARCHAR(50),
    cvss_score      NUMERIC(4,1),
    cvss_vector     VARCHAR(255),
    severity        VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low','informational')),
    risk_level      VARCHAR(20) CHECK (risk_level IN ('critical','high','medium','low')),
    status          VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','in_progress','mitigated','accepted','false_positive','closed')),
    evidence        TEXT,
    remediation     TEXT,
    references      TEXT[],
    -- ALE/Risk metrics
    asset_value     NUMERIC(15,2) DEFAULT 0,
    exposure_factor NUMERIC(5,2) DEFAULT 0,
    aro             NUMERIC(6,4) DEFAULT 0,
    sle             NUMERIC(15,2) GENERATED ALWAYS AS (asset_value * exposure_factor / 100) STORED,
    ale             NUMERIC(15,2) GENERATED ALWAYS AS (asset_value * exposure_factor / 100 * aro) STORED,
    detected_by     VARCHAR(50) DEFAULT 'scanner',
    detected_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    assigned_to     UUID REFERENCES users(id),
    due_date        DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vuln_asset ON vulnerabilities(asset_id);
CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vuln_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vuln_cve ON vulnerabilities(cve_id);

-- ============================================================
-- SCAN JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255),
    scan_type       VARCHAR(50) DEFAULT 'full' CHECK (scan_type IN ('ping','port','service','vulnerability','full')),
    target          VARCHAR(500) NOT NULL,
    status          VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
    progress        INTEGER DEFAULT 0,
    hosts_total     INTEGER DEFAULT 0,
    hosts_scanned   INTEGER DEFAULT 0,
    vulns_found     INTEGER DEFAULT 0,
    assets_found    INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    scan_options    JSONB DEFAULT '{}',
    results         JSONB DEFAULT '{}',
    initiated_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RISK REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS risks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    asset_id        UUID REFERENCES assets(id),
    vulnerability_id UUID REFERENCES vulnerabilities(id),
    likelihood      INTEGER CHECK (likelihood BETWEEN 1 AND 5),
    impact          INTEGER CHECK (impact BETWEEN 1 AND 5),
    risk_score      INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
    risk_level      VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN likelihood * impact >= 20 THEN 'critical'
            WHEN likelihood * impact >= 12 THEN 'high'
            WHEN likelihood * impact >= 6  THEN 'medium'
            ELSE 'low'
        END
    ) STORED,
    treatment       VARCHAR(30) DEFAULT 'mitigate' CHECK (treatment IN ('accept','mitigate','transfer','avoid')),
    status          VARCHAR(30) DEFAULT 'open',
    owner           UUID REFERENCES users(id),
    review_date     DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100),
    resource_id UUID,
    details     JSONB DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================================
-- VULNERABILITY RULES (what the scanner checks for)
-- ============================================================
CREATE TABLE IF NOT EXISTS vuln_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id         VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    check_type      VARCHAR(50),
    port            INTEGER,
    protocol        VARCHAR(10),
    condition       JSONB,
    severity        VARCHAR(20) NOT NULL,
    cvss_score      NUMERIC(4,1),
    cve_id          VARCHAR(50),
    remediation     TEXT,
    references      TEXT[],
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vulnerabilities_updated_at BEFORE UPDATE ON vulnerabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER risks_updated_at BEFORE UPDATE ON risks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DEFAULT VULNERABILITY RULES (SSH, TLS, HTTP, etc.)
-- ============================================================
INSERT INTO vuln_rules (rule_id, name, description, category, check_type, port, protocol, condition, severity, cvss_score, cve_id, remediation) VALUES
('SSH-001', 'SSH Protocol Version 1', 'SSHv1 is cryptographically broken and must not be used', 'Weak Protocol', 'banner', 22, 'tcp', '{"match":"SSH-1.","field":"banner"}', 'critical', 9.8, NULL, 'Disable SSH protocol version 1. Set "Protocol 2" in /etc/ssh/sshd_config'),
('SSH-002', 'SSH Version 2.1 - Outdated', 'SSH 2.1 has known vulnerabilities including weak key exchange', 'Outdated Software', 'version', 22, 'tcp', '{"product":"OpenSSH","version_lte":"2.1","field":"version"}', 'high', 7.5, NULL, 'Upgrade OpenSSH to latest stable version (9.x). Run: apt upgrade openssh-server'),
('SSH-003', 'OpenSSH < 8.0 - Multiple CVEs', 'Versions below 8.0 have multiple known vulnerabilities', 'Outdated Software', 'version', 22, 'tcp', '{"product":"OpenSSH","version_lt":"8.0","field":"version"}', 'high', 7.2, NULL, 'Upgrade OpenSSH to version 8.0 or later'),
('SSH-004', 'SSH Default Port Exposed to Internet', 'Port 22 open on external-facing host', 'Exposure', 'port', 22, 'tcp', '{"port":22,"external":true}', 'medium', 5.3, NULL, 'Change SSH port or restrict access via firewall rules to known IP ranges'),
('TLS-001', 'SSLv2/SSLv3 Enabled', 'SSL 2.0 and 3.0 are deprecated and vulnerable to POODLE/DROWN', 'Weak Protocol', 'banner', 443, 'tcp', '{"match":"SSLv","field":"banner"}', 'critical', 9.8, 'CVE-2014-3566', 'Disable SSLv2/SSLv3. Enable TLS 1.2+ only in your web server configuration'),
('TLS-002', 'TLS 1.0/1.1 Enabled', 'TLS 1.0 and 1.1 are deprecated per RFC 8996', 'Weak Protocol', 'service', 443, 'tcp', '{"tls_version_lt":"1.2"}', 'high', 6.5, NULL, 'Disable TLS 1.0 and 1.1. Configure server to use TLS 1.2 and TLS 1.3 only'),
('HTTP-001', 'HTTP without HTTPS Redirect', 'Plaintext HTTP exposes sensitive data to interception', 'Encryption', 'port', 80, 'tcp', '{"port":80,"no_redirect":true}', 'medium', 5.3, NULL, 'Implement HTTPS redirect. Add: Strict-Transport-Security header'),
('HTTP-002', 'Missing Security Headers', 'Web server missing critical security headers', 'Configuration', 'banner', 80, 'tcp', '{"missing_headers":["X-Frame-Options","Content-Security-Policy","X-XSS-Protection"]}', 'medium', 5.3, NULL, 'Add security headers: X-Frame-Options, CSP, X-XSS-Protection, HSTS'),
('FTP-001', 'Anonymous FTP Enabled', 'Anonymous FTP login allows unauthenticated access', 'Authentication', 'banner', 21, 'tcp', '{"match":"Anonymous","field":"banner"}', 'high', 7.5, NULL, 'Disable anonymous FTP. Use SFTP instead. Restrict FTP access to authenticated users only'),
('TELNET-001', 'Telnet Service Running', 'Telnet transmits data including credentials in plaintext', 'Weak Protocol', 'port', 23, 'tcp', '{"port":23}', 'critical', 9.8, NULL, 'Disable Telnet immediately. Replace with SSH. Run: systemctl disable telnet'),
('SMTP-001', 'SMTP Open Relay', 'Mail server allows relaying from unauthorized hosts', 'Misconfiguration', 'banner', 25, 'tcp', '{"open_relay":true}', 'high', 7.5, NULL, 'Configure SMTP authentication. Restrict relay to authorized hosts only'),
('RDP-001', 'RDP Exposed to Internet', 'Remote Desktop Protocol accessible from internet - BlueKeep risk', 'Exposure', 'port', 3389, 'tcp', '{"port":3389}', 'critical', 9.8, 'CVE-2019-0708', 'Place RDP behind VPN. Enable NLA. Apply MS patches for BlueKeep'),
('SMB-001', 'SMBv1 Enabled', 'SMBv1 is exploited by EternalBlue/WannaCry ransomware', 'Weak Protocol', 'port', 445, 'tcp', '{"smb_version":"1"}', 'critical', 9.8, 'CVE-2017-0144', 'Disable SMBv1: Set-SmbServerConfiguration -EnableSMB1Protocol $false'),
('DB-001', 'MySQL Exposed Publicly', 'Database port 3306 accessible without firewall restriction', 'Exposure', 'port', 3306, 'tcp', '{"port":3306}', 'high', 7.5, NULL, 'Restrict MySQL to localhost or internal network. Use firewall: iptables -A INPUT -p tcp --dport 3306 -j DROP'),
('DB-002', 'PostgreSQL Exposed Publicly', 'Database port 5432 accessible without firewall restriction', 'Exposure', 'port', 5432, 'tcp', '{"port":5432}', 'high', 7.5, NULL, 'Restrict PostgreSQL access. Update pg_hba.conf to limit connections'),
('DB-003', 'MongoDB Exposed Without Auth', 'MongoDB port open, possible no-auth configuration', 'Authentication', 'port', 27017, 'tcp', '{"port":27017}', 'critical', 9.8, NULL, 'Enable MongoDB authentication. Bind to localhost only'),
('REDIS-001', 'Redis Exposed Without Auth', 'Redis commonly deployed without password authentication', 'Authentication', 'port', 6379, 'tcp', '{"port":6379}', 'critical', 9.8, NULL, 'Set Redis requirepass. Bind Redis to 127.0.0.1 only'),
('VNC-001', 'VNC Service Exposed', 'VNC transmits desktop in potentially unencrypted form', 'Exposure', 'port', 5900, 'tcp', '{"port":5900}', 'high', 7.5, NULL, 'Tunnel VNC through SSH. Enable VNC authentication. Restrict to VPN'),
('SNMP-001', 'SNMP with Default Community Strings', 'SNMP using public/private default community strings', 'Authentication', 'port', 161, 'udp', '{"community":"public"}', 'high', 7.5, NULL, 'Change SNMP community strings. Upgrade to SNMPv3 with authentication');

-- ============================================================
-- GROUPS (user groups & asset groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color       VARCHAR(20) DEFAULT '#1f6feb',
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS group_users (
    group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_assets (
    group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
    asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_group_users_group  ON group_users(group_id);
CREATE INDEX IF NOT EXISTS idx_group_users_user   ON group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_group_assets_group ON group_assets(group_id);
CREATE INDEX IF NOT EXISTS idx_group_assets_asset ON group_assets(asset_id);

COMMIT;
