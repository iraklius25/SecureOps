-- Certification Tracker Schema — run after schema.sql and schema_grc.sql
-- psql -U infosec_user -d infosec_db -h localhost -f backend/schema_certifications.sql

-- Extend grc_programs framework enum to include PCIDSS and more
ALTER TABLE grc_programs DROP CONSTRAINT IF EXISTS grc_programs_framework_check;
ALTER TABLE grc_programs ADD CONSTRAINT grc_programs_framework_check
  CHECK (framework IN ('ISO27001','NISTCSF','ISO42001','PCIDSS','SOC2','HIPAA','GDPR','CUSTOM'));

-- Organizations tracked for certifications
CREATE TABLE IF NOT EXISTS cert_organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  industry    VARCHAR(100),
  contact     VARCHAR(200),
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certifications per organization (one per framework per org)
CREATE TABLE IF NOT EXISTS certifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID REFERENCES cert_organizations(id) ON DELETE CASCADE,
  framework      VARCHAR(50) NOT NULL,
  name           VARCHAR(200) NOT NULL,
  scope          TEXT,
  phase          VARCHAR(50) NOT NULL DEFAULT 'planning'
                   CHECK (phase IN ('planning','gap_analysis','remediation','pre_audit','audit','certified','surveillance','renewal')),
  target_date    DATE,
  certified_date DATE,
  expiry_date    DATE,
  auditor        VARCHAR(200),
  owner          VARCHAR(200),
  status         VARCHAR(50) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed','cancelled')),
  completion_pct INTEGER NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  notes          TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Framework requirements library (PCI DSS, ISO 27001, etc.)
CREATE TABLE IF NOT EXISTS cert_requirements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework   VARCHAR(50) NOT NULL,
  req_id      VARCHAR(50) NOT NULL,
  parent_req  VARCHAR(50),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  guidance    TEXT,
  level       INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(framework, req_id)
);

-- Responses to requirements per certification
CREATE TABLE IF NOT EXISTS cert_req_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  requirement_id   UUID NOT NULL REFERENCES cert_requirements(id) ON DELETE CASCADE,
  status           VARCHAR(50) NOT NULL DEFAULT 'not_assessed'
                     CHECK (status IN ('compliant','non_compliant','in_progress','not_applicable','not_assessed')),
  response         TEXT,
  evidence_notes   TEXT,
  assignee         VARCHAR(200),
  due_date         DATE,
  completed_date   DATE,
  notes            TEXT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(certification_id, requirement_id)
);

