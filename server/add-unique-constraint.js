require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');

// MongoDB connection URI from environment variables
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

async function addUniqueConstraint() {
  try {
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 20000 });
    console.log('Connected to MongoDB');
    
    // First check if index already exists
    const indexes = await Result.collection.indexes();
    const existingIndex = indexes.find(index => 
      index.name === 'unique_student_record' || 
      (index.key && index.key.nameKey && index.key.classKey && index.key.examTypeKey && index.key.termKey)
    );
    
    if (existingIndex) {
      console.log('Unique constraint already exists:', existingIndex.name);
      return;
    }
    
    // Create simple compound unique index (no partial filter to avoid MongoDB compatibility issues)
    console.log('Creating unique compound index...');
    await Result.collection.createIndex(
      {
        nameKey: 1,
        classKey: 1, 
        examTypeKey: 1,
        termKey: 1
      },
      {
        unique: true,
        name: 'unique_student_record'
      }
    );
    
    console.log('✓ Unique constraint added successfully!');
    console.log('This will prevent duplicate student records with the same name, class, exam type, and term.');
    
    // Test the constraint by trying to create a duplicate (should fail)
    console.log('\nTesting constraint...');
    try {
      const testRecord = new Result({
        name: 'Test Student',
        class: 'Grade 1',
        examType: 'opener',
        term: 'Term 1',
        maths: 85
      });
      
      // Save first record
      await testRecord.save();
      console.log('First test record saved successfully');
      
      // Try to save duplicate (should fail)
      const duplicateRecord = new Result({
        name: 'Test Student', // Same normalized key
        class: 'Grade 1',
        examType: 'opener', 
        term: 'Term 1',
        english: 90
      });
      
      await duplicateRecord.save();
      console.log('ERROR: Duplicate was allowed! Constraint may not be working.');
      
    } catch (error) {
      if (error.code === 11000) {
        console.log('✓ Constraint working correctly - duplicate was rejected');
      } else {
        console.log('Unexpected error during test:', error.message);
      }
    }
    
    // Clean up test record
    await Result.deleteOne({ name: 'Test Student' });
    console.log('Test record cleaned up');
    
  } catch (error) {
    console.error('Error adding unique constraint:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
}

// Run the constraint addition
if (require.main === module) {
  addUniqueConstraint().catch(console.error);
}

module.exports = { addUniqueConstraint };