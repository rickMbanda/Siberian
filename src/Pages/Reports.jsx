import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import IndividualReport from '../Components/IndividualReport';
import ClassMarklist from '../Components/ClassMarklist';
import ExamNavigation from '../Components/ExamNavigation';
import { fetchResults } from '../api/results';
import { generateParentPin, fetchPinForStudent, revokeParentPin } from '../api/parentPins';
import '../Components/examModuleStyles.css';

const Reports = () => {
  const currentYear = new Date().getFullYear().toString();
  const [allStudents, setAllStudents] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedClass, setSelectedClass] = useState('All Classes');
  // Per-section term/examType selectors (replaces the old global filters that
  // caused each student to appear up to 9 times — once per term×examType).
  const [individualTerm, setIndividualTerm] = useState('Term 1');
  const [individualExamType, setIndividualExamType] = useState('opener');
  const [marklistClass, setMarklistClass] = useState('All Classes');
  const [marklistTerm, setMarklistTerm] = useState('Term 1');
  const [marklistExamType, setMarklistExamType] = useState('opener');
  const [loading, setLoading] = useState(true);
  // Now stores the unique studentRecordId rather than a flat-row id.
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  // Set print orientation based on class (landscape for Grade 5-9)
  const [printOrientation, setPrintOrientation] = useState('portrait');

  // Automatically set orientation based on selected class for marklists
  useEffect(() => {
    if (marklistClass && marklistClass !== 'All Classes') {
      const gradesRequiringLandscape = ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
      if (gradesRequiringLandscape.includes(marklistClass)) {
        setPrintOrientation('landscape');
      } else {
        setPrintOrientation('portrait');
      }
    }
  }, [marklistClass]);
  const [downloadingClass, setDownloadingClass] = useState(false);
  const [downloadingIndividual, setDownloadingIndividual] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [batchPreparing, setBatchPreparing] = useState(false);

  const individualRef = useRef();
  const classRef = useRef();

  const [parentPin, setParentPin] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [shareContact, setShareContact] = useState('');

  // Load existing PIN whenever the selected student / term / exam changes.
  useEffect(() => {
    if (!selectedStudentId) { setParentPin(null); return; }
    const rec = (Array.isArray(allStudents) ? allStudents : []).find(
      s => (s.studentRecordId || `${(s.name||'').toLowerCase()}|${(s.class||'').toLowerCase()}`) === selectedStudentId
    );
    const sid = rec?.studentRecordId;
    if (!sid) { setParentPin(null); return; }
    let cancelled = false;
    fetchPinForStudent({ studentRecordId: sid, academicYear: selectedYear, term: individualTerm, examType: individualExamType })
      .then(p => { if (!cancelled) setParentPin(p || null); })
      .catch(() => { if (!cancelled) setParentPin(null); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, selectedYear, individualTerm, individualExamType]);

  // Fetch results for the selected academic year. The backend returns one
  // flat row per (student, term, examType) — we dedupe to one entry per
  // student in the picker below.
  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        const results = await fetchResults(selectedYear);
        setAllStudents(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Error fetching results:', error);
        setAllStudents([]);
      } finally {
        setLoading(false);
      }
    };
    loadResults();
  }, [selectedYear]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  // Apply academic ranking (positions) to a flat list of one-row-per-student
  // exam records. Mutates input copies and returns a new ordered array.
  const rankStudents = (rows) => {
    const studentsWhoSat = rows.filter(s =>
      (s.examStatus === 'sat' || !s.examStatus) &&
      typeof s.mean === 'number' && !isNaN(s.mean)
    );
    const absentStudents = rows.filter(s => s.examStatus === 'absent');
    const incompleteStudents = rows.filter(s => s.examStatus === 'incomplete');
    const studentsWithoutMean = rows.filter(s =>
      !(typeof s.mean === 'number' && !isNaN(s.mean)) &&
      (!s.examStatus || s.examStatus === 'sat')
    );

    studentsWhoSat.sort((a, b) => b.mean - a.mean);
    let position = 1;
    for (let i = 0; i < studentsWhoSat.length; i++) {
      if (i === 0) {
        position = 1;
      } else {
        const currentMean = Math.round(studentsWhoSat[i].mean * 100) / 100;
        const previousMean = Math.round(studentsWhoSat[i - 1].mean * 100) / 100;
        const currentTotal = studentsWhoSat[i].total || 0;
        const previousTotal = studentsWhoSat[i - 1].total || 0;
        if (currentMean !== previousMean || currentTotal !== previousTotal) {
          position = i + 1;
        }
      }
      studentsWhoSat[i].position = position;
    }
    absentStudents.forEach(s => { s.position = 'ABS'; });
    incompleteStudents.forEach(s => { s.position = 'N/A'; });
    studentsWithoutMean.forEach(s => { s.position = '-'; });

    return [...studentsWhoSat, ...absentStudents, ...incompleteStudents, ...studentsWithoutMean];
  };

  // Stable identity for a student across the term×examType cross-product.
  const studentKey = (s) => s.studentRecordId || `${(s.name || '').toLowerCase()}|${(s.class || '').toLowerCase()}`;

  // ── Individual Report data ───────────────────────────────────────────────
  // Step 1: filter by class only (Year is already applied at the fetch level).
  // Step 2: dedupe to one entry per unique student so the picker shows ~392
  // students rather than the cross-product of term×examType rows.
  const uniqueStudents = useMemo(() => {
    const rows = Array.isArray(allStudents) ? allStudents : [];
    const filtered = selectedClass === 'All Classes'
      ? rows
      : rows.filter(s => s.class === selectedClass);

    const byKey = new Map();
    filtered.forEach(row => {
      const key = studentKey(row);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          studentRecordId: row.studentRecordId,
          name: row.name,
          class: row.class,
          academicYear: row.academicYear
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [allStudents, selectedClass]);

  // Apply name search to the deduped student list.
  const searchFilteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return uniqueStudents;
    const q = studentSearchTerm.toLowerCase();
    return uniqueStudents.filter(s => s.name?.toLowerCase().includes(q));
  }, [uniqueStudents, studentSearchTerm]);

  // All exam records belonging to the picked student, this year.
  const selectedStudentRecords = useMemo(() => {
    if (!selectedStudentId) return [];
    return (Array.isArray(allStudents) ? allStudents : [])
      .filter(s => studentKey(s) === selectedStudentId);
  }, [allStudents, selectedStudentId]);

  // What term/examType combos exist for this student so we can offer
  // navigation between Opener / Midterm / Endterm of any term they sat.
  const availableTermsForStudent = useMemo(() => {
    const terms = [...new Set(selectedStudentRecords.map(r => r.term).filter(Boolean))];
    return terms.sort();
  }, [selectedStudentRecords]);

  const availableExamTypesForStudent = useMemo(() => {
    const types = [...new Set(
      selectedStudentRecords
        .filter(r => !individualTerm || r.term === individualTerm)
        .map(r => r.examType)
        .filter(Boolean)
    )];
    const order = ['opener', 'midterm', 'endterm'];
    return types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [selectedStudentRecords, individualTerm]);

  // Class data for the same (class, term, examType) — used for ranking the
  // selected student and computing class averages on the IndividualReport.
  const individualClassData = useMemo(() => {
    if (!selectedStudentId) return [];
    const target = selectedStudentRecords.find(
      r => r.term === individualTerm && r.examType === individualExamType
    );
    const cls = target?.class;
    if (!cls) return [];
    const rows = (Array.isArray(allStudents) ? allStudents : []).filter(s =>
      s.class === cls && s.term === individualTerm && s.examType === individualExamType
    );
    return rankStudents(rows);
  }, [allStudents, selectedStudentId, selectedStudentRecords, individualTerm, individualExamType]);

  // The actual flat row to render in <IndividualReport> (with .position from ranking).
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return individualClassData.find(s => studentKey(s) === selectedStudentId) || null;
  }, [individualClassData, selectedStudentId]);

  // Keep the picker's term/examType valid when student or available combos change.
  useEffect(() => {
    if (availableTermsForStudent.length > 0 && !availableTermsForStudent.includes(individualTerm)) {
      setIndividualTerm(availableTermsForStudent[0]);
    }
  }, [availableTermsForStudent, individualTerm]);
  useEffect(() => {
    if (availableExamTypesForStudent.length > 0 && !availableExamTypesForStudent.includes(individualExamType)) {
      setIndividualExamType(availableExamTypesForStudent[0]);
    }
  }, [availableExamTypesForStudent, individualExamType]);

  // ── Class Marklist data ──────────────────────────────────────────────────
  // Filtered to a single (class, term, examType, year) so each student appears
  // exactly once and the count matches the real class size.
  const marklistStudents = useMemo(() => {
    let filtered = Array.isArray(allStudents) ? allStudents : [];
    if (marklistClass !== 'All Classes') {
      filtered = filtered.filter(s => s.class === marklistClass);
    }
    filtered = filtered.filter(s =>
      s.term === marklistTerm && s.examType === marklistExamType
    );
    return rankStudents(filtered);
  }, [allStudents, marklistClass, marklistTerm, marklistExamType]);

  // ── Filter option lists ──────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const cy = parseInt(currentYear, 10);
    const years = new Set();
    for (let y = cy - 2; y <= cy + 1; y++) years.add(y.toString());
    allStudents.forEach(s => s.academicYear && years.add(s.academicYear.toString()));
    return Array.from(years).sort().reverse();
  }, [allStudents, currentYear]);

  const availableClasses = useMemo(() => {
    const classes = [...new Set(allStudents.map(s => s.class).filter(Boolean))];
    return ['All Classes', ...classes.sort()];
  }, [allStudents]);

  const ALL_TERMS = ['Term 1', 'Term 2', 'Term 3'];
  const ALL_EXAM_TYPES = ['opener', 'midterm', 'endterm'];
  const examTypeLabel = (t) => t === 'opener' ? 'Opener' : t === 'midterm' ? 'Midterm' : t === 'endterm' ? 'Endterm' : t;


  // Download handlers
  const handleDownloadIndividual = useCallback(async () => {
    if (!selectedStudent || !individualRef.current) return;

    setDownloadingIndividual(true);
    try {
      // Hide only UI chrome — keep the on-screen report appearance intact
      const style = document.createElement('style');
      style.innerHTML = `
        .no-print { display: none !important; }
        button { display: none !important; }
        nav { display: none !important; }
        .exam-nav { display: none !important; }
      `;
      document.head.appendChild(style);

      // Let the DOM settle after hiding chrome elements
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await html2canvas(individualRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: individualRef.current.scrollWidth,
        height: individualRef.current.scrollHeight
      });

      document.head.removeChild(style);

      // Always fit the entire report onto exactly one A4 page
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 8;
      const availableWidth  = 210 - margin * 2;
      const availableHeight = 297 - margin * 2;

      const canvasAspect    = canvas.height / canvas.width;
      const availableAspect = availableHeight / availableWidth;

      let imgWidth, imgHeight;
      if (canvasAspect > availableAspect) {
        imgHeight = availableHeight;
        imgWidth  = imgHeight / canvasAspect;
      } else {
        imgWidth  = availableWidth;
        imgHeight = imgWidth * canvasAspect;
      }

      const xOffset = margin + (availableWidth - imgWidth) / 2;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, margin, imgWidth, imgHeight);
      pdf.save(`Individual_Report_${selectedStudent.name}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloadingIndividual(false);
    }
  }, [selectedStudent]);

  // ── Batch Download (all individual reports for the selected class) ───────
  // Builds one PDF that contains every student's IndividualReport for the
  // currently chosen (class, term, examType). Renders each report into an
  // off-screen container so the live UI is not disrupted.
  const batchStudents = useMemo(() => {
    if (selectedClass === 'All Classes') return [];
    const rows = (Array.isArray(allStudents) ? allStudents : []).filter(s =>
      s.class === selectedClass &&
      s.term === individualTerm &&
      s.examType === individualExamType
    );
    return rankStudents(rows);
  }, [allStudents, selectedClass, individualTerm, individualExamType]);

  const handleBatchPrint = useCallback(async () => {
    if (selectedClass === 'All Classes') {
      alert('Please pick a specific class (not "All Classes") before batch printing.');
      return;
    }
    if (!batchStudents || batchStudents.length === 0) {
      alert('No students with marks were found for this class / term / exam combination.');
      return;
    }

    // Mount the hidden off-screen container so React renders every report
    // and Chart.js draws every chart before we capture them.
    setBatchPreparing(true);
    setBatchPrinting(true);

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    // Scale wait time with class size so charts finish drawing.
    await new Promise((resolve) =>
      setTimeout(resolve, 800 + batchStudents.length * 80)
    );

    setBatchPreparing(false);

    try {
      const pages = document.querySelectorAll('.batch-print-page');
      if (pages.length === 0) {
        alert('Could not find report pages to capture. Please try again.');
        setBatchPrinting(false);
        return;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin         = 8;
      const availableWidth  = 210 - margin * 2;
      const availableHeight = 297 - margin * 2;

      for (let i = 0; i < pages.length; i++) {
        const page   = pages[i];
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: page.scrollWidth,
          height: page.scrollHeight
        });

        const canvasAspect    = canvas.height / canvas.width;
        const availableAspect = availableHeight / availableWidth;

        let imgWidth, imgHeight;
        if (canvasAspect > availableAspect) {
          imgHeight = availableHeight;
          imgWidth  = imgHeight / canvasAspect;
        } else {
          imgWidth  = availableWidth;
          imgHeight = imgWidth * canvasAspect;
        }

        const xOffset = margin + (availableWidth - imgWidth) / 2;
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, margin, imgWidth, imgHeight);
      }

      // Open the multi-page PDF and trigger the browser print dialog.
      const blob    = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const win     = window.open(blobUrl);
      if (win) {
        win.addEventListener('load', () => {
          win.focus();
          win.print();
          win.addEventListener('afterprint', () => {
            win.close();
            URL.revokeObjectURL(blobUrl);
          });
        });
      }
    } catch (error) {
      console.error('Error generating batch print:', error);
      alert('Error generating batch print. Please try again.');
    } finally {
      setBatchPrinting(false);
    }
  }, [selectedClass, batchStudents]);

  const handleDownloadClass = useCallback(async () => {
    if (!classRef.current || marklistStudents.length === 0) return;

    setDownloadingClass(true);
    try {
      const style = document.createElement('style');
      style.innerHTML = `
        .no-print { display: none !important; }
        button { display: none !important; }
        nav { display: none !important; }
        .exam-nav { display: none !important; }
        .table-wrapper { overflow: visible !important; max-height: none !important; height: auto !important; }
      `;
      document.head.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(classRef.current, {
        scale: printOrientation === 'landscape' ? 1.5 : 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: classRef.current.scrollWidth,
        height: classRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: classRef.current.scrollWidth,
        windowHeight: classRef.current.scrollHeight
      });

      document.head.removeChild(style);

      const orientation = printOrientation === 'landscape' ? 'l' : 'p';
      const pdf         = new jsPDF(orientation, 'mm', 'a4');
      const pdfW        = pdf.internal.pageSize.getWidth();
      const pdfH        = pdf.internal.pageSize.getHeight();
      const margin      = 7.62;
      const availW      = pdfW - margin * 2;
      const availH      = pdfH - margin * 2;

      const imgW = availW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= availH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        const totalPages = Math.ceil(imgH / availH);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage(orientation);
          const srcY  = page * availH * (canvas.height / imgH);
          const srcH  = Math.min(availH * (canvas.height / imgH), canvas.height - srcY);
          const pg    = document.createElement('canvas');
          pg.width    = canvas.width;
          pg.height   = srcH;
          pg.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(pg.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(availH, imgH - page * availH));
        }
      }

      const className = marklistClass !== 'All Classes' ? marklistClass : 'All';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      pdf.save(`Class_Marklist_${className}_${timestamp}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloadingClass(false);
    }
  }, [classRef, marklistStudents, marklistClass, printOrientation]);


  // Print individual report: capture with html2canvas (same pipeline as
  // download) so print preview is pixel-identical to the downloaded PDF.
  const [printingIndividual, setPrintingIndividual] = useState(false);
  const handlePrintIndividual = useCallback(async () => {
    if (!selectedStudent || !individualRef.current) return;

    setPrintingIndividual(true);
    try {
      const style = document.createElement('style');
      style.innerHTML = `
        .no-print { display: none !important; }
        button { display: none !important; }
        nav { display: none !important; }
        .exam-nav { display: none !important; }
      `;
      document.head.appendChild(style);

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await html2canvas(individualRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: individualRef.current.scrollWidth,
        height: individualRef.current.scrollHeight
      });

      document.head.removeChild(style);

      // Build the same single-page A4 PDF used for download
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 8;
      const availableWidth  = 210 - margin * 2;
      const availableHeight = 297 - margin * 2;

      const canvasAspect    = canvas.height / canvas.width;
      const availableAspect = availableHeight / availableWidth;

      let imgWidth, imgHeight;
      if (canvasAspect > availableAspect) {
        imgHeight = availableHeight;
        imgWidth  = imgHeight / canvasAspect;
      } else {
        imgWidth  = availableWidth;
        imgHeight = imgWidth * canvasAspect;
      }

      const xOffset = margin + (availableWidth - imgWidth) / 2;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, margin, imgWidth, imgHeight);

      // Open the PDF in a new window and trigger the browser print dialog
      const blob    = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const win     = window.open(blobUrl);
      if (win) {
        win.addEventListener('load', () => {
          win.focus();
          win.print();
          win.addEventListener('afterprint', () => {
            win.close();
            URL.revokeObjectURL(blobUrl);
          });
        });
      }
    } catch (error) {
      console.error('Error generating print preview:', error);
      alert('Error generating print preview. Please try again.');
    } finally {
      setPrintingIndividual(false);
    }
  }, [selectedStudent]);

  const [printingClass, setPrintingClass] = useState(false);
  const handlePrintClass = useCallback(async () => {
    if (!classRef.current || marklistStudents.length === 0) return;

    setPrintingClass(true);
    try {
      const style = document.createElement('style');
      style.innerHTML = `
        .no-print { display: none !important; }
        button { display: none !important; }
        nav { display: none !important; }
        .exam-nav { display: none !important; }
        .table-wrapper { overflow: visible !important; max-height: none !important; height: auto !important; }
      `;
      document.head.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(classRef.current, {
        scale: printOrientation === 'landscape' ? 1.5 : 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: classRef.current.scrollWidth,
        height: classRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: classRef.current.scrollWidth,
        windowHeight: classRef.current.scrollHeight
      });

      document.head.removeChild(style);

      const orientation = printOrientation === 'landscape' ? 'l' : 'p';
      const pdf         = new jsPDF(orientation, 'mm', 'a4');
      const pdfW        = pdf.internal.pageSize.getWidth();
      const pdfH        = pdf.internal.pageSize.getHeight();
      const margin      = 7.62;
      const availW      = pdfW - margin * 2;
      const availH      = pdfH - margin * 2;

      const imgW        = availW;
      const imgH        = (canvas.height * imgW) / canvas.width;

      if (imgH <= availH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        const totalPages = Math.ceil(imgH / availH);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage(orientation);
          const srcY   = page * availH * (canvas.height / imgH);
          const srcH   = Math.min(availH * (canvas.height / imgH), canvas.height - srcY);
          const pg     = document.createElement('canvas');
          pg.width     = canvas.width;
          pg.height    = srcH;
          pg.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(pg.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(availH, imgH - page * availH));
        }
      }

      const blob    = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const win     = window.open(blobUrl);
      if (win) {
        win.addEventListener('load', () => {
          win.focus();
          win.print();
          win.addEventListener('afterprint', () => {
            win.close();
            URL.revokeObjectURL(blobUrl);
          });
        });
      }
    } catch (error) {
      console.error('Error generating class print:', error);
      alert('Error generating print. Please try again.');
    } finally {
      setPrintingClass(false);
    }
  }, [classRef, marklistStudents, printOrientation]);

  const styles = {
    container: { padding: '2em', fontFamily: 'sans-serif' },
    section: { marginBottom: '2em' },
    report: { marginTop: '1em', border: '1px solid #aaa', padding: '1em', borderRadius: '8px', background: '#fff' },
    button: {
      marginTop: '1em',
      padding: '1em 1.5em',
      cursor: 'pointer',
      background: 'linear-gradient(90deg, #4f8cff 0%, #2355d6 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 500,
      fontSize: '1.05em',
      transition: 'background 0.2s, transform 0.2s',
      boxShadow: '0 2px 8px rgba(79,140,255,0.08)'
    },
    filtersContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '1em'
    },
    filterGroup: {
        display: 'flex',
        flexDirection: 'column'
    },
    label: {
        marginBottom: '0.5em'
    },
    select: {
        padding: '0.5em',
        borderRadius: '5px',
        border: '1px solid #ccc'
    }
  };



  if (loading) {
    return (
      <div className="exam-module-container">
        <ExamNavigation />
        <h1 style={{ color: '#000080' }}>Reports and Printing</h1>
        <p>Loading student data...</p>
      </div>
    );
  }

  const modernStyles = {
    container: {
      background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    contentWrapper: {
      maxWidth: '1600px',
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
    label: {
      fontSize: '0.9rem',
      fontWeight: '600',
      color: '#374151',
      letterSpacing: '0.5px',
      marginRight: '12px'
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
    sectionHeader: {
      fontSize: '1.8rem',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '24px',
      padding: '16px 0',
      borderBottom: '3px solid #e5e7eb'
    }
  };

  return (
    <div style={modernStyles.container}>
      <ExamNavigation />
      <div style={modernStyles.contentWrapper}>
        <div style={modernStyles.header}>
          <h1 style={modernStyles.title}>Reports and Printing</h1>
          <p style={modernStyles.subtitle}>Generate and print comprehensive student reports</p>
        </div>

        {/* Global Filter Controls — Academic Year drives data fetch.
            Term & Exam Type now live inside each section. */}
        <div className="no-print" style={modernStyles.filtersContainer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5em', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label htmlFor="yearFilter" style={modernStyles.label}>
                Academic Year:
              </label>
              <select
                id="yearFilter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={modernStyles.select}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#374151' }}>
              {uniqueStudents.length} student{uniqueStudents.length !== 1 ? 's' : ''} in {selectedYear}
              {selectedClass !== 'All Classes' ? ` · ${selectedClass}` : ''}
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={modernStyles.sectionHeader}>📄 Individual Report</h2>

        {/* Filters */}
        <div className="no-print" style={{ display: 'flex', gap: '1em', alignItems: 'center', marginBottom: '1em', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="individualClassFilter" style={{ marginRight: '0.5em' }}>
              Filter by Class:
            </label>
            <select
              id="individualClassFilter"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStudentId('');
              }}
              style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {availableClasses.map(className => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            Showing {searchFilteredStudents.length} student{searchFilteredStudents.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1em', alignItems: 'center', marginBottom: '1em', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="studentSelect" style={{ marginRight: '0.5em' }}>
              Select Student:
            </label>
            <select
              id="studentSelect"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc', minWidth: '240px' }}
            >
              <option value="">Select a student...</option>
              {searchFilteredStudents.map(student => (
                <option key={student.key} value={student.key}>
                  {student.name || 'Unnamed Student'}
                  {student.class && ` (${student.class})`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            <label htmlFor="studentSearch" style={{ marginRight: '0.5em' }}>
              Search Students:
            </label>
            <input
              id="studentSearch"
              type="text"
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchFilteredStudents.length > 0) {
                  setSelectedStudentId(searchFilteredStudents[0].key);
                }
              }}
              placeholder="Search by name..."
              style={{
                padding: '0.5em',
                borderRadius: '4px',
                border: '1px solid #ccc',
                minWidth: '200px'
              }}
            />
            <button
              onClick={() => {
                if (searchFilteredStudents.length > 0) {
                  setSelectedStudentId(searchFilteredStudents[0].key);
                }
              }}
              disabled={searchFilteredStudents.length === 0}
              style={{
                padding: '0.5em 1em',
                borderRadius: '4px',
                border: '1px solid #4f8cff',
                backgroundColor: searchFilteredStudents.length > 0 ? '#4f8cff' : '#ccc',
                color: '#fff',
                cursor: searchFilteredStudents.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3em'
              }}
            >
              🔍 Search
            </button>
          </div>
        </div>

        {/* Per-student exam navigation: pick term + opener/midterm/endterm */}
        {selectedStudentId && (
          <div className="no-print" style={{ display: 'flex', gap: '1em', alignItems: 'center', marginBottom: '1em', flexWrap: 'wrap', padding: '0.75em 1em', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div>
              <label htmlFor="individualTermSelect" style={{ marginRight: '0.5em', fontWeight: 600 }}>Term:</label>
              <select
                id="individualTermSelect"
                value={individualTerm}
                onChange={(e) => setIndividualTerm(e.target.value)}
                style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {ALL_TERMS.map(t => (
                  <option key={t} value={t} disabled={!availableTermsForStudent.includes(t)}>
                    {t}{!availableTermsForStudent.includes(t) ? ' (no record)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="individualExamSelect" style={{ marginRight: '0.5em', fontWeight: 600 }}>Exam:</label>
              <select
                id="individualExamSelect"
                value={individualExamType}
                onChange={(e) => setIndividualExamType(e.target.value)}
                style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {ALL_EXAM_TYPES.map(t => (
                  <option key={t} value={t} disabled={!availableExamTypesForStudent.includes(t)}>
                    {examTypeLabel(t)}{!availableExamTypesForStudent.includes(t) ? ' (no record)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {!selectedStudent && (
              <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                No record for {individualTerm} – {examTypeLabel(individualExamType)} ({selectedYear}).
              </span>
            )}
          </div>
        )}

        {selectedStudent && (
          <div ref={individualRef} style={styles.report} className="print-container">
            <IndividualReport student={selectedStudent} classData={individualClassData} />
          </div>
        )}
        {/* Print Options */}
        <div className="no-print" style={{ margin: '1em 0', padding: '1.5em', backgroundColor: '#f8f9fa', borderRadius: '12px', border: '2px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 1em 0', color: '#495057', fontWeight: '600' }}>📊 Excel-Style Print Options</h4>

          <div style={{ display: 'flex', gap: '2em', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontWeight: 'bold', marginRight: '1em', color: '#495057' }}>Page Orientation:</label>
              {marklistClass && ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'].includes(marklistClass) && (
                <div style={{ 
                  marginTop: '0.5em', 
                  padding: '0.5em', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '5px',
                  fontSize: '0.9em',
                  color: '#1565c0'
                }}>
                  <strong>📐 Auto-selected:</strong> Landscape orientation for {marklistClass} (recommended for optimal layout)
                </div>
              )}
              <div style={{ marginTop: '0.5em' }}>
                <label style={{ display: 'block', marginBottom: '0.5em' }}>
                  <input
                    type="radio"
                    value="portrait"
                    checked={printOrientation === 'portrait'}
                    onChange={(e) => setPrintOrientation(e.target.value)}
                    style={{ marginRight: '0.5em' }}
                  />
                  Portrait (Recommended for smaller classes)
                </label>
                <label style={{ display: 'block' }}>
                  <input
                    type="radio"
                    value="landscape"
                    checked={printOrientation === 'landscape'}
                    onChange={(e) => setPrintOrientation(e.target.value)}
                    style={{ marginRight: '0.5em' }}
                  />
                  Landscape (Recommended for large marklists)
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1em', padding: '0.8em', backgroundColor: '#d1ecf1', borderRadius: '8px', fontSize: '0.9em' }}>
            <strong>💡 Tip:</strong> Use Landscape orientation for classes with many subjects or students. 
            The system will automatically split large tables across multiple pages with proper headers on each page.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handlePrintIndividual}
          style={{
            ...styles.button,
            opacity: (!selectedStudent || printingIndividual) ? 0.6 : 1,
            cursor: (!selectedStudent || printingIndividual) ? 'not-allowed' : 'pointer'
          }}
          disabled={!selectedStudent || printingIndividual}
        >
          {printingIndividual ? 'Preparing print…' : 'Print Individual Report'}
        </button>
        <button
          onClick={handleDownloadIndividual}
          style={{
            ...styles.button,
            backgroundColor: '#28a745',
            opacity: downloadingIndividual ? 0.7 : 1,
            cursor: downloadingIndividual ? 'wait' : (!selectedStudent ? 'not-allowed' : 'pointer')
          }}
          disabled={!selectedStudent || downloadingIndividual}
        >
          {downloadingIndividual ? 'Downloading...' : '📥 Download Individual Report (PDF)'}
        </button>
        <button
          onClick={handleBatchPrint}
          title={
            selectedClass === 'All Classes'
              ? 'Pick a specific class above to enable batch printing'
              : `Print every student's report in ${selectedClass} in one go`
          }
          style={{
            ...styles.button,
            background: '#4169E1',
            opacity: (batchPrinting || selectedClass === 'All Classes' || batchStudents.length === 0) ? 0.6 : 1,
            cursor: batchPrinting
              ? 'wait'
              : (selectedClass === 'All Classes' || batchStudents.length === 0 ? 'not-allowed' : 'pointer')
          }}
          disabled={batchPrinting || selectedClass === 'All Classes' || batchStudents.length === 0}
        >
          {batchPreparing
            ? `Rendering ${batchStudents.length} reports…`
            : batchPrinting
              ? `Capturing ${batchStudents.length} reports…`
              : `🖨️ Batch Print All Reports${selectedClass !== 'All Classes' ? ` — ${selectedClass} (${batchStudents.length})` : ''}`}
        </button>
      </div>
      {batchPrinting && (
        <div className="no-print" style={{
          marginTop: '0.8em',
          padding: '0.7em 1em',
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          borderRadius: '8px',
          color: '#3730a3',
          fontSize: '0.95em'
        }}>
          {batchPreparing
            ? <>Rendering <strong>{batchStudents.length}</strong> student reports — this can take a few seconds for big classes…</>
            : <>Capturing reports — a print window will open automatically when ready.</>}
        </div>
      )}

      {/* ── Parent PIN Management ── */}
      {selectedStudent && (
        <div className="no-print" style={{ marginTop: '1.5em', padding: '1.2em 1.5em', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 0.8em 0', color: '#166534', fontWeight: '700', fontSize: '1rem' }}>🔑 Parent Result Slip</h4>
          <p style={{ margin: '0 0 0.8em 0', color: '#4b5563', fontSize: '0.9rem' }}>
            Generate a secure PIN so a parent can view this student's result slip without logging in.
          </p>
          {parentPin ? (
            <div>
              {/* PIN display + action buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ padding: '8px 14px', background: '#fff', border: '1px solid #86efac', borderRadius: '8px', fontFamily: 'monospace', fontWeight: '700', fontSize: '1.1rem', letterSpacing: '3px', color: '#166534' }}>
                  {parentPin.pin}
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/slip/${parentPin.pin}`;
                    navigator.clipboard.writeText(url).then(() => { setPinCopied(true); setTimeout(() => setPinCopied(false), 2000); });
                  }}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #4f8cff', background: '#4f8cff', color: '#fff', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  {pinCopied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <button
                  disabled={pinLoading}
                  onClick={async () => {
                    setPinLoading(true);
                    try { await revokeParentPin(parentPin.pin); setParentPin(null); setShareContact(''); }
                    catch (e) { alert('Could not revoke PIN. Please try again.'); }
                    finally { setPinLoading(false); }
                  }}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #ef4444', background: '#ef4444', color: '#fff', fontWeight: '600', fontSize: '0.875rem', cursor: pinLoading ? 'wait' : 'pointer', opacity: pinLoading ? 0.6 : 1 }}
                >
                  🗑 Revoke PIN
                </button>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Expires: {parentPin.expiresAt ? new Date(parentPin.expiresAt).toLocaleDateString() : 'Never'}
                </span>
              </div>

              {/* Share panel */}
              <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Send Result Slip Link
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Parent email or phone (e.g. +254712345678)"
                    value={shareContact}
                    onChange={(e) => setShareContact(e.target.value)}
                    style={{ flex: '1', minWidth: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', outline: 'none' }}
                  />
                  {/* Email button — opens default email client */}
                  <button
                    disabled={!shareContact.trim()}
                    onClick={() => {
                      const url = `${window.location.origin}/slip/${parentPin.pin}`;
                      const studentName = selectedStudent?.name || 'your child';
                      const subject = encodeURIComponent(`Spring Valley Baptist School — Result Slip for ${studentName}`);
                      const body = encodeURIComponent(
                        `Dear Parent/Guardian,\n\nPlease find below the result slip for ${studentName}.\n\nResult Slip Link:\n${url}\n\nThis link is unique and secure. Please do not share it with others.\n\nRegards,\nSpring Valley Baptist School`
                      );
                      window.open(`mailto:${encodeURIComponent(shareContact.trim())}?subject=${subject}&body=${body}`);
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: shareContact.trim() ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#e5e7eb', color: shareContact.trim() ? '#fff' : '#9ca3af', fontWeight: '600', fontSize: '0.875rem', cursor: shareContact.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                  >
                    📧 Email
                  </button>
                  {/* WhatsApp button */}
                  <button
                    disabled={!shareContact.trim()}
                    onClick={() => {
                      const url = `${window.location.origin}/slip/${parentPin.pin}`;
                      const studentName = selectedStudent?.name || 'your child';
                      const phone = shareContact.trim().replace(/[\s\-()]/g, '');
                      const msg = encodeURIComponent(
                        `Hello! Here is the result slip for *${studentName}* from Spring Valley Baptist School:\n\n${url}\n\nThis link is secure and unique to your child.`
                      );
                      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: shareContact.trim() ? '#25d366' : '#e5e7eb', color: shareContact.trim() ? '#fff' : '#9ca3af', fontWeight: '600', fontSize: '0.875rem', cursor: shareContact.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                  >
                    💬 WhatsApp
                  </button>
                  {/* SMS fallback */}
                  <button
                    disabled={!shareContact.trim()}
                    onClick={() => {
                      const url = `${window.location.origin}/slip/${parentPin.pin}`;
                      const studentName = selectedStudent?.name || 'your child';
                      const phone = shareContact.trim().replace(/[\s\-()]/g, '');
                      const msg = encodeURIComponent(`Spring Valley Baptist School result slip for ${studentName}: ${url}`);
                      window.open(`sms:${phone}?body=${msg}`);
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: shareContact.trim() ? '#6d28d9' : '#e5e7eb', color: shareContact.trim() ? '#fff' : '#9ca3af', fontWeight: '600', fontSize: '0.875rem', cursor: shareContact.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                  >
                    📱 SMS
                  </button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Email opens your mail client · WhatsApp/SMS open on your device · no data is sent by the server
                </p>
              </div>
            </div>
          ) : (
            <button
              disabled={pinLoading || !selectedStudent}
              onClick={async () => {
                const rec = (Array.isArray(allStudents) ? allStudents : []).find(
                  s => (s.studentRecordId || `${(s.name||'').toLowerCase()}|${(s.class||'').toLowerCase()}`) === selectedStudentId
                );
                const sid = rec?.studentRecordId;
                if (!sid) { alert('Could not identify student record ID.'); return; }
                setPinLoading(true);
                try {
                  const p = await generateParentPin({ studentRecordId: sid, academicYear: selectedYear, term: individualTerm, examType: individualExamType });
                  setParentPin(p);
                } catch (e) { alert('Could not generate PIN. Please try again.'); }
                finally { setPinLoading(false); }
              }}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#166534,#16a34a)', color: '#fff', fontWeight: '700', fontSize: '0.875rem', cursor: pinLoading ? 'wait' : 'pointer', opacity: pinLoading ? 0.6 : 1 }}
            >
              {pinLoading ? 'Generating…' : '🔑 Generate Parent PIN'}
            </button>
          )}
        </div>
      )}

      {/* Hidden batch container — only mounted while batch printing.
          @media print rules above hide everything else and reveal this. */}
      {batchPrinting && (
        <div
          className="batch-print-container"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: '1100px',
            background: '#ffffff',
            zIndex: -1,
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        >
          {batchStudents.map((s, i) => (
            <div
              key={s.studentRecordId || `${s.name}-${i}`}
              className="batch-print-page"
              style={{ background: '#fff', padding: '1em' }}
            >
              <IndividualReport student={s} classData={batchStudents} />
            </div>
          ))}
        </div>
      )}
      </div>

      <div>
        <h2 style={modernStyles.sectionHeader}>📊 Class Marklist</h2>

        {/* Filters */}
        <div className="no-print" style={{ display: 'flex', gap: '1em', alignItems: 'center', marginBottom: '1em', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="marklistClassFilter" style={{ marginRight: '0.5em' }}>
              Select Class for Marklist:
            </label>
            <select
              id="marklistClassFilter"
              value={marklistClass}
              onChange={(e) => setMarklistClass(e.target.value)}
              style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {availableClasses.map(className => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="marklistTermFilter" style={{ marginRight: '0.5em' }}>Term:</label>
            <select
              id="marklistTermFilter"
              value={marklistTerm}
              onChange={(e) => setMarklistTerm(e.target.value)}
              style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {ALL_TERMS.map(t => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>

          <div>
            <label htmlFor="marklistExamFilter" style={{ marginRight: '0.5em' }}>Exam:</label>
            <select
              id="marklistExamFilter"
              value={marklistExamType}
              onChange={(e) => setMarklistExamType(e.target.value)}
              style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {ALL_EXAM_TYPES.map(t => (<option key={t} value={t}>{examTypeLabel(t)}</option>))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            Showing {marklistStudents.length} student{marklistStudents.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div ref={classRef} style={styles.report} className="print-container">
          <ClassMarklist
            students={marklistStudents.filter(Boolean)}
            selectedClass={marklistClass !== 'All Classes' ? marklistClass : null}
            selectedTerm={marklistTerm}
            selectedExamType={marklistExamType}
            selectedAcademicYear={selectedYear}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrintClass}
            style={{
              ...styles.button,
              opacity: (marklistStudents.length === 0 || printingClass) ? 0.6 : 1,
              cursor: (marklistStudents.length === 0 || printingClass) ? 'not-allowed' : 'pointer'
            }}
            disabled={marklistStudents.length === 0 || printingClass}
          >
            {printingClass ? 'Preparing print…' : 'Print Class Marklist'}
          </button>
          <button
            onClick={handleDownloadClass}
            style={{
              ...styles.button,
              backgroundColor: '#28a745',
              opacity: downloadingClass ? 0.7 : 1,
              cursor: downloadingClass ? 'wait' : (marklistStudents.length === 0 ? 'not-allowed' : 'pointer')
            }}
            disabled={marklistStudents.length === 0 || downloadingClass}
          >
            {downloadingClass ? 'Downloading...' : '📥 Download Class Marklist (PDF)'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Reports;