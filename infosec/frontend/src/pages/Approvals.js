import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';

const ACTION_LABELS = {
  accept_risk: 'Accept Risk',
  close:       'Close (Resolved)',
  mitigate:    'Mitigate',
};

const STATUS_COLORS = {
  pending:  'var(--medium)',
  approved: 'var(--low)',
  rejected: 'var(--critical)',
};

function ReviewModal({ approval, onClose, onReviewed }) {
  const [status, setStatus] = useState('approved');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      await api.patch(`/approvals/${approval.id}`, { status, review_notes: notes });
      onReviewed();
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Error submitting review');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Review Approval Request</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <div style={{ marginBottom: 14, fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}>
                <strong>Vulnerability:</strong> {approval.vuln_title}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Action Requested:</strong> {ACTION_LABELS[approval.action] || approval.action}
              </div>
              {approval.request_notes && (
                <div style={{ marginBottom: 4 }}>
                  <strong>Request Notes:</strong> {approval.request_notes}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Decision</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div className="form-group">
              <label>Review Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Explain your decision..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className={`btn ${status === 'approved' ? 'btn-primary' : 'btn-danger'}`}
              disabled={saving}
            >
              {saving ? 'Submitting...' : status === 'approved' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestApprovalModal({ vulnId, onClose, onSubmitted }) {
  const [form, setForm] = useState({ action: 'accept_risk', request_notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      await api.post('/approvals', { ...form, vuln_id: vulnId });
      onSubmitted();
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Error submitting request');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Request Approval</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="form-group">
              <label>Action</label>
              <select value={form.action} onChange={set('action')}>
                <option value="accept_risk">Accept Risk</option>
                <option value="close">Close (Resolved)</option>
                <option value="mitigate">Mitigate</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.request_notes}
                onChange={set('request_notes')}
                rows={3}
                placeholder="Explain the rationale for this action..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Approvals() {
  const { user } = useContext(AuthContext);
  const [approvals, setApprovals] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const canReview = ['admin', 'analyst'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/approvals').then(r => setApprovals(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteApproval = async id => {
    if (!window.confirm('Delete this approval request?')) return;
    await api.delete(`/approvals/${id}`);
    load();
  };

  const filtered = tab === 'pending'
    ? approvals.filter(a => a.status === 'pending')
    : approvals;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Approval Queue</div>
          <div className="page-subtitle">
            {approvals.filter(a => a.status === 'pending').length} pending review
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {['pending', 'all'].map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'pending' ? `Pending (${approvals.filter(a => a.status === 'pending').length})` : 'All Approvals'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <p>{tab === 'pending' ? 'No pending approval requests.' : 'No approval requests found.'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vulnerability</th>
                  <th>Severity</th>
                  <th>Asset IP</th>
                  <th>Action Requested</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                  <th>Status</th>
                  <th>Review Notes</th>
                  <th>Approved By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {a.vuln_title || '—'}
                    </td>
                    <td>
                      {a.vuln_severity
                        ? <span className={`badge badge-${a.vuln_severity}`}>{a.vuln_severity}</span>
                        : <span className="text-dim">—</span>}
                    </td>
                    <td className="mono" style={{ color: 'var(--info)', fontSize: 12 }}>{a.ip_address || '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{ACTION_LABELS[a.action] || a.action}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{a.requested_by_name || '—'}</td>
                    <td className="text-dim" style={{ fontSize: 12 }}>
                      {a.created_at ? format(new Date(a.created_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: STATUS_COLORS[a.status] || 'var(--text3)',
                        color: '#fff',
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.review_notes || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{a.approved_by_name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canReview && a.status === 'pending' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setReviewing(a)}
                          >
                            Review
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteApproval(a.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          approval={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={load}
        />
      )}
    </div>
  );
}

export { RequestApprovalModal };
