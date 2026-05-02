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
          <Route path="/results-manager" element={<ResultsManager />} />
          <Route path="/students" element={<StudentManager />} />
          <Route path="/users" element={<UserManagement />} />
        </>
      ) : (
        <Route path="/" element={<Navigate to="/opener" replace />} />
      )}

      {/* Shared pages - both admin and teacher */}
      <Route path="/opener" element={<OpenerExam />} />
      <Route path="/midterm" element={<MidtermExam />} />
      <Route path="/endterm" element={<EndTermExam />} />
      <Route path="/change-password" element={<ChangePassword />} />

      {/* Redirect teachers away from admin pages */}
      {!isAdmin && (
        <>
          <Route path="/reports" element={<Navigate to="/opener" replace />} />
          <Route path="/results-manager" element={<Navigate to="/opener" replace />} />
          <Route path="/students" element={<Navigate to="/opener" replace />} />
          <Route path="/users" element={<Navigate to="/opener" replace />} />
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
      <ProtectedRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
