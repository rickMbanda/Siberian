const test = require('node:test');
const assert = require('node:assert/strict');
const { ALL_SUBJECTS } = require('../utils/subjectConfig');

test('shared subject list includes Psychomotor', () => {
  assert.ok(ALL_SUBJECTS.includes('Psychomotor'));
});
