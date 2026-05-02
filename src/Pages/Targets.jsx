import React, { useState, useEffect } from 'react';
import ExamNavigation from '../Components/ExamNavigation';
import { fetchAllTargets, saveTarget, deleteTarget } from '../api/targets';

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', fontFamily: '"Inter","Segoe UI",sans-serif' },
  wrap: { maxWidth: '720px', margin: '0 auto', padding: '32px 20px' },
  card: { background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: '20px' },
  title: { fontSize: '1.8rem', fontWeight: '700', color: '#14532d', margin: '0 0 6px' },
  sub: { color: '#6b7280', fontSize: '0.9rem', margin: 0 },
  label: { fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' },
  input: { padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none', width: '120px' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', outline: 'none' },
  btn: (c, dis) => ({ padding: '9px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '0.875rem', cursor: dis ? 'not-allowed' : 'pointer', background: dis ? '#e5e7eb' : c, color: dis ? '#9ca3af' : '#fff' }),
};

const Targets = () => {
  const currentYear = new Date().getFullYear().toString();
  const years = [];
  for (let y = parseInt(currentYear) - 2; y <= parseInt(currentYear) + 2; y++) years.push(y.toString());

  const [targets, setTargets] = useState([]);
  const [editYear, setEditYear] = useState(currentYear);
  const [editMean, setEditMean] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    try {
      const data = await fetchAllTargets();
      setTargets(Array.isArray(data) ? data : []);
    } catch { setTargets([]); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const existing = targets.find(t => t.academicYear === editYear);
    setEditMean(existing ? String(existing.targetMean) : '');
  }, [editYear, targets]);

  const show = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000); };

  const handleSave = async () => {
    const mean = parseFloat(editMean);
    if (isNaN(mean) || mean < 0 || mean > 100) { show('Target must be a number between 0 and 100.'); return; }
    setSaving(true);
    try {
      await saveTarget({ academicYear: editYear, targetMean: mean });
      await load();
      show('Target saved successfully.');
    } catch (err) { show('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (year) => {
    if (!window.confirm(`Remove the target for ${year}?`)) return;
    try {
      await deleteTarget(year);
      await load();
      show('Target removed.');
    } catch (err) { show('Error: ' + err.message); }
  };

  return (
    <div style={S.page}>
      <ExamNavigation />
      <div style={S.wrap}>
        <div style={S.card}>
          <h1 style={S.title}>Performance Targets</h1>
          <p style={S.sub}>
            Set a school-wide target mean score for each academic year.
            This target appears as a dashed line on the Analytics Class Comparison chart
            and highlights any class that falls below it in red.
          </p>
        </div>

        <div style={S.card}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: '700', color: '#14532d' }}>
            Set / Update Target
          </h2>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span style={S.label}>Academic Year</span>
              <select style={S.select} value={editYear} onChange={e => setEditYear(e.target.value)}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <span style={S.label}>Target Mean Score (0–100)</span>
              <input
                type="number" min="0" max="100" step="0.5"
                style={S.input}
                value={editMean}
                onChange={e => setEditMean(e.target.value)}
                placeholder="e.g. 65"
              />
            </div>
            <button onClick={handleSave} disabled={saving || editMean === ''} style={S.btn('#16a34a', saving || editMean === '')}>
              {saving ? 'Saving…' : '💾 Save Target'}
            </button>
          </div>
          {feedback && (
            <p style={{ marginTop: '12px', color: feedback.startsWith('Error') ? '#dc2626' : '#16a34a', fontWeight: '600', fontSize: '0.875rem' }}>
              {feedback}
            </p>
          )}
        </div>

        <div style={S.card}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: '700', color: '#14532d' }}>Current Targets</h2>
          {targets.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No targets set yet. Use the form above to add one.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#14532d', color: '#fff' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: '600' }}>Academic Year</th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontWeight: '600' }}>Target Mean</th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontWeight: '600' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t, i) => (
                  <tr key={t.academicYear} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '9px 14px', fontWeight: '600', color: '#14532d', borderBottom: '1px solid #f3f4f6' }}>{t.academicYear}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ background: '#dcfce7', color: '#14532d', padding: '3px 14px', borderRadius: '20px', fontWeight: '700' }}>
                        {t.targetMean}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                      <button onClick={() => handleDelete(t.academicYear)} style={{ ...S.btn('#dc2626', false), padding: '5px 14px', fontSize: '0.8rem' }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...S.card, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534', lineHeight: '1.6' }}>
            <strong>How it works:</strong> Go to <strong>Analytics → Class Comparison</strong> and the target mean will appear as a dashed line across the bar chart.
            Any class whose mean falls below the target line is highlighted in red so the head teacher can see at a glance where intervention is needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Targets;
