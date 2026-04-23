import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../App';

const CRIT_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const CRIT_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

function getSubnet(ip) {
  if (!ip) return 'Unknown';
  const parts = ip.split('.');
  if (parts.length < 3) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
}

function getRadius(vulnCount) {
  return Math.min(22 + (vulnCount || 0) * 3, 44);
}

function Tooltip({ item, x, y }) {
  if (!item) return null;
  const w = 220;
  return (
    <foreignObject x={x + 12} y={y - 10} width={w} height={140} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          background: 'rgba(20,20,30,0.97)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '10px 13px',
          fontSize: 12,
          color: '#e6edf3',
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: 180,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, fontFamily: 'monospace', color: '#79c0ff' }}>{item.ip_address}</div>
        {item.hostname && <div style={{ marginBottom: 3 }}>Host: <strong>{item.hostname}</strong></div>}
        {item.os_name && <div style={{ marginBottom: 3 }}>OS: <strong>{item.os_name}</strong></div>}
        <div style={{ marginBottom: 3 }}>Criticality: <strong style={{ color: CRIT_COLOR[item.criticality] || '#aaa' }}>{item.criticality || 'unknown'}</strong></div>
        <div>Open Vulns: <strong style={{ color: item.open_vulns > 0 ? '#f97316' : '#22c55e' }}>{item.open_vulns || 0}</strong></div>
      </div>
    </foreignObject>
  );
}

export default function Topology() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null); // { item, x, y }
  const svgRef = useRef(null);

  // Zoom/pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  const dragging = useRef(false);
  const dragStart = useRef(null);

  useEffect(() => {
    api.get('/assets', { params: { limit: 500 } })
      .then(r => setAssets(r.data.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group assets by /24 subnet
  const subnets = {};
  for (const asset of assets) {
    const sub = getSubnet(asset.ip_address);
    if (!subnets[sub]) subnets[sub] = [];
    subnets[sub].push(asset);
  }

  // Layout subnets in a grid
  const subnetKeys = Object.keys(subnets);
  const COLS = Math.max(1, Math.ceil(Math.sqrt(subnetKeys.length)));
  const SUBNET_W = 300;
  const SUBNET_PAD = 30;
  const ASSET_SPACING = 70;

  const subnetLayouts = subnetKeys.map((sub, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const items = subnets[sub];
    const rowsNeeded = Math.ceil(items.length / 3);
    const h = Math.max(120, SUBNET_PAD * 2 + rowsNeeded * ASSET_SPACING);
    return {
      subnet: sub,
      items,
      x: col * (SUBNET_W + 40) + 20,
      y: row * 260 + 20,
      w: SUBNET_W,
      h,
    };
  });

  const totalW = Math.max(1200, COLS * (SUBNET_W + 40) + 60);
  const totalH = Math.max(800, (Math.ceil(subnetKeys.length / COLS)) * 280 + 60);

  // Mouse wheel zoom
  const handleWheel = useCallback(e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.9;
    setViewBox(vb => ({
      x: vb.x, y: vb.y,
      w: Math.max(400, Math.min(3000, vb.w * factor)),
      h: Math.max(300, Math.min(3000, vb.h * factor)),
    }));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = e => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, vb: { ...viewBox } };
  };
  const onMouseMove = e => {
    if (!dragging.current || !dragStart.current) return;
    const { mx, my, vb } = dragStart.current;
    const el = svgRef.current;
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = vb.w / rect.width;
    const scaleY = vb.h / rect.height;
    setViewBox({ ...vb, x: vb.x - (e.clientX - mx) * scaleX, y: vb.y - (e.clientY - my) * scaleY });
  };
  const onMouseUp = () => { dragging.current = false; dragStart.current = null; };

  const resetView = () => setViewBox({ x: 0, y: 0, w: totalW, h: totalH });

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  if (assets.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div><div className="page-title">Network Topology Map</div></div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🗺</div>
          <p>No assets found. Discover assets using a scan to populate the topology map.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Network Topology Map</div>
          <div className="page-subtitle">{assets.length} assets across {subnetKeys.length} subnets — scroll to zoom, drag to pan</div>
        </div>
        <button className="btn btn-secondary" onClick={resetView}>Reset View</button>
      </div>

      {/* Legend */}
      <div className="card" style={{ padding: '10px 16px', marginBottom: 12, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</span>
        {Object.entries(CRIT_COLOR).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: c }} />
            <span style={{ fontSize: 12 }}>{CRIT_LABEL[k]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#aaa', display: 'inline-block' }} />
          <span style={{ fontSize: 12 }}>small = 0 vulns</span>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#aaa', display: 'inline-block', marginLeft: 8 }} />
          <span style={{ fontSize: 12 }}>large = many vulns</span>
          <span style={{ fontSize: 12, marginLeft: 8, color: 'var(--text3)' }}>(number = open vuln count)</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: 600 }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{ background: 'var(--bg2)', cursor: dragging.current ? 'grabbing' : 'grab', display: 'block' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Subnet rectangles */}
          {subnetLayouts.map(sl => (
            <g key={sl.subnet}>
              <rect
                x={sl.x}
                y={sl.y}
                width={sl.w}
                height={sl.h}
                rx={10}
                ry={10}
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1.5}
              />
              <text
                x={sl.x + 14}
                y={sl.y + 20}
                fontSize={12}
                fill="rgba(255,255,255,0.5)"
                fontFamily="monospace"
                fontWeight="600"
              >
                {sl.subnet} ({sl.items.length} asset{sl.items.length !== 1 ? 's' : ''})
              </text>

              {/* Asset circles */}
              {sl.items.map((asset, idx) => {
                const col = idx % 3;
                const row = Math.floor(idx / 3);
                const cx = sl.x + 50 + col * ASSET_SPACING;
                const cy = sl.y + 55 + row * ASSET_SPACING;
                const r = getRadius(asset.open_vulns || 0);
                const fill = CRIT_COLOR[asset.criticality] || '#6b7280';
                const isHovered = tooltip?.item?.id === asset.id;

                return (
                  <g key={asset.id}>
                    <circle
                      cx={cx} cy={cy} r={r}
                      fill={fill}
                      fillOpacity={isHovered ? 1 : 0.8}
                      stroke={isHovered ? '#fff' : 'rgba(255,255,255,0.25)'}
                      strokeWidth={isHovered ? 2 : 1}
                      style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                      onMouseEnter={e => {
                        const svgRect = svgRef.current?.getBoundingClientRect();
                        if (!svgRect) return;
                        const scaleX = viewBox.w / svgRect.width;
                        const scaleY = viewBox.h / svgRect.height;
                        const svgX = (e.clientX - svgRect.left) * scaleX + viewBox.x;
                        const svgY = (e.clientY - svgRect.top) * scaleY + viewBox.y;
                        setTooltip({ item: asset, x: svgX, y: svgY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Vuln count label */}
                    {(asset.open_vulns || 0) > 0 && (
                      <text
                        x={cx} y={cy + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={r > 30 ? 13 : 10}
                        fontWeight="700"
                        fill="#fff"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {asset.open_vulns}
                      </text>
                    )}
                    {/* IP label below */}
                    <text
                      x={cx} y={cy + r + 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill="rgba(255,255,255,0.5)"
                      fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {asset.ip_address?.split('.').slice(-1)[0]}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}

          {/* Tooltip */}
          {tooltip && <Tooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} />}
        </svg>
      </div>
    </div>
  );
}
