import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function KillSwitchModal({ onClose }) {
  const [pin, setPin]         = useState('');
  const [authed, setAuthed]   = useState(false);
  const [active, setActive]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // Verify PIN and fetch current state
  const handlePinSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/system/config`, {
        headers: { 'x-admin-pin': pin },
      });
      if (res.status === 403) { setError('Incorrect PIN.'); return; }
      if (!res.ok) { setError('Server error. Try again.'); return; }
      const data = await res.json();
      setActive(data.active);
      setAuthed(true);
    } catch {
      setError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  }, [pin]);

  // Toggle the kill switch
  const handleToggle = useCallback(async () => {
    setSaving(true);
    setError('');
    const next = !active;
    try {
      const res = await fetch(`${API}/api/system/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) { setError('Failed to save. Try again.'); return; }
      setActive(next);
    } catch {
      setError('Could not reach server.');
    } finally {
      setSaving(false);
    }
  }, [active, pin]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const card = {
    background: '#1a1d23', borderRadius: '14px', padding: '36px 40px',
    width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    border: '1px solid #2e3340', fontFamily: 'Arial, sans-serif', color: '#e0e0e0',
    position: 'relative',
  };
  const title = {
    fontSize: '13px', fontWeight: '700', letterSpacing: '2px',
    textTransform: 'uppercase', color: '#888', marginBottom: '24px',
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '15px',
    background: '#12141a', border: '1px solid #3a3f50', color: '#e0e0e0',
    outline: 'none', boxSizing: 'border-box', marginBottom: '14px',
    letterSpacing: '4px',
  };
  const btn = (bg, disabled) => ({
    width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
    background: disabled ? '#2e3340' : bg, color: disabled ? '#666' : '#fff',
    fontWeight: '700', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
  });
  const closeBtn = {
    position: 'absolute', top: '14px', right: '16px', background: 'none',
    border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer', lineHeight: 1,
  };

  // ── Toggle UI ─────────────────────────────────────────────────────────────
  const toggleTrack = {
    width: '60px', height: '32px', borderRadius: '16px', position: 'relative',
    background: active ? '#27ae60' : '#c0392b',
    cursor: saving ? 'not-allowed' : 'pointer',
    transition: 'background 0.3s', flexShrink: 0,
  };
  const toggleThumb = {
    position: 'absolute', top: '4px',
    left: active ? '30px' : '4px',
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#fff', transition: 'left 0.25s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtn} onClick={onClose}>✕</button>
        <div style={title}>System Configuration</div>

        {!authed ? (
          /* ── PIN entry ── */
          <form onSubmit={handlePinSubmit}>
            <div style={{ fontSize: '13px', color: '#999', marginBottom: '14px' }}>
              Enter admin PIN to continue.
            </div>
            <input
              style={inputStyle}
              type="password"
              placeholder="• • • • • •"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            {error && <div style={{ color: '#e74c3c', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
            <button style={btn('#2980b9', loading || !pin)} disabled={loading || !pin} type="submit">
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          /* ── Kill switch toggle ── */
          <>
            <div style={{ fontSize: '13px', color: '#999', marginBottom: '24px' }}>
              Controls remote database access for all other installations.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '28px' }}>
              <div
                style={toggleTrack}
                onClick={saving ? undefined : handleToggle}
                role="switch"
                aria-checked={active}
              >
                <div style={toggleThumb} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: active ? '#2ecc71' : '#e74c3c' }}>
                  {active ? 'Access Granted' : 'Access Revoked'}
                </div>
                <div style={{ fontSize: '12px', color: '#777', marginTop: '3px' }}>
                  {active
                    ? 'Other installations can connect to the database.'
                    : 'Other installations are blocked. Takes effect within 60 s.'}
                </div>
              </div>
            </div>
            {error && <div style={{ color: '#e74c3c', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
            {saving && <div style={{ color: '#888', fontSize: '12px' }}>Saving…</div>}
          </>
        )}
      </div>
    </div>
  );
}
