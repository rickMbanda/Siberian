const getBaseUrl = () => '/api/targets';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('sv_token') || ''}`
});

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.statusText}`);
  }
  return res.json();
};

export const fetchTarget = async (academicYear) =>
  handleResponse(await fetch(`${getBaseUrl()}/${encodeURIComponent(academicYear)}`, { headers: authHeaders() }));

export const fetchAllTargets = async () =>
  handleResponse(await fetch(getBaseUrl(), { headers: authHeaders() }));

export const saveTarget = async ({ academicYear, targetMean }) =>
  handleResponse(await fetch(getBaseUrl(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ academicYear, targetMean })
  }));

export const deleteTarget = async (academicYear) =>
  handleResponse(await fetch(`${getBaseUrl()}/${encodeURIComponent(academicYear)}`, {
    method: 'DELETE',
    headers: authHeaders()
  }));
