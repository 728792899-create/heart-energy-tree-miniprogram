const CHINA_OFFSET_MINUTES = 8 * 60;
const CHINA_OFFSET_MS = CHINA_OFFSET_MINUTES * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseDateKey(value) {
  const match = DATE_KEY_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, timestamp };
}

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const dateKey = parseDateKey(value);
    if (dateKey) return dateKey.timestamp - CHINA_OFFSET_MS;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return Date.now();
}

function chinaParts(value) {
  const { year, month, day } = chinaDateTimeParts(value);
  return { year, month, day };
}

function chinaDateTimeParts(value) {
  const shifted = new Date(toTimestamp(value) + CHINA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function toDate(value) {
  return new Date(toTimestamp(value));
}

function todayKey(value) {
  const parts = chinaParts(value === undefined ? Date.now() : value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function addDays(dateKey, days) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new Error('日期格式必须为 YYYY-MM-DD');
  const next = new Date(parsed.timestamp + Number(days || 0) * 86400000);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function differenceInCalendarDays(leftKey, rightKey) {
  const left = parseDateKey(leftKey);
  const right = parseDateKey(rightKey);
  if (!left || !right) throw new Error('日期格式必须为 YYYY-MM-DD');
  return Math.round((right.timestamp - left.timestamp) / 86400000);
}

function monthKey(value) {
  const parts = chinaParts(value === undefined ? Date.now() : value);
  return `${parts.year}-${pad(parts.month)}`;
}

function displayDate(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';
  return `${parsed.month}月${parsed.day}日`;
}

function chinaWeekRange(value, weekOffset = 0) {
  const anchor = todayKey(value === undefined ? Date.now() : value);
  const parsed = parseDateKey(anchor);
  const dayOfWeek = new Date(parsed.timestamp).getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startDateKey = addDays(anchor, -daysSinceMonday + Number(weekOffset || 0) * 7);
  return {
    startDateKey,
    endDateKey: addDays(startDateKey, 6)
  };
}

module.exports = {
  CHINA_OFFSET_MINUTES,
  addDays,
  chinaDateTimeParts,
  chinaWeekRange,
  differenceInCalendarDays,
  displayDate,
  monthKey,
  parseDateKey,
  todayKey,
  toDate,
  toTimestamp
};
