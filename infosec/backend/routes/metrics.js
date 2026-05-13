const router  = require('express').Router();
const db      = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// ── Helpers ────────────────────────────────────────────────────

function ragStatus(value, threshold, direction) {
  if (value === null || value === undefined) return 'grey';
  const v   = Number(value);
  const warn = Number(threshold.warning_threshold);
  const crit = Number(threshold.critical_threshold);
  if (direction === 'lower') {
    if (v <= (threshold.target_value ?? 0) && threshold.target_value != null) return 'green';
    if (v <= warn) return 'green';
    if (v <= crit) return 'amber';
    return 'red';
  }
  // higher is better
  if (v >= (threshold.target_value ?? 100) && threshold.target_value != null) return 'green';
  if (v >= warn) return 'green';
  if (v >= crit) return 'amber';
  return 'red';
}

// ── Compute all live metric values ────────────────────────────

async function computeMetrics() {
  const [
    critVulns,
    highVulns,
    overdueVulns,
    unpatchedAssets,
    aleRow,
    assetsNoScan,
    openCritRisks,
    openHighRisks,
    assetsCritPct,
    avgVulnAge,
    scanCoverage,
    remediationRate,
    mttr,
    patchCompliance,
    riskTreatment,
    weeklyDiscovery,
    risksReviewed,
  ] = await Promise.all([

    // KRIs
    db.query(`SELECT COUNT(*) AS val FROM vulnerabilities WHERE status='open' AND severity='critical'`),
    db.query(`SELECT COUNT(*) AS val FROM vulnerabilities WHERE status='open' AND severity='high'`),
    db.query(`SELECT COUNT(*) AS val FROM vulnerabilities WHERE status='open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`),
    db.query(`
      SELECT COUNT(DISTINCT ap.asset_id) AS val
      FROM asset_patches ap
      WHERE ap.status IN ('pending','failed')
    `),
    db.query(`SELECT COALESCE(SUM(ale),0) AS val FROM vulnerabilities WHERE status='open'`),
    db.query(`
      SELECT COUNT(*) AS val FROM assets
      WHERE status='active'
        AND (last_scanned IS NULL OR last_scanned < NOW() - INTERVAL '30 days')
    `),
    db.query(`SELECT COUNT(*) AS val FROM risks WHERE status='open' AND risk_level='critical'`),
    db.query(`SELECT COUNT(*) AS val FROM risks WHERE status='open' AND risk_level='high'`),
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(DISTINCT v.asset_id) FILTER (WHERE v.severity='critical' AND v.status='open')
        / NULLIF(COUNT(DISTINCT a.id),0)
      , 1) AS val
      FROM assets a
      LEFT JOIN vulnerabilities v ON v.asset_id = a.id
      WHERE a.status='active'
    `),
    db.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-created_at))/86400)::numeric, 1) AS val
      FROM vulnerabilities WHERE status='open'
    `),

    // KPIs
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE last_scanned >= NOW() - INTERVAL '30 days')
        / NULLIF(COUNT(*),0)
      , 1) AS val
      FROM assets WHERE status='active'
    `),
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('closed','mitigated','accepted','false_positive'))
        / NULLIF(COUNT(*),0)
      , 1) AS val
      FROM vulnerabilities
    `),
    db.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/86400)::numeric, 1) AS val
      FROM vulnerabilities
      WHERE resolved_at IS NOT NULL AND status IN ('closed','mitigated')
    `),
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE ap.status='applied')
        / NULLIF(COUNT(*),0)
      , 1) AS val
      FROM asset_patches ap
    `),
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE treatment IN ('mitigate','transfer','avoid'))
        / NULLIF(COUNT(*),0)
      , 1) AS val
      FROM risks WHERE status='open'
    `),
    db.query(`
      SELECT ROUND(AVG(weekly_count)::numeric, 1) AS val FROM (
        SELECT COUNT(*) AS weekly_count
        FROM vulnerabilities
        WHERE created_at >= NOW() - INTERVAL '4 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
      ) t
    `),
    db.query(`
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE review_date IS NULL OR review_date >= CURRENT_DATE)
        / NULLIF(COUNT(*),0)
      , 1) AS val
      FROM risks WHERE status='open'
    `),
  ]);

  return {
    critical_vulns_open:      Number(critVulns.rows[0]?.val     ?? 0),
    high_vulns_open:          Number(highVulns.rows[0]?.val     ?? 0),
    overdue_vulns:            Number(overdueVulns.rows[0]?.val  ?? 0),
    unpatched_assets:         Number(unpatchedAssets.rows[0]?.val ?? 0),
    total_ale:                Number(aleRow.rows[0]?.val        ?? 0),
    assets_not_scanned_30d:   Number(assetsNoScan.rows[0]?.val  ?? 0),
    open_critical_risks:      Number(openCritRisks.rows[0]?.val ?? 0),
    open_high_risks:          Number(openHighRisks.rows[0]?.val ?? 0),
    assets_critical_vuln_pct: Number(assetsCritPct.rows[0]?.val ?? 0),
    avg_vuln_age_days:        Number(avgVulnAge.rows[0]?.val    ?? 0),
    scan_coverage_30d:        Number(scanCoverage.rows[0]?.val  ?? 0),
    vuln_remediation_rate:    Number(remediationRate.rows[0]?.val ?? 0),
    mttr_days:                Number(mttr.rows[0]?.val          ?? 0),
    patch_compliance_rate:    Number(patchCompliance.rows[0]?.val ?? 0),
    risk_treatment_coverage:  Number(riskTreatment.rows[0]?.val ?? 0),
    vuln_discovery_rate:      Number(weeklyDiscovery.rows[0]?.val ?? 0),
    risks_reviewed_pct:       Number(risksReviewed.rows[0]?.val ?? 0),
  };
}

// ── GET /api/metrics — live metrics with RAG status ──────────

router.get('/', auth, async (req, res) => {
  try {
    const [values, thresholds, trendRows] = await Promise.all([
      computeMetrics(),
      db.query('SELECT * FROM metric_thresholds ORDER BY metric_type, metric_key'),
      db.query(`
        SELECT metric_key, DATE_TRUNC('day', snapped_at) AS day, AVG(value) AS val
        FROM metric_snapshots
        WHERE snapped_at >= NOW() - INTERVAL '30 days'
        GROUP BY metric_key, DATE_TRUNC('day', snapped_at)
        ORDER BY metric_key, day
      `),
    ]);

    // Build trend map: { metric_key: [ { day, val } ] }
    const trends = {};
    for (const row of trendRows.rows) {
      if (!trends[row.metric_key]) trends[row.metric_key] = [];
      trends[row.metric_key].push({ day: row.day, val: Number(row.val) });
    }

    const metrics = thresholds.rows.map(t => {
      const value  = values[t.metric_key] ?? null;
      const status = ragStatus(value, t, t.direction);
      return {
        ...t,
        value,
        status,
        trend: trends[t.metric_key] || [],
      };
    });

    // KRI-KPI linkage pairs from the PDF (Figure 2) mapped to platform metrics
    const linkage = [
      { kri: 'critical_vulns_open',      kpi: 'scan_coverage_30d',       impact: 'Undetected assets harbour critical vulnerabilities, increasing overall risk exposure.' },
      { kri: 'high_vulns_open',          kpi: 'vuln_remediation_rate',    impact: 'A growing backlog of high vulnerabilities indicates a failing remediation process.' },
      { kri: 'overdue_vulns',            kpi: 'mttr_days',                impact: 'Delay in remediating vulnerabilities makes the organisation an easy target for attacks.' },
      { kri: 'unpatched_assets',         kpi: 'patch_compliance_rate',    impact: 'Lack of patching directly enables exploitation of known CVEs.' },
      { kri: 'total_ale',                kpi: 'risk_treatment_coverage',  impact: 'High ALE with low treatment coverage signals financial exposure from untreated risks.' },
      { kri: 'assets_not_scanned_30d',   kpi: 'scan_coverage_30d',        impact: 'Unscanned assets represent unknown risk — a blind spot in the security posture.' },
      { kri: 'open_critical_risks',      kpi: 'risk_treatment_coverage',  impact: 'Critical risks without treatment plans exceed the risk appetite and threaten continuity.' },
      { kri: 'open_high_risks',          kpi: 'risks_reviewed_pct',       impact: 'High risks not reviewed on schedule may escalate undetected.' },
      { kri: 'assets_critical_vuln_pct', kpi: 'scan_coverage_30d',        impact: 'A high percentage indicates a broad attack surface with multiple critical exposure points.' },
      { kri: 'avg_vuln_age_days',        kpi: 'mttr_days',                impact: 'Old open vulnerabilities signal slow remediation cycles and increasing financial exposure.' },
    ];

    const summary = {
      total_kris:   metrics.filter(m => m.metric_type === 'kri').length,
      total_kpis:   metrics.filter(m => m.metric_type === 'kpi').length,
      kri_red:      metrics.filter(m => m.metric_type === 'kri' && m.status === 'red').length,
      kri_amber:    metrics.filter(m => m.metric_type === 'kri' && m.status === 'amber').length,
      kri_green:    metrics.filter(m => m.metric_type === 'kri' && m.status === 'green').length,
      kpi_red:      metrics.filter(m => m.metric_type === 'kpi' && m.status === 'red').length,
      kpi_amber:    metrics.filter(m => m.metric_type === 'kpi' && m.status === 'amber').length,
      kpi_green:    metrics.filter(m => m.metric_type === 'kpi' && m.status === 'green').length,
    };

    res.json({ metrics, linkage, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/metrics/snapshot — save a snapshot (can be called by cron) ──

router.post('/snapshot', auth, requireRole('admin'), async (req, res) => {
  try {
    const values = await computeMetrics();
    const rows   = Object.entries(values).map(([k, v]) => `('${k}', ${v}, NOW())`).join(',');
    await db.query(`INSERT INTO metric_snapshots (metric_key, value, snapped_at) VALUES ${rows}`);
    res.json({ snapped: Object.keys(values).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/metrics/thresholds/:key — update a threshold ──

router.patch('/thresholds/:key', auth, requireRole('admin'), async (req, res) => {
  const { target_value, warning_threshold, critical_threshold } = req.body;
  try {
    const r = await db.query(`
      UPDATE metric_thresholds
      SET target_value       = COALESCE($2, target_value),
          warning_threshold  = COALESCE($3, warning_threshold),
          critical_threshold = COALESCE($4, critical_threshold),
          updated_at         = NOW()
      WHERE metric_key = $1
      RETURNING *
    `, [req.params.key, target_value ?? null, warning_threshold ?? null, critical_threshold ?? null]);
    if (!r.rows.length) return res.status(404).json({ error: 'Metric not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.computeMetrics = computeMetrics;
