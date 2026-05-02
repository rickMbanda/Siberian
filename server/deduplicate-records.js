require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');

// MongoDB connection URI from environment variables for security
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

// Import the same normalization functions from the model
const normalizeStudentName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .replace(/[–—]/g, '-');
};

const normalizeField = (field) => {
  if (!field) return '';
  return field.trim().toLowerCase().replace(/\s+/g, ' ');
};

// Create audit schema for logging deduplication actions
const auditSchema = new mongoose.Schema({
  groupKey: { type: Object, required: true },
  originalRecords: { type: Array, required: true },
  mergedRecord: { type: Object, required: true },
  conflicts: { type: Array, default: [] },
  timestamp: { type: Date, default: Date.now },
  action: { type: String, default: 'deduplicate' }
});

const DedupeAudit = mongoose.model('DedupeAudit', auditSchema);

// Archive schema for storing removed duplicate records
const archiveSchema = new mongoose.Schema({
  originalId: { type: String, required: true },
  groupKey: { type: Object, required: true },
  survivorId: { type: String, required: true },
  originalData: { type: Object, required: true },
  archivedAt: { type: Date, default: Date.now }
});

const ResultsArchive = mongoose.model('ResultsArchive', archiveSchema);

// Function to calculate completeness score
function calculateCompleteness(record) {
  const subjects = ['maths', 'english', 'kiswahili', 'language', 'reading', 
                   'environmental', 'integrated', 'creative', 'cre', 'kusoma', 
                   'social', 'pretech', 'agriculture'];
  
  return subjects.filter(subject => 
    record[subject] !== null && 
    record[subject] !== undefined && 
    record[subject] !== '' &&
    !isNaN(parseFloat(record[subject]))
  ).length;
}

// Function to choose the best record from a group of duplicates
function chooseBestRecord(records) {
  // Sort by: 1) completeness (desc), 2) updatedAt (desc), 3) mean score (desc)
  const sorted = records.sort((a, b) => {
    const completenessA = calculateCompleteness(a);
    const completenessB = calculateCompleteness(b);
    
    if (completenessA !== completenessB) {
      return completenessB - completenessA; // Higher completeness first
    }
    
    const dateA = new Date(a.updatedAt || 0);
    const dateB = new Date(b.updatedAt || 0);
    
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB - dateA; // More recent first
    }
    
    const meanA = parseFloat(a.mean) || 0;
    const meanB = parseFloat(b.mean) || 0;
    return meanB - meanA; // Higher mean first
  });
  
  return sorted[0];
}

// Function to merge records, filling missing fields and handling conflicts
function mergeRecords(records) {
  const winner = chooseBestRecord(records);
  const merged = { ...winner };
  const conflicts = [];
  
  const subjects = ['maths', 'english', 'kiswahili', 'language', 'reading', 
                   'environmental', 'integrated', 'creative', 'cre', 'kusoma', 
                   'social', 'pretech', 'agriculture'];
  
  subjects.forEach(subject => {
    const values = records
      .map(r => r[subject])
      .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)));
    
    if (values.length > 0) {
      const uniqueValues = [...new Set(values.map(v => parseFloat(v)))];
      
      if (uniqueValues.length > 1) {
        // Conflict detected - use value from most recent record
        const mostRecentRecord = records.reduce((latest, current) => {
          const latestDate = new Date(latest.updatedAt || 0);
          const currentDate = new Date(current.updatedAt || 0);
          return currentDate > latestDate ? current : latest;
        });
        
        merged[subject] = mostRecentRecord[subject];
        conflicts.push({
          field: subject,
          values: uniqueValues,
          chosen: mostRecentRecord[subject],
          reason: 'chose_most_recent'
        });
      } else if (merged[subject] == null || merged[subject] === '') {
        // Fill missing field from other records
        merged[subject] = values[0];
      }
    }
  });
  
  // Recalculate mean and rubric
  const validScores = subjects
    .map(s => parseFloat(merged[s]))
    .filter(score => !isNaN(score));
  
  if (validScores.length > 0) {
    merged.mean = parseFloat((validScores.reduce((sum, score) => sum + score, 0) / validScores.length).toFixed(2));
    
    // Simple rubric calculation
    if (merged.mean >= 90) merged.rubric = 'Exceeds Expectations (E.E)';
    else if (merged.mean >= 75) merged.rubric = 'Meets Expectations (M.E)';
    else if (merged.mean >= 60) merged.rubric = 'Approaches Expectations (A.E)';
    else merged.rubric = 'Below Expectations (B.E)';
  }
  
  return { merged, conflicts, winner };
}

