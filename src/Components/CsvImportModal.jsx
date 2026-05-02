import React, { useState, useRef } from 'react';
import { getSubjectsByClass, getSubjectDisplayName, getRubric } from '../Utils/subjectsByClass';
import { calculateMean } from '../Utils/calculations';
import { upsertStudentMarks } from '../api/students';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: '16px'
};
const MODAL = {
  background: '#fff', borderRadius: '16px', padding: '32px',
  width: '100%', maxWidth: '860px', maxHeight: '90vh',
  overflowY: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
  fontFamily: '"Inter","Segoe UI",sans-serif'
};
const BTN = (color) => ({
  padding: '9px 20px', borderRadius: '8px', border: 'none',
  fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer',
  background: color, color: '#fff', transition: 'opacity 0.2s'
});

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  }).filter(r => r.name || r['studentname'] || r['student name']);
  return { headers, rows };
};

const CsvImportModal = ({ open, onClose, selectedClass, selectedTerm, selectedYear, examType, onImported }) => {
  const subjects = getSubjectsByClass(selectedClass);
  const fileRef = useRef();
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  const handleDownloadTemplate = () => {
    const headers = ['name', ...subjects].join(',');
    const blob = new Blob([headers + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${selectedClass}_${selectedTerm}_${examType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      const nameKey = headers.find(h => ['name', 'studentname', 'student'].includes(h)) || 'name';
      const errs = [];
      const preview = rows.map((r, i) => {
        const name = r[nameKey] || r['name'] || '';
        if (!name) { errs.push(`Row ${i + 2}: missing student name`); return null; }
        const scores = {};
        subjects.forEach(s => {
          const colKey = headers.find(h => h === s || h === getSubjectDisplayName(s).toLowerCase().replace(/\s+/g, ''));
          const raw = colKey ? r[colKey] : '';
          const num = raw !== '' && raw != null ? parseFloat(raw) : null;
          scores[s] = (!isNaN(num) && num != null) ? num : null;
        });
        const scoredSubjects = subjects.map(s => scores[s]).filter(v => v !== null);
        const mean = scoredSubjects.length === subjects.length
          ? parseFloat(calculateMean(scoredSubjects).toFixed(2))
          : null;
        return { name, ...scores, mean, rubric: mean != null ? getRubric(mean) : '' };
      }).filter(Boolean);
      setParsed(preview);
      setErrors(errs);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setSaving(true);
    let saved = 0, failed = 0;
    for (const row of parsed) {
      try {
        await upsertStudentMarks({
          ...row,
          class: selectedClass,
          term: selectedTerm,
          academicYear: selectedYear,
          examType,
          examStatus: 'sat'
        });
        saved++;
      } catch { failed++; }
    }
    setSaving(false);
    setResult({ saved, failed });
    setStep(3);
    if (onImported) onImported();
  };

  const handleClose = () => {
    setStep(1); setParsed([]); setErrors([]); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={MODAL}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#0b3d91' }}>
              Import Results from CSV
            </h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              {selectedClass} · {selectedTerm} · {examType.charAt(0).toUpperCase() + examType.slice(1)} · {selectedYear}
            </p>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          {['Upload', 'Preview', 'Done'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700',
                background: step === i + 1 ? '#0b3d91' : step > i + 1 ? '#22c55e' : '#e5e7eb',
                color: step >= i + 1 ? '#fff' : '#6b7280'
              }}>{step > i + 1 ? '✓' : i + 1}</div>
              <span style={{ fontSize: '0.85rem', fontWeight: step === i + 1 ? '700' : '400', color: step === i + 1 ? '#0b3d91' : '#6b7280' }}>{label}</span>
              {i < 2 && <span style={{ color: '#d1d5db' }}>›</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#0369a1' }}>CSV format for {selectedClass}</p>
              <p style={{ margin: '0 0 12px', color: '#0369a1', fontSize: '0.875rem' }}>
                Required column: <code style={{ background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>name</code>
                &nbsp;· Optional subject columns:&nbsp;
                {subjects.map(s => <code key={s} style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', marginRight: '4px', fontSize: '0.8rem' }}>{s}</code>)}
              </p>
              <button onClick={handleDownloadTemplate} style={{ ...BTN('#0369a1'), fontSize: '0.8rem', padding: '6px 14px' }}>
                ⬇ Download CSV Template
              </button>
            </div>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '40px', cursor: 'pointer',
              background: '#f8fafc', gap: '8px', transition: 'border-color 0.2s'
            }}>
              <span style={{ fontSize: '2rem' }}>📁</span>
              <span style={{ fontWeight: '600', color: '#1e40af' }}>Click to choose your CSV file</span>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>or drag and drop here</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div>
            {errors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#dc2626' }}>⚠ {errors.length} issue(s) found (skipped):</p>
                {errors.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: '0.8rem', color: '#dc2626' }}>{e}</p>)}
              </div>
            )}
            <p style={{ margin: '0 0 12px', color: '#374151', fontWeight: '600' }}>
              {parsed.length} student{parsed.length !== 1 ? 's' : ''} ready to import:
            </p>
            <div style={{ overflowX: 'auto', marginBottom: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#0b3d91', color: '#fff' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Student Name</th>
                    {subjects.map(s => (
                      <th key={s} style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>{getSubjectDisplayName(s)}</th>
                    ))}
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Mean</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '7px 12px', fontWeight: '600', color: '#0b3d91', borderBottom: '1px solid #f3f4f6' }}>{row.name}</td>
                      {subjects.map(s => (
                        <td key={s} style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', color: row[s] == null ? '#d1d5db' : '#111827' }}>
                          {row[s] ?? '—'}
                        </td>
                      ))}
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '700', borderBottom: '1px solid #f3f4f6', color: row.mean != null ? '#0b3d91' : '#d1d5db' }}>
                        {row.mean != null ? row.mean.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setStep(1); setParsed([]); setErrors([]); if (fileRef.current) fileRef.current.value = ''; }} style={{ ...BTN('#6b7280') }}>← Back</button>
              <button onClick={handleSave} disabled={saving || parsed.length === 0} style={{ ...BTN(parsed.length === 0 ? '#d1d5db' : '#16a34a'), cursor: parsed.length === 0 ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : `✓ Save ${parsed.length} Students`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && result && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>{result.failed === 0 ? '🎉' : '⚠'}</div>
            <h3 style={{ margin: '0 0 8px', color: '#111827', fontSize: '1.3rem' }}>Import Complete</h3>
            <p style={{ margin: '0 0 24px', color: '#6b7280' }}>
              <span style={{ color: '#16a34a', fontWeight: '700' }}>{result.saved} saved</span>
              {result.failed > 0 && <span style={{ color: '#dc2626', fontWeight: '700' }}> · {result.failed} failed</span>}
            </p>
            <button onClick={handleClose} style={{ ...BTN('#0b3d91') }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvImportModal;
