const CHECKIN_STATUS = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const LEDGER_STATUS = {
  EARNED: 'earned',
  WITHDRAW_REQUESTED: 'withdraw_requested',
  PAID_OUT: 'paid_out',
  REDEEMED: 'redeemed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
};

const WITHDRAWAL_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED_WAITING_TRANSFER: 'approved_waiting_transfer',
  PAID: 'paid',
  REJECTED: 'rejected'
};

const REDEMPTION_STATUS = {
  PENDING: 'pending',
  CANCEL_REQUESTED: 'cancel_requested',
  CANCELLED_REFUNDED: 'cancelled_refunded',
  CANCEL_REJECTED: 'cancel_rejected',
  USED: 'used',
  EXPIRED: 'expired'
};

const DEMO_IDS = {
  sponsor: 'user-sponsor',
  participant: 'user-participant',
  relationship: 'rel-main'
};

const DEFAULT_REWARD_RULE = {
  perCheckInCents: 500,
  dailyMaxCents: 500,
  monthlyWishFundCents: 0,
  sunshinePerCheckIn: 12,
  fruitEverySunshine: 36,
  streakBonuses: [
    {
      days: 3,
      bonusCents: 0,
      surpriseTitle: '周末散步券'
    },
    {
      days: 7,
      bonusCents: 500,
      surpriseTitle: '约会基金加码'
    },
    {
      days: 14,
      bonusCents: 1000,
      surpriseTitle: '小礼物心愿果'
    }
  ]
};

const AMOUNT_LIMITS = {
  checkInReward: { min: 100, max: 10000 },
  dailyMax: { min: 100, max: 50000 },
  streakBonus: { min: 0, max: 50000 },
  monthlyWishFund: { min: 0, max: 500000 },
  rewardItem: { min: 100, max: 500000 },
  withdrawal: { min: 100, max: 500000 },
  levelReward: { min: 0, max: 500000 },
  profileEditFee: { min: 200, max: 200 }
};

const PROFILE_EDIT_EXTRA_COST_CENTS = 200;

const DEFAULT_ADVENTURE_LEVELS = [
  {
    id: 'level-1',
    levelId: 1,
    name: '初入森林',
    description: '先从最轻的一小步开始，让身体知道你在照顾它。',
    requiredSteps: 5,
    rewardCents: 500,
    rewardBadgeId: 'first_level',
    mapTone: '#7dbb73',
    sortOrder: 1
  },
  {
    id: 'level-2',
    levelId: 2,
    name: '穿越平原',
    description: '把偶尔运动，慢慢变成生活里温柔的一部分。',
    requiredSteps: 7,
    rewardCents: 800,
    rewardBadgeId: 'steady_walker',
    mapTone: '#f0c86c',
    sortOrder: 2
  },
  {
    id: 'level-3',
    levelId: 3,
    name: '攀登山丘',
    description: '不追求很快，只要一步一步往前就很好。',
    requiredSteps: 9,
    rewardCents: 1000,
    rewardBadgeId: 'hill_climber',
    mapTone: '#e98b70',
    sortOrder: 3
  },
  {
    id: 'level-4',
    levelId: 4,
    name: '渡过湖泊',
    description: '在水光和晚风里，把坚持变成一段可爱的回忆。',
    requiredSteps: 11,
    rewardCents: 1200,
    rewardBadgeId: 'lake_crossing',
    mapTone: '#7db9d8',
    sortOrder: 4
  },
  {
    id: 'level-5',
    levelId: 5,
    name: '登顶山峰',
    description: '不是为了证明什么，是为了看见自己真的走了这么远。',
    requiredSteps: 13,
    rewardCents: 1500,
    rewardBadgeId: 'summit_star',
    mapTone: '#9d8bd8',
    sortOrder: 5
  }
];

const DEFAULT_REWARD_ITEMS = [
  {
    id: 'reward-milk-tea',
    name: '快乐奶茶券',
    description: '运动后的快乐可以很小，但必须认真兑现。',
    priceCents: 1500,
    category: 'food',
    imageTone: '#f7d7c7',
    stock: -1,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'reward-movie-date',
    name: '电影约会券',
    description: '选一部她想看的电影，男朋友负责买票和爆米花。',
    priceCents: 6000,
    category: 'date',
    imageTone: '#cce7f4',
    stock: -1,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'reward-massage',
    name: '认真按摩券',
    description: '兑换后获得一次不敷衍的肩颈按摩服务。',
    priceCents: 3000,
    category: 'emotion',
    imageTone: '#d9efd1',
    stock: -1,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'reward-gift-pick',
    name: '小礼物心愿券',
    description: '攒到以后，挑一件最近真正喜欢的小东西。',
    priceCents: 12000,
    category: 'gift',
    imageTone: '#f8d4df',
    stock: -1,
    isActive: true,
    sortOrder: 4
  }
];

