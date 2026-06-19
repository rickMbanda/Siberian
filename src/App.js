import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './Components/Login';

import Dashboard from './Pages/Dashboard';
import OpenerExam from './Pages/OpenerExam';
import MidtermExam from './Pages/MidtermExam';
import EndTermExam from './Pages/EndTermExam';
import Reports from './Pages/Reports';
import ResultsManager from './Pages/ResultsManager';
import StudentManager from './Pages/StudentManager';
import UserManagement from './Pages/UserManagement';
import Analytics from './Pages/Analytics';
import Promotion from './Pages/Promotion';
import Targets from './Pages/Targets';
import ParentSlip from './Pages/ParentSlip';
import ChangePassword from './Pages/ChangePassword';

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #7ec8ff 0%, #56b0e2 100%)',
        color: '#fff',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <Routes>
      {/* Admin-only pages */}
      {isAdmin ? (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/results-manager" element={<ResultsManager />} />
          <Route path="/students" element={<StudentManager />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/promotion" element={<Promotion />} />
          <Route path="/targets" element={<Targets />} />
        </>
      ) : (
        <Route path="/" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
      )}

      {/* Shared pages - both admin and teacher */}
      <Route path="/opener" element={<OpenerExam />} />
      <Route path="/midterm" element={<MidtermExam />} />
      <Route path="/endterm" element={<EndTermExam />} />
      <Route path="/change-password" element={<ChangePassword />} />

      {/* Redirect teachers away from admin pages — send to their assigned exam */}
      {!isAdmin && (
        <>
          <Route path="/reports" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
          <Route path="/results-manager" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
          <Route path="/students" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
          <Route path="/users" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
          <Route path="/promotion" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
          <Route path="/targets" element={<Navigate to={`/${user.allowedExamType || 'opener'}`} replace />} />
        </>
      )}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/slip/:pin" element={<ParentSlip />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
