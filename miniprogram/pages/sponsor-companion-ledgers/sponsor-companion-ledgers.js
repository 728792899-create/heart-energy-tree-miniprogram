const api = require('../../services/api');
const media = require('../../services/media');

const TYPE_TEXT = {
  checkin_reward: '打卡奖励',
  level_reward: '关卡奖励',
  withdrawal: '心愿金领取',
  redemption: '商店兑换',
  redemption_refund: '兑换退款',
  profile_edit_fee: '资料修改'
};

Page({
  data: {
    companionUser: {},
    ledgers: [],
    availableBalanceText: '0.00',
    incomeTotalText: '0.00',
    expenseTotalText: '0.00',
    netTotalText: '0.00',
    incomeCount: 0,
    expenseCount: 0,
    loading: true,
    errorMessage: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const detail = await api.queryCompanionDetail({ viewType: 'ledgers' });
      const ledgers = (detail.ledgers || []).map((item, index) => ({
        ...item,
        entryNumber: String(index + 1).padStart(2, '0'),
        typeText: TYPE_TEXT[item.type] || item.type,
        direction: Number(item.amountCents || 0) >= 0 ? 'income' : 'expense'
      }));
      const incomeItems = ledgers.filter((item) => item.amountCents >= 0);
      const expenseItems = ledgers.filter((item) => item.amountCents < 0);
      const incomeCents = incomeItems.reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
      const expenseCents = expenseItems.reduce((sum, item) => sum + Math.abs(Number(item.amountCents || 0)), 0);
      const balanceText = detail.dashboard
        && detail.dashboard.relationship
        && detail.dashboard.relationship.balanceText;

      const companionUser = detail.companionUser || {};

      this.setData({
        companionUser: {
          ...companionUser,
          avatarSrc: media.avatarSource(companionUser)
        },
        ledgers,
        availableBalanceText: (balanceText && balanceText.available) || '0.00',
        incomeTotalText: api.formatMoney(incomeCents),
        expenseTotalText: api.formatMoney(expenseCents),
        netTotalText: api.formatMoney(incomeCents - expenseCents),
        incomeCount: incomeItems.length,
        expenseCount: expenseItems.length,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '她的能量账本暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  }
});
