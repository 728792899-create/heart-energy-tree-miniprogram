const api = require('../../services/api');
const media = require('../../services/media');
const privacy = require('../../services/privacy');
const { createMessageRealtime, updateMessageTabBadge } = require('../../services/messageRealtime');
const { normalizeMessage, normalizeDraftInput, normalizeCustomRequestDraft, mergeMessages } = require('../../services/messageView');
const {
  nextBottomAnchor,
  bottomScrollTarget,
  keyboardComposerState,
  unseenAfterWatcher,
  shouldCompensateMediaScroll
} = require('../../services/messageScroll');

const QUICK_MESSAGES = ['今天也很想你', '辛苦啦，抱抱你', '记得好好休息', '有你在真好'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function avatarSrc(user) {
  return media.avatarSource(user);
}

function loveDaysFor(relationship) {
  const startedAt = relationship && (relationship.startedAt || relationship.createdAt);
  const startedTime = startedAt ? new Date(startedAt).getTime() : Date.now();
  return Math.max(1, Math.floor((Date.now() - startedTime) / 86400000) + 1);
}

function chooseMedia(sourceType) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [sourceType],
      sizeType: ['compressed'],
      success: resolve,
      fail: reject
    });
  });
}

function compressImage(src) {
  return new Promise((resolve, reject) => {
    wx.compressImage({ src, quality: 72, success: resolve, fail: reject });
  });
}

function getFileInfo(filePath) {
  if (typeof wx.getFileInfo !== 'function') return Promise.resolve({ size: 0 });
  return new Promise((resolve, reject) => {
    wx.getFileInfo({ filePath, success: resolve, fail: reject });
  });
}

