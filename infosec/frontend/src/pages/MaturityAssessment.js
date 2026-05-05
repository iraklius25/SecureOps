import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../App';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Cell, ResponsiveContainer,
} from 'recharts';

/* ─── Maturity levels ─────────────────────────────────────── */
const MATURITY_LEVELS = [
  { level: 1, label: 'Initial',    color: '#ef4444', desc: 'Ad-hoc, no formal processes — corresponds to NC (Non-Conformant)' },
  { level: 2, label: 'Developing', color: '#f97316', desc: 'Some processes defined, inconsistently applied — NC trending to PC' },
  { level: 3, label: 'Defined',    color: '#eab308', desc: 'Standardized processes, consistently applied — PC (Partially Conformant)' },
  { level: 4, label: 'Managed',    color: '#22c55e', desc: 'Quantitatively measured and controlled — C (Conformant)' },
  { level: 5, label: 'Optimizing', color: '#3b82f6', desc: 'Continuous improvement and innovation-driven — C+ (Exceeds requirement)' },
];

/* ─── ISMS (ISO 27001:2022) flat domains ─────────────────── */
const ISMS_DOMAINS = [
  { id: 'isms_4', clause: '4',  short: 'Context',     name: 'Context of Organization',  desc: 'Organization context, interested parties, ISMS scope, and ISMS establishment' },
  { id: 'isms_5', clause: '5',  short: 'Leadership',  name: 'Leadership',               desc: 'Top management commitment, information security policy, and ISMS roles & responsibilities' },
  { id: 'isms_6', clause: '6',  short: 'Planning',    name: 'Planning',                 desc: 'Information security risk assessment, risk treatment plans, and ISMS objectives' },
  { id: 'isms_7', clause: '7',  short: 'Support',     name: 'Support',                  desc: 'Resources, competence, awareness, communication, and documented information' },
  { id: 'isms_8', clause: '8',  short: 'Operation',   name: 'Operation',                desc: 'Operational planning and control; information security risk assessment and treatment execution' },
  { id: 'isms_9', clause: '9',  short: 'Performance', name: 'Performance Evaluation',   desc: 'Monitoring, measurement, analysis, internal audit, and management review' },
  { id: 'isms_10', clause: '10', short: 'Improvement', name: 'Improvement',             desc: 'Nonconformity handling, corrective actions, and continual improvement of the ISMS' },
];

