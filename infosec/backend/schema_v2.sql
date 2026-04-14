-- InfoSec Platform — Schema v2 Migrations
-- Run: psql -U infosec_user -d infosec_db -h localhost -f backend/schema_v2.sql

-- ============================================================
-- IN-APP NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    type        VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info','warning','critical','success')),
    link        VARCHAR(255),
    resource    VARCHAR(100),
    resource_id UUID,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read);

-- ============================================================
-- GLOBAL SETTINGS (key-value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT DEFAULT '',
    description VARCHAR(500),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
('slack_webhook_url',      '', 'Slack incoming webhook URL for notifications'),
('teams_webhook_url',      '', 'Microsoft Teams incoming webhook URL'),
('notify_on_critical',     'true',  'Notify when critical vulnerabilities are found'),
('notify_on_high',         'true',  'Notify when high vulnerabilities are found'),
('notify_on_scan_complete','true',  'Notify when a scan completes')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ASSET CHANGE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
    scan_job_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('port_added','port_removed','os_changed','service_changed','first_seen')),
    field       VARCHAR(100),
    old_value   TEXT,
    new_value   TEXT,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_hist_asset   ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_hist_created ON asset_history(created_at);

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    key_hash    VARCHAR(255) NOT NULL UNIQUE,
    key_prefix  VARCHAR(16)  NOT NULL,
    scopes      TEXT[] DEFAULT ARRAY['read'],
    last_used   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- COMPLIANCE CONTROLS (NIST CSF + ISO 27001)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_controls (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework   VARCHAR(50) NOT NULL,
    control_id  VARCHAR(50) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(framework, control_id)
);

CREATE TABLE IF NOT EXISTS risk_controls (
    risk_id     UUID REFERENCES risks(id) ON DELETE CASCADE,
    control_id  UUID REFERENCES compliance_controls(id) ON DELETE CASCADE,
    status      VARCHAR(30) DEFAULT 'not_assessed'
                CHECK (status IN ('not_assessed','compliant','partial','non_compliant')),
    notes       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (risk_id, control_id)
);

-- ============================================================
-- VULNERABILITY COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS vuln_comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vuln_id     UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    comment     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vuln_comments_vuln ON vuln_comments(vuln_id);

-- ============================================================
-- SCHEDULED REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    report_type VARCHAR(50)  NOT NULL CHECK (report_type IN ('executive','ale','vulnerabilities','risks')),
    format      VARCHAR(10)  NOT NULL DEFAULT 'csv' CHECK (format IN ('csv','pdf')),
    schedule    VARCHAR(20)  NOT NULL CHECK (schedule IN ('daily','weekly','monthly')),
    is_active   BOOLEAN DEFAULT TRUE,
    last_run    TIMESTAMPTZ,
    next_run    TIMESTAMPTZ,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPLIANCE CONTROL DATA (NIST CSF 2.0 + ISO 27001:2022)
-- ============================================================
INSERT INTO compliance_controls (framework, control_id, name, description, category) VALUES
('NIST_CSF','GV.OC-01','Organizational Context','The organizational mission is understood and informs cybersecurity risk management','GOVERN'),
('NIST_CSF','ID.AM-01','IT Asset Inventory','IT hardware assets are inventoried','IDENTIFY'),
('NIST_CSF','ID.AM-02','Software Asset Inventory','Software assets are inventoried','IDENTIFY'),
('NIST_CSF','ID.AM-05','Asset Prioritization','Assets are prioritized based on classification, criticality, and impact','IDENTIFY'),
('NIST_CSF','ID.RA-01','Vulnerability Identification','Vulnerabilities in assets are identified, validated, and recorded','IDENTIFY'),
('NIST_CSF','ID.RA-02','Threat Intelligence','Cyber threat intelligence is received from information sharing forums','IDENTIFY'),
('NIST_CSF','ID.RA-05','Risk Prioritization','Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk','IDENTIFY'),
('NIST_CSF','PR.AA-01','Access Management','Identities and credentials for authorized users are managed by the organization','PROTECT'),
('NIST_CSF','PR.DS-01','Data-at-Rest Protection','The confidentiality, integrity, and availability of data-at-rest are protected','PROTECT'),
('NIST_CSF','PR.IR-01','Network Segmentation','Networks and environments are protected from unauthorized logical access','PROTECT'),
('NIST_CSF','DE.CM-01','Network Monitoring','Networks and network services are monitored to find potentially adverse events','DETECT'),
('NIST_CSF','DE.CM-09','Vulnerability Scanning','Computing hardware and software are monitored to find potentially adverse events','DETECT'),
('NIST_CSF','RS.MA-01','Incident Triage','Incidents are triaged to support analysis and incident handling','RESPOND'),
('NIST_CSF','RC.RP-01','Recovery Planning','The incident recovery plan is executed once initiated by appropriate authority','RECOVER'),
('ISO_27001','A.5.1','Policies for Information Security','Information security policy and topic-specific policies shall be defined','Organization'),
('ISO_27001','A.5.9','Inventory of Information Assets','An inventory of information and other associated assets shall be maintained','Organization'),
('ISO_27001','A.5.30','ICT Readiness for Business Continuity','ICT readiness shall be planned, implemented, monitored and tested','Organization'),
('ISO_27001','A.8.8','Management of Technical Vulnerabilities','Information about technical vulnerabilities shall be obtained in a timely fashion','Technology'),
('ISO_27001','A.8.9','Configuration Management','Security configurations of hardware, software, services and networks shall be established','Technology'),
('ISO_27001','A.8.16','Monitoring Activities','Networks, systems and applications shall be monitored for anomalous behaviour','Technology')
ON CONFLICT (framework, control_id) DO NOTHING;

COMMIT;