function isCancelError(error) {
  return /cancel/i.test(String((error && (error.errMsg || error.message)) || ''));
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    messages: [],
    hasMore: false,
    nextCursor: '',
    draft: '',
    canSendDraft: false,
    sending: false,
    uploadingImage: false,
    loadingMore: false,
    watchError: '',
    currentUser: null,
    companionUser: null,
    relationship: null,
    currentAvatarSrc: '',
    companionAvatarSrc: '',
    loveDays: 1,
    canSend: false,
    quickMessages: QUICK_MESSAGES,
    stickers: [],
    stickerLoading: false,
    stickerError: '',
    requests: [],
    requestLoading: false,
    requestError: '',
    requestProcessingId: '',
    customRequestDraft: '',
    customRequestCount: 0,
    canSendCustomRequest: false,
    composerPanel: '',
    newMessageCount: 0,
    hasUnseenMessages: false,
    isAtBottom: true,
    scrollNonce: 0,
    bottomAnchorId: 'messages-end-0',
    scrollIntoView: 'messages-end-0',
    scrollWithAnimation: false,
    pendingLocalScrollMessageId: '',
    inputFocused: false,
    keyboardHeight: 0,
    keyboardOpen: false
  },

  onLoad() {
    this._mediaRefreshKeys = new Set();
    this._mediaScrollCompensated = new Set();
    this._keyboardScrollToken = 0;
    this._tabBarHiddenByComposer = false;
    this._pendingKeyboardScrollMessageId = '';
    this.load();
  },

  onShow() {
    this._visible = true;
    this.resumeConversation();
  },

  onHide() {
    this._visible = false;
    this._keyboardScrollToken += 1;
    this._pendingKeyboardScrollMessageId = '';
    this.closeInboxWatch();
    this.setData({
      composerPanel: '',
      inputFocused: false,
      keyboardHeight: 0,
      keyboardOpen: false
    });
    this.restoreTabBar();
  },

  onUnload() {
    this._visible = false;
    this._keyboardScrollToken += 1;
    this._pendingKeyboardScrollMessageId = '';
    this.closeInboxWatch();
    this.restoreTabBar();
  },

  async load() {
    this.closeInboxWatch();
    this.setData({ loading: true, errorMessage: '', watchError: '' });
    try {
      const bootstrap = await api.bootstrapCoupleMessages();
      const page = await api.queryCoupleMessages({ limit: 30 });
      const relationship = page.relationship || bootstrap.relationship || null;
      const currentUser = page.currentUser || bootstrap.currentUser || null;
      const companionUser = page.companionUser || bootstrap.companionUser || null;
      this.setData({
        loading: false,
        messages: mergeMessages([], page.messages || [], currentUser),
        hasMore: Boolean(page.hasMore),
        nextCursor: page.nextCursor || '',
        currentUser,
        companionUser,
        relationship,
        currentAvatarSrc: avatarSrc(currentUser),
        companionAvatarSrc: avatarSrc(companionUser),
        loveDays: loveDaysFor(relationship),
        canSend: Boolean(bootstrap.canSend && companionUser && companionUser.openid)
      }, () => this.scrollAfterLocalSend('initial-load'));
      updateMessageTabBadge(wx, 0);
      this.loadStickerCatalog();
      this.loadRequestCatalog();
      await this.markRead();
      if (this._visible) this.startInboxWatch();
    } catch (error) {
      this.setData({ loading: false, errorMessage: error.message || '信笺暂时没有打开' });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  async resumeConversation() {
    if (this.data.loading || !this.data.currentUser) return;
    this.closeInboxWatch();
    await this.refreshConversationContext();
    if (!this.data.stickers.length && !this.data.stickerLoading) this.loadStickerCatalog();
    if (!this.data.requests.length && !this.data.requestLoading) this.loadRequestCatalog();
    if (this._visible) this.startInboxWatch();
  },

  async refreshConversationContext(options = {}) {
    if (this._refreshContextPromise) return this._refreshContextPromise;
    this._refreshContextPromise = (async () => {
      try {
        const page = await api.queryCoupleMessages({ limit: 1 });
        const currentUser = page.currentUser || this.data.currentUser;
        const companionUser = page.companionUser || this.data.companionUser;
        const relationship = page.relationship || this.data.relationship;
        const latestMessages = options.mergeLatest === false ? [] : (page.messages || []);
        this.setData({
          currentUser,
          companionUser,
          relationship,
          currentAvatarSrc: avatarSrc(currentUser),
          companionAvatarSrc: avatarSrc(companionUser),
          loveDays: loveDaysFor(relationship),
          canSend: Boolean(companionUser && companionUser.openid),
          messages: mergeMessages(this.data.messages, latestMessages, currentUser)
        });
      } catch (error) {
        console.warn('[energy-tree] refresh conversation context failed', error);
      }
    })();
    try {
      await this._refreshContextPromise;
    } finally {
      this._refreshContextPromise = null;
    }
  },

  async loadStickerCatalog() {
    if (this.data.stickerLoading) return;
    this.setData({ stickerLoading: true, stickerError: '' });
    try {
      const result = await api.queryCoupleStickerCatalog();
      this.setData({ stickers: (result && result.stickers) || [], stickerLoading: false });
    } catch (error) {
      this.setData({ stickerLoading: false, stickerError: error.message || '情侣表情暂时没有取到' });
    }
  },

  async loadRequestCatalog() {
    if (this.data.requestLoading) return;
    this.setData({ requestLoading: true, requestError: '' });
    try {
      const result = await api.queryCoupleRequestCatalog();
      this.setData({ requests: (result && result.requests) || [], requestLoading: false });
    } catch (error) {
      this.setData({ requestLoading: false, requestError: error.message || '傲娇请求暂时没有取到' });
    }
  },

  startInboxWatch() {
    this.closeInboxWatch();
    const openid = this.data.currentUser && this.data.currentUser.openid;
    if (!openid || !api.isCloudMode()) return;
    try {
      const realtime = createMessageRealtime();
      this.inboxWatcher = realtime.watchInbox({
        openid,
        onChange: (messages) => {
          const incoming = messages || [];
          const merged = mergeMessages(this.data.messages, incoming, this.data.currentUser);
          const knownIds = new Set(this.data.messages.map((message) => message.messageId));
          const newMessages = incoming.filter((message) => message && !knownIds.has(message.messageId));
          const partnerMessages = newMessages.filter((message) => message.senderUserId !== (this.data.currentUser && this.data.currentUser.id));
          const hadNewMessage = newMessages.length > 0;
          const hasMediaMessage = newMessages.some((message) => message.contentType === 'image' || message.contentType === 'sticker');
          const unseen = unseenAfterWatcher(this.data, partnerMessages.length);
          this.setData({
            messages: merged,
            watchError: '',
            newMessageCount: unseen.newMessageCount,
            hasUnseenMessages: unseen.hasUnseenMessages
          });
          if (hadNewMessage) this.refreshConversationContext();
          if (hasMediaMessage) this.refreshRecentMediaMessages();
          if (this.data.isAtBottom && partnerMessages.length === 0) this.markRead();
        },
        onError: (error) => {
          this.setData({ watchError: (error && error.message) || '实时连接已断开，点击重试' });
        }
      });
    } catch (error) {
      this.setData({ watchError: error.message || '实时连接已断开，点击重试' });
    }
  },

  async refreshRecentMediaMessages() {
    if (this._refreshMediaPromise) return this._refreshMediaPromise;
    this._refreshMediaPromise = (async () => {
      try {
        const page = await api.queryCoupleMessages({ limit: 30 });
        this.setData({ messages: mergeMessages(this.data.messages, page.messages || [], this.data.currentUser) });
      } catch (error) {
        console.warn('[energy-tree] refresh media messages failed', error);
      }
    })();
    try {
      await this._refreshMediaPromise;
    } finally {
      this._refreshMediaPromise = null;
    }
  },

  closeInboxWatch() {
    if (this.inboxWatcher && typeof this.inboxWatcher.close === 'function') this.inboxWatcher.close();
    this.inboxWatcher = null;
  },

  retryWatch() {
    this.setData({ watchError: '' });
    this.startInboxWatch();
  },

  async markRead() {
    if (this._markingRead || !this.data.currentUser) return;
    this._markingRead = true;
    try {
      await api.markCoupleMessagesRead({});
      updateMessageTabBadge(wx, 0);
    } catch (error) {
      console.warn('[energy-tree] mark messages read failed', error);
    } finally {
      this._markingRead = false;
    }
  },

  onDraftInput(event) {
    const draft = normalizeDraftInput(event.detail.value);
    this.setData({ draft, canSendDraft: Boolean(String(draft || '').trim()) });
  },

  onCustomRequestInput(event) {
    const customRequestDraft = normalizeCustomRequestDraft(event && event.detail && event.detail.value);
    this.setData({
      customRequestDraft,
      customRequestCount: Array.from(customRequestDraft).length,
      canSendCustomRequest: Boolean(customRequestDraft.trim())
    });
  },

  onCustomRequestFocus() {
    this.setData({ inputFocused: true });
    this.hideTabBarForComposer();
  },

  hideTabBarForComposer() {
    if (this._tabBarHiddenByComposer) return;
    this._tabBarHiddenByComposer = true;
    if (typeof wx.hideTabBar !== 'function') return;
    try {
      wx.hideTabBar({
        animation: false,
        fail: (error) => {
          this._tabBarHiddenByComposer = false;
          console.warn('[energy-tree] hide tab bar for composer failed', error);
        }
      });
    } catch (error) {
      this._tabBarHiddenByComposer = false;
      console.warn('[energy-tree] hide tab bar for composer failed', error);
    }
  },

  restoreTabBar() {
    this._tabBarHiddenByComposer = false;
    if (typeof wx.showTabBar !== 'function') return;
    try {
      wx.showTabBar({
        animation: false,
        fail: (error) => console.warn('[energy-tree] restore tab bar failed', error)
      });
    } catch (error) {
      console.warn('[energy-tree] restore tab bar failed', error);
    }
  },

  latestMessageId() {
    const messages = this.data.messages || [];
    const latest = messages[messages.length - 1];
    return (latest && latest.messageId) || '';
  },

  onComposerFocus() {
    const updates = { inputFocused: true };
    if (this.data.composerPanel) updates.composerPanel = '';
    this.setData(updates);
    this.hideTabBarForComposer();
    this.scrollAfterLocalSend(this.latestMessageId(), { animate: false });
  },

  onComposerBlur() {
    this.setData({ inputFocused: false });
  },

  onKeyboardHeightChange(event) {
    const height = Number(event && event.detail && event.detail.height) || 0;
    const keyboardState = keyboardComposerState(height);
    if (keyboardState.keyboardOpen) {
      this.hideTabBarForComposer();
      this.setData(keyboardState, () => {
        this.scheduleKeyboardScroll(this._pendingKeyboardScrollMessageId || this.latestMessageId());
      });
      return;
    }
    this._keyboardScrollToken += 1;
    this._pendingKeyboardScrollMessageId = '';
    this.setData(keyboardState);
    this.restoreTabBar();
  },

  scheduleKeyboardScroll(messageId) {
    this._pendingKeyboardScrollMessageId = messageId || this.latestMessageId();
    const token = ++this._keyboardScrollToken;
    setTimeout(() => {
      if (token !== this._keyboardScrollToken || !this._visible || !this.data.keyboardOpen) return;
      this.scrollAfterLocalSend(this._pendingKeyboardScrollMessageId, {
        animate: false,
        skipKeyboardCompensation: true
      });
    }, 80);
  },

  toggleMorePanel() {
    if (!this.data.canSend) return;
    if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard();
    this.setData({ inputFocused: false, composerPanel: this.data.composerPanel === 'more' ? '' : 'more' });
  },

  toggleStickerPanel() {
    if (!this.data.canSend) return;
    if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard();
    const nextPanel = this.data.composerPanel === 'stickers' ? '' : 'stickers';
    this.setData({ inputFocused: false, composerPanel: nextPanel });
    if (nextPanel === 'stickers' && !this.data.stickers.length) this.loadStickerCatalog();
  },

  toggleRequestPanel() {
    if (!this.data.canSend) return;
    if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard();
    const nextPanel = this.data.composerPanel === 'requests' ? '' : 'requests';
    this.setData({ inputFocused: false, composerPanel: nextPanel });
    if (nextPanel === 'requests' && !this.data.requests.length) this.loadRequestCatalog();
  },

  async sendDraft() {
    await this.sendText(this.data.draft);
  },

  async sendQuickMessage(event) {
    this.setData({ composerPanel: '' });
    await this.sendText(event.currentTarget.dataset.text);
  },

  async sendText(value) {
    const content = String(value || '').trim();
    if (!content || this.data.sending || !this.data.canSend) return;
    this.setData({ sending: true });
    try {
      const result = await api.sendCoupleMessage({ contentType: 'text', content });
      const message = result && result.message;
      this.setData({
        draft: '',
        canSendDraft: false,
        messages: message ? mergeMessages(this.data.messages, [normalizeMessage(message, this.data.currentUser)], this.data.currentUser) : this.data.messages
      }, () => this.scrollAfterLocalSend(message && message.messageId));
    } catch (error) {
      wx.showToast({ title: error.message || '这封信暂时没有寄出', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  chooseAlbumImage() {
    this.chooseAndSendImage('album');
  },

  takePhoto() {
    this.chooseAndSendImage('camera');
  },

  async chooseAndSendImage(sourceType) {
    if (this.data.uploadingImage || !this.data.canSend) return;
    const authorized = await privacy.ensurePhotoPrivacy('发送聊天图片');
    if (!authorized) return;
    this.setData({ composerPanel: '', uploadingImage: true });
    let uploadedFileId = '';
    try {
      const selected = await chooseMedia(sourceType);
      const file = selected.tempFiles && selected.tempFiles[0];
      if (!file || !file.tempFilePath) throw new Error('没有取得图片，请重新选择');
      let filePath = file.tempFilePath;
      let fileSize = Number(file.size || 0);
      if (fileSize > MAX_IMAGE_BYTES) {
        const compressed = await compressImage(filePath);
        filePath = compressed.tempFilePath;
        const info = await getFileInfo(filePath);
        fileSize = Number(info.size || 0);
      }
      if (fileSize > MAX_IMAGE_BYTES) throw new Error('图片压缩后仍超过 5MB，请换一张图片');
      const relationshipId = this.data.relationship && this.data.relationship.id;
      const userId = this.data.currentUser && this.data.currentUser.id;
      uploadedFileId = await api.uploadCoupleMessageImage({ filePath, relationshipId, userId });
      const result = await api.sendCoupleMessage({
        contentType: 'image',
        content: '[图片]',
        imageFileId: uploadedFileId,
        imageWidth: Number(file.width || 0),
        imageHeight: Number(file.height || 0)
      });
      const message = result && result.message;
      this.setData({
        messages: message ? mergeMessages(this.data.messages, [normalizeMessage(message, this.data.currentUser)], this.data.currentUser) : this.data.messages
      }, () => this.scrollAfterLocalSend(message && message.messageId));
      uploadedFileId = '';
    } catch (error) {
      if (uploadedFileId) await api.cleanupUploadedFile(uploadedFileId);
      if (!isCancelError(error)) wx.showToast({ title: error.message || '图片暂时没有寄出', icon: 'none' });
    } finally {
      this.setData({ uploadingImage: false });
    }
  },

  async sendSticker(event) {
    const stickerId = event.currentTarget.dataset.stickerId;
    if (!stickerId || this.data.sending || !this.data.canSend) return;
    this.setData({ sending: true, composerPanel: '' });
    try {
      const result = await api.sendCoupleMessage({ contentType: 'sticker', content: '[表情]', stickerId });
      const message = result && result.message;
      this.setData({
        messages: message ? mergeMessages(this.data.messages, [normalizeMessage(message, this.data.currentUser)], this.data.currentUser) : this.data.messages
      }, () => this.scrollAfterLocalSend(message && message.messageId));
    } catch (error) {
      wx.showToast({ title: error.message || '表情暂时没有寄出', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  async sendCoupleRequest(event) {
    const requestTemplateId = event.currentTarget.dataset.requestTemplateId;
    if (!requestTemplateId || this.data.requestProcessingId || !this.data.canSend) return;
    this.setData({ requestProcessingId: `template:${requestTemplateId}`, composerPanel: '' });
    try {
      const result = await api.sendCoupleRequest({ requestTemplateId });
      const message = result && result.message;
      this.setData({
        messages: message ? mergeMessages(this.data.messages, [message], this.data.currentUser) : this.data.messages
      }, () => this.scrollAfterLocalSend(message && message.messageId));
    } catch (error) {
      wx.showToast({ title: error.message || '请求暂时没有寄出', icon: 'none' });
    } finally {
      this.setData({ requestProcessingId: '' });
    }
  },

  async sendCustomCoupleRequest() {
    const customRequestText = String(this.data.customRequestDraft || '').trim();
    if (!customRequestText || this.data.requestProcessingId || !this.data.canSend) return;
    this.setData({ requestProcessingId: 'custom-request' });
    try {
      const result = await api.sendCoupleRequest({ customRequestText });
      const message = result && result.message;
      if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard();
      this.setData({
        customRequestDraft: '',
        customRequestCount: 0,
        canSendCustomRequest: false,
        composerPanel: '',
        messages: message ? mergeMessages(this.data.messages, [message], this.data.currentUser) : this.data.messages
      }, () => this.scrollAfterLocalSend(message && message.messageId));
    } catch (error) {
      wx.showToast({ title: error.message || '自定义请求暂时没有寄出', icon: 'none' });
    } finally {
      this.setData({ requestProcessingId: '' });
    }
  },

  async respondCoupleRequest(event) {
    const requestMessageId = event.currentTarget.dataset.requestMessageId;
    const decision = event.currentTarget.dataset.decision;
    if (!requestMessageId || !decision || this.data.requestProcessingId) return;
    this.setData({ requestProcessingId: requestMessageId });
    try {
      const result = await api.respondCoupleRequest({ requestMessageId, decision });
      const incoming = [result && result.requestMessage, result && result.responseMessage].filter(Boolean);
      this.setData({ messages: mergeMessages(this.data.messages, incoming, this.data.currentUser) }, () => {
        this.scrollAfterLocalSend(result && result.responseMessage && result.responseMessage.messageId);
      });
    } catch (error) {
      wx.showToast({ title: error.message || '请求暂时没有处理', icon: 'none' });
    } finally {
      this.setData({ requestProcessingId: '' });
    }
  },

  async cancelCoupleRequest(event) {
    const requestMessageId = event.currentTarget.dataset.requestMessageId;
    if (!requestMessageId || this.data.requestProcessingId) return;
    this.setData({ requestProcessingId: requestMessageId });
    try {
      const result = await api.cancelCoupleRequest({ requestMessageId });
      const incoming = [result && result.requestMessage, result && result.responseMessage].filter(Boolean);
      this.setData({ messages: mergeMessages(this.data.messages, incoming, this.data.currentUser) }, () => {
        this.scrollAfterLocalSend(result && result.responseMessage && result.responseMessage.messageId);
      });
    } catch (error) {
      wx.showToast({ title: error.message || '请求暂时不能撤回', icon: 'none' });
    } finally {
      this.setData({ requestProcessingId: '' });
    }
  },

  previewMessageImage(event) {
    const current = event.currentTarget.dataset.src;
    if (!current) return;
    const urls = this.data.messages
      .filter((message) => message.contentType === 'image' && message.imageSrc)
      .map((message) => message.imageSrc);
    wx.previewImage({ current, urls: urls.length ? urls : [current] });
  },

  onMessageMediaLoad(event) {
    const messageId = event.currentTarget.dataset.messageId;
    const alreadyCompensated = this._mediaScrollCompensated.has(messageId);
    if (!shouldCompensateMediaScroll(this.data.pendingLocalScrollMessageId, messageId, alreadyCompensated)) return;
    this._mediaScrollCompensated.add(messageId);
    this.scrollAfterLocalSend(messageId);
  },

  onMediaError(event) {
    const key = event.currentTarget.dataset.key || 'conversation-avatar';
    if (this._mediaRefreshKeys.has(key)) return;
    this._mediaRefreshKeys.add(key);
    if (String(key).indexOf('message-') === 0) this.refreshRecentMediaMessages();
    else this.refreshConversationContext();
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.nextCursor) return;
    this.setData({ loadingMore: true });
    try {
      const firstMessageId = this.data.messages[0] && this.data.messages[0].messageId;
      const page = await api.queryCoupleMessages({ beforeSortKey: this.data.nextCursor, limit: 30 });
      this.setData({
        messages: mergeMessages(page.messages || [], this.data.messages, this.data.currentUser),
        hasMore: Boolean(page.hasMore),
        nextCursor: page.nextCursor || '',
        scrollIntoView: firstMessageId ? `message-${firstMessageId}` : this.data.scrollIntoView
      });
    } catch (error) {
      wx.showToast({ title: error.message || '更早的信笺暂时没有取到', icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  scrollAfterLocalSend(messageId, options = {}) {
    const anchor = nextBottomAnchor(this.data.scrollNonce);
    this._pendingKeyboardScrollMessageId = messageId || this.latestMessageId();
    this.setData({
      scrollNonce: anchor.scrollNonce,
      bottomAnchorId: anchor.bottomAnchorId,
      pendingLocalScrollMessageId: messageId || '',
      newMessageCount: 0,
      hasUnseenMessages: false,
      isAtBottom: true
    }, () => {
      const commitScroll = () => {
        this.setData(bottomScrollTarget(anchor.bottomAnchorId, Boolean(options.animate)), () => {
          this.markRead();
          if (this.data.keyboardOpen && !options.skipKeyboardCompensation) {
            this.scheduleKeyboardScroll(messageId);
          }
        });
      };
      if (typeof wx.nextTick === 'function') wx.nextTick(commitScroll);
      else commitScroll();
    });
  },

  showNewestMessages() {
    this.scrollAfterLocalSend('');
  },

  onScrollToLower() {
    if (!this.data.isAtBottom || this.data.hasUnseenMessages) {
      this.setData({ isAtBottom: true, newMessageCount: 0, hasUnseenMessages: false });
    }
    this.markRead();
  },

  onMessageScroll(event) {
    const delta = Number(event && event.detail && event.detail.delta) || 0;
    if (delta < -2 && this.data.isAtBottom) this.setData({ isAtBottom: false });
  },

  inviteCompanion() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});

module.exports = { mergeMessages, normalizeMessage };
