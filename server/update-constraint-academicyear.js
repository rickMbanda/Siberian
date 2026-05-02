require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');

// MongoDB connection URI from environment variables
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

async function updateUniqueConstraint() {
  try {
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 20000 });
    console.log('Connected to MongoDB');
    
    // Check current indexes
    const indexes = await Result.collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
    // Find the old unique constraint
    const oldIndex = indexes.find(index => 
      index.name === 'unique_student_record' ||
      (index.key && index.key.nameKey && index.key.classKey && index.key.examTypeKey && index.key.termKey && !index.key.academicYearKey)
    );
    
    if (oldIndex) {
      console.log(`Dropping old constraint: ${oldIndex.name}`);
      await Result.collection.dropIndex(oldIndex.name);
      console.log('✓ Old constraint dropped');
    }
    
    // First, update all existing records with academicYearKey
    console.log('Updating existing records with academicYear and academicYearKey...');
    const updateResult = await Result.updateMany(
      { academicYear: { $exists: false } }, 
      { 
        $set: { 
          academicYear: '2024', // Set existing data to 2024
          academicYearKey: '2024'
        } 
      }
    );
    console.log(`Updated ${updateResult.modifiedCount} records with academicYear: 2024`);
    
    // Update all records to ensure academicYearKey is set
    const allRecords = await Result.find({});
    const bulkOps = allRecords.map(record => ({
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            academicYearKey: (record.academicYear || '2024').toString().trim()
          }
        }
      }
    }));
    
    if (bulkOps.length > 0) {
      await Result.bulkWrite(bulkOps);
      console.log(`Updated ${bulkOps.length} records with academicYearKey`);
    }
    
    // Create new compound unique index with academic year
    console.log('Creating new unique compound index with academic year...');
    await Result.collection.createIndex(
      {
        nameKey: 1,
        classKey: 1, 
        examTypeKey: 1,
        termKey: 1,
        academicYearKey: 1
      },
      {
        unique: true,
        name: 'unique_student_record_with_year'
      }
    );
    
    console.log('✓ New constraint added successfully!');
    console.log('Students can now have records for the same term/class/exam across different academic years.');
    
    // Test the new constraint
    console.log('\nTesting multi-year constraint...');
    try {
      // Test record for 2024
      const testRecord2024 = new Result({
        name: 'Test Student',
        class: 'Grade 1',
        examType: 'opener',
        term: 'Term 1',
        academicYear: '2024',
        maths: 85
      });
      
      // Test record for 2025 (same student, same details, different year)
      const testRecord2025 = new Result({
        name: 'Test Student',
        class: 'Grade 1', 
        examType: 'opener',
        term: 'Term 1',
        academicYear: '2025',
        maths: 90
      });
      
      await testRecord2024.save();
      console.log('✓ 2024 record saved successfully');
      
      await testRecord2025.save();
      console.log('✓ 2025 record saved successfully (same student, different year)');
      
      // Try to save duplicate for same year (should fail)
      const duplicateRecord = new Result({
        name: 'Test Student',
        class: 'Grade 1',
        examType: 'opener', 
        term: 'Term 1',
        academicYear: '2024', // Same year as first record
        english: 88
      });
      
      await duplicateRecord.save();
      console.log('ERROR: Duplicate for same year was allowed! Constraint may not be working.');
      
    } catch (error) {
      if (error.code === 11000) {
        console.log('✓ Constraint working correctly - duplicate for same year was rejected');
      } else {
        console.log('Unexpected error during test:', error.message);
      }
    }
    
    // Clean up test records
    await Result.deleteMany({ name: 'Test Student' });
    console.log('✓ Test records cleaned up');
    
    console.log('\n=== MULTI-YEAR SUPPORT ENABLED ===');
    console.log('You can now enter:');
    console.log('• Student A, Grade 1, Term 1 Opener for 2024');
    console.log('• Student A, Grade 2, Term 1 Opener for 2025 (student progressed)');
    console.log('• Student A, Grade 1, Term 1 Opener for 2025 (student repeated)');
    
  } catch (error) {
    console.error('Error updating constraint:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
}

// Run the constraint update
if (require.main === module) {
  updateUniqueConstraint().catch(console.error);
}

module.exports = { updateUniqueConstraint };