// New structured API for the StudentRecord model.
// Each student has ONE document per academic year; marks are nested by term → examType.

const getBaseUrl = () => '/api/students';

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

/**
 * Upsert marks for one student.
 *
 * Required fields in `data`:
 *   name, class, academicYear, term ("Term 1" | "Term 2" | "Term 3"),
 *   examType ("opener" | "midterm" | "endterm"),
 *   examStatus ("sat" | "absent" | "incomplete"),
 *   mean, rubric, plus all applicable subject scores.
 *
 * Returns { success, studentRecordId, termlyAverage, termlyRubric, record }.
 */
export const upsertStudentMarks = async (data) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/upsert`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(data)
    })
  );

/**
 * Fetch all records for a class (flat format — one object per exam sitting).
 * Optionally filter by academicYear and/or term.
 */
export const fetchStudentsByClass = async (className, academicYear = null, term = null) => {
  let url = `${getBaseUrl()}/class/${encodeURIComponent(className)}`;
  const params = new URLSearchParams();
  if (academicYear) params.append('academicYear', academicYear);
  if (term)         params.append('term', term);
  if ([...params].length) url += `?${params.toString()}`;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

/**
 * Fetch records for a class + examType (flat format).
 * Used by the exam pages to pre-populate the grid.
 */
export const fetchStudentsByClassAndExamType = async (
  className,
  examType,
  academicYear = null,
  term = null
) => {
  let url = `${getBaseUrl()}/class/${encodeURIComponent(className)}/exam/${examType}`;
  const params = new URLSearchParams();
  if (academicYear) params.append('academicYear', academicYear);
  if (term)         params.append('term', term);
  if ([...params].length) url += `?${params.toString()}`;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

/**
 * Fetch all records for the school (flat format).
 */
export const fetchAllStudents = async (academicYear = null) => {
  const url = academicYear
    ? `${getBaseUrl()}?academicYear=${academicYear}`
    : getBaseUrl();
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

/**
 * Delete a student record by its MongoDB _id.
 */
export const deleteStudentRecord = async (id) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/${id}`, {
      method:  'DELETE',
      headers: authHeaders()
    })
  );

/**
 * Roster: add a new student to a class for a given academic year (no marks).
 * Required fields: name, class, academicYear.
 */
export const createRosterStudent = async (data) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/roster`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(data)
    })
  );

/**
 * Roster: list students currently enrolled in a class for an academic year.
 * Returns [{ _id, studentRecordId, name, class, academicYear }].
 */
export const fetchRosterByClass = async (className, academicYear = null) => {
  let url = `${getBaseUrl()}/roster/class/${encodeURIComponent(className)}`;
  if (academicYear) url += `?academicYear=${academicYear}`;
  return handleResponse(await fetch(url, { headers: authHeaders() }));
};

/**
 * Roster: bulk-add many students to a class/year in one call.
 * Payload: { names: string[], class, academicYear }
 * Returns { created, skippedExisting, duplicatesInPayload, blanks, ... }.
 */
export const bulkCreateRosterStudents = async ({ names, className, academicYear }) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/roster/bulk`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ names, class: className, academicYear })
    })
  );

/**
 * Roster: promote a whole class to a new class / new academic year.
 * Payload: { fromClass, fromYear, toClass, toYear, studentIds? }
 *   - studentIds (optional) limits the promotion to a subset of source records.
 *
 * Returns: {
 *   success, fromClass, fromYear, toClass, toYear,
 *   sourceTotal, promoted, skippedExisting, promotedNames
 * }
 */
export const promoteRoster = async ({
  fromClass, fromYear, toClass, toYear, studentIds
}) =>
  handleResponse(
    await fetch(`${getBaseUrl()}/roster/promote`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ fromClass, fromYear, toClass, toYear, studentIds })
    })
  );
