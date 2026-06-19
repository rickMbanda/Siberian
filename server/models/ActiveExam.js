const mongoose = require('mongoose');

const activeExamSchema = new mongoose.Schema(
  {
    _singleton: { type: String, default: 'global', unique: true },
    academicYear: { type: String, required: true },
    term: { type: String, enum: ['Term 1', 'Term 2', 'Term 3'], required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActiveExam', activeExamSchema);
