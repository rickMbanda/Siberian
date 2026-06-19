import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import DataEntryGrid from '../Components/DataEntryGrid';
import { calculateMean, calculateRubric } from '../Utils/calculations';
import { upsertStudentMarks } from '../api/students';
import { fetchLockStatus, setLockConfig, clearLock } from '../api/locks';
import { loadGradingRows } from '../Utils/loadGradingRows';
import ExamNavigation from '../Components/ExamNavigation';
import { getSubjectsByClass } from '../Utils/subjectsByClass';
import { useAuth } from '../contexts/AuthContext';
import CsvImportModal from '../Components/CsvImportModal';

const CLASSES = ['Playgroup','PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9'];
const TERMS   = ['Term 1','Term 2','Term 3'];
const currentYear = new Date().getFullYear();
const YEARS   = Array.from({ length: 8 }, (_, i) => (currentYear - 2 + i).toString());

const EndtermExam = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [selectedClass, setSelectedClass] = useState(
    location.state?.selectedClass ||
    new URLSearchParams(location.search).get('class') ||
    user?.assignedClass || 'Playgroup'
  );
  const [selectedTerm, setSelectedTerm] = useState(location.state?.selectedTerm || 'Term 1');
  const [selectedYear, setSelectedYear] = useState(location.state?.selectedYear || currentYear.toString());

  const currentExamType = 'endterm';
  const allowedExamType = user?.allowedExamType || 'opener';
  const teacherAccessDenied = user?.role === 'teacher' && allowedExamType !== currentExamType;
  const allowedExamRoute = `/${allowedExamType}`;
  const allowedExamLabel = allowedExamType === 'opener' ? 'Opener' : allowedExamType === 'midterm' ? 'Midterm' : 'Endterm';

  const subjects = getSubjectsByClass(selectedClass);

  const [students, setStudents] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [lockStatus, setLockStatus] = useState({ locked: false, effectiveAt: null, id: null });
  const [csvOpen, setCsvOpen] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(0);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState('');

  const loadLockStatus = async () => {
    try {
      const status = await fetchLockStatus(selectedYear, selectedTerm, 'endterm');
      setLockStatus(status);
    } catch (err) {
      console.error('Could not load lock status for endterm exam:', err);
      setLockStatus({ locked: false, effectiveAt: null, id: null });
    }
  };

  const handleLock = async () => {
    setLockBusy(true); setLockError('');
    try {
      await setLockConfig({ academicYear: selectedYear, term: selectedTerm, examType: 'endterm', gracePeriodMinutes: Number(gracePeriod) || 0 });
      await loadLockStatus();
    } catch (err) {
      setLockError(err.message || 'Failed to lock.');
    } finally { setLockBusy(false); }
  };

  const handleUnlock = async () => {
    setLockBusy(true); setLockError('');
    try {
      await clearLock(lockStatus.id);
      await loadLockStatus();
    } catch (err) {
      setLockError(err.message || 'Failed to unlock.');
    } finally { setLockBusy(false); }
  };

  useEffect(() => {
    const load = async () => {
      setLoadingExisting(true);
      try {
        const rows = await loadGradingRows({
          selectedClass,
          selectedYear,
          selectedTerm,
          examType: 'endterm',
          subjects
        });
        setStudents(rows);
      } catch (err) {
        console.error('Could not load class roster for endterm:', err);
        setStudents([]);
      } finally {
        setLoadingExisting(false);
      }
    };
    load();
    loadLockStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedTerm, selectedYear]);

  if (teacherAccessDenied) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)', padding: '20px' }}>
        <ExamNavigation />
        <div style={{ maxWidth: '900px', margin: '0 auto', background: 'rgba(255,255,255,0.95)', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
          <h1 style={{ color: '#000080', fontSize: '2.5rem', marginBottom: '20px' }}>Access Restricted</h1>
          <p style={{ color: '#334155', fontSize: '1rem', marginBottom: '16px' }}>
            Your account can only enter marks for the <strong>{allowedExamLabel}</strong> exam.
            Please use the allowed exam page below.
          </p>
          <Link to={allowedExamRoute} style={{ display: 'inline-block', padding: '12px 20px', borderRadius: '12px', background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: '600' }}>
            Go to {allowedExamLabel} Exam
          </Link>
        </div>
      </div>
    );
  }

  const saveStudent = async (student) => {
    if (lockStatus.locked) return;
    const payload = {
      ...student,
      class:        selectedClass,
      term:         selectedTerm,
      academicYear: selectedYear,
      examType:     'endterm'
    };
    await upsertStudentMarks(payload);
  };

  const updateStudent = (id, field, value) => {
    setStudents(prev =>
      prev.map(student => {
        if (student.id !== id) return student;
        const updated = {
          ...student,
          [field]: value,
          examType: 'endterm', class: selectedClass,
          term: selectedTerm, academicYear: selectedYear
        };
        const status = updated.examStatus || 'sat';
        if (status === 'absent') {
          subjects.forEach(s => { updated[s] = ''; });
          updated.mean = 0; updated.rubric = '';
        } else if (status === 'incomplete') {
          const scores = subjects.map(s => parseFloat(updated[s])).filter(n => !isNaN(n));
          updated.mean   = scores.length > 0 ? calculateMean(scores) : 0;
          updated.rubric = '';
        } else {
          const scores = subjects.map(s => parseFloat(updated[s])).filter(n => !isNaN(n));
          if (scores.length === subjects.length) {
            updated.mean   = calculateMean(scores);
            updated.rubric = calculateRubric(updated.mean);
          } else {
            updated.mean = ''; updated.rubric = '';
          }
        }
        updated._modified = Date.now();
        return updated;
      })
    );
  };

  const selStyle = {
    padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #c7d2fe',
    background: '#fff', color: '#1e3a5f', fontWeight: '600', fontSize: '0.92rem', cursor: 'pointer'
  };

  const styles = {
    container: {
      background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
      minHeight: '100vh', padding: '20px',
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    contentWrapper: {
      maxWidth: '1600px', margin: '0 auto',
      background: 'rgba(255,255,255,0.95)', borderRadius: '24px',
      padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
    },
    header: {
      display: 'flex', alignItems: 'center', gap: '20px',
      marginBottom: '40px', padding: '20px',
      background: 'linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)',
      borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
    },
    logo:  { height: '60px', width: 'auto', borderRadius: '12px' },
    title: { fontSize: '2.5rem', fontWeight: '700', color: '#000080', margin: 0, letterSpacing: '-1px' },
    subtitle: { fontSize: '1.1rem', color: '#6b7280', fontWeight: '500', marginTop: '8px' }
  };

  return (
    <div style={styles.container}>
      <ExamNavigation />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <img src="/logschool.png" alt="School Logo" style={styles.logo} />
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>End-Term Exam Results</h1>
            {isAdmin ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Year:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={selStyle}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Term:</label>
                <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} style={selStyle}>
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Class:</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={selStyle}>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {loadingExisting && <span style={{ color: '#f093fb', fontSize: '0.85rem' }}>Loading…</span>}
              </div>
            ) : (
              <p style={styles.subtitle}>
                {selectedYear} – {selectedTerm} – Class: {selectedClass}
                {loadingExisting && <span style={{ color: '#f093fb', marginLeft: 10 }}>Loading…</span>}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              <span style={{ color: lockStatus.locked ? '#a62323' : '#1f6feb', fontWeight: '700', fontSize: '0.95rem' }}>
                {lockStatus.locked ? '🔒 Locked for teacher entry.' : '🔓 Open for teacher entry.'}
              </span>
              {lockStatus.locked && lockStatus.effectiveAt && (
                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  (since {new Date(lockStatus.effectiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
              {isAdmin && (
                lockStatus.locked ? (
                  <button
                    onClick={handleUnlock}
                    disabled={lockBusy}
                    style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '700', fontSize: '0.82rem', cursor: lockBusy ? 'wait' : 'pointer', opacity: lockBusy ? 0.7 : 1 }}
                  >
                    {lockBusy ? '…' : '🔓 Unlock'}
                  </button>
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={gracePeriod}
                      onChange={e => setGracePeriod(e.target.value)}
                      placeholder="Grace mins"
                      title="Grace period in minutes before lock takes effect (0 = immediate)"
                      style={{ width: '90px', padding: '4px 8px', borderRadius: '7px', border: '1.5px solid #c7d2fe', fontSize: '0.82rem', fontWeight: '600' }}
                    />
                    <button
                      onClick={handleLock}
                      disabled={lockBusy}
                      style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', background: '#0b3d91', color: '#fff', fontWeight: '700', fontSize: '0.82rem', cursor: lockBusy ? 'wait' : 'pointer', opacity: lockBusy ? 0.7 : 1 }}
                    >
                      {lockBusy ? '…' : '🔒 Lock'}
                    </button>
                  </>
                )
              )}
              {lockError && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{lockError}</span>}
            </div>
          </div>
          {!lockStatus.locked && (
            <button
              onClick={() => setCsvOpen(true)}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#0369a1,#0284c7)', color: '#fff', fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center' }}
            >
              📁 Import CSV
            </button>
          )}
        </div>
        <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} selectedClass={selectedClass} selectedTerm={selectedTerm} selectedYear={selectedYear} examType="endterm" onImported={async () => { const rows = await import('../Utils/loadGradingRows').then(m => m.loadGradingRows({ selectedClass, selectedYear, selectedTerm, examType: 'endterm', subjects })); setStudents(rows); }} />
        <DataEntryGrid
          students={students}
          updateStudent={updateStudent}
          saveStudent={saveStudent}
          selectedClass={selectedClass}
          selectedYear={selectedYear}
          locked={lockStatus.locked}
        />
      </div>
    </div>
  );
};

export default EndtermExam;
