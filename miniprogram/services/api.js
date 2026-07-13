const appService = require('./appService');
const config = require('../config/env');
const media = require('./media');

const CLOUD_FUNCTION_NAME = config.cloudFunctionName || 'energyTree';
const CLOUD_MODE_STORAGE_KEY = 'energy_tree_api_mode';
const MUTATION_ACTIONS = new Set([
  'bindAsSponsor',
  'bindByInvite',
  'generatePartnerInvite',
  'updateProfile',
  'equipBadges',
  'queryCompanionDetail',
  'recordCompanionView',
  'markViewNoticesRead',
  'sendCoupleMessage',
  'sendCoupleRequest',
  'respondCoupleRequest',
  'cancelCoupleRequest',
  'markCoupleMessagesRead',
  'sendEncouragement',
  'markEncouragementRead',
  'markMilestoneSeen',
  'saveSubscriptionGrant',
  'submitCheckIn',
  'reviewCheckIn',
  'requestWithdrawal',
  'processWithdrawal',
  'updateRewardRule',
  'updateAdventureLevels',
  'redeemReward',
  'verifyRedemption',
  'requestCancelRedemption',
  'processCancelRedemption',
  'saveRewardItem',
  'toggleRewardItem',
  'deleteRewardItem'
]);
let requestSequence = 0;

function createClientRequestId(action = 'mutation') {
  requestSequence = (requestSequence + 1) % 1000000;
  const random = Math.random().toString(36).slice(2, 10);
  return `${action}-${Date.now().toString(36)}-${requestSequence.toString(36)}-${random}`;
}

function withClientRequestId(action, payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  if (!source.clientRequestId) {
    source.clientRequestId = createClientRequestId(action);
  }
  return { ...source };
}

function canUseWxStorage() {
  return typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function';
}

function canUseCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function';
}

function isOnBindPage() {
  if (typeof getCurrentPages !== 'function') return false;
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return current && current.route === 'pages/bind/bind';
}

function isCloudMode() {
  if (config.apiMode === 'local') return false;
  if (typeof wx === 'undefined') return false;
  if (config.apiMode === 'cloud') return true;
  if (!canUseCloud()) return false;
  return !canUseWxStorage() || wx.getStorageSync(CLOUD_MODE_STORAGE_KEY) !== config.localDemoStorageValue;
}

function deploymentHint(result, action) {
  const cloudBuildTag = result && result.buildTag;
  const suffix = cloudBuildTag ? `（当前云端版本：${cloudBuildTag}）` : '';
  return `云函数版本过旧，动作 ${action} 需要重新部署 energyTree 后再试${suffix}`;
}

async function callCloud(action, payload) {
  if (!canUseCloud()) {
    console.error('[energy-tree] wx.cloud is unavailable', {
      action,
      apiMode: config.apiMode,
      cloudEnv: config.cloudEnv,
      buildTag: config.buildTag
    });
    throw new Error('当前环境不能调用云函数');
  }
  const requestPayload = MUTATION_ACTIONS.has(action) ? withClientRequestId(action, payload) : (payload || {});
  let response;
  try {
    response = await wx.cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: {
        action,
        payload: requestPayload
      }
    });
  } catch (error) {
    console.error('[energy-tree] cloud function call failed', {
      action,
      errCode: error && error.errCode,
      errMsg: error && error.errMsg,
      code: error && error.code
    });
    throw error;
  }
  const result = response && response.result;
  if (result && result.ok === false) {
    const error = new Error(result.message || '云端请求失败');
    error.code = result.code || 'CLOUD_ERROR';
    error.originalMessage = result.message || '';
    error.cloudBuildTag = result.buildTag || '';
    if (isUnknownCloudAction(error)) {
      error.message = deploymentHint(result, action);
    }
    console.error('[energy-tree] cloud function returned error', {
      action,
      code: error.code,
      message: error.message,
      buildTag: config.buildTag,
      cloudBuildTag: error.cloudBuildTag || ''
    });
    if (error.code === 'NEEDS_BINDING' && !isOnBindPage() && typeof wx !== 'undefined' && wx.reLaunch) {
      wx.reLaunch({ url: '/pages/bind/bind' });
    }
    throw error;
  }
  const data = result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
  if (data && data.needsBinding && !isOnBindPage() && typeof wx !== 'undefined' && wx.reLaunch) {
    wx.reLaunch({ url: '/pages/bind/bind' });
  }
  return data;
}

function isUnknownCloudAction(error) {
  return String((error && (error.originalMessage || error.message)) || '').includes('未知云函数动作');
}

