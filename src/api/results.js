// All results routes now read from the StudentRecord model on the backend.
// Auth token is required for every request.

const getBaseUrl = () => '/api/results';

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

export const fetchResults = async (academicYear = null) => {
  const url = academicYear
    ? `${getBaseUrl()}?academicYear=${academicYear}`
    : getBaseUrl();
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

export const fetchResultsByType = async (type, academicYear = null) => {
  const url = academicYear
    ? `${getBaseUrl()}/exam/${type}?academicYear=${academicYear}`
    : `${getBaseUrl()}/exam/${type}`;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

export const fetchResultsByClass = async (className, academicYear = null) => {
  const url = academicYear
    ? `${getBaseUrl()}/class/${encodeURIComponent(className)}?academicYear=${academicYear}`
    : `${getBaseUrl()}/class/${encodeURIComponent(className)}`;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

export const fetchResultsByClassAndType = async (className, examType, academicYear = null) => {
  const base = `${getBaseUrl()}/class/${encodeURIComponent(className)}/exam/${examType}`;
  const url  = academicYear ? `${base}?academicYear=${academicYear}` : base;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

export const addResult = async (data) =>
  handleResponse(
    await fetch(getBaseUrl(), {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(data)
    })
  );

export const updateResult = async (id, data) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/${id}`, {
      method:  'PUT',
      headers: authHeaders(),
      body:    JSON.stringify(data)
    })
  );

export const deleteResult = async (id) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/${id}`, {
      method:  'DELETE',
      headers: authHeaders()
    })
  );
