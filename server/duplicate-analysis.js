const mongoose = require('mongoose');
const Result = require('./models/Result');

// MongoDB connection URI from environment variables for security
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

// Function to analyze duplicate records
async function analyzeDuplicates() {
  try {
    await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // First, let's update all existing records to have normalized keys using bulk operations
    console.log('Updating existing records with normalized keys...');
    const totalCount = await Result.countDocuments({});
    console.log(`Total records to process: ${totalCount}`);
    
    // Process in batches to avoid timeout
    const batchSize = 100;
    let processed = 0;
    
    while (processed < totalCount) {
      const batch = await Result.find({}).skip(processed).limit(batchSize);
      
      const bulkOps = batch.map(record => {
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
        
        return {
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
        };
      });
      
      if (bulkOps.length > 0) {
        await Result.bulkWrite(bulkOps);
      }
      
      processed += batch.length;
      console.log(`Processed ${processed}/${totalCount} records...`);
    }
    
    console.log('Normalization complete!');

    // Find duplicates using aggregation
    console.log('\nAnalyzing duplicates...');
    
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

    console.log(`\nFound ${duplicateGroups.length} groups of duplicate records`);
    console.log(`Total duplicate records: ${duplicateGroups.reduce((sum, group) => sum + group.count, 0)}`);

    // Analyze each duplicate group
    let totalConflicts = 0;
    let groupsWithConflicts = 0;

    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const key = group._id;
      
      console.log(`\n--- Duplicate Group ${i + 1} ---`);
      console.log(`Student: "${group.records[0].name}"`);
      console.log(`Class: "${group.records[0].class}"`);
      console.log(`Exam Type: "${group.records[0].examType}"`);
      console.log(`Term: "${group.records[0].term || 'MISSING'}"`);
      console.log(`Records: ${group.count}`);

      // Analyze conflicts within this group
      const subjects = ['maths', 'english', 'kiswahili', 'language', 'reading', 
                       'environmental', 'integrated', 'creative', 'cre', 'kusoma', 
                       'social', 'pretech', 'agriculture'];
      
      let hasConflicts = false;
      
      subjects.forEach(subject => {
        const values = group.records
          .map(r => r[subject])
          .filter(v => v !== null && v !== undefined && v !== '');
        
        if (values.length > 1) {
          const uniqueValues = [...new Set(values)];
          if (uniqueValues.length > 1) {
            console.log(`  CONFLICT in ${subject}: ${uniqueValues.join(', ')}`);
            hasConflicts = true;
            totalConflicts++;
          }
        }
      });

      if (hasConflicts) {
        groupsWithConflicts++;
      }

      // Show record details
      group.records.forEach((record, index) => {
        const completeness = subjects.filter(s => 
          record[s] !== null && record[s] !== undefined && record[s] !== ''
        ).length;
        console.log(`  Record ${index + 1}: ID=${record._id}, Mean=${record.mean || 'N/A'}, Completeness=${completeness}/${subjects.length}, Updated=${record.updatedAt ? record.updatedAt.toISOString() : 'N/A'}`);
      });
    }

    console.log(`\n--- SUMMARY ---`);
    console.log(`Total duplicate groups: ${duplicateGroups.length}`);
    console.log(`Groups with data conflicts: ${groupsWithConflicts}`);
    console.log(`Total field conflicts: ${totalConflicts}`);
    
    // Show records missing terms
    const recordsWithoutTerm = await Result.countDocuments({
      $or: [
        { term: { $exists: false } },
        { term: null },
        { term: '' }
      ]
    });
    console.log(`Records missing term field: ${recordsWithoutTerm}`);

    // Show overall statistics
    const totalRecords = await Result.countDocuments({});
    const uniqueStudents = await Result.distinct('nameKey').then(keys => keys.length);
    console.log(`Total records in database: ${totalRecords}`);
    console.log(`Unique students (by nameKey): ${uniqueStudents}`);

  } catch (error) {
    console.error('Error analyzing duplicates:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nAnalysis complete. Database connection closed.');
  }
}

// Run the analysis
if (require.main === module) {
  analyzeDuplicates();
}

module.exports = { analyzeDuplicates };