const api = require('../../services/api');
const experience = require('../../services/experience');

Page({
  data: {
    displayName: '',
    inviteToken: '',
    inviteMode: false,
    canCreateSponsor: false,
    relationshipFrozen: false,
    bindingMessage: '',
    inviteShare: null,
    createdInviteReady: false,
    creating: false,
    submitting: false,
    reducedMotion: experience.isReducedMotionEnabled()
  },

  onLoad(options) {
    const inviteToken = String((options && options.inviteToken) || '').trim();
    if (inviteToken) {
      this.setData({
        inviteToken,
        inviteMode: true
      });
    }
  },

  async onShow() {
    this.setData({ reducedMotion: experience.isReducedMotionEnabled() });
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && !dashboard.needsBinding) {
        if (this.data.createdInviteReady && this.data.inviteShare && this.data.inviteShare.path) return;
        wx.switchTab({ url: '/pages/home/home' });
        return;
      }
      this.setData({
        canCreateSponsor: Boolean(dashboard && dashboard.bindingStatus && dashboard.bindingStatus.canCreateSponsor),
        relationshipFrozen: Boolean(dashboard && dashboard.bindingStatus && dashboard.bindingStatus.relationshipFrozen),
        bindingMessage: String((dashboard && dashboard.message) || '')
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  onNameInput(event) {
    this.setData({ displayName: event.detail.value });
  },

  async submit() {
    if (this.data.relationshipFrozen) {
      wx.showToast({ title: '旧关系已冻结，旧邀请不能再使用', icon: 'none' });
      return;
    }
    if (!String(this.data.inviteToken || '').trim()) {
      wx.showToast({ title: '请从另一半分享的邀请卡片进入', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.bindByInvite({
        displayName: this.data.displayName,
        inviteToken: this.data.inviteToken
      });
      experience.playCue('binding');
      wx.showToast({ title: '绑定成功', icon: 'success' });
      wx.switchTab({ url: '/pages/home/home' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async createTree() {
    if (!this.data.canCreateSponsor) {
      wx.showToast({ title: '请从另一半分享的邀请卡片进入', icon: 'none' });
      return;
    }
    this.setData({ creating: true });
    try {
      await api.bindAsSponsor({
        displayName: this.data.displayName
      });
      const inviteShare = await api.queryPartnerInvite();
      experience.playCue('binding');
      this.setData({
        inviteShare,
        createdInviteReady: Boolean(inviteShare && inviteShare.path),
        inviteMode: false,
        inviteToken: '',
        relationshipFrozen: false,
        bindingMessage: '新的固定双人关系已创建，请把邀请卡片分享给另一半'
      });
      wx.showToast({ title: '邀请已准备好', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },

  copyInvitePath() {
    if (!this.data.inviteShare || !this.data.inviteShare.path) {
      wx.showToast({ title: '邀请还没准备好', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.inviteShare.path,
      success: () => {
        wx.showToast({ title: '已复制邀请路径', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    if (this.data.inviteShare && this.data.inviteShare.path) {
      return {
        title: this.data.inviteShare.title || '邀请你加入我们的心动能量树',
        path: this.data.inviteShare.path
      };
    }
    return {
      title: '邀请你加入我们的心动能量树',
      path: '/pages/bind/bind'
    };
  }
});