// Main deduplication function
async function deduplicateRecords(dryRun = true) {
  let processedGroups = 0;
  let totalRecordsRemoved = 0;
  let session;
  
  try {
    // Connect to MongoDB first
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 20000 });
    console.log('Connected to MongoDB');
    
    // Start session after connection is established
    session = await mongoose.startSession();
    console.log(`Running in ${dryRun ? 'DRY RUN' : 'LIVE'} mode`);
    
    // Update all records with normalized keys first
    console.log('\nUpdating records with normalized keys...');
    const allRecords = await Result.find({});
    
    const bulkOps = allRecords.map(record => ({
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            nameKey: normalizeStudentName(record.name),
            classKey: normalizeField(record.class),
            examTypeKey: normalizeField(record.examType),
            termKey: normalizeField(record.term || '')
          }
        }
      }
    }));
    
    if (bulkOps.length > 0) {
      await Result.bulkWrite(bulkOps);
      console.log(`Updated ${bulkOps.length} records with normalized keys`);
    }
    
    // Find duplicate groups
    const duplicateGroups = await Result.aggregate([
      {
        $group: {
          _id: {
            nameKey: "$nameKey",
            classKey: "$classKey", 
            examTypeKey: "$examTypeKey",
            termKey: "$termKey"
          },
          count: { $sum: 1 },
          records: { $push: "$$ROOT" }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log(`\nFound ${duplicateGroups.length} groups of duplicates`);
    
    // Process each duplicate group
    for (const group of duplicateGroups) {
      await session.withTransaction(async () => {
        const { merged, conflicts, winner } = mergeRecords(group.records);
        const losers = group.records.filter(r => r._id.toString() !== winner._id.toString());
        
        console.log(`\n--- Processing Group ${processedGroups + 1} ---`);
        console.log(`Student: "${group.records[0].name}" (${group.records[0].class}, ${group.records[0].examType}, ${group.records[0].term || 'N/A'})`);
        console.log(`Records: ${group.count} (removing ${losers.length})`);
        
        if (conflicts.length > 0) {
          console.log(`Conflicts resolved: ${conflicts.length}`);
          conflicts.forEach(c => console.log(`  - ${c.field}: [${c.values.join(', ')}] → ${c.chosen} (${c.reason})`));
        }
        
        if (!dryRun) {
          // Update the winner with merged data
          await Result.findByIdAndUpdate(winner._id, merged, { session });
          
          // Archive losers
          const archivePromises = losers.map(loser => 
            new ResultsArchive({
              originalId: loser._id.toString(),
              groupKey: group._id,
              survivorId: winner._id.toString(),
              originalData: loser
            }).save({ session })
          );
          await Promise.all(archivePromises);
          
          // Create audit record
          await new DedupeAudit({
            groupKey: group._id,
            originalRecords: group.records.map(r => ({ _id: r._id, name: r.name, mean: r.mean })),
            mergedRecord: { _id: winner._id, name: merged.name, mean: merged.mean },
            conflicts: conflicts
          }).save({ session });
          
          // Delete losers
          await Result.deleteMany({ 
            _id: { $in: losers.map(l => l._id) } 
          }, { session });
          
          console.log(`✓ Merged and removed ${losers.length} duplicates`);
        } else {
          console.log(`(DRY RUN) Would remove ${losers.length} duplicates`);
        }
        
        processedGroups++;
        totalRecordsRemoved += losers.length;
      });
    }
    
    console.log(`\n--- SUMMARY ---`);
    console.log(`Duplicate groups processed: ${processedGroups}`);
    console.log(`Total records ${dryRun ? 'that would be' : ''} removed: ${totalRecordsRemoved}`);
    
    if (!dryRun) {
      const remainingDuplicates = await Result.aggregate([
        {
          $group: {
            _id: {
              nameKey: "$nameKey",
              classKey: "$classKey", 
              examTypeKey: "$examTypeKey",
              termKey: "$termKey"
            },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);
      
      console.log(`Remaining duplicate groups: ${remainingDuplicates.length}`);
    }
    
  } catch (error) {
    console.error('Error during deduplication:', error);
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  
  if (!dryRun) {
    console.log('WARNING: Running in LIVE mode. This will permanently modify your database.');
    console.log('Make sure you have a backup before proceeding.');
  }
  
  deduplicateRecords(dryRun).catch(console.error);
}

module.exports = { deduplicateRecords, DedupeAudit, ResultsArchive };