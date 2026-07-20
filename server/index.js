require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const resultsRouter     = require('./routes/results');
const authRouter        = require('./routes/auth');
const studentsRouter    = require('./routes/students');
const locksRouter       = require('./routes/locks');
const activeExamRouter  = require('./routes/activeExam');
const targetsRouter     = require('./routes/targets');
const parentPinsRouter  = require('./routes/parentPins');
const { authenticate } = require('./middleware/auth');
const User    = require('./models/User');
const Setting = require('./models/Setting');

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI  = process.env.MONGODB_URI;
const IS_MASTER = process.env.IS_MASTER === 'true';
const ADMIN_PIN = process.env.ADMIN_PIN || '';

if (!mongoURI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

// ── Kill-switch helpers ───────────────────────────────────────────────────────
async function ensureKillSwitch() {
  await Setting.findOneAndUpdate(
    { key: 'appAccess' },
    { $setOnInsert: { key: 'appAccess', value: true } },
    { upsert: true, new: true }
  );
}

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
  }
}

// Periodic kill-switch enforcement — runs only on non-master installations
if (!IS_MASTER) {
  setInterval(async () => {
    try {
      const state = mongoose.connection.readyState; // 0=disconnected,1=connected
      if (state === 1) {
        const doc = await Setting.findOne({ key: 'appAccess' });
        if (doc && doc.value === false) {
          console.log('[system] Access revoked — disconnecting.');
          await mongoose.disconnect();
        }
      } else if (state === 0) {
        // Try to reconnect; the check above will cut it again if still revoked
        try {
          await connectDB();
          const doc = await Setting.findOne({ key: 'appAccess' });
          if (doc && doc.value === false) {
            await mongoose.disconnect();
          }
        } catch (_) { /* DB unreachable or still revoked — stay disconnected */ }
      }
    } catch (err) {
      // Connection already gone — nothing to do
    }
  }, 60000);
}
// ─────────────────────────────────────────────────────────────────────────────

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
    // Ensure kill-switch document exists (default: access granted)
    await ensureKillSwitch();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ── System config routes (hidden admin control) ───────────────────────────────
// GET  /api/system/config  — read kill-switch state  (requires ADMIN_PIN header)
// POST /api/system/config  — write kill-switch state (requires ADMIN_PIN header)
app.get('/api/system/config', async (req, res) => {
  if (!ADMIN_PIN || req.headers['x-admin-pin'] !== ADMIN_PIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const doc = await Setting.findOne({ key: 'appAccess' });
    res.json({ active: doc ? doc.value : true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/system/config', async (req, res) => {
  if (!ADMIN_PIN || req.headers['x-admin-pin'] !== ADMIN_PIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }
  try {
    await Setting.findOneAndUpdate(
      { key: 'appAccess' },
      { value: active },
      { upsert: true }
    );
    res.json({ ok: true, active });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// Auth routes (public)
app.use('/api/auth', authRouter);

// Results routes (protected - require login)
app.use('/api/results',  authenticate, resultsRouter);

// Students routes — new structured upsert endpoints (also protected)
app.use('/api/students', authenticate, studentsRouter);

// Locks routes (protected - require login)
app.use('/api/locks', authenticate, locksRouter);

// Active exam config (protected - admin write, any user read)
app.use('/api/active-exam', authenticate, activeExamRouter);

// Performance targets (protected)
app.use('/api/targets', authenticate, targetsRouter);

// Parent pin slip — public, no auth needed
app.get('/api/parent-pins/slip/:pin', (req, res, next) => {
  req.url = '/slip/' + req.params.pin;
  parentPinsRouter(req, res, next);
});
// Parent pin management — requires authentication
app.use('/api/parent-pins', authenticate, parentPinsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
