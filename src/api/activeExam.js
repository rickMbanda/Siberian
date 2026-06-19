const BASE = '/api/active-exam';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('sv_token') || ''}`
});

const handle = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.statusText}`);
  }
  return res.json();
};

export const fetchActiveExam = () =>
  handle(fetch(BASE, { headers: authHeaders() }));

export const saveActiveExam = ({ academicYear, term }) =>
  handle(fetch(BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ academicYear, term })
  }));
