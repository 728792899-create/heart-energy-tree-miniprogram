const { DEFAULT_ADVENTURE_LEVELS, DEFAULT_REWARD_RULE } = require('./cloudRuntimeModels');
const { addDays } = require('./cloudRuntimeDate');

const LEVELS = [
  { level: 1, title: '发芽', min: 0, next: 30 },
  { level: 2, title: '舒展', min: 30, next: 75 },
  { level: 3, title: '枝叶', min: 75, next: 140 },
  { level: 4, title: '开花', min: 140, next: 230 },
  { level: 5, title: '结果', min: 230, next: 360 },
  { level: 6, title: '小森林', min: 360, next: null }
];

const ENCOURAGEMENT_CARDS = [
  {
    title: '认真照顾自己卡',
    message: '今天不是为了变成别人，是为了把自己照顾得更好。'
  },
  {
    title: '柔软坚持卡',
    message: '你愿意开始，就已经很厉害了。慢一点也完全可以。'
  },
  {
    title: '能量回信卡',
    message: '这次打卡我收到了，也把一点点喜欢存进树里了。'
  },
  {
    title: '小胜利卡',
    message: '不用追求完美，今天完成一次就值得被好好夸。'
  }
];

const SURPRISE_CARDS = [
  {
    type: 'praise',
    title: '夸夸卡',
    message: '你的努力我真的有认真看见。'
  },
  {
    type: 'date',
    title: '周末散步券',
    message: '挑一个舒服的晚上，我们一起散散步。'
  },
  {
    type: 'letter',
    title: '情话卡',
    message: '你慢慢来，我一直在。'
  },
  {
    type: 'service',
    title: '认真按摩券',
    message: '运动完的放松也要有仪式感。'
  }
];

