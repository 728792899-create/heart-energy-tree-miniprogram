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

function showRelationshipWarning(options) {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '暂不操作',
      confirmColor: '#963F3F',
      ...options,
      success: (result) => resolve(Boolean(result && result.confirm)),
      fail: () => resolve(false)
    });
  });
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {
        balanceText: {},
        stats: {},
        equippedBadges: [],
        unbindStatus: {
          state: 'none',
          canCancel: false,
          canConfirm: false
        }
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
    unbindSubmitting: false,
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
      const showInvitePartner = isCloudMode && dashboard.currentRole === 'sponsor' && !dashboard.relationship.participantBound;
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

  async requestRelationshipUnbind() {
    if (this.data.unbindSubmitting) return;
    const firstConfirmed = await showRelationshipWarning({
      title: '解除关系前请确认',
      content: '提交后会等待另一方确认；在对方确认前，当前关系和正常功能不会改变。已有账本、信笺、照片和审计不会自动删除。',
      confirmText: '我已了解'
    });
    if (!firstConfirmed) return;
    const secondConfirmed = await showRelationshipWarning({
      title: '第二次警告',
      content: '这不是单方退出：只有另一方也完成两次确认后，双方才会失去旧关系访问权。旧关系将被冻结且不能重新绑定。',
      confirmText: '继续发起'
    });
    if (!secondConfirmed) return;

    this.setData({ unbindSubmitting: true });
    try {
      await api.requestRelationshipUnbind({
        confirmed: true,
        confirmedTwice: true
      });
      wx.showToast({ title: '已等待对方确认', icon: 'none' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '解除申请提交失败', icon: 'none' });
    } finally {
      this.setData({ unbindSubmitting: false });
    }
  },

  async cancelRelationshipUnbind() {
    if (this.data.unbindSubmitting) return;
    const confirmed = await showRelationshipWarning({
      title: '撤回解除申请？',
      content: '撤回后会恢复关系内的正常操作；之后仍可重新发起。',
      confirmText: '确认撤回'
    });
    if (!confirmed) return;

    this.setData({ unbindSubmitting: true });
    try {
      await api.cancelRelationshipUnbind({});
      wx.showToast({ title: '解除申请已撤回', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || '撤回失败', icon: 'none' });
    } finally {
      this.setData({ unbindSubmitting: false });
    }
  },

  async confirmRelationshipUnbind() {
    if (this.data.unbindSubmitting) return;
    const firstConfirmed = await showRelationshipWarning({
      title: '对方申请解除关系',
      content: '确认后，双方会失去旧关系的业务与信笺访问权。历史数据会冻结保留，不会自动删除，也不会自动触发任何支付或转账。',
      confirmText: '我已了解'
    });
    if (!firstConfirmed) return;
    const secondConfirmed = await showRelationshipWarning({
      title: '最后一次确认',
      content: '解除生效后旧邀请立即作废，旧关系不能重新绑定。如需新关系，必须由云环境所有者独立初始化。确定继续吗？',
      confirmText: '确认解除'
    });
    if (!secondConfirmed) return;

    const app = getApp();
    if (app && typeof app.closeMessageUnreadWatch === 'function') app.closeMessageUnreadWatch();
    this.setData({ unbindSubmitting: true });
    try {
      await api.confirmRelationshipUnbind({
        confirmed: true,
        confirmedTwice: true
      });
      if (wx.removeTabBarBadge) wx.removeTabBarBadge({ index: 4 });
      wx.reLaunch({ url: '/pages/bind/bind' });
    } catch (error) {
      if (app && typeof app.startMessageUnreadWatch === 'function') app.startMessageUnreadWatch();
      wx.showToast({ title: error.message || '解除确认失败', icon: 'none' });
      this.setData({ unbindSubmitting: false });
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
