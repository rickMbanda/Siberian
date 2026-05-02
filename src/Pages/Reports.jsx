import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import IndividualReport from '../Components/IndividualReport';
import ClassMarklist from '../Components/ClassMarklist';
import ExamNavigation from '../Components/ExamNavigation';
import { fetchResults } from '../api/results';
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
      // Enhanced print styles for complete document capture
      const style = document.createElement('style');
      style.innerHTML = `
        .no-print { display: none !important; }
        button { display: none !important; }
        nav { display: none !important; }
        .exam-nav { display: none !important; }

        /* Preserve in-app styling for PDF capture */
        .print-container {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          /* Preserve original container styling */
        }

        .print-container .table-wrapper {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          /* Preserve original table wrapper styling */
        }

        .print-container table {
          overflow: visible !important;
          height: auto !important;
          /* Preserve original table styling and layout */
        }

        .print-container th,
        .print-container td {
          overflow: visible !important;
          /* Preserve original cell styling */
        }

        .print-container th {
          /* Preserve original header styling */
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .print-container tbody tr {
          page-break-inside: avoid !important;
          page-break-after: auto !important;
        }

        /* Ensure letterhead scales properly */
        .print-container img {
          max-width: 100% !important;
          height: auto !important;
          page-break-inside: avoid !important;
        }

        /* Statistics sections */
        .print-container div[style*="grid"] {
          page-break-inside: avoid !important;
        }

        /* Preserve original colors and styling for PDF */
        .print-container h3,
        .print-container h4 {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* Preserve original text colors */
        .print-container * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* Allow content to be captured fully */
        .table-wrapper {
          overflow: visible !important;
          max-height: none !important;
        }
      `;
      document.head.appendChild(style);

      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture with optimized settings for large documents
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
        windowHeight: classRef.current.scrollHeight,
        ignoreElements: (element) => {
          return element.classList && (
            element.classList.contains('no-print') ||
            element.tagName === 'BUTTON' ||
            element.tagName === 'NAV'
          );
        }
      });

      // Remove the temporary style
      document.head.removeChild(style);

      // Always use landscape orientation for class marklist downloads
      const orientation = 'l'; // Force landscape for better table readability
      const pdf = new jsPDF(orientation, 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 7.62; // 0.3in margin (matches print preview @page margin)
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Calculate scaling to fit content properly with improved page splitting
      const imgWidth = availableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if content fits on one page
      if (imgHeight > availableHeight) {
        // Multi-page document - split content intelligently
        const pageHeight = availableHeight;
        const totalPages = Math.ceil(imgHeight / pageHeight);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage(orientation);

          // Calculate source coordinates for this page
          const sourceY = page * pageHeight * (canvas.height / imgHeight);
          const sourceHeight = Math.min(
            pageHeight * (canvas.height / imgHeight), 
            canvas.height - sourceY
          );

          // Create a canvas for each page
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');

          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;

          // Draw the portion of the original canvas for this page
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );

          // Calculate dimensions for this page
          const pageImgWidth = imgWidth;
          const pageImgHeight = (sourceHeight * imgWidth) / canvas.width;

          // Add image to PDF, positioned at margin
          pdf.addImage(
            pageCanvas.toDataURL('image/png'), 
            'PNG', 
            margin, 
            margin, 
            pageImgWidth, 
            pageImgHeight
          );
        }
      } else {
        // Single page - use full available width
        pdf.addImage(
          canvas.toDataURL('image/png'), 
          'PNG', 
          margin, 
          margin, 
          imgWidth, 
          imgHeight
        );
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
  }, [marklistStudents, marklistClass, printOrientation]);


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

  const handlePrintClass = useReactToPrint({
    contentRef: classRef,
    documentTitle: `Class_Marklist_${marklistClass !== 'All Classes' ? marklistClass : 'All'}`,
    removeAfterPrint: true,
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        // Remove any existing print styles
        const existingStyles = document.querySelectorAll('[data-print-styles-marklist]');
        existingStyles.forEach(style => style.remove());

        // Add new print styles with current orientation
        const printStyles = `
          @media print {
            body * { visibility: hidden; }
            .print-container, .print-container * { visibility: visible; }
            .print-container { 
              /* Preserve original container styling and layout */
            }
            .no-print { display: none !important; }
            button { display: none !important; }
            nav { display: none !important; }
            .exam-nav { display: none !important; }

            /* Allow table wrapper to print fully */
            .table-wrapper, .print-table-wrapper {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
              page-break-inside: auto !important;
            }
            
            table, .print-optimized-table { 
              page-break-inside: auto !important;
              /* Preserve original table styling and width */
            }
            
            tr, .print-table-row { 
              page-break-inside: avoid !important;
              page-break-after: auto !important;
              height: auto !important;
            }
            
            th, td {
              page-break-inside: avoid !important;
              /* Preserve original cell styling */
            }
            
            th, .print-table-header th {
              /* Preserve original header styling */
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            thead, .print-table-header {
              display: table-header-group !important;
            }
            
            tbody, .print-table-body {
              display: table-row-group !important;
            }
            
            tfoot {
              display: table-footer-group !important;
            }

            /* Statistics sections should stay together */
            div[style*="grid"] {
              page-break-inside: avoid !important;
            }

            /* Preserve original heading and text colors */
            .print-container h3,
            .print-container h4 {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            /* Ensure images scale properly */
            img {
              max-width: 100% !important;
              height: auto !important;
              page-break-inside: avoid !important;
            }

            /* Allow scrollable content to print fully */
            .table-wrapper {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
            }

            /* Preserve original colors and styling */
            .print-container * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            @page {
              size: ${printOrientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
              margin: 0.3in;
            }

            /* Repeat table headers on each page */
            @page :first {
              margin-top: 0.5in;
            }
          }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = printStyles;
        styleSheet.setAttribute('data-print-styles-marklist', 'true');
        document.head.appendChild(styleSheet);

        setTimeout(resolve, 100);
      });
    }
  });

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
            style={styles.button}
            disabled={marklistStudents.length === 0}
          >
            Print Class Marklist ({printOrientation})
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