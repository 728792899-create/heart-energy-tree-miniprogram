const api = require('../../services/api');

const EMPTY_RECAP = {
  headline: '这一周，也值得被温柔记住',
  summaryCopy: '每一次愿意开始，都让我们的日常亮了一点。',
  statusText: '这一周已被好好收藏',
  partnerQuote: '你的每一滴汗水，都会成为我们花园里的养分。',
  nextGoal: '一起完成一次轻松、不赶时间的运动',
  stats: {},
  bestMoment: { title: '一起走过普通的一周', message: '慢慢来，也是一种认真生活。' },
  badges: [],
  redemptions: [],
  encouragements: []
};

function decorateRecap(recap) {
  const source = recap || EMPTY_RECAP;
  const stats = source.stats || {};
  const encouragements = Array.isArray(source.encouragements) ? source.encouragements : [];
  const activeDays = Math.max(0, Math.min(7, Number(stats.approvedDays || 0)));
  return {
    ...EMPTY_RECAP,
    ...source,
    stats,
    bestMoment: { ...EMPTY_RECAP.bestMoment, ...(source.bestMoment || {}) },
    encouragements,
    summaryCopy: source.isEmpty
      ? '这一周没有新的记录，但休息也值得被温柔对待。'
      : `我们一起留下了 ${activeDays} 天运动记录，普通的日子也因此亮了一点。`,
    statusText: source.isEmpty ? '慢慢来，我们一直都在' : '这一周已被好好收藏',
    partnerQuote: encouragements.length
      ? encouragements[0].message
      : EMPTY_RECAP.partnerQuote,
    nextGoal: activeDays >= 5
      ? '保持舒服的节奏，也记得给身体留一点休息'
      : '比这一周多留下一次轻松的运动记录'
  };
}

function buildActivityDots(activityDays = []) {
  const activeIndexes = new Set((Array.isArray(activityDays) ? activityDays : []).map((dateKey) => {
    const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
    return day === 0 ? 6 : day - 1;
  }));
  return ['一', '二', '三', '四', '五', '六', '日'].map((label, index) => ({
    label,
    active: activeIndexes.has(index)
  }));
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    weekOffset: 0,
    canPrevious: true,
    canNext: false,
    recap: EMPTY_RECAP,
    activityDots: buildActivityDots([])
  },

  onLoad(options = {}) {
    const requestedOffset = Number(options.weekOffset || 0);
    const weekOffset = Number.isInteger(requestedOffset)
      ? Math.max(-12, Math.min(0, requestedOffset))
      : 0;
    this.setData({ weekOffset });
    this.load();
  },

  async load() {
    const weekOffset = this.data.weekOffset;
    this.setData({
      loading: true,
      errorMessage: '',
      canPrevious: weekOffset > -12,
      canNext: weekOffset < 0
    });
    try {
      const recap = decorateRecap(await api.queryWeeklyRecap({ weekOffset }));
      this.setData({
        recap,
        activityDots: buildActivityDots(recap.activityDays),
        loading: false
      });
    } catch (error) {
      console.error('[heart-tree] weekly recap load failed', error);
      this.setData({
        loading: false,
        errorMessage: error.message || '回顾暂时没有加载出来'
      });
    }
  },

  showPreviousWeek() {
    if (!this.data.canPrevious || this.data.loading) return;
    this.setData({ weekOffset: this.data.weekOffset - 1 });
    this.load();
  },

  showNextWeek() {
    if (!this.data.canNext || this.data.loading) return;
    this.setData({ weekOffset: this.data.weekOffset + 1 });
    this.load();
  },

  retry() {
    if (!this.data.loading) this.load();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  }
});
