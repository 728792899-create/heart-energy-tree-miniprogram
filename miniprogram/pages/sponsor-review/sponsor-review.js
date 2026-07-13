const api = require('../../services/api');
const experience = require('../../services/experience');

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {
        balanceText: {}
      }
    },
    pending: [],
    praiseMap: {},
    reasonMap: {},
    processingCheckInId: '',
    processingDecision: ''
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
      const pending = (await api.queryPendingCheckIns()).map((item, index) => ({
        ...item,
        reviewNumber: index + 1,
        durationText: item.durationMinutes ? `${item.durationMinutes} 分钟` : '运动打卡'
      }));
      this.setData({
        dashboard,
        pending,
        praiseMap: {},
        reasonMap: {},
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '打卡审核台暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  focusFirstReview() {
    if (!this.data.pending.length) return;
    wx.pageScrollTo({ selector: '#review-queue', duration: 300 });
  },

  onPraiseInput(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ [`praiseMap.${id}`]: event.detail.value });
  },

  onReasonInput(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ [`reasonMap.${id}`]: event.detail.value });
  },

  onPhotoError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.pending[index]) return;
    this.setData({ [`pending[${index}].photoSrc`]: '' });
  },

  async approve(event) {
    if (this.data.processingCheckInId) return;
    const id = event.currentTarget.dataset.id;
    this.setData({ processingCheckInId: id, processingDecision: 'approved' });
    try {
      const result = await api.reviewCheckIn({
        checkInId: id,
        decision: 'approved',
        note: this.data.praiseMap[id]
      });
      experience.playCue('approval');
      wx.showModal({
        title: '已通过',
        content: `奖励 ¥${api.formatMoney(result.ledger.amountCents)}，能量树增加 ${result.approval.sunshine} 点阳光。`,
        showCancel: false
      });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ processingCheckInId: '', processingDecision: '' });
    }
  },

  async reject(event) {
    if (this.data.processingCheckInId) return;
    const id = event.currentTarget.dataset.id;
    this.setData({ processingCheckInId: id, processingDecision: 'rejected' });
    try {
      await api.reviewCheckIn({
        checkInId: id,
        decision: 'rejected',
        note: this.data.reasonMap[id]
      });
      wx.showToast({ title: '已温柔退回', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ processingCheckInId: '', processingDecision: '' });
    }
  },

  goRules() {
    wx.navigateTo({ url: '/pages/sponsor-rules/sponsor-rules' });
  },

  goPayouts() {
    wx.navigateTo({ url: '/pages/sponsor-payouts/sponsor-payouts' });
  }
});
