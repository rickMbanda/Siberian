const mongoose = require('mongoose');
const StudentRecord = require('./models/StudentRecord');
const Result        = require('./models/Result');

const mongoURI = 'mongodb+srv://mbandaderrick309:Quicksilver20088@cluster0.q0tykxp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

(async () => {
  try {
    await mongoose.connect(mongoURI);
    const recordRes = await StudentRecord.deleteMany({});
    const resultRes = await Result.deleteMany({});
    console.log(`Deleted ${recordRes.deletedCount} StudentRecord(s)`);
    console.log(`Deleted ${resultRes.deletedCount} Result(s)`);
    process.exit(0);
  } catch (err) {
    console.error('Wipe failed:', err);
    process.exit(1);
  }
})();
