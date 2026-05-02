import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './examNavigationStyles.css';

const EXAM_OPTIONS = [
  { path: '/opener',  label: 'Opener'  },
  { path: '/midterm', label: 'Midterm' },
  { path: '/endterm', label: 'Endterm' }
];

const ExamNavigation = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const examMenuRef = useRef(null);

  const teacherAllowedExam = user?.allowedExamType || 'opener';
  const visibleOptions = isAdmin
    ? EXAM_OPTIONS
    : EXAM_OPTIONS.filter((o) => o.path === `/${teacherAllowedExam}`);
  const activeExam = EXAM_OPTIONS.find((o) => o.path === location.pathname);
  const activeVisibleExam = visibleOptions.find((o) => o.path === location.pathname) || visibleOptions[0];

  // Close the dropdown on route change
  useEffect(() => { setExamMenuOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!examMenuOpen) return;
    const handleClick = (e) => {
      if (examMenuRef.current && !examMenuRef.current.contains(e.target)) {
        setExamMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [examMenuOpen]);

  return (
    <nav className="exam-nav">
      <div className="nav-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 className="exam-nav-title">Exam Modules</h2>
          <span style={{
            fontSize: '0.75rem',
            background: isAdmin ? '#4169E1' : '#0891b2',
            color: '#fff',
            padding: '2px 10px',
            borderRadius: '20px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {isAdmin ? 'Admin' : 'Teacher'}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {user?.name}
          </span>
        </div>
        <div className="nav-buttons">
          {isAdmin && (
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button className={`nav-button ${location.pathname === '/' ? 'active' : ''}`}>
                Dashboard
              </button>
            </Link>
          )}
          <div className="exam-type-dropdown" ref={examMenuRef}>
            <button
              type="button"
              className={`exam-type-button ${activeExam ? 'active' : ''} ${examMenuOpen ? 'open' : ''}`}
              onClick={() => setExamMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={examMenuOpen}
            >
              <svg
                className="exam-type-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
                  fill="#fff"
                  stroke="#fff"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path d="M14 3v5h5" fill="none" stroke="#c7d2fe" strokeWidth="1.4" strokeLinejoin="round" />
                <path
                  d="M16.4 11.1l1.2 1.2-4.4 4.4-1.6.4.4-1.6 4.4-4.4z"
                  fill="#fb923c"
                  stroke="#9a3412"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="exam-type-label">
                {activeVisibleExam ? activeVisibleExam.label : 'Exam Type'}
              </span>
              <span className={`exam-type-chevron ${examMenuOpen ? 'open' : ''}`} aria-hidden="true">▼</span>
            </button>
            {examMenuOpen && (
              <div className="exam-type-menu" role="menu">
                {visibleOptions.map((opt) => (
                  <Link
                    key={opt.path}
                    to={opt.path}
                    role="menuitem"
                    className={`exam-type-menu-item ${location.pathname === opt.path ? 'active' : ''}`}
                    onClick={() => setExamMenuOpen(false)}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <>
              <Link to="/reports" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/reports' ? 'active' : ''}`}>
                  Reports
                </button>
              </Link>
              <Link to="/analytics" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/analytics' ? 'active' : ''}`}>
                  Analytics
                </button>
              </Link>
              <Link to="/students" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/students' ? 'active' : ''}`}>
                  Students
                </button>
              </Link>
              <Link to="/results-manager" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/results-manager' ? 'active' : ''}`}>
                  Results Manager
                </button>
              </Link>
              <Link to="/promotion" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/promotion' ? 'active' : ''}`}>
                  Promotion
                </button>
              </Link>
              <Link to="/targets" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/targets' ? 'active' : ''}`}>
                  Targets
                </button>
              </Link>
              <Link to="/users" style={{ textDecoration: 'none' }}>
                <button className={`nav-button ${location.pathname === '/users' ? 'active' : ''}`}>
                  Users
                </button>
              </Link>
            </>
          )}
          <Link to="/change-password" style={{ textDecoration: 'none' }}>
            <button className={`nav-button ${location.pathname === '/change-password' ? 'active' : ''}`}>
              My Password
            </button>
          </Link>
          <button
            className="nav-button logout-button"
            onClick={logout}
            style={{
              backgroundColor: '#ef4444',
              marginLeft: '20px',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default ExamNavigation;
