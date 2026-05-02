import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const API_BASE = '';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('sv_token');
    const savedUser = localStorage.getItem('sv_user');
    if (token && savedUser) {
      // Verify token is still valid
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Token invalid');
        })
        .then(userData => {
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('sv_token');
          localStorage.removeItem('sv_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('sv_token', token);
    localStorage.setItem('sv_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sv_token');
    localStorage.removeItem('sv_user');
    window.location.reload();
  };

  const getToken = () => localStorage.getItem('sv_token');

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, getToken, API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
};
