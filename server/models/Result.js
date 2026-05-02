
const mongoose = require("mongoose");

// Create a flexible schema that can handle any subject
// Function to normalize student names for duplicate detection
const normalizeStudentName = (name) => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[''`]/g, "'") // Standardize all types of apostrophes (including unicode)
    .replace(/[-–—]/g, '-') // Standardize all types of dashes (including em-dash, en-dash)
    .replace(/[^\w\s'-]/g, '') // Remove special characters except letters, numbers, spaces, apostrophes, and hyphens
    .trim();
};

// Function to normalize class names for consistent storage
const normalizeClassName = (className) => {
  if (!className) return '';
  return className
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, and spaces
    .trim();
};

// Function to normalize exam types for consistent storage
const normalizeExamType = (examType) => {
  if (!examType) return '';
  return examType
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, and spaces
    .trim();
};

// Function to normalize terms for consistent storage
const normalizeTerm = (term) => {
  if (!term) return '';
  return term
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, and spaces
    .trim();
};

// Function to normalize academic years for consistent storage
const normalizeAcademicYear = (academicYear) => {
  if (!academicYear) return new Date().getFullYear().toString(); // Default to current year
  return academicYear.toString().trim();
};

const resultSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameKey: { type: String }, // Normalized name for duplicate detection
    examType: { type: String, required: true },
    examTypeKey: { type: String }, // Normalized exam type for consistent queries
    class: { type: String, required: true },
    classKey: { type: String }, // Normalized class for consistent queries
    term: { type: String, default: "" }, // Made non-required to prevent breaking existing API calls
    termKey: { type: String }, // Normalized term for consistent queries
    academicYear: { type: String, default: function() { return new Date().getFullYear().toString(); } }, // Academic year (e.g., "2024", "2025")
    academicYearKey: { type: String }, // Normalized academic year for consistent queries
    examStatus: { 
      type: String, 
      enum: ['sat', 'absent', 'incomplete'], 
      default: 'sat' 
    }, // Status: sat (took exam), absent (didn't sit), incomplete (data entry pending)
    mean: { type: Number, default: 0 },
    rubric: { type: String, default: "" },

    // Core subjects that appear across classes (lowercase to match frontend)
    maths: { type: Number, default: null },
    english: { type: Number, default: null },
    kiswahili: { type: Number, default: null },
    language: { type: Number, default: null },
    reading: { type: Number, default: null },
    environmental: { type: Number, default: null },
    integrated: { type: Number, default: null },
    creative: { type: Number, default: null },
    cre: { type: Number, default: null },
    kusoma: { type: Number, default: null },
    social: { type: Number, default: null },
    pretech: { type: Number, default: null },
    agriculture: { type: Number, default: null },
  },
  {
    timestamps: true,
    strict: false, // Allow additional fields not defined in schema
  },
);

// Pre-save middleware to automatically set normalized keys
resultSchema.pre('save', function(next) {
  if (this.name) {
    this.nameKey = normalizeStudentName(this.name);
  }
  if (this.class) {
    this.classKey = normalizeClassName(this.class);
  }
  if (this.examType) {
    this.examTypeKey = normalizeExamType(this.examType);
  }
  if (this.term) {
    this.termKey = normalizeTerm(this.term);
  }
  if (this.academicYear) {
    this.academicYearKey = normalizeAcademicYear(this.academicYear);
  }
  next();
});

// Pre-update middleware to automatically set normalized keys
// This handles both $set and direct field updates
resultSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  const update = this.getUpdate();
  
  // Handle $set operations (most common in Mongoose updates)
  if (update.$set) {
    if (update.$set.name) {
      update.$set.nameKey = normalizeStudentName(update.$set.name);
    }
    if (update.$set.class) {
      update.$set.classKey = normalizeClassName(update.$set.class);
    }
    if (update.$set.examType) {
      update.$set.examTypeKey = normalizeExamType(update.$set.examType);
    }
    if (update.$set.term) {
      update.$set.termKey = normalizeTerm(update.$set.term);
    }
    if (update.$set.academicYear) {
      update.$set.academicYearKey = normalizeAcademicYear(update.$set.academicYear);
    }
  }
  
  // Handle direct field updates (less common but still possible)
  if (update.name) {
    update.nameKey = normalizeStudentName(update.name);
  }
  if (update.class) {
    update.classKey = normalizeClassName(update.class);
  }
  if (update.examType) {
    update.examTypeKey = normalizeExamType(update.examType);
  }
  if (update.term) {
    update.termKey = normalizeTerm(update.term);
  }
  if (update.academicYear) {
    update.academicYearKey = normalizeAcademicYear(update.academicYear);
  }
  
  next();
});

// Add unique compound index to prevent duplicate records
// This ensures one record per student, class, exam type, term, and academic year
resultSchema.index(
  {
    nameKey: 1,
    classKey: 1,
    examTypeKey: 1,
    termKey: 1,
    academicYearKey: 1
  },
  {
    unique: true,
    name: 'unique_student_record_with_year',
    background: true // Create index in background to avoid blocking
  }
);

module.exports = mongoose.model("Result", resultSchema);