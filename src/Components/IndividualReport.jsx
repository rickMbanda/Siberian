import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  getSubjectsByClass,
  getSubjectDisplayName,
  getRubric,
} from "../Utils/subjectsByClass";
import "./individualReportPrint.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const getSubjectRemark = (rubric) => {
  const remarks = {
    "Exceeds Expectations (E.E)": "Excellent",
    "Meets Expectations (M.E)": "Outstanding",
    "Approaching Expectations (A.E)": "You can do better",
    "Below Expectations (B.E)": "Needs improved study habits",
  };

  if (rubric === "E.E" || rubric === "Exceeds Expectations (E.E)") {
    return remarks["Exceeds Expectations (E.E)"];
  }
  if (rubric === "M.E" || rubric === "Meets Expectations (M.E)") {
    return remarks["Meets Expectations (M.E)"];
  }
  if (rubric === "A.E" || rubric === "Approaching Expectations (A.E)") {
    return remarks["Approaching Expectations (A.E)"];
  }
  if (rubric === "B.E" || rubric === "Below Expectations (B.E)") {
    return remarks["Below Expectations (B.E)"];
  }

  return remarks[rubric] || remarks["Below Expectations (B.E)"];
};

const getOverallRemark = (rubric) => {
  const remarks = {
    "Exceeds Expectations (E.E)":
      "An exemplary learner; continues to set the bar for others.",
    "Meets Expectations (M.E)":
      "Has a good grasp of concepts and shows steady improvement.",
    "Approaching Expectations (A.E)":
      "Beginning to understand core ideas; would benefit from targeted support.",
    "Below Expectations (B.E)":
      "Can do better with increased effort and a structured learning plan.",
  };
  return remarks[rubric] || remarks["Below Expectations (B.E)"];
};

    

const getTrendAnalysis = (currentStudent, historicalData) => {
  if (!historicalData || historicalData.length === 0) {
    return null;
  }

  const currentMean = currentStudent.mean;
  const previousMean = historicalData[historicalData.length - 1]?.mean;

  if (!previousMean || !currentMean) return null;

  const improvement = currentMean - previousMean;
  const percentageChange = ((improvement / previousMean) * 100).toFixed(1);

  let trend = "";
  let trendIcon = "";
  let trendColor = "";

  if (improvement > 5) {
    trend = "Significant Improvement";
    trendIcon = "📈";
    trendColor = "#10b981";
  } else if (improvement > 0) {
    trend = "Slight Improvement";
    trendIcon = "📊";
    trendColor = "#059669";
  } else if (improvement > -5) {
    trend = "Stable Performance";
    trendIcon = "📉";
    trendColor = "#f59e0b";
  } else {
    trend = "Needs Attention";
    trendIcon = "⚠️";
    trendColor = "#ef4444";
  }

  return {
    trend,
    trendIcon,
    trendColor,
    improvement: improvement.toFixed(1),
    percentageChange,
  };
};

const getPerformanceDeviation = (studentMean, classMean) => {
  if (!studentMean || !classMean) return null;

  const deviation = studentMean - classMean;
  const deviationType = deviation >= 0 ? "above" : "below";

  return {
    value: Math.abs(deviation).toFixed(1),
    type: deviationType,
    color: deviation >= 0 ? "#10b981" : "#ef4444",
  };
};

// Filter out specific students from both display and class statistics
const studentsToAlwaysExclude = ['Jonas Mbithi', 'Agnes Wanjiru', 'Angela Siri'];

