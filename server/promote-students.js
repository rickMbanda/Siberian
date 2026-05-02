const mongoose = require('mongoose');
const Result = require('./models/Result');

// Class progression mapping
const classProgression = {
  'Playgroup': 'PP1',
  'PP1': 'PP2',
  'PP2': 'Grade 1',
  'Grade 1': 'Grade 2',
  'Grade 2': 'Grade 3',
  'Grade 3': 'Grade 4',
  'Grade 4': 'Grade 5',
  'Grade 5': 'Grade 6',
  'Grade 6': 'Grade 7',
  'Grade 7': 'Grade 8',
  'Grade 8': 'Grade 9',
  'Grade 9': null
};

// Connect to MongoDB with timeout
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('MongoDB connected for student promotion');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// Get unique students from a specific academic year using distinct
const getStudentsByYear = async (academicYear) => {
  console.log(`   Fetching students from ${academicYear}...`);
  
  // Get all results for the year
  const results = await Result.find(
    { academicYear: academicYear },
    { name: 1, class: 1, nameKey: 1 }
  ).lean();
  
  // Deduplicate by name+class
  const studentMap = new Map();
  for (const r of results) {
    const key = `${r.name}|${r.class}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, {
        name: r.name,
        class: r.class,
        nameKey: r.nameKey || r.name.trim().toLowerCase().replace(/\s+/g, ' ')
      });
    }
  }
  
  const students = Array.from(studentMap.values());
  console.log(`   Found ${students.length} unique students`);
  return students;
};

// Preview promotion
const previewPromotion = async (sourceYear, targetYear) => {
  console.log(`\n📋 PROMOTION PREVIEW: ${sourceYear} → ${targetYear}`);
  console.log('='.repeat(60));
  
  const students = await getStudentsByYear(sourceYear);
  
  if (students.length === 0) {
    console.log(`No students found for academic year ${sourceYear}`);
    return { toPromote: [], toGraduate: [], alreadyExists: [] };
  }
  
  const toPromote = [];
  const toGraduate = [];
  
  for (const student of students) {
    const nextClass = classProgression[student.class];
    
    if (nextClass === null) {
      toGraduate.push(student);
    } else if (nextClass) {
      toPromote.push({ ...student, nextClass });
    }
  }
  
  // Display graduating students
  console.log('\n🎓 GRADUATING (Grade 9 → Completed):');
  if (toGraduate.length === 0) {
    console.log('   No students graduating');
  } else {
    toGraduate.forEach(s => console.log(`   - ${s.name}`));
  }
  
  // Display students to promote by class transition
  console.log('\n⬆️  TO BE PROMOTED:');
  const promoteByClass = {};
  toPromote.forEach(s => {
    const key = `${s.class} → ${s.nextClass}`;
    if (!promoteByClass[key]) promoteByClass[key] = [];
    promoteByClass[key].push(s.name);
  });
  
  if (Object.keys(promoteByClass).length === 0) {
    console.log('   No students to promote');
  } else {
    for (const [transition, names] of Object.entries(promoteByClass)) {
      console.log(`\n   ${transition}:`);
      names.forEach(name => console.log(`      - ${name}`));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 SUMMARY:`);
  console.log(`   - Students to promote: ${toPromote.length}`);
  console.log(`   - Students graduating: ${toGraduate.length}`);
  console.log('='.repeat(60));
  
  return { toPromote, toGraduate };
};

// Execute promotion
const executePromotion = async (sourceYear, targetYear) => {
  console.log(`\n🚀 EXECUTING PROMOTION: ${sourceYear} → ${targetYear}`);
  console.log('='.repeat(60));
  
  const { toPromote, toGraduate } = await previewPromotion(sourceYear, targetYear);
  
  if (toPromote.length === 0) {
    console.log('\n✅ No students need to be promoted. All done!');
    return;
  }
  
  console.log(`\n⏳ Creating records for ${toPromote.length} students...`);
  
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const student of toPromote) {
    try {
      // Check if the specific opener/Term 1 seed record already exists
      const exists = await Result.findOne({
        nameKey: student.nameKey,
        classKey: student.nextClass.trim().toLowerCase().replace(/\s+/g, ' '),
        examTypeKey: 'opener',
        termKey: 'term 1',
        academicYearKey: targetYear
      });
      
      if (exists) {
        console.log(`   ⚠ ${student.name}: Already in ${student.nextClass} (skipped)`);
        skippedCount++;
        continue;
      }
      
      // Create seed record
      const newRecord = new Result({
        name: student.name,
        nameKey: student.nameKey,
        class: student.nextClass,
        classKey: student.nextClass.trim().toLowerCase().replace(/\s+/g, ' '),
        examType: 'opener',
        examTypeKey: 'opener',
        term: 'Term 1',
        termKey: 'term 1',
        academicYear: targetYear,
        academicYearKey: targetYear,
        examStatus: 'incomplete',
        mean: 0,
        rubric: ''
      });
      
      await newRecord.save();
      successCount++;
      console.log(`   ✓ ${student.name}: ${student.class} → ${student.nextClass}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`   ⚠ ${student.name}: Duplicate (skipped)`);
        skippedCount++;
      } else {
        console.log(`   ✗ ${student.name}: Error - ${err.message}`);
        errorCount++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 PROMOTION COMPLETE!');
  console.log(`   - Successfully promoted: ${successCount} students`);
  console.log(`   - Graduated: ${toGraduate.length} students`);
  console.log(`   - Skipped (already exist): ${skippedCount}`);
  if (errorCount > 0) console.log(`   - Errors: ${errorCount}`);
  console.log('='.repeat(60));
};

// Main function
const main = async () => {
  const args = process.argv.slice(2);
  const mode = args[0] || 'preview';
  const sourceYear = args[1] || '2025';
  const targetYear = args[2] || '2026';
  
  console.log('\n🎓 SPRING VALLEY STUDENT PROMOTION SYSTEM');
  console.log('=========================================');
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`From: Academic Year ${sourceYear}`);
  console.log(`To: Academic Year ${targetYear}`);
  
  await connectDB();
  
  if (mode === 'execute') {
    await executePromotion(sourceYear, targetYear);
  } else {
    await previewPromotion(sourceYear, targetYear);
    console.log('\n💡 To execute the promotion, run:');
    console.log(`   node promote-students.js execute ${sourceYear} ${targetYear}`);
  }
  
  await mongoose.connection.close();
  console.log('\n🔌 Database connection closed.');
};

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});