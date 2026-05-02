import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ExamNavigation from '../Components/ExamNavigation';

const ChangePassword = () => {
  const { getToken, user, API_BASE } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to change password');
      } else {
        setMessage('Password changed successfully!');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)' },
    content: { maxWidth: '500px', margin: '0 auto', padding: '40px 20px' },
    card: {
      background: '#fff',
      borderRadius: '16px',
      padding: '40px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
    },
    title: { fontSize: '1.5rem', fontWeight: '700', color: '#000080', marginBottom: '8px' },
    subtitle: { color: '#64748b', marginBottom: '32px', fontSize: '0.95rem' },
    label: { display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '0.9rem' },
    input: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '10px',
      border: '2px solid #e5e7eb',
      fontSize: '1rem',
      marginBottom: '20px',
      outline: 'none',
      boxSizing: 'border-box'
    },
    button: {
      width: '100%',
      padding: '14px',
      borderRadius: '10px',
      border: 'none',
      background: '#4169E1',
      color: '#fff',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1
    },
    success: {
      background: '#dcfce7',
      color: '#166534',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      fontSize: '0.9rem'
    },
    error: {
      background: '#fee2e2',
      color: '#991b1b',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      fontSize: '0.9rem'
    }
  };

  return (
    <div style={styles.page}>
      <ExamNavigation />
      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.title}>Change Password</h2>
          <p style={styles.subtitle}>Logged in as: <strong>{user?.name}</strong> ({user?.role})</p>

          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Current Password</label>
            <input
              type="password"
              style={styles.input}
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
              disabled={loading}
            />

            <label style={styles.label}>New Password</label>
            <input
              type="password"
              style={styles.input}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
              disabled={loading}
              placeholder="At least 6 characters"
            />

            <label style={styles.label}>Confirm New Password</label>
            <input
              type="password"
              style={styles.input}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              disabled={loading}
            />

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
