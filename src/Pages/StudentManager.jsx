import React, { useState, useEffect, useCallback } from 'react';
import ExamNavigation from '../Components/ExamNavigation';
import {
  createRosterStudent,
  fetchRosterByClass,
  deleteStudentRecord,
  bulkCreateRosterStudents,
  promoteRoster,
  renameRosterStudent
} from '../api/students';

const classes = [
  'Playgroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
];

const StudentManager = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 5; y++) years.push(y.toString());

  const [selectedClass, setSelectedClass] = useState('Playgroup');
  const [selectedYear, setSelectedYear]   = useState(currentYear.toString());
  const [name, setName]                   = useState('');
  const [roster, setRoster]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [feedback, setFeedback]           = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [bulkOpen, setBulkOpen]           = useState(false);
  const [bulkText, setBulkText]           = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);

  // Inline rename state
  const [editingId, setEditingId]     = useState(null);
  const [editingName, setEditingName] = useState('');
  const [renaming, setRenaming]       = useState(false);

  // Promotion modal state
  const [promoteOpen, setPromoteOpen]               = useState(false);
  const [promoteToClass, setPromoteToClass]         = useState('');
  const [promoteToYear, setPromoteToYear]           = useState('');
  const [promoteTargetRoster, setPromoteTargetRoster] = useState([]);
  const [promoteTargetLoading, setPromoteTargetLoading] = useState(false);
  const [promoteSubmitting, setPromoteSubmitting]   = useState(false);
  const [promoteResult, setPromoteResult]           = useState(null);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRosterByClass(selectedClass, selectedYear);
      setRoster(list);
    } catch (err) {
      showFeedback('error', `Failed to load roster: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedYear]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  // Clear the search box whenever the class or year filter changes
  useEffect(() => { setSearchQuery(''); }, [selectedClass, selectedYear]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRoster = normalizedQuery
    ? roster.filter((s) => (s.name || '').toLowerCase().includes(normalizedQuery))
    : roster;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showFeedback('error', 'Please enter a student name.');
      return;
    }
    setSubmitting(true);
    try {
      await createRosterStudent({
        name: trimmed,
        class: selectedClass,
        academicYear: selectedYear
      });
      setName('');
      showFeedback('success', `Added "${trimmed}" to ${selectedClass} (${selectedYear}).`);
      await loadRoster();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameStart = (student) => {
    setEditingId(student._id);
    setEditingName(student.name);
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameSave = async (student) => {
    const trimmed = editingName.trim();
    if (!trimmed) { showFeedback('error', 'Name cannot be empty.'); return; }
    if (trimmed === student.name) { handleRenameCancel(); return; }
    setRenaming(true);
    try {
      await renameRosterStudent(student._id, trimmed);
      showFeedback('success', `Renamed "${student.name}" to "${trimmed}".`);
      setEditingId(null);
      setEditingName('');
      await loadRoster();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (student) => {
    const ok = window.confirm(
      `Remove "${student.name}" from ${selectedClass} (${selectedYear})?\n\nThis will also delete all of their recorded marks. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await deleteStudentRecord(student._id);
      showFeedback('success', `Removed "${student.name}".`);
      await loadRoster();
    } catch (err) {
      showFeedback('error', `Could not delete student: ${err.message}`);
    }
  };

  // Parse a CSV / newline / comma-separated chunk of text into a list of names
  const parseNames = (text) => {
    if (!text) return [];
    return text
      .split(/[\r\n,]+/)              // split on commas and newlines
      .map((line) => line.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  };

  const parsedBulkNames = parseNames(bulkText);

  const openBulkModal = () => {
    setBulkText('');
    setBulkResult(null);
    setBulkOpen(true);
  };

  const closeBulkModal = () => {
    if (bulkSubmitting) return;
    setBulkOpen(false);
    setBulkText('');
    setBulkResult(null);
  };

  const handleBulkFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      setBulkText((prev) => (prev ? `${prev}\n${text}` : text));
    } catch (err) {
      showFeedback('error', `Could not read file: ${err.message}`);
    }
  };

  // ── Promotion helpers ──────────────────────────────────────────────────────
  const openPromoteModal = () => {
    if (roster.length === 0) {
      showFeedback('error', `Cannot promote — ${selectedClass} (${selectedYear}) is empty.`);
      return;
    }
    const idx = classes.indexOf(selectedClass);
    const nextClass = idx >= 0 && idx < classes.length - 1 ? classes[idx + 1] : selectedClass;
    const nextYear  = (parseInt(selectedYear, 10) + 1).toString();
    setPromoteToClass(nextClass);
    setPromoteToYear(nextYear);
    setPromoteResult(null);
    setPromoteOpen(true);
  };

  const closePromoteModal = () => {
    if (promoteSubmitting) return;
    setPromoteOpen(false);
    setPromoteResult(null);
  };

  // Re-fetch the destination roster whenever the target changes, so we can
  // preview how many of the source students are already enrolled there.
  useEffect(() => {
    if (!promoteOpen || !promoteToClass || !promoteToYear) return;
    let cancelled = false;
    setPromoteTargetLoading(true);
    fetchRosterByClass(promoteToClass, promoteToYear)
      .then((list) => { if (!cancelled) setPromoteTargetRoster(list); })
      .catch(() => { if (!cancelled) setPromoteTargetRoster([]); })
      .finally(() => { if (!cancelled) setPromoteTargetLoading(false); });
    return () => { cancelled = true; };
  }, [promoteOpen, promoteToClass, promoteToYear]);

  const normalizeNameForCompare = (n) =>
    (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const targetNameKeys = new Set(
    promoteTargetRoster.map((s) => normalizeNameForCompare(s.name))
  );
  const alreadyInTarget = roster.filter((s) => targetNameKeys.has(normalizeNameForCompare(s.name)));
  const willPromote     = roster.filter((s) => !targetNameKeys.has(normalizeNameForCompare(s.name)));
  const promoteIsNoOp   = promoteToClass === selectedClass && promoteToYear === selectedYear;

  const handlePromoteSubmit = async () => {
    if (promoteIsNoOp) {
      showFeedback('error', 'Pick a different target class or year.');
      return;
    }
    setPromoteSubmitting(true);
    setPromoteResult(null);
    try {
      const result = await promoteRoster({
        fromClass: selectedClass,
        fromYear:  selectedYear,
        toClass:   promoteToClass,
        toYear:    promoteToYear
      });
      setPromoteResult(result);
      if (result.promoted > 0) {
        showFeedback(
          'success',
          `Promoted ${result.promoted} student${result.promoted === 1 ? '' : 's'} to ${promoteToClass} (${promoteToYear}).`
        );
      } else {
        showFeedback('error', 'No students promoted (everyone is already on the target roster).');
      }
    } catch (err) {
      showFeedback('error', `Promotion failed: ${err.message}`);
    } finally {
      setPromoteSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (parsedBulkNames.length === 0) {
      showFeedback('error', 'Paste or upload at least one student name.');
      return;
    }
    setBulkSubmitting(true);
    setBulkResult(null);
    try {
      const result = await bulkCreateRosterStudents({
        names: parsedBulkNames,
        className: selectedClass,
        academicYear: selectedYear
      });
      setBulkResult(result);
      await loadRoster();
      if (result.created > 0) {
        showFeedback(
          'success',
          `Imported ${result.created} student${result.created === 1 ? '' : 's'} into ${selectedClass} (${selectedYear}).`
        );
      } else {
        showFeedback('error', 'No new students were added (all were duplicates or blanks).');
      }
    } catch (err) {
      showFeedback('error', `Bulk import failed: ${err.message}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const styles = {
    container: {
      background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    contentWrapper: {
      maxWidth: '1100px',
      margin: '0 auto',
      background: 'rgba(255, 255, 255, 0.97)',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
    },
    header: { textAlign: 'center', marginBottom: '32px' },
    title: {
      fontSize: '2.6rem',
      fontWeight: 700,
      color: '#000080',
      margin: 0,
      letterSpacing: '-1px'
    },
    subtitle: { fontSize: '1.05rem', color: '#6b7280', marginTop: '6px' },
    panel: {
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: 600,
      color: '#374151',
      letterSpacing: '0.5px',
      marginBottom: '6px',
      textTransform: 'uppercase'
    },
    select: {
      padding: '12px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      fontWeight: 500,
      background: '#fff',
      cursor: 'pointer',
      outline: 'none',
      width: '100%'
    },
    input: {
      padding: '12px 16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      fontWeight: 500,
      background: '#fff',
      outline: 'none',
      width: '100%'
    },
    addRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 2fr auto',
      gap: '16px',
      alignItems: 'end'
    },
    addButton: {
      padding: '12px 24px',
      borderRadius: '12px',
      border: 'none',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
    },
    feedback: (type) => ({
      padding: '12px 16px',
      borderRadius: '12px',
      marginBottom: '20px',
      fontWeight: 600,
      textAlign: 'center',
      color: '#fff',
      background: type === 'success'
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    }),
    rosterHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    rosterTitle: { fontSize: '1.4rem', fontWeight: 700, color: '#1f2937', margin: 0 },
    countBadge: {
      padding: '6px 14px',
      borderRadius: '20px',
      background: '#4169E1',
      color: '#fff',
      fontWeight: 700,
      fontSize: '0.9rem'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: '#fff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
    },
    th: {
      padding: '14px',
      textAlign: 'left',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      color: '#fff',
      fontSize: '0.85rem',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    },
    td: { padding: '14px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
    deleteBtn: {
      padding: '8px 14px',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.85rem',
      letterSpacing: '0.5px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#6b7280',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
    }
  };

  return (
    <div style={styles.container}>
      <ExamNavigation />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <h1 style={styles.title}>Manage Students</h1>
          <p style={styles.subtitle}>
            Add and remove students from each class. Marks are entered separately in the exam modules.
          </p>
        </div>

        {feedback && <div style={styles.feedback(feedback.type)}>{feedback.message}</div>}

        <div style={styles.panel}>
          <form onSubmit={handleSubmit} style={styles.addRow}>
            <div>
              <label style={styles.label}>Academic Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={styles.select}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={styles.select}
              >
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Student Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                style={styles.input}
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.addButton,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Adding…' : '+ Add Student'}
            </button>
          </form>

          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px dashed #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Need to add a whole class at once? Paste a list, upload a CSV, or promote
              an existing roster from last year.
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openBulkModal}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '2px solid #6366f1',
                  background: '#fff',
                  color: '#6366f1',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                📥 Bulk Import…
              </button>
              <button
                type="button"
                onClick={openPromoteModal}
                disabled={loading || roster.length === 0}
                title={
                  roster.length === 0
                    ? 'Load a class with students before promoting.'
                    : `Promote everyone in ${selectedClass} (${selectedYear}) to the next class.`
                }
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: roster.length === 0
                    ? '#e5e7eb'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: roster.length === 0 ? '#9ca3af' : '#fff',
                  fontWeight: 700,
                  cursor: (loading || roster.length === 0) ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  boxShadow: roster.length === 0 ? 'none' : '0 4px 16px rgba(245, 158, 11, 0.3)'
                }}
              >
                🎓 Promote to Next Class…
              </button>
            </div>
          </div>
        </div>

        <div style={styles.rosterHeader}>
          <h3 style={styles.rosterTitle}>
            {selectedClass} — {selectedYear} Roster
          </h3>
          <span style={styles.countBadge}>
            {loading
              ? 'Loading…'
              : normalizedQuery
                ? `${filteredRoster.length} of ${roster.length} shown`
                : `${roster.length} student${roster.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {roster.length > 0 && (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search students by name…"
              style={{
                ...styles.input,
                paddingRight: searchQuery ? '44px' : '16px'
              }}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  color: '#6b7280',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {!loading && roster.length === 0 ? (
          <div style={styles.emptyState}>
            No students in {selectedClass} for {selectedYear} yet. Add the first one above.
          </div>
        ) : !loading && filteredRoster.length === 0 ? (
          <div style={styles.emptyState}>
            No students match "<strong>{searchQuery}</strong>" in {selectedClass} ({selectedYear}).
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '60px' }}>#</th>
                <th style={styles.th}>Student Name</th>
                <th style={{ ...styles.th, width: '150px' }}>Class</th>
                <th style={{ ...styles.th, width: '120px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((s, i) => {
                const isEditing = editingId === s._id;
                return (
                  <tr key={s._id} style={{ background: isEditing ? '#f0f9ff' : undefined }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={{ ...styles.td, fontWeight: 600, color: '#1f2937' }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSave(s);
                            if (e.key === 'Escape') handleRenameCancel();
                          }}
                          disabled={renaming}
                          style={{
                            ...styles.input,
                            padding: '7px 10px',
                            fontSize: '0.95rem',
                            width: '100%',
                            maxWidth: '320px',
                            border: '2px solid #3b82f6'
                          }}
                        />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td style={styles.td}>{s.class}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleRenameSave(s)}
                              disabled={renaming}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#fff',
                                cursor: renaming ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                              title="Save new name"
                            >
                              {renaming ? '…' : '✓ Save'}
                            </button>
                            <button
                              onClick={handleRenameCancel}
                              disabled={renaming}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                background: '#fff',
                                color: '#374151',
                                cursor: renaming ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                fontSize: '0.85rem'
                              }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRenameStart(s)}
                              disabled={!!editingId}
                              style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: editingId
                                  ? '#e5e7eb'
                                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: editingId ? '#9ca3af' : '#fff',
                                cursor: editingId ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                fontSize: '0.85rem'
                              }}
                              title="Rename this student"
                            >
                              ✏️ Rename
                            </button>
                            <button
                              onClick={() => handleDelete(s)}
                              disabled={!!editingId}
                              style={{
                                ...styles.deleteBtn,
                                opacity: editingId ? 0.5 : 1,
                                cursor: editingId ? 'not-allowed' : 'pointer'
                              }}
                              title="Remove student and delete all their marks"
                            >
                              🗑️ Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {bulkOpen && (
        <div
          onClick={closeBulkModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.4rem' }}>
                  Bulk Import Students
                </h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                  Adding to <strong>{selectedClass}</strong> · <strong>{selectedYear}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeBulkModal}
                disabled={bulkSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#6b7280',
                  cursor: bulkSubmitting ? 'not-allowed' : 'pointer',
                  lineHeight: 1
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p style={{ color: '#374151', fontSize: '0.92rem', margin: '8px 0 12px' }}>
              Paste one name per line, or separate by commas. You can also upload a CSV/TXT file.
              Duplicates and blanks are skipped automatically.
            </p>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              disabled={bulkSubmitting}
              placeholder={'Jane Doe\nJohn Smith\nMary Wanjiku\n…'}
              rows={10}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#6366f1',
                fontWeight: 600,
                cursor: bulkSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem'
              }}>
                📎 Upload CSV/TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => {
                    handleBulkFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  disabled={bulkSubmitting}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                {parsedBulkNames.length} name{parsedBulkNames.length === 1 ? '' : 's'} detected
              </span>
            </div>

            {bulkResult && (
              <div style={{
                marginTop: '14px',
                padding: '14px',
                background: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                fontSize: '0.9rem',
                color: '#1f2937'
              }}>
                <strong style={{ color: '#059669' }}>✓ Created: {bulkResult.created}</strong>
                {bulkResult.skippedExisting && bulkResult.skippedExisting.length > 0 && (
                  <div style={{ marginTop: '6px', color: '#92400e' }}>
                    Already on roster — skipped ({bulkResult.skippedExisting.length}):{' '}
                    {bulkResult.skippedExisting.slice(0, 8).join(', ')}
                    {bulkResult.skippedExisting.length > 8 ? `, +${bulkResult.skippedExisting.length - 8} more` : ''}
                  </div>
                )}
                {bulkResult.duplicatesInPayload && bulkResult.duplicatesInPayload.length > 0 && (
                  <div style={{ marginTop: '6px', color: '#92400e' }}>
                    Duplicates inside your list — kept first ({bulkResult.duplicatesInPayload.length}):{' '}
                    {bulkResult.duplicatesInPayload.slice(0, 8).join(', ')}
                  </div>
                )}
                {bulkResult.blanks > 0 && (
                  <div style={{ marginTop: '6px', color: '#6b7280' }}>
                    Blank lines ignored: {bulkResult.blanks}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={closeBulkModal}
                disabled={bulkSubmitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: 600,
                  cursor: bulkSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkResult ? 'Done' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={bulkSubmitting || parsedBulkNames.length === 0}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (bulkSubmitting || parsedBulkNames.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (bulkSubmitting || parsedBulkNames.length === 0) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                {bulkSubmitting ? 'Importing…' : `Import ${parsedBulkNames.length || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

      {promoteOpen && (
        <div
          onClick={closePromoteModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.4rem' }}>
                  🎓 Promote to Next Class
                </h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                  Move the entire <strong>{selectedClass}</strong> roster from{' '}
                  <strong>{selectedYear}</strong> into a new class for the new academic year.
                  Original records (with marks) stay where they are.
                </p>
              </div>
              <button
                type="button"
                onClick={closePromoteModal}
                disabled={promoteSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#6b7280',
                  cursor: promoteSubmitting ? 'not-allowed' : 'pointer',
                  lineHeight: 1
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginTop: '16px'
            }}>
              <div>
                <label style={styles.label}>From</label>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: '#f3f4f6',
                  color: '#374151',
                  fontWeight: 600
                }}>
                  {selectedClass} · {selectedYear}
                </div>
              </div>
              <div>
                <label style={styles.label}>Target Class</label>
                <select
                  value={promoteToClass}
                  onChange={(e) => setPromoteToClass(e.target.value)}
                  disabled={promoteSubmitting}
                  style={styles.select}
                >
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>Target Academic Year</label>
                <select
                  value={promoteToYear}
                  onChange={(e) => setPromoteToYear(e.target.value)}
                  disabled={promoteSubmitting}
                  style={styles.select}
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>To</label>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  color: '#92400e',
                  fontWeight: 700
                }}>
                  {promoteToClass} · {promoteToYear}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '18px',
              padding: '14px 16px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              fontSize: '0.95rem',
              color: '#1f2937'
            }}>
              {promoteIsNoOp ? (
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ Source and target are the same. Pick a different class or year.
                </span>
              ) : promoteTargetLoading ? (
                <span style={{ color: '#6b7280' }}>Checking the target roster…</span>
              ) : (
                <>
                  <div>
                    <strong style={{ color: '#059669' }}>
                      {willPromote.length} student{willPromote.length === 1 ? '' : 's'}
                    </strong>{' '}
                    will be added to <strong>{promoteToClass} ({promoteToYear})</strong>.
                  </div>
                  {alreadyInTarget.length > 0 && (
                    <div style={{ marginTop: '6px', color: '#92400e' }}>
                      Already enrolled in target — will be skipped ({alreadyInTarget.length}):{' '}
                      {alreadyInTarget.slice(0, 8).map(s => s.name).join(', ')}
                      {alreadyInTarget.length > 8 ? `, +${alreadyInTarget.length - 8} more` : ''}
                    </div>
                  )}
                  {promoteTargetRoster.length > 0 && (
                    <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '0.85rem' }}>
                      Target currently has {promoteTargetRoster.length} student
                      {promoteTargetRoster.length === 1 ? '' : 's'}.
                    </div>
                  )}
                </>
              )}
            </div>

            {promoteResult && (
              <div style={{
                marginTop: '14px',
                padding: '14px',
                background: '#ecfdf5',
                borderRadius: '10px',
                border: '1px solid #10b981',
                fontSize: '0.9rem',
                color: '#065f46'
              }}>
                <strong>✓ Promoted: {promoteResult.promoted}</strong> to{' '}
                {promoteResult.toClass} ({promoteResult.toYear}).
                {promoteResult.skippedExisting && promoteResult.skippedExisting.length > 0 && (
                  <div style={{ marginTop: '6px', color: '#92400e' }}>
                    Skipped (already in target): {promoteResult.skippedExisting.length} —{' '}
                    {promoteResult.skippedExisting.slice(0, 6).join(', ')}
                    {promoteResult.skippedExisting.length > 6 ? '…' : ''}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={closePromoteModal}
                disabled={promoteSubmitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: 600,
                  cursor: promoteSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {promoteResult ? 'Done' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handlePromoteSubmit}
                disabled={
                  promoteSubmitting ||
                  promoteIsNoOp ||
                  promoteTargetLoading ||
                  willPromote.length === 0 ||
                  Boolean(promoteResult)
                }
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: (
                    promoteSubmitting ||
                    promoteIsNoOp ||
                    willPromote.length === 0 ||
                    Boolean(promoteResult)
                  ) ? 'not-allowed' : 'pointer',
                  opacity: (
                    promoteSubmitting ||
                    promoteIsNoOp ||
                    willPromote.length === 0 ||
                    Boolean(promoteResult)
                  ) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                {promoteSubmitting
                  ? 'Promoting…'
                  : `Promote ${willPromote.length || ''} student${willPromote.length === 1 ? '' : 's'}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManager;
