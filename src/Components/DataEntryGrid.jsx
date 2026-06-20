import React, { useEffect, useCallback, useRef, useState } from 'react';
import { getSubjectsByClass, getSubjectDisplayName } from '../Utils/subjectsByClass';

const DataEntryGrid = ({
  students,
  updateStudent,
  saveStudent,
  selectedClass,
  locked = false
}) => {
  const subjects = getSubjectsByClass(selectedClass || 'Grade 1');
  const [savingStudents, setSavingStudents] = useState(new Set());
  const [savedStudents, setSavedStudents]   = useState(new Set());

  // Auto-save when required fields are valid
  const autoSaveStudent = useCallback(async (student) => {
    const hasName    = student.name && student.name.trim() !== '';
    const examStatus = student.examStatus || 'sat';
    const isReadyToSave = hasName && (
      examStatus === 'absent' ||
      examStatus === 'incomplete' ||
      subjects.every((subject) =>
        student[subject] !== '' &&
        student[subject] != null &&
        !isNaN(parseFloat(student[subject]))
      )
    );

    if (!isReadyToSave || locked) return;

    let alreadySaving = false;
    setSavingStudents((prev) => {
      if (prev.has(student.id)) { alreadySaving = true; return prev; }
      return new Set(prev).add(student.id);
    });
    if (alreadySaving) return;

    try {
      await saveStudent(student);
      setSavedStudents((prev) => new Set(prev).add(student.id));
      setTimeout(() => {
        setSavingStudents((prev) => {
          const next = new Set(prev);
          next.delete(student.id);
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSavingStudents((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  }, [subjects, saveStudent]);

  // Debounce autosave per student
  const studentTimeouts = useRef(new Map());
  useEffect(() => {
    students.forEach((student) => {
      if (!student.name || student.name.trim() === '') return;
      if (studentTimeouts.current.has(student.id)) {
        clearTimeout(studentTimeouts.current.get(student.id));
      }
      const timeout = setTimeout(() => {
        autoSaveStudent(student);
        studentTimeouts.current.delete(student.id);
      }, 1500);
      studentTimeouts.current.set(student.id, timeout);
    });

    return () => {
      studentTimeouts.current.forEach((t) => clearTimeout(t));
      studentTimeouts.current.clear();
    };
  }, [students, autoSaveStudent]);

  /* ── Keyboard navigation ────────────────────────────────────── */
  const gridRef = useRef(null);

  const focusCell = useCallback((row, col) => {
    if (!gridRef.current) return;
    const el = gridRef.current.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!el) return;
    el.focus();
    try { el.select(); } catch (_) {}
  }, []);

  // col 0 = Exam Status select, col 1..N = subject inputs
  const totalCols = subjects.length + 1;

  const handleKeyDown = useCallback((e, rowIndex, colIndex) => {
    const totalRows = students.length;
    const { key } = e;

    if (key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex + 1 < totalRows) focusCell(rowIndex + 1, colIndex);
    } else if (key === 'Enter' || key === 'ArrowRight') {
      e.preventDefault();
      if (colIndex + 1 < totalCols) {
        focusCell(rowIndex, colIndex + 1);
      } else if (rowIndex + 1 < totalRows) {
        focusCell(rowIndex + 1, 0);
      }
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex - 1 >= 0) focusCell(rowIndex - 1, colIndex);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      if (colIndex - 1 >= 0) {
        focusCell(rowIndex, colIndex - 1);
      } else if (rowIndex - 1 >= 0) {
        focusCell(rowIndex - 1, totalCols - 1);
      }
    }
  }, [students.length, totalCols, focusCell]);

  const styles = {
    container: {
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    tableWrapper: {
      overflowX: 'auto',
      maxHeight: '600px',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: '#fff'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px',
      minWidth: '800px'
    },
    tableHeader: {
      backgroundColor: '#4a90e2',
      color: '#fff',
      fontWeight: 'bold',
      padding: '15px 8px',
      textAlign: 'center',
      fontSize: '12px',
      borderBottom: '2px solid #357abd',
      position: 'sticky',
      top: '0',
      zIndex: '10'
    },
    tableCell: {
      padding: '8px',
      borderBottom: '1px solid #e9ecef',
      textAlign: 'center'
    },
    input: {
      width: '100%',
      padding: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '12px',
      textAlign: 'center',
      backgroundColor: '#fff',
      transition: 'border-color 0.2s ease',
      boxSizing: 'border-box'
    },
    nameCell: {
      textAlign: 'left',
      minWidth: '150px',
      fontWeight: 600,
      color: '#1f2937'
    },
    statusIndicator: {
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 'bold',
      textAlign: 'center',
      minWidth: '80px',
      display: 'inline-block'
    },
    statusSaving: {
      backgroundColor: '#fff3cd',
      color: '#856404',
      border: '1px solid #ffeaa7'
    },
    statusSaved: {
      backgroundColor: '#d1edff',
      color: '#0c5460',
      border: '1px solid #bee5eb'
    },
    statusPending: {
      backgroundColor: '#f8f9fa',
      color: '#6c757d',
      border: '1px solid #dee2e6'
    },
    tableRowEven: { backgroundColor: '#f8f9fa' },
    tableRowOdd:  { backgroundColor: '#fff' },
    lockBanner: {
      backgroundColor: '#edf2ff',
      border: '1px solid #c7d2fe',
      color: '#312e81',
      borderRadius: '8px',
      padding: '14px 18px',
      marginBottom: '18px',
      fontSize: '14px'
    },
    emptyRoster: {
      padding: '40px 20px',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '15px',
      background: '#fff',
      borderRadius: '8px'
    }
  };

  const hasRoster = students.length > 0;

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#2c3e50', fontSize: '18px', margin: 0 }}>
          Enter the marks - {selectedClass || 'Grade 1'}
          {hasRoster && (
            <span style={{ color: '#28a745', marginLeft: '10px', fontSize: '14px' }}>
              ({students.length} student{students.length === 1 ? '' : 's'})
            </span>
          )}
        </h3>
        <p style={{ color: '#6c757d', fontSize: '14px', margin: '8px 0 0 0' }}>
          💡 Marks save automatically when all required fields are filled. To add or remove a student, use the Manage Students module.
          &nbsp;Use <strong>arrow keys</strong> or <strong>Enter</strong> to move between cells.
        </p>
      </div>
      {locked && (
        <div style={styles.lockBanner}>
          🔒 This exam is locked for teacher input. Only an admin can unlock marks or change the lock settings.
        </div>
      )}

      {!hasRoster ? (
        <div style={styles.emptyRoster}>
          📭 No students in this class yet for this academic year.
          <br />
          Ask the admin to add students using the <strong>Manage Students</strong> module.
        </div>
      ) : (
        <div style={styles.tableWrapper} ref={gridRef}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableHeader, minWidth: '150px' }}>Name</th>
                <th style={{ ...styles.tableHeader, minWidth: '100px' }}>Exam Status</th>
                {subjects.map((subject) => (
                  <th key={subject} style={{ ...styles.tableHeader, minWidth: '80px' }}>
                    {getSubjectDisplayName(subject)}
                  </th>
                ))}
                <th style={{ ...styles.tableHeader, minWidth: '80px' }}>Mean</th>
                <th style={{ ...styles.tableHeader, minWidth: '80px' }}>Rubric</th>
                <th style={{ ...styles.tableHeader, minWidth: '80px' }}>Class</th>
                <th style={{ ...styles.tableHeader, minWidth: '90px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, rowIndex) => (
                <tr
                  key={student.id || student._id || rowIndex}
                  style={rowIndex % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}
                >
                  <td style={{ ...styles.tableCell, ...styles.nameCell }}>
                    {student.name}
                  </td>
                  <td style={styles.tableCell}>
                    <select
                      data-row={rowIndex}
                      data-col={0}
                      style={{
                        ...styles.input,
                        cursor: locked ? 'not-allowed' : 'pointer',
                        backgroundColor: student.examStatus === 'absent' ? '#ffe6e6'
                          : student.examStatus === 'incomplete' ? '#fff3cd'
                          : '#e8f5e9'
                      }}
                      value={student.examStatus || 'sat'}
                      disabled={locked}
                      onChange={(e) => {
                        if (locked) return;
                        const newStatus = e.target.value;
                        updateStudent(student.id, 'examStatus', newStatus);
                        if (newStatus === 'absent') {
                          subjects.forEach((subject) => updateStudent(student.id, subject, ''));
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                    >
                      <option value="sat">Sat</option>
                      <option value="absent">Absent</option>
                      <option value="incomplete">Incomplete</option>
                    </select>
                  </td>
                  {subjects.map((subject, subjectIndex) => (
                    <td key={subject} style={styles.tableCell}>
                      <input
                        data-row={rowIndex}
                        data-col={subjectIndex + 1}
                        style={{
                          ...styles.input,
                          backgroundColor: student.examStatus === 'absent' ? '#f8f9fa' : '#fff',
                          color: student.examStatus === 'absent' ? '#6c757d' : 'inherit',
                          cursor: locked ? 'not-allowed' : 'text'
                        }}
                        type="number"
                        min="0"
                        max="100"
                        value={student[subject] ?? ''}
                        disabled={student.examStatus === 'absent' || locked}
                        onChange={(e) => {
                          if (student.examStatus === 'absent' || locked) return;
                          const value = e.target.value;
                          if (value === '') {
                            updateStudent(student.id, subject, '');
                            return;
                          }
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                            updateStudent(student.id, subject, value);
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, subjectIndex + 1)}
                        placeholder={student.examStatus === 'absent' ? 'ABS' : '0-100'}
                      />
                    </td>
                  ))}
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#2980b9' }}>
                      {typeof student.mean === 'number' ? student.mean.toFixed(2) : '-'}
                    </strong>
                  </td>
                  <td style={styles.tableCell}>
                    <strong style={{ color: '#27ae60' }}>{student.rubric || '-'}</strong>
                  </td>
                  <td style={styles.tableCell}>
                    <strong>{student.class || selectedClass || '-'}</strong>
                  </td>
                  <td style={styles.tableCell}>
                    {(() => {
                      const examStatus = student.examStatus || 'sat';
                      const hasAllSubjects = subjects.every((subject) =>
                        student[subject] !== '' &&
                        student[subject] != null &&
                        !isNaN(parseFloat(student[subject]))
                      );
                      const isReady = examStatus === 'absent' ||
                        examStatus === 'incomplete' || hasAllSubjects;

                      if (savingStudents.has(student.id)) {
                        return <span style={{ ...styles.statusIndicator, ...styles.statusSaving }}>💾 Saving...</span>;
                      }
                      if (savedStudents.has(student.id) && isReady) {
                        return <span style={{ ...styles.statusIndicator, ...styles.statusSaved }}>✅ Saved</span>;
                      }
                      if (isReady) {
                        return <span style={{ ...styles.statusIndicator, ...styles.statusSaved }}>✅ Complete</span>;
                      }
                      const missing = subjects.filter((s) =>
                        student[s] === '' || student[s] == null || isNaN(parseFloat(student[s]))
                      );
                      return (
                        <span
                          style={{ ...styles.statusIndicator, ...styles.statusPending }}
                          title={`Missing: ${missing.join(', ')}`}
                        >
                          ⏳ Pending
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DataEntryGrid;
