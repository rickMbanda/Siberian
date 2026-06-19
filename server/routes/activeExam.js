const express = require('express');
const router = express.Router();
const ActiveExam = require('../models/ActiveExam');
const { adminOnly } = require('../middleware/auth');

// GET /api/active-exam — any authenticated user can read
router.get('/', async (req, res) => {
  try {
    const config = await ActiveExam.findOne({ _singleton: 'global' });
    if (!config) return res.json({ academicYear: null, term: null });
    res.json({ academicYear: config.academicYear, term: config.term });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/active-exam — admin only, upserts the singleton
router.post('/', adminOnly, async (req, res) => {
  try {
    const { academicYear, term } = req.body;
    if (!academicYear || !term) {
      return res.status(400).json({ error: 'academicYear and term are required.' });
    }
    const config = await ActiveExam.findOneAndUpdate(
      { _singleton: 'global' },
      { academicYear: academicYear.toString(), term },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ academicYear: config.academicYear, term: config.term });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
