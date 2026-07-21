const api = require('../../services/api');

const MAX_LEVEL_STEPS = 45;

function yuan(cents) {
  return (Number(cents || 0) / 100).toString();
}

function fixedRewardTotal(values) {
  return [values.streak3Yuan, values.streak7Yuan, values.streak14Yuan]
    .reduce((sum, value) => sum + Number(value || 0), 0)
    .toFixed(2)
    .replace(/\.00$/, '');
}

function levelSummary(totalLevelSteps) {
  const total = Number(totalLevelSteps || 0);
  return {
    levelProgressPercent: Math.min(100, Math.round((total / MAX_LEVEL_STEPS) * 100)),
    levelStepStatusText: total > MAX_LEVEL_STEPS
      ? `已超出 ${total - MAX_LEVEL_STEPS} 天`
      : `还可安排 ${MAX_LEVEL_STEPS - total} 天`
  };
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    relationship: {},
    perCheckInYuan: '5',
    dailyMaxYuan: '5',
    monthlyWishFundYuan: '0',
    streak3Yuan: '0',
    streak7Yuan: '5',
    streak14Yuan: '10',
    totalFixedRewardYuan: '15',
    levels: [],
    totalLevelSteps: 0,
    levelProgressPercent: 0,
    levelStepStatusText: `还可安排 ${MAX_LEVEL_STEPS} 天`,
    saving: false
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
      const adventure = await api.queryAdventure();
      const rule = dashboard.relationship.rewardRule;
      const streak = {};
      rule.streakBonuses.forEach((item) => {
        streak[item.days] = item;
      });
      const levels = adventure.levels.map((item) => ({
        ...item,
        requiredStepsText: String(item.requiredSteps),
        rewardYuan: yuan(item.rewardCents)
      }));
      const totalLevelSteps = levels.reduce((sum, item) => sum + Number(item.requiredSteps || 0), 0);
      const rewardValues = {
        streak3Yuan: yuan(streak[3] && streak[3].bonusCents),
        streak7Yuan: yuan(streak[7] && streak[7].bonusCents),
        streak14Yuan: yuan(streak[14] && streak[14].bonusCents)
      };
      this.setData({
        relationship: dashboard.relationship,
        perCheckInYuan: yuan(rule.perCheckInCents),
        dailyMaxYuan: yuan(rule.dailyMaxCents),
        monthlyWishFundYuan: yuan(rule.monthlyWishFundCents),
        ...rewardValues,
        totalFixedRewardYuan: fixedRewardTotal(rewardValues),
        levels,
        totalLevelSteps,
        ...levelSummary(totalLevelSteps),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '奖励规则暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  onInput(event) {
    if (this.data.saving) return;
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const nextData = { [field]: value };
    if (field === 'streak3Yuan' || field === 'streak7Yuan' || field === 'streak14Yuan') {
      nextData.totalFixedRewardYuan = fixedRewardTotal({ ...this.data, [field]: value });
    }
    this.setData(nextData);
  },

  onLevelInput(event) {
    if (this.data.saving) return;
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`levels[${index}].${field}`]: event.detail.value
    }, () => {
      const totalLevelSteps = this.data.levels.reduce(
        (sum, item) => sum + Number(item.requiredStepsText || item.requiredSteps || 0),
        0
      );
      this.setData({ totalLevelSteps, ...levelSummary(totalLevelSteps) });
    });
  },

  save() {
    if (this.data.saving) return;

    let levels;
    let rewardRule;
    try {
      levels = this.data.levels.map((item) => ({
        id: item.id,
        requiredSteps: Number(item.requiredStepsText || item.requiredSteps),
        rewardCents: api.centsFromYuan(item.rewardYuan)
      }));
      rewardRule = {
        perCheckInCents: api.centsFromYuan(this.data.perCheckInYuan),
        dailyMaxCents: api.centsFromYuan(this.data.dailyMaxYuan),
        monthlyWishFundCents: api.centsFromYuan(this.data.monthlyWishFundYuan),
        streakBonuses: [
          {
            days: 3,
            bonusCents: api.centsFromYuan(this.data.streak3Yuan),
            surpriseTitle: '周末散步券'
          },
          {
            days: 7,
            bonusCents: api.centsFromYuan(this.data.streak7Yuan),
            surpriseTitle: '约会基金加码'
          },
          {
            days: 14,
            bonusCents: api.centsFromYuan(this.data.streak14Yuan),
            surpriseTitle: '小礼物心愿果'
          }
        ]
      };
    } catch (error) {
      wx.showToast({ title: error.message || '请检查奖励金额', icon: 'none' });
      return;
    }

    if (levels.some((item) => !Number.isInteger(item.requiredSteps) || item.requiredSteps < 1 || item.requiredSteps > MAX_LEVEL_STEPS)) {
      wx.showToast({ title: '每关天数需为 1-45 天', icon: 'none' });
      return;
    }
    const totalLevelSteps = levels.reduce((sum, item) => sum + item.requiredSteps, 0);
    if (totalLevelSteps > MAX_LEVEL_STEPS) {
      wx.showToast({ title: '地图总天数不能超过 45 天', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showModal({
      title: '确认保存奖励约定',
      content: `保存后，新的打卡金额、连续奖励和 ${totalLevelSteps} 天地图关卡会立即用于后续审核。`,
      confirmText: '确认保存',
      confirmColor: '#2E452C',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ saving: false });
          return;
        }
        try {
          await api.updateRewardRule({
            relationshipId: this.data.relationship.id,
            rule: rewardRule
          });
          await api.updateAdventureLevels({
            relationshipId: this.data.relationship.id,
            levels
          });
          wx.showToast({ title: '规则已保存', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message || '规则保存失败', icon: 'none' });
        } finally {
          this.setData({ saving: false });
        }
      },
      fail: () => {
        this.setData({ saving: false });
        wx.showToast({ title: '确认窗口没有打开，请重试', icon: 'none' });
      }
    });
  }
});
