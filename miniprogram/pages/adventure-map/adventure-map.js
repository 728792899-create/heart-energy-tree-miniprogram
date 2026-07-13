const api = require('../../services/api');

Page({
  data: {
    loading: true,
    errorMessage: '',
    adventure: {
      currentLevel: {}
    },
    levels: []
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const data = await api.queryAdventure();
      if (!data) {
        this.setData({ loading: false });
        return;
      }
      const levels = data.levels.map((item) => ({
        ...item,
        rewardText: api.formatMoney(item.rewardCents),
        statusText: item.completed ? '已通关' : item.current ? '进行中' : '未解锁'
      }));
      this.setData({
        adventure: data.adventure,
        levels,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '能量地图暂时没有加载出来'
      });
    }
  },

  goCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  }
});