async function legacyCompanionDetail(payload) {
  const viewType = (payload && payload.viewType) || 'progress';
  const dashboard = await callCloud('queryDashboard', {});
  const result = {
    viewType,
    viewLabel: '',
    notice: null,
    dashboard,
    companionUser: normalizeCompanionUser(dashboard.companionUser)
  };
  if (viewType === 'history') result.history = await callCloud('queryHistory', {});
  if (viewType === 'badges') result.badges = await callCloud('queryBadges', {});
  if (viewType === 'redemptions') result.redemptions = await callCloud('queryRedemptions', {});
  if (viewType === 'ledgers') result.ledgers = dashboard.recentLedgers || [];
  if (viewType === 'progress') {
    result.stats = dashboard.relationship && dashboard.relationship.stats;
    result.calendar = dashboard.calendar;
    result.adventure = {
      adventure: dashboard.relationship && dashboard.relationship.adventure,
      levels: dashboard.adventureLevels || []
    };
  }
  return result;
}

function normalizeCompanionUser(user) {
  return {
    ...(user || {}),
    name: (user && user.name) || '她',
    avatarText: (user && user.avatarText) || '她'
  };
}

function currentAuthContext() {
  const state = appService.getState();
  const relationship = state.relationships.find((item) => item.id === state.activeRelationshipId);
  const userId = relationship && state.currentRole === 'sponsor' ? relationship.sponsorId : relationship && relationship.participantId;
  const user = state.users.find((item) => item.id === userId);
  if (!user || !user.openid) {
    throw new Error('当前用户未登录');
  }
  return {
    openid: user.openid
  };
}

function withAuth(payload) {
  return {
    ...(payload || {}),
    authContext: currentAuthContext()
  };
}

function withMutationAuth(action, payload) {
  return withAuth(withClientRequestId(action, payload));
}

function hydrate(value) {
  return media.hydrate(value);
}

function decorate(value) {
  return media.decorate(value);
}

function login(payload) {
  if (isCloudMode()) return callCloud('login', payload);
  return appService.login(payload);
}

function bindByInvite(payload) {
  if (isCloudMode()) return callCloud('bindByInvite', payload);
  return appService.login({ role: payload && payload.role === 'sponsor' ? 'sponsor' : 'participant' });
}

function bindAsSponsor(payload) {
  if (isCloudMode()) return callCloud('bindAsSponsor', payload);
  return appService.login({ role: 'sponsor' });
}

function queryPartnerInvite(payload) {
  if (isCloudMode()) return callCloud('generatePartnerInvite', payload);
  return {
    role: 'participant',
    title: '邀请你加入我们的今天动动鸭',
    path: '/pages/bind/bind?inviteRole=participant&inviteToken=local-demo'
  };
}

function switchRole(role) {
  if (isCloudMode()) return queryDashboard();
  return appService.switchRole(role);
}

function queryDashboard() {
  if (isCloudMode()) return callCloud('queryDashboard', {}).then(hydrate);
  return decorate(appService.getDashboard(withAuth({})));
}

function queryAdventure() {
  if (isCloudMode()) return callCloud('queryAdventure', {}).then(hydrate);
  return decorate(appService.getAdventure(withAuth({})));
}

function queryBadges() {
  if (isCloudMode()) return callCloud('queryBadges', {}).then(hydrate);
  return decorate(appService.getBadgeWall(withAuth({})));
}

function queryCalendarStats(payload) {
  if (isCloudMode()) return callCloud('queryCalendarStats', payload).then(hydrate);
  return decorate(appService.getCalendarStats(withAuth(payload)));
}

function queryProfileEditState(payload) {
  if (isCloudMode()) return callCloud('queryProfileEditState', payload).then(hydrate);
  return decorate(appService.getProfileEditState(withAuth(payload)));
}

function updateProfile(payload) {
  if (isCloudMode()) return callCloud('updateProfile', payload).then(hydrate);
  return decorate(appService.updateProfile(withMutationAuth('updateProfile', payload)));
}

function equipBadges(payload) {
  if (isCloudMode()) return callCloud('equipBadges', payload).then(hydrate);
  return decorate(appService.equipBadges(withMutationAuth('equipBadges', payload)));
}

function querySponsorDashboard(payload) {
  if (isCloudMode()) return callCloud('querySponsorDashboard', payload).then(hydrate);
  return decorate(appService.querySponsorDashboard(withAuth(payload)));
}

async function queryCompanionDetail(payload) {
  let data;
  if (isCloudMode()) {
    try {
      data = await callCloud('queryCompanionDetail', payload);
    } catch (error) {
      if (!isUnknownCloudAction(error)) throw error;
      data = await legacyCompanionDetail(payload);
    }
    return hydrate(data);
  }
  data = appService.queryCompanionDetail(withAuth(payload));
  return decorate(data);
}

function recordCompanionView(payload) {
  if (isCloudMode()) return callCloud('recordCompanionView', payload);
  return appService.recordCompanionView(withMutationAuth('recordCompanionView', payload));
}


function bootstrapCoupleMessages(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('情侣信笺需要连接云端后使用'));
  return callCloud('bootstrapCoupleMessages', payload).then(hydrate);
}

function queryCoupleMessages(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('情侣信笺需要连接云端后使用'));
  return callCloud('queryCoupleMessages', payload).then(hydrate);
}

function queryCoupleStickerCatalog(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('情侣表情需要连接云端后使用'));
  return callCloud('queryCoupleStickerCatalog', payload).then(hydrate);
}

function queryCoupleRequestCatalog(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('傲娇请求需要连接云端后使用'));
  return callCloud('queryCoupleRequestCatalog', payload);
}

function sendCoupleRequest(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('傲娇请求需要连接云端后使用'));
  return callCloud('sendCoupleRequest', payload).then(hydrate);
}

function respondCoupleRequest(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('傲娇请求需要连接云端后使用'));
  return callCloud('respondCoupleRequest', payload).then(hydrate);
}

function cancelCoupleRequest(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('傲娇请求需要连接云端后使用'));
  return callCloud('cancelCoupleRequest', payload).then(hydrate);
}

function sendCoupleMessage(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('情侣信笺需要连接云端后使用'));
  return callCloud('sendCoupleMessage', payload).then(hydrate);
}

function markCoupleMessagesRead(payload = {}) {
  if (!isCloudMode()) return Promise.reject(new Error('情侣信笺需要连接云端后使用'));
  return callCloud('markCoupleMessagesRead', payload).then(hydrate);
}

function queryViewNotices(payload) {
  if (isCloudMode()) return callCloud('queryViewNotices', payload);
  return appService.listViewNotices(withAuth(payload));
}

function markViewNoticesRead(payload) {
  if (isCloudMode()) return callCloud('markViewNoticesRead', payload);
  return appService.markViewNoticesRead(withMutationAuth('markViewNoticesRead', payload));
}

function saveSubscriptionGrant(payload) {
  if (isCloudMode()) return callCloud('saveSubscriptionGrant', payload);
  return appService.saveSubscriptionGrant(withMutationAuth('saveSubscriptionGrant', payload));
}

function sendEncouragement(payload) {
  if (isCloudMode()) return callCloud('sendEncouragement', payload).then(hydrate);
  return decorate(appService.sendEncouragement(withMutationAuth('sendEncouragement', payload)));
}

function queryEncouragements(payload) {
  if (isCloudMode()) return callCloud('queryEncouragements', payload).then(hydrate);
  return decorate(appService.queryEncouragements(withAuth(payload)));
}

function markEncouragementRead(payload) {
  if (isCloudMode()) return callCloud('markEncouragementRead', payload).then(hydrate);
  return decorate(appService.markEncouragementRead(withMutationAuth('markEncouragementRead', payload)));
}

function queryMilestones(payload) {
  if (isCloudMode()) return callCloud('queryMilestones', payload).then(hydrate);
  return decorate(appService.queryMilestones(withAuth(payload)));
}

function markMilestoneSeen(payload) {
  if (isCloudMode()) return callCloud('markMilestoneSeen', payload).then(hydrate);
  return decorate(appService.markMilestoneSeen(withMutationAuth('markMilestoneSeen', payload)));
}

function queryWeeklyRecap(payload) {
  if (isCloudMode()) return callCloud('queryWeeklyRecap', payload).then(hydrate);
  return decorate(appService.queryWeeklyRecap(withAuth(payload)));
}

function queryLedgers(payload) {
  if (isCloudMode()) return callCloud('queryLedgers', payload).then(hydrate);
  return decorate(appService.listLedgers(withAuth(payload)));
}

function uploadCheckIn(payload) {
  if (isCloudMode()) return callCloud('submitCheckIn', payload);
  return appService.submitCheckIn(withMutationAuth('submitCheckIn', payload));
}

async function uploadCheckInPhoto(payload) {
  if (!isCloudMode()) return payload.filePath;
  if (!payload || !payload.filePath) throw new Error('请先选择一张打卡照片');
  const relationshipId = payload.relationshipId || 'relationship';
  const extension = String(payload.filePath).split('.').pop() || 'jpg';
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `relationships/${relationshipId}/checkins/${Date.now()}-${random}.${extension}`;
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: payload.filePath
  });
  return result.fileID;
}


