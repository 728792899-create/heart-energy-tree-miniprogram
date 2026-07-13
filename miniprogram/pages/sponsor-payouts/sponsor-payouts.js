const api = require('../../services/api');
const experience = require('../../services/experience');

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

const STATUS_HINT = {
  pending_review: '先确认这份心愿，再决定同意或温柔退回。',
  approved_waiting_transfer: '申请已同意，完成线下兑现后请留下备注。',
  paid: '这份心愿已经认真兑现。',
  rejected: '金额已回到她的可用能量币。'
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

function isPendingTask(item) {
  return item.status === 'pending_review' || item.status === 'approved_waiting_transfer';
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    withdrawals: [],
    pendingTaskCount: 0,
    pendingTaskLabel: '今天没有待办',
    pendingAmountText: '0.00',
    pendingReviewCount: 0,
    waitingTransferCount: 0,
    completedCount: 0,
    hasPendingTasks: false,
    transferNoteMap: {},
    reasonMap: {},
    processingWithdrawalId: '',
    processingAction: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const withdrawals = (await api.queryWithdrawals()).map((item, index) => ({
        ...item,
        requestNumber: index + 1,
        statusText: STATUS_TEXT[item.status] || item.status,
        statusTone: STATUS_TONE[item.status] || 'muted',
        statusHint: STATUS_HINT[item.status] || '请核对这份心愿金记录。',
        createdDateText: formatCreatedDate(item.createdAt),
        requestNote: item.note || '想把这份积累已久的心意变成一个小愿望。'
      }));
      const pendingItems = withdrawals.filter(isPendingTask);
      const pendingReviewCount = withdrawals.filter((item) => item.status === 'pending_review').length;
      const waitingTransferCount = withdrawals.filter((item) => item.status === 'approved_waiting_transfer').length;
      const pendingAmountCents = pendingItems.reduce((sum, item) => sum + Number(item.amountCents || 0), 0);

      this.setData({
        withdrawals,
        pendingTaskCount: pendingItems.length,
        pendingTaskLabel: pendingItems.length ? `${pendingItems.length} 项等待处理` : '今天没有待办',
        pendingAmountText: api.formatMoney(pendingAmountCents),
        pendingReviewCount,
        waitingTransferCount,
        completedCount: withdrawals.length - pendingItems.length,
        hasPendingTasks: pendingItems.length > 0,
        transferNoteMap: {},
        reasonMap: {},
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '心愿金处理页暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  onTransferNoteInput(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ [`transferNoteMap.${id}`]: event.detail.value });
  },

  onReasonInput(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ [`reasonMap.${id}`]: event.detail.value });
  },

  async approve(event) {
    if (this.data.processingWithdrawalId) return;
    const id = event.currentTarget.dataset.id;
    this.setData({ processingWithdrawalId: id, processingAction: 'approve' });
    try {
      await api.processWithdrawal({ withdrawalId: id, action: 'approve' });
      wx.showToast({ title: '已通过申请', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ processingWithdrawalId: '', processingAction: '' });
    }
  },

  markPaid(event) {
    if (this.data.processingWithdrawalId) return;
    const id = event.currentTarget.dataset.id;
    const note = String(this.data.transferNoteMap[id] || '').trim();
    const item = this.data.withdrawals.find((withdrawal) => withdrawal.id === id);
    if (!note) {
      wx.showToast({ title: '请先填写手动兑现备注', icon: 'none' });
      return;
    }
    this.setData({ processingWithdrawalId: id, processingAction: 'mark_paid' });
    wx.showModal({
      title: '确认已手动兑现',
      content: `确认已线下兑现 ¥${item ? item.amountText : ''}？备注：${note}`,
      confirmText: '确认兑现',
      confirmColor: '#8F3653',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingWithdrawalId: '', processingAction: '' });
          return;
        }
        try {
          await api.processWithdrawal({
            withdrawalId: id,
            action: 'mark_paid',
            note,
            confirmed: true
          });
          experience.playCue('payout');
          wx.showToast({ title: '已标记兑现', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingWithdrawalId: '', processingAction: '' });
        }
      },
      fail: () => {
        this.setData({ processingWithdrawalId: '', processingAction: '' });
      }
    });
  },

  reject(event) {
    if (this.data.processingWithdrawalId) return;
    const id = event.currentTarget.dataset.id;
    const note = String(this.data.reasonMap[id] || '').trim();
    const item = this.data.withdrawals.find((withdrawal) => withdrawal.id === id);
    if (!note) {
      wx.showToast({ title: '请填写退回原因', icon: 'none' });
      return;
    }
    this.setData({ processingWithdrawalId: id, processingAction: 'reject' });
    wx.showModal({
      title: '确认退回心愿金',
      content: `确认退回 ¥${item ? item.amountText : ''}？金额会回到她的可用能量币。`,
      confirmText: '确认退回',
      confirmColor: '#8F3653',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingWithdrawalId: '', processingAction: '' });
          return;
        }
        try {
          await api.processWithdrawal({
            withdrawalId: id,
            action: 'reject',
            note,
            confirmed: true
          });
          wx.showToast({ title: '已退回余额', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingWithdrawalId: '', processingAction: '' });
        }
      },
      fail: () => {
        this.setData({ processingWithdrawalId: '', processingAction: '' });
      }
    });
  }
});
