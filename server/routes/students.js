const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/studentController');

// Upsert marks for one student (record must already exist in the roster)
router.post('/upsert', ctrl.upsertMarks);

// Roster management — separate from marks entry
router.post('/roster',                          ctrl.createRosterStudent);
router.post('/roster/bulk',                     ctrl.bulkCreateRosterStudents);
router.post('/roster/promote',                  ctrl.promoteRoster);
router.get('/roster/class/:className',          ctrl.getRosterByClass);
router.patch('/roster/:id/rename',              ctrl.renameRosterStudent);

// Flat-format reads (compatible with existing reports / frontend)
router.get('/',                                   ctrl.getAll);
router.get('/exam/:examType',                     ctrl.getByExamType);
router.get('/class/:className',                   ctrl.getByClass);
router.get('/class/:className/exam/:examType',    ctrl.getByClassAndExamType);

// Raw record access
router.get('/:id',    ctrl.getById);
router.delete('/:id', ctrl.deleteRecord);

module.exports = router;
