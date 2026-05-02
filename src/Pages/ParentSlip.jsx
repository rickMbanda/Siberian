import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSlipByPin } from '../api/parentPins';

const SUBJECT_LABELS = {
  maths:'Maths', english:'English', kiswahili:'Kiswahili', language:'Language',
  reading:'Reading', environmental:'Environmental', integrated:'Integrated',
  creative:'Creative Arts', cre:'CRE', kusoma:'Kusoma', social:'Social Studies',
  pretech:'Pre-Tech', agriculture:'Agriculture'
};

const EXAM_LABELS = { opener: 'Opener Exam', midterm: 'Mid-Term Exam', endterm: 'End-Term Exam' };

const bandColor = (mean) => {
  if (mean >= 80) return { bg: '#dcfce7', text: '#14532d' };
  if (mean >= 65) return { bg: '#d1fae5', text: '#065f46' };
  if (mean >= 50) return { bg: '#fef9c3', text: '#854d0e' };
  return { bg: '#fee2e2', text: '#991b1b' };
};

const ParentSlip = () => {
  const { pin } = useParams();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSlipByPin(pin);
        setSlip(data);
      } catch (err) {
        setError(err.message || 'Invalid or expired PIN.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pin]);

  const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', fontFamily: '"Inter","Segoe UI",sans-serif' },
    card: { background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', width: '100%', maxWidth: '520px', overflow: 'hidden' },
  };

  if (loading) return (
    <div style={{ ...S.page, alignItems: 'center' }}>
      <div style={{ color: '#0369a1', fontSize: '1.1rem', fontWeight: '600' }}>Loading result slip…</div>
    </div>
  );

  if (error) return (
    <div style={{ ...S.page, alignItems: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ color: '#dc2626', margin: '0 0 8px', fontSize: '1.2rem' }}>Access Denied</h2>
        <p style={{ color: '#6b7280', margin: 0 }}>{error}</p>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '12px' }}>
          Please contact the school if you believe this is an error.
        </p>
      </div>
    </div>
  );

  if (!slip) return null;

  const subjectEntries = Object.entries(slip.subjects || {});
  const { bg: meanBg, text: meanText } = bandColor(slip.mean ?? 0);

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0b3d91 0%, #1a56c4 100%)', padding: '28px 28px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src="/logschool.png" alt="School Logo" style={{ width: '54px', height: '54px', objectFit: 'contain', filter: 'brightness(0) invert(1)', borderRadius: '8px' }} />
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '-0.3px' }}>Spring Valley Baptist School</div>
              <div style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: '2px' }}>Student Result Slip</div>
            </div>
          </div>
        </div>

        {/* Student info */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: '700', color: '#0b3d91' }}>{slip.studentName}</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[slip.className, slip.term, EXAM_LABELS[slip.examType] || slip.examType, `Year ${slip.academicYear}`].map((tag, i) => (
              <span key={i} style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Subject scores */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6' }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Subject Scores</p>
          {slip.examStatus === 'absent' ? (
            <p style={{ color: '#dc2626', fontWeight: '600' }}>Student was absent for this exam.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subjectEntries.map(([key, score]) => {
                const pct = Math.min(100, Math.max(0, score || 0));
                const barColor = score >= 80 ? '#22c55e' : score >= 65 ? '#84cc16' : score >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '120px', fontSize: '0.875rem', fontWeight: '600', color: '#374151', flexShrink: 0 }}>
                      {SUBJECT_LABELS[key] || key}
                    </span>
                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '6px', height: '12px' }}>
                      <div style={{ width: `${pct}%`, background: barColor, borderRadius: '6px', height: '12px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ width: '36px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '700', color: '#111827', flexShrink: 0 }}>
                      {score != null ? score : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mean + rubric */}
        <div style={{ padding: '20px 28px', borderBottom: slip.termlyAverage != null ? '1px solid #f3f4f6' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: meanBg, borderRadius: '12px', padding: '14px 20px', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: meanText, lineHeight: 1 }}>
                {slip.mean != null ? slip.mean.toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: meanText, fontWeight: '600', marginTop: '3px', opacity: 0.8 }}>Mean Score</div>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance</p>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: meanText }}>{slip.rubric || '—'}</p>
            </div>
          </div>
        </div>

        {/* Termly average (if available) */}
        {slip.termlyAverage != null && (
          <div style={{ padding: '16px 28px', background: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: '0 0 2px', fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Termly Average (Opener 30% + Midterm 30% + Endterm 40%)</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0b3d91' }}>
              {slip.termlyAverage.toFixed(1)} — {slip.termlyRubric || ''}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '16px 28px', background: '#f8fafc', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#9ca3af' }}>
            This is an official result slip from Spring Valley Baptist School.
          </p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#d1d5db' }}>
            For queries, contact the school administration · PIN: {pin}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentSlip;