const IndividualReport = ({ student, classData, historicalData = [] }) => {
  // Filter class data to exclude specified students for statistics calculations
  const filteredClassData = useMemo(() => {
    return classData ? classData.filter(s => {
      if (studentsToAlwaysExclude.includes(s.name)) {
        return false;
      }
      // For Ian Osano, only exclude if in Grade 1
      if (s.name === 'Ian Osano' && s.class === 'Grade 1') {
        return false;
      }
      return true;
    }) : [];
  }, [classData]);

  const subjects = getSubjectsByClass(student.class);

  const subjectMarks = {};
  let totalMarks = 0;
  subjects.forEach((subject) => {
    subjectMarks[subject] = student[subject];
    const score = parseFloat(student[subject]);
    if (!isNaN(score)) {
      totalMarks += score;
    }
  });

  const classStats = useMemo(() => {
    if (!filteredClassData || filteredClassData.length === 0) return null;

    const validMeans = filteredClassData
      .map((s) => s.mean)
      .filter((mean) => typeof mean === "number" && !isNaN(mean));

    if (validMeans.length === 0) return null;

    const sum = validMeans.reduce((a, b) => a + b, 0);
    const average = sum / validMeans.length;
    const highest = Math.max(...validMeans);
    const lowest = Math.min(...validMeans);

    const subjectAverages = {};
    subjects.forEach((subject) => {
      const subjectScores = filteredClassData
        .map((s) => parseFloat(s[subject]))
        .filter((score) => !isNaN(score));

      subjectAverages[subject] =
        subjectScores.length > 0
          ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length
          : 0;
    });

    return { average, highest, lowest, subjectAverages };
  }, [filteredClassData, subjects]);

  const chartData = useMemo(() => {
    if (!classStats || !classStats.subjectAverages) return null;

    const studentScores = subjects.map(
      (subject) => parseFloat(student[subject]) || 0,
    );
    const classAverages = subjects.map(
      (subject) => classStats.subjectAverages[subject] || 0,
    );
    const subjectLabels = subjects.map((subject) =>
      getSubjectDisplayName(subject),
    );

    return {
      labels: subjectLabels,
      datasets: [
        {
          label: `${student.name} (Individual)`,
          data: studentScores,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          borderColor: "rgba(0, 0, 0, 1)",
          borderWidth: 3,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Class Average",
          data: classAverages,
          backgroundColor: "rgba(128, 128, 128, 0.8)",
          borderColor: "rgba(128, 128, 128, 1)",
          borderWidth: 3,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [student, classStats, subjects]);

  // Don't render report if current student is in exclusion list
  if (studentsToAlwaysExclude.includes(student.name)) {
    return null;
  }

  // For Ian Osano, only exclude if in Grade 1
  if (student.name === 'Ian Osano' && student.class === 'Grade 1') {
    return null;
  }

  // Class teacher mapping
  const classTeachers = {
    Playgroup: "Tr Fridah",
    PP1: "Tr Jane",
    PP2: "Tr Clarice",
    "Grade 1": "Tr Margaret",
    "Grade 2": "Tr Emily",
    "Grade 3": "Tr Angel",
    "Grade 4": "Tr Monica",
    "Grade 5": "Tr Erick",
    "Grade 6": "Tr Njeri",
    "Grade 7": "Tr David",
    "Grade 8": "Tr Ndichu",
    "Grade 9": "Tr Clinton",
  };

  const classTeacher = classTeachers[student.class] || "Not Assigned";

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(99, 102, 241, 0.5)",
        borderWidth: 1,
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Marks",
          font: {
            size: 11,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 10,
          },
        },
      },
      x: {
        title: {
          display: false,
        },
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 30,
          font: {
            size: 11,
            weight: 'bold',
          },
          color: '#374151',
          padding: 5,
        },
      },
    },
  };

  // Calculate student position
  const totalStudents = filteredClassData ? filteredClassData.length : 0;
  const studentPosition = student.position || null;
  const positionText = (() => {
    if (!studentPosition) return "-";
    
    if (studentPosition === 'ABS') return "Absent from exam";
    if (studentPosition === 'N/A') return "Incomplete exam";
    
    // For numeric positions, show traditional format
    return `Position ${studentPosition} out of ${totalStudents}`;
  })();

  // Get trend analysis
  const trendAnalysis = getTrendAnalysis(student, historicalData);

  // Get performance deviation
  const deviation = getPerformanceDeviation(student.mean, classStats?.average);

  const examType = student.examType;
  const displayExamType =
    examType === "opener"
      ? "Opener"
      : examType === "midterm"
        ? "Midterm"
        : examType === "endterm"
          ? "Endterm"
          : examType;

  const overallRubric = student.rubric || getRubric(student.mean);

  const shouldShowTrend = !(
    student.examType === "opener" && student.term === "Term 1"
  );
  const shouldShowDeviation = !(
    student.examType === "opener" && student.term === "Term 1"
  );

  const styles = {
    container: {
      fontFamily: "Arial, sans-serif",
      maxWidth: "800px",
      margin: "0 auto",
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      fontSize: "12px",
      lineHeight: "1.3",
    },
    letterheadContainer: {
      textAlign: "center",
      marginBottom: "20px",
    },
    letterheadImage: {
      width: "100%",
      maxWidth: "600px",
      height: "auto",
    },
    titleSection: {
      textAlign: "center",
      marginBottom: "20px",
    },
    reportTitle: {
      color: "#2c3e50",
      fontSize: "20px",
      fontWeight: "bold",
      marginBottom: "8px",
    },
    subtitle: {
      color: "#777",
      fontSize: "16px",
    },
    topSection: {
      display: "flex",
      gap: "15px",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    studentInfoCompact: {
      flex: "0 0 280px",
      padding: "20px",
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      border: "2px solid #2c3e50",
      fontSize: "13px",
    },
    chartContainer: {
      flex: "1",
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e9ecef",
      minHeight: "250px",
    },
    chartTitle: {
      color: "#2c3e50",
      fontSize: "16px",
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: "15px",
      borderBottom: "2px solid #3498db",
      paddingBottom: "8px",
    },
    chartWrapper: {
      height: "180px",
      marginBottom: "10px",
    },
    chartLegend: {
      fontSize: "11px",
      color: "#666",
      textAlign: "center",
      fontStyle: "italic",
      marginTop: "5px",
    },
    infoRow: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "8px",
    },
    label: {
      fontWeight: "500",
      color: "#6b7280",
      fontSize: "13px",
    },
    value: {
      color: "#1a1a1a",
      fontWeight: "900",
      fontSize: "15px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    },
    tableHeader: {
      backgroundColor: "#2c3e50",
      color: "#fff",
      fontWeight: "900",
      padding: "12px",
      textAlign: "left",
      borderBottom: "3px solid #1a252f",
      fontSize: "14px",
    },
    tableCell: {
      padding: "10px",
      borderBottom: "2px solid #2c3e50",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontSize: "13px",
      fontWeight: "600",
      color: "#1a1a1a",
    },
    tableRowEven: {
      backgroundColor: "#f8f9fa",
    },
    tableRowOdd: {
      backgroundColor: "#fff",
    },
    trendSection: {
      padding: "10px",
      background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
      borderRadius: "8px",
      marginBottom: "15px",
      border: "1px solid #2196f3",
    },
    remarksSection: {
      padding: "15px",
      backgroundColor: "#fff3cd",
      borderRadius: "6px",
      border: "1px solid #ffeaa7",
    },
    overallRemark: {
      fontSize: "16px",
      lineHeight: "1.5",
      color: "#495057",
    },
    teacherSection: {
      marginTop: "20px",
      padding: "15px",
      backgroundColor: "#f0f8ff",
      borderRadius: "8px",
      border: "1px solid #b3d9ff",
    },
    textarea: {
      width: "100%",
      minHeight: "80px",
      padding: "10px",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "14px",
      resize: "vertical",
    },
    principalSection: {
      marginTop: "20px",
      padding: "15px",
      backgroundColor: "#fff5f5",
      borderRadius: "8px",
      border: "1px solid #fecaca",
      textAlign: "center",
    },
    stampBox: {
      width: "150px",
      height: "80px",
      border: "2px dashed #ef4444",
      margin: "10px auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      backgroundColor: "transparent",
    },
  };

  return (
    <div style={styles.container} className="print-container report-card">
      <div style={styles.letterheadContainer} className="report-letterhead">
        <img
          src="Letterhead.png"
          alt="School Letterhead"
          style={styles.letterheadImage}
          className="report-letterhead-img"
        />
      </div>

      <div style={styles.titleSection} className="report-title-section">
        <h2 style={styles.reportTitle} className="report-title">INDIVIDUAL ACADEMIC REPORT</h2>
        <p style={styles.subtitle} className="report-subtitle">
          {student.term} - {displayExamType} Examination
          {student.academicYear ? ` · Academic Year ${student.academicYear}` : ''}
        </p>
      </div>

      <div style={styles.topSection} className="report-top-section">
        <div style={styles.studentInfoCompact} className="report-info-card">
          <div style={styles.infoRow}>
            <span style={styles.label}>Student Name:</span>
            <span style={styles.value}>{student.name}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Class:</span>
            <span style={styles.value}>{student.class}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Term:</span>
            <span style={styles.value}>{student.term}</span>
          </div>
          {student.class !== 'Playgroup' && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Position:</span>
              <span style={styles.value}>{positionText}</span>
            </div>
          )}
          <div style={styles.infoRow}>
            <span style={styles.label}>Total Marks:</span>
            <span style={styles.value}>{totalMarks.toFixed(0)}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Overall Mean:</span>
            <span style={styles.value}>
              {typeof student.mean === "number" ? student.mean.toFixed(1) : "-"}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Overall Rubric:</span>
            <span style={styles.value}>{overallRubric}</span>
          </div>
          {shouldShowDeviation && deviation && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Deviation:</span>
              <span style={{ ...styles.value, color: deviation.color }}>
                {deviation.value} points {deviation.type} class average
              </span>
            </div>
          )}
        </div>

        {chartData && (
          <div style={styles.chartContainer} className="report-chart">
            <h3 style={styles.chartTitle} className="report-chart-title">📊 Performance vs Class Average</h3>
            <div style={styles.chartWrapper} className="report-chart-wrapper">
              <Bar data={chartData} options={chartOptions} />
            </div>
            <div style={styles.chartLegend} className="report-chart-legend">
              Individual vs Class Average Comparison
            </div>
          </div>
        )}
      </div>

      {shouldShowTrend && trendAnalysis && (
        <div style={styles.trendSection} className="report-trend">
          <h3
            style={{
              color: "#1565c0",
              marginBottom: "15px",
              fontSize: "18px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            📈 Performance Trend Analysis
          </h3>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            gap: "15px",
            marginBottom: "12px",
          }}>
            <span
              style={{
                fontSize: "32px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {trendAnalysis.trendIcon}
            </span>
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: trendAnalysis.trendColor,
                  marginBottom: "4px",
                }}
              >
                {trendAnalysis.trend}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#555",
                  fontWeight: "600",
                }}
              >
                {trendAnalysis.improvement > 0 ? "+" : ""}{trendAnalysis.improvement} points 
                ({trendAnalysis.percentageChange}% {trendAnalysis.improvement >= 0 ? "improvement" : "decline"})
              </div>
            </div>
          </div>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid rgba(33, 150, 243, 0.3)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
              Compared to previous assessment period
            </span>
          </div>
        </div>
      )}

      <h3 className="report-subjects-heading" style={{ color: "#2c3e50", marginBottom: "15px", fontSize: "18px" }}>
        Subject Performance
      </h3>

      <table style={styles.table} className="report-subjects-table">
        <thead>
          <tr>
            <th style={styles.tableHeader}>Subject</th>
            <th style={styles.tableHeader}>Marks</th>
            <th style={styles.tableHeader}>Rubric</th>
            <th style={styles.tableHeader}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject, index) => {
            const score = subjectMarks[subject];
            const subjectRubric =
              typeof score === "number" ? getRubric(score) : "-";
            const remark =
              typeof score === "number" ? getSubjectRemark(subjectRubric) : "-";

            return (
              <tr
                key={subject}
                style={
                  index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                }
              >
                <td style={styles.tableCell}>
                  <strong>{getSubjectDisplayName(subject)}</strong>
                </td>
                <td style={styles.tableCell}>
                  {typeof score === "number" ? score.toFixed(1) : "-"}
                </td>
                <td style={styles.tableCell}>{subjectRubric}</td>
                <td style={styles.tableCell}>{remark}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        className="report-summary"
        style={{
          ...styles.remarksSection,
          background: "#ffffff",
          color: "#000000",
          border: "3px solid #000000",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          padding: "15px",
          marginBottom: "15px",
        }}
      >
        <h3
          style={{
            color: "#000000",
            marginBottom: "12px",
            fontSize: "18px",
            textAlign: "center",
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          🎯 Overall Performance Summary
        </h3>
        <div
          style={{
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              fontWeight: "900",
              color: "#000000",
            }}
          >
            Student's Overall Rubric:
          </span>
          <span
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              background: "#000000",
              color: "#ffffff",
              fontWeight: "900",
              fontSize: "16px",
              marginLeft: "10px",
              border: "2px solid #000000",
            }}
          >
            {overallRubric}
          </span>
        </div>
        <div
          style={{
            background: "#f5f5f5",
            padding: "12px",
            borderRadius: "8px",
            border: "2px solid #000000",
          }}
        >
          <p
            style={{
              ...styles.overallRemark,
              color: "#000000",
              fontSize: "14px",
              lineHeight: "1.5",
              textAlign: "center",
              margin: "0",
              fontWeight: "600",
            }}
          >
            <strong>Performance Remarks: </strong> 
            {getOverallRemark(overallRubric)}
          </p>
        </div>
      </div>

      {/* Class Teacher's Comments - Blank for manual writing */}
      <div
        className="report-teacher"
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          minHeight: "80px",
        }}
      >
        <h3
          className="report-teacher-title"
          style={{ color: "#1565c0", marginBottom: "10px", fontSize: "14px" }}
        >
          📝 Class Teacher's Comments
        </h3>
        <div
          className="report-teacher-box"
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            minHeight: "50px",
            backgroundColor: "#fff",
            padding: "8px",
            fontSize: "13px",
          }}
        >
        </div>
      </div>

      {/* Principal's Stamp - Blank space for physical stamp */}
      <div
        className="report-stamp"
        style={{
          marginTop: "25px",
          padding: "20px",
          backgroundColor: "#fef2f2",
          borderRadius: "12px",
          border: "2px solid #fecaca",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3
            className="report-stamp-title"
            style={{ color: "#dc2626", marginBottom: "5px", fontSize: "16px" }}
          >
            🎯 Principal's Stamp
          </h3>
          <div
            className="report-stamp-box"
            style={{
              width: "220px",
              height: "120px",
              border: "2px dashed #ef4444",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
            }}
          >
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            className="report-teacher-name"
            style={{
              margin: "0",
              fontSize: "18px",
              color: "#1f2937",
              fontWeight: "900",
            }}
          >
            Class Teacher: {classTeacher}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IndividualReport;