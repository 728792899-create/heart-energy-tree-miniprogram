const api = require('../../services/api');
const experience = require('../../services/experience');

const STATUS_TEXT = {
  pending: '待使用',
  cancel_requested: '申请取消中',
  cancelled_refunded: '已取消退款',
  cancel_rejected: '取消被拒绝',
  used: '已核销',
  expired: '已过期'
};

const STATUS_TONE = {
  pending: 'active',
  cancel_requested: 'warning',
  cancelled_refunded: 'muted',
  cancel_rejected: 'warning',
  used: 'success',
  expired: 'muted'
};

const FALLBACK_REWARD_IMAGES = {
  'reward-massage': '/assets/stitch-original/reward-massage.jpg',
  food: '/assets/generated/shop-drink.jpg',
  date: '/assets/generated/shop-date.jpg',
  gift: '/assets/generated/shop-gift.jpg',
  emotion: '/assets/generated/shop-emotion.jpg'
};

function formatRedeemedDate(value) {
  if (!value) return '日期待补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}

function decorateRedemption(item) {
  return {
    ...item,
    displayImageSrc: item.imageSrc
      || FALLBACK_REWARD_IMAGES[item.rewardId]
      || FALLBACK_REWARD_IMAGES[item.category]
      || FALLBACK_REWARD_IMAGES.emotion,
    statusText: STATUS_TEXT[item.status] || item.status,
    statusTone: STATUS_TONE[item.status] || 'muted',
    redeemedDateText: formatRedeemedDate(item.redeemedAt)
  };
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {},
    redemptions: [],
    pendingCount: 0,
    completedCount: 0,
    noteMap: {},
    processingRedemptionId: '',
    processingAction: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) {
        this.setData({ loading: false });
        return;
      }
      const redemptions = (await api.queryRedemptions()).map(decorateRedemption);
      const pendingCount = redemptions.filter((item) => (
        item.status === 'pending'
        || item.status === 'cancel_requested'
        || item.status === 'cancel_rejected'
      )).length;
      this.setData({
        dashboard,
        redemptions,
        pendingCount,
        completedCount: redemptions.length - pendingCount,
        noteMap: {},
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '兑换记录暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  goShop() {
    wx.switchTab({ url: '/pages/shop/shop' });
  },

  onNoteInput(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ [`noteMap.${id}`]: event.detail.value });
  },

  verify(event) {
    if (this.data.processingRedemptionId) return;
    const id = event.currentTarget.dataset.id;
    const note = this.data.noteMap[id];
    this.setData({ processingRedemptionId: id, processingAction: 'verify' });
    wx.showModal({
      title: '确认核销兑换券',
      content: '确认前请先确保这个奖励已经在线下兑现。',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingRedemptionId: '', processingAction: '' });
          return;
        }
        try {
          await api.verifyRedemption({
            redemptionId: id,
            note,
            confirmed: true
          });
          experience.playCue('fulfillment');
          wx.showToast({ title: '已核销', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingRedemptionId: '', processingAction: '' });
        }
      },
      fail: () => {
        this.setData({ processingRedemptionId: '', processingAction: '' });
      }
    });
  },

  async requestCancel(event) {
    if (this.data.processingRedemptionId) return;
    const id = event.currentTarget.dataset.id;
    this.setData({ processingRedemptionId: id, processingAction: 'request_cancel' });
    try {
      await api.requestCancelRedemption({
        redemptionId: id,
        reason: this.data.noteMap[id]
      });
      wx.showToast({ title: '已申请取消', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ processingRedemptionId: '', processingAction: '' });
    }
  },

  approveCancel(event) {
    if (this.data.processingRedemptionId) return;
    const id = event.currentTarget.dataset.id;
    const note = this.data.noteMap[id];
    this.setData({ processingRedemptionId: id, processingAction: 'approve_cancel' });
    wx.showModal({
      title: '确认取消并退款',
      content: '确认后会把兑换消耗的能量币退回余额，并恢复有限库存。',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingRedemptionId: '', processingAction: '' });
          return;
        }
        try {
          await api.processCancelRedemption({
            redemptionId: id,
            action: 'approve',
            note,
            confirmed: true
          });
          wx.showToast({ title: '已退款', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingRedemptionId: '', processingAction: '' });
        }
      },
      fail: () => {
        this.setData({ processingRedemptionId: '', processingAction: '' });
      }
    });
  },

  rejectCancel(event) {
    if (this.data.processingRedemptionId) return;
    const id = event.currentTarget.dataset.id;
    const note = this.data.noteMap[id];
    this.setData({ processingRedemptionId: id, processingAction: 'reject_cancel' });
    wx.showModal({
      title: '确认拒绝取消',
      content: '确认后兑换券会回到待使用状态。',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingRedemptionId: '', processingAction: '' });
          return;
        }
        try {
          await api.processCancelRedemption({
            redemptionId: id,
            action: 'reject',
            note,
            confirmed: true
          });
          wx.showToast({ title: '已拒绝取消', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingRedemptionId: '', processingAction: '' });
        }
      },
      fail: () => {
        this.setData({ processingRedemptionId: '', processingAction: '' });
      }
    });
  }
});
