-- KPI / KRI Metrics — thresholds and historical snapshots
-- Run: psql -U infosec_user -d infosec_db -h localhost -f schema_metrics.sql

-- Configurable warning / critical thresholds for each metric
CREATE TABLE IF NOT EXISTS metric_thresholds (
  id               SERIAL PRIMARY KEY,
  metric_key       VARCHAR(100) UNIQUE NOT NULL,
  label            VARCHAR(200) NOT NULL,
  metric_type      VARCHAR(10)  NOT NULL CHECK (metric_type IN ('kri','kpi')),
  unit             VARCHAR(30)  DEFAULT '',          -- '', '%', '$', 'days'
  direction        VARCHAR(10)  NOT NULL DEFAULT 'lower' CHECK (direction IN ('lower','higher')),
  target_value     NUMERIC,                          -- ideal / goal
  warning_threshold NUMERIC,                         -- amber zone boundary
  critical_threshold NUMERIC,                        -- red zone boundary
  description      TEXT,
  business_impact  TEXT,
  linked_metric    VARCHAR(100),                     -- key of paired KPI/KRI
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Daily snapshot of computed metric values (for trend charts)
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  metric_key   VARCHAR(100) NOT NULL,
  value        NUMERIC,
  snapped_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_key_time
  ON metric_snapshots (metric_key, snapped_at DESC);

-- Seed default thresholds (safe to re-run)
INSERT INTO metric_thresholds (metric_key, label, metric_type, unit, direction, target_value, warning_threshold, critical_threshold, description, business_impact, linked_metric)
VALUES
-- KRIs
('critical_vulns_open',      'Open Critical Vulnerabilities',          'kri', '',    'lower',   0,    5,    20,   'Number of open critical-severity vulnerabilities across all assets.',                                       'Critical vulnerabilities are actively exploitable and can lead to full system compromise.',                    'scan_coverage_30d'),
('high_vulns_open',          'Open High Vulnerabilities',              'kri', '',    'lower',   0,    10,   40,   'Number of open high-severity vulnerabilities.',                                                              'High vulnerabilities significantly raise the risk of a successful attack.',                                   'vuln_remediation_rate'),
('overdue_vulns',            'Overdue Vulnerabilities',                'kri', '',    'lower',   0,    5,    15,   'Open vulnerabilities that have passed their due date without remediation.',                                  'Delay in remediating vulnerabilities makes the organization an easy target for malicious attacks.',           'mttr_days'),
('unpatched_assets',         'Assets with Pending Patches',            'kri', '',    'lower',   0,    5,    20,   'Number of assets with patches in pending or failed state.',                                                  'Unpatched systems are vulnerable to known exploits — a leading indicator of breach likelihood.',              'patch_compliance_rate'),
('total_ale',                'Total Annual Loss Expectancy (ALE)',      'kri', '$',   'lower',   0,    100000, 500000, 'Aggregate expected annual financial loss from all open vulnerabilities (ALE = SLE × ARO).',              'High ALE indicates significant financial exposure from unmitigated risk.',                                    'risk_treatment_coverage'),
('assets_not_scanned_30d',   'Assets Not Scanned (30+ Days)',          'kri', '',    'lower',   0,    3,    10,   'Active assets with no scan recorded in the last 30 days.',                                                   'Unscanned assets have unknown vulnerability profiles — a blind spot in the risk posture.',                   'scan_coverage_30d'),
('open_critical_risks',      'Open Critical Risks',                    'kri', '',    'lower',   0,    2,    5,    'Risks in the register with a critical risk level (risk_score ≥ 20).',                                        'Unmitigated critical risks exceed the risk appetite and can cause severe business disruption.',               'risk_treatment_coverage'),
('open_high_risks',          'Open High Risks',                        'kri', '',    'lower',   0,    5,    15,   'Risks with a high risk level (risk_score 12–19).',                                                           'High risks represent significant threats that must be actively tracked and treated.',                         'risk_treatment_coverage'),
('assets_critical_vuln_pct', 'Assets with Critical Vulnerabilities',   'kri', '%',   'lower',   0,    10,   30,   'Percentage of active assets that have at least one open critical vulnerability.',                             'A high percentage indicates a broad attack surface with multiple critical exposure points.',                  'scan_coverage_30d'),
('avg_vuln_age_days',        'Average Age of Open Vulnerabilities',    'kri', 'days','lower',   0,    30,   60,   'Mean number of days that open vulnerabilities have been unresolved.',                                        'Aged vulnerabilities signal slow remediation cycles and increasing risk exposure over time.',                 'mttr_days'),
-- KPIs
('scan_coverage_30d',        'Asset Scan Coverage (30 days)',           'kpi', '%',   'higher',  100,  80,   60,   'Percentage of active assets that have been scanned at least once in the last 30 days.',                      'Low scan coverage means unknown vulnerabilities — incomplete visibility into the security posture.',          'critical_vulns_open'),
('vuln_remediation_rate',    'Vulnerability Remediation Rate',          'kpi', '%',   'higher',  90,   70,   50,   'Percentage of all vulnerabilities that have been closed, mitigated, or accepted.',                          'A low remediation rate indicates remediation backlogs and increasing overall risk exposure.',                  'high_vulns_open'),
('mttr_days',                'Mean Time to Remediate (MTTR)',           'kpi', 'days','lower',   7,    14,   30,   'Average number of days from vulnerability detection to resolution.',                                         'High MTTR leaves the organization exposed for longer and signals an inefficient remediation process.',        'overdue_vulns'),
('patch_compliance_rate',    'Patch Compliance Rate',                   'kpi', '%',   'higher',  95,   80,   60,   'Percentage of tracked patches that have been applied across assigned assets.',                               'Low patch compliance directly increases the number of systems vulnerable to known exploits.',                 'unpatched_assets'),
('risk_treatment_coverage',  'Risk Treatment Coverage',                 'kpi', '%',   'higher',  100,  80,   60,   'Percentage of open risks that have an active treatment plan (mitigate, transfer, or avoid).',                'Untreated risks signal gaps in the risk management process and uncontrolled exposure.',                       'total_ale'),
('vuln_discovery_rate',      'Vulnerability Discovery Rate (weekly)',   'kpi', '',    'lower',   0,    10,   25,   'Average number of new vulnerabilities discovered per week over the last 4 weeks.',                           'Rapid discovery of many new vulnerabilities may indicate expanding attack surface or a new threat campaign.', 'critical_vulns_open'),
('risks_reviewed_pct',       'Risks Reviewed On Schedule',             'kpi', '%',   'higher',  100,  80,   60,   'Percentage of open risks whose review_date has not been exceeded (reviewed on time).',                       'Overdue risk reviews mean the risk register may no longer reflect the actual threat landscape.',              'open_critical_risks')
ON CONFLICT (metric_key) DO NOTHING;
