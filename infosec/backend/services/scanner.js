/**
 * InfoSec Scanner Service
 * Performs network scans, detects services, versions and maps to vulnerability rules.
 * Uses nmap under the hood (must be installed: apt install nmap)
 */

const { exec } = require('child_process');
const net = require('net');
const db = require('../db');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');
const notifier = require('./notifier');

// ── Nmap wrapper ──────────────────────────────────────────────
function nmapScan(target, options = '') {
  return new Promise((resolve, reject) => {
    // Extract timing flag from options so it overrides the default -T4
    const timingMatch = options.match(/-T[0-5]/);
    const timing = timingMatch ? timingMatch[0] : '-T4';
    const extraOpts = options.replace(/-T[0-5]/, '').trim();
    // Skip -sC and -O when -Pn light retry is used (avoids AV/IDS blocking)
    const isLightScan = extraOpts.includes('-Pn') && extraOpts.includes('--version-intensity 3');
    const cmd = isLightScan
      ? `nmap -sV ${timing} ${extraOpts} -oX - ${target}`
      : `nmap -sV -sC --version-intensity 5 ${timing} -O --osscan-guess ${extraOpts} -oX - ${target}`;
    logger.info(`Running: ${cmd}`);
    exec(cmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(`nmap failed: ${stderr}`));
      resolve(stdout);
    });
  });
}

// ── Parse nmap XML output ─────────────────────────────────────
function parseNmapXML(xml) {
  const hosts = [];
  const hostBlocks = xml.match(/<host[\s\S]*?<\/host>/g) || [];

  for (const block of hostBlocks) {
    const statusMatch  = block.match(/state="([^"]+)"/);
    if (!statusMatch || statusMatch[1] !== 'up') continue;

    const addrBlock    = block.match(/<address[^>]*addrtype="ipv4"[^>]*>/);
    const ipMatch      = addrBlock ? addrBlock[0].match(/addr="([^"]+)"/) : null;
    const macBlock     = block.match(/<address[^>]*addrtype="mac"[^>]*>/);
    const macMatch     = macBlock ? macBlock[0].match(/addr="([^"]+)"/) : null;
    const hostnameM    = block.match(/hostname name="([^"]+)"/);
    const osMatch      = block.match(/<osclass[^>]*osfamily="([^"]+)"[^>]*osgen="([^"]*)"/);
    const osNameM      = block.match(/<osmatch[^>]*name="([^"]+)"/);

    const host = {
      ip: ipMatch ? ipMatch[1] : null,
      mac: macMatch ? macMatch[1] : null,
      hostname: hostnameM ? hostnameM[1] : null,
      os_name: osNameM ? osNameM[1] : (osMatch ? `${osMatch[1]} ${osMatch[2]}`.trim() : null),
      ports: []
    };

    const portBlocks = block.match(/<port[^>]*>[\s\S]*?<\/port>/g) || [];
    for (const pb of portBlocks) {
      const portM   = pb.match(/portid="(\d+)"/);
      const protoM  = pb.match(/protocol="([^"]+)"/);
      const stateM  = pb.match(/state="([^"]+)"/);
      const nameM   = pb.match(/name="([^"]+)"/);
      const prodM   = pb.match(/product="([^"]+)"/);
      const verM    = pb.match(/version="([^"]+)"/);
      const bannerM = pb.match(/<script[^>]*output="([^"]+)"/);
      const cpeM    = pb.match(/<cpe>([^<]+)<\/cpe>/);

      if (!portM || !stateM || stateM[1] !== 'open') continue;

      host.ports.push({
        port:     parseInt(portM[1]),
        protocol: protoM ? protoM[1] : 'tcp',
        state:    stateM[1],
        service:  nameM ? nameM[1] : null,
        product:  prodM ? prodM[1] : null,
        version:  verM  ? verM[1] : null,
        banner:   bannerM ? bannerM[1] : null,
        cpe:      cpeM ? cpeM[1] : null,
      });
    }

    if (host.ip) hosts.push(host);
  }
  return hosts;
}

