import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';

const PLAN_STATUSES = [
  { id: 'draft',    label: 'Draft',    color: '#6b7280' },
  { id: 'review',   label: 'Review',   color: '#f59e0b' },
  { id: 'approved', label: 'Approved', color: '#3b82f6' },
  { id: 'active',   label: 'Active',   color: '#10b981' },
  { id: 'retired',  label: 'Retired',  color: '#9ca3af' },
];

const CLASSIFICATIONS = ['public','internal','confidential','restricted'];

const CRITICALITY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const TEST_RESULT_COLORS  = { passed: '#10b981', partial: '#f59e0b', failed: '#ef4444', not_tested: '#6b7280' };

const STRATEGY_TYPES = ['operational','technical','communication','people','supplier','facility'];
const TEST_TYPES_BCP = ['tabletop','walkthrough','simulation','full_interruption','parallel'];

const planStatInfo = id => PLAN_STATUSES.find(s => s.id === id) || PLAN_STATUSES[0];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ label, color }) {
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: color + '22', color, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function CritBadge({ val }) {
  const c = CRITICALITY_COLORS[val] || '#6b7280';
  return <Badge label={val} color={c} />;
}

function ResultBadge({ val }) {
  const c = TEST_RESULT_COLORS[val] || '#6b7280';
  return <Badge label={val?.replace('_', ' ') || '—'} color={c} />;
}

/* ── Plan Modal ─────────────────────────────────────────────────── */
const PLAN_EMPTY = {
  org_id: '', name: '', version: '1.0', scope: '', objectives: '', status: 'draft',
  classification: 'confidential', owner: '', approved_by: '', approved_date: '',
  review_date: '', next_test_date: '', last_tested: '', test_result: '',
  iso_clause_ref: '', frameworks: '', notes: '',
};

function PlanModal({ plan, orgs, onClose, onSaved }) {
  const editing = !!plan;
  const [form, setForm] = useState(() => plan ? {
    org_id:         plan.org_id         || '',
    name:           plan.name           || '',
    version:        plan.version        || '1.0',
    scope:          plan.scope          || '',
    objectives:     plan.objectives     || '',
    status:         plan.status         || 'draft',
    classification: plan.classification || 'confidential',
    owner:          plan.owner          || '',
    approved_by:    plan.approved_by    || '',
    approved_date:  plan.approved_date  ? plan.approved_date.slice(0, 10) : '',
    review_date:    plan.review_date    ? plan.review_date.slice(0, 10)   : '',
    next_test_date: plan.next_test_date ? plan.next_test_date.slice(0, 10): '',
    last_tested:    plan.last_tested    ? plan.last_tested.slice(0, 10)   : '',
    test_result:    plan.test_result    || '',
    iso_clause_ref: plan.iso_clause_ref || '',
    frameworks:     Array.isArray(plan.frameworks) ? plan.frameworks.join(', ') : (plan.frameworks || ''),
    notes:          plan.notes          || '',
  } : { ...PLAN_EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.name.trim()) return setErr('Name is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        org_id:         form.org_id         || null,
        approved_date:  form.approved_date  || null,
        review_date:    form.review_date    || null,
        next_test_date: form.next_test_date || null,
        last_tested:    form.last_tested    || null,
        test_result:    form.test_result    || null,
        frameworks:     form.frameworks ? form.frameworks.split(',').map(f => f.trim()).filter(Boolean) : null,
      };
      if (editing) {
        const r = await api.put(`/bcp/${plan.id}`, payload);
        onSaved(r.data, 'edit');
      } else {
        const r = await api.post('/bcp', payload);
        onSaved(r.data, 'create');
      }
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit BCP Plan' : 'New BCP Plan'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Plan Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. IT Business Continuity Plan 2026" required />
            </div>
            <div className="form-group">
              <label>Organization</label>
              <select value={form.org_id} onChange={set('org_id')}>
                <option value="">— Not linked —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Version</label>
              <input value={form.version} onChange={set('version')} placeholder="1.0" />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={set('status')}>
                {PLAN_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Classification</label>
              <select value={form.classification} onChange={set('classification')}>
                {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Owner</label>
              <input value={form.owner} onChange={set('owner')} placeholder="Plan owner name / team" />
            </div>
            <div className="form-group">
              <label>Approved By</label>
              <input value={form.approved_by} onChange={set('approved_by')} placeholder="Approver name" />
            </div>
            <div className="form-group">
              <label>Approved Date</label>
              <input type="date" value={form.approved_date} onChange={set('approved_date')} />
            </div>
            <div className="form-group">
              <label>Review Date</label>
              <input type="date" value={form.review_date} onChange={set('review_date')} />
            </div>
            <div className="form-group">
              <label>Next Test Date</label>
              <input type="date" value={form.next_test_date} onChange={set('next_test_date')} />
            </div>
            <div className="form-group">
              <label>Last Tested</label>
              <input type="date" value={form.last_tested} onChange={set('last_tested')} />
            </div>
            <div className="form-group">
              <label>Last Test Result</label>
              <select value={form.test_result} onChange={set('test_result')}>
                <option value="">— None —</option>
                {Object.keys(TEST_RESULT_COLORS).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>ISO 22301 Clause Reference</label>
              <input value={form.iso_clause_ref} onChange={set('iso_clause_ref')} placeholder="e.g. 8.3, 8.4, 8.5" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Frameworks (comma-separated)</label>
              <input value={form.frameworks} onChange={set('frameworks')} placeholder="ISO 22301, NIST SP 800-34" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Scope</label>
              <textarea value={form.scope} onChange={set('scope')} rows={2} placeholder="Scope of this BCP plan" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Objectives</label>
              <textarea value={form.objectives} onChange={set('objectives')} rows={2} placeholder="Key objectives and recovery goals" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Sub-form modals ─────────────────────────────────────────────── */

function BiaModal({ planId, bia, onClose, onSaved }) {
  const editing = !!bia;
  const [form, setForm] = useState(() => bia ? {
    process_name: bia.process_name || '', department: bia.department || '',
    criticality: bia.criticality || 'medium', rto_hours: bia.rto_hours ?? '',
    rpo_hours: bia.rpo_hours ?? '', mtpd_hours: bia.mtpd_hours ?? '',
    mbco: bia.mbco || '', dependencies: bia.dependencies || '',
    impacts_financial: bia.impacts_financial || '',
    impacts_operational: bia.impacts_operational || '',
    impacts_reputational: bia.impacts_reputational || '',
    impacts_regulatory: bia.impacts_regulatory || '',
    priority_order: bia.priority_order ?? 0, notes: bia.notes || '',
  } : {
    process_name: '', department: '', criticality: 'medium', rto_hours: '',
    rpo_hours: '', mtpd_hours: '', mbco: '', dependencies: '',
    impacts_financial: '', impacts_operational: '', impacts_reputational: '',
    impacts_regulatory: '', priority_order: 0, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.process_name.trim()) return setErr('Process name is required');
    setSaving(true);
    try {
      const payload = { ...form, rto_hours: form.rto_hours !== '' ? parseInt(form.rto_hours, 10) : null, rpo_hours: form.rpo_hours !== '' ? parseInt(form.rpo_hours, 10) : null, mtpd_hours: form.mtpd_hours !== '' ? parseInt(form.mtpd_hours, 10) : null, priority_order: parseInt(form.priority_order, 10) || 0 };
      if (editing) { const r = await api.put(`/bcp/${planId}/bia/${bia.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/bcp/${planId}/bia`, payload);           onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit BIA Process' : 'Add BIA Process'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Process Name *</label>
              <input value={form.process_name} onChange={set('process_name')} required />
            </div>
            <div className="form-group"><label>Department</label><input value={form.department} onChange={set('department')} /></div>
            <div className="form-group">
              <label>Criticality</label>
              <select value={form.criticality} onChange={set('criticality')}>
                {Object.keys(CRITICALITY_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group"><label>RTO (hours)</label><input type="number" min="0" value={form.rto_hours} onChange={set('rto_hours')} /></div>
            <div className="form-group"><label>RPO (hours)</label><input type="number" min="0" value={form.rpo_hours} onChange={set('rpo_hours')} /></div>
            <div className="form-group"><label>MTPD (hours)</label><input type="number" min="0" value={form.mtpd_hours} onChange={set('mtpd_hours')} /></div>
            <div className="form-group"><label>Priority Order</label><input type="number" min="0" value={form.priority_order} onChange={set('priority_order')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>MBCO (Min Business Continuity Objective)</label><textarea value={form.mbco} onChange={set('mbco')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Dependencies</label><textarea value={form.dependencies} onChange={set('dependencies')} rows={2} /></div>
            <div className="form-group"><label>Financial Impacts</label><textarea value={form.impacts_financial} onChange={set('impacts_financial')} rows={2} /></div>
            <div className="form-group"><label>Operational Impacts</label><textarea value={form.impacts_operational} onChange={set('impacts_operational')} rows={2} /></div>
            <div className="form-group"><label>Reputational Impacts</label><textarea value={form.impacts_reputational} onChange={set('impacts_reputational')} rows={2} /></div>
            <div className="form-group"><label>Regulatory Impacts</label><textarea value={form.impacts_regulatory} onChange={set('impacts_regulatory')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StrategyModal({ planId, strategy, onClose, onSaved }) {
  const editing = !!strategy;
  const [form, setForm] = useState(() => strategy ? {
    strategy_name: strategy.strategy_name || '', strategy_type: strategy.strategy_type || 'operational',
    description: strategy.description || '', resources_required: strategy.resources_required || '',
    responsible_party: strategy.responsible_party || '', cost_estimate: strategy.cost_estimate ?? '',
    status: strategy.status || 'proposed', notes: strategy.notes || '',
  } : { strategy_name: '', strategy_type: 'operational', description: '', resources_required: '', responsible_party: '', cost_estimate: '', status: 'proposed', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.strategy_name.trim()) return setErr('Strategy name is required');
    setSaving(true);
    try {
      const payload = { ...form, cost_estimate: form.cost_estimate !== '' ? parseFloat(form.cost_estimate) : null };
      if (editing) { const r = await api.put(`/bcp/${planId}/strategies/${strategy.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/bcp/${planId}/strategies`, payload);                 onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Strategy' : 'Add Strategy'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Strategy Name *</label><input value={form.strategy_name} onChange={set('strategy_name')} required /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.strategy_type} onChange={set('strategy_type')}>
                {STRATEGY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={set('status')}>
                {['proposed','approved','implemented','tested'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Responsible Party</label><input value={form.responsible_party} onChange={set('responsible_party')} /></div>
            <div className="form-group"><label>Cost Estimate</label><input type="number" min="0" step="0.01" value={form.cost_estimate} onChange={set('cost_estimate')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Description</label><textarea value={form.description} onChange={set('description')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Resources Required</label><textarea value={form.resources_required} onChange={set('resources_required')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TestModal({ planId, test, onClose, onSaved }) {
  const editing = !!test;
  const [form, setForm] = useState(() => test ? {
    test_name: test.test_name || '', test_type: test.test_type || 'tabletop',
    test_date: test.test_date ? test.test_date.slice(0, 10) : '',
    participants: test.participants || '', scenario: test.scenario || '',
    objectives: test.objectives || '', result: test.result || 'not_tested',
    findings: test.findings || '', actions_required: test.actions_required || '',
    lessons_learned: test.lessons_learned || '',
    next_test_date: test.next_test_date ? test.next_test_date.slice(0, 10) : '',
  } : { test_name: '', test_type: 'tabletop', test_date: '', participants: '', scenario: '', objectives: '', result: 'not_tested', findings: '', actions_required: '', lessons_learned: '', next_test_date: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.test_name.trim()) return setErr('Test name is required');
    if (!form.test_date) return setErr('Test date is required');
    setSaving(true);
    try {
      const payload = { ...form, next_test_date: form.next_test_date || null };
      if (editing) { const r = await api.put(`/bcp/${planId}/tests/${test.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/bcp/${planId}/tests`, payload);             onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Test / Exercise' : 'Add Test / Exercise'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Test Name *</label><input value={form.test_name} onChange={set('test_name')} required /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.test_type} onChange={set('test_type')}>
                {TEST_TYPES_BCP.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Test Date *</label><input type="date" value={form.test_date} onChange={set('test_date')} required /></div>
            <div className="form-group">
              <label>Result</label>
              <select value={form.result} onChange={set('result')}>
                {Object.keys(TEST_RESULT_COLORS).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Next Test Date</label><input type="date" value={form.next_test_date} onChange={set('next_test_date')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Participants</label><textarea value={form.participants} onChange={set('participants')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Scenario</label><textarea value={form.scenario} onChange={set('scenario')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Objectives</label><textarea value={form.objectives} onChange={set('objectives')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Findings</label><textarea value={form.findings} onChange={set('findings')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Actions Required</label><textarea value={form.actions_required} onChange={set('actions_required')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Lessons Learned</label><textarea value={form.lessons_learned} onChange={set('lessons_learned')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Plan Detail ─────────────────────────────────────────────────── */
function PlanDetail({ plan, orgs, onBack, onEdit, onDelete }) {
  const [tab, setTab] = useState('overview');
  const [bia, setBia]           = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [tests, setTests]       = useState([]);
  const [modal, setModal]       = useState(null);

  const loadBia    = useCallback(() => api.get(`/bcp/${plan.id}/bia`).then(r => setBia(r.data)).catch(() => {}), [plan.id]);
  const loadStrats = useCallback(() => api.get(`/bcp/${plan.id}/strategies`).then(r => setStrategies(r.data)).catch(() => {}), [plan.id]);
  const loadTests  = useCallback(() => api.get(`/bcp/${plan.id}/tests`).then(r => setTests(r.data)).catch(() => {}), [plan.id]);

  useEffect(() => { if (tab === 'bia')        loadBia(); },    [tab, loadBia]);
  useEffect(() => { if (tab === 'strategies') loadStrats(); }, [tab, loadStrats]);
  useEffect(() => { if (tab === 'tests')      loadTests(); },  [tab, loadTests]);

  const planStat = planStatInfo(plan.status);

  const deleteBia = async item => {
    if (!window.confirm(`Delete process "${item.process_name}"?`)) return;
    await api.delete(`/bcp/${plan.id}/bia/${item.id}`);
    setBia(p => p.filter(x => x.id !== item.id));
  };
  const deleteStrat = async item => {
    if (!window.confirm(`Delete strategy "${item.strategy_name}"?`)) return;
    await api.delete(`/bcp/${plan.id}/strategies/${item.id}`);
    setStrategies(p => p.filter(x => x.id !== item.id));
  };
  const deleteTest = async item => {
    if (!window.confirm(`Delete test "${item.test_name}"?`)) return;
    await api.delete(`/bcp/${plan.id}/tests/${item.id}`);
    setTests(p => p.filter(x => x.id !== item.id));
  };

  const TABS = ['overview','bia','strategies','tests'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>{plan.name}</h2>
        <Badge label={planStat.label} color={planStat.color} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onEdit(plan)}>Edit Plan</button>
        <button className="btn btn-danger"    style={{ fontSize: 12 }} onClick={() => onDelete(plan)}>Delete</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 13, borderRadius: '6px 6px 0 0', borderBottom: 'none', textTransform: 'capitalize' }}>
            {t === 'bia' ? 'Business Impact Analysis' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Organization', plan.org_name || '—'],
              ['Version', plan.version || '—'],
              ['Classification', plan.classification || '—'],
              ['Owner', plan.owner || '—'],
              ['Approved By', plan.approved_by || '—'],
              ['Approved Date', fmtDate(plan.approved_date)],
              ['Review Date', fmtDate(plan.review_date)],
              ['Next Test Date', fmtDate(plan.next_test_date)],
              ['Last Tested', fmtDate(plan.last_tested)],
              ['ISO Clause Ref', plan.iso_clause_ref || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text1)' }}>{value}</div>
              </div>
            ))}
            {plan.test_result && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Last Test Result</div>
                <ResultBadge val={plan.test_result} />
              </div>
            )}
            {plan.frameworks?.length > 0 && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Frameworks</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {plan.frameworks.map(f => <Badge key={f} label={f} color="#6366f1" />)}
                </div>
              </div>
            )}
            {plan.scope && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Scope</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{plan.scope}</div>
              </div>
            )}
            {plan.objectives && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Objectives</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{plan.objectives}</div>
              </div>
            )}
            {plan.notes && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{plan.notes}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'bia' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setModal({ type: 'bia' })}>+ Add Process</button>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Process</th><th>Department</th><th>Criticality</th>
                  <th>RTO (h)</th><th>RPO (h)</th><th>MTPD (h)</th><th>Priority</th><th></th>
                </tr>
              </thead>
              <tbody>
                {bia.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No processes added yet.</td></tr>
                )}
                {bia.map(b => (
                  <tr key={b.id}>
                    <td><span style={{ fontWeight: 600 }}>{b.process_name}</span>{b.mbco && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.mbco.slice(0, 60)}{b.mbco.length > 60 ? '…' : ''}</div>}</td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{b.department || '—'}</td>
                    <td><CritBadge val={b.criticality} /></td>
                    <td style={{ fontSize: 13 }}>{b.rto_hours ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{b.rpo_hours ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{b.mtpd_hours ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{b.priority_order}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setModal({ type: 'bia', item: b })}>Edit</button>
                        <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => deleteBia(b)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'strategies' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setModal({ type: 'strategy' })}>+ Add Strategy</button>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Name</th><th>Type</th><th>Responsible</th><th>Status</th><th>Cost Est.</th><th></th>
                </tr>
              </thead>
              <tbody>
                {strategies.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No strategies added yet.</td></tr>
                )}
                {strategies.map(s => (
                  <tr key={s.id}>
                    <td><span style={{ fontWeight: 600 }}>{s.strategy_name}</span>{s.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.description.slice(0, 60)}{s.description.length > 60 ? '…' : ''}</div>}</td>
                    <td><Badge label={s.strategy_type} color="#6366f1" /></td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{s.responsible_party || '—'}</td>
                    <td><Badge label={s.status} color={s.status === 'implemented' || s.status === 'tested' ? '#10b981' : s.status === 'approved' ? '#3b82f6' : '#6b7280'} /></td>
                    <td style={{ fontSize: 13 }}>{s.cost_estimate != null ? `$${parseFloat(s.cost_estimate).toLocaleString()}` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setModal({ type: 'strategy', item: s })}>Edit</button>
                        <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => deleteStrat(s)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tests' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setModal({ type: 'test' })}>+ Add Test</button>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Test Name</th><th>Type</th><th>Date</th><th>Result</th><th>Next Test</th><th>Participants</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tests.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No tests recorded yet.</td></tr>
                )}
                {tests.map(t => (
                  <tr key={t.id}>
                    <td><span style={{ fontWeight: 600 }}>{t.test_name}</span>{t.findings && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.findings.slice(0, 60)}{t.findings.length > 60 ? '…' : ''}</div>}</td>
                    <td style={{ fontSize: 12 }}>{t.test_type?.replace('_', ' ')}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(t.test_date)}</td>
                    <td><ResultBadge val={t.result} /></td>
                    <td style={{ fontSize: 13, color: t.next_test_date ? 'var(--accent)' : 'var(--text3)', fontWeight: t.next_test_date ? 600 : 400 }}>{fmtDate(t.next_test_date)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.participants || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setModal({ type: 'test', item: t })}>Edit</button>
                        <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => deleteTest(t)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'bia' && (
        <BiaModal planId={plan.id} bia={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setBia(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
      {modal?.type === 'strategy' && (
        <StrategyModal planId={plan.id} strategy={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setStrategies(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
      {modal?.type === 'test' && (
        <TestModal planId={plan.id} test={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setTests(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function BCP() {
  const [plans,    setPlans]    = useState([]);
  const [orgs,     setOrgs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, orgsRes] = await Promise.all([
        api.get('/bcp'),
        api.get('/budget/orgs'),
      ]);
      setPlans(plansRes.data);
      setOrgs(orgsRes.data);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, op) => {
    if (op === 'create') { setPlans(p => [saved, ...p]); }
    else {
      setPlans(p => p.map(x => x.id === saved.id ? { ...x, ...saved } : x));
      if (selected?.id === saved.id) setSelected(prev => ({ ...prev, ...saved }));
    }
  };

  const handleDelete = async plan => {
    if (!window.confirm(`Delete plan "${plan.name}"? This will remove all BIA, strategies, and tests.`)) return;
    try {
      await api.delete(`/bcp/${plan.id}`);
      setPlans(p => p.filter(x => x.id !== plan.id));
      if (selected?.id === plan.id) setSelected(null);
    } catch (ex) { alert(ex.response?.data?.error || 'Delete failed'); }
  };

  if (selected) {
    return (
      <PlanDetail
        plan={selected} orgs={orgs}
        onBack={() => setSelected(null)}
        onEdit={plan => setModal(plan)}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Business Continuity Planning</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>ISO 22301:2019 compliant BCP plans with BIA, strategies, and test exercises.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Plan</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
      ) : plans.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No BCP plans yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Plan" to create your first Business Continuity Plan.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Plan Name</th><th>Organization</th><th>Status</th>
                <th>Owner</th><th>Last Tested</th><th>Next Test</th><th>Result</th>
                <th>BIA</th><th>Strategies</th><th>Tests</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => {
                const stat = planStatInfo(plan.status);
                return (
                  <tr key={plan.id} onClick={() => setSelected(plan)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{plan.name}</span>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>v{plan.version} · {plan.classification}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{plan.org_name || '—'}</td>
                    <td><Badge label={stat.label} color={stat.color} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{plan.owner || '—'}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(plan.last_tested)}</td>
                    <td style={{ fontSize: 13, color: plan.next_test_date ? 'var(--accent)' : 'var(--text3)', fontWeight: plan.next_test_date ? 600 : 400 }}>{fmtDate(plan.next_test_date)}</td>
                    <td>{plan.test_result ? <ResultBadge val={plan.test_result} /> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{plan.bia_count || 0}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{plan.strategy_count || 0}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{plan.test_count || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PlanModal
          plan={modal === 'create' ? null : modal}
          orgs={orgs}
          onClose={() => setModal(null)}
          onSaved={(saved, op) => { handleSaved(saved, op); setModal(null); }}
        />
      )}
    </div>
  );
}
