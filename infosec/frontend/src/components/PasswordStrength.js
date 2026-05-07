import React from 'react';

const rules = [
  { label: 'At least 12 characters', test: p => p.length >= 12 },
  { label: 'Uppercase letter (A–Z)',  test: p => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)',  test: p => /[a-z]/.test(p) },
  { label: 'Number (0–9)',            test: p => /[0-9]/.test(p) },
  { label: 'Special character',       test: p => /[^A-Za-z0-9]/.test(p) },
];

export function validatePassword(password) {
  for (const r of rules) {
    if (!r.test(password)) return r.label + ' required';
  }
  return null;
}

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const passed = rules.filter(r => r.test(password)).length;
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#22c55e'];
  const color = colors[passed - 1] || '#ef4444';

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {rules.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < passed ? color : 'var(--border2)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rules.map(r => {
          const ok = r.test(password);
          return (
            <div key={r.label} style={{ fontSize: 11, color: ok ? 'var(--text3)' : '#f97316', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: ok ? '#22c55e' : '#f97316' }}>{ok ? '✓' : '✗'}</span>
              {r.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
