const api = require('../../services/api');
const media = require('../../services/media');

const STATUS_TEXT = {
  submitted: '待审核',
  approved: '已通过',
  rejected: '已退回'
};

const STATUS_TONE = {
  submitted: 'pending',
  approved: 'success',
  rejected: 'muted'
};

Page({
  data: {
    companionUser: {},
    history: [],
    approvedCount: 0,
    totalMinutes: 0,
    totalRewardText: '0.00',
    latestApprovedDate: '暂无',
    loading: true,
    errorMessage: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const detail = await api.queryCompanionDetail({ viewType: 'history' });
      const history = (detail.history || []).map((item, index) => ({
        ...item,
        entryNumber: String(index + 1).padStart(2, '0'),
        statusText: STATUS_TEXT[item.status] || item.status,
        statusTone: STATUS_TONE[item.status] || 'muted',
        rewardText: api.formatMoney(item.rewardCents || 0)
      }));
      const approved = history.filter((item) => item.status === 'approved');
      const approvedCount = approved.length;
      const totalMinutes = approved.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
      const totalRewardCents = approved.reduce((sum, item) => sum + Number(item.rewardCents || 0), 0);
      const latestApproved = approved[0];

      const companionUser = detail.companionUser || {};

      this.setData({
        companionUser: {
          ...companionUser,
          avatarSrc: media.avatarSource(companionUser)
        },
        history,
        approvedCount,
        totalMinutes,
        totalRewardText: api.formatMoney(totalRewardCents),
        latestApprovedDate: latestApproved ? latestApproved.displayDate : '暂无',
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '她的打卡记录暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  }
});
