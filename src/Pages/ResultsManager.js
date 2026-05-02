import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchResults,
  updateResult,
  deleteResult
} from '../api/results';
import { fetchLockStatus, setLockConfig, clearLock } from '../api/locks';
import ExamNavigation from '../Components/ExamNavigation';
import { getSubjectsByClass, getSubjectDisplayName, getRubric } from '../Utils/subjectsByClass';

const examTypes = ['opener', 'midterm', 'endterm'];
const terms = ['Term 1', 'Term 2', 'Term 3'];
const classes = [
  'Playgroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
];

const showFeedback = (message, setFeedback) => {
  setFeedback(message);
  setTimeout(() => setFeedback(''), 3000);
};

const ResultsManager = () => {
  const [results, setResults] = useState([]);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedExamType, setSelectedExamType] = useState('opener');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lockStatus, setLockStatus] = useState({ locked: false, effectiveAt: null, id: null, gracePeriodMinutes: 10 });
  const [lockMinutes, setLockMinutes] = useState(10);
  const selectedYear = new Date().getFullYear().toString();

  useEffect(() => {
    fetchResults().then(setResults);
  }, []);

  useEffect(() => {
    // Cancel any in-progress edit when filters change
    setForm(null);
    setEditingId(null);
  }, [selectedClass, selectedExamType, selectedTerm]);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await fetchLockStatus(selectedYear, selectedTerm, selectedExamType);
        setLockStatus(status);
        setLockMinutes(status.gracePeriodMinutes || 10);
      } catch (err) {
        console.error('Could not load lock status:', err);
        setLockStatus({ locked: false, effectiveAt: null, id: null, gracePeriodMinutes: 10 });
      }
    };
    load();
  }, [selectedExamType, selectedTerm, selectedYear]);

  const currentSubjects = getSubjectsByClass(selectedClass);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEdit = result => {
    setEditingId(result._id);
    setSelectedExamType(result.examType);
    setSelectedClass(result.class);
    setSelectedTerm(result.term || 'Term 1');

    const editForm = {
      name: result.name,
      mean: result.mean,
      rubric: result.rubric,
      examType: result.examType,
      class: result.class || '',
      term: result.term || 'Term 1'
    };

    // Get subjects for the result's class
    const resultSubjects = getSubjectsByClass(result.class);

    // Add all subjects for this class
    resultSubjects.forEach(subject => {
      editForm[subject] = result[subject] || '';
    });

    setForm(editForm);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const handleDelete = async id => {
    if (window.confirm('Delete these marks? This only removes the marks for this exam — the student stays in the roster.')) {
      await deleteResult(id);
      setResults(results.filter(r => r._id !== id));
      showFeedback('Marks deleted successfully!', setFeedback);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      const foundStudents = results.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        r.examType === selectedExamType &&
        (!selectedClass || r.class === selectedClass) &&
        r.term === selectedTerm
      );
      
      if (foundStudents.length > 0) {
        showFeedback(`Found ${foundStudents.length} student${foundStudents.length > 1 ? 's' : ''}`, setFeedback);
      } else {
        showFeedback('No students found matching your search', setFeedback);
      }
    }
  };

  const handleCreateLock = async () => {
    try {
      const status = await setLockConfig({
        academicYear: selectedYear,
        term: selectedTerm,
        examType: selectedExamType,
        gracePeriodMinutes: Number(lockMinutes)
      });
      setLockStatus(status);
      showFeedback('Lock scheduled successfully.', setFeedback);
    } catch (err) {
      showFeedback(`Lock failed: ${err.message}`, setFeedback);
    }
  };

  const handleRemoveLock = async () => {
    if (!lockStatus.id) return;
    try {
      await clearLock(lockStatus.id);
      setLockStatus({ locked: false, effectiveAt: null, id: null, gracePeriodMinutes: 10 });
      showFeedback('Lock removed successfully.', setFeedback);
    } catch (err) {
      showFeedback(`Unlock failed: ${err.message}`, setFeedback);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!editingId || !form) return;

    const editSubjects = getSubjectsByClass(form.class);
    const subjectScores = editSubjects
      .map(subject => parseFloat(form[subject]))
      .filter(score => !isNaN(score));
    const mean = subjectScores.length > 0
      ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length
      : 0;

    const formWithMean = {
      ...form,
      mean: mean.toFixed(2),
      rubric: getRubric(mean),
      term: form.term || selectedTerm
    };

    try {
      await updateResult(editingId, formWithMean);
      // Re-fetch so we get the back-end's authoritative numbers (including termly avg)
      const fresh = await fetchResults();
      setResults(fresh);
      setEditingId(null);
      setForm(null);
      showFeedback('Marks updated successfully!', setFeedback);
    } catch (err) {
      showFeedback(`Update failed: ${err.message}`, setFeedback);
    }
  };

  // Filter results by selected exam type, class, term, and search query
  const filteredResults = results.filter(r => {
    const matchesExamType = r.examType === selectedExamType;
    const matchesClass = !selectedClass || r.class === selectedClass;
    const matchesTerm = r.term === selectedTerm;
    const matchesSearch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesExamType && matchesClass && matchesTerm && matchesSearch;
  });

  const styles = {
    container: {
      background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    contentWrapper: {
      maxWidth: '1400px',
      margin: '0 auto',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)'
    },
    header: {
      textAlign: 'center',
      marginBottom: '40px'
    },
    title: {
      fontSize: '3rem',
      fontWeight: '700',
      color: '#000080',
      marginBottom: '10px',
      letterSpacing: '-1px'
    },
    subtitle: {
      fontSize: '1.2rem',
      color: '#6b7280',
      fontWeight: '400'
    },
    filtersContainer: {
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '32px',
      display: 'flex',
      gap: '24px',
      alignItems: 'center',
      flexWrap: 'wrap',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    lockPanel: {
      background: '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '32px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e5e7eb'
    },
    lockHeader: {
      fontSize: '1.1rem',
      fontWeight: '700',
      color: '#1d4ed8',
      marginBottom: '12px'
    },
    lockRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      alignItems: 'center'
    },
    lockInput: {
      padding: '12px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      color: '#374151',
      background: '#fff',
      outline: 'none',
      minWidth: '140px'
    },
    select: {
      padding: '12px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      color: '#374151',
      fontWeight: '500',
      background: '#fff',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      outline: 'none',
      minWidth: '160px'
    },
    formContainer: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '32px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
    },
    formTitle: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#92400e',
      marginBottom: '20px',
      textAlign: 'center'
    },
    form: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      alignItems: 'end'
    },
    input: {
      padding: '12px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      fontWeight: '500',
      background: '#fff',
      transition: 'all 0.3s ease',
      outline: 'none'
    },
    buttonPrimary: {
      padding: '12px 24px',
      borderRadius: '12px',
      border: 'none',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    buttonSecondary: {
      padding: '12px 24px',
      borderRadius: '12px',
      border: '2px solid #6b7280',
      background: 'transparent',
      color: '#6b7280',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    tableContainer: {
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '1px solid #f1f5f9'
    },
    tableWrapper: {
      overflowX: 'auto',
      overflowY: 'auto',
      maxHeight: '600px'
    },
    table: {
      width: '100%',
      minWidth: '800px',
      borderCollapse: 'collapse',
      fontSize: '0.95rem'
    },
    tableHeader: {
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      color: '#fff'
    },
    th: {
      padding: '16px 12px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '0.9rem',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    },
    td: {
      padding: '16px 12px',
      borderBottom: '1px solid #f1f5f9',
      color: '#374151',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '200px'
    },
    row: {
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    },
    actionButton: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '0.85rem',
      fontWeight: '600',
      cursor: 'pointer',
      marginRight: '8px',
      transition: 'all 0.3s ease',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    editButton: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: '#fff',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
    },
    deleteButton: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: '#fff',
      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#6b7280'
    },
    emptyIcon: {
      fontSize: '4rem',
      marginBottom: '16px',
      opacity: '0.5'
    },
    emptyText: {
      fontSize: '1.2rem',
      fontWeight: '500'
    }
  };

  return (
    <div style={styles.container}>
      <ExamNavigation />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <h1 style={styles.title}>Results Manager</h1>
          <p style={styles.subtitle}>Manage and organize student examination results</p>
        </div>

        {feedback && (
          <div style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            borderRadius: '12px',
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
          }}>
            {feedback}
          </div>
        )}

        <div style={styles.filtersContainer}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>Term</label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              style={styles.select}
            >
              {terms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Exam Type</label>
            <select
              value={selectedExamType}
              onChange={e => setSelectedExamType(e.target.value)}
              style={styles.select}
            >
              {examTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Class Filter</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              style={styles.select}
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Search Student</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                style={{
                  ...styles.select,
                  minWidth: '200px'
                }}
              />
              <button
                onClick={handleSearch}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#4169E1',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.3)';
                }}
              >
                🔍
              </button>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>Total Results</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {filteredResults.length}
            </div>
          </div>
        </div>

        <div style={styles.lockPanel}>
          <div style={styles.lockHeader}>Admin lock controls</div>
          <div style={styles.lockRow}>
            <div>
              <div style={{ fontSize: '0.95rem', color: '#374151', marginBottom: '4px' }}>Current lock state</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: lockStatus.locked ? '#b91c1c' : '#16a34a' }}>
                {lockStatus.locked ? 'Locked for teacher entry' : 'Open for teacher entry'}
              </div>
              {lockStatus.effectiveAt && (
                <div style={{ fontSize: '0.9rem', color: '#4b5563', marginTop: '6px' }}>
                  Effective at: {new Date(lockStatus.effectiveAt).toLocaleString()}
                </div>
              )}
            </div>

            <div>
              <label style={styles.label}>Grace period (minutes)</label>
              <input
                type="number"
                min="0"
                value={lockMinutes}
                onChange={e => setLockMinutes(e.target.value)}
                style={styles.lockInput}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleCreateLock} style={styles.buttonPrimary}>
                🔒 Lock marks
              </button>
              {lockStatus.id && (
                <button type="button" onClick={handleRemoveLock} style={styles.buttonSecondary}>
                  🔓 Unlock marks
                </button>
              )}
            </div>
          </div>
        </div>

        {editingId && form ? (
          <div style={styles.formContainer}>
            <h3 style={styles.formTitle}>
              ✏️ Edit Marks — {form.name} ({form.class} • {form.term} • {form.examType})
            </h3>
            <p style={{
              textAlign: 'center',
              color: '#92400e',
              fontSize: '0.9rem',
              marginTop: '-10px',
              marginBottom: '20px'
            }}>
              Adjust the subject scores below. Use Manage Students to add or remove students.
            </p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                name="name"
                value={form.name || ''}
                readOnly
                style={{
                  ...styles.input,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  cursor: 'not-allowed'
                }}
                title="Student name cannot be changed here. Use Manage Students."
              />

              {getSubjectsByClass(form.class).map(subject => (
                <input
                  key={subject}
                  name={subject}
                  type="number"
                  value={form[subject] ?? ''}
                  onChange={handleChange}
                  placeholder={getSubjectDisplayName(subject)}
                  style={styles.input}
                  min="0"
                  max="100"
                />
              ))}

              <button type="submit" style={styles.buttonPrimary}>
                💾 Update Marks
              </button>
              <button type="button" onClick={handleCancelEdit} style={styles.buttonSecondary}>
                ❌ Cancel
              </button>
            </form>
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.1)'
          }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3730a3' }}>
                ℹ️ This module only edits existing marks.
              </div>
              <div style={{ fontSize: '0.9rem', color: '#4338ca', marginTop: '4px' }}>
                Click <strong>Edit</strong> on any row below to adjust a student's scores.
                To add a new student, use the Manage Students module.
              </div>
            </div>
            <Link
              to="/students"
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: '#4169E1',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(65, 105, 225, 0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              👥 Go to Manage Students
            </Link>
          </div>
        )}

        <div style={styles.tableContainer}>
          {filteredResults.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead style={styles.tableHeader}>
                <tr>
                  <th style={styles.th}>👤 Student Name</th>
                  {currentSubjects.map(subject => (
                    <th key={subject} style={styles.th}>📚 {getSubjectDisplayName(subject)}</th>
                  ))}
                  <th style={styles.th}>📊 Mean</th>
                  <th style={styles.th}>📋 Rubric</th>
                  <th style={styles.th}>🏫 Class</th>
                  <th style={styles.th}>📅 Term</th>
                  <th style={{ ...styles.th, minWidth: '180px' }}>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, index) => (
                  <tr 
                    key={r._id} 
                    style={{
                      ...styles.row,
                      backgroundColor: index % 2 === 0 ? '#f8fafc' : '#fff',
                      ':hover': { backgroundColor: '#e0f2fe', transform: 'scale(1.01)' }
                    }}
                  >
                    <td style={{ ...styles.td, fontWeight: '600', color: '#1f2937' }}>{r.name}</td>
                    {currentSubjects.map(subject => (
                      <td key={subject} style={styles.td}>
                        {r[subject] ? (
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            background: r[subject] >= 80 ? '#dcfce7' : r[subject] >= 65 ? '#fef3c7' : r[subject] >= 50 ? '#fed7aa' : '#fecaca',
                            color: r[subject] >= 80 ? '#166534' : r[subject] >= 65 ? '#92400e' : r[subject] >= 50 ? '#9a3412' : '#991b1b',
                            fontWeight: '600'
                          }}>
                            {r[subject]}
                          </span>
                        ) : '-'}
                      </td>
                    ))}
                    <td style={styles.td}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '8px', 
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.9rem'
                      }}>
                        {r.mean || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: '#f3f4f6',
                        color: '#374151',
                        fontWeight: '600',
                        fontSize: '0.85rem'
                      }}>
                        {r.rubric || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>{r.class}</td>
                    <td style={styles.td}>{r.term || 'Term 1'}</td>
                    <td style={{ ...styles.td, minWidth: '180px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          onClick={() => handleEdit(r)} 
                          style={{ ...styles.actionButton, ...styles.editButton }}
                          title="Edit Result"
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(r._id)} 
                          style={{ ...styles.actionButton, ...styles.deleteButton }}
                          title="Delete Result - This action cannot be undone"
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📊</div>
              <div style={styles.emptyText}>No results found for the selected filters</div>
              <p style={{ marginTop: '8px', color: '#9ca3af' }}>
                Select a class and add some student results to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsManager;