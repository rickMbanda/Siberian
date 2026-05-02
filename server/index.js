const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const resultsRouter  = require('./routes/results');
const authRouter     = require('./routes/auth');
const studentsRouter = require('./routes/students');
const locksRouter    = require('./routes/locks');
const { authenticate } = require('./middleware/auth');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI ='mongodb+srv://mbandaderrick309:Quicksilver20088@cluster0.q0tykxp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected!');
    // Seed admin account if no users exist
    const count = await User.countDocuments();
    if (count === 0) {
      const admin = new User({
        username: 'admin',
        password: 'Firefly-2.0@f1r3w@11',
        name: 'Administrator',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin account created (username: admin)');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Auth routes (public)
app.use('/api/auth', authRouter);

// Results routes (protected - require login)
app.use('/api/results',  authenticate, resultsRouter);

// Students routes — new structured upsert endpoints (also protected)
app.use('/api/students', authenticate, studentsRouter);

// Locks routes (protected - require login)
app.use('/api/locks', authenticate, locksRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