function moneyText(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function normalizeRule(rule) {
  return {
    ...DEFAULT_REWARD_RULE,
    ...(rule || {}),
    streakBonuses: (rule && rule.streakBonuses) || DEFAULT_REWARD_RULE.streakBonuses
  };
}

function calculateStreak(approvedDateKeys, today) {
  const dates = Array.from(new Set(approvedDateKeys || [])).sort();
  let streak = dates.includes(today) ? 1 : 0;
  if (!streak) return 0;

  let cursor = today;
  while (dates.includes(addDays(cursor, -1))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function calculateStreakSegment(approvedDateKeys, dateKey) {
  const dates = Array.from(new Set(approvedDateKeys || [])).sort();
  if (!dates.includes(dateKey)) return 0;
  let streak = 1;
  let cursor = dateKey;
  while (dates.includes(addDays(cursor, -1))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  cursor = dateKey;
  while (dates.includes(addDays(cursor, 1))) {
    streak += 1;
    cursor = addDays(cursor, 1);
  }
  return streak;
}

function resolveStreakBonus(rule, streak) {
  const bonuses = normalizeRule(rule).streakBonuses || [];
  return bonuses.find((item) => Number(item.days) === Number(streak)) || null;
}

function getTreeLevel(sunshine) {
  const total = Number(sunshine || 0);
  const current = [...LEVELS].reverse().find((item) => total >= item.min) || LEVELS[0];
  if (!current.next) {
    return {
      ...current,
      progressPercent: 100,
      nextSunshine: null
    };
  }
  const progress = ((total - current.min) / (current.next - current.min)) * 100;
  return {
    ...current,
    progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
    nextSunshine: current.next
  };
}

function pickEncouragementCard(streak, totalApproved) {
  const index = Math.abs((Number(streak || 0) + Number(totalApproved || 0)) % ENCOURAGEMENT_CARDS.length);
  return ENCOURAGEMENT_CARDS[index];
}

function pickSurpriseCard(streak, totalApproved) {
  if (Number(totalApproved || 0) <= 0) return null;
  if (Number(streak || 0) % 3 !== 0 && Number(totalApproved || 0) % 5 !== 0) return null;
  const index = Math.abs((Number(streak || 0) + Number(totalApproved || 0)) % SURPRISE_CARDS.length);
  return SURPRISE_CARDS[index];
}

function getSortedAdventureLevels(levels) {
  return (levels && levels.length ? levels : DEFAULT_ADVENTURE_LEVELS)
    .slice()
    .sort((left, right) => Number(left.sortOrder || left.levelId) - Number(right.sortOrder || right.levelId));
}

function getCurrentAdventureLevel(levels, levelId) {
  const sorted = getSortedAdventureLevels(levels);
  return sorted.find((item) => item.id === levelId) || sorted[0];
}

function getNextAdventureLevel(levels, currentId) {
  const sorted = getSortedAdventureLevels(levels);
  const index = sorted.findIndex((item) => item.id === currentId);
  if (index < 0) return sorted[0];
  return sorted[index + 1] || null;
}

function decorateAdventure(adventure, levels) {
  const current = getCurrentAdventureLevel(levels, adventure.currentLevelId);
  const progress = Number(adventure.levelProgress || 0);
  const required = Number(current.requiredSteps || 1);
  const percent = Math.max(0, Math.min(100, Math.round((progress / required) * 100)));
  return {
    ...adventure,
    currentLevel: current,
    progressPercent: percent,
    stepsRemaining: Math.max(0, required - progress)
  };
}

function evaluateApproval(input) {
  const rule = normalizeRule(input.rule);
  const today = input.todayKey;
  const approvedDatesWithToday = Array.from(new Set([...(input.approvedDateKeys || []), today]));
  const streak = calculateStreakSegment(approvedDatesWithToday, today);
  const streakBonus = resolveStreakBonus(rule, streak);
  let remainingDailyCents = Math.max(0, Number(rule.dailyMaxCents || 0) - Number(input.todayEarnedCents || 0));
  const configuredBaseCents = Math.max(0, Number(rule.perCheckInCents || 0));
  const configuredBonusCents = Math.max(0, Number((streakBonus && streakBonus.bonusCents) || 0));
  const configuredLevelRewardCents = Math.max(0, Number(input.mapRewardCents || 0));
  const baseCents = Math.min(configuredBaseCents, remainingDailyCents);
  remainingDailyCents -= baseCents;
  const bonusCents = Math.min(configuredBonusCents, remainingDailyCents);
  remainingDailyCents -= bonusCents;
  const levelRewardCents = Math.min(configuredLevelRewardCents, remainingDailyCents);
  const cashOverflowCents = (configuredBaseCents - baseCents)
    + (configuredBonusCents - bonusCents)
    + (configuredLevelRewardCents - levelRewardCents);
  const overflowSunshine = cashOverflowCents > 0 ? 12 : 0;
  const sunshine = Number(rule.sunshinePerCheckIn || 0) + (streakBonus ? 6 : 0) + overflowSunshine;
  const fruitDelta = Math.floor((Number(input.currentSunshine || 0) + sunshine) / Number(rule.fruitEverySunshine || 36)) - Math.floor(Number(input.currentSunshine || 0) / Number(rule.fruitEverySunshine || 36));
  const totalApproved = approvedDatesWithToday.length;

  return {
    baseCents,
    bonusCents,
    levelRewardCents,
    configuredBaseCents,
    configuredBonusCents,
    configuredLevelRewardCents,
    cashOverflowCents,
    overflowSunshine,
    totalCents: baseCents + bonusCents + levelRewardCents,
    sunshine,
    fruitDelta: Math.max(0, fruitDelta),
    streak,
    streakBonus,
    card: pickEncouragementCard(streak, totalApproved)
  };
}

module.exports = {
  ENCOURAGEMENT_CARDS,
  LEVELS,
  SURPRISE_CARDS,
  calculateStreak,
  calculateStreakSegment,
  decorateAdventure,
  evaluateApproval,
  getCurrentAdventureLevel,
  getNextAdventureLevel,
  getSortedAdventureLevels,
  getTreeLevel,
  moneyText,
  normalizeRule,
  pickEncouragementCard,
  pickSurpriseCard,
  resolveStreakBonus
};
