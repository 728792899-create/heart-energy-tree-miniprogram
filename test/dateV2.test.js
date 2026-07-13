const assert = require('node:assert/strict');
const test = require('node:test');

const date = require('../miniprogram/utils/date');

test('ISO timestamps are converted to China calendar dates', () => {
  assert.equal(date.todayKey('2026-07-10T15:59:59.000Z'), '2026-07-10');
  assert.equal(date.todayKey('2026-07-10T16:00:00.000Z'), '2026-07-11');
  assert.equal(date.monthKey('2026-07-31T16:00:00.000Z'), '2026-08');
});

test('China date-time parts are independent from the host timezone', () => {
  assert.deepEqual(date.chinaDateTimeParts('2026-07-12T13:05:06.000Z'), {
    year: 2026,
    month: 7,
    day: 12,
    hour: 21,
    minute: 5,
    second: 6
  });
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