-- Timeline events for certification journey
CREATE TABLE IF NOT EXISTS cert_timeline_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  event_type       VARCHAR(50) NOT NULL DEFAULT 'milestone'
                     CHECK (event_type IN ('milestone','audit','finding','action','approval','certification','note')),
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  event_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status           VARCHAR(50) NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','completed','cancelled','overdue')),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflows for certification processes
CREATE TABLE IF NOT EXISTS cert_workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  status           VARCHAR(50) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','completed','cancelled')),
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow steps
CREATE TABLE IF NOT EXISTS cert_workflow_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL REFERENCES cert_workflows(id) ON DELETE CASCADE,
  step_number  INTEGER NOT NULL,
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  assignee     VARCHAR(200),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','completed','blocked','skipped')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_org   ON certifications(org_id);
CREATE INDEX IF NOT EXISTS idx_certifications_fw    ON certifications(framework);
CREATE INDEX IF NOT EXISTS idx_cert_resp_cert       ON cert_req_responses(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_resp_req        ON cert_req_responses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_cert_timeline        ON cert_timeline_events(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_wf_cert         ON cert_workflows(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_wf_steps        ON cert_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_cert_req_fw          ON cert_requirements(framework);

-- ── PCI DSS v4.0 Requirements Seed ─────────────────────────────────────
INSERT INTO cert_requirements (framework, req_id, parent_req, title, description, level, sort_order) VALUES
('PCIDSS','1',NULL,'Install and Maintain Network Security Controls','NSCs control network traffic between logical or physical network segments based on pre-defined policies and rules. They must be installed and maintained to protect the cardholder data environment.',1,100),
('PCIDSS','1.1','1','Processes and mechanisms for NSCs are defined and understood','All security policies and procedures for installing and maintaining network security controls must be documented, kept current, and in active use.',2,110),
('PCIDSS','1.2','1','NSCs are configured and maintained','Configuration standards are developed, implemented, and reviewed at least every six months. Changes are managed through a formal change control process.',2,120),
('PCIDSS','1.3','1','Network access to and from the CDE is restricted','Inbound and outbound traffic to the CDE is restricted to only that which is necessary. All other traffic is denied.',2,130),
('PCIDSS','1.4','1','Connections between trusted and untrusted networks are controlled','NSCs are implemented between all trusted and untrusted networks. Public-facing components are separated from internal networks.',2,140),
('PCIDSS','1.5','1','Risks from devices connecting to both untrusted networks and CDE are mitigated','Security policies are in place for computing devices that connect to both untrusted networks and the CDE.',2,150),

('PCIDSS','2',NULL,'Apply Secure Configurations to All System Components','Default passwords and vendor settings must be changed. Secure configuration standards must be developed and implemented for all system components.',1,200),
('PCIDSS','2.1','2','Processes and mechanisms for secure configurations are defined and understood','All security policies for managing vendor defaults and security parameters are documented, current, and in active use.',2,210),
('PCIDSS','2.2','2','System components are configured and managed securely','Configuration standards are developed and implemented for all system components. All default passwords are changed.',2,220),
('PCIDSS','2.3','2','Wireless environments are configured and managed securely','Wireless security settings prevent unauthorized access. Encryption protocols for wireless transmission of cardholder data are implemented.',2,230),

('PCIDSS','3',NULL,'Protect Stored Account Data','Protection methods such as encryption, truncation, masking, and hashing are critical. Threat actors bypass access controls to access stored cleartext cardholder data.',1,300),
('PCIDSS','3.1','3','Processes and mechanisms for protecting stored account data are defined','All security policies for protecting stored account data must be documented, current, and in active use.',2,310),
('PCIDSS','3.2','3','Storage of account data is kept to a minimum','Data retention and disposal policies must be implemented. Account data storage is limited to what is required for legal or business obligations.',2,320),
('PCIDSS','3.3','3','Sensitive authentication data (SAD) is not stored after authorization','All SAD received during authorization must not be retained after the completion of the authorization process.',2,330),
('PCIDSS','3.4','3','Access to full PAN displays and ability to copy PAN are restricted','Access to full PAN is restricted to those with a legitimate business need.',2,340),
('PCIDSS','3.5','3','Primary account number (PAN) is secured wherever stored','PAN is secured through one-way hash, truncation, index tokens with secured pads, or strong cryptography.',2,350),
('PCIDSS','3.6','3','Cryptographic keys used to protect stored account data are secured','Procedures for protecting cryptographic keys must be fully documented and implemented covering all aspects of key lifecycle.',2,360),
('PCIDSS','3.7','3','Key management processes and procedures are defined and implemented','Key management policies for keys protecting stored account data are implemented covering the full lifecycle.',2,370),

('PCIDSS','4',NULL,'Protect Cardholder Data with Strong Cryptography During Transmission','Sensitive information must be encrypted during transmission over public networks since it is easy for malicious actors to intercept data in transit.',1,400),
('PCIDSS','4.1','4','Processes and mechanisms for protecting CHD during transmission are defined','All security policies for protecting cardholder data during transmission must be documented and in active use.',2,410),
('PCIDSS','4.2','4','PAN is protected with strong cryptography during transmission','Strong cryptography is used to safeguard PAN during transmission over open, public networks. Only trusted keys/certificates are accepted.',2,420),

('PCIDSS','5',NULL,'Protect All Systems and Networks from Malicious Software','Malware exploits system vulnerabilities after entering the network through email, web browsing, mobile computers, and other means.',1,500),
('PCIDSS','5.1','5','Processes and mechanisms for protecting from malware are defined','All security policies for protecting all systems and networks from malicious software must be documented and in active use.',2,510),
('PCIDSS','5.2','5','Malicious software is prevented, or detected and addressed','Anti-malware solutions are deployed on all system components that are commonly affected by malware.',2,520),
('PCIDSS','5.3','5','Anti-malware mechanisms are active, maintained, and monitored','Anti-malware mechanisms are kept current, generate audit logs, and are actively monitored.',2,530),
('PCIDSS','5.4','5','Anti-phishing mechanisms protect users','Processes and automated mechanisms are in place to detect and protect personnel against phishing attacks.',2,540),

('PCIDSS','6',NULL,'Develop and Maintain Secure Systems and Software','Malicious individuals can use security vulnerabilities to gain privileged access. Vendor-provided security patches must be installed promptly.',1,600),
('PCIDSS','6.1','6','Processes and mechanisms for developing secure systems are defined','All security policies for developing and maintaining secure systems must be documented, current, and in active use.',2,610),
('PCIDSS','6.2','6','Bespoke and custom software are developed securely','Software development policies to prevent common vulnerabilities must be in place. Developers must be trained in secure coding techniques.',2,620),
('PCIDSS','6.3','6','Security vulnerabilities are identified and addressed','Processes for identifying and remediating security vulnerabilities must be in place. Critical patches are installed within one month of release.',2,630),
('PCIDSS','6.4','6','Public-facing web applications are protected against attacks','Public-facing web applications are reviewed regularly and protected against common attacks via WAF or code review.',2,640),
('PCIDSS','6.5','6','Changes to all system components are managed securely','All changes to system components in the production environment must be made according to established change control procedures.',2,650),

('PCIDSS','7',NULL,'Restrict Access to System Components and Cardholder Data by Business Need to Know','Systems and processes must limit access based on need to know and according to job responsibilities.',1,700),
('PCIDSS','7.1','7','Processes and mechanisms for restricting access by need to know are defined','All security policies for restricting access to system components and cardholder data must be documented and in active use.',2,710),
('PCIDSS','7.2','7','Access to system components and data resources is appropriately defined and assigned','An access control model is implemented that includes granting access based on least privilege.',2,720),
('PCIDSS','7.3','7','Access to system components and data resources is managed via an access control system','All access is managed via an access control system. Access control systems are kept current and assignment of access follows least-privilege.',2,730),

('PCIDSS','8',NULL,'Identify Users and Authenticate Access to System Components','Assigning unique IDs ensures each individual is uniquely accountable for their actions. Proper authentication protects against unauthorized access.',1,800),
('PCIDSS','8.1','8','Processes and mechanisms for identifying users and authenticating access are defined','All security policies for identifying users and authenticating access must be documented and in active use.',2,810),
('PCIDSS','8.2','8','User identification and related accounts are strictly managed throughout lifecycle','User accounts and access privileges are reviewed at least every six months. Inactive accounts are removed within 90 days.',2,820),
('PCIDSS','8.3','8','User authentication for users and administrators is established and managed','All user and administrator authentication uses a minimum one-factor: something you know, have, or are.',2,830),
('PCIDSS','8.4','8','Multi-factor authentication (MFA) is implemented to secure access into the CDE','MFA is implemented for all non-console administrative access into the CDE and for all remote network access to the CDE.',2,840),
('PCIDSS','8.5','8','MFA systems are configured to prevent misuse','MFA systems are implemented to prevent misuse such as replay attacks and social engineering attacks.',2,850),
('PCIDSS','8.6','8','Application and system accounts and authentication factors are strictly managed','Application and system accounts and associated authentication factors must be managed as strictly as user accounts.',2,860),

('PCIDSS','9',NULL,'Restrict Physical Access to Cardholder Data','Any physical access to data or systems housing cardholder data provides opportunity for unauthorized individuals to access devices, data, or hardcopies.',1,900),
('PCIDSS','9.1','9','Processes and mechanisms for restricting physical access are defined','All security policies for restricting physical access to cardholder data must be documented and in active use.',2,910),
('PCIDSS','9.2','9','Physical access controls manage entry into facilities and systems','Appropriate facility entry controls limit and monitor physical access to systems in the CDE.',2,920),
('PCIDSS','9.3','9','Physical access for personnel and visitors is authorized and managed','Procedures for authorizing and managing physical access for both staff and visitors are in place and enforced.',2,930),
('PCIDSS','9.4','9','Media with cardholder data is securely stored, accessed, distributed, and destroyed','All media containing cardholder data must be physically secure. Destruction of media uses secure methods.',2,940),
('PCIDSS','9.5','9','Point of interaction (POI) devices are protected from tampering','POI devices that capture payment card data are protected from tampering and unauthorized substitution.',2,950),

('PCIDSS','10',NULL,'Log and Monitor All Access to System Components and Cardholder Data','Logging and analyzing security events enables organizations to detect unauthorized access or misuse of cardholder data.',1,1000),
('PCIDSS','10.1','10','Processes and mechanisms for logging and monitoring all access are defined','All security policies for logging and monitoring access must be documented and in active use.',2,1010),
('PCIDSS','10.2','10','Audit logs are implemented to support detection of anomalies','Audit logs capture all events including individual user access to cardholder data, actions by root/admin, failed access attempts, and use of audit tools.',2,1020),
('PCIDSS','10.3','10','Audit logs are protected from destruction and unauthorized modifications','Audit logs must be protected to prevent modifications and unauthorized destruction, including from privileged users.',2,1030),
('PCIDSS','10.4','10','Audit logs are reviewed to identify anomalies or suspicious activity','All security events and logs of critical components must be reviewed at least daily.',2,1040),
('PCIDSS','10.5','10','Retain audit log history for at least 12 months','Audit log history must be retained for at least 12 months, with at least the most recent three months available for immediate analysis.',2,1050),
('PCIDSS','10.6','10','Time-synchronization mechanisms support consistent time settings','System clocks are synchronized using accepted NTP time-synchronization technology. Time data is protected.',2,1060),
('PCIDSS','10.7','10','Failures of critical security controls are detected and responded to promptly','Failures of critical security controls are detected, alerted, and responded to in a timely manner.',2,1070),

('PCIDSS','11',NULL,'Test Security of Systems and Networks Regularly','Vulnerabilities are discovered continually. System components and software must be tested frequently to ensure security controls continue to work.',1,1100),
('PCIDSS','11.1','11','Processes and mechanisms for regularly testing security are defined','All security policies for testing security of systems and networks must be documented and in active use.',2,1110),
('PCIDSS','11.2','11','Wireless access points are identified, monitored, and unauthorized WAPs addressed','Authorized and unauthorized wireless access points are identified and managed at least quarterly.',2,1120),
('PCIDSS','11.3','11','External and internal vulnerabilities are regularly identified and addressed','Internal and external vulnerability scans are performed at least quarterly and after any significant change.',2,1130),
('PCIDSS','11.4','11','Penetration testing is regularly performed','Penetration testing methodology is defined and implemented at least annually and after any significant changes.',2,1140),
('PCIDSS','11.5','11','Network intrusions and unexpected file changes are detected and responded to','Intrusion-detection and/or prevention techniques detect and prevent intrusions. File integrity monitoring is deployed.',2,1150),
('PCIDSS','11.6','11','Unauthorized changes on payment pages are detected and responded to','A change-detection mechanism alerts on unauthorized modification to HTTP headers and payment page script contents.',2,1160),

('PCIDSS','12',NULL,'Support Information Security with Organizational Policies and Programs','A strong information security policy sets the security tone for the whole entity and informs all personnel of their responsibilities.',1,1200),
('PCIDSS','12.1','12','A comprehensive information security policy is established, current, and communicated','An overall information security policy is established, published, maintained, and disseminated to all relevant personnel and contractors.',2,1210),
('PCIDSS','12.2','12','Acceptable use policies for end-user technologies are implemented','Acceptable use policies for end-user technologies are documented and implemented. Personnel acknowledge the policies annually.',2,1220),
('PCIDSS','12.3','12','Risks to the CDE are formally identified, evaluated, and managed','A targeted risk assessment is performed at least annually and after significant changes to identify risks to the CDE.',2,1230),
('PCIDSS','12.4','12','PCI DSS compliance is managed throughout the year','Compliance responsibilities are defined and assigned. Executive management establishes accountability.',2,1240),
('PCIDSS','12.5','12','PCI DSS scope is documented and validated','The PCI DSS scope is accurately determined and documented. Scope is confirmed at least annually.',2,1250),
('PCIDSS','12.6','12','Security awareness education is an ongoing activity','A formal security awareness program makes all personnel aware of the cardholder data security policy. Training is conducted upon hire and at least annually.',2,1260),
('PCIDSS','12.7','12','Personnel are screened to reduce risks from insider threats','Personnel are screened prior to hire to minimize the risk of attacks from internal sources.',2,1270),
('PCIDSS','12.8','12','Risks from third-party service providers (TPSPs) are managed','Policies to manage TPSPs with whom cardholder data is shared are implemented. A list of TPSPs is maintained.',2,1280),
('PCIDSS','12.9','12','TPSPs acknowledge their responsibilities for PCI DSS compliance','TPSPs provide written acknowledgment that they are responsible for the security of cardholder data they possess.',2,1290),
('PCIDSS','12.10','12','Security incidents that could impact the CDE are responded to immediately','An incident response plan is created, tested at least annually, and executed immediately upon suspected or confirmed breach.',2,1300)

ON CONFLICT (framework, req_id) DO NOTHING;
