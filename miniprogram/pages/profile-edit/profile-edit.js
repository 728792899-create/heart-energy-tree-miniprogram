const api = require('../../services/api');
const privacy = require('../../services/privacy');
const media = require('../../services/media');

function quotaText(state, role) {
  if (state && state.freeAvailable) return '本月免费次数可用';
  return role === 'participant' ? '额外修改需 2 能量币' : '本月修改次数已用完';
}

Page({
  data: {
    dashboard: {},
    name: '',
    avatarPreview: '',
    avatarFileId: '',
    avatarChanged: false,
    saving: false,
    roleLabel: '',
    roleCaption: '',
    nicknameQuotaText: '',
    avatarQuotaText: '',
    editState: {
      nickname: {},
      avatar: {}
    }
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) return;
      const user = dashboard.currentUser || {};
      const editState = user.profileEditState || await api.queryProfileEditState();
      const currentRole = dashboard.currentRole;
      this.setData({
        dashboard,
        name: user.name || '',
        avatarPreview: media.avatarSource(user),
        avatarFileId: user.avatarFileId || '',
        avatarChanged: false,
        roleLabel: currentRole === 'participant' ? '参与者' : '陪伴者',
        roleCaption: currentRole === 'participant' ? '被温柔陪伴，也认真记录自己的成长' : '发起关系并守护两个人的约定',
        nicknameQuotaText: quotaText(editState.nickname, currentRole),
        avatarQuotaText: quotaText(editState.avatar, currentRole),
        editState
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value });
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail && event.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({
      avatarPreview: avatarUrl,
      avatarChanged: true
    });
  },

  async chooseAvatarImage() {
    if (this.data.saving) return;
    const authorized = await privacy.ensurePhotoPrivacy();
    if (!authorized) return;
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths && res.tempFilePaths[0];
        if (!filePath) return;
        this.setData({
          avatarPreview: filePath,
          avatarChanged: true
        });
      },
      fail: (error) => {
        if (error && !String(error.errMsg || '').includes('cancel')) {
          wx.showToast({ title: '头像选择失败，请再试一次', icon: 'none' });
        }
      }
    });
  },

  cancel() {
    if (this.data.saving) return;
    wx.navigateBack();
  },

  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    let uploadedAvatarFileId = '';
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) return;
      const payload = {
        name: this.data.name
      };
      if (this.data.avatarChanged) {
        uploadedAvatarFileId = await api.uploadAvatarFile({
          relationshipId: dashboard.relationship.id,
          userId: dashboard.currentUser.id,
          filePath: this.data.avatarPreview
        });
        payload.avatarFileId = uploadedAvatarFileId;
      }
      const result = await api.updateProfile(payload);
      uploadedAvatarFileId = '';
      const cost = Number(result.costCents || 0);
      wx.showModal({
        title: cost > 0 ? '资料已更新' : '资料已保存',
        content: cost > 0 ? `本次额外修改消耗 ${result.costText} 能量币。` : '本月免费修改次数已记录。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (error) {
      if (uploadedAvatarFileId) await api.cleanupUploadedFile(uploadedAvatarFileId);
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
