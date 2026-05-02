const mongoose = require('mongoose');

const parentPinSchema = new mongoose.Schema(
  {
    studentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentRecord', required: true },
    studentName:     { type: String, required: true },
    className:       { type: String, required: true },
    term:            { type: String, required: true },
    academicYear:    { type: String, required: true },
    examType:        { type: String, required: true },
    pin:             { type: String, required: true, unique: true },
    active:          { type: Boolean, default: true }
  },
  { timestamps: true }
);

parentPinSchema.index(
  { studentRecordId: 1, term: 1, academicYear: 1, examType: 1 },
  { unique: true, name: 'unique_pin_per_exam_slot' }
);

module.exports = mongoose.model('ParentPin', parentPinSchema);