/* ─── ISO 42001 hierarchical sections (Clauses 4–10) ───────── */
const ISO42001_SECTIONS = [
  {
    id: 'c4', clause: '4', name: 'Context of Organization', short: 'Context', color: '#6366f1',
    items: [
      { id: '4.1', name: 'Understanding the Organization & Context',
        desc: 'Formal context analysis (PESTLE) documenting internal and external issues that affect the AIMS; legal, regulatory, and market environment assessed' },
      { id: '4.2', name: 'Interested Parties',
        desc: 'Stakeholder register identifying all interested parties (board, staff, customers, regulators, CB, suppliers) with needs and expectations documented' },
      { id: '4.3', name: 'AIMS Scope Definition',
        desc: 'Documented AIMS scope covering in-scope AI systems, locations, and functions; exclusions justified; scope approved by sponsor' },
      { id: '4.4', name: 'AIMS Establishment & Maintenance',
        desc: 'AIMS formally established, implemented, maintained, and continually improved per ISO/IEC 42001:2023 requirements' },
    ],
  },
  {
    id: 'c5', clause: '5', name: 'Leadership', short: 'Leadership', color: '#f59e0b',
    items: [
      { id: '5.1', name: 'Leadership & Commitment',
        desc: 'AIMS Steering Committee active; executive sponsor appointed; resources allocated; governance charter approved; management review conducted' },
      { id: '5.2', name: 'AI Policy',
        desc: 'AI Policy drafted, reviewed by legal, approved by top management, communicated to all staff, and reviewed annually — covers 8 AI principles (FH-AIMS-040)' },
      { id: '5.3', name: 'Roles, Responsibilities & Authorities',
        desc: 'RACI matrix (FH-AIMS-021) defined; AIMS PM, AI Ethics Officer, and Working Group formally appointed; authority levels for AI risk acceptance documented' },
    ],
  },
  {
    id: 'c6', clause: '6', name: 'Planning', short: 'Planning', color: '#10b981',
    items: [
      { id: '6.1.1', name: 'Risk & Opportunity Identification',
        desc: 'AI-specific risks identified across 10 risk categories (R1–R10: Data Quality, Model Performance, Transparency, Privacy, Security, Human Oversight, Legal, Third-Party, Ethical, Operational)' },
      { id: '6.1.2', name: 'AI Risk Assessment',
        desc: '5×5 Likelihood × Impact matrix applied; AI impact assessments completed per system; EU AI Act risk tier (Unacceptable / High / Limited / Minimal) classified for each AI system' },
      { id: '6.1.3', name: 'AI Risk Treatment',
        desc: 'Risk treatment plans approved for all High/Critical risks; treatment options (Mitigate/Accept/Transfer/Avoid) documented; residual risk within appetite before deployment' },
      { id: '6.2', name: 'AIMS Objectives & KPIs',
        desc: 'Six SMART objectives (OBJ-1 to OBJ-6) defined covering certification readiness, AI inventory, regulatory compliance, competence, risk reduction, and ethical AI; KPI dashboard reviewed quarterly' },
    ],
  },
  {
    id: 'c7', clause: '7', name: 'Support', short: 'Support', color: '#3b82f6',
    items: [
      { id: '7.1', name: 'Resources',
        desc: 'AIMS budget approved; AIMS PM allocated ≥50% FTE; IT, Legal, HR, and Ethics Officer resources formally committed to AIMS' },
      { id: '7.2', name: 'Competence',
        desc: 'Competence framework defined by role; training gaps assessed; records maintained; AI development and ethics competences verified' },
      { id: '7.3', name: 'Awareness',
        desc: '100% of in-scope staff completed ISO 42001 awareness training; AI ethics training completed; training effectiveness assessed; records current' },
      { id: '7.4', name: 'Communication',
        desc: 'AIMS communication plan active; internal and external AI communication managed; stakeholder updates on schedule' },
      { id: '7.5', name: 'Documented Information',
        desc: 'Document control procedure applied to all AIMS records; version control in place; retention periods defined; records accessible to auditors' },
    ],
  },
  {
    id: 'c8', clause: '8', name: 'Operation', short: 'Operation', color: '#ec4899',
    items: [
      { id: '8.1', name: 'Operational Planning & Control',
        desc: 'AI operational controls implemented and followed; AI lifecycle procedure (FH-AIMS-051) covers all stages from design through retirement' },
      { id: '8.2', name: 'AI System Impact Assessment',
        desc: '100% of AI systems have completed impact assessments; EU AI Act risk tier classified; high-risk systems have enhanced controls; assessments approved by Ethics Officer' },
      { id: '8.3', name: 'AI System Lifecycle Management',
        desc: 'Lifecycle procedure covers: objectives → data → design → development → validation → testing → deployment → monitoring → change management → retirement' },
      { id: '8.4', name: 'Data Governance for AI',
        desc: 'Data quality, provenance, and privacy controls applied to AI training and operational data; GDPR lawful basis documented for each dataset processing personal data' },
      { id: '8.5', name: 'AI Suppliers & Third Parties',
        desc: 'AI vendor due diligence completed; 100% of AI vendor contracts include AI-specific clauses; third-party model risks assessed and managed' },
    ],
  },
  {
    id: 'c9', clause: '9', name: 'Performance Evaluation', short: 'Performance', color: '#14b8a6',
    items: [
      { id: '9.1', name: 'Monitoring, Measurement & Analysis',
        desc: 'AIMS KPIs (OBJ-1 to OBJ-6) monitored and reported to Steering Committee quarterly; AI incident tracking active; drift detection and model performance monitoring in place' },
      { id: '9.2', name: 'Internal Audit',
        desc: 'Annual internal audit programme covers all AIMS clauses (IA-1 to IA-6); auditors qualified and independent; findings reported within 5 business days; NCs tracked to closure' },
      { id: '9.3', name: 'Management Review',
        desc: 'Steering Committee Management Review conducted at least annually (quarterly recommended); all 8 required agenda items covered; action log with owners and due dates maintained' },
    ],
  },
  {
    id: 'c10', clause: '10', name: 'Improvement', short: 'Improvement', color: '#f97316',
    items: [
      { id: '10.1', name: 'Continual Improvement',
        desc: 'Improvement register maintained; PDCA cycle embedded in AIMS; improvement items generated from audits, management reviews, and incidents tracked to closure' },
      { id: '10.2', name: 'Nonconformity & Corrective Action',
        desc: 'NC log (FH-AIMS-080) maintained; root cause analysis (5-Why or fishbone) performed; major NCs closed within 30 days; minor NCs within 60 days; recurring NCs = 0 target' },
    ],
  },
];

