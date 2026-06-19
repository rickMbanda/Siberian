import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExamNavigation from '../Components/ExamNavigation';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assignedClass = user?.assignedClass || null;
  const isTeacherWithClass = user?.role === 'teacher' && !!assignedClass;

  const [selectedClass, setSelectedClass] = useState(assignedClass || 'Playgroup');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const classes = [
    'Playgroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 
    'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
  ];

  const terms = ['Term 1', 'Term 2', 'Term 3'];
  
  // Generate academic years (current year ± 5 years)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear - 2; year <= currentYear + 5; year++) {
    years.push(year.toString());
  }

  const styles = {
    container: {
      background: 'linear-gradient(135deg, #7ec8ff 0%, #56b0e2 100%)',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    },
    contentWrapper: {
      maxWidth: '1200px',
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
      color: '#0b3d91',
      margin: 0,
      letterSpacing: '-1px'
    },
    subtitle: {
      fontSize: '1.2rem',
      color: '#6b7280',
      fontWeight: '500',
      marginTop: '8px'
    },
    selectionSection: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '30px',
      marginBottom: '40px',
      padding: '30px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    },
    selectionGroup: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '15px'
    },
    label: {
      fontSize: '1.3rem',
      fontWeight: '700',
      color: '#1f2937'
    },
    dropdown: {
      padding: '15px 25px',
      fontSize: '1.1rem',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      background: '#ffffff',
      color: '#374151',
      cursor: 'pointer',
      minWidth: '200px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease'
    },
    examGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '24px',
      marginTop: '30px',
      justifyItems: 'center'
    },
    examButton: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      borderRadius: '20px',
      border: 'none',
      fontSize: 'clamp(1rem, 2vw, 1.2rem)',
      fontWeight: '700',
      cursor: 'pointer',
      textDecoration: 'none',
      color: '#ffffff',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '140px',
      width: '100%',
      maxWidth: '100%',
      aspectRatio: '1.5/1',
      transform: 'scale(1)',
      '@media (max-width: 768px)': {
        padding: '24px 16px',
        minHeight: '120px',
        fontSize: '1rem'
      }
    },
    openerButton: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    midtermButton: {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    },
    endtermButton: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    },
    buttonIcon: {
      fontSize: '3rem',
      marginBottom: '12px'
    },
    buttonText: {
      fontSize: '1.3rem',
      fontWeight: '700'
    },
    currentSelection: {
      textAlign: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #0b3d91 0%, #122b55 100%)',
      color: '#ffffff',
      borderRadius: '16px',
      marginBottom: '30px',
      boxShadow: '0 8px 32px rgba(11, 61, 145, 0.3)'
    }
  };

  return (
    <div style={styles.container}>
      <ExamNavigation />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
            <img 
              src="/logschool.png" 
              alt="School Logo" 
              style={{ 
                width: '80px', 
                height: 'auto', 
                maxHeight: '80px', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.2))'
              }}
            />
            <h1 style={styles.title}>Spring Valley Baptist School</h1>
          </div>
          <p style={{ ...styles.subtitle, fontStyle: 'italic', color: '#6366f1', fontWeight: '600', fontSize: '1.1rem' }}>
            "Godliness, Diligence and Discipline"
          </p>
          <p style={styles.subtitle}>Comprehensive student performance tracking</p>
        </div>

        <div style={styles.selectionSection}>
          <div style={styles.selectionGroup}>
            <label style={styles.label} htmlFor="yearSelect">Academic Year</label>
            <select
              id="yearSelect"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={styles.dropdown}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.selectionGroup}>
            <label style={styles.label} htmlFor="termSelect">Select Term</label>
            <select
              id="termSelect"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              style={styles.dropdown}
            >
              {terms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>

          <div style={styles.selectionGroup}>
            <label style={styles.label} htmlFor="classSelect">Select Class</label>
            <select
              id="classSelect"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                ...styles.dropdown,
                ...(isTeacherWithClass ? { background: '#f1f5f9', cursor: 'not-allowed' } : {})
              }}
              disabled={isTeacherWithClass}
            >
              {(isTeacherWithClass ? [assignedClass] : classes).map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.currentSelection}>
          <h3>Current Selection: {selectedYear} - {selectedTerm} - {selectedClass}</h3>
        </div>


        {/* Enter Marks section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ textAlign: 'center', color: '#0b3d91', fontWeight: '700', fontSize: '1.2rem', marginBottom: '16px' }}>
            Enter Marks
          </h3>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: '📝 Opener',   path: '/opener',  bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.3)' },
              { label: '📝 Midterm',  path: '/midterm', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.3)' },
              { label: '📝 Endterm',  path: '/endterm', bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', shadow: 'rgba(239,68,68,0.3)' },
            ].map(({ label, path, bg, shadow }) => (
              <button
                key={path}
                onClick={() => navigate(path, { state: { selectedClass, selectedTerm, selectedYear } })}
                style={{
                  padding: '16px 32px',
                  background: bg,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.05rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: `0 8px 32px ${shadow}`,
                  transition: 'all 0.3s ease',
                  minWidth: '160px',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ 
          textAlign: 'center', 
          marginTop: '40px',
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link 
            to="/reports" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 32px',
              background: '#4169E1',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              fontWeight: '600',
              boxShadow: '0 8px 32px rgba(65, 105, 225, 0.3)',
              transition: 'all 0.3s ease',
              minWidth: '180px',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05) translateY(-2px)';
              e.target.style.boxShadow = '0 12px 48px rgba(99, 102, 241, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1) translateY(0px)';
              e.target.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.3)';
            }}
          >
            📄 View Reports
          </Link>

          <Link 
            to="/students" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              fontWeight: '600',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
              transition: 'all 0.3s ease',
              minWidth: '180px',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05) translateY(-2px)';
              e.target.style.boxShadow = '0 12px 48px rgba(245, 158, 11, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1) translateY(0px)';
              e.target.style.boxShadow = '0 8px 32px rgba(245, 158, 11, 0.3)';
            }}
          >
            👥 Manage Students
          </Link>

          <Link 
            to="/results-manager" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              fontWeight: '600',
              boxShadow: '0 8px 32px rgba(20, 184, 166, 0.3)',
              transition: 'all 0.3s ease',
              minWidth: '180px',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05) translateY(-2px)';
              e.target.style.boxShadow = '0 12px 48px rgba(20, 184, 166, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1) translateY(0px)';
              e.target.style.boxShadow = '0 8px 32px rgba(20, 184, 166, 0.3)';
            }}
          >
            ⚙️ Manage Results
          </Link>

          <Link 
            to="/analytics" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              fontWeight: '600',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.3s ease',
              minWidth: '180px',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05) translateY(-2px)';
              e.target.style.boxShadow = '0 12px 48px rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1) translateY(0px)';
              e.target.style.boxShadow = '0 8px 32px rgba(139, 92, 246, 0.3)';
            }}
          >
            📊 Analytics
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;