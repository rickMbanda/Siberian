const express       = require('express');
const router        = express.Router();
const ParentPin     = require('../models/ParentPin');
const StudentRecord = require('../models/StudentRecord');
const { adminOnly } = require('../middleware/auth');
const { ALL_SUBJECTS } = require('../utils/subjectConfig');

const TERM_KEY_MAP = {
  'term 1': 'term1', 'term1': 'term1',
  'term 2': 'term2', 'term2': 'term2',
  'term 3': 'term3', 'term3': 'term3'
};

const getRubric = (mean) => {
  if (mean >= 80) return 'Exceeds Expectations (E.E)';
  if (mean >= 65) return 'Meets Expectations (M.E)';
  if (mean >= 50) return 'Approaching Expectations (A.E)';
  return 'Below Expectations (B.E)';
};

const generatePin = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) pin += chars[Math.floor(Math.random() * chars.length)];
  return pin;
};

const getUniquePin = async () => {
  let pin;
  let attempts = 0;
  do {
    pin = generatePin();
    attempts++;
    if (attempts > 50) throw new Error('Could not generate a unique PIN. Try again.');
  } while (await ParentPin.findOne({ pin }));
  return pin;
};

router.post('/generate', adminOnly, async (req, res) => {
  try {
    const { studentRecordId, term, academicYear, examType } = req.body;
    if (!studentRecordId || !term || !academicYear || !examType) {
      return res.status(400).json({ error: 'studentRecordId, term, academicYear and examType are required.' });
    }

    const record = await StudentRecord.findById(studentRecordId);
    if (!record) return res.status(404).json({ error: 'Student record not found.' });

    const existing = await ParentPin.findOne({ studentRecordId, term, academicYear, examType });
    if (existing) {
      existing.active = true;
      await existing.save();
      return res.json(existing);
    }

    const pin = await getUniquePin();
    const pinDoc = await ParentPin.create({
      studentRecordId,
      studentName: record.name,
      className:   record.class,
      term,
      academicYear,
      examType,
      pin,
      active: true
    });
    res.status(201).json(pinDoc);
  } catch (err) {
    if (err.code === 11000) {
      const existing = await ParentPin.findOne({
        studentRecordId: req.body.studentRecordId,
        term: req.body.term,
        academicYear: req.body.academicYear,
        examType: req.body.examType
      });
      if (existing) return res.json(existing);
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:pin', adminOnly, async (req, res) => {
  try {
    const doc = await ParentPin.findOneAndDelete({ pin: req.params.pin });
    if (!doc) return res.status(404).json({ error: 'PIN not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/for-student', adminOnly, async (req, res) => {
  try {
    const { studentRecordId, term, academicYear, examType } = req.query;
    if (!studentRecordId || !term || !academicYear || !examType) {
      return res.status(400).json({ error: 'studentRecordId, term, academicYear and examType are required.' });
    }
    const pin = await ParentPin.findOne({ studentRecordId, term, academicYear, examType, active: true });
    res.json(pin || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/slip/:pin', async (req, res) => {
  try {
    const pinDoc = await ParentPin.findOne({ pin: req.params.pin, active: true });
    if (!pinDoc) return res.status(404).json({ error: 'Invalid or expired PIN.' });

    const record = await StudentRecord.findById(pinDoc.studentRecordId).lean();
    if (!record) return res.status(404).json({ error: 'Student record not found.' });

    const termKey = TERM_KEY_MAP[pinDoc.term.toLowerCase()] || 'term1';
    const termData = record[termKey];
    if (!termData) return res.status(404).json({ error: 'No data for this term.' });

    const examData = termData[pinDoc.examType];
    if (!examData) return res.status(404).json({ error: 'No data for this exam.' });

    const subjects = {};
    ALL_SUBJECTS.forEach(s => {
      if (examData[s] != null) subjects[s] = examData[s];
    });

    res.json({
      studentName:  record.name,
      className:    record.class,
      academicYear: record.academicYear,
      term:         pinDoc.term,
      examType:     pinDoc.examType,
      examStatus:   examData.examStatus,
      subjects,
      mean:         examData.mean,
      rubric:       examData.rubric || (examData.mean != null ? getRubric(examData.mean) : ''),
      termlyAverage: termData.termlyAverage,
      termlyRubric:  termData.termlyRubric || (termData.termlyAverage != null ? getRubric(termData.termlyAverage) : '')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