/* ─── ISO 42001 Annex A controls ──────────────────────────── */
const ISO42001_ANNEX_A = [
  {
    id: 'a5', clause: 'A.5', name: 'Policies', short: 'Policies', color: '#8b5cf6',
    items: [
      { id: 'A.5.1', name: 'Policies for AI',
        desc: 'AI Policy (FH-AIMS-040) and AI Ethics Policy (FH-AIMS-041) approved by top management, published, and communicated to all staff' },
      { id: 'A.5.2', name: 'AI Risk Management Policy',
        desc: 'Risk management methodology (FH-AIMS-030) embedded in AIMS; risk appetite statement approved; 5×5 matrix in use' },
    ],
  },
  {
    id: 'a6', clause: 'A.6', name: 'Internal Organization', short: 'Org.', color: '#0ea5e9',
    items: [
      { id: 'A.6.1', name: 'Roles & Responsibilities for AI',
        desc: 'RACI matrix (FH-AIMS-021) approved; AIMS PM, Ethics Officer, Steering Committee, and Working Group formally established and active' },
      { id: 'A.6.2', name: 'Segregation of Duties',
        desc: 'AI development, review, ethics assessment, and deployment approval roles segregated; no single person approves their own AI system' },
      { id: 'A.6.3', name: 'Reporting of AI Concerns',
        desc: 'Mechanism in place for staff to report AI ethics concerns or policy violations; whistleblowing channel referenced in AI Ethics Policy' },
    ],
  },
  {
    id: 'a7', clause: 'A.7', name: 'Human Resources', short: 'HR', color: '#f43f5e',
    items: [
      { id: 'A.7.1', name: 'Screening',
        desc: 'Background screening applied to roles with privileged access to AI systems, sensitive training data, or AI decision-making processes' },
      { id: 'A.7.2', name: 'Terms & Conditions of Employment',
        desc: 'AI responsibilities, ethical use obligations, and AIMS policy compliance included in employment contracts and contractor agreements' },
      { id: 'A.7.3', name: 'AI Awareness, Education & Training',
        desc: 'Role-specific AI training delivered (awareness, ethics, technical); effectiveness assessed; records maintained; 100% completion tracked per OBJ-4' },
    ],
  },
  {
    id: 'a8', clause: 'A.8', name: 'Asset Management', short: 'Assets', color: '#d97706',
    items: [
      { id: 'A.8.1', name: 'Inventory of AI Systems',
        desc: 'Complete AI system inventory (FH-AIMS-050) maintained; reviewed quarterly; covers all AI types (GenAI, ML-Pred, NLP, CV, RPA-AI, Analytics); EU AI Act tier classified per system' },
      { id: 'A.8.2', name: 'Use of AI Systems',
        desc: 'Acceptable use guidelines for AI systems published; staff know which systems are approved; unauthorized AI tool use addressed in AI Policy' },
      { id: 'A.8.3', name: 'Return or Disposal of AI Assets',
        desc: 'AI system decommissioning procedure (Lifecycle Stage 7) defined; data deletion confirmed; model retirement documented; third-party AI licenses terminated formally' },
    ],
  },
  {
    id: 'a9', clause: 'A.9', name: 'AI System Impact Assessment', short: 'Impact', color: '#059669',
    items: [
      { id: 'A.9.1', name: 'Assessing Impacts of AI Systems',
        desc: 'Impact assessment methodology (FH-T-002) applied before deployment; covers societal, individual, operational, legal, and ethical impacts; Ethics Officer sign-off required' },
      { id: 'A.9.2', name: 'Documenting AI Impact Assessments',
        desc: 'Impact assessment records maintained per AI system; approved by AIMS PM and Ethics Officer; linked to AI Risk Register and Annex A control evidence pack' },
    ],
  },
  {
    id: 'a10', clause: 'A.10', name: 'AI System Life Cycle', short: 'Lifecycle', color: '#7c3aed',
    items: [
      { id: 'A.10.1',  name: 'Objectives & Requirements',      desc: 'AI system objectives, functional requirements, and success criteria defined and documented before development begins' },
      { id: 'A.10.2',  name: 'Data for AI Systems',            desc: 'Data requirements defined; sources identified and approved; data quality baseline established' },
      { id: 'A.10.3',  name: 'AI System Design',               desc: 'Design documentation produced; explainability and fairness considered at design stage; architecture reviewed' },
      { id: 'A.10.4',  name: 'Acquiring Data for AI Systems',  desc: 'Data acquisition process controlled; licensing, provenance, and consent verified before use in training' },
      { id: 'A.10.5',  name: 'Data Preparation',               desc: 'Data cleaning, labeling, and preprocessing procedures in place; bias and representativeness checked; lineage tracked' },
      { id: 'A.10.6',  name: 'AI Model Building',              desc: 'Model development standards in place; version control applied; experiment tracking used; reproducibility ensured' },
      { id: 'A.10.7',  name: 'AI Model Validation',            desc: 'Validation tests passed before release; performance metrics meet defined thresholds; validation report signed off' },
      { id: 'A.10.8',  name: 'Testing of AI Systems',          desc: 'Functional, adversarial, bias, and edge-case testing completed; test results documented and reviewed' },
      { id: 'A.10.9',  name: 'AI System Verification',         desc: 'Independent verification performed; AI system owner sign-off obtained; deployment checklist completed' },
      { id: 'A.10.10', name: 'AI System Deployment',           desc: 'Deployment process controlled; rollback plan defined; go-live approvals on record; comms to affected staff' },
      { id: 'A.10.11', name: 'AI System Operation & Monitoring', desc: 'Production monitoring active; drift detection enabled; performance alerts configured; monitoring reports reviewed' },
      { id: 'A.10.12', name: 'Change Management for AI Systems', desc: 'Changes follow change management procedure; significant model changes trigger re-assessment and re-approval' },
      { id: 'A.10.13', name: 'Incident Management for AI Systems', desc: 'AI incident response plan defined and tested; AI incidents logged, root-caused, and reviewed; lessons applied' },
      { id: 'A.10.14', name: 'Documentation',                  desc: 'Technical and operational documentation maintained for all AI systems; version-controlled; accessible to auditors' },
      { id: 'A.10.15', name: 'Disposal of AI Systems',         desc: 'AI system retirement follows disposal procedure; data deletion confirmed in writing; decommissioning evidenced' },
    ],
  },
  {
    id: 'a11', clause: 'A.11', name: 'AI System Risk Treatment', short: 'Risk Tx', color: '#dc2626',
    items: [
      { id: 'A.11.1', name: 'Communicating AI Risk Information',
        desc: 'AI risk information communicated to relevant stakeholders; users informed of AI limitations; risk transparency requirements met for high-risk AI systems' },
    ],
  },
];

