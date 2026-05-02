const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, adminOnly, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        assignedClass: user.assignedClass,
        allowedExamType: user.allowedExamType || 'opener'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me - verify token and return current user
router.get('/me', authenticate, async (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    name: req.user.name,
    role: req.user.role,
    assignedClass: req.user.assignedClass,
    allowedExamType: req.user.allowedExamType || 'opener'
  });
});

// POST /api/auth/change-password - any logged-in user can change their own password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin-only user management routes ---

// GET /api/auth/users - list all users
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ role: 1, name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users - create new user
router.post('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { username, password, name, role, assignedClass, allowedExamType } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'Username, password, name, and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ username: username.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = new User({
      username,
      password,
      name,
      role,
      assignedClass: assignedClass || null,
      allowedExamType: allowedExamType || 'opener'
    });
    await user.save();

    res.status(201).json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      assignedClass: user.assignedClass,
      allowedExamType: user.allowedExamType
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/users/:id - update user info
router.put('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, role, assignedClass, allowedExamType } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        name,
        role,
        assignedClass: assignedClass || null,
        allowedExamType: allowedExamType || 'opener'
      },
      { new: true, select: '-password' }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users/:id/reset-password - admin resets another user's password
router.post('/users/:id/reset-password', authenticate, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ message: `Password reset successfully for ${user.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id - delete a user
router.delete('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: `User ${user.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
