const getBaseUrl = () => '/api/locks';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('sv_token') || ''}`
});

const handleResponse = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.statusText}`);
  }
  return response.json();
};

export const fetchLockStatus = async (academicYear, term, examType) => {
  const params = new URLSearchParams({ academicYear, term, examType });
  return handleResponse(await fetch(`${getBaseUrl()}/status?${params}`, { headers: authHeaders() }));
};

export const setLockConfig = async ({ academicYear, term, examType, gracePeriodMinutes }) =>
  handleResponse(
    await fetch(getBaseUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ academicYear, term, examType, gracePeriodMinutes })
    })
  );

export const clearLock = async (id) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
  );