const FRAMEWORKS = {
  ISMS: {
    label: 'ISMS',
    subtitle: 'Information Security Management System — ISO/IEC 27001:2022',
    type: 'flat',
    domains: ISMS_DOMAINS,
  },
  ISO42001: {
    label: 'ISO 42001',
    subtitle: 'AI Management System — ISO/IEC 42001:2023',
    type: 'hierarchical',
    sections: ISO42001_SECTIONS,
    annexA: ISO42001_ANNEX_A,
  },
};

/* ─── Helpers ─────────────────────────────────────────────── */
function levelColor(s) { return MATURITY_LEVELS.find(m => m.level === s)?.color ?? 'var(--text3)'; }
function levelLabel(s) { return MATURITY_LEVELS.find(m => m.level === s)?.label ?? 'Not Rated'; }

function avgOfIds(data, ids) {
  const scores = ids.map(id => data?.domains?.[id]?.score || 0).filter(Boolean);
  if (!scores.length) return 0;
  return +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function computeAvg(data, fw) {
  if (fw.type === 'flat') return avgOfIds(data, fw.domains.map(d => d.id));
  const allIds = [
    ...fw.sections.flatMap(s => s.items.map(i => i.id)),
    ...fw.annexA.flatMap(s => s.items.map(i => i.id)),
  ];
  return avgOfIds(data, allIds);
}

function avgColor(avg) {
  return avg >= 4 ? '#22c55e' : avg >= 3 ? '#eab308' : avg >= 2 ? '#f97316' : avg > 0 ? '#ef4444' : 'var(--text3)';
}
function avgLabel(avg) {
  return avg >= 4.5 ? 'Optimizing' : avg >= 3.5 ? 'Managed' : avg >= 2.5 ? 'Defined' : avg >= 1.5 ? 'Developing' : avg > 0 ? 'Initial' : '—';
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function docIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'docx' || ext === 'doc') return '📄';
  if (ext === 'pptx' || ext === 'ppt') return '📊';
  if (ext === 'xlsx' || ext === 'xls') return '📋';
  return '📎';
}