// ── Fallback: raw TCP port grab (if nmap unavailable) ────────
function tcpBanner(ip, port, timeout = 3000) {
  return new Promise(resolve => {
    const sock = new net.Socket();
    let banner = '';
    sock.setTimeout(timeout);
    sock.connect(port, ip, () => sock.write('HEAD / HTTP/1.0\r\n\r\n'));
    sock.on('data', d => { banner += d.toString(); sock.destroy(); });
    sock.on('close', () => resolve(banner.slice(0, 500)));
    sock.on('error', () => resolve(''));
    sock.on('timeout', () => { sock.destroy(); resolve(''); });
  });
}

function checkPortOpen(ip, port, timeout = 2000) {
  return new Promise(resolve => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.connect(port, ip, () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// ── Map service data to vulnerability rules ───────────────────
async function applyVulnRules(assetId, portData, assetValue = 50000) {
  const rules = await db.query('SELECT * FROM vuln_rules WHERE is_active = TRUE');
  const findings = [];

  for (const rule of rules.rows) {
    let matched = false;
    const c = rule.condition;

    if (c.field === 'banner' && c.match && portData.banner) {
      matched = portData.banner.toLowerCase().includes(c.match.toLowerCase());
    }

    if (c.field === 'version' && portData.version && portData.product) {
      const prodMatch = !c.product || portData.product.toLowerCase().includes(c.product.toLowerCase());
      if (prodMatch) {
        const ver = parseFloat(portData.version);
        if (c.version_lte !== undefined && !isNaN(ver)) matched = ver <= parseFloat(c.version_lte);
        if (c.version_lt  !== undefined && !isNaN(ver)) matched = ver < parseFloat(c.version_lt);
      }
    }

    if (c.port && !c.field) {
      matched = portData.port === c.port;
    }

    if (matched) {
      // Severity → CVSS/EF/ARO mapping
      const efMap  = { critical: 80, high: 60, medium: 40, low: 20, informational: 5 };
      const aroMap = { critical: 0.9, high: 0.5, medium: 0.25, low: 0.1, informational: 0.05 };
      const ef     = efMap[rule.severity] || 30;
      const aro    = aroMap[rule.severity] || 0.1;

      findings.push({
        asset_id:       assetId,
        vuln_type:      rule.category,
        title:          rule.name,
        description:    rule.description,
        cve_id:         rule.cve_id,
        cvss_score:     rule.cvss_score,
        severity:       rule.severity,
        risk_level:     rule.severity === 'informational' ? 'low' : rule.severity,
        evidence:       `Port ${portData.port}/${portData.protocol} | Product: ${portData.product || 'unknown'} | Version: ${portData.version || 'unknown'} | Banner: ${(portData.banner || '').slice(0,200)}`,
        remediation:    rule.remediation,
        asset_value:    assetValue,
        exposure_factor: ef,
        aro:            aro,
        detected_by:    'scanner',
      });
    }
  }
  return findings;
}

// ── Save or update asset ──────────────────────────────────────
async function upsertAsset(host) {
  const existing = await db.query('SELECT id, asset_value FROM assets WHERE ip_address = $1', [host.ip]);
  if (existing.rows.length > 0) {
    await db.query(`
      UPDATE assets SET
        hostname = COALESCE($2, hostname),
        mac_address = COALESCE($3, mac_address),
        os_name = COALESCE($4, os_name),
        last_seen = NOW(), last_scanned = NOW(), status = 'active'
      WHERE ip_address = $1
    `, [host.ip, host.hostname, host.mac, host.os_name]);
    return { id: existing.rows[0].id, asset_value: existing.rows[0].asset_value, isNew: false };
  }
  const res = await db.query(`
    INSERT INTO assets (ip_address, hostname, mac_address, os_name, asset_value, status)
    VALUES ($1, $2, $3, $4, 50000, 'active') RETURNING id, asset_value
  `, [host.ip, host.hostname, host.mac, host.os_name]);
  return { id: res.rows[0].id, asset_value: res.rows[0].asset_value, isNew: true };
}

// ── Save port data + track changes ───────────────────────────
async function upsertPort(assetId, port, scanJobId) {
  // Record history: was this port there before?
  const existing = await db.query(
    'SELECT id, service, product, version FROM asset_ports WHERE asset_id=$1 AND port=$2 AND protocol=$3',
    [assetId, port.port, port.protocol]
  );

  if (existing.rows.length === 0) {
    // New port discovered
    await db.query(`
      INSERT INTO asset_history (asset_id, scan_job_id, change_type, new_value, details)
      VALUES ($1,$2,'port_added',$3,$4)
    `, [assetId, scanJobId || null, `${port.port}/${port.protocol}`,
        JSON.stringify({ port: port.port, protocol: port.protocol, service: port.service, product: port.product, version: port.version })]);
  } else {
    const old = existing.rows[0];
    const oldSvc = `${old.product || ''}/${old.version || ''}`;
    const newSvc = `${port.product || ''}/${port.version || ''}`;
    if (oldSvc !== newSvc && (port.product || port.version)) {
      await db.query(`
        INSERT INTO asset_history (asset_id, scan_job_id, change_type, field, old_value, new_value)
        VALUES ($1,$2,'service_changed','service',$3,$4)
      `, [assetId, scanJobId || null, oldSvc, newSvc]);
    }
  }

  await db.query('DELETE FROM asset_ports WHERE asset_id = $1 AND port = $2 AND protocol = $3',
    [assetId, port.port, port.protocol]);
  const res = await db.query(`
    INSERT INTO asset_ports (asset_id, port, protocol, service, product, version, state, banner, cpe)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
  `, [assetId, port.port, port.protocol, port.service, port.product, port.version, port.state, port.banner, port.cpe]);
  return res.rows[0].id;
}

// ── Save vulnerability ────────────────────────────────────────
async function saveVuln(vuln) {
  const existing = await db.query(
    `SELECT id FROM vulnerabilities WHERE asset_id=$1 AND title=$2 AND status NOT IN ('closed','false_positive')`,
    [vuln.asset_id, vuln.title]
  );
  if (existing.rows.length > 0) {
    await db.query('UPDATE vulnerabilities SET detected_at=NOW(), updated_at=NOW() WHERE id=$1', [existing.rows[0].id]);
    return existing.rows[0].id;
  }
  const res = await db.query(`
    INSERT INTO vulnerabilities
      (asset_id, vuln_type, title, description, cve_id, cvss_score, severity, risk_level,
       evidence, remediation, asset_value, exposure_factor, aro, detected_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id
  `, [vuln.asset_id, vuln.vuln_type, vuln.title, vuln.description, vuln.cve_id,
      vuln.cvss_score, vuln.severity, vuln.risk_level, vuln.evidence, vuln.remediation,
      vuln.asset_value, vuln.exposure_factor, vuln.aro, vuln.detected_by]);
  
  // Auto-create risk register entry for high/critical
  if (['critical','high'].includes(vuln.severity)) {
    const likeMap = { critical: 4, high: 3 };
    const impMap  = { critical: 5, high: 4 };
    await db.query(`
      INSERT INTO risks (title, description, asset_id, vulnerability_id, likelihood, impact, category, treatment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'mitigate')
      ON CONFLICT DO NOTHING
    `, [`Auto: ${vuln.title}`, vuln.description, vuln.asset_id, res.rows[0].id,
        likeMap[vuln.severity] || 3, impMap[vuln.severity] || 4, vuln.vuln_type]);
  }
  return res.rows[0].id;
}

// ── Main public API ───────────────────────────────────────────

async function runScan(target, scanJobId, options = {}) {
  const client = await db.connect();
  let hostsScanned = 0, vulnsFound = 0, assetsFound = 0;

  try {
    await client.query(`UPDATE scan_jobs SET status='running', started_at=NOW() WHERE id=$1`, [scanJobId]);

    let hosts = [];
    try {
      const nmapArgs = options.nmapArgs || '';
      const xml = await nmapScan(target, nmapArgs);
      hosts = parseNmapXML(xml);
      logger.info(`Nmap found ${hosts.length} hosts for target ${target}`);

      // If no hosts found and -Pn wasn't already used, retry with a lighter
      // command: skip host discovery, no scripts, no OS detection.
      // (common in networks where ICMP or aggressive probes are firewalled)
      if (hosts.length === 0 && !nmapArgs.includes('-Pn')) {
        logger.info(`No hosts found, retrying with -Pn + light scan for ${target}`);
        const timingMatch2 = nmapArgs.match(/-T[0-5]/);
        const timing2 = timingMatch2 ? timingMatch2[0] : '-T4';
        const lightCmd = `${timing2} -Pn --version-intensity 3`;
        const xml2 = await nmapScan(target, lightCmd);
        hosts = parseNmapXML(xml2);
        logger.info(`Light -Pn retry found ${hosts.length} hosts for target ${target}`);
      }
    } catch (e) {
      logger.warn(`Nmap unavailable (${e.message}), falling back to TCP scan`);
      // Fallback: scan common ports on single IP
      const commonPorts = [21,22,23,25,80,443,3306,5432,27017,6379,3389,5900,8080,8443,445,161];
      const portResults = [];
      for (const port of commonPorts) {
        const open = await checkPortOpen(target, port);
        if (open) {
          const banner = await tcpBanner(target, port);
          portResults.push({ port, protocol: 'tcp', state: 'open', service: null, product: null, version: null, banner, cpe: null });
        }
      }
      if (portResults.length > 0) {
        hosts = [{ ip: target, mac: null, hostname: null, os_name: null, ports: portResults }];
      }
    }

    // Detect removed ports (ports that existed before but weren't found in this scan)
    const newPortSignatures = new Set(hosts.flatMap(h => h.ports.map(p => `${p.port}/${p.protocol}`)));

    for (const host of hosts) {
      hostsScanned++;
      const { id: assetId, asset_value, isNew } = await upsertAsset(host);
      if (isNew) {
        assetsFound++;
        await db.query(`
          INSERT INTO asset_history (asset_id, scan_job_id, change_type, new_value)
          VALUES ($1,$2,'first_seen',$3)
        `, [assetId, scanJobId, host.ip]);
      }

      // Track removed ports
      const prevPorts = await db.query(
        `SELECT port, protocol, service FROM asset_ports WHERE asset_id=$1`, [assetId]
      );
      for (const pp of prevPorts.rows) {
        const sig = `${pp.port}/${pp.protocol}`;
        if (!newPortSignatures.has(sig)) {
          await db.query(`
            INSERT INTO asset_history (asset_id, scan_job_id, change_type, old_value)
            VALUES ($1,$2,'port_removed',$3)
          `, [assetId, scanJobId, sig]);
        }
      }

      for (const port of host.ports) {
        const portId = await upsertPort(assetId, port, scanJobId);
        const findings = await applyVulnRules(assetId, { ...port, portId }, asset_value);
        for (const vuln of findings) {
          const vulnId = await saveVuln(vuln);
          vulnsFound++;
          // Send notification for critical/high vulns
          notifier.notifyVuln({ ...vuln, id: vulnId, ale: vuln.asset_value * vuln.exposure_factor / 100 * vuln.aro }, host.ip)
            .catch(() => {});
        }
      }
    }

    await client.query(`
      UPDATE scan_jobs SET
        status='completed', completed_at=NOW(), progress=100,
        hosts_scanned=$2, vulns_found=$3, assets_found=$4,
        results=$5
      WHERE id=$1
    `, [scanJobId, hostsScanned, vulnsFound, assetsFound,
        JSON.stringify({ hosts: hostsScanned, vulns: vulnsFound, assets: assetsFound })]);

    logger.info(`Scan ${scanJobId} complete: ${hostsScanned} hosts, ${vulnsFound} vulns, ${assetsFound} new assets`);

    // Notify scan completion
    const scanJob = await db.query('SELECT name, target FROM scan_jobs WHERE id=$1', [scanJobId]);
    notifier.notifyScanComplete(scanJob.rows[0] || { name: null, target: '' }, { hostsScanned, vulnsFound, assetsFound })
      .catch(() => {});

  } catch (err) {
    logger.error(`Scan ${scanJobId} failed: ${err.message}`);
    await client.query(
      `UPDATE scan_jobs SET status='failed', error_message=$2, completed_at=NOW() WHERE id=$1`,
      [scanJobId, err.message]
    );
  } finally {
    client.release();
  }

  return { hostsScanned, vulnsFound, assetsFound };
}

async function quickScan(ip) {
  const job = await db.query(
    `INSERT INTO scan_jobs (name, scan_type, target, status) VALUES ($1,'service',$2,'pending') RETURNING id`,
    [`Auto scan ${ip}`, ip]
  );
  return runScan(ip, job.rows[0].id);
}

module.exports = { runScan, quickScan, parseNmapXML, nmapScan };
