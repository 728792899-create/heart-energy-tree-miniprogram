const assert = require('node:assert/strict');
const test = require('node:test');

const date = require('../miniprogram/utils/date');

test('ISO timestamps are converted to China calendar dates', () => {
  assert.equal(date.todayKey('2026-07-10T15:59:59.000Z'), '2026-07-10');
  assert.equal(date.todayKey('2026-07-10T16:00:00.000Z'), '2026-07-11');
  assert.equal(date.monthKey('2026-07-31T16:00:00.000Z'), '2026-08');
});

test('China weeks run from Monday through Sunday', () => {
  assert.deepEqual(date.chinaWeekRange('2026-07-10T16:00:00.000Z'), {
    startDateKey: '2026-07-06',
    endDateKey: '2026-07-12'
  });
  assert.deepEqual(date.chinaWeekRange('2026-07-10T16:00:00.000Z', -1), {
    startDateKey: '2026-06-29',
    endDateKey: '2026-07-05'
  });
});
