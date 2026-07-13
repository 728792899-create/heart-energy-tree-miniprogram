const api = require('../../services/api');
const privacy = require('../../services/privacy');

Page({
  data: {
    dashboard: {},
    todaysCheckIn: null,
    canSubmitToday: true,
    photoPath: '',
    choosingPhoto: false,
    submitting: false,
    pendingRewardYuan: 5,
    note: '',
    durationMinutes: '',
    selectedMood: 'steady',
    moods: [
      { key: 'bright', label: '晴朗', icon: '☼' },
      { key: 'steady', label: '踏实', icon: '芽' },
      { key: 'relaxed', label: '放松', icon: '花' }
    ]
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) return;
      this.setData({
        dashboard,
        todaysCheckIn: dashboard.todaysCheckIn,
        canSubmitToday: dashboard.canSubmitToday,
        pendingRewardYuan: ((dashboard.relationship.rewardRule.perCheckInCents || 500) / 100)
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  async choosePhoto() {
    if (this.data.choosingPhoto || this.data.submitting) return;
    const authorized = await privacy.ensurePhotoPrivacy();
    if (!authorized) return;
    this.setData({ choosingPhoto: true });

    const setPickedPhoto = (filePath) => {
      if (!filePath) {
        wx.showToast({ title: '没有读取到照片路径，请重新选择', icon: 'none' });
        return;
      }
      this.setData({ photoPath: filePath });
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          setPickedPhoto(file && (file.tempFilePath || file.path));
        },
        fail: (error) => {
          if (error && !String(error.errMsg || '').includes('cancel')) {
            wx.showToast({ title: '照片选择失败，请再试一次', icon: 'none' });
          }
        },
        complete: () => {
          this.setData({ choosingPhoto: false });
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        setPickedPhoto(res.tempFilePaths && res.tempFilePaths[0]);
      },
      fail: (error) => {
        if (error && !String(error.errMsg || '').includes('cancel')) {
          wx.showToast({ title: '照片选择失败，请再试一次', icon: 'none' });
        }
      },
      complete: () => {
        this.setData({ choosingPhoto: false });
      }
    });
  },

  selectMood(event) {
    this.setData({ selectedMood: event.currentTarget.dataset.mood });
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value });
  },

  onDurationInput(event) {
    const value = event.currentTarget.dataset.value || event.detail.value;
    this.setData({ durationMinutes: value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.photoPath) {
      wx.showToast({ title: '请先选择一张打卡照片', icon: 'none' });
      return;
    }
    const note = String(this.data.note || '').trim();
    const durationText = String(this.data.durationMinutes || '').trim();
    if (note.length > 200) {
      wx.showToast({ title: '打卡备注最多 200 个字', icon: 'none' });
      return;
    }
    if (durationText && (!/^\d+$/.test(durationText) || Number(durationText) < 1 || Number(durationText) > 600)) {
      wx.showToast({ title: '运动时长请填写 1–600 的整数分钟', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    let uploadedPhotoFileId = '';
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) return;
      uploadedPhotoFileId = await api.uploadCheckInPhoto({
        relationshipId: dashboard.relationship.id,
        filePath: this.data.photoPath
      });
      await api.uploadCheckIn({
        relationshipId: dashboard.relationship.id,
        photoFileId: uploadedPhotoFileId,
        note,
        durationMinutes: durationText
      });
      uploadedPhotoFileId = '';
      wx.showModal({
        title: '已收到打卡',
        content: `先给你一张待确认奖励卡：+${dashboard.relationship.rewardRule.perCheckInCents / 100} 能量币。审核通过后会正式入账。`,
        showCancel: false
      });
      this.setData({
        photoPath: '',
        note: '',
        durationMinutes: '',
    selectedMood: 'steady',
    moods: [
      { key: 'bright', label: '晴朗', icon: '☼' },
      { key: 'steady', label: '踏实', icon: '芽' },
      { key: 'relaxed', label: '放松', icon: '花' }
    ]
      });
      this.load();
    } catch (error) {
      if (uploadedPhotoFileId) await api.cleanupUploadedFile(uploadedPhotoFileId);
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
