const mongoose = require('mongoose');

const ALL_SUBJECTS = [
  'maths', 'english', 'kiswahili', 'language', 'reading',
  'environmental', 'integrated', 'creative', 'cre',
  'kusoma', 'social', 'pretech', 'agriculture'
];

const subjectFields = {};
ALL_SUBJECTS.forEach(s => {
  subjectFields[s] = { type: Number, default: null };
});

// Scores + status for one exam sitting
const examDataSchema = new mongoose.Schema(
  {
    examStatus: {
      type: String,
      enum: ['sat', 'absent', 'incomplete'],
      default: 'sat'
    },
    ...subjectFields,
    mean:   { type: Number, default: null },
    rubric: { type: String, default: '' }
  },
  { _id: false }
);

// One term holds three exam types + a computed termly average
const termDataSchema = new mongoose.Schema(
  {
    opener:  { type: examDataSchema, default: null },
    midterm: { type: examDataSchema, default: null },
    endterm: { type: examDataSchema, default: null },
    termlyAverage: { type: Number, default: null },
    termlyRubric:  { type: String,  default: '' }
  },
  { _id: false }
);

const studentRecordSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true },
    class:          { type: String, required: true },
    academicYear:   { type: String, required: true },
    // Normalised keys used for indexing / deduplication
    nameKey:        { type: String },
    classKey:       { type: String },
    academicYearKey:{ type: String },
    // Three terms
    term1: { type: termDataSchema, default: () => ({}) },
    term2: { type: termDataSchema, default: () => ({}) },
    term3: { type: termDataSchema, default: () => ({}) }
  },
  { timestamps: true }
);

// ── Normalisation helpers ─────────────────────────────────────────────────────
const normalizeStudentName = (name) => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .replace(/[-–—]/g, '-')
    .replace(/[^\w\s'-]/g, '')
    .trim();
};

const normalizeKey = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
};

// Pre-save: keep normalised keys in sync
studentRecordSchema.pre('save', function (next) {
  if (this.name)         this.nameKey         = normalizeStudentName(this.name);
  if (this.class)        this.classKey        = normalizeKey(this.class);
  if (this.academicYear) this.academicYearKey = this.academicYear.toString().trim();
  next();
});

// One student per class per academic year
studentRecordSchema.index(
  { nameKey: 1, classKey: 1, academicYearKey: 1 },
  { unique: true, name: 'unique_student_per_year' }
);

module.exports = mongoose.model('StudentRecord', studentRecordSchema);
