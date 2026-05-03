import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import ExamNavigation from '../Components/ExamNavigation';
import { fetchResults } from '../api/results';
import { fetchTarget } from '../api/targets';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Title, Tooltip, Legend);

const CLASSES = [
  'Playgroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
];

const SUBJECTS = {
  maths: 'Maths',
  english: 'English',
  kiswahili: 'Kiswahili',
  language: 'Language',
  reading: 'Reading',
  environmental: 'Environmental',
  integrated: 'Integrated',
  creative: 'Creative',
  cre: 'CRE',
  kusoma: 'Kusoma',
  social: 'Social',
  pretech: 'Pre-Tech',
  agriculture: 'Agriculture',
};

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const EXAM_TYPES = ['opener', 'midterm', 'endterm'];
const EXAM_LABELS = { opener: 'Opener', midterm: 'Midterm', endterm: 'Endterm' };

const TABS = [
  { label: 'Class Comparison',   icon: '📊' },
  { label: 'Subject Heat Map',   icon: '🌡️' },
  { label: 'Class Progression',  icon: '📈' },
  { label: 'Student Progress',   icon: '👤' },
  { label: 'At-Risk Students',   icon: '⚠️' },
  { label: 'Subject Weakness',   icon: '🔍' },
  { label: 'Term Comparison',    icon: '🔄' },
];

const avg = (arr) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length);

const scoreColor = (score) => {
  if (score === null || score === undefined || isNaN(score))
    return { bg: '#f3f4f6', text: '#9ca3af' };
  if (score >= 80) return { bg: '#dcfce7', text: '#15803d' };
  if (score >= 60) return { bg: '#d9f99d', text: '#4d7c0f' };
  if (score >= 40) return { bg: '#fef3c7', text: '#92400e' };
  return { bg: '#fee2e2', text: '#991b1b' };
};

const bandLabel = (score) => {
  if (score === null || isNaN(score)) return '—';
  if (score >= 80) return 'Exceeds Expectations';
  if (score >= 60) return 'Meets Expectations';
  if (score >= 40) return 'Approaching Expectations';
  return 'Below Expectations';
};

const S = {
  page: {
    background: 'linear-gradient(135deg, #7ec8ff 0%, #56b0e2 100%)',
    minHeight: '100vh',
    fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  wrapper: { maxWidth: '1340px', margin: '0 auto', padding: '20px' },
  card: {
    background: 'rgba(255,255,255,0.97)',
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    marginBottom: '20px',
  },
  pageTitle: { fontSize: '2rem', fontWeight: '700', color: '#0b3d91', margin: '0 0 4px 0' },
  pageSub: { color: '#6b7280', margin: '0 0 24px 0', fontSize: '0.95rem' },
  filterRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel: {
    fontSize: '0.72rem', fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.6px',
  },
  select: {
    padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
    fontSize: '0.9rem', color: '#374151', background: '#fff', cursor: 'pointer',
    minWidth: '140px', outline: 'none',
  },
  tabRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: '700', color: '#1f2937', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    padding: '10px 14px', background: '#0b3d91', color: '#fff',
    fontWeight: '600', textAlign: 'left', fontSize: '0.8rem',
  },
  td: { padding: '8px 14px', borderBottom: '1px solid #f3f4f6' },
  statCard: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    borderRadius: '12px', padding: '16px 20px', textAlign: 'center',
  },
  statValue: { fontSize: '1.75rem', fontWeight: '700', color: '#0b3d91' },
  statLabel: { fontSize: '0.78rem', color: '#6b7280', fontWeight: '500', marginTop: '4px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9ca3af', fontSize: '0.95rem' },
};

const tabStyle = (active) => ({
  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontWeight: '600', fontSize: '0.85rem',
  background: active ? '#0b3d91' : '#f1f5f9',
  color: active ? '#fff' : '#374151',
  transition: 'all 0.2s', whiteSpace: 'nowrap',
});

const baseChartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}` } },
  },
  scales: { y: { min: 0, max: 100, ticks: { stepSize: 20 } } },
};

const Analytics = () => {
  const currentYear = new Date().getFullYear().toString();
  const years = [];
  for (let y = parseInt(currentYear) - 2; y <= parseInt(currentYear) + 2; y++)
    years.push(y.toString());

  const [selectedYear, setSelectedYear]         = useState(currentYear);
  const [selectedTerm, setSelectedTerm]         = useState('Term 1');
  const [selectedExamType, setSelectedExamType] = useState('endterm');
  const [activeTab, setActiveTab]               = useState(0);
  const [allResults, setAllResults]             = useState([]);
  const [loading, setLoading]                   = useState(true);

  const [progClass, setProgClass]               = useState('Grade 1');
  const [selectedStudent, setSelectedStudent]   = useState('');
  const [progStudentClass, setProgStudentClass] = useState('');
  const [studentSearch, setStudentSearch]       = useState('');
  const [atRiskThreshold, setAtRiskThreshold]   = useState(40);

  const [termAterm, setTermAterm]         = useState('Term 1');
  const [termAexam, setTermAexam]         = useState('endterm');
  const [termBterm, setTermBterm]         = useState('Term 2');
  const [termBexam, setTermBexam]         = useState('endterm');

  const [downloadingSummary, setDownloadingSummary] = useState(false);
  const [downloadingModule, setDownloadingModule] = useState(null);
  const summaryRef     = useRef();
  const classCompRef   = useRef();
  const heatMapRef     = useRef();
  const classProgRef   = useRef();
  const studentProgRef = useRef();
  const atRiskRef      = useRef();
  const subjectWeakRef = useRef();
  const termCompRef    = useRef();

  const [schoolTarget, setSchoolTarget] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchTarget(selectedYear)
      .then(t => { if (!cancelled) setSchoolTarget(t?.targetMean ?? null); })
      .catch(() => { if (!cancelled) setSchoolTarget(null); });
    return () => { cancelled = true; };
  }, [selectedYear]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchResults(selectedYear);
        if (!cancelled) setAllResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setAllResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const filteredResults = useMemo(() =>
    allResults.filter(
      (r) => r.term === selectedTerm && r.examType === selectedExamType && r.examStatus !== 'absent'
    ),
    [allResults, selectedTerm, selectedExamType]
  );

  /* ── Tab 0: Class Comparison ─────────────────────────────────── */
  const classComparison = useMemo(() => {
    const byClass = {};
    filteredResults.forEach((r) => {
      if (typeof r.mean !== 'number') return;
      (byClass[r.class] = byClass[r.class] || []).push(r.mean);
    });
    const means = CLASSES.map((cls) => (byClass[cls] ? avg(byClass[cls]) : null));
    return { labels: CLASSES, means };
  }, [filteredResults]);

  /* ── Tab 1: Subject Heat Map ─────────────────────────────────── */
  const heatMap = useMemo(() => {
    const byClass = {};
    filteredResults.forEach((r) => {
      Object.keys(SUBJECTS).forEach((subj) => {
        if (typeof r[subj] !== 'number') return;
        if (!byClass[r.class]) byClass[r.class] = {};
        (byClass[r.class][subj] = byClass[r.class][subj] || []).push(r[subj]);
      });
    });
    const activeSubjects = Object.keys(SUBJECTS).filter((subj) =>
      CLASSES.some((cls) => byClass[cls]?.[subj]?.length > 0)
    );
    return { byClass, activeSubjects };
  }, [filteredResults]);

  /* ── Tab 2: Class Progression ────────────────────────────────── */
  const classProgression = useMemo(() => {
    const rows = allResults.filter((r) => r.class === progClass && r.examStatus !== 'absent');
    const labels = [];
    const values = [];
    TERMS.forEach((term) => {
      EXAM_TYPES.forEach((et) => {
        const slice = rows.filter((r) => r.term === term && r.examType === et && typeof r.mean === 'number');
        labels.push(`${term.replace('Term ', 'T')} ${EXAM_LABELS[et]}`);
        values.push(slice.length ? avg(slice.map((r) => r.mean)) : null);
      });
    });
    return { labels, values };
  }, [allResults, progClass]);

  /* ── Tab 3: Student Progress ─────────────────────────────────── */
  const uniqueStudents = useMemo(() => {
    const seen = new Set();
    return allResults
      .filter((r) => {
        const key = r.studentRecordId || r.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({ id: r.studentRecordId || r.name, name: r.name, cls: r.class }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allResults]);

  const filteredStudents = useMemo(() => {
    let list = uniqueStudents;
    if (progStudentClass) list = list.filter((s) => s.cls === progStudentClass);
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [uniqueStudents, progStudentClass, studentSearch]);

  const studentProgress = useMemo(() => {
    if (!selectedStudent) return null;
    const rows = allResults.filter(
      (r) => (r.studentRecordId || r.name) === selectedStudent
    );
    const labels = [];
    const values = [];
    TERMS.forEach((term) => {
      EXAM_TYPES.forEach((et) => {
        const row = rows.find((r) => r.term === term && r.examType === et);
        labels.push(`${term.replace('Term ', 'T')} ${EXAM_LABELS[et]}`);
        values.push(row && typeof row.mean === 'number' ? row.mean : null);
      });
    });
    const studentName = uniqueStudents.find((s) => s.id === selectedStudent)?.name || '';
    return { labels, values, name: studentName };
  }, [allResults, selectedStudent, uniqueStudents]);

  const studentSubjectBreakdown = useMemo(() => {
    if (!selectedStudent) return null;
    const rows = allResults.filter(
      (r) => (r.studentRecordId || r.name) === selectedStudent
    );
    if (rows.length === 0) return null;
    const cols = [];
    TERMS.forEach((term) => {
      EXAM_TYPES.forEach((et) => {
        const row = rows.find((r) => r.term === term && r.examType === et) || null;
        cols.push({ key: `${term}_${et}`, label: `${term.replace('Term ', 'T')} ${EXAM_LABELS[et]}`, row });
      });
    });
    const hasAnyCol = cols.some((c) => c.row !== null);
    if (!hasAnyCol) return null;
    const activeSubjects = Object.keys(SUBJECTS).filter((subj) =>
      cols.some((c) => c.row && typeof c.row[subj] === 'number')
    );
    if (activeSubjects.length === 0) return null;
    return { cols, activeSubjects };
  }, [allResults, selectedStudent]);

  /* ── Tab 4: At-Risk Students ─────────────────────────────────── */
  const atRiskList = useMemo(() =>
    filteredResults
      .filter((r) => typeof r.mean === 'number' && r.mean < atRiskThreshold)
      .sort((a, b) => a.mean - b.mean)
      .map((r) => ({ name: r.name, cls: r.class, mean: r.mean, rubric: r.rubric })),
    [filteredResults, atRiskThreshold]
  );

  /* ── Tab 5: Subject Weakness ─────────────────────────────────── */
  const subjectWeakness = useMemo(() => {
    return Object.keys(SUBJECTS)
      .map((subj) => {
        const scores = filteredResults
          .map((r) => r[subj])
          .filter((v) => typeof v === 'number' && !isNaN(v));
        return { subj, label: SUBJECTS[subj], avg: scores.length ? avg(scores) : null, count: scores.length };
      })
      .filter((s) => s.avg !== null && s.count > 0)
      .sort((a, b) => a.avg - b.avg);
  }, [filteredResults]);

  /* ── Tab 6: Term Comparison ──────────────────────────────────── */
  const termComparison = useMemo(() => {
    const sliceA = allResults.filter(
      (r) => r.term === termAterm && r.examType === termAexam && r.examStatus !== 'absent' && typeof r.mean === 'number'
    );
    const sliceB = allResults.filter(
      (r) => r.term === termBterm && r.examType === termBexam && r.examStatus !== 'absent' && typeof r.mean === 'number'
    );
    const byClassA = {};
    const byClassB = {};
    sliceA.forEach((r) => (byClassA[r.class] = byClassA[r.class] || []).push(r.mean));
    sliceB.forEach((r) => (byClassB[r.class] = byClassB[r.class] || []).push(r.mean));
    const rows = CLASSES.map((cls) => {
      const a = byClassA[cls] ? avg(byClassA[cls]) : null;
      const b = byClassB[cls] ? avg(byClassB[cls]) : null;
      const delta = a !== null && b !== null ? b - a : null;
      return { cls, a, b, delta };
    }).filter((r) => r.a !== null || r.b !== null);
    return rows;
  }, [allResults, termAterm, termAexam, termBterm, termBexam]);

  /* ── Download Summary PDF ───────────────────────────────────── */
  const handleDownloadSummary = useCallback(async () => {
    if (!summaryRef.current) return;
    setDownloadingSummary(true);
    try {
      const canvas = await html2canvas(summaryRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: summaryRef.current.scrollWidth,
        height: summaryRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: summaryRef.current.scrollWidth,
        windowHeight: summaryRef.current.scrollHeight,
      });
      const pdf      = new jsPDF('p', 'mm', 'a4');
      const margin   = 8;
      const availW   = 210 - margin * 2;
      const availH   = 297 - margin * 2;
      const imgW     = availW;
      const imgH     = (canvas.height * imgW) / canvas.width;
      if (imgH <= availH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        const totalPages = Math.ceil(imgH / availH);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();
          const srcY = page * availH * (canvas.height / imgH);
          const srcH = Math.min(availH * (canvas.height / imgH), canvas.height - srcY);
          const pg   = document.createElement('canvas');
          pg.width   = canvas.width;
          pg.height  = srcH;
          pg.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(pg.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(availH, imgH - page * availH));
        }
      }
      pdf.save(`Analytics_Summary_${selectedYear}_${selectedTerm}_${EXAM_LABELS[selectedExamType]}.pdf`);
    } catch (err) {
      console.error('Summary PDF error:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setDownloadingSummary(false);
    }
  }, [summaryRef, selectedYear, selectedTerm, selectedExamType]);

  /* ── Download Individual Module PDF ─────────────────────────── */
  const downloadModulePDF = useCallback(async (ref, moduleKey, filename) => {
    if (!ref.current) return;
    setDownloadingModule(moduleKey);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: ref.current.scrollWidth,
        height: ref.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: ref.current.scrollWidth,
        windowHeight: ref.current.scrollHeight,
      });
      const pdf    = new jsPDF('p', 'mm', 'a4');
      const margin = 8;
      const availW = 210 - margin * 2;
      const availH = 297 - margin * 2;
      const imgW   = availW;
      const imgH   = (canvas.height * imgW) / canvas.width;
      if (imgH <= availH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        const totalPages = Math.ceil(imgH / availH);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();
          const srcY = page * availH * (canvas.height / imgH);
          const srcH = Math.min(availH * (canvas.height / imgH), canvas.height - srcY);
          const pg   = document.createElement('canvas');
          pg.width   = canvas.width;
          pg.height  = srcH;
          pg.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(pg.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(availH, imgH - page * availH));
        }
      }
      pdf.save(filename);
    } catch (err) {
      console.error('Module PDF error:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setDownloadingModule(null);
    }
  }, []);

  const dlBtn = (moduleKey, ref, filename, disabled = false) => (
    <button
      onClick={() => downloadModulePDF(ref, moduleKey, filename)}
      disabled={disabled || downloadingModule !== null}
      style={{
        padding: '6px 16px', borderRadius: '8px', border: 'none', flexShrink: 0,
        cursor: (disabled || downloadingModule !== null) ? 'not-allowed' : 'pointer',
        background: (disabled || downloadingModule !== null)
          ? '#e5e7eb' : 'linear-gradient(135deg, #4169E1 0%, #1a3a8f 100%)',
        color: (disabled || downloadingModule !== null) ? '#9ca3af' : '#fff',
        fontWeight: '700', fontSize: '0.78rem', whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      {downloadingModule === moduleKey ? 'Generating…' : '📥 Download PDF'}
    </button>
  );

  /* ── Summary stats for Class Comparison ─────────────────────── */
  const compStats = useMemo(() => {
    const valid = classComparison.means
      .map((m, i) => ({ mean: m, cls: CLASSES[i] }))
      .filter((x) => x.mean !== null);
    if (!valid.length) return null;
    const school = avg(valid.map((x) => x.mean));
    const top    = valid.reduce((a, b) => (a.mean > b.mean ? a : b));
    const bot    = valid.reduce((a, b) => (a.mean < b.mean ? a : b));
    return { school, top: top.cls, bottom: bot.cls, count: valid.length };
  }, [classComparison]);

  return (
    <div style={S.page}>
      <ExamNavigation />
      <div style={S.wrapper}>

        {/* ── Header + Global Filters ── */}
        <div style={S.card}>
          <h1 style={S.pageTitle}>Analytics &amp; Insights</h1>
          <p style={S.pageSub}>School-wide performance analytics — Spring Valley Baptist School</p>
          <div style={S.filterRow}>
            <div style={S.filterGroup}>
              <span style={S.filterLabel}>Academic Year</span>
              <select style={S.select} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={S.filterGroup}>
              <span style={S.filterLabel}>Term</span>
              <select style={S.select} value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}>
                {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.filterGroup}>
              <span style={S.filterLabel}>Exam Type</span>
              <select style={S.select} value={selectedExamType} onChange={(e) => setSelectedExamType(e.target.value)}>
                {EXAM_TYPES.map((et) => <option key={et} value={et}>{EXAM_LABELS[et]}</option>)}
              </select>
            </div>
            {loading && (
              <span style={{ color: '#6b7280', fontSize: '0.85rem', paddingBottom: '2px' }}>
                Loading data…
              </span>
            )}
            {!loading && (
              <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: '600', paddingBottom: '2px' }}>
                {allResults.length} records loaded
              </span>
            )}
            <button
              onClick={handleDownloadSummary}
              disabled={downloadingSummary || loading || allResults.length === 0}
              style={{
                marginLeft: 'auto',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: (downloadingSummary || loading || allResults.length === 0) ? 'not-allowed' : 'pointer',
                background: (downloadingSummary || loading || allResults.length === 0)
                  ? '#e5e7eb' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: (downloadingSummary || loading || allResults.length === 0) ? '#9ca3af' : '#fff',
                fontWeight: '700',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {downloadingSummary ? 'Generating PDF…' : '📥 Download Summary PDF'}
            </button>
          </div>
        </div>

        {/* ── Tabs + Content ── */}
        <div style={S.card}>
          <div style={S.tabRow}>
            {TABS.map((tab, i) => (
              <button key={i} style={tabStyle(activeTab === i)} onClick={() => setActiveTab(i)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ══ Tab 0: Class Comparison ══ */}
          {activeTab === 0 && (
            <div ref={classCompRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>
                  Class Mean Scores — {selectedTerm} · {EXAM_LABELS[selectedExamType]} · {selectedYear}
                </p>
                {dlBtn('classComp', classCompRef, `Class_Comparison_${selectedYear}_${selectedTerm}_${EXAM_LABELS[selectedExamType]}.pdf`, !compStats)}
              </div>

              {compStats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                    {[
                      { label: 'School Average',    value: compStats.school.toFixed(1) },
                      { label: 'Top Performing',    value: compStats.top },
                      { label: 'Needs Most Support', value: compStats.bottom },
                      { label: 'Classes with Data', value: compStats.count },
                    ].map(({ label, value }) => (
                      <div key={label} style={S.statCard}>
                        <div style={S.statValue}>{value}</div>
                        <div style={S.statLabel}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {schoolTarget != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '24px', borderTop: '2px dashed #dc2626' }} />
                      <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: '600' }}>
                        Target: {schoolTarget} — classes below target are highlighted in red
                      </span>
                    </div>
                  )}
                  <Bar
                    data={{
                      labels: classComparison.labels,
                      datasets: [
                        {
                          type: 'bar',
                          label: 'Class Mean',
                          data: classComparison.means,
                          backgroundColor: classComparison.means.map((m) => {
                            if (m === null) return '#e5e7eb';
                            if (schoolTarget != null && m < schoolTarget) return '#ef4444';
                            return m >= 80 ? '#22c55e' : m >= 60 ? '#84cc16' : m >= 40 ? '#f59e0b' : '#ef4444';
                          }),
                          borderRadius: 6,
                        },
                        ...(schoolTarget != null ? [{
                          type: 'line',
                          label: `Target (${schoolTarget})`,
                          data: classComparison.labels.map(() => schoolTarget),
                          borderColor: '#dc2626',
                          borderWidth: 2,
                          borderDash: [8, 4],
                          pointRadius: 0,
                          fill: false,
                          tension: 0,
                        }] : []),
                      ],
                    }}
                    options={{
                      ...baseChartOptions,
                      plugins: {
                        legend: { display: schoolTarget != null },
                        tooltip: { callbacks: { label: (ctx) => ctx.dataset.type === 'line' ? ` Target: ${ctx.parsed.y}` : ` Mean: ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}` } },
                      },
                    }}
                  />
                </>
              ) : (
                <div style={S.empty}>No data for the selected filters.</div>
              )}
            </div>
          )}

          {/* ══ Tab 1: Subject Heat Map ══ */}
          {activeTab === 1 && (
            <div ref={heatMapRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>
                  Subject Performance Heat Map — {selectedTerm} · {EXAM_LABELS[selectedExamType]} · {selectedYear}
                </p>
                {dlBtn('heatMap', heatMapRef, `Subject_Heat_Map_${selectedYear}_${selectedTerm}_${EXAM_LABELS[selectedExamType]}.pdf`, heatMap.activeSubjects.length === 0)}
              </div>
              {heatMap.activeSubjects.length === 0 ? (
                <div style={S.empty}>No subject data for the selected filters.</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={{ ...S.th, minWidth: '100px', position: 'sticky', left: 0, zIndex: 1 }}>Class</th>
                          {heatMap.activeSubjects.map((s) => (
                            <th key={s} style={{ ...S.th, textAlign: 'center', minWidth: '80px' }}>
                              {SUBJECTS[s]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CLASSES.map((cls) => {
                          const cd = heatMap.byClass[cls];
                          if (!cd) return null;
                          return (
                            <tr key={cls}>
                              <td style={{ ...S.td, fontWeight: '700', color: '#0b3d91', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                                {cls}
                              </td>
                              {heatMap.activeSubjects.map((subj) => {
                                const mean = cd[subj] ? avg(cd[subj]) : null;
                                const { bg, text } = scoreColor(mean);
                                return (
                                  <td key={subj} style={{ ...S.td, textAlign: 'center', background: bg, color: text, fontWeight: '700', fontSize: '0.85rem' }}>
                                    {mean !== null ? mean.toFixed(1) : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    {[
                      { bg: '#dcfce7', text: '#15803d', label: '≥ 80  Exceeds Expectations' },
                      { bg: '#d9f99d', text: '#4d7c0f', label: '60–79  Meets Expectations' },
                      { bg: '#fef3c7', text: '#92400e', label: '40–59  Approaching Expectations' },
                      { bg: '#fee2e2', text: '#991b1b', label: '< 40  Below Expectations' },
                    ].map(({ bg, text, label }) => (
                      <span key={label} style={{ background: bg, color: text, padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ Tab 2: Class Progression ══ */}
          {activeTab === 2 && (
            <div ref={classProgRef}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>Class Mean Progression Throughout {selectedYear}</p>
                <div style={S.filterGroup}>
                  <span style={S.filterLabel}>Class</span>
                  <select style={S.select} value={progClass} onChange={(e) => setProgClass(e.target.value)}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {dlBtn('classProg', classProgRef, `Class_Progression_${progClass}_${selectedYear}.pdf`, classProgression.values.every(v => v === null))}
                </div>
              </div>
              {classProgression.values.every((v) => v === null) ? (
                <div style={S.empty}>No data for {progClass} in {selectedYear}.</div>
              ) : (
                <Line
                  data={{
                    labels: classProgression.labels,
                    datasets: [{
                      label: `${progClass} Mean`,
                      data: classProgression.values,
                      borderColor: '#4169E1',
                      backgroundColor: 'rgba(65,105,225,0.08)',
                      tension: 0.4,
                      fill: true,
                      pointRadius: 5,
                      pointBackgroundColor: '#4169E1',
                      spanGaps: true,
                    }],
                  }}
                  options={{
                    ...baseChartOptions,
                    plugins: {
                      legend: { display: true, labels: { font: { size: 13 }, color: '#374151' } },
                      tooltip: { callbacks: { label: (ctx) => ` Mean: ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}` } },
                    },
                  }}
                />
              )}
            </div>
          )}

          {/* ══ Tab 3: Student Progress ══ */}
          {activeTab === 3 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  <p style={{ ...S.sectionTitle, margin: 0 }}>Student Performance Throughout {selectedYear}</p>
                  {dlBtn('studentProg', studentProgRef, `Student_Progress_${selectedStudent ? uniqueStudents.find(s => s.id === selectedStudent)?.name : 'Unknown'}_${selectedYear}.pdf`, !selectedStudent || !studentProgress || studentProgress.values.every(v => v === null))}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {/* Class filter */}
                  <div style={S.filterGroup}>
                    <span style={S.filterLabel}>Class</span>
                    <select
                      style={S.select}
                      value={progStudentClass}
                      onChange={(e) => { setProgStudentClass(e.target.value); setSelectedStudent(''); setStudentSearch(''); }}
                    >
                      <option value="">All Classes</option>
                      {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* Search */}
                  <div style={S.filterGroup}>
                    <span style={S.filterLabel}>Search student</span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '10px', color: '#9ca3af', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Type a name…"
                        value={studentSearch}
                        onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(''); }}
                        style={{
                          ...S.select, paddingLeft: '30px', minWidth: '180px',
                          outline: 'none',
                        }}
                      />
                      {studentSearch && (
                        <button
                          onClick={() => { setStudentSearch(''); setSelectedStudent(''); }}
                          style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1 }}
                        >✕</button>
                      )}
                    </div>
                  </div>
                  {/* Student picker */}
                  <div style={S.filterGroup}>
                    <span style={S.filterLabel}>
                      Student {filteredStudents.length > 0 ? `(${filteredStudents.length} found)` : ''}
                    </span>
                    <select
                      style={{ ...S.select, minWidth: '220px' }}
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                    >
                      <option value="">— Select a student —</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{!progStudentClass ? ` (${s.cls})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {filteredStudents.length === 0 && (studentSearch || progStudentClass) && (
                    <span style={{ fontSize: '0.82rem', color: '#ef4444', alignSelf: 'flex-end', paddingBottom: '8px' }}>
                      No students match the current filters.
                    </span>
                  )}
                </div>
              </div>

              <div ref={studentProgRef}>
              {!selectedStudent && (
                <div style={S.empty}>
                  {filteredStudents.length === 0 && (studentSearch || progStudentClass)
                    ? 'No students match the current filters.'
                    : 'Select a student above to view their progress chart.'}
                </div>
              )}

              {selectedStudent && studentProgress && (
                <>
                  {studentProgress.values.every((v) => v === null) ? (
                    <div style={S.empty}>No exam data found for this student in {selectedYear}.</div>
                  ) : (
                    <>
                      {/* Mini stats */}
                      {(() => {
                        const vals = studentProgress.values.filter((v) => v !== null);
                        const best  = Math.max(...vals);
                        const worst = Math.min(...vals);
                        const mean  = avg(vals);
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                            {[
                              { label: 'Best Score',    value: best.toFixed(1) },
                              { label: 'Lowest Score',  value: worst.toFixed(1) },
                              { label: 'Year Average',  value: mean.toFixed(1) },
                              { label: 'Exams Recorded', value: vals.length },
                            ].map(({ label, value }) => (
                              <div key={label} style={S.statCard}>
                                <div style={S.statValue}>{value}</div>
                                <div style={S.statLabel}>{label}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <Line
                        data={{
                          labels: studentProgress.labels,
                          datasets: [{
                            label: studentProgress.name,
                            data: studentProgress.values,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139,92,246,0.08)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 5,
                            pointBackgroundColor: '#8b5cf6',
                            spanGaps: true,
                          }],
                        }}
                        options={{
                          ...baseChartOptions,
                          plugins: {
                            legend: { display: true, labels: { font: { size: 13 }, color: '#374151' } },
                            tooltip: { callbacks: { label: (ctx) => ` Mean: ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}` } },
                          },
                        }}
                      />

                      {/* Subject breakdown table */}
                      {studentSubjectBreakdown && (
                        <div style={{ marginTop: '32px' }}>
                          <p style={{ ...S.sectionTitle, marginBottom: '12px', fontSize: '1rem' }}>
                            Subject Scores Breakdown — {studentProgress.name}
                          </p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ ...S.table, fontSize: '0.8rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...S.th, minWidth: '100px', position: 'sticky', left: 0, zIndex: 1 }}>Subject</th>
                                  {studentSubjectBreakdown.cols.map((c) => (
                                    <th key={c.key} style={{ ...S.th, textAlign: 'center', minWidth: '72px', whiteSpace: 'nowrap' }}>
                                      {c.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {studentSubjectBreakdown.activeSubjects.map((subj, si) => (
                                  <tr key={subj} style={{ background: si % 2 === 0 ? '#fff' : '#fafafa' }}>
                                    <td style={{ ...S.td, fontWeight: '600', color: '#374151', position: 'sticky', left: 0, background: si % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>
                                      {SUBJECTS[subj]}
                                    </td>
                                    {studentSubjectBreakdown.cols.map((c) => {
                                      const score = c.row && typeof c.row[subj] === 'number' ? c.row[subj] : null;
                                      const { bg, text } = scoreColor(score);
                                      return (
                                        <td key={c.key} style={{ ...S.td, textAlign: 'center', background: score !== null ? bg : undefined }}>
                                          {score !== null
                                            ? <span style={{ color: text, fontWeight: '700' }}>{score.toFixed(1)}</span>
                                            : <span style={{ color: '#d1d5db' }}>—</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                                {/* Mean row */}
                                <tr style={{ background: '#f0f4ff', borderTop: '2px solid #c7d2fe' }}>
                                  <td style={{ ...S.td, fontWeight: '700', color: '#0b3d91', position: 'sticky', left: 0, background: '#f0f4ff', zIndex: 1 }}>
                                    Mean
                                  </td>
                                  {studentSubjectBreakdown.cols.map((c) => {
                                    const mean = c.row && typeof c.row.mean === 'number' ? c.row.mean : null;
                                    const { bg, text } = scoreColor(mean);
                                    return (
                                      <td key={c.key} style={{ ...S.td, textAlign: 'center', background: mean !== null ? bg : undefined }}>
                                        {mean !== null
                                          ? <span style={{ color: text, fontWeight: '700', fontSize: '0.85rem' }}>{mean.toFixed(1)}</span>
                                          : <span style={{ color: '#d1d5db' }}>—</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {/* Colour legend */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                            {[
                              { bg: '#dcfce7', text: '#15803d', label: '≥ 80  Exceeds' },
                              { bg: '#d9f99d', text: '#4d7c0f', label: '60–79  Meets' },
                              { bg: '#fef3c7', text: '#92400e', label: '40–59  Approaching' },
                              { bg: '#fee2e2', text: '#991b1b', label: '< 40  Below' },
                            ].map(({ bg, text, label }) => (
                              <span key={label} style={{ background: bg, color: text, padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              </div>
            </div>
          )}

          {/* ══ Tab 4: At-Risk Students ══ */}
          {activeTab === 4 && (
            <div ref={atRiskRef}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>
                  At-Risk Students — {selectedTerm} · {EXAM_LABELS[selectedExamType]} · {selectedYear}
                </p>
                <div style={S.filterGroup}>
                  <span style={S.filterLabel}>Threshold — scoring below</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="range" min="20" max="70" step="5"
                      value={atRiskThreshold}
                      onChange={(e) => setAtRiskThreshold(Number(e.target.value))}
                      style={{ width: '130px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '700', color: '#ef4444', fontSize: '1.1rem', minWidth: '28px' }}>
                      {atRiskThreshold}
                    </span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {dlBtn('atRisk', atRiskRef, `At_Risk_Students_${selectedYear}_${selectedTerm}_${EXAM_LABELS[selectedExamType]}.pdf`, atRiskList.length === 0)}
                </div>
              </div>

              {atRiskList.length === 0 ? (
                <div style={{ ...S.empty, color: '#22c55e', fontWeight: '600' }}>
                  No students below {atRiskThreshold} for this selection.
                </div>
              ) : (
                <>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '12px' }}>
                    {atRiskList.length} student{atRiskList.length !== 1 ? 's' : ''} scoring below&nbsp;
                    <strong style={{ color: '#ef4444' }}>{atRiskThreshold}</strong>
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>#</th>
                          <th style={S.th}>Student Name</th>
                          <th style={S.th}>Class</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>Mean Score</th>
                          <th style={S.th}>Performance Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRiskList.map((s, i) => {
                          const { bg, text } = scoreColor(s.mean);
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ ...S.td, color: '#9ca3af', fontWeight: '600' }}>{i + 1}</td>
                              <td style={{ ...S.td, fontWeight: '600' }}>{s.name}</td>
                              <td style={S.td}>{s.cls}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>
                                <span style={{ background: bg, color: text, padding: '3px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.875rem' }}>
                                  {s.mean.toFixed(1)}
                                </span>
                              </td>
                              <td style={{ ...S.td, color: text, fontWeight: '500', fontSize: '0.85rem' }}>
                                {bandLabel(s.mean)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ Tab 5: Subject Weakness Report ══ */}
          {activeTab === 5 && (
            <div ref={subjectWeakRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>
                  Subject Weakness Report — {selectedTerm} · {EXAM_LABELS[selectedExamType]} · {selectedYear}
                </p>
                {dlBtn('subjectWeak', subjectWeakRef, `Subject_Weakness_${selectedYear}_${selectedTerm}_${EXAM_LABELS[selectedExamType]}.pdf`, subjectWeakness.length === 0)}
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '20px' }}>
                Subjects ranked weakest to strongest across the whole school. Top 3 in red need the most attention.
              </p>

              {subjectWeakness.length === 0 ? (
                <div style={S.empty}>No subject data for the selected filters.</div>
              ) : (
                <>
                  <Bar
                    data={{
                      labels: subjectWeakness.map((s) => s.label),
                      datasets: [{
                        label: 'School-wide Average',
                        data: subjectWeakness.map((s) => s.avg),
                        backgroundColor: subjectWeakness.map((s) =>
                          s.avg >= 80 ? '#22c55e' : s.avg >= 60 ? '#84cc16' : s.avg >= 40 ? '#f59e0b' : '#ef4444'
                        ),
                        borderRadius: 6,
                      }],
                    }}
                    options={{
                      ...baseChartOptions,
                      indexAxis: 'y',
                      scales: { x: { min: 0, max: 100, ticks: { stepSize: 20 } }, y: {} },
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => ` Average: ${ctx.parsed.x?.toFixed(1)}` } },
                      },
                    }}
                  />
                  <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Rank</th>
                          <th style={S.th}>Subject</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>School Average</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>Students</th>
                          <th style={S.th}>Performance Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectWeakness.map((s, i) => {
                          const { bg, text } = scoreColor(s.avg);
                          return (
                            <tr key={s.subj} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ ...S.td, fontWeight: '700', color: i < 3 ? '#ef4444' : '#6b7280', fontSize: '0.95rem' }}>
                                {i + 1}
                              </td>
                              <td style={{ ...S.td, fontWeight: '600' }}>{s.label}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>
                                <span style={{ background: bg, color: text, padding: '3px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.875rem' }}>
                                  {s.avg.toFixed(1)}
                                </span>
                              </td>
                              <td style={{ ...S.td, textAlign: 'center', color: '#6b7280' }}>{s.count}</td>
                              <td style={{ ...S.td, color: text, fontWeight: '500', fontSize: '0.85rem' }}>
                                {bandLabel(s.avg)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ Tab 6: Term Comparison ══ */}
          {activeTab === 6 && (
            <div ref={termCompRef}>
              {/* Pickers for Term A and Term B */}
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <p style={{ ...S.sectionTitle, margin: 0 }}>Term Comparison — {selectedYear}</p>
                    {dlBtn('termComp', termCompRef, `Term_Comparison_${selectedYear}.pdf`, termComparison.length === 0)}
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                    Compare every class's mean between two exam sittings side-by-side.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {/* Term A */}
                  <div style={{ background: 'rgba(65,105,225,0.08)', border: '2px solid #4169E1', borderRadius: '12px', padding: '12px 16px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#4169E1', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Period A
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={S.filterGroup}>
                        <span style={S.filterLabel}>Term</span>
                        <select style={S.select} value={termAterm} onChange={(e) => setTermAterm(e.target.value)}>
                          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={S.filterGroup}>
                        <span style={S.filterLabel}>Exam</span>
                        <select style={S.select} value={termAexam} onChange={(e) => setTermAexam(e.target.value)}>
                          {EXAM_TYPES.map((et) => <option key={et} value={et}>{EXAM_LABELS[et]}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '1.5rem', color: '#9ca3af', alignSelf: 'center', paddingBottom: '4px' }}>→</span>

                  {/* Term B */}
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid #f59e0b', borderRadius: '12px', padding: '12px 16px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#d97706', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Period B
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={S.filterGroup}>
                        <span style={S.filterLabel}>Term</span>
                        <select style={S.select} value={termBterm} onChange={(e) => setTermBterm(e.target.value)}>
                          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={S.filterGroup}>
                        <span style={S.filterLabel}>Exam</span>
                        <select style={S.select} value={termBexam} onChange={(e) => setTermBexam(e.target.value)}>
                          {EXAM_TYPES.map((et) => <option key={et} value={et}>{EXAM_LABELS[et]}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {termComparison.length === 0 ? (
                <div style={S.empty}>No data found for the selected periods.</div>
              ) : (
                <>
                  {/* Summary row */}
                  {(() => {
                    const improved = termComparison.filter((r) => r.delta !== null && r.delta > 0).length;
                    const declined = termComparison.filter((r) => r.delta !== null && r.delta < 0).length;
                    const unchanged = termComparison.filter((r) => r.delta !== null && Math.abs(r.delta) < 0.05).length;
                    const avgDelta = avg(termComparison.filter((r) => r.delta !== null).map((r) => r.delta));
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                        {[
                          { label: 'Classes Improved',  value: improved,  color: '#15803d' },
                          { label: 'Classes Declined',  value: declined,  color: '#dc2626' },
                          { label: 'Unchanged',         value: unchanged, color: '#6b7280' },
                          { label: 'Avg Score Change',  value: avgDelta !== null ? (avgDelta > 0 ? '+' : '') + avgDelta.toFixed(1) : '—', color: avgDelta > 0 ? '#15803d' : avgDelta < 0 ? '#dc2626' : '#6b7280' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={S.statCard}>
                            <div style={{ ...S.statValue, color }}>{value}</div>
                            <div style={S.statLabel}>{label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Grouped bar chart */}
                  <Bar
                    data={{
                      labels: termComparison.map((r) => r.cls),
                      datasets: [
                        {
                          label: `${termAterm} ${EXAM_LABELS[termAexam]} (A)`,
                          data: termComparison.map((r) => r.a),
                          backgroundColor: 'rgba(65,105,225,0.75)',
                          borderColor: '#4169E1',
                          borderWidth: 1,
                          borderRadius: 4,
                        },
                        {
                          label: `${termBterm} ${EXAM_LABELS[termBexam]} (B)`,
                          data: termComparison.map((r) => r.b),
                          backgroundColor: 'rgba(245,158,11,0.75)',
                          borderColor: '#d97706',
                          borderWidth: 1,
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      ...baseChartOptions,
                      plugins: {
                        legend: { display: true, labels: { font: { size: 12 }, color: '#374151' } },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}`,
                          },
                        },
                      },
                    }}
                  />

                  {/* Delta table */}
                  <div style={{ overflowX: 'auto', marginTop: '28px' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Class</th>
                          <th style={{ ...S.th, textAlign: 'center' }}>
                            Period A — {termAterm} {EXAM_LABELS[termAexam]}
                          </th>
                          <th style={{ ...S.th, textAlign: 'center' }}>
                            Period B — {termBterm} {EXAM_LABELS[termBexam]}
                          </th>
                          <th style={{ ...S.th, textAlign: 'center' }}>Change</th>
                          <th style={S.th}>Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {termComparison.map((r, i) => {
                          const { bg: bgA, text: textA } = scoreColor(r.a);
                          const { bg: bgB, text: textB } = scoreColor(r.b);
                          const deltaColor = r.delta === null ? '#9ca3af' : r.delta > 0 ? '#15803d' : r.delta < 0 ? '#dc2626' : '#6b7280';
                          const trendIcon  = r.delta === null ? '—' : r.delta > 1 ? '↑ Improved' : r.delta < -1 ? '↓ Declined' : '→ Stable';
                          return (
                            <tr key={r.cls} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ ...S.td, fontWeight: '700', color: '#0b3d91' }}>{r.cls}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>
                                {r.a !== null
                                  ? <span style={{ background: bgA, color: textA, padding: '3px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.875rem' }}>{r.a.toFixed(1)}</span>
                                  : <span style={{ color: '#9ca3af' }}>—</span>}
                              </td>
                              <td style={{ ...S.td, textAlign: 'center' }}>
                                {r.b !== null
                                  ? <span style={{ background: bgB, color: textB, padding: '3px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.875rem' }}>{r.b.toFixed(1)}</span>
                                  : <span style={{ color: '#9ca3af' }}>—</span>}
                              </td>
                              <td style={{ ...S.td, textAlign: 'center', fontWeight: '700', color: deltaColor, fontSize: '1rem' }}>
                                {r.delta !== null ? (r.delta > 0 ? '+' : '') + r.delta.toFixed(1) : '—'}
                              </td>
                              <td style={{ ...S.td, color: deltaColor, fontWeight: '600', fontSize: '0.875rem' }}>
                                {trendIcon}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Hidden off-screen summary report for PDF capture ── */}
        <div
          ref={summaryRef}
          style={{
            position: 'fixed', left: '-9999px', top: 0,
            width: '794px', background: '#fff',
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fontSize: '11px', color: '#1f2937',
          }}
        >
          {/* Report header */}
          <div style={{ background: 'linear-gradient(135deg, #0b3d91 0%, #1a56c4 100%)', padding: '24px 32px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logschool.png" alt="" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>Spring Valley Baptist School</div>
                <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>Analytics Summary Report</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '12px', opacity: 0.9 }}>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>{selectedTerm} · {EXAM_LABELS[selectedExamType]}</div>
                <div>Academic Year {selectedYear}</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 32px' }}>
            {/* Key stats row */}
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
              School Overview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[
                { label: 'School Average',    value: compStats ? compStats.school.toFixed(1) : '—' },
                { label: 'Top Class',         value: compStats ? compStats.top : '—' },
                { label: 'Needs Support',     value: compStats ? compStats.bottom : '—' },
                { label: 'Students Assessed', value: filteredResults.filter(r => typeof r.mean === 'number').length },
                { label: `At-Risk (< ${atRiskThreshold})`, value: atRiskList.length },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#0b3d91' }}>{value}</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '3px', fontWeight: '600' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Class performance table */}
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
              Class Performance
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#0b3d91', color: '#fff' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Class</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '600' }}>Mean Score</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600', width: '200px' }}>Score Bar</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Performance Band</th>
                </tr>
              </thead>
              <tbody>
                {classComparison.labels.map((cls, i) => {
                  const mean = classComparison.means[i];
                  if (mean === null) return null;
                  const { bg, text } = scoreColor(mean);
                  const barColor = mean >= 80 ? '#22c55e' : mean >= 60 ? '#84cc16' : mean >= 40 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={cls} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '600', color: '#0b3d91', borderBottom: '1px solid #f3f4f6' }}>{cls}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ background: bg, color: text, padding: '2px 10px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
                          {mean.toFixed(1)}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ background: '#f3f4f6', borderRadius: '4px', height: '10px', width: '180px' }}>
                          <div style={{ background: barColor, borderRadius: '4px', height: '10px', width: `${mean}%` }} />
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', color: text, fontWeight: '500', borderBottom: '1px solid #f3f4f6' }}>{bandLabel(mean)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Subject analysis table */}
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
              Subject Analysis — Ranked Weakest to Strongest
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#0b3d91', color: '#fff' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Rank</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Subject</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '600' }}>School Average</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600', width: '160px' }}>Score Bar</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '600' }}>Students</th>
                </tr>
              </thead>
              <tbody>
                {subjectWeakness.map((s, i) => {
                  const { bg, text } = scoreColor(s.avg);
                  const barColor = s.avg >= 80 ? '#22c55e' : s.avg >= 60 ? '#84cc16' : s.avg >= 40 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={s.subj} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: i < 3 ? '#dc2626' : '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{i + 1}</td>
                      <td style={{ padding: '6px 12px', fontWeight: '600', borderBottom: '1px solid #f3f4f6' }}>{s.label}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ background: bg, color: text, padding: '2px 10px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
                          {s.avg.toFixed(1)}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ background: '#f3f4f6', borderRadius: '4px', height: '10px', width: '140px' }}>
                          <div style={{ background: barColor, borderRadius: '4px', height: '10px', width: `${s.avg}%` }} />
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{s.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* At-risk summary */}
            {atRiskList.length > 0 && (
              <>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                  At-Risk Students (Mean &lt; {atRiskThreshold})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#dc2626', color: '#fff' }}>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>#</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Student Name</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Class</th>
                      <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: '600' }}>Mean</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: '600' }}>Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskList.map((s, i) => {
                      const { bg, text } = scoreColor(s.mean);
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                          <td style={{ padding: '6px 12px', color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>{i + 1}</td>
                          <td style={{ padding: '6px 12px', fontWeight: '600', borderBottom: '1px solid #f3f4f6' }}>{s.name}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6' }}>{s.cls}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ background: bg, color: text, padding: '2px 10px', borderRadius: '12px', fontWeight: '700' }}>
                              {s.mean.toFixed(1)}
                            </span>
                          </td>
                          <td style={{ padding: '6px 12px', color: text, fontWeight: '500', borderBottom: '1px solid #f3f4f6' }}>{bandLabel(s.mean)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '9px' }}>
              <span>Spring Valley Baptist School — Confidential Academic Report</span>
              <span>Generated by the School Analytics System · {new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