/* ─── Radar Chart ─────────────────────────────────────────── */
function MaturityRadar({ data, fw, view }) {
  let chartData;
  if (fw.type === 'flat') {
    chartData = fw.domains.map(d => ({ domain: d.short, score: data?.domains?.[d.id]?.score || 0, fullMark: 5 }));
  } else if (view === 'annexa') {
    chartData = fw.annexA.map(s => ({
      domain: s.short,
      score: avgOfIds(data, s.items.map(i => i.id)),
      fullMark: 5,
    }));
  } else {
    chartData = fw.sections.map(s => ({
      domain: s.short,
      score: avgOfIds(data, s.items.map(i => i.id)),
      fullMark: 5,
    }));
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Maturity Radar</div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: 'var(--text3)', fontSize: 9 }} />
          <Radar name="Maturity" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} dot={{ r: 3, fill: '#3b82f6' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Bar Chart ───────────────────────────────────────────── */
function MaturityBars({ data, fw, view }) {
  let chartData;
  if (fw.type === 'flat') {
    chartData = fw.domains.map(d => ({ name: d.short, score: data?.domains?.[d.id]?.score || 0 }));
  } else if (view === 'annexa') {
    chartData = fw.annexA.map(s => ({
      name: s.short,
      score: avgOfIds(data, s.items.map(i => i.id)),
    }));
  } else {
    chartData = fw.sections.map(s => ({
      name: s.short,
      score: avgOfIds(data, s.items.map(i => i.id)),
    }));
  }

  const height = Math.max(180, chartData.length * 34);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Section Averages</div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 82 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 5]} ticks={[0,1,2,3,4,5]} tick={{ fill: 'var(--text3)', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={82} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
          <RTooltip
            contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 12 }}
            formatter={(v) => [v > 0 ? `${v} — ${avgLabel(v)}` : 'Not Rated', 'Average']}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.score > 0 ? avgColor(entry.score) : 'var(--bg3)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Scoring table (flat or grouped) ────────────────────── */
function DomainScorer({ data, domains, sections, onChange, readOnly }) {
  const setScore = (id, score) => {
    if (readOnly) return;
    const cur = data?.domains?.[id]?.score;
    onChange({
      ...data,
      domains: { ...data?.domains, [id]: { ...data?.domains?.[id], score: cur === score ? 0 : score } },
    });
  };
  const setNotes = (id, notes) => {
    if (readOnly) return;
    onChange({ ...data, domains: { ...data?.domains, [id]: { ...data?.domains?.[id], notes } } });
  };

  const renderItem = (item, i, isFirst) => {
    const score = data?.domains?.[item.id]?.score || 0;
    const notes = data?.domains?.[item.id]?.notes || '';
    return (
      <tr key={item.id} style={{ borderTop: isFirst ? 'none' : '1px solid var(--border)' }}>
        <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{item.clause || item.id}</td>
        <td style={{ padding: '9px 14px' }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text1)' }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>{item.desc}</div>
        </td>
        <td style={{ padding: '9px 14px' }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
            {MATURITY_LEVELS.map(ml => (
              <button
                key={ml.level}
                onClick={() => setScore(item.id, ml.level)}
                title={ml.desc}
                disabled={readOnly}
                style={{
                  width: 28, height: 28, borderRadius: 5, border: 'none',
                  cursor: readOnly ? 'default' : 'pointer',
                  fontWeight: 700, fontSize: 11, transition: 'all 0.12s',
                  background: score === ml.level ? ml.color : 'var(--bg3)',
                  color: score === ml.level ? '#fff' : 'var(--text3)',
                }}
              >{ml.level}</button>
            ))}
            <span style={{ fontSize: 10, color: score > 0 ? levelColor(score) : 'var(--text3)', fontWeight: 600, minWidth: 60, marginLeft: 4 }}>
              {score > 0 ? levelLabel(score) : 'Not Rated'}
            </span>
          </div>
        </td>
        <td style={{ padding: '9px 14px', minWidth: 140 }}>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(item.id, e.target.value)}
            readOnly={readOnly}
            placeholder={readOnly ? '' : 'Add notes…'}
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '3px 7px', color: 'var(--text1)', fontSize: 11,
            }}
          />
        </td>
      </tr>
    );
  };

  const headerRow = (section) => (
    <tr key={`hdr-${section.id}`}>
      <td colSpan={4} style={{
        padding: '8px 14px', background: 'var(--bg3)',
        borderTop: '2px solid var(--border)', borderBottom: '1px solid var(--border)',
        fontSize: 12, fontWeight: 700, color: 'var(--text1)',
      }}>
        <span style={{ color: section.color, marginRight: 8 }}>{section.clause}</span>
        {section.name}
        <span style={{ marginLeft: 10, fontWeight: 400, fontSize: 11, color: 'var(--text3)' }}>
          avg {avgOfIds(data, section.items.map(i => i.id)) || '—'} / 5
        </span>
      </td>
    </tr>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg3)' }}>
            {['Clause', 'Requirement', 'Maturity Level', 'Notes'].map(h => (
              <th key={h} style={{
                padding: '9px 14px', textAlign: h === 'Maturity Level' ? 'center' : 'left',
                fontSize: 11, color: 'var(--text3)', fontWeight: 600,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections
            ? sections.flatMap(s => [headerRow(s), ...s.items.map((item, i) => renderItem(item, i, i === 0))])
            : domains.map((d, i) => renderItem(d, i, i === 0))
          }
        </tbody>
      </table>
    </div>
  );
}

/* ─── Document section ────────────────────────────────────── */
function DocumentSection({ assessmentId }) {
  const [docs,      setDocs]      = useState([]);
  const [uploading, setUploading] = useState(false);
  const [err,       setErr]       = useState('');
  const fileRef = useRef();

  const load = useCallback(() => {
    api.get(`/maturity/${assessmentId}/documents`).then(r => setDocs(r.data)).catch(() => {});
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setErr(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/maturity/${assessmentId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async doc => {
    if (!window.confirm(`Delete "${doc.original_name}"?`)) return;
    try {
      await api.delete(`/maturity/documents/${doc.id}`);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (ex) { setErr(ex.response?.data?.error || 'Delete failed'); }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Evidence & Documents</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {err && <span style={{ fontSize: 12, color: 'var(--critical)' }}>{err}</span>}
          <input ref={fileRef} type="file" accept=".docx,.pptx,.xlsx,.doc,.ppt,.xls" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 12 }}>
            {uploading ? 'Uploading…' : '+ Upload Document'}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Accepted: .docx · .pptx · .xlsx &nbsp;(max 50 MB)</div>
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>No documents uploaded yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6 }}>
              <span style={{ fontSize: 20 }}>{docIcon(doc.original_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.original_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {fmtBytes(doc.file_size)} · {doc.uploaded_by_username || 'Unknown'} · {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => window.open(`/api/maturity/documents/${doc.id}/download`, '_blank')} style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>Download</button>
              <button className="btn btn-danger" onClick={() => handleDelete(doc)} style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Assessment Editor ───────────────────────────────────── */
function AssessmentEditor({ assessment, framework, onBack, onSaved }) {
  const fw = FRAMEWORKS[framework];
  const [name,        setName]        = useState(assessment.name);
  const [description, setDescription] = useState(assessment.description || '');
  const [data,        setData]        = useState(assessment.data || { domains: {} });
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');
  const [view,        setView]        = useState('clauses'); // 'clauses' | 'annexa'

  const save = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const r = await api.put(`/maturity/${assessment.id}`, { name, description, data });
      setSaveMsg('Saved');
      onSaved(r.data);
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (ex) { setSaveMsg(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const avg = computeAvg(data, fw);

  // Stats for ISO42001
  const clauseAvg = fw.type === 'hierarchical' ? avgOfIds(data, fw.sections.flatMap(s => s.items.map(i => i.id))) : null;
  const annexAvg  = fw.type === 'hierarchical' ? avgOfIds(data, fw.annexA.flatMap(s => s.items.map(i => i.id))) : null;
  const totalItems = fw.type === 'flat' ? fw.domains.length : fw.sections.flatMap(s => s.items).length + fw.annexA.flatMap(s => s.items).length;
  const ratedItems = fw.type === 'flat'
    ? fw.domains.filter(d => data?.domains?.[d.id]?.score > 0).length
    : [...fw.sections.flatMap(s => s.items), ...fw.annexA.flatMap(s => s.items)].filter(i => data?.domains?.[i.id]?.score > 0).length;

  const activeSections = view === 'annexa' ? fw.annexA : fw.sections;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ flexShrink: 0, marginTop: 4 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', fontSize: 17, fontWeight: 600, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text1)', paddingBottom: 4, marginBottom: 5, outline: 'none' }} />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Assessment description (optional)" style={{ display: 'block', width: '100%', fontSize: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text2)', paddingBottom: 2, outline: 'none' }} />
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Overall</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg || '—'}</div>
          <div style={{ fontSize: 10, color: avgColor(avg), marginTop: 2 }}>{avgLabel(avg)}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{ratedItems}/{totalItems} rated</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flexShrink: 0, marginTop: 4 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {saveMsg && <div className={`alert ${saveMsg === 'Saved' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{saveMsg}</div>}

      {/* Maturity legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {MATURITY_LEVELS.map(ml => (
          <div key={ml.level} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: ml.color, flexShrink: 0 }} />
            <span><strong>{ml.level}</strong> {ml.label}</span>
          </div>
        ))}
      </div>

      {/* ISO 42001 sub-view tabs */}
      {fw.type === 'hierarchical' && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[
            { key: 'clauses', label: `Clauses 4–10  (avg ${clauseAvg || '—'})` },
            { key: 'annexa',  label: `Annex A Controls / SoA  (avg ${annexAvg || '—'})` },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              padding: '7px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              borderBottom: view === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: view === t.key ? 'var(--accent)' : 'var(--text3)',
              fontWeight: view === t.key ? 600 : 400, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Scoring table */}
      {fw.type === 'flat'
        ? <DomainScorer data={data} domains={fw.domains} onChange={setData} />
        : <DomainScorer data={data} sections={activeSections} onChange={setData} />
      }

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <MaturityRadar data={data} fw={fw} view={view} />
        <MaturityBars  data={data} fw={fw} view={view} />
      </div>

      {/* Documents */}
      <div style={{ marginTop: 16 }}>
        <DocumentSection assessmentId={assessment.id} />
      </div>
    </div>
  );
}

/* ─── Assessment List ─────────────────────────────────────── */
function AssessmentList({ framework, onSelect }) {
  const fw = FRAMEWORKS[framework];
  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [creating,    setCreating]    = useState(false);
  const [err,         setErr]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/maturity?framework=${framework}`)
      .then(r => setAssessments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [framework]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true); setErr('');
    try {
      const r = await api.post('/maturity', { framework, name: newName.trim(), description: '', data: { domains: {} } });
      onSelect(r.data);
    } catch (ex) { setErr(ex.response?.data?.error || 'Create failed'); }
    finally { setCreating(false); }
  };

  const del = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? All documents will also be removed.`)) return;
    try {
      await api.delete(`/maturity/${id}`);
      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (ex) { setErr(ex.response?.data?.error || 'Delete failed'); }
  };

  const getAvg = a => computeAvg(a.data || { domains: {} }, fw);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{assessments.length} assessment{assessments.length !== 1 ? 's' : ''}</div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setNewName(''); setErr(''); }}>+ New Blank Assessment</button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>New {fw.label} Assessment</div>
          {err && <div className="alert alert-error" style={{ marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder={`e.g. Q2 2026 ${fw.label} Assessment`}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text1)', fontSize: 13 }}
            />
            <button className="btn btn-primary" onClick={create} disabled={creating || !newName.trim()}>{creating ? 'Creating…' : 'Create'}</button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Loading…</div>
      ) : assessments.length === 0 && !showCreate ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 6 }}>No assessments yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>
            {framework === 'ISO42001'
              ? 'Score all Clauses 4–10 and Annex A controls (26 controls, FH-AIMS-052 SoA) or upload existing evidence documents'
              : 'Create a blank assessment and score each ISO 27001 clause, or upload existing evidence documents'}
          </div>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setNewName(''); }}>+ New Blank Assessment</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assessments.map(a => {
            const avg = getAvg(a);
            return (
              <div key={a.id} onClick={() => onSelect(a)} className="card" style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)' }}>{a.name}</div>
                  {a.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{a.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Updated {new Date(a.updated_at).toLocaleDateString()}</div>
                </div>
                {avg > 0 ? (
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg}</div>
                    <div style={{ fontSize: 10, color: avgColor(avg) }}>{avgLabel(avg)}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>Not started</div>
                )}
                <button className="btn btn-danger" onClick={e => del(a.id, a.name, e)} style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function MaturityAssessment() {
  const [framework, setFramework] = useState('ISMS');
  const [selected,  setSelected]  = useState(null);

  useEffect(() => { setSelected(null); }, [framework]);

  const handleSelect = async a => {
    try { const r = await api.get(`/maturity/${a.id}`); setSelected(r.data); }
    catch { setSelected(a); }
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 2 }}>Maturity Assessment</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{FRAMEWORKS[framework].subtitle}</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {Object.entries(FRAMEWORKS).map(([key, fw]) => (
          <button key={key} onClick={() => setFramework(key)} style={{
            padding: '8px 22px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            borderBottom: framework === key ? '2px solid var(--accent)' : '2px solid transparent',
            color: framework === key ? 'var(--accent)' : 'var(--text3)',
            fontWeight: framework === key ? 600 : 400,
            marginBottom: -1, transition: 'color 0.15s',
          }}>{fw.label}</button>
        ))}
      </div>

      {selected ? (
        <AssessmentEditor
          key={selected.id}
          assessment={selected}
          framework={framework}
          onBack={() => setSelected(null)}
          onSaved={updated => setSelected(updated)}
        />
      ) : (
        <AssessmentList key={framework} framework={framework} onSelect={handleSelect} />
      )}
    </div>
  );
}
