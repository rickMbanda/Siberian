import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ExamNavigation from '../Components/ExamNavigation';

const classes = [
  'Playgroup','PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4',
  'Grade 5','Grade 6','Grade 7','Grade 8','Grade 9'
];

const UserManagement = () => {
  const { getToken, API_BASE } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'teacher', assignedClass: '', allowedExamType: 'opener' });

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }), [getToken]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else setError(data.error);
    } catch { setError('Failed to load users'); }
    finally { setLoading(false); }
  }, [API_BASE, authHeader]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleCreateOrEdit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = editUser
        ? `${API_BASE}/api/auth/users/${editUser._id}`
        : `${API_BASE}/api/auth/users`;
      const method = editUser ? 'PUT' : 'POST';
      const body = editUser
        ? {
            name: form.name,
            role: form.role,
            assignedClass: form.assignedClass,
            allowedExamType: form.allowedExamType
          }
        : form;

      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      showMsg(editUser ? 'User updated successfully' : 'User created successfully');
      setShowForm(false);
      setEditUser(null);
      setForm({ username: '', password: '', name: '', role: 'teacher', assignedClass: '' });
      fetchUsers();
    } catch { setError('Request failed'); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete account for ${u.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${u._id}`, { method: 'DELETE', headers: authHeader() });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      showMsg(data.message);
      fetchUsers();
    } catch { setError('Failed to delete user'); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${resetTarget._id}/reset-password`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ newPassword: resetPassword })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      showMsg(data.message);
      setResetTarget(null);
      setResetPassword('');
    } catch { setError('Failed to reset password'); }
  };

  const startEdit = (u) => {
    setEditUser(u);
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      role: u.role,
      assignedClass: u.assignedClass || '',
      allowedExamType: u.allowedExamType || 'opener'
    });
    setShowForm(true);
  };

  const styles = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)' },
    content: { maxWidth: '900px', margin: '0 auto', padding: '40px 20px', background: 'rgba(255, 255, 255, 0.95)', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { fontSize: '1.5rem', fontWeight: '700', color: '#000080' },
    btn: (color = '#4169E1') => ({
      padding: '10px 20px', borderRadius: '8px', border: 'none',
      background: color, color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
    }),
    card: { background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '14px 16px', background: '#f1f5f9', fontWeight: '600', color: '#475569', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
    td: { padding: '14px 16px', borderTop: '1px solid #f1f5f9', color: '#334155', fontSize: '0.95rem' },
    badge: (role) => ({
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600',
      background: role === 'admin' ? '#dbeafe' : '#e0f2fe',
      color: role === 'admin' ? '#1e40af' : '#0369a1'
    }),
    modal: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    },
    modalCard: { background: '#fff', borderRadius: '16px', padding: '36px', width: '90%', maxWidth: '460px' },
    label: { display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '0.88rem' },
    input: { width: '100%', padding: '11px 14px', borderRadius: '8px', border: '2px solid #e5e7eb', fontSize: '0.95rem', marginBottom: '16px', boxSizing: 'border-box', outline: 'none' },
    select: { width: '100%', padding: '11px 14px', borderRadius: '8px', border: '2px solid #e5e7eb', fontSize: '0.95rem', marginBottom: '16px', boxSizing: 'border-box', outline: 'none', background: '#fff' },
    success: { background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' },
    errBox: { background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' },
    row: { display: 'flex', gap: '12px', marginTop: '8px' }
  };

  return (
    <div style={styles.page}>
      <ExamNavigation />
      <div style={styles.content}>
        <div style={styles.header}>
          <h2 style={styles.title}>User Management</h2>
          <button style={styles.btn()} onClick={() => { setEditUser(null); setForm({ username: '', password: '', name: '', role: 'teacher', assignedClass: '', allowedExamType: 'opener' }); setShowForm(true); }}>
            + Add User
          </button>
        </div>

        {success && <div style={styles.success}>{success}</div>}
        {error && <div style={styles.errBox}>{error}</div>}

        <div style={styles.card}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading users...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Assigned Class</th>
                  <th style={styles.th}>Allowed Exam</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td style={styles.td}>{u.name}</td>
                    <td style={styles.td}>{u.username}</td>
                    <td style={styles.td}><span style={styles.badge(u.role)}>{u.role}</span></td>
                    <td style={styles.td}>{u.assignedClass || '—'}</td>
                    <td style={styles.td}>{u.allowedExamType || 'opener'}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ ...styles.btn('#0891b2'), padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => startEdit(u)}>Edit</button>
                        <button style={{ ...styles.btn('#f59e0b'), padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { setResetTarget(u); setResetPassword(''); }}>Reset PW</button>
                        <button style={{ ...styles.btn('#ef4444'), padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleDelete(u)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create / Edit User Modal */}
        {showForm && (
          <div style={styles.modal} onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); setEditUser(null); } }}>
            <div style={styles.modalCard}>
              <h3 style={{ marginBottom: '24px', color: '#1e293b' }}>{editUser ? 'Edit User' : 'Add New User'}</h3>
              {error && <div style={styles.errBox}>{error}</div>}
              <form onSubmit={handleCreateOrEdit}>
                {!editUser && (
                  <>
                    <label style={styles.label}>Username</label>
                    <input style={styles.input} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required placeholder="e.g. jsmith" />
                    <label style={styles.label}>Password</label>
                    <input type="password" style={styles.input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="At least 6 characters" />
                  </>
                )}
                <label style={styles.label}>Full Name</label>
                <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. John Smith" />
                <label style={styles.label}>Role</label>
                <select style={styles.select} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
                <label style={styles.label}>Assigned Class (optional)</label>
                <select style={styles.select} value={form.assignedClass} onChange={e => setForm({ ...form, assignedClass: e.target.value })}>
                  <option value="">— None —</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {form.role === 'teacher' && (
                  <>
                    <label style={styles.label}>Allowed Exam Type</label>
                    <select style={styles.select} value={form.allowedExamType} onChange={e => setForm({ ...form, allowedExamType: e.target.value })}>
                      <option value="opener">Opener</option>
                      <option value="midterm">Midterm</option>
                      <option value="endterm">Endterm</option>
                    </select>
                  </>
                )}
                <div style={styles.row}>
                  <button type="submit" style={styles.btn()}>{editUser ? 'Save Changes' : 'Create User'}</button>
                  <button type="button" style={styles.btn('#6b7280')} onClick={() => { setShowForm(false); setEditUser(null); setError(''); }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetTarget && (
          <div style={styles.modal} onClick={(e) => { if (e.target === e.currentTarget) setResetTarget(null); }}>
            <div style={styles.modalCard}>
              <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>Reset Password</h3>
              <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.9rem' }}>Setting new password for <strong>{resetTarget.name}</strong></p>
              {error && <div style={styles.errBox}>{error}</div>}
              <form onSubmit={handleResetPassword}>
                <label style={styles.label}>New Password</label>
                <input type="password" style={styles.input} value={resetPassword} onChange={e => setResetPassword(e.target.value)} required placeholder="At least 6 characters" />
                <div style={styles.row}>
                  <button type="submit" style={styles.btn('#f59e0b')}>Reset Password</button>
                  <button type="button" style={styles.btn('#6b7280')} onClick={() => { setResetTarget(null); setError(''); }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
