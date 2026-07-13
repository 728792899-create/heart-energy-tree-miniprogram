const api = require('../../services/api');

const STATUS_TEXT = {
  pending: '待兑现',
  cancel_requested: '取消确认中',
  cancelled_refunded: '已取消退款',
  cancel_rejected: '继续保留',
  used: '已兑现',
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
  food: '/assets/generated/shop-drink.jpg',
  date: '/assets/generated/shop-date.jpg',
  gift: '/assets/generated/shop-gift.jpg',
  care: '/assets/generated/shop-care.jpg',
  emotion: '/assets/generated/shop-emotion.jpg',
  default: '/assets/stitch-original/redemption-gift.jpg'
};

const ACTIVE_STATUSES = new Set(['pending', 'cancel_requested', 'cancel_rejected']);

function formatRedeemedDate(value) {
  if (!value) return '日期待补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}

function redemptionNote(item) {
  return item.verifyNote
    || item.cancelApproveNote
    || item.cancelReason
    || item.note
    || '这份小心愿还没有留下补充说明。';
}

function decorateRedemption(item, index) {
  return {
    ...item,
    entryNumber: String(index + 1).padStart(2, '0'),
    displayImageSrc: FALLBACK_REWARD_IMAGES[item.category] || FALLBACK_REWARD_IMAGES.default,
    statusText: STATUS_TEXT[item.status] || item.status || '状态待确认',
    statusTone: STATUS_TONE[item.status] || 'muted',
    redeemedDateText: formatRedeemedDate(item.redeemedAt),
    displayDescription: item.rewardDescription || '一份认真约好的陪伴奖励。',
    displayNote: redemptionNote(item)
  };
}

Page({
  data: {
    companionUser: {},
    redemptions: [],
    featuredRedemption: null,
    archivedRedemptions: [],
    pendingCount: 0,
    completedCount: 0,
    refundedCount: 0,
    totalCostText: '0.00',
    loading: true,
    errorMessage: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const detail = await api.queryCompanionDetail({ viewType: 'redemptions' });
      const redemptions = (detail.redemptions || []).map(decorateRedemption);
      const pendingCount = redemptions.filter((item) => ACTIVE_STATUSES.has(item.status)).length;
      const completedCount = redemptions.filter((item) => item.status === 'used').length;
      const refundedCount = redemptions.filter((item) => item.status === 'cancelled_refunded').length;
      const totalCostCents = redemptions.reduce((sum, item) => sum + Number(item.costCents || 0), 0);

      this.setData({
        companionUser: detail.companionUser || {},
        redemptions,
        featuredRedemption: redemptions[0] || null,
        archivedRedemptions: redemptions.slice(1),
        pendingCount,
        completedCount,
        refundedCount,
        totalCostText: api.formatMoney(totalCostCents),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '她的兑换记录暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  }
});