async function uploadCoupleMessageImage(payload) {
  if (!payload || !payload.filePath) throw new Error('请先选择一张图片');
  if (!isCloudMode()) return payload.filePath;
  const relationshipId = String(payload.relationshipId || '').trim();
  const userId = String(payload.userId || '').trim();
  if (!relationshipId || !userId) throw new Error('情侣关系信息不完整，请重新进入信笺');
  const rawExtension = String(payload.filePath).split('.').pop() || 'jpg';
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const random = Math.random().toString(36).slice(2, 10);
  const cloudPath = `relationships/${relationshipId}/messages/${userId}/${Date.now()}-${random}.${extension}`;
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: payload.filePath
  });
  return result.fileID;
}

async function uploadAvatarFile(payload) {
  if (!payload || !payload.filePath) throw new Error('请先选择头像');
  if (!isCloudMode()) return payload.filePath;
  const relationshipId = payload.relationshipId || 'relationship';
  const userId = payload.userId || 'user';
  const extension = String(payload.filePath).split('.').pop() || 'jpg';
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `relationships/${relationshipId}/avatars/${userId}/${Date.now()}-${random}.${extension}`;
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: payload.filePath
  });
  return result.fileID;
}

async function uploadRewardImage(payload) {
  if (!payload || !payload.filePath) throw new Error('请先选择一张奖品图片');
  if (!isCloudMode()) return payload.filePath;
  const relationshipId = payload.relationshipId || 'relationship';
  const rewardId = payload.rewardId || 'new-reward';
  const extension = String(payload.filePath).split('.').pop() || 'jpg';
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `relationships/${relationshipId}/rewards/${rewardId}/${Date.now()}-${random}.${extension}`;
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: payload.filePath
  });
  return result.fileID;
}

async function cleanupUploadedFile(fileId) {
  if (!fileId || !isCloudMode() || !wx.cloud || typeof wx.cloud.deleteFile !== 'function') return false;
  try {
    await wx.cloud.deleteFile({ fileList: [fileId] });
    return true;
  } catch (error) {
    console.warn('[energy-tree] uploaded file cleanup failed', {
      code: error && error.code ? String(error.code) : '',
      message: error && error.errMsg ? String(error.errMsg) : 'deleteFile failed'
    });
    return false;
  }
}

function queryHistory() {
  if (isCloudMode()) return callCloud('queryHistory', {}).then(hydrate);
  return decorate(appService.listHistory(withAuth({})));
}

function queryPendingCheckIns() {
  if (isCloudMode()) return callCloud('queryPendingCheckIns', {}).then(hydrate);
  return decorate(appService.listPendingCheckIns(withAuth({})));
}

function reviewCheckIn(payload) {
  if (isCloudMode()) return callCloud('reviewCheckIn', payload);
  if (payload.decision === 'approved') {
    return appService.approveCheckIn(withMutationAuth('reviewCheckIn', {
      checkInId: payload.checkInId,
      praise: payload.note
    }));
  }
  return appService.rejectCheckIn(withMutationAuth('reviewCheckIn', {
    checkInId: payload.checkInId,
    reason: payload.note
  }));
}

function queryWithdrawals() {
  if (isCloudMode()) return callCloud('queryWithdrawals', {}).then(hydrate);
  return decorate(appService.listWithdrawals(withAuth({})));
}

function requestWithdrawal(payload) {
  if (isCloudMode()) return callCloud('requestWithdrawal', payload);
  return appService.requestWithdrawal(withMutationAuth('requestWithdrawal', payload));
}

function processWithdrawal(payload) {
  if (isCloudMode()) return callCloud('processWithdrawal', payload);
  if (payload.action === 'approve') {
    return appService.approveWithdrawal(withMutationAuth('processWithdrawal', {
      withdrawalId: payload.withdrawalId
    }));
  }
  if (payload.action === 'mark_paid') {
    return appService.markWithdrawalPaid(withMutationAuth('processWithdrawal', {
      withdrawalId: payload.withdrawalId,
      transferNote: payload.note,
      confirmed: payload.confirmed
    }));
  }
  return appService.rejectWithdrawal(withMutationAuth('processWithdrawal', {
    withdrawalId: payload.withdrawalId,
    reason: payload.note,
    confirmed: payload.confirmed
  }));
}

