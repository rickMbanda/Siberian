import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import DataEntryGrid from '../Components/DataEntryGrid';
import { calculateMean, calculateRubric } from '../Utils/calculations';
import { upsertStudentMarks } from '../api/students';
import { fetchLockStatus } from '../api/locks';
import { loadGradingRows } from '../Utils/loadGradingRows';
import ExamNavigation from '../Components/ExamNavigation';
import { getSubjectsByClass } from '../Utils/subjectsByClass';
import { useAuth } from '../contexts/AuthContext';

const EndtermExam = () => {
  const location = useLocation();
  const { user } = useAuth();
  const selectedClass = location.state?.selectedClass ||
    new URLSearchParams(location.search).get('class') ||
    user?.assignedClass || 'Playgroup';
  const selectedTerm  = location.state?.selectedTerm  || 'Term 1';
  const selectedYear  = location.state?.selectedYear  || new Date().getFullYear().toString();

  const currentExamType = 'endterm';
  const allowedExamType = user?.allowedExamType || 'opener';
  const teacherAccessDenied = user?.role === 'teacher' && allowedExamType !== currentExamType;
  const allowedExamRoute = `/${allowedExamType}`;
  const allowedExamLabel = allowedExamType === 'opener' ? 'Opener' : allowedExamType === 'midterm' ? 'Midterm' : 'Endterm';

  const subjects = getSubjectsByClass(selectedClass);

  const [students, setStudents] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [lockStatus, setLockStatus] = useState({ locked: false, effectiveAt: null });

  const loadLockStatus = async () => {
    try {
      const status = await fetchLockStatus(selectedYear, selectedTerm, 'endterm');
      setLockStatus(status);
    } catch (err) {
      console.error('Could not load lock status for endterm exam:', err);
      setLockStatus({ locked: false, effectiveAt: null });
    }
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
    title: {
      fontSize: '2.5rem', fontWeight: '700',
      color: '#000080',
      margin: 0, letterSpacing: '-1px'
    },
    subtitle: { fontSize: '1.1rem', color: '#6b7280', fontWeight: '500', marginTop: '8px' }
  };

  return (
    <div style={styles.container}>
      <ExamNavigation />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <img src="/logschool.png" alt="School Logo" style={styles.logo} />
          <div>
            <h1 style={styles.title}>End-Term Exam Results</h1>
            <p style={styles.subtitle}>
              {selectedYear} – {selectedTerm} – Class: {selectedClass}
              {loadingExisting && <span style={{ color: '#f093fb', marginLeft: 10 }}>Loading…</span>}
            </p>
            <p style={{ color: lockStatus.locked ? '#a62323' : '#1f6feb', marginTop: '8px', fontWeight: '600' }}>
              {lockStatus.locked
                ? `Locked for teacher entry.`
                : 'Open for teacher entry.'}
            </p>
          </div>
        </div>
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
