const api = require('../../services/api');

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {
        balanceText: {}
      }
    },
    category: 'all',
    categories: [
      { key: 'all', label: '全部', icon: '全' },
      { key: 'food', label: '美食', icon: '食' },
      { key: 'date', label: '约会', icon: '约' },
      { key: 'gift', label: '礼物', icon: '礼' },
      { key: 'emotion', label: '情感', icon: '心' }
    ],
    items: []
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
      const items = await api.queryRewardItems({ category: this.data.category });
      this.setData({ dashboard, items, loading: false });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '情侣礼物商店暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  chooseCategory(event) {
    this.setData({ category: event.currentTarget.dataset.category }, () => this.load());
  },

  openReward(event) {
    wx.navigateTo({ url: `/pages/reward-detail/reward-detail?id=${event.currentTarget.dataset.id}` });
  },

  goRedemptions() {
    wx.navigateTo({ url: '/pages/redemptions/redemptions' });
  }
});
