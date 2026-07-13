const appService = require('./services/appService');
const api = require('./services/api');
const config = require('./config/env');
const experience = require('./services/experience');
const { createMessageRealtime, updateMessageTabBadge } = require('./services/messageRealtime');

App({
  onLaunch() {
    console.info('[energy-tree] app launch', {
      apiMode: config.apiMode,
      cloudEnv: config.cloudEnv,
      cloudFunctionName: config.cloudFunctionName,
      buildTag: config.buildTag
    });
    if (typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: config.cloudEnv || undefined,
        traceUser: true
      });
    }
    appService.seedDemoIfNeeded();
    this.globalData.soundEnabled = experience.isSoundEnabled();
    this.globalData.reducedMotion = experience.isReducedMotionEnabled();
  },

  onShow() {
    this.startMessageUnreadWatch();
  },

  onHide() {
    this.closeMessageUnreadWatch();
  },

  async startMessageUnreadWatch() {
    this.closeMessageUnreadWatch();
    if (!api.isCloudMode()) return;
    try {
      const bootstrap = await api.bootstrapCoupleMessages();
      const openid = bootstrap && bootstrap.currentOpenid;
      if (!openid) return;
      this.globalData.currentOpenid = openid;
      updateMessageTabBadge(wx, bootstrap.unreadCount);
      const realtime = createMessageRealtime();
      this.messageUnreadWatcher = realtime.watchUnread({
        openid,
        onChange: (unreadCount) => updateMessageTabBadge(wx, unreadCount),
        onError: (error) => console.warn('[energy-tree] unread watcher disconnected', error)
      });
    } catch (error) {
      console.warn('[energy-tree] cannot start unread watcher', error);
    }
  },

  closeMessageUnreadWatch() {
    if (this.messageUnreadWatcher && typeof this.messageUnreadWatcher.close === 'function') {
      this.messageUnreadWatcher.close();
    }
    this.messageUnreadWatcher = null;
  },

  globalData: {
    appName: '心动能量树',
    soundEnabled: true,
    reducedMotion: false,
    currentOpenid: ''
  }
});
