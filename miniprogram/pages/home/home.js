const api = require('../../services/api');
const experience = require('../../services/experience');

const QUICK_ENCOURAGEMENTS = [
  { key: 'hug', label: '抱抱她', icon: '♡' },
  { key: 'praise', label: '夸夸她', icon: '✦' },
  { key: 'workout', label: '陪她练', icon: '↗' },
  { key: 'gentle', label: '轻松一点', icon: '☁' },
  { key: 'date', label: '约个小会', icon: '⌁' }
];

async function optionalQuery(label, task, fallback) {
  try {
    return await task();
  } catch (error) {
    console.warn(`[heart-tree] ${label} unavailable`, error);
    return fallback;
  }
}

function normalizeUser(user, fallbackName) {
  return {
    ...(user || {}),
    name: (user && user.name) || fallbackName,
    avatarText: (user && user.avatarText) || fallbackName
  };
}

function treeAsset(level) {
  const safeLevel = Math.max(1, Math.min(5, Number(level || 1)));
  return `/assets/generated/tree-level-${safeLevel}.png`;
}

Page({
  data: {
    currentRole: 'participant',
    currentUser: {},
    relationship: {
      title: '我们的心动能量树',
      balance: {},
      balanceText: {},
      tree: {},
      stats: {},
      adventure: {
        currentLevel: {}
      }
    },
    companionUser: {},
    todaysCheckIn: null,
    pendingCount: 0,
    waitingPayoutCount: 0,
    recentCheckIns: [],
    recentLedgers: [],
    isCloudMode: false,
    companionName: '她',
    treeAsset: '/assets/generated/tree-level-1.png',
    loadingHome: true,
    homeError: '',
    unreadEncouragements: [],
    milestones: [],
    weeklyRecap: null,
    activeCelebration: null,
    shownMilestoneIds: [],
    soundMode: experience.isSoundEnabled() ? 'on' : 'off',
    reducedMotion: experience.isReducedMotionEnabled(),
    acceptingEncouragementId: '',
    acceptingMilestoneId: '',
    sendingEncouragementKey: '',
    quickEncouragements: QUICK_ENCOURAGEMENTS,
    viewNotice: null,
    viewNoticeIds: [],
    viewNoticeExtraCount: 0,
    dismissingViewNotice: false
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loadingHome: true, homeError: '' });
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) return;
      const fallbackName = dashboard.currentRole === 'sponsor' ? '她' : '他';
      const companionUser = normalizeUser(dashboard.companionUser, fallbackName);
      const [unreadEncouragements, milestones, weeklyRecap] = await Promise.all([
        dashboard.currentRole === 'participant'
          ? optionalQuery('encouragements', () => api.queryEncouragements({ unreadOnly: true }), [])
          : Promise.resolve([]),
        optionalQuery('milestones', () => api.queryMilestones({ unseenOnly: true }), []),
        optionalQuery('weekly recap', () => api.queryWeeklyRecap({ weekOffset: -1 }), null)
      ]);
      const nextCelebration = milestones.find((item) => !this.data.shownMilestoneIds.includes(item.id)) || null;
      this.setData({
        ...dashboard,
        companionUser,
        companionName: companionUser.name || fallbackName,
        treeAsset: treeAsset(dashboard.relationship && dashboard.relationship.tree && dashboard.relationship.tree.level),
        isCloudMode: api.isCloudMode(),
        unreadEncouragements: unreadEncouragements.slice(0, 3),
        milestones: milestones.slice(0, 3),
        weeklyRecap,
        activeCelebration: nextCelebration,
        shownMilestoneIds: nextCelebration
          ? Array.from(new Set([...this.data.shownMilestoneIds, nextCelebration.id]))
          : this.data.shownMilestoneIds,
        soundMode: experience.isSoundEnabled() ? 'on' : 'off',
        reducedMotion: experience.isReducedMotionEnabled(),
        loadingHome: false
      });
      if (nextCelebration) experience.playCue(experience.cueForScene(nextCelebration.sceneKey));
      if (dashboard.currentRole === 'participant') {
        this.showViewNotice();
      }
    } catch (error) {
      console.error('[energy-tree] home load failed', error);
      this.setData({
        loadingHome: false,
        homeError: error.message || '首页暂时没有加载出来'
      });
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  retryLoad() {
    if (!this.data.loadingHome) this.load();
  },

  async showViewNotice() {
    try {
      const notices = await api.queryViewNotices({ unreadOnly: true });
      this.setData({
        viewNotice: notices[0] || null,
        viewNoticeIds: notices.map((notice) => notice.id),
        viewNoticeExtraCount: Math.max(0, notices.length - 1)
      });
    } catch (error) {
      console.warn('[energy-tree] view notice failed', error);
    }
  },

  openMessages() {
    wx.switchTab({ url: '/pages/messages/messages' });
  },

  async dismissViewNotice() {
    if (this.data.dismissingViewNotice || !this.data.viewNoticeIds.length) return;
    const noticeIds = this.data.viewNoticeIds.slice();
    this.setData({ dismissingViewNotice: true });
    try {
      await api.markViewNoticesRead({ noticeIds });
      this.setData({ viewNotice: null, viewNoticeIds: [], viewNoticeExtraCount: 0 });
    } catch (error) {
      wx.showToast({ title: error.message || '暂时没有收好这份关心', icon: 'none' });
    } finally {
      this.setData({ dismissingViewNotice: false });
    }
  },

  async onSwitchRole(event) {
    if (api.isCloudMode()) return;
    const role = event.currentTarget.dataset.role;
    await api.switchRole(role);
    this.load();
  },

  async acceptEncouragement(event) {
    const encouragementId = event.currentTarget.dataset.id;
    if (!encouragementId || this.data.acceptingEncouragementId) return;
    this.setData({ acceptingEncouragementId: encouragementId });
    try {
      await api.markEncouragementRead({ encouragementId });
      this.setData({
        unreadEncouragements: this.data.unreadEncouragements.filter((item) => item.id !== encouragementId)
      });
      experience.playCue('encouragement');
      wx.showToast({ title: '抱抱收好啦', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ acceptingEncouragementId: '' });
    }
  },

  async acceptMilestone(event) {
    const milestoneId = (event.detail && event.detail.id)
      || (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id);
    if (!milestoneId || this.data.acceptingMilestoneId) return;
    this.setData({ acceptingMilestoneId: milestoneId });
    try {
      await api.markMilestoneSeen({ milestoneId });
      this.setData({
        milestones: this.data.milestones.filter((item) => item.id !== milestoneId),
        activeCelebration: this.data.activeCelebration && this.data.activeCelebration.id === milestoneId
          ? null
          : this.data.activeCelebration
      });
      wx.showToast({ title: '收藏进我们的故事啦', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ acceptingMilestoneId: '' });
    }
  },

  async closeCelebration() {
    const milestone = this.data.activeCelebration;
    if (!milestone || this.data.acceptingMilestoneId) return;
    this.setData({ activeCelebration: null, acceptingMilestoneId: milestone.id });
    try {
      await api.markMilestoneSeen({ milestoneId: milestone.id });
      this.setData({
        milestones: this.data.milestones.filter((item) => item.id !== milestone.id)
      });
    } catch (error) {
      this.setData({ activeCelebration: milestone });
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ acceptingMilestoneId: '' });
    }
  },

  async sendQuickEncouragement(event) {
    const templateKey = event.currentTarget.dataset.key;
    if (!templateKey || this.data.sendingEncouragementKey) return;
    this.setData({ sendingEncouragementKey: templateKey });
    try {
      await api.sendEncouragement({ templateKey });
      experience.playCue('encouragement');
      wx.showToast({ title: '鼓励已经送到她那里', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ sendingEncouragementKey: '' });
    }
  },

  goCheckIn() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  },

  goWallet() {
    wx.navigateTo({ url: '/pages/wallet/wallet' });
  },

  goReview() {
    wx.navigateTo({ url: '/pages/sponsor-review/sponsor-review' });
  },

  goPayouts() {
    wx.navigateTo({ url: '/pages/sponsor-payouts/sponsor-payouts' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goMap() {
    wx.switchTab({ url: '/pages/adventure-map/adventure-map' });
  },

  goShop() {
    wx.switchTab({ url: '/pages/shop/shop' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  goSponsorCompanion() {
    wx.navigateTo({ url: '/pages/sponsor-companion/sponsor-companion' });
  },

  goWeeklyRecap() {
    wx.navigateTo({ url: '/pages/weekly-recap/weekly-recap' });
  },

  goCompanionHistory() {
    wx.navigateTo({ url: '/pages/sponsor-companion-history/sponsor-companion-history' });
  },

  goCompanionBadges() {
    wx.navigateTo({ url: '/pages/sponsor-companion-badges/sponsor-companion-badges' });
  },

  goCompanionLedgers() {
    wx.navigateTo({ url: '/pages/sponsor-companion-ledgers/sponsor-companion-ledgers' });
  },

  goCompanionRedemptions() {
    wx.navigateTo({ url: '/pages/sponsor-companion-redemptions/sponsor-companion-redemptions' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/sponsor-rules/sponsor-rules' });
  },

  goAdminRewards() {
    wx.navigateTo({ url: '/pages/admin-rewards/admin-rewards' });
  }
});
