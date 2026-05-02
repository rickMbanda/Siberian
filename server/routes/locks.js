const express = require('express');
const router = express.Router();
const LockConfig = require('../models/LockConfig');
const { adminOnly } = require('../middleware/auth');

const computeLockStatus = (config) => {
  if (!config || !config.lockRequestedAt) {
    return { locked: false, effectiveAt: null };
  }
  const effectiveAt = new Date(config.lockRequestedAt.getTime() + (config.gracePeriodMinutes || 0) * 60000);
  return {
    locked: Date.now() >= effectiveAt.getTime(),
    effectiveAt
  };
};

router.get('/status', async (req, res) => {
  try {
    const { academicYear, term, examType } = req.query;
    if (!academicYear || !term || !examType) {
      return res.status(400).json({ error: 'academicYear, term, and examType are required.' });
    }

    const config = await LockConfig.findOne({ academicYear, term, examType });
    const status = computeLockStatus(config);

    res.json({
      id: config ? config._id : null,
      academicYear,
      term,
      examType,
      lockRequestedAt: config?.lockRequestedAt || null,
      gracePeriodMinutes: config?.gracePeriodMinutes || 0,
      locked: status.locked,
      effectiveAt: status.effectiveAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { academicYear, term, examType, gracePeriodMinutes = 0 } = req.body;
    if (!academicYear || !term || !examType) {
      return res.status(400).json({ error: 'academicYear, term, and examType are required.' });
    }

    const payload = {
      academicYear: academicYear.toString(),
      term,
      examType,
      lockRequestedAt: new Date(),
      gracePeriodMinutes: Number(gracePeriodMinutes) || 0
    };

    const config = await LockConfig.findOneAndUpdate(
      { academicYear: payload.academicYear, term: payload.term, examType: payload.examType },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const status = computeLockStatus(config);
    res.json({
      id: config._id,
      academicYear: config.academicYear,
      term: config.term,
      examType: config.examType,
      lockRequestedAt: config.lockRequestedAt,
      gracePeriodMinutes: config.gracePeriodMinutes,
      locked: status.locked,
      effectiveAt: status.effectiveAt
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A lock already exists for this exam slot.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const config = await LockConfig.findByIdAndDelete(req.params.id);
    if (!config) return res.status(404).json({ error: 'Lock not found.' });

    res.json({ success: true, message: 'Lock removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
