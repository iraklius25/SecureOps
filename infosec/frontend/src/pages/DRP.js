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

const DR_SITE_COLORS = { hot: '#10b981', warm: '#f59e0b', cold: '#3b82f6', cloud: '#8b5cf6', none: '#6b7280' };
const CRITICALITY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const TEST_RESULT_COLORS  = { passed: '#10b981', partial: '#f59e0b', failed: '#ef4444', not_tested: '#6b7280' };

const SYSTEM_TYPES   = ['application','database','server','network','storage','cloud','other'];
const TEST_TYPES_DRP = ['tabletop','component','parallel','full_failover','simulation'];

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
  return <Badge label={val} color={CRITICALITY_COLORS[val] || '#6b7280'} />;
}

function ResultBadge({ val }) {
  return <Badge label={val?.replace('_', ' ') || '—'} color={TEST_RESULT_COLORS[val] || '#6b7280'} />;
}

function DrSiteBadge({ val }) {
  return <Badge label={val} color={DR_SITE_COLORS[val] || '#6b7280'} />;
}

/* ── Plan Modal ─────────────────────────────────────────────────── */
const PLAN_EMPTY = {
  org_id: '', name: '', version: '1.0', scope: '', dr_site: '', dr_site_type: 'cold',
  status: 'draft', classification: 'confidential', owner: '', approved_by: '',
  approved_date: '', review_date: '', next_test_date: '', last_tested: '', test_result: '',
  overall_rto_hours: '', overall_rpo_hours: '', activation_criteria: '',
  escalation_contacts_text: '', notes: '',
};

