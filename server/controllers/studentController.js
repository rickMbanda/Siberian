const StudentRecord = require('../models/StudentRecord');
const LockConfig = require('../models/LockConfig');

const ALL_SUBJECTS = [
  'maths', 'english', 'kiswahili', 'language', 'reading',
  'environmental', 'integrated', 'creative', 'cre',
  'kusoma', 'social', 'pretech', 'agriculture'
];

// ── Rubric thresholds (matches frontend) ──────────────────────────────────────
const getRubric = (mean) => {
  if (mean >= 80) return 'Exceeds Expectations (E.E)';
  if (mean >= 65) return 'Meets Expectations (M.E)';
  if (mean >= 50) return 'Approaching Expectations (A.E)';
  return 'Below Expectations (B.E)';
};

// ── Term / exam-type mappings ─────────────────────────────────────────────────
const TERM_KEY_MAP = {
  'term 1': 'term1', 'term1': 'term1',
  'term 2': 'term2', 'term2': 'term2',
  'term 3': 'term3', 'term3': 'term3'
};
const TERM_DISPLAY_MAP = { term1: 'Term 1', term2: 'Term 2', term3: 'Term 3' };

const EXAM_TYPE_MAP = {
  'opener':   'opener',
  'midterm':  'midterm',
  'endterm':  'endterm',
  'end term': 'endterm',
  'end-term': 'endterm'
};

