import { fetchRosterByClass, fetchStudentsByClassAndExamType } from '../api/students';

const normalizeName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const loadGradingRows = async ({
  selectedClass,
  selectedYear,
  selectedTerm,
  examType,
  subjects
}) => {
  const [rosterRows, existingMarks] = await Promise.all([
    fetchRosterByClass(selectedClass, selectedYear),
    fetchStudentsByClassAndExamType(selectedClass, examType, selectedYear, selectedTerm)
  ]);

  const roster = new Map();
  (rosterRows || []).forEach((r) => {
    const key = normalizeName(r.name);
    if (!key) return;
    if (!roster.has(key)) {
      roster.set(key, { name: r.name, studentRecordId: r.studentRecordId });
    }
  });

  const marksByName = new Map();
  (existingMarks || []).forEach((m) => {
    marksByName.set(normalizeName(m.name), m);
  });

  const baseId = Date.now();
  const rows = [];
  let i = 0;
  for (const [key, student] of roster) {
    const mark = marksByName.get(key);
    const row = {
      id:              baseId + i,
      _id:             mark?._id,
      studentRecordId: mark?.studentRecordId || student.studentRecordId,
      name:            student.name,
      mean:            mark?.mean ?? '',
      rubric:          mark?.rubric ?? '',
      examStatus:      mark?.examStatus || 'sat',
      examType,
      class:           selectedClass,
      term:            selectedTerm,
      academicYear:    selectedYear
    };
    subjects.forEach((sub) => { row[sub] = mark?.[sub] ?? ''; });
    rows.push(row);
    i++;
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
};
