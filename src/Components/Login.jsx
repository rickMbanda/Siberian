import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, API_BASE } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      login(data.user, data.token);
    } catch (err) {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'url(/Kids.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      position: 'relative'
    },
    overlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(102, 126, 234, 0.7)',
      zIndex: 1
    },
    card: {
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '24px',
      padding: '48px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)',
      width: '90%',
      maxWidth: '420px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 2,
      margin: '0 auto'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '700',
      color: '#000080',
      marginBottom: '8px',
      letterSpacing: '-1px'
    },
    logoContainer: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '20px'
    },
    logo: {
      width: '80px',
      height: 'auto',
      maxHeight: '80px',
      objectFit: 'contain',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))'
    },
    motto: {
      color: '#6366f1',
      fontSize: '1rem',
      fontWeight: '600',
      fontStyle: 'italic',
      marginBottom: '8px',
      textAlign: 'center'
    },
    subtitle: {
      color: '#6b7280',
      fontSize: '1.1rem',
      marginBottom: '32px'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    input: {
      padding: '16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      transition: 'all 0.3s ease',
      outline: 'none',
      background: '#fff'
    },
    button: {
      padding: '16px',
      borderRadius: '12px',
      border: 'none',
      background: loading ? '#9ca3af' : '#000080',
      color: '#fff',
      fontSize: '1.1rem',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'transform 0.2s ease',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
    },
    error: {
      color: '#ef4444',
      backgroundColor: '#fee2e2',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '0.9rem'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay}></div>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img
            src="/logschool.png"
            alt="Spring Valley Baptist School Logo"
            style={styles.logo}
          />
        </div>
        <h1 style={styles.title}>Spring Valley Baptist School</h1>
        <p style={styles.motto}>"God, Hardwork and Discipline"</p>
        <p style={styles.subtitle}>Sign in to access the exam system</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Username"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            style={styles.input}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            style={styles.input}
            required
            disabled={loading}
          />
          <button
            type="submit"
            style={styles.button}
            disabled={loading}
            onMouseOver={(e) => { if (!loading) e.target.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