function PlanModal({ plan, orgs, onClose, onSaved }) {
  const editing = !!plan;
  const [form, setForm] = useState(() => plan ? {
    org_id:                   plan.org_id          || '',
    name:                     plan.name            || '',
    version:                  plan.version         || '1.0',
    scope:                    plan.scope           || '',
    dr_site:                  plan.dr_site         || '',
    dr_site_type:             plan.dr_site_type    || 'cold',
    status:                   plan.status          || 'draft',
    classification:           plan.classification  || 'confidential',
    owner:                    plan.owner           || '',
    approved_by:              plan.approved_by     || '',
    approved_date:            plan.approved_date   ? plan.approved_date.slice(0, 10)   : '',
    review_date:              plan.review_date     ? plan.review_date.slice(0, 10)     : '',
    next_test_date:           plan.next_test_date  ? plan.next_test_date.slice(0, 10)  : '',
    last_tested:              plan.last_tested     ? plan.last_tested.slice(0, 10)     : '',
    test_result:              plan.test_result     || '',
    overall_rto_hours:        plan.overall_rto_hours ?? '',
    overall_rpo_hours:        plan.overall_rpo_hours ?? '',
    activation_criteria:      plan.activation_criteria || '',
    escalation_contacts_text: Array.isArray(plan.escalation_contacts)
      ? plan.escalation_contacts.map(c => `${c.name || ''} <${c.contact || ''}>`).join('\n')
      : '',
    notes: plan.notes || '',
  } : { ...PLAN_EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.name.trim()) return setErr('Name is required');
    setSaving(true);
    try {
      const escalation_contacts = form.escalation_contacts_text
        ? form.escalation_contacts_text.split('\n').filter(Boolean).map((line, i) => {
            const m = line.match(/^(.+?)\s*<(.+)>$/);
            return m ? { order: i + 1, name: m[1].trim(), contact: m[2].trim() } : { order: i + 1, name: line.trim(), contact: '' };
          })
        : [];
      const payload = {
        ...form,
        org_id:            form.org_id            || null,
        approved_date:     form.approved_date     || null,
        review_date:       form.review_date       || null,
        next_test_date:    form.next_test_date    || null,
        last_tested:       form.last_tested       || null,
        test_result:       form.test_result       || null,
        overall_rto_hours: form.overall_rto_hours !== '' ? parseInt(form.overall_rto_hours, 10) : null,
        overall_rpo_hours: form.overall_rpo_hours !== '' ? parseInt(form.overall_rpo_hours, 10) : null,
        escalation_contacts,
        escalation_contacts_text: undefined,
      };
      if (editing) { const r = await api.put(`/drp/${plan.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post('/drp', payload);           onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit DR Plan' : 'New DR Plan'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Plan Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. IT Disaster Recovery Plan 2026" required />
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
              <label>DR Site</label>
              <input value={form.dr_site} onChange={set('dr_site')} placeholder="DR site name or location" />
            </div>
            <div className="form-group">
              <label>DR Site Type</label>
              <select value={form.dr_site_type} onChange={set('dr_site_type')}>
                {Object.keys(DR_SITE_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Overall RTO (hours)</label>
              <input type="number" min="0" value={form.overall_rto_hours} onChange={set('overall_rto_hours')} />
            </div>
            <div className="form-group">
              <label>Overall RPO (hours)</label>
              <input type="number" min="0" value={form.overall_rpo_hours} onChange={set('overall_rpo_hours')} />
            </div>
            <div className="form-group">
              <label>Owner</label>
              <input value={form.owner} onChange={set('owner')} />
            </div>
            <div className="form-group">
              <label>Approved By</label>
              <input value={form.approved_by} onChange={set('approved_by')} />
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
              <label>Scope</label>
              <textarea value={form.scope} onChange={set('scope')} rows={2} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Activation Criteria</label>
              <textarea value={form.activation_criteria} onChange={set('activation_criteria')} rows={2} placeholder="Conditions that trigger DR plan activation" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Escalation Contacts (one per line: Name &lt;contact&gt;)</label>
              <textarea value={form.escalation_contacts_text} onChange={set('escalation_contacts_text')} rows={3} placeholder="John Smith <john@example.com>&#10;On-Call Team <+1-555-0100>" />
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

function SystemModal({ planId, system, onClose, onSaved }) {
  const editing = !!system;
  const [form, setForm] = useState(() => system ? {
    system_name: system.system_name || '', system_type: system.system_type || 'application',
    criticality: system.criticality || 'medium', rto_hours: system.rto_hours ?? '',
    rpo_hours: system.rpo_hours ?? '', recovery_priority: system.recovery_priority ?? 0,
    recovery_procedure: system.recovery_procedure || '', responsible_team: system.responsible_team || '',
    backup_location: system.backup_location || '', backup_frequency: system.backup_frequency || '',
    dr_site_target: system.dr_site_target || '', dependencies: system.dependencies || '', notes: system.notes || '',
  } : { system_name: '', system_type: 'application', criticality: 'medium', rto_hours: '', rpo_hours: '', recovery_priority: 0, recovery_procedure: '', responsible_team: '', backup_location: '', backup_frequency: '', dr_site_target: '', dependencies: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.system_name.trim()) return setErr('System name is required');
    setSaving(true);
    try {
      const payload = { ...form, rto_hours: form.rto_hours !== '' ? parseInt(form.rto_hours, 10) : null, rpo_hours: form.rpo_hours !== '' ? parseInt(form.rpo_hours, 10) : null, recovery_priority: parseInt(form.recovery_priority, 10) || 0 };
      if (editing) { const r = await api.put(`/drp/${planId}/systems/${system.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/drp/${planId}/systems`, payload);              onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit System' : 'Add System'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>System Name *</label><input value={form.system_name} onChange={set('system_name')} required /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.system_type} onChange={set('system_type')}>
                {SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Criticality</label>
              <select value={form.criticality} onChange={set('criticality')}>
                {Object.keys(CRITICALITY_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group"><label>RTO (hours)</label><input type="number" min="0" value={form.rto_hours} onChange={set('rto_hours')} /></div>
            <div className="form-group"><label>RPO (hours)</label><input type="number" min="0" value={form.rpo_hours} onChange={set('rpo_hours')} /></div>
            <div className="form-group"><label>Recovery Priority</label><input type="number" min="0" value={form.recovery_priority} onChange={set('recovery_priority')} /></div>
            <div className="form-group"><label>Responsible Team</label><input value={form.responsible_team} onChange={set('responsible_team')} /></div>
            <div className="form-group"><label>Backup Location</label><input value={form.backup_location} onChange={set('backup_location')} /></div>
            <div className="form-group"><label>Backup Frequency</label><input value={form.backup_frequency} onChange={set('backup_frequency')} placeholder="e.g. Daily, 4h" /></div>
            <div className="form-group"><label>DR Site Target</label><input value={form.dr_site_target} onChange={set('dr_site_target')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Recovery Procedure</label><textarea value={form.recovery_procedure} onChange={set('recovery_procedure')} rows={3} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Dependencies</label><textarea value={form.dependencies} onChange={set('dependencies')} rows={2} /></div>
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

function RunbookModal({ planId, runbook, onClose, onSaved }) {
  const editing = !!runbook;
  const existingSteps = Array.isArray(runbook?.steps) ? runbook.steps.map(s => s.description || s).join('\n') : '';
  const [form, setForm] = useState(() => runbook ? {
    title: runbook.title || '', scenario: runbook.scenario || '',
    steps_text: existingSteps, responsible_role: runbook.responsible_role || '',
    estimated_hours: runbook.estimated_hours ?? '', prerequisites: runbook.prerequisites || '',
    rollback_procedure: runbook.rollback_procedure || '',
    last_reviewed: runbook.last_reviewed ? runbook.last_reviewed.slice(0, 10) : '',
    version: runbook.version || '1.0',
  } : { title: '', scenario: '', steps_text: '', responsible_role: '', estimated_hours: '', prerequisites: '', rollback_procedure: '', last_reviewed: '', version: '1.0' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.title.trim()) return setErr('Title is required');
    setSaving(true);
    try {
      const steps = form.steps_text.split('\n').filter(Boolean).map((desc, i) => ({ order: i + 1, description: desc.trim() }));
      const payload = { ...form, steps, steps_text: undefined, estimated_hours: form.estimated_hours !== '' ? parseInt(form.estimated_hours, 10) : null, last_reviewed: form.last_reviewed || null };
      if (editing) { const r = await api.put(`/drp/${planId}/runbooks/${runbook.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/drp/${planId}/runbooks`, payload);               onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Runbook' : 'Add Runbook'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Title *</label><input value={form.title} onChange={set('title')} required /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Scenario</label><input value={form.scenario} onChange={set('scenario')} placeholder="e.g. Primary data center power failure" /></div>
            <div className="form-group"><label>Responsible Role</label><input value={form.responsible_role} onChange={set('responsible_role')} /></div>
            <div className="form-group"><label>Estimated Hours</label><input type="number" min="0" value={form.estimated_hours} onChange={set('estimated_hours')} /></div>
            <div className="form-group"><label>Version</label><input value={form.version} onChange={set('version')} /></div>
            <div className="form-group"><label>Last Reviewed</label><input type="date" value={form.last_reviewed} onChange={set('last_reviewed')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Steps (one per line)</label>
              <textarea value={form.steps_text} onChange={set('steps_text')} rows={6} placeholder="Step 1 description&#10;Step 2 description&#10;Step 3 description" />
              <small style={{ color: 'var(--text3)', fontSize: 11 }}>Each line becomes a numbered step in the runbook.</small>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Prerequisites</label><textarea value={form.prerequisites} onChange={set('prerequisites')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Rollback Procedure</label><textarea value={form.rollback_procedure} onChange={set('rollback_procedure')} rows={2} /></div>
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

function DRTestModal({ planId, test, onClose, onSaved }) {
  const editing = !!test;
  const [form, setForm] = useState(() => test ? {
    test_name: test.test_name || '', test_type: test.test_type || 'tabletop',
    test_date: test.test_date ? test.test_date.slice(0, 10) : '',
    participants: test.participants || '', scenario: test.scenario || '',
    rto_target_hours: test.rto_target_hours ?? '', rpo_target_hours: test.rpo_target_hours ?? '',
    rto_achieved_hours: test.rto_achieved_hours ?? '', rpo_achieved_hours: test.rpo_achieved_hours ?? '',
    result: test.result || 'not_tested', findings: test.findings || '',
    actions_required: test.actions_required || '', lessons_learned: test.lessons_learned || '',
    next_test_date: test.next_test_date ? test.next_test_date.slice(0, 10) : '',
  } : { test_name: '', test_type: 'tabletop', test_date: '', participants: '', scenario: '', rto_target_hours: '', rpo_target_hours: '', rto_achieved_hours: '', rpo_achieved_hours: '', result: 'not_tested', findings: '', actions_required: '', lessons_learned: '', next_test_date: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const numOrNull = v => v !== '' ? parseInt(v, 10) : null;

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.test_name.trim()) return setErr('Test name is required');
    if (!form.test_date) return setErr('Test date is required');
    setSaving(true);
    try {
      const payload = { ...form, rto_target_hours: numOrNull(form.rto_target_hours), rpo_target_hours: numOrNull(form.rpo_target_hours), rto_achieved_hours: numOrNull(form.rto_achieved_hours), rpo_achieved_hours: numOrNull(form.rpo_achieved_hours), next_test_date: form.next_test_date || null };
      if (editing) { const r = await api.put(`/drp/${planId}/tests/${test.id}`, payload); onSaved(r.data, 'edit'); }
      else         { const r = await api.post(`/drp/${planId}/tests`, payload);             onSaved(r.data, 'create'); }
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit DR Test' : 'Add DR Test'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Test Name *</label><input value={form.test_name} onChange={set('test_name')} required /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.test_type} onChange={set('test_type')}>
                {TEST_TYPES_DRP.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
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
            <div className="form-group"><label>RTO Target (hours)</label><input type="number" min="0" value={form.rto_target_hours} onChange={set('rto_target_hours')} /></div>
            <div className="form-group"><label>RPO Target (hours)</label><input type="number" min="0" value={form.rpo_target_hours} onChange={set('rpo_target_hours')} /></div>
            <div className="form-group"><label>RTO Achieved (hours)</label><input type="number" min="0" value={form.rto_achieved_hours} onChange={set('rto_achieved_hours')} /></div>
            <div className="form-group"><label>RPO Achieved (hours)</label><input type="number" min="0" value={form.rpo_achieved_hours} onChange={set('rpo_achieved_hours')} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Participants</label><textarea value={form.participants} onChange={set('participants')} rows={2} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Scenario</label><textarea value={form.scenario} onChange={set('scenario')} rows={2} /></div>
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
  const [tab, setTab]         = useState('overview');
  const [systems, setSystems] = useState([]);
  const [runbooks, setRunbooks] = useState([]);
  const [tests, setTests]     = useState([]);
  const [modal, setModal]     = useState(null);
  const [expandedRb, setExpandedRb] = useState(null);

  const loadSystems  = useCallback(() => api.get(`/drp/${plan.id}/systems`).then(r => setSystems(r.data)).catch(() => {}),  [plan.id]);
  const loadRunbooks = useCallback(() => api.get(`/drp/${plan.id}/runbooks`).then(r => setRunbooks(r.data)).catch(() => {}), [plan.id]);
  const loadTests    = useCallback(() => api.get(`/drp/${plan.id}/tests`).then(r => setTests(r.data)).catch(() => {}),    [plan.id]);

  useEffect(() => { if (tab === 'systems')  loadSystems(); },  [tab, loadSystems]);
  useEffect(() => { if (tab === 'runbooks') loadRunbooks(); }, [tab, loadRunbooks]);
  useEffect(() => { if (tab === 'tests')    loadTests(); },    [tab, loadTests]);

  const planStat = planStatInfo(plan.status);

  const deleteSys = async item => {
    if (!window.confirm(`Delete system "${item.system_name}"?`)) return;
    await api.delete(`/drp/${plan.id}/systems/${item.id}`);
    setSystems(p => p.filter(x => x.id !== item.id));
  };
  const deleteRb = async item => {
    if (!window.confirm(`Delete runbook "${item.title}"?`)) return;
    await api.delete(`/drp/${plan.id}/runbooks/${item.id}`);
    setRunbooks(p => p.filter(x => x.id !== item.id));
  };
  const deleteTest = async item => {
    if (!window.confirm(`Delete test "${item.test_name}"?`)) return;
    await api.delete(`/drp/${plan.id}/tests/${item.id}`);
    setTests(p => p.filter(x => x.id !== item.id));
  };

  const TABS = ['overview','systems','runbooks','tests'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>{plan.name}</h2>
        <Badge label={planStat.label} color={planStat.color} />
        <DrSiteBadge val={plan.dr_site_type} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onEdit(plan)}>Edit Plan</button>
        <button className="btn btn-danger"    style={{ fontSize: 12 }} onClick={() => onDelete(plan)}>Delete</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 13, borderRadius: '6px 6px 0 0', borderBottom: 'none', textTransform: 'capitalize' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Organization', plan.org_name || '—'],
              ['Version', plan.version || '—'],
              ['DR Site', plan.dr_site || '—'],
              ['Classification', plan.classification || '—'],
              ['Owner', plan.owner || '—'],
              ['Approved By', plan.approved_by || '—'],
              ['Approved Date', fmtDate(plan.approved_date)],
              ['Review Date', fmtDate(plan.review_date)],
              ['Next Test Date', fmtDate(plan.next_test_date)],
              ['Last Tested', fmtDate(plan.last_tested)],
              ['Overall RTO', plan.overall_rto_hours != null ? `${plan.overall_rto_hours}h` : '—'],
              ['Overall RPO', plan.overall_rpo_hours != null ? `${plan.overall_rpo_hours}h` : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text1)' }}>{value}</div>
              </div>
            ))}
            {plan.dr_site_type && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>DR Site Type</div>
                <DrSiteBadge val={plan.dr_site_type} />
              </div>
            )}
            {plan.test_result && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Last Test Result</div>
                <ResultBadge val={plan.test_result} />
              </div>
            )}
            {plan.activation_criteria && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Activation Criteria</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{plan.activation_criteria}</div>
              </div>
            )}
            {Array.isArray(plan.escalation_contacts) && plan.escalation_contacts.length > 0 && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Escalation Contacts</div>
                {plan.escalation_contacts.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text1)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600 }}>{c.order}. {c.name}</span>
                    {c.contact && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{c.contact}</span>}
                  </div>
                ))}
              </div>
            )}
            {plan.scope && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px 14px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Scope</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{plan.scope}</div>
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

        {tab === 'systems' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setModal({ type: 'system' })}>+ Add System</button>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>System</th><th>Type</th><th>Criticality</th>
                  <th>RTO (h)</th><th>RPO (h)</th><th>Backup Freq.</th><th>Responsible</th><th>Priority</th><th></th>
                </tr>
              </thead>
              <tbody>
                {systems.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No systems added yet.</td></tr>
                )}
                {systems.map(s => (
                  <tr key={s.id}>
                    <td><span style={{ fontWeight: 600 }}>{s.system_name}</span>{s.dr_site_target && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Target: {s.dr_site_target}</div>}</td>
                    <td><Badge label={s.system_type} color="#6366f1" /></td>
                    <td><CritBadge val={s.criticality} /></td>
                    <td style={{ fontSize: 13 }}>{s.rto_hours ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{s.rpo_hours ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.backup_frequency || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.responsible_team || '—'}</td>
                    <td style={{ fontSize: 13 }}>{s.recovery_priority}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setModal({ type: 'system', item: s })}>Edit</button>
                        <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => deleteSys(s)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'runbooks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setModal({ type: 'runbook' })}>+ Add Runbook</button>
            </div>
            {runbooks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>No runbooks added yet.</div>
            )}
            {runbooks.map(rb => (
              <div key={rb.id} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', marginBottom: 10, border: '1px solid var(--border)' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedRb(expandedRb === rb.id ? null : rb.id)}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{rb.title}</span>
                  {rb.scenario && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rb.scenario}</span>}
                  {rb.estimated_hours && <span style={{ fontSize: 12, color: 'var(--text2)' }}>~{rb.estimated_hours}h</span>}
                  {rb.responsible_role && <Badge label={rb.responsible_role} color="#6366f1" />}
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setModal({ type: 'runbook', item: rb })}>Edit</button>
                    <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => deleteRb(rb)}>✕</button>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{expandedRb === rb.id ? '▲' : '▼'}</span>
                </div>
                {expandedRb === rb.id && (
                  <div style={{ padding: '0 16px 14px' }}>
                    {rb.prerequisites && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Prerequisites</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{rb.prerequisites}</div>
                      </div>
                    )}
                    {Array.isArray(rb.steps) && rb.steps.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Steps</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          {rb.steps.map((step, i) => (
                            <li key={i} style={{ fontSize: 13, color: 'var(--text1)', padding: '3px 0' }}>{step.description || step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {rb.rollback_procedure && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Rollback Procedure</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{rb.rollback_procedure}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
                  <th>Test Name</th><th>Type</th><th>Date</th><th>Result</th>
                  <th>RTO Target/Achieved</th><th>RPO Target/Achieved</th><th>Next Test</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tests.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No tests recorded yet.</td></tr>
                )}
                {tests.map(t => (
                  <tr key={t.id}>
                    <td><span style={{ fontWeight: 600 }}>{t.test_name}</span>{t.scenario && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.scenario.slice(0, 60)}{t.scenario.length > 60 ? '…' : ''}</div>}</td>
                    <td style={{ fontSize: 12 }}>{t.test_type?.replace('_', ' ')}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(t.test_date)}</td>
                    <td><ResultBadge val={t.result} /></td>
                    <td style={{ fontSize: 12 }}>
                      {t.rto_target_hours != null ? `${t.rto_target_hours}h` : '—'}
                      {t.rto_achieved_hours != null && (
                        <span style={{ marginLeft: 4, color: t.rto_achieved_hours <= (t.rto_target_hours || Infinity) ? '#10b981' : '#ef4444' }}>/ {t.rto_achieved_hours}h</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {t.rpo_target_hours != null ? `${t.rpo_target_hours}h` : '—'}
                      {t.rpo_achieved_hours != null && (
                        <span style={{ marginLeft: 4, color: t.rpo_achieved_hours <= (t.rpo_target_hours || Infinity) ? '#10b981' : '#ef4444' }}>/ {t.rpo_achieved_hours}h</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: t.next_test_date ? 'var(--accent)' : 'var(--text3)', fontWeight: t.next_test_date ? 600 : 400 }}>{fmtDate(t.next_test_date)}</td>
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

      {modal?.type === 'system' && (
        <SystemModal planId={plan.id} system={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setSystems(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
      {modal?.type === 'runbook' && (
        <RunbookModal planId={plan.id} runbook={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setRunbooks(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
      {modal?.type === 'test' && (
        <DRTestModal planId={plan.id} test={modal.item || null} onClose={() => setModal(null)}
          onSaved={(saved, op) => { setTests(p => op === 'create' ? [...p, saved] : p.map(x => x.id === saved.id ? saved : x)); setModal(null); }} />
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function DRP() {
  const [plans,    setPlans]    = useState([]);
  const [orgs,     setOrgs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, orgsRes] = await Promise.all([
        api.get('/drp'),
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
    if (!window.confirm(`Delete DR plan "${plan.name}"? This will remove all systems, runbooks, and tests.`)) return;
    try {
      await api.delete(`/drp/${plan.id}`);
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Disaster Recovery Planning</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>Manage DR plans, systems inventory, runbooks, and test exercises.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Plan</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
      ) : plans.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No DR plans yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Plan" to create your first Disaster Recovery Plan.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Plan Name</th><th>Organization</th><th>Status</th><th>DR Site Type</th>
                <th>Owner</th><th>RTO</th><th>RPO</th><th>Last Tested</th><th>Next Test</th><th>Result</th>
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
                    <td><DrSiteBadge val={plan.dr_site_type} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{plan.owner || '—'}</td>
                    <td style={{ fontSize: 13 }}>{plan.overall_rto_hours != null ? `${plan.overall_rto_hours}h` : '—'}</td>
                    <td style={{ fontSize: 13 }}>{plan.overall_rpo_hours != null ? `${plan.overall_rpo_hours}h` : '—'}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(plan.last_tested)}</td>
                    <td style={{ fontSize: 13, color: plan.next_test_date ? 'var(--accent)' : 'var(--text3)', fontWeight: plan.next_test_date ? 600 : 400 }}>{fmtDate(plan.next_test_date)}</td>
                    <td>{plan.test_result ? <ResultBadge val={plan.test_result} /> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
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