const DEFAULT_BADGES = [
  {
    id: 'first_checkin',
    name: '首次发芽',
    description: '完成第一次运动打卡。',
    iconKey: 'sprout_first',
    iconText: '芽',
    conditionType: 'first_checkin',
    conditionValue: 1,
    isHidden: false
  },
  {
    id: 'streak_3',
    name: '三日小火苗',
    description: '连续 3 天都有审核通过的运动打卡。',
    iconKey: 'spark_3',
    iconText: '3',
    conditionType: 'streak',
    conditionValue: 3,
    isHidden: false
  },
  {
    id: 'streak_7',
    name: '七日约定',
    description: '连续 7 天都有审核通过的运动打卡。',
    iconKey: 'promise_7',
    iconText: '7天',
    conditionType: 'streak',
    conditionValue: 7,
    isHidden: false
  },
  {
    id: 'first_level',
    name: '首关通过',
    description: '通关能量大冒险第一关。',
    iconKey: 'forest_level',
    iconText: '森林',
    conditionType: 'level',
    conditionValue: 1,
    isHidden: false
  },
  {
    id: 'steady_walker',
    name: '平原漫步',
    description: '通关能量大冒险第二关。',
    iconKey: 'level_plain',
    iconText: '平原',
    conditionType: 'level',
    conditionValue: 2,
    isHidden: false
  },
  {
    id: 'hill_climber',
    name: '小山登顶',
    description: '通关能量大冒险第三关。',
    iconKey: 'level_hill',
    iconText: '山丘',
    conditionType: 'level',
    conditionValue: 3,
    isHidden: false
  },
  {
    id: 'lake_crossing',
    name: '湖边晚风',
    description: '通关能量大冒险第四关。',
    iconKey: 'level_lake',
    iconText: '湖',
    conditionType: 'level',
    conditionValue: 4,
    isHidden: false
  },
  {
    id: 'summit_star',
    name: '山顶星光',
    description: '通关能量大冒险最终关。',
    iconKey: 'level_summit',
    iconText: '星',
    conditionType: 'level',
    conditionValue: 5,
    isHidden: false
  },
  {
    id: 'hundred_coins',
    name: '百币达成',
    description: '累计获得 100 能量币。',
    iconKey: 'coin_100',
    iconText: '100',
    conditionType: 'earned_cents',
    conditionValue: 10000,
    isHidden: false
  },
  {
    id: 'coins_300',
    name: '三百颗糖',
    description: '累计获得 300 能量币。',
    iconKey: 'coin_300',
    iconText: '300',
    conditionType: 'earned_cents',
    conditionValue: 30000,
    isHidden: false
  },
  {
    id: 'coins_520',
    name: '520 能量',
    description: '累计获得 520 能量币。',
    iconKey: 'coin_520',
    iconText: '520',
    conditionType: 'earned_cents',
    conditionValue: 52000,
    isHidden: false
  },
  {
    id: 'half_month',
    name: '半月闪闪',
    description: '累计 15 次审核通过的运动打卡。',
    iconKey: 'half_month',
    iconText: '15',
    conditionType: 'approved_count',
    conditionValue: 15,
    isHidden: false
  },
  {
    id: 'monthly_30',
    name: '月度坚持',
    description: '累计 30 次审核通过的运动打卡。',
    iconKey: 'month_30',
    iconText: '30',
    conditionType: 'approved_count',
    conditionValue: 30,
    isHidden: false
  },
  {
    id: 'full_week',
    name: '全勤周',
    description: '自然周内每天都有运动打卡。',
    iconKey: 'week_full',
    iconText: '周',
    conditionType: 'streak',
    conditionValue: 7,
    isHidden: false
  },
  {
    id: 'first_redemption',
    name: '第一次兑换',
    description: '第一次用能量币兑换奖励。',
    iconKey: 'shop_first',
    iconText: '兑',
    conditionType: 'redemption_count',
    conditionValue: 1,
    isHidden: false
  },
  {
    id: 'redemption_collector',
    name: '心愿收藏家',
    description: '累计兑换 5 次奖励。',
    iconKey: 'shop_collector',
    iconText: '5兑',
    conditionType: 'redemption_count',
    conditionValue: 5,
    isHidden: false
  },
  {
    id: 'duration_300',
    name: '300 分钟守护',
    description: '累计记录 300 分钟运动。',
    iconKey: 'duration_300',
    iconText: '300m',
    conditionType: 'duration_minutes',
    conditionValue: 300,
    isHidden: false
  },
  {
    id: 'evening_walk',
    name: '晚风散步',
    description: '在晚上完成一次运动打卡。',
    iconKey: 'evening_walk',
    iconText: '晚',
    conditionType: 'time_hint',
    conditionValue: 18,
    isHidden: false
  },
  {
    id: 'weekend_move',
    name: '周末也动动',
    description: '在周末完成一次运动打卡。',
    iconKey: 'weekend_move',
    iconText: '末',
    conditionType: 'weekday',
    conditionValue: 0,
    isHidden: false
  }
];

module.exports = {
  AMOUNT_LIMITS,
  DEFAULT_ADVENTURE_LEVELS,
  DEFAULT_BADGES,
  CHECKIN_STATUS,
  DEFAULT_REWARD_RULE,
  DEFAULT_REWARD_ITEMS,
  DEMO_IDS,
  LEDGER_STATUS,
  PROFILE_EDIT_EXTRA_COST_CENTS,
  REDEMPTION_STATUS,
  WITHDRAWAL_STATUS
};