// ── Normalisation ─────────────────────────────────────────────────────────────
const normalizeStudentName = (name) => {
  if (!name) return '';
  return name
    .trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .replace(/[-–—]/g, '-')
    .replace(/[^\w\s'-]/g, '')
    .trim();
};
const normalizeKey = (str) =>
  str ? str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim() : '';

const computeLockStatus = (config) => {
  if (!config || !config.lockRequestedAt) return { locked: false, effectiveAt: null };
  const effectiveAt = new Date(config.lockRequestedAt.getTime() + (config.gracePeriodMinutes || 0) * 60000);
  return { locked: Date.now() >= effectiveAt.getTime(), effectiveAt };
};

const isExamSlotLocked = async ({ academicYear, term, examType }) => {
  const config = await LockConfig.findOne({ academicYear, term, examType });
  return computeLockStatus(config);
};

// ── Termly average (weighted: opener 30%, midterm 30%, endterm 40%) ───────────
const calculateTermlyAverage = (termData) => {
  const opener  = termData?.opener;
  const midterm = termData?.midterm;
  const endterm = termData?.endterm;

  const hasOpener  = opener  && opener.examStatus  !== 'absent' && opener.mean  != null;
  const hasMidterm = midterm && midterm.examStatus !== 'absent' && midterm.mean != null;
  const hasEndterm = endterm && endterm.examStatus !== 'absent' && endterm.mean != null;

  // Only compute once all three exams are present
  if (!hasOpener || !hasMidterm || !hasEndterm) return null;

  const avg = (opener.mean * 0.3) + (midterm.mean * 0.3) + (endterm.mean * 0.4);
  return parseFloat(avg.toFixed(2));
};

// ── Flatten one StudentRecord into the "flat" format the frontend expects ─────
const flattenRecord = (record) => {
  const results = [];
  ['term1', 'term2', 'term3'].forEach((termKey) => {
    const termData = record[termKey];
    if (!termData) return;

    ['opener', 'midterm', 'endterm'].forEach((examTypeKey) => {
      const examData = termData[examTypeKey];
      if (!examData || !examData.examStatus) return;

      const flat = {
        _id:             `${record._id}_${termKey}_${examTypeKey}`,
        studentRecordId: record._id.toString(),
        name:            record.name,
        class:           record.class,
        academicYear:    record.academicYear,
        term:            TERM_DISPLAY_MAP[termKey],
        examType:        examTypeKey,
        examStatus:      examData.examStatus,
        mean:            examData.mean,
        rubric:          examData.rubric,
        termlyAverage:   termData.termlyAverage,
        termlyRubric:    termData.termlyRubric
      };
      ALL_SUBJECTS.forEach((s) => { flat[s] = examData[s]; });
      results.push(flat);
    });
  });
  return results;
};

// ── Controller: Upsert marks ──────────────────────────────────────────────────
exports.upsertMarks = async (req, res) => {
  try {
    const {
      name, class: className, academicYear,
      term, examType,
      examStatus = 'sat',
      mean, rubric,
      ...rest
    } = req.body;

    if (!name || !className || !academicYear || !term || !examType) {
      return res.status(400).json({
        error: 'name, class, academicYear, term, and examType are all required'
      });
    }

    const termKey = TERM_KEY_MAP[term.trim().toLowerCase()];
    if (!termKey) {
      return res.status(400).json({
        error: `Invalid term "${term}". Use "Term 1", "Term 2", or "Term 3".`
      });
    }

    const examTypeKey = EXAM_TYPE_MAP[examType.trim().toLowerCase()];
    if (!examTypeKey) {
      return res.status(400).json({
        error: `Invalid examType "${examType}". Use "opener", "midterm", or "endterm".`
      });
    }

    // Build the exam-slot payload
    const examData = { examStatus };
    if (examStatus === 'absent') {
      ALL_SUBJECTS.forEach((s) => { examData[s] = null; });
      examData.mean   = null;
      examData.rubric = '';
    } else {
      ALL_SUBJECTS.forEach((s) => {
        const val = rest[s];
        examData[s] = (val !== undefined && val !== '') ? parseFloat(val) : null;
      });
      examData.mean   = (mean !== undefined && mean !== '') ? parseFloat(mean) : null;
      examData.rubric = rubric || '';
    }

    // Find or create the student record
    const nameKey        = normalizeStudentName(name);
    const classKey       = normalizeKey(className);
    const academicYearKey = academicYear.toString().trim();

    const record = await StudentRecord.findOne({ nameKey, classKey, academicYearKey });
    if (!record) {
      return res.status(404).json({
        error: `Student "${name}" is not in the roster for ${className} (${academicYearKey}). Please add them in the Manage Students module first.`
      });
    }

    if (req.user?.role !== 'admin') {
      const lockCheck = await isExamSlotLocked({
        academicYear: academicYearKey,
        term,
        examType: examTypeKey
      });
      if (lockCheck.locked) {
        return res.status(423).json({
          error: `Marks are locked for ${term} ${examType}. Lock became active at ${lockCheck.effectiveAt.toISOString()}.` 
        });
      }
    }

    // Stamp the specific exam slot
    if (!record[termKey]) record[termKey] = {};
    record[termKey][examTypeKey] = examData;

    // Re-compute termly average after updating the slot
    const termData = record[termKey];
    termData.termlyAverage = calculateTermlyAverage(termData);
    termData.termlyRubric  =
      termData.termlyAverage !== null ? getRubric(termData.termlyAverage) : '';

    record[termKey] = termData;
    record.markModified(termKey);  // necessary for nested Mongoose objects

    await record.save();

    res.json({
      success: true,
      studentRecordId: record._id,
      termlyAverage:   termData.termlyAverage,
      termlyRubric:    termData.termlyRubric,
      record
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate student record conflict.' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Get all students (flat, filtered by academicYear) ──────────────
exports.getAll = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = {};
    if (academicYear) query.academicYearKey = academicYear.toString().trim();

    const records = await StudentRecord.find(query);
    res.json(records.flatMap(flattenRecord));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Get by class (flat) ──────────────────────────────────────────
exports.getByClass = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const classKey = normalizeKey(req.params.className);
    const query = { classKey };
    if (academicYear) query.academicYearKey = academicYear.toString().trim();

    const records = await StudentRecord.find(query);
    res.json(records.flatMap(flattenRecord));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Get by class + examType (optionally filter by term) ───────────
exports.getByClassAndExamType = async (req, res) => {
  try {
    const { academicYear, term } = req.query;
    const classKey    = normalizeKey(req.params.className);
    const examTypeKey = EXAM_TYPE_MAP[req.params.examType?.trim().toLowerCase()]
                        || req.params.examType;
    const query = { classKey };
    if (academicYear) query.academicYearKey = academicYear.toString().trim();

    const records = await StudentRecord.find(query);
    let flat = records.flatMap(flattenRecord)
                      .filter((f) => f.examType === examTypeKey);
    if (term) flat = flat.filter((f) => f.term === term);
    res.json(flat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Get by examType across all classes ────────────────────────────
exports.getByExamType = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const examTypeKey = EXAM_TYPE_MAP[req.params.examType?.trim().toLowerCase()]
                        || req.params.examType;
    const query = {};
    if (academicYear) query.academicYearKey = academicYear.toString().trim();

    const records = await StudentRecord.find(query);
    const flat = records.flatMap(flattenRecord)
                        .filter((f) => f.examType === examTypeKey);
    res.json(flat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Get raw StudentRecord by id ────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const record = await StudentRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Student record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Delete an entire student record (roster + all marks) ──────────
// Used ONLY by the Manage Students module. /api/students/:id
exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    // Support both raw MongoDB _id and composite flat IDs (e.g., "abc_term1_opener")
    const mongoId = id.includes('_') ? id.split('_')[0] : id;
    const result = await StudentRecord.findByIdAndDelete(mongoId);
    if (!result) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Controller: Clear marks for ONE (term × examType) slot ────────────────────
// The student stays in the roster; only the marks for that exam are wiped.
// Used by the Results Manager DELETE button. /api/results/:id
exports.clearExamSlot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.includes('_')) {
      return res.status(400).json({
        error: 'A composite id "<mongoId>_<termKey>_<examType>" is required to clear an exam slot.'
      });
    }

    const [mongoId, termKey, examTypeKey] = id.split('_');
    if (!['term1', 'term2', 'term3'].includes(termKey)) {
      return res.status(400).json({ error: `Invalid term key "${termKey}".` });
    }
    if (!['opener', 'midterm', 'endterm'].includes(examTypeKey)) {
      return res.status(400).json({ error: `Invalid exam type "${examTypeKey}".` });
    }

    const record = await StudentRecord.findById(mongoId);
    if (!record) return res.status(404).json({ error: 'Student record not found.' });

    // Wipe the slot (set to null so flatten() skips it)
    record[termKey][examTypeKey] = null;

    // Recompute the termly average for the affected term
    record[termKey].termlyAverage = calculateTermlyAverage(record[termKey]);
    record[termKey].termlyRubric  = record[termKey].termlyAverage != null
      ? getRubric(record[termKey].termlyAverage)
      : '';

    record.markModified(termKey);
    await record.save();

    res.json({
      success: true,
      message: `Cleared ${TERM_DISPLAY_MAP[termKey]} ${examTypeKey} marks for ${record.name}. Student remains in the roster.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Controller: Create a new roster student (no marks) ────────────────────────
exports.createRosterStudent = async (req, res) => {
  try {
    const { name, class: className, academicYear } = req.body;
    if (!name || !className || !academicYear) {
      return res.status(400).json({ error: 'name, class, and academicYear are required' });
    }

    const trimmedName = name.trim();
    const trimmedClass = className.trim();
    const yearStr = academicYear.toString().trim();
    const nameKey  = normalizeStudentName(trimmedName);
    const classKey = normalizeKey(trimmedClass);

    if (!nameKey) {
      return res.status(400).json({ error: 'Student name cannot be empty.' });
    }

    const existing = await StudentRecord.findOne({
      nameKey, classKey, academicYearKey: yearStr
    });
    if (existing) {
      return res.status(409).json({
        error: `"${trimmedName}" already exists in ${trimmedClass} (${yearStr}).`
      });
    }

    const record = new StudentRecord({
      name: trimmedName,
      class: trimmedClass,
      academicYear: yearStr
    });
    await record.save();

    res.status(201).json({
      _id:          record._id,
      name:         record.name,
      class:        record.class,
      academicYear: record.academicYear
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Student already exists for this class and year.' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Rename a roster student (preserves all marks) ────────────────
exports.renameRosterStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'New name is required.' });
    }
    const trimmedName = name.trim();
    const record = await StudentRecord.findById(id);
    if (!record) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    // Check for duplicate name in same class + year
    const nameKey  = normalizeStudentName(trimmedName);
    const duplicate = await StudentRecord.findOne({
      nameKey,
      classKey:       record.classKey,
      academicYearKey: record.academicYearKey,
      _id:            { $ne: record._id }
    });
    if (duplicate) {
      return res.status(409).json({
        error: `"${trimmedName}" already exists in ${record.class} (${record.academicYear}).`
      });
    }
    record.name = trimmedName;
    // nameKey is updated automatically by the pre-save hook
    await record.save();
    res.json({ _id: record._id, name: record.name, class: record.class, academicYear: record.academicYear });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A student with that name already exists for this class and year.' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Bulk-create roster students from a list of names ──────────────
exports.bulkCreateRosterStudents = async (req, res) => {
  try {
    const { names, class: className, academicYear } = req.body;

    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names must be a non-empty array.' });
    }
    if (!className || !academicYear) {
      return res.status(400).json({ error: 'class and academicYear are required.' });
    }

    const trimmedClass = className.trim();
    const yearStr      = academicYear.toString().trim();
    const classKey     = normalizeKey(trimmedClass);

    // Normalise + dedupe the incoming names against themselves first
    const seenInBatch = new Map(); // nameKey → original trimmed name
    const cleaned = [];
    const duplicatesInPayload = [];
    const blanks = [];

    names.forEach((raw, idx) => {
      const trimmed = (raw || '').toString().trim();
      if (!trimmed) {
        blanks.push(idx + 1);
        return;
      }
      const nameKey = normalizeStudentName(trimmed);
      if (!nameKey) {
        blanks.push(idx + 1);
        return;
      }
      if (seenInBatch.has(nameKey)) {
        duplicatesInPayload.push(trimmed);
        return;
      }
      seenInBatch.set(nameKey, trimmed);
      cleaned.push({ name: trimmed, nameKey });
    });

    if (cleaned.length === 0) {
      return res.status(400).json({
        error: 'No valid names to import.',
        blanks: blanks.length,
        duplicatesInPayload
      });
    }

    // Find which of these already exist in the DB for this class/year
    const existing = await StudentRecord.find(
      {
        classKey,
        academicYearKey: yearStr,
        nameKey: { $in: cleaned.map(c => c.nameKey) }
      },
      'name nameKey'
    );
    const existingKeys = new Set(existing.map(e => e.nameKey));
    const skippedExisting = cleaned
      .filter(c => existingKeys.has(c.nameKey))
      .map(c => c.name);

    const toInsert = cleaned
      .filter(c => !existingKeys.has(c.nameKey))
      .map(c => ({
        name:            c.name,
        class:           trimmedClass,
        academicYear:    yearStr,
        nameKey:         c.nameKey,
        classKey,
        academicYearKey: yearStr
      }));

    let inserted = [];
    if (toInsert.length > 0) {
      try {
        inserted = await StudentRecord.insertMany(toInsert, { ordered: false });
      } catch (bulkErr) {
        // Some inserts may have succeeded even if others hit duplicate-key errors
        if (bulkErr.insertedDocs) {
          inserted = bulkErr.insertedDocs;
        } else {
          throw bulkErr;
        }
      }
    }

    res.status(201).json({
      success: true,
      class: trimmedClass,
      academicYear: yearStr,
      submitted:        names.length,
      created:          inserted.length,
      skippedExisting:  skippedExisting,
      duplicatesInPayload,
      blanks:           blanks.length,
      createdNames:     inserted.map(r => r.name)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Roster (just name + class + year) for a class ─────────────────
exports.getRosterByClass = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const classKey = normalizeKey(req.params.className);
    const query = { classKey };
    if (academicYear) query.academicYearKey = academicYear.toString().trim();

    const records = await StudentRecord
      .find(query, '_id name class academicYear')
      .sort({ name: 1 });

    res.json(records.map(r => ({
      _id:             r._id,
      studentRecordId: r._id.toString(),
      name:            r.name,
      class:           r.class,
      academicYear:    r.academicYear
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Controller: Promote a class roster to the next class / next academic year
// Body: { fromClass, fromYear, toClass, toYear, studentIds? }
//   - fromClass / fromYear: source roster to copy from (required)
//   - toClass   / toYear:   destination class & year       (required)
//   - studentIds (optional): subset of source-record _ids to promote.
//                            If omitted, the whole source roster is promoted.
//
// Behaviour:
//   - Creates fresh roster docs in {toClass, toYear} with no marks.
//   - Source records are left untouched (history is preserved).
//   - Students who already exist in {toClass, toYear} are skipped (idempotent).
//   - Returns counts + the names actually created and the names skipped.
exports.promoteRoster = async (req, res) => {
  try {
    const {
      fromClass, fromYear,
      toClass,   toYear,
      studentIds
    } = req.body;

    if (!fromClass || !fromYear || !toClass || !toYear) {
      return res.status(400).json({
        error: 'fromClass, fromYear, toClass, and toYear are all required.'
      });
    }

    const fromYearStr  = fromYear.toString().trim();
    const toYearStr    = toYear.toString().trim();
    const fromClassKey = normalizeKey(fromClass);
    const toClassTrim  = toClass.trim();
    const toClassKey   = normalizeKey(toClassTrim);

    if (fromClassKey === toClassKey && fromYearStr === toYearStr) {
      return res.status(400).json({
        error: 'Source and destination class/year are identical. Pick a different target.'
      });
    }

    // Pull the source roster
    const srcQuery = {
      classKey:        fromClassKey,
      academicYearKey: fromYearStr
    };
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      srcQuery._id = { $in: studentIds };
    }
    const sourceRoster = await StudentRecord.find(
      srcQuery,
      'name nameKey'
    ).sort({ name: 1 });

    if (sourceRoster.length === 0) {
      return res.status(404).json({
        error: `No students found in ${fromClass} (${fromYearStr}) to promote.`
      });
    }

    // Find anyone already enrolled in the destination
    const existing = await StudentRecord.find(
      {
        classKey:        toClassKey,
        academicYearKey: toYearStr,
        nameKey:         { $in: sourceRoster.map(s => s.nameKey) }
      },
      'name nameKey'
    );
    const existingKeys = new Set(existing.map(e => e.nameKey));
    const skippedExisting = sourceRoster
      .filter(s => existingKeys.has(s.nameKey))
      .map(s => s.name);

    const toInsert = sourceRoster
      .filter(s => !existingKeys.has(s.nameKey))
      .map(s => ({
        name:            s.name,
        class:           toClassTrim,
        academicYear:    toYearStr,
        nameKey:         s.nameKey,
        classKey:        toClassKey,
        academicYearKey: toYearStr
      }));

    let inserted = [];
    if (toInsert.length > 0) {
      try {
        inserted = await StudentRecord.insertMany(toInsert, { ordered: false });
      } catch (bulkErr) {
        if (bulkErr.insertedDocs) {
          inserted = bulkErr.insertedDocs;
        } else {
          throw bulkErr;
        }
      }
    }

    res.status(201).json({
      success:        true,
      fromClass,
      fromYear:       fromYearStr,
      toClass:        toClassTrim,
      toYear:         toYearStr,
      sourceTotal:    sourceRoster.length,
      promoted:       inserted.length,
      skippedExisting,
      promotedNames:  inserted.map(r => r.name)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.flattenRecord       = flattenRecord;
exports.getRubric           = getRubric;
exports.calculateTermlyAverage = calculateTermlyAverage;
