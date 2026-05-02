import React, { useState, useEffect } from 'react';
import ExamNavigation from '../Components/ExamNavigation';
import { fetchAllStudents } from '../api/students';
import { promoteRoster } from '../api/students';

const CLASSES = [
  'Playgroup','PP1','PP2','Grade 1','Grade 2','Grade 3',
  'Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9'
];
const CLASS_NEXT = {
  'Playgroup':'PP1','PP1':'PP2','PP2':'Grade 1','Grade 1':'Grade 2',
  'Grade 2':'Grade 3','Grade 3':'Grade 4','Grade 4':'Grade 5','Grade 5':'Grade 6',
  'Grade 6':'Grade 7','Grade 7':'Grade 8','Grade 8':'Grade 9','Grade 9':null
};

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', fontFamily: '"Inter","Segoe UI",sans-serif' },
  wrap: { maxWidth: '960px', margin: '0 auto', padding: '32px 20px' },
  card: { background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: '20px' },
  title: { fontSize: '1.8rem', fontWeight: '700', color: '#0b3d91', margin: '0 0 6px' },
  sub: { color: '#6b7280', fontSize: '0.9rem', margin: 0 },
  label: { fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', outline: 'none', minWidth: '120px' },
  btn: (c) => ({ padding: '10px 24px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer', background: c, color: '#fff' }),
  th: { padding: '9px 14px', textAlign: 'left', fontWeight: '600', fontSize: '0.82rem', background: '#0b3d91', color: '#fff' },
  td: { padding: '8px 14px', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6' },
};

const Promotion = () => {
  const currentYear = new Date().getFullYear().toString();
  const [sourceYear, setSourceYear] = useState(currentYear);
  const [targetYear, setTargetYear] = useState((parseInt(currentYear) + 1).toString());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const years = [];
  for (let y = parseInt(currentYear) - 3; y <= parseInt(currentYear) + 2; y++) years.push(y.toString());

  const handlePreview = async () => {
    setLoading(true);
    setPreview(null);
    setResults(null);
    setConfirmed(false);
    try {
      const all = await fetchAllStudents(sourceYear);
      const byClass = {};
      all.forEach(r => {
        if (!byClass[r.class]) byClass[r.class] = new Set();
        byClass[r.class].add(r.name);
      });
      const rows = CLASSES
        .filter(cls => byClass[cls] && byClass[cls].size > 0)
        .map(cls => ({
          fromClass: cls,
          toClass: CLASS_NEXT[cls],
          count: byClass[cls].size,
          graduating: CLASS_NEXT[cls] === null
        }));
      setPreview(rows);
    } catch (err) {
      alert('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!window.confirm(`This will enrol students from ${sourceYear} into ${targetYear}. Proceed?`)) return;
    setExecuting(true);
    const res = [];
    for (const row of preview.filter(r => !r.graduating)) {
      try {
        const r = await promoteRoster({ fromClass: row.fromClass, fromYear: sourceYear, toClass: row.toClass, toYear: targetYear });
        res.push({ ...row, promoted: r.promoted, skipped: r.skippedExisting?.length || 0, ok: true });
      } catch (err) {
        res.push({ ...row, ok: false, error: err.message });
      }
    }
    setResults(res);
    setExecuting(false);
  };

  const toPromote = preview ? preview.filter(r => !r.graduating) : [];
  const graduating = preview ? preview.filter(r => r.graduating) : [];

  return (
    <div style={S.page}>
      <ExamNavigation />
      <div style={S.wrap}>
        <div style={S.card}>
          <h1 style={S.title}>Year-End Student Promotion</h1>
          <p style={S.sub}>Move all students from one academic year to the next class in a new year.</p>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span style={S.label}>Source Year (current)</span>
              <select style={S.select} value={sourceYear} onChange={e => { setSourceYear(e.target.value); setPreview(null); setResults(null); }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#6b7280', paddingBottom: '6px' }}>→</div>
            <div>
              <span style={S.label}>Target Year (new)</span>
              <select style={S.select} value={targetYear} onChange={e => { setTargetYear(e.target.value); setPreview(null); setResults(null); }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handlePreview} disabled={loading || sourceYear === targetYear} style={{ ...S.btn('#0b3d91'), opacity: sourceYear === targetYear ? 0.5 : 1 }}>
              {loading ? 'Loading…' : '🔍 Preview Promotion'}
            </button>
          </div>
          {sourceYear === targetYear && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '8px' }}>Source and target year must be different.</p>}
        </div>

        {preview && !results && (
          <div style={S.card}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: '700', color: '#0b3d91' }}>
              Promotion Preview: {sourceYear} → {targetYear}
            </h2>

            {toPromote.length > 0 && (
              <>
                <p style={{ margin: '0 0 10px', fontWeight: '600', color: '#374151' }}>⬆ {toPromote.length} class{toPromote.length !== 1 ? 'es' : ''} to promote ({toPromote.reduce((a, b) => a + b.count, 0)} students):</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead><tr><th style={S.th}>From Class</th><th style={S.th}>To Class</th><th style={{ ...S.th, textAlign: 'center' }}>Students</th></tr></thead>
                  <tbody>
                    {toPromote.map((r, i) => (
                      <tr key={r.fromClass} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={S.td}><strong>{r.fromClass}</strong> ({sourceYear})</td>
                        <td style={{ ...S.td, color: '#16a34a', fontWeight: '600' }}>{r.toClass} ({targetYear})</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {graduating.length > 0 && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#854d0e' }}>🎓 Graduating (Grade 9 — no further class):</p>
                {graduating.map(r => <p key={r.fromClass} style={{ margin: '2px 0', color: '#92400e', fontSize: '0.875rem' }}>{r.fromClass}: {r.count} student{r.count !== 1 ? 's' : ''}</p>)}
              </div>
            )}

            {toPromote.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No students found in {sourceYear} to promote.</p>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#374151' }}>
                  <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                  I confirm I want to promote all students from {sourceYear} to {targetYear}
                </label>
                <button onClick={handleExecute} disabled={!confirmed || executing} style={{ ...S.btn(confirmed ? '#16a34a' : '#d1d5db'), cursor: confirmed ? 'pointer' : 'not-allowed' }}>
                  {executing ? 'Promoting…' : '🚀 Execute Promotion'}
                </button>
              </div>
            )}
          </div>
        )}

        {results && (
          <div style={S.card}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: '700', color: '#16a34a' }}>✅ Promotion Complete</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead><tr>
                <th style={S.th}>Class Transition</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Promoted</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Already Enrolled</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Status</th>
              </tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.fromClass} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={S.td}>{r.fromClass} → {r.toClass}</td>
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: '700', color: '#16a34a' }}>{r.ok ? r.promoted : '—'}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#6b7280' }}>{r.ok ? r.skipped : '—'}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      {r.ok ? <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ Done</span> : <span style={{ color: '#dc2626' }}>✗ {r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => { setPreview(null); setResults(null); setConfirmed(false); }} style={S.btn('#0b3d91')}>
              Run Another Promotion
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Promotion;
