const api = require('../../services/api');
const experience = require('../../services/experience');
const media = require('../../services/media');

function normalizeUser(user, fallbackName) {
  return {
    ...(user || {}),
    name: (user && user.name) || fallbackName,
    avatarText: (user && user.avatarText) || fallbackName,
    avatarSrc: media.avatarSource(user)
  };
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {
        balanceText: {},
        stats: {},
        equippedBadges: []
      },
      currentUser: {},
      companionUser: {}
    },
    badges: [],
    calendar: {
      dates: []
    },
    dayCells: [],
    currentRoleText: '打卡者',
    companionName: '她',
    inviteShare: null,
    isCloudMode: false,
    showInvitePartner: false,
    isSoundEnabled: experience.isSoundEnabled(),
    reducedMotion: experience.isReducedMotionEnabled()
  },

  onShow() {
    this.setData({
      isSoundEnabled: experience.isSoundEnabled(),
      reducedMotion: experience.isReducedMotionEnabled()
    });
    this.load();
  },

  onSoundToggle(event) {
    const isSoundEnabled = experience.setSoundEnabled(Boolean(event.detail.value));
    this.setData({ isSoundEnabled });
    if (isSoundEnabled) experience.playCue('binding');
  },

  onReducedMotionToggle(event) {
    const reducedMotion = experience.setReducedMotionEnabled(Boolean(event.detail.value));
    this.setData({ reducedMotion });
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) {
        this.setData({ loading: false });
        return;
      }
      const calendar = await api.queryCalendarStats();
      const statusByDay = {};
      calendar.dates.forEach((item) => {
        statusByDay[item.day] = item.status;
      });
      const dayCells = Array.from({ length: calendar.daysInMonth }).map((_, index) => {
        const day = index + 1;
        return {
          day,
          status: statusByDay[day] || ''
        };
      });
      const isCloudMode = api.isCloudMode();
      const showInvitePartner = isCloudMode && dashboard.currentRole === 'sponsor' && !dashboard.relationship.participantOpenid;
      const inviteShare = showInvitePartner ? await api.queryPartnerInvite() : null;
      const companionFallback = dashboard.currentRole === 'sponsor' ? '她' : '他';
      const companionUser = normalizeUser(dashboard.companionUser, companionFallback);
      this.setData({
        dashboard: {
          ...dashboard,
          currentUser: normalizeUser(dashboard.currentUser, '我'),
          companionUser
        },
        badges: await api.queryBadges(),
        calendar,
        dayCells,
        currentRoleText: dashboard.currentRole === 'sponsor' ? '男友端' : '女友端',
        companionName: companionUser.name || companionFallback,
        inviteShare,
        isCloudMode,
        showInvitePartner,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '情侣护照暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  async onSwitchRole(event) {
    if (api.isCloudMode()) return;
    await api.switchRole(event.currentTarget.dataset.role);
    this.load();
  },

  goProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  async toggleBadge(event) {
    if (this.data.dashboard.currentRole !== 'participant') return;
    const badgeId = event.currentTarget.dataset.id;
    const badge = this.data.badges.find((item) => item.id === badgeId);
    if (!badge || !badge.unlocked) {
      wx.showToast({ title: '先解锁这个成就再佩戴', icon: 'none' });
      return;
    }
    const current = this.data.badges.filter((item) => item.equipped).map((item) => item.id);
    const next = current.includes(badgeId)
      ? current.filter((id) => id !== badgeId)
      : [...current, badgeId];
    if (next.length > 3) {
      wx.showToast({ title: '最多佩戴 3 个成就', icon: 'none' });
      return;
    }
    try {
      const badges = await api.equipBadges({
        relationshipId: this.data.dashboard.relationship.id,
        badgeIds: next
      });
      wx.showToast({ title: '成就佩戴已更新', icon: 'success' });
      this.setData({ badges });
      this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  enableViewNoticeSubscription() {
    const templateId = api.config.subscriptionTemplates && api.config.subscriptionTemplates.companionView;
    if (!templateId) {
      Promise.resolve(api.saveSubscriptionGrant({
        type: 'companion_view',
        templateId: '',
        status: 'template_missing'
      })).then(() => {
        wx.showToast({ title: '站内提醒已开启', icon: 'success' });
      }).catch((error) => {
        wx.showToast({ title: error.message, icon: 'none' });
      });
      return;
    }
    if (!wx.requestSubscribeMessage) {
      wx.showToast({ title: '当前微信版本不支持订阅消息', icon: 'none' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: async (res) => {
        const status = res[templateId] === 'accept' ? 'accepted' : 'rejected';
        await api.saveSubscriptionGrant({
          type: 'companion_view',
          templateId,
          status
        });
        wx.showToast({ title: status === 'accepted' ? '提醒已开启' : '已保留站内提醒', icon: 'none' });
      },
      fail: async () => {
        await api.saveSubscriptionGrant({
          type: 'companion_view',
          templateId,
          status: 'failed'
        });
        wx.showToast({ title: '已保留站内提醒', icon: 'none' });
      }
    });
  },

  goWallet() {
    wx.navigateTo({ url: '/pages/wallet/wallet' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goRedemptions() {
    wx.navigateTo({ url: '/pages/redemptions/redemptions' });
  },

  goSponsorCompanion() {
    wx.navigateTo({ url: '/pages/sponsor-companion/sponsor-companion' });
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

  goReview() {
    wx.navigateTo({ url: '/pages/sponsor-review/sponsor-review' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/sponsor-rules/sponsor-rules' });
  },

  goPayouts() {
    wx.navigateTo({ url: '/pages/sponsor-payouts/sponsor-payouts' });
  },

  goAdminRewards() {
    wx.navigateTo({ url: '/pages/admin-rewards/admin-rewards' });
  },

  copyInvitePath() {
    if (!this.data.inviteShare || !this.data.inviteShare.path) {
      wx.showToast({ title: '邀请还没准备好', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.inviteShare.path,
      success: () => {
        wx.showToast({ title: '已复制测试路径', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    if (this.data.inviteShare && this.data.inviteShare.path) {
      return {
        title: this.data.inviteShare.title || '邀请你加入我们的今天动动鸭',
        path: this.data.inviteShare.path
      };
    }
    return {
      title: '今天也一起给能量树浇点阳光吧',
      path: '/pages/home/home'
    };
  }
});