function updateRewardRule(payload) {
  if (isCloudMode()) return callCloud('updateRewardRule', payload);
  return appService.updateRewardRule(withMutationAuth('updateRewardRule', payload));
}

function updateAdventureLevels(payload) {
  if (isCloudMode()) return callCloud('updateAdventureLevels', payload).then(hydrate);
  return decorate(appService.updateAdventureLevels(withMutationAuth('updateAdventureLevels', payload)));
}

function queryRewardItems(payload) {
  if (isCloudMode()) return callCloud('queryRewardItems', payload).then(hydrate);
  return decorate(appService.listRewardItems(withAuth(payload)));
}

function queryRewardItem(id) {
  if (isCloudMode()) return callCloud('queryRewardItem', { id }).then(hydrate);
  return decorate(appService.getRewardItem(withAuth({ id })));
}

function redeemReward(payload) {
  if (isCloudMode()) return callCloud('redeemReward', payload);
  return appService.redeemReward(withMutationAuth('redeemReward', payload));
}

function queryRedemptions(payload) {
  if (isCloudMode()) return callCloud('queryRedemptions', payload).then(hydrate);
  return decorate(appService.listRedemptions(withAuth(payload)));
}

function verifyRedemption(payload) {
  if (isCloudMode()) return callCloud('verifyRedemption', payload);
  return appService.verifyRedemption(withMutationAuth('verifyRedemption', payload));
}

function saveRewardItem(payload) {
  if (isCloudMode()) return callCloud('saveRewardItem', payload).then(hydrate);
  return decorate(appService.saveRewardItem(withMutationAuth('saveRewardItem', payload)));
}

function toggleRewardItem(payload) {
  if (isCloudMode()) return callCloud('toggleRewardItem', payload);
  return appService.toggleRewardItem(withMutationAuth('toggleRewardItem', payload));
}

function deleteRewardItem(payload) {
  if (isCloudMode()) return callCloud('deleteRewardItem', payload);
  return appService.deleteRewardItem(withMutationAuth('deleteRewardItem', payload));
}

function requestCancelRedemption(payload) {
  if (isCloudMode()) return callCloud('requestCancelRedemption', payload);
  return appService.requestCancelRedemption(withMutationAuth('requestCancelRedemption', payload));
}

function processCancelRedemption(payload) {
  if (isCloudMode()) return callCloud('processCancelRedemption', payload);
  if (payload.action === 'approve') {
    return appService.approveCancelRedemption(withMutationAuth('processCancelRedemption', {
      redemptionId: payload.redemptionId,
      note: payload.note,
      confirmed: payload.confirmed
    }));
  }
  return appService.rejectCancelRedemption(withMutationAuth('processCancelRedemption', {
    redemptionId: payload.redemptionId,
    reason: payload.note,
    confirmed: payload.confirmed
  }));
}

module.exports = {
  bindAsSponsor,
  bootstrapCoupleMessages,
  bindByInvite,
  centsFromYuan: appService.centsFromYuan,
  cleanupUploadedFile,
  createClientRequestId,
  config,
  deleteRewardItem,
  equipBadges,
  formatMoney: appService.moneyText,
  isCloudMode,
  login,
  markCoupleMessagesRead,
  markEncouragementRead,
  markMilestoneSeen,
  markViewNoticesRead,
  processWithdrawal,
  queryAdventure,
  queryBadges,
  queryCalendarStats,
  queryCompanionDetail,
  queryCoupleMessages,
  queryCoupleStickerCatalog,
  queryCoupleRequestCatalog,
  queryDashboard,
  queryEncouragements,
  queryHistory,
  queryLedgers,
  queryMilestones,
  queryPartnerInvite,
  queryPendingCheckIns,
  queryProfileEditState,
  queryRedemptions,
  queryRewardItem,
  queryRewardItems,
  querySponsorDashboard,
  queryViewNotices,
  queryWeeklyRecap,
  recordCompanionView,
  queryWithdrawals,
  redeemReward,
  requestWithdrawal,
  requestCancelRedemption,
  processCancelRedemption,
  resetDemo: appService.resetDemo,
  reviewCheckIn,
  saveRewardItem,
  saveSubscriptionGrant,
  sendCoupleMessage,
  sendCoupleRequest,
  respondCoupleRequest,
  cancelCoupleRequest,
  sendEncouragement,
  switchRole,
  toggleRewardItem,
  updateAdventureLevels,
  updateRewardRule,
  updateProfile,
  uploadAvatarFile,
  uploadCheckIn,
  uploadCheckInPhoto,
  uploadCoupleMessageImage,
  uploadRewardImage,
  verifyRedemption
};
