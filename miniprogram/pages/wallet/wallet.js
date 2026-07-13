const api = require('../../services/api');

const STATUS_TEXT = {
  pending_review: '等待确认',
  approved_waiting_transfer: '等待手动兑现',
  paid: '已兑现',
  rejected: '已退回余额'
};

const STATUS_TONE = {
  pending_review: 'active',
  approved_waiting_transfer: 'warning',
  paid: 'success',
  rejected: 'muted'
};

function formatCreatedDate(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {
        balanceText: {}
      }
    },
    withdrawals: [],
    amountYuan: '',
    note: '',
    requesting: false
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
      const withdrawals = (await api.queryWithdrawals()).map((item) => ({
        ...item,
        statusText: STATUS_TEXT[item.status] || item.status,
        statusTone: STATUS_TONE[item.status] || 'muted',
        createdDateText: formatCreatedDate(item.createdAt)
      }));
      this.setData({ dashboard, withdrawals, amountYuan: '', note: '', loading: false });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '心愿金页面暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  onAmountInput(event) {
    this.setData({ amountYuan: event.detail.value });
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value });
  },

  requestWithdrawal() {
    if (this.data.requesting) return;

    let amountCents = 0;
    try {
      amountCents = api.centsFromYuan(this.data.amountYuan);
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
      return;
    }
    if (amountCents <= 0) {
      wx.showToast({ title: '请输入领取金额', icon: 'none' });
      return;
    }

    this.setData({ requesting: true });
    wx.showModal({
      title: '确认领取心愿金',
      content: `确认申请领取 ¥${api.formatMoney(amountCents)} 吗？提交后这笔金额会暂时冻结，等待陪伴者处理。`,
      confirmText: '确认申请',
      confirmColor: '#8F3653',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ requesting: false });
          return;
        }
        try {
          await api.requestWithdrawal({
            relationshipId: this.data.dashboard.relationship.id,
            amountCents,
            note: this.data.note
          });
          wx.showToast({ title: '已提交申请', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ requesting: false });
        }
      },
      fail: () => {
        this.setData({ requesting: false });
      }
    });
  }
});
