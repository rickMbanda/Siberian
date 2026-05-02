const mongoose = require('mongoose');

const lockConfigSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true },
    term: {
      type: String,
      enum: ['Term 1', 'Term 2', 'Term 3'],
      required: true
    },
    examType: {
      type: String,
      enum: ['opener', 'midterm', 'endterm'],
      required: true
    },
    lockRequestedAt: { type: Date, default: null },
    gracePeriodMinutes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

lockConfigSchema.index(
  { academicYear: 1, term: 1, examType: 1 },
  { unique: true, name: 'unique_exam_lock' }
);

module.exports = mongoose.model('LockConfig', lockConfigSchema);
