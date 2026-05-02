const express  = require('express');
const router   = express.Router();
const Target   = require('../models/PerformanceTarget');
const { adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = academicYear ? { academicYear } : {};
    const targets = await Target.find(query).sort({ academicYear: -1 });
    res.json(targets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:academicYear', async (req, res) => {
  try {
    const target = await Target.findOne({ academicYear: req.params.academicYear });
    res.json(target || { academicYear: req.params.academicYear, targetMean: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { academicYear, targetMean } = req.body;
    if (!academicYear || targetMean == null) {
      return res.status(400).json({ error: 'academicYear and targetMean are required.' });
    }
    const target = await Target.findOneAndUpdate(
      { academicYear },
      { academicYear, targetMean: Number(targetMean) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:academicYear', adminOnly, async (req, res) => {
  try {
    await Target.findOneAndDelete({ academicYear: req.params.academicYear });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
