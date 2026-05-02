

import React, { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { getSubjectsByClass, getSubjectDisplayName } from '../Utils/subjectsByClass';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StudentPerformanceChart = ({ students, selectedClass }) => {
  const [selectedId, setSelectedId] = useState(null);
  const selectedStudent = students.find(s => s.id === Number(selectedId));
  
  const subjects = getSubjectsByClass(selectedClass);

  const classAveragesBySubject = useMemo(() => {
    const averages = {};
    subjects.forEach(subject => {
      const validScores = students
        .map(s => parseFloat(s[subject]))
        .filter(score => !isNaN(score));
      averages[subject] = validScores.length > 0 
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
        : 0;
    });
    return averages;
  }, [students, subjects]);

  const chartData = useMemo(() => {
    if (!selectedStudent) return null;

    const studentScores = subjects.map(subject => parseFloat(selectedStudent[subject]) || 0);
    const classAverages = subjects.map(subject => classAveragesBySubject[subject]);
    const subjectLabels = subjects.map(subject => getSubjectDisplayName(subject));

    return {
      labels: subjectLabels,
      datasets: [
        {
          label: selectedStudent.name || `Student ${selectedStudent.id}`,
          data: studentScores,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 30,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
        {
          label: 'Class Average',
          data: classAverages,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 30,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        }
      ]
    };
  }, [selectedStudent, subjects, classAveragesBySubject]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top',
        labels: {
          font: {
            size: 14,
            weight: 'bold'
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'rect'
        }
      },
      title: { 
        display: true, 
        text: `Performance Comparison - ${selectedStudent?.name || 'Select Student'}`,
        font: {
          size: 18,
          weight: 'bold'
        },
        color: '#1f2937',
        padding: 20
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(99, 102, 241, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Marks (%)',
          font: {
            size: 14,
            weight: 'bold'
          },
          color: '#374151'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        ticks: {
          font: {
            size: 12
          },
          color: '#6b7280'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Subjects',
          font: {
            size: 14,
            weight: 'bold'
          },
          color: '#374151'
        },
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          font: {
            size: 11
          },
          color: '#6b7280'
        }
      }
    },
    elements: {
      bar: {
        borderWidth: 2,
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div className="student-performance-chart" style={{ marginTop: '2em' }}>
      <label htmlFor="studentSelect" style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#374151' }}>
        Select Student for Performance Comparison: 
      </label>
      <select
        id="studentSelect"
        value={selectedId || ""}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{
          padding: '0.75em 1em',
          borderRadius: 10,
          border: '2px solid #6366f1',
          fontSize: '1em',
          color: '#6366f1',
          fontWeight: 600,
          background: '#fff',
          marginLeft: '0.5em',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
        }}
      >
        <option value="" disabled>Select a student</option>
        {students.map(student => (
          <option key={student.id} value={student.id}>
            {student.name || `Student ${student.id}`}
          </option>
        ))}
      </select>
      {selectedStudent && chartData && (
        <div style={{ 
          marginTop: '1.5em', 
          backgroundColor: '#ffffff', 
          padding: '2em', 
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          height: '500px'
        }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
};

export default StudentPerformanceChart;