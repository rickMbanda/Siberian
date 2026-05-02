const express = require('express');
const router  = express.Router();

// All GET routes now read from the new StudentRecord model (flattened).
// This keeps the existing Reports / ClassMarklist / IndividualReport pages working
// without any changes.  POST/PUT still supported for backward compatibility.
const studentCtrl = require('../controllers/studentController');
const Result      = require('../models/Result');  // kept for write backward compat
const StudentRecord = require('../models/StudentRecord');

// ── Validation helpers (preserved from original) ──────────────────────────────
const validateAcademicYear = (academicYear, useDefault = true) => {
  if (!academicYear) {
    return useDefault
      ? { isValid: true, academicYear: new Date().getFullYear().toString() }
      : { isValid: false, message: 'Academic year is required' };
  }
  const yearStr    = academicYear.toString().trim();
  const currentYear = new Date().getFullYear();
  const year       = parseInt(yearStr);
  if (!/^\d{4}$/.test(yearStr) || year < 2020 || year > currentYear + 2) {
    return {
      isValid: false,
      message: `Academic year must be a 4-digit year between 2020 and ${currentYear + 2}`
    };
  }
  return { isValid: true, academicYear: yearStr };
};

const normalizeKey = (str) =>
  str ? str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim() : '';

// ── GET all results (read from StudentRecord, flattened) ───────────────────────
router.get('/', async (req, res) => {
  try {
    const validation = validateAcademicYear(req.query.academicYear, true);
    if (!validation.isValid) return res.status(400).json({ error: validation.message });
    req.query.academicYear = validation.academicYear;
    return studentCtrl.getAll(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET by exam type ───────────────────────────────────────────────────────────
router.get('/exam/:examType', async (req, res) => {
  try {
    const validation = validateAcademicYear(req.query.academicYear, true);
    if (!validation.isValid) return res.status(400).json({ error: validation.message });
    req.query.academicYear = validation.academicYear;
    return studentCtrl.getByExamType(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET by class ───────────────────────────────────────────────────────────────
router.get('/class/:className', async (req, res) => {
  try {
    const validation = validateAcademicYear(req.query.academicYear, true);
    if (!validation.isValid) return res.status(400).json({ error: validation.message });
    req.query.academicYear = validation.academicYear;
    return studentCtrl.getByClass(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET by class + exam type ───────────────────────────────────────────────────
router.get('/class/:className/exam/:examType', async (req, res) => {
  try {
    const validation = validateAcademicYear(req.query.academicYear, true);
    if (!validation.isValid) return res.status(400).json({ error: validation.message });
    req.query.academicYear = validation.academicYear;
    return studentCtrl.getByClassAndExamType(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST: create/update via upsert (backward compat — exam pages should prefer
//   POST /api/students/upsert for the new structured payload) ──────────────────
router.post('/', async (req, res) => {
  try {
    return studentCtrl.upsertMarks(req, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /:id  (legacy — updates a specific exam slot identified by composite id)
router.put('/:id', async (req, res) => {
  try {
    // Composite ids look like "<mongoId>_term1_opener"
    const parts = req.params.id.split('_');
    if (parts.length === 3) {
      const termDisplayMap = { term1: 'Term 1', term2: 'Term 2', term3: 'Term 3' };
      const examTypeMap    = { opener: 'opener', midterm: 'midterm', endterm: 'endterm' };
      req.body.term     = req.body.term     || termDisplayMap[parts[1]];
      req.body.examType = req.body.examType || examTypeMap[parts[2]];

      // The Results Manager edit form does not carry academicYear (or class), so
      // hydrate them from the underlying StudentRecord identified by the mongoId
      // prefix of the composite id. Without this, upsertMarks rejects with a
      // "academicYear is required" error and the update silently fails.
      const mongoId = parts[0];
      try {
        const record = await StudentRecord.findById(mongoId).select(
          'name class academicYear'
        );
        if (record) {
          req.body.name         = req.body.name         || record.name;
          req.body.class        = req.body.class        || record.class;
          req.body.academicYear = req.body.academicYear || record.academicYear;
        } else {
          return res.status(404).json({
            error: 'Student record not found for this result. It may have been deleted.'
          });
        }
      } catch (lookupErr) {
        return res.status(400).json({
          error: `Invalid result id "${req.params.id}": ${lookupErr.message}`
        });
      }
    }
    return studentCtrl.upsertMarks(req, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
// Clears marks for ONE exam slot only. The student stays in the roster.
// To delete a student entirely, use DELETE /api/students/:id (Manage Students).
router.delete('/:id', async (req, res) => {
  try {
    return studentCtrl.clearExamSlot(req, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
