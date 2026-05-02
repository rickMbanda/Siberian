const mongoose = require('mongoose');

const performanceTargetSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true },
    targetMean:   { type: Number, required: true, min: 0, max: 100 }
  },
  { timestamps: true }
);

performanceTargetSchema.index({ academicYear: 1 }, { unique: true, name: 'unique_target_per_year' });

module.exports = mongoose.model('PerformanceTarget', performanceTargetSchema);
