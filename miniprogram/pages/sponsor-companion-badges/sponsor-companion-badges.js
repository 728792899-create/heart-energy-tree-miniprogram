const api = require('../../services/api');
const media = require('../../services/media');

Page({
  data: {
    companionUser: {},
    badges: [],
    equippedBadges: [],
    unlockedCount: 0,
    equippedCount: 0,
    lockedCount: 0,
    unlockPercent: 0,
    loading: true,
    errorMessage: ''
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const detail = await api.queryCompanionDetail({ viewType: 'badges' });
      const badges = (detail.badges || []).map((badge, index) => ({
        ...badge,
        badgeNumber: String(index + 1).padStart(2, '0'),
        displayStory: badge.unlocked
          ? (badge.story || '这枚徽章记录着她认真走过的一小步。')
          : badge.description,
        statusLabel: badge.equipped ? '佩戴中' : (badge.unlocked ? '已解锁' : '待点亮')
      }));
      const equippedBadges = badges.filter((badge) => badge.unlocked && badge.equipped);
      const unlockedCount = badges.filter((badge) => badge.unlocked).length;
      const lockedCount = Math.max(0, badges.length - unlockedCount);
      const unlockPercent = badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0;

      const companionUser = detail.companionUser || {};

      this.setData({
        companionUser: {
          ...companionUser,
          avatarSrc: media.avatarSource(companionUser)
        },
        badges,
        equippedBadges,
        unlockedCount,
        equippedCount: equippedBadges.length,
        lockedCount,
        unlockPercent,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '她的成就徽章暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  }
});
