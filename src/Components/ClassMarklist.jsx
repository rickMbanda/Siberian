import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { getSubjectsByClass, getSubjectDisplayName } from '../Utils/subjectsByClass';

// Add print styles for ClassMarklist
// Print styles will be injected dynamically from the parent component

const ClassMarklist = ({ students, selectedClass, selectedTerm, selectedExamType, selectedAcademicYear }) => {
  // Get subjects based on the selected class or first student's class
  const currentClass = selectedClass || (students.length > 0 ? students[0].class : 'Grade 1');
  const subjects = getSubjectsByClass(currentClass);

  // Calculate total marks for each student and sort by total marks (descending)
  const sortedStudents = useMemo(() => {
    return [...students]
      .filter(student => {
        // Filter out specific students - Angela Siri should never appear
        const namesToExclude = ['Angela Siri', 'Agnes Wanjiru', 'Jonas Mbithi'];
        if (namesToExclude.includes(student.name)) {
          return false;
        }
        // For Ian Osano, only exclude if in Grade 1
        if (student.name === 'Ian Osano' && student.class === 'Grade 1') {
          return false;
        }
        return true;
      })
      .map((student, index) => {                     
        // Calculate total marks by summing all subject scores
        const totalMarks = subjects.reduce((sum, subject) => {
          const score = parseFloat(student[subject]);
          return sum + (isNaN(score) ? 0 : score);
        }, 0);

        return {
          ...student,
          totalMarks
        };
      })
      .sort((a, b) => {
        return b.totalMarks - a.totalMarks;
      })
      .map((student, index) => ({
        ...student,
        // Preserve position from Reports.jsx calculation which handles exam status
        position: student.position !== undefined ? student.position : index + 1
      }));
  }, [students, subjects]);

  // Calculate class statistics
  const classStats = useMemo(() => {
    if (sortedStudents.length === 0) return null;

    // Calculate overall class mean from student means
    const validMeans = sortedStudents
      .map(s => parseFloat(s.mean))
      .filter(mean => !isNaN(mean));
    
    const classOverallMean = validMeans.length > 0 
      ? validMeans.reduce((sum, mean) => sum + mean, 0) / validMeans.length 
      : 0;

    // Calculate subject averages
    const subjectAverages = {};
    subjects.forEach(subject => {
      const subjectScores = sortedStudents
        .map(s => parseFloat(s[subject]))
        .filter(score => !isNaN(score));
      
      subjectAverages[subject] = subjectScores.length > 0 
        ? subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length 
        : 0;
    });

    // Calculate exam status counts
    const examStatusCounts = {
      sat: sortedStudents.filter(s => s.examStatus === 'sat' || !s.examStatus).length,
      absent: sortedStudents.filter(s => s.examStatus === 'absent').length,
      incomplete: sortedStudents.filter(s => s.examStatus === 'incomplete').length
    };

    return {
      classOverallMean,
      subjectAverages,
      totalStudents: sortedStudents.length,
      highestMean: validMeans.length > 0 ? Math.max(...validMeans) : 0,
      lowestMean: validMeans.length > 0 ? Math.min(...validMeans) : 0,
      examStatusCounts
    };
  }, [sortedStudents, subjects]);


  const displayTerm = selectedTerm || (students.length > 0 ? students[0].term : 'Term 1');
  const examType = selectedExamType || (students.length > 0 ? students[0].examType : '');
  const displayExamType = examType === 'opener' ? 'Opener' : 
                         examType === 'midterm' ? 'Midterm' : 
                         examType === 'endterm' ? 'Endterm' : examType;
  const displayYear = selectedAcademicYear || (students.length > 0 ? students[0].academicYear : '');

  const styles = {
    container: {
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      maxWidth: 'none',
      width: '100%',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#fff',
      borderRadius: '20px',
      boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
      position: 'relative',
      overflow: 'visible',
      border: '1px solid #e2e8f0',
      minHeight: 'auto',
      height: 'auto',
      pageBreakInside: 'avoid'
    },
    backgroundDecoration: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: '300px',
      height: '300px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
      borderRadius: '50%',
      transform: 'translate(100px, -100px)',
      zIndex: 0
    },
    letterheadContainer: {
      textAlign: 'center',
      marginBottom: '30px',
      position: 'relative',
      zIndex: 1
    },
    letterheadImage: {
      width: '100%',
      maxWidth: '700px',
      height: 'auto',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
    },
    titleSection: {
      textAlign: 'center',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 1,
      padding: '15px 0',
      background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #1e3a8a 100%)',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(30, 64, 175, 0.25)',
      border: '2px solid #3730a3'
    },
    reportTitle: {
      color: '#ffffff',
      fontSize: '1.2rem',
      fontWeight: '800',
      marginBottom: '8px',
      fontFamily: '"Inter", sans-serif',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
    },
    subtitle: {
      color: '#e2e8f0',
      fontSize: '14px',
      marginBottom: '4px',
      fontWeight: '500',
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    },
    title: {
      color: '#2c3e50',
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '25px',
      textAlign: 'center',
      borderBottom: '2px solid #ecf0f1',
      paddingBottom: '15px'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '30px',
      backgroundColor: '#fff',
      borderRadius: '16px',
      overflow: 'visible', // Ensure table content is fully visible
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      fontSize: '12px', // Slightly smaller for Excel-like appearance
      position: 'relative',
      zIndex: 1,
      border: '2px solid #1e40af', // Excel-like border
      tableLayout: 'auto' // Let table adjust to content
    },
    tableHeader: {
      background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #1e3a8a 100%)',
      color: '#fff',
      fontWeight: '800',
      padding: '12px 8px', // More compact
      textAlign: 'center',
      fontSize: '11px', // Smaller font
      border: '1px solid #1e3a8a',
      position: 'sticky',
      top: '0',
      zIndex: '10',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      minWidth: '50px',
      maxWidth: '80px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    tableCell: {
      padding: '8px 6px', // More compact like Excel
      border: '1px solid #d1d5db', // Excel-like grid borders
      textAlign: 'center',
      fontSize: '11px', // Smaller font for more data
      color: '#334155',
      minWidth: '50px',
      maxWidth: '80px',
      fontWeight: '500',
      transition: 'background-color 0.2s ease',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    nameCell: {
      textAlign: 'left',
      fontWeight: '700',
      minWidth: '120px',
      maxWidth: '150px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '8px 6px', // Compact like Excel
      color: '#1e293b',
      border: '1px solid #d1d5db',
      fontSize: '11px'
    },
    tableRowEven: {
      backgroundColor: '#f8fafc',
      borderLeft: '4px solid transparent'
    },
    tableRowOdd: {
      backgroundColor: '#fff',
      borderLeft: '4px solid transparent'
    },
    tableRowHover: {
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    summarySection: {
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      padding: '15px',
      borderRadius: '12px',
      border: '2px solid #1e40af',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1,
      boxShadow: '0 4px 16px rgba(30, 64, 175, 0.15)'
    },
    summaryText: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#1e40af',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    tableWrapper: {
      overflowX: 'visible',
      overflowY: 'visible',
      maxHeight: 'none',
      overflow: 'visible',
      border: 'none',
      borderRadius: '16px',
      position: 'relative',
      zIndex: 1,
      width: '100%',
      pageBreakInside: 'auto'
    },
    
    subjectRankingsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px'
    },
    subjectRankingCard: {
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      border: '1px solid #e9ecef',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    },
    subjectRankingPosition: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#000000',
      marginBottom: '8px'
    },
    subjectRankingName: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#000000',
      marginBottom: '8px'
    },
    subjectRankingAverage: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#000000',
      backgroundColor: '#e8f5e8',
      padding: '8px 16px',
      borderRadius: '20px'
    }
  };

    return (
    <div style={{...styles.container, overflow: 'visible', height: 'auto'}} className="print-container">
      {/* Background Decoration */}
      <div style={styles.backgroundDecoration}></div>

      {/* Letterhead Header */}
      <div style={styles.letterheadContainer}>
        <img 
          src="Letterhead.png" 
          alt="School Letterhead" 
          style={styles.letterheadImage}
        />
      </div>

      {/* Report Title Section */}
      <div style={styles.titleSection}>
        <h2 style={styles.reportTitle}>CLASS MARKLIST</h2>
        <p style={styles.subtitle}>
          {displayTerm} - {displayExamType} Examination
          {displayYear ? ` · Academic Year ${displayYear}` : ''}
        </p>
        {selectedClass && <p style={styles.subtitle}>Class: {selectedClass}</p>}
      </div>

      {/* Table */}
      <div className="table-wrapper print-table-wrapper" style={styles.tableWrapper}>
        <table style={{...styles.table, pageBreakInside: 'auto', overflow: 'visible'}} className="print-optimized-table">
        <thead className="print-table-header">
          <tr>
            <th style={{...styles.tableHeader, minWidth: '50px'}}>Pos.</th>
            <th style={{...styles.tableHeader, minWidth: '120px', textAlign: 'left'}}>Student Name</th>
            {subjects.map(subject => (
              <th key={subject} style={{...styles.tableHeader, minWidth: '45px'}}>
                {getSubjectDisplayName(subject)}
              </th>
            ))}
            <th style={{...styles.tableHeader, minWidth: '50px'}}>Total</th>
            <th style={{...styles.tableHeader, minWidth: '45px'}}>Mean</th>
            <th style={{...styles.tableHeader, minWidth: '60px'}}>Grade</th>
          </tr>
        </thead>
        <tbody className="print-table-body">
          {sortedStudents.map((student, index) => (
            <tr 
              key={student.id || student._id || index}
              className="print-table-row"
              style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderLeft = '4px solid #1e40af';
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.transform = 'translateX(2px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(30, 64, 175, 0.15)';
                e.currentTarget.style.transition = 'all 0.2s ease';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderLeft = '4px solid transparent';
                e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f8fafc' : '#fff';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <td style={{...styles.tableCell, textAlign: 'center', fontWeight: 'bold'}}>{student.position}</td>
              <td style={{...styles.nameCell, fontSize: '12px', fontWeight: '600'}}>{student.name || '-'}</td>
              {subjects.map(subject => (
                <td key={subject} style={{...styles.tableCell, textAlign: 'center', fontWeight: '500'}}>
                  {student[subject] || '-'}
                </td>
              ))}
              <td style={{...styles.tableCell, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f0f9ff'}}>
                {student.totalMarks.toFixed(0)}
              </td>
              <td style={{...styles.tableCell, textAlign: 'center', fontWeight: '600'}}>
                {typeof student.mean === 'number' ? student.mean.toFixed(1) : '-'}
              </td>
              <td style={{...styles.tableCell, textAlign: 'center', fontWeight: 'bold', color: '#1e40af'}}>
                {student.rubric || '-'}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      <div style={styles.summarySection}>
        <div style={styles.summaryText}>
          Total Students: {sortedStudents.length}
        </div>
        {classStats && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            border: '1px solid #1e40af'
          }}>
            <h4 style={{
              color: '#000000',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              CLASS PERFORMANCE STATISTICS
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
              fontSize: '11px'
            }}>
              <div style={{
                background: '#f0f9ff',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Class Overall Mean</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#000000'}}>
                  {classStats.classOverallMean.toFixed(1)}%
                </div>
              </div>
              <div style={{
                background: '#f0f9ff',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Highest Mean</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#000000'}}>
                  {classStats.highestMean.toFixed(1)}%
                </div>
              </div>
              <div style={{
                background: '#f0f9ff',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Lowest Mean</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#000000'}}>
                  {classStats.lowestMean.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Exam Status Summary */}
        {classStats && classStats.examStatusCounts && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            border: '1px solid #059669'
          }}>
            <h4 style={{
              color: '#000000',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              EXAM PARTICIPATION STATUS
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '8px',
              fontSize: '11px'
            }}>
              <div style={{
                background: '#e8f5e8',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center',
                border: '1px solid #10b981'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Students Sat</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#059669'}}>
                  {classStats.examStatusCounts.sat}
                </div>
              </div>
              <div style={{
                background: '#fef3c7',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center',
                border: '1px solid #f59e0b'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Incomplete</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#d97706'}}>
                  {classStats.examStatusCounts.incomplete}
                </div>
              </div>
              <div style={{
                background: '#fee2e2',
                padding: '8px',
                borderRadius: '6px',
                textAlign: 'center',
                border: '1px solid #ef4444'
              }}>
                <strong style={{color: '#000000', fontSize: '10px'}}>Absent</strong>
                <div style={{fontSize: '14px', fontWeight: 'bold', color: '#dc2626'}}>
                  {classStats.examStatusCounts.absent}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subject Averages Section */}
      {classStats && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderRadius: '12px',
          border: '2px solid #1e40af',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 4px 16px rgba(30, 64, 175, 0.12)'
        }}>
          <h3 style={{
            color: '#000000',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '12px',
            textShadow: 'none'
          }}>
            SUBJECT AVERAGE PERFORMANCE
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px'
          }}>
            {subjects.map(subject => (
              <div key={subject} style={{
                backgroundColor: '#fff',
                padding: '8px',
                borderRadius: '6px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                textAlign: 'center',
                border: '1px solid #e9ecef'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: '#000000',
                  marginBottom: '4px'
                }}>
                  {getSubjectDisplayName(subject)}
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#000000',
                  backgroundColor: classStats.subjectAverages[subject] >= 65 ? '#e8f5e8' : 
                                  classStats.subjectAverages[subject] >= 50 ? '#fff3cd' : '#f8d7da',
                  padding: '4px 8px',
                  borderRadius: '8px'
                }}>
                  {classStats.subjectAverages[subject].toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject Rankings Table */}
      <div style={{
        marginTop: '15px',
        padding: '15px',
        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        borderRadius: '12px',
        border: '2px solid #1e40af',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 4px 16px rgba(30, 64, 175, 0.12)'
      }}>
        <h3 style={{
          color: '#000000',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '10px',
          textShadow: 'none'
        }}>Subject Rankings by Class Average</h3>
        <div style={styles.tableWrapper}>
          <table style={{...styles.table, fontSize: '10px'}}>
            <thead>
              <tr>
                <th style={{...styles.tableHeader, fontSize: '9px', padding: '6px 4px'}}>Subject Ranking</th>
                {(() => {
                  // Calculate averages and sort subjects by performance
                  const subjectAverages = subjects.map(subject => {
                    const subjectScores = sortedStudents
                      .map(student => parseFloat(student[subject]))
                      .filter(score => !isNaN(score));

                    const average = subjectScores.length > 0 
                      ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length
                      : 0;

                    return { subject, average };
                  }).sort((a, b) => b.average - a.average);

                  return subjectAverages.map((item, index) => (
                    <th key={item.subject} style={{...styles.tableHeader, fontSize: '8px', padding: '6px 4px'}}>
                      {index + 1}. {getSubjectDisplayName(item.subject)}
                    </th>
                  ));
                })()}
              </tr>
            </thead>
          </table>
        </div>
      </div>
    </div>
  );
};

ClassMarklist.propTypes = {
  students: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      mean: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      rubric: PropTypes.string,
      class: PropTypes.string,
      term: PropTypes.string,
    })
  ).isRequired,
  selectedClass: PropTypes.string,
  selectedTerm: PropTypes.string,
  selectedExamType: PropTypes.string,
  selectedAcademicYear: PropTypes.string,
};



export default ClassMarklist;