const getBaseUrl = () => '/api/parent-pins';

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

export const generateParentPin = async ({ studentRecordId, term, academicYear, examType }) =>
  handleResponse(await fetch(`${getBaseUrl()}/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ studentRecordId, term, academicYear, examType })
  }));

export const fetchPinForStudent = async ({ studentRecordId, term, academicYear, examType }) => {
  const params = new URLSearchParams({ studentRecordId, term, academicYear, examType });
  return handleResponse(await fetch(`${getBaseUrl()}/for-student?${params}`, { headers: authHeaders() }));
};

export const revokeParentPin = async (pin) =>
  handleResponse(await fetch(`${getBaseUrl()}/${encodeURIComponent(pin)}`, {
    method: 'DELETE',
    headers: authHeaders()
  }));

export const fetchSlipByPin = async (pin) =>
  handleResponse(await fetch(`${getBaseUrl()}/slip/${encodeURIComponent(pin)}`));
