const api = require('../../services/api');
const experience = require('../../services/experience');

const FALLBACK_REWARD_IMAGES = {
  'reward-massage': '/assets/stitch-original/reward-massage.jpg',
  food: '/assets/generated/shop-drink.jpg',
  date: '/assets/generated/shop-date.jpg',
  gift: '/assets/generated/shop-gift.jpg',
  emotion: '/assets/generated/shop-emotion.jpg'
};

Page({
  data: {
    loading: true,
    errorMessage: '',
    id: '',
    item: {},
    dashboard: {
      relationship: {
        balance: {
          availableCents: 0
        },
        balanceText: {}
      }
    },
    displayImageSrc: '/assets/stitch-original/reward-massage.jpg',
    availableCoinsText: '0.00',
    balanceAfterText: '0.00',
    canRedeem: false,
    redeemButtonText: '确认兑换',
    redeeming: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const item = await api.queryRewardItem(this.data.id);
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) {
        this.setData({ loading: false });
        return;
      }

      const availableCents = Number(
        dashboard && dashboard.relationship && dashboard.relationship.balance
          ? dashboard.relationship.balance.availableCents
          : 0
      );
      const priceCents = Number(item.priceCents || 0);
      const canRedeem = Boolean(
        item.isActive &&
        !item.soldOut &&
        availableCents >= priceCents
      );
      let redeemButtonText = '确认兑换';
      if (item.soldOut) redeemButtonText = '已经兑完了';
      else if (!item.isActive) redeemButtonText = '暂时下架';
      else if (availableCents < priceCents) redeemButtonText = '能量币不足';

      this.setData({
        item,
        dashboard,
        displayImageSrc: item.imageSrc || FALLBACK_REWARD_IMAGES[item.id] || FALLBACK_REWARD_IMAGES[item.category] || FALLBACK_REWARD_IMAGES.emotion,
        availableCoinsText: api.formatMoney(availableCents),
        balanceAfterText: api.formatMoney(Math.max(0, availableCents - priceCents)),
        canRedeem,
        redeemButtonText,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '这份情侣礼物暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  cancelRedemption() {
    wx.navigateBack();
  },

  redeem() {
    if (this.data.redeeming) return;
    if (!this.data.canRedeem) {
      wx.showToast({ title: this.data.redeemButtonText, icon: 'none' });
      return;
    }

    const item = this.data.item;
    this.setData({ redeeming: true });
    wx.showModal({
      title: '确认兑换',
      content: `确定消耗 ${item.priceText} 能量币兑换「${item.name}」吗？`,
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ redeeming: false });
          return;
        }
        try {
          const dashboard = await api.queryDashboard();
          await api.redeemReward({
            relationshipId: dashboard.relationship.id,
            rewardId: item.id
          });
          experience.playCue('redemption');
          wx.showModal({
            title: '兑换成功',
            content: '兑换券已经放进记录里，线下兑现后让赞助者核销就好。',
            showCancel: false,
            success: () => wx.navigateTo({ url: '/pages/redemptions/redemptions' })
          });
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ redeeming: false });
        }
      },
      fail: () => {
        this.setData({ redeeming: false });
      }
    });
  }
});
