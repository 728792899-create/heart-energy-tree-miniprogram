const api = require('../../services/api');
const experience = require('../../services/experience');

Page({
  data: {
    displayName: '',
    inviteToken: '',
    inviteMode: false,
    canCreateSponsor: false,
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
        wx.switchTab({ url: '/pages/home/home' });
        return;
      }
      this.setData({
        canCreateSponsor: Boolean(dashboard && dashboard.bindingStatus && dashboard.bindingStatus.canCreateSponsor)
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  onNameInput(event) {
    this.setData({ displayName: event.detail.value });
  },

  async submit() {
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
    this.setData({ creating: true });
    try {
      await api.bindAsSponsor({
        displayName: this.data.displayName
      });
      experience.playCue('binding');
      wx.showModal({
        title: '能量树创建好了',
        content: '接下来去“我的”页面，把邀请卡片分享给另一半就可以啦。',
        confirmText: '去邀请',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/profile/profile' });
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  }
});
