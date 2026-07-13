const api = require('../../services/api');
const experience = require('../../services/experience');

const ENCOURAGEMENT_TEMPLATES = [
  { key: 'hug', label: '抱抱', message: '先抱抱你，今天的你也值得被温柔接住。' },
  { key: 'praise', label: '夸夸', message: '我看见你的认真啦，你真的很棒。' },
  { key: 'workout', label: '陪练', message: '想动一动的时候叫我，我们一起完成。' },
  { key: 'gentle', label: '轻松一点', message: '不用赶进度，舒服地照顾自己最重要。' },
  { key: 'date', label: '小约会', message: '攒一点小能量，等我们一起去约会。' }
];

Page({
  data: {
    detail: {
      dashboard: {
        relationship: {
          stats: {},
          balanceText: {},
          adventure: {
            currentLevel: {}
          }
        }
      },
      companionUser: {},
      stats: {}
    },
    loading: true,
    errorMessage: '',
    encouragementTemplates: ENCOURAGEMENT_TEMPLATES,
    selectedTemplateKey: 'hug',
    customMessage: '',
    sendingEncouragement: false,
    pendingTaskCount: 0,
    pendingTaskLabel: '暂无待办',
    hasPendingTasks: false
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const detail = await api.queryCompanionDetail({ viewType: 'progress' });
      const dashboard = detail.dashboard || {};
      const pendingTaskCount = Number(dashboard.pendingCount || 0)
        + Number(dashboard.waitingPayoutCount || 0)
        + Number(dashboard.pendingRedemptionCount || 0);
      this.setData({
        detail,
        pendingTaskCount,
        pendingTaskLabel: pendingTaskCount ? `待处理 ${pendingTaskCount} 项` : '今日待办已清空',
        hasPendingTasks: pendingTaskCount > 0,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false, errorMessage: error.message || '陪伴页暂时没有加载出来' });
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  selectEncouragementTemplate(event) {
    if (this.data.sendingEncouragement) return;
    const key = (event.detail && event.detail.key)
      || (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.key);
    if (key) this.setData({ selectedTemplateKey: key });
  },

  onEncouragementInput(event) {
    const value = event.detail && event.detail.value;
    this.setData({ customMessage: String(value || '').slice(0, 60) });
  },

  async sendEncouragement() {
    if (this.data.sendingEncouragement) return;
    this.setData({ sendingEncouragement: true });
    try {
      await api.sendEncouragement({
        templateKey: this.data.selectedTemplateKey,
        customMessage: this.data.customMessage.trim()
      });
      experience.playCue('encouragement');
      this.setData({ customMessage: '' });
      wx.showToast({ title: '这份心意已经送到她那里', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ sendingEncouragement: false });
    }
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/sponsor-companion-history/sponsor-companion-history' });
  },

  goBadges() {
    wx.navigateTo({ url: '/pages/sponsor-companion-badges/sponsor-companion-badges' });
  },

  goLedgers() {
    wx.navigateTo({ url: '/pages/sponsor-companion-ledgers/sponsor-companion-ledgers' });
  },

  goRedemptions() {
    wx.navigateTo({ url: '/pages/sponsor-companion-redemptions/sponsor-companion-redemptions' });
  },

  goReview() {
    wx.navigateTo({ url: '/pages/sponsor-review/sponsor-review' });
  },

  goPayouts() {
    wx.navigateTo({ url: '/pages/sponsor-payouts/sponsor-payouts' });
  },

  goWeeklyRecap() {
    wx.navigateTo({ url: '/pages/weekly-recap/weekly-recap' });
  },

  goRewards() {
    wx.navigateTo({ url: '/pages/admin-rewards/admin-rewards' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/sponsor-rules/sponsor-rules' });
  }
});
