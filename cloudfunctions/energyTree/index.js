let cloud = null;
let crypto = null;

if (process.env.NODE_ENV !== 'test') {
  try {
    cloud = require('wx-server-sdk');
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  } catch (error) {
    cloud = null;
  }
}

try {
  crypto = require('crypto');
} catch (error) {
  crypto = null;
}

function loadRuntimeModule(sharedPath, flatPath) {
  try {
    return require(sharedPath);
  } catch (error) {
    if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(flatPath);
  }
}

const appService = loadRuntimeModule('./miniprogram/services/appService', './cloudRuntimeAppService');
const storage = loadRuntimeModule('./miniprogram/services/storage', './cloudRuntimeStorage');
const { createCloudRepository, createCoupleMessageService } = require('./coupleMessages');
const { STICKER_CATALOG } = require('./stickerCatalog');
const { REQUEST_CATALOG } = require('./requestCatalog');
const { createContentSafetyService } = require('./contentSafety');
const { createMediaCheckHandlers } = require('./mediaCheck');

const contentSafety = createContentSafetyService({
  cloud,
  logger: console
});

const STATE_COLLECTION = 'appStates';
const STATE_DOC_ID = 'main';
const STATE_KEY = appService.__private.DB_KEY;
const CLOUD_BUILD_TAG = 'heart-tree-private-v2-20260717-release-final-v1';
const CLOUD_RELEASE_TAG = 'heart-tree-private-v3-20260723-unbind-consent-v1';

const SNAPSHOT_COLLECTIONS = {
  users: 'users',
  relationships: 'relationships',
  checkIns: 'checkIns',
  ledgers: 'rewardLedgers',
  withdrawals: 'claimRequests',
  rewardItems: 'rewardItems',
  redemptions: 'redemptions',
  badges: 'badges',
  badgeUnlocks: 'badgeUnlocks',
  surpriseCards: 'surpriseCards',
  encouragementCards: 'encouragementCards',
  companionViewNotices: 'companionViewNotices',
  subscriptionGrants: 'subscriptionGrants',
  auditLogs: 'auditLogs'
};
const REQUIRED_COLLECTIONS = Array.from(new Set([
  STATE_COLLECTION,
  ...Object.values(SNAPSHOT_COLLECTIONS),
  'rewardRules',
  'growthTreeStates',
  'coupleMessages',
  'coupleMessageInbox',
  'coupleMessageStates',
  'coupleMessageMigrations',
  'mediaCheckTasks'
]));
let collectionsReadyPromise = null;

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomToken() {
  if (crypto && typeof crypto.randomBytes === 'function') {
    return crypto.randomBytes(18).toString('base64url');
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function ensureInviteTokens(relationship) {
  relationship.inviteTokens = relationship.inviteTokens || {};
  if (!relationship.inviteTokens.participant) {
    relationship.inviteTokens.participant = randomToken();
  }
  return relationship.inviteTokens;
}


function collectAuthorizedMediaFileIds(value, result = []) {
  if (!value) return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAuthorizedMediaFileIds(item, result));
    return result;
  }
  if (typeof value !== 'object') return result;
  ['avatarFileId', 'imageFileId', 'photoFileId'].forEach((key) => {
    const fileId = value[key];
    if (typeof fileId === 'string' && fileId.startsWith('cloud://')) result.push(fileId);
  });
  Object.keys(value).forEach((key) => {
    if (value[key] && typeof value[key] === 'object') collectAuthorizedMediaFileIds(value[key], result);
  });
  return result;
}

async function resolveAuthorizedTempUrls(fileIds) {
  const unique = Array.from(new Set(fileIds || []));
  if (!unique.length) return {};
  if (!cloud || typeof cloud.getTempFileURL !== 'function') return {};
  try {
    const response = await cloud.getTempFileURL({ fileList: unique });
    return Object.fromEntries(((response && response.fileList) || [])
      .filter((item) => item && item.fileID && item.tempFileURL && (item.status === 0 || item.status === undefined))
      .map((item) => [item.fileID, item.tempFileURL]));
  } catch (error) {
    console.warn('[energy-tree] authorized media hydration failed', error && error.message);
    return {};
  }
}

async function hydrateAuthorizedMedia(value, resolver = resolveAuthorizedTempUrls) {
  const hydrated = clone(value);
  const fileIds = Array.from(new Set(collectAuthorizedMediaFileIds(hydrated)));
  if (!fileIds.length) return hydrated;
  const urls = await resolver(fileIds);
  function decorate(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(decorate);
      return;
    }
    if (typeof node !== 'object') return;
    if (node.avatarFileId && urls[node.avatarFileId]) node.avatarSrc = urls[node.avatarFileId];
    if (node.imageFileId && urls[node.imageFileId]) node.imageSrc = urls[node.imageFileId];
    if (node.photoFileId && urls[node.photoFileId]) node.photoSrc = urls[node.photoFileId];
    Object.keys(node).forEach((key) => decorate(node[key]));
  }
  decorate(hydrated);
  return hydrated;
}

function getDb() {
  if (!cloud || typeof cloud.database !== 'function') {
    throw new Error('云函数环境无法连接云数据库');
  }
  return cloud.database();
}

async function ensureCollections() {
  if (collectionsReadyPromise) return collectionsReadyPromise;
  const db = getDb();
  if (typeof db.createCollection !== 'function') {
    collectionsReadyPromise = Promise.resolve();
    return collectionsReadyPromise;
  }
  collectionsReadyPromise = Promise.all(REQUIRED_COLLECTIONS.map((collectionName) => (
    db.createCollection(collectionName).catch((error) => {
      const message = [
        error && error.message,
        error && error.errMsg,
        error && error.errCode,
        error && error.code
      ].filter(Boolean).join(' ');
      const code = String((error && (error.errCode || error.code)) || '');
      if (
        message.includes('already exists')
        || message.includes('collection exists')
        || message.includes('Table exist')
        || message.includes('ResourceExist')
        || message.includes('DATABASE_COLLECTION_ALREADY_EXIST')
        || message.includes('已存在')
        || code.includes('DATABASE_COLLECTION_ALREADY_EXIST')
      ) {
        return null;
      }
      throw error;
    })
  ))).catch((error) => {
    collectionsReadyPromise = null;
    throw error;
  });
  return collectionsReadyPromise;
}

function getAuthContext(event) {
  if (cloud && typeof cloud.getWXContext === 'function') {
    const wxContext = cloud.getWXContext();
    if (wxContext && wxContext.OPENID) return { openid: wxContext.OPENID };
  }
  // Test-only fallback: production cloud functions must never trust client-sent openid fields.
  if (
    process.env.NODE_ENV === 'test'
    && process.env.ENERGY_TREE_ALLOW_TEST_AUTH === '1'
    && event
    && event.__testOpenid
  ) {
    return { openid: event.__testOpenid };
  }
  throw new Error('云函数环境无法获取可信 openid');
}

function createCloudInitialState() {
  const state = appService.__private.createInitialState();
  const relationship = state.relationships[0];
  const sponsor = state.users.find((item) => item.id === relationship.sponsorId);
  const participant = state.users.find((item) => item.id === relationship.participantId);

  sponsor.name = '男朋友';
  sponsor.openid = '';
  participant.name = '小鹿';
  participant.openid = '';
  relationship.sponsorOpenid = '';
  relationship.participantOpenid = '';
  relationship.inviteTokens = {
    participant: randomToken()
  };
  state.currentRole = 'participant';
  state.meta.cloudMode = true;
  state.meta.createdAt = nowIso();
  return state;
}

async function loadCloudState(dbOverride) {
  const db = dbOverride || getDb();
  if (!dbOverride) await ensureCollections();
  let doc = null;
  try {
    doc = await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).get();
  } catch (error) {
    if (!isDocumentNotFound(error)) throw error;
  }
  if (doc && doc.data && doc.data.state) return doc.data.state;
  return runStateMutationTransaction(db, async (state) => clone(state));
}

function createProjectionSnapshot(state) {
  const snapshot = {};
  Object.keys(SNAPSHOT_COLLECTIONS).forEach((key) => {
    (state[key] || []).forEach((item) => {
      if (!item || !item.id) return;
      const collectionName = SNAPSHOT_COLLECTIONS[key];
      snapshot[`${collectionName}/${item.id}`] = {
        collectionName,
        id: item.id,
        data: clone(item)
      };
    });
  });
  (state.relationships || []).forEach((relationship) => {
    snapshot[`rewardRules/${relationship.id}`] = {
      collectionName: 'rewardRules',
      id: relationship.id,
      data: {
        id: relationship.id,
        relationshipId: relationship.id,
        rule: clone(relationship.rewardRule)
      }
    };
    snapshot[`growthTreeStates/${relationship.id}`] = {
      collectionName: 'growthTreeStates',
      id: relationship.id,
      data: {
        id: relationship.id,
        relationshipId: relationship.id,
        balance: clone(relationship.balance),
        tree: clone(relationship.tree),
        adventure: clone(relationship.adventure)
      }
    };
  });
  return snapshot;
}

function diffProjectionSnapshots(beforeState, nextState) {
  const before = beforeState ? createProjectionSnapshot(beforeState) : {};
  const next = createProjectionSnapshot(nextState);
  const sets = Object.keys(next)
    .filter((path) => !before[path] || JSON.stringify(before[path].data) !== JSON.stringify(next[path].data))
    .map((path) => next[path]);
  const removes = Object.keys(before)
    .filter((path) => !next[path])
    .map((path) => before[path]);
  return { sets, removes };
}

async function removeTransactionDocument(document) {
  if (typeof document.remove === 'function') return document.remove();
  if (typeof document.delete === 'function') return document.delete();
  throw new Error('当前数据库事务不支持删除文档');
}

async function applyProjectionChanges(transaction, changes, syncedAt) {
  for (const item of changes.sets) {
    await transaction.collection(item.collectionName).doc(item.id).set({
      data: {
        ...item.data,
        syncedAt
      }
    });
  }
  for (const item of changes.removes) {
    await removeTransactionDocument(transaction.collection(item.collectionName).doc(item.id));
  }
}

function isDocumentNotFound(error) {
  const text = [
    error && error.message,
    error && error.errMsg,
    error && error.code,
    error && error.errCode
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes('not found')
    || text.includes('document_not_exists')
    || text.includes('document not exists')
    || text.includes('找不到')
    || text.includes('不存在');
}

function unwrapTransactionResult(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'result')) return response.result;
  return response;
}

async function runStateMutationTransaction(db, task) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new Error('当前云数据库不支持事务，请升级并重新部署云函数依赖');
  }
  const response = await db.runTransaction(async (transaction) => {
    const stateDocument = transaction.collection(STATE_COLLECTION).doc(STATE_DOC_ID);
    let stored = null;
    try {
      stored = await stateDocument.get();
    } catch (error) {
      if (!isDocumentNotFound(error)) throw error;
    }
    const hasStoredState = Boolean(stored && stored.data && stored.data.state);
    const state = hasStoredState ? stored.data.state : createCloudInitialState();
    const beforeState = clone(state);
    const scoped = await storage.runWithScopedStorage({ [STATE_KEY]: state }, async () => task(state));
    const nextState = scoped.values[STATE_KEY] || state;
    const changed = !hasStoredState || JSON.stringify(nextState) !== JSON.stringify(beforeState);
    if (changed) {
      const updatedAt = nowIso();
      await stateDocument.set({
        data: {
          state: nextState,
          updatedAt
        }
      });
      await applyProjectionChanges(
        transaction,
        diffProjectionSnapshots(hasStoredState ? beforeState : null, nextState),
        updatedAt
      );
    }
    return scoped.result;
  });
  return unwrapTransactionResult(response);
}

function findCurrentUser(state, openid) {
  return state.users.find((user) => user.openid === openid);
}

function bindingRequiredPayload(state) {
  const relationship = state && state.relationships && state.relationships[0];
  const relationshipFrozen = Boolean(relationship && relationship.lifecycleStatus === 'frozen');
  return {
    needsBinding: true,
    currentRole: 'guest',
    currentUser: {
      name: '未绑定',
      avatarText: '?'
    },
    relationship: null,
    bindingStatus: relationship ? {
      sponsorBound: Boolean(relationship.sponsorOpenid),
      participantBound: Boolean(relationship.participantOpenid),
      relationshipFrozen,
      canCreateSponsor: !relationshipFrozen && !relationship.sponsorOpenid
    } : {
      sponsorBound: false,
      participantBound: false,
      relationshipFrozen: false,
      canCreateSponsor: true
    },
    message: relationshipFrozen
      ? '旧关系已冻结并保留历史数据；如需建立新关系，请由云环境所有者执行独立初始化'
      : '请先创建或通过分享邀请加入情侣能量树'
  };
}

function assertBound(state, openid) {
  const user = findCurrentUser(state, openid);
  if (!user) {
    const error = new Error('请先创建或通过分享邀请加入情侣能量树');
    error.code = 'NEEDS_BINDING';
    throw error;
  }
  return user;
}

function bindRole(state, relationship, role, openid, displayName, auditAction) {
  const targetId = role === 'sponsor' ? relationship.sponsorId : relationship.participantId;
  const target = state.users.find((user) => user.id === targetId);
  const occupiedOpenid = role === 'sponsor' ? relationship.sponsorOpenid : relationship.participantOpenid;
  if (!target) throw new Error('找不到要绑定的身份');
  if (occupiedOpenid && occupiedOpenid !== openid) throw new Error('这个身份已经绑定过了');

  const previous = findCurrentUser(state, openid);
  if (previous && previous.id !== target.id) throw new Error('当前微信已经绑定了另一种身份');

  target.openid = openid;
  if (displayName) target.name = displayName;
  if (role === 'sponsor') relationship.sponsorOpenid = openid;
  if (role === 'participant') relationship.participantOpenid = openid;
  state.auditLogs.push({
    id: `audit_${Date.now()}`,
    relationshipId: relationship.id,
    actorOpenid: openid,
    action: auditAction || `identity.bind.${role}`,
    targetId: target.id,
    amountCents: 0,
    note: displayName || target.name,
    createdAt: nowIso()
  });
  appService.saveState(state);
  return appService.getDashboard({ authContext: { openid } });
}

function runCloudIdentityMutation(state, payload, openid, action, handler) {
  return appService.__private.runMutationWithReceipt(action, {
    ...(payload || {}),
    authContext: { openid }
  }, handler, {
    actorOpenid: openid
  });
}

function bindAsSponsor(state, payload, openid) {
  return runCloudIdentityMutation(state, payload, openid, 'identity.createSponsor', () => {
    const relationship = state.relationships[0];
    if (relationship.lifecycleStatus === 'frozen') {
      throw new Error('旧关系已冻结，不能重新绑定；新关系需要独立初始化');
    }
    const displayName = String((payload && payload.displayName) || '').trim();
    if (relationship.sponsorOpenid && relationship.sponsorOpenid !== openid) {
      throw new Error('这棵能量树已经有发起者了，请让对方从小程序内分享邀请给你');
    }
    ensureInviteTokens(relationship);
    return bindRole(state, relationship, 'sponsor', openid, displayName || '男朋友', 'identity.createSponsor');
  });
}

function bindByInvite(state, payload, openid) {
  return runCloudIdentityMutation(state, payload, openid, 'identity.bind.participant', () => {
    const relationship = state.relationships[0];
    if (relationship.lifecycleStatus === 'frozen') {
      throw new Error('旧关系已冻结，不能通过旧邀请重新绑定');
    }
    const inviteToken = String((payload && payload.inviteToken) || '').trim();
    const displayName = String((payload && payload.displayName) || '').trim();
    const inviteTokens = relationship.inviteTokens || {};
    let role = '';
    if (inviteToken && inviteToken === inviteTokens.participant) role = 'participant';
    if (!role) throw new Error('邀请已失效，请让对方重新从小程序内分享邀请给你');

    const dashboard = bindRole(state, relationship, role, openid, displayName, `identity.bind.${role}`);
    relationship.inviteTokens = {
      ...relationship.inviteTokens,
      participant: randomToken()
    };
    appService.saveState(state);
    return dashboard;
  });
}

function generatePartnerInvite(state, payload, openid) {
  return runCloudIdentityMutation(state, payload, openid, 'identity.generateInvite', () => {
    const relationship = state.relationships[0];
    if (relationship.lifecycleStatus === 'frozen') {
      throw new Error('旧关系已冻结，不能生成新的绑定邀请');
    }
    if (relationship.unbindRequest && relationship.unbindRequest.status === 'pending') {
      throw new Error('关系解除申请等待双方确认中，不能生成新的绑定邀请');
    }
    assertBound(state, openid);
    const actor = appService.getState().users.find((user) => user.openid === openid);
    if (!actor || actor.openid !== relationship.sponsorOpenid) {
      throw new Error('只有赞助者可以邀请另一半加入');
    }
    const tokens = ensureInviteTokens(relationship);
    appService.saveState(state);
    return {
      id: relationship.id,
      role: 'participant',
      inviteToken: tokens.participant,
      title: '邀请你加入我们的心动能量树',
      path: `/pages/bind/bind?inviteRole=participant&inviteToken=${encodeURIComponent(tokens.participant)}`
    };
  });
}

async function trySendCompanionViewSubscription(state, notice) {
  if (!notice || notice.deduped) return notice;
  const stored = state.companionViewNotices.find((item) => item.id === notice.id);
  if (!stored) return notice;
  stored.subscriptionStatus = 'not_configured';
  delete stored.subscriptionError;
  return {
    ...notice,
    subscriptionStatus: stored.subscriptionStatus
  };
}

async function runWithCloudState(event, task, options = {}) {
  const authContext = getAuthContext(event);
  const db = options.db || getDb();
  if (!options.db) await ensureCollections();
  if (options.mutation) {
    return runStateMutationTransaction(db, async (state) => task(state, authContext));
  }
  const state = await loadCloudState(db);
  const beforeState = JSON.stringify(state);
  const scoped = await storage.runWithScopedStorage({ [STATE_KEY]: state }, async () => task(state, authContext));
  const nextState = scoped.values[STATE_KEY] || state;
  if (JSON.stringify(nextState) !== beforeState) {
    throw new Error('只读云函数动作修改了业务状态，请改为事务写动作');
  }
  return scoped.result;
}

async function dispatchAction(action, payload, state, authContext) {
  assertBound(state, authContext.openid);
  switch (action) {
    case 'reviewCheckIn':
      if (payload.decision === 'approved') {
        return appService.approveCheckIn({
          checkInId: payload.checkInId,
          praise: payload.note,
          clientRequestId: payload.clientRequestId,
          authContext
        });
      }
      return appService.rejectCheckIn({
        checkInId: payload.checkInId,
        reason: payload.note,
        clientRequestId: payload.clientRequestId,
        authContext
      });
    case 'processWithdrawal':
      if (payload.action === 'approve') {
        return appService.approveWithdrawal({
          withdrawalId: payload.withdrawalId,
          clientRequestId: payload.clientRequestId,
          authContext
        });
      }
      if (payload.action === 'mark_paid') {
        return appService.markWithdrawalPaid({
          withdrawalId: payload.withdrawalId,
          transferNote: payload.note,
          confirmed: payload.confirmed,
          clientRequestId: payload.clientRequestId,
          authContext
        });
      }
      return appService.rejectWithdrawal({
        withdrawalId: payload.withdrawalId,
        reason: payload.note,
        confirmed: payload.confirmed,
        clientRequestId: payload.clientRequestId,
        authContext
      });
    case 'processCancelRedemption':
      if (payload.action === 'approve') {
        return appService.approveCancelRedemption({
          redemptionId: payload.redemptionId,
          note: payload.note,
          confirmed: payload.confirmed,
          clientRequestId: payload.clientRequestId,
          authContext
        });
      }
      return appService.rejectCancelRedemption({
        redemptionId: payload.redemptionId,
        reason: payload.note,
        confirmed: payload.confirmed,
        clientRequestId: payload.clientRequestId,
        authContext
      });
    default:
      throw new Error(`未知云函数动作：${action}`);
  }
}

const READ_ONLY_ACTIONS = new Set([
  'login',
  'queryDashboard',
  'queryAdventure',
  'queryBadges',
  'queryCalendarStats',
  'queryProfileEditState',
  'querySponsorDashboard',
  'queryViewNotices',
  'queryLedgers',
  'queryHistory',
  'queryPendingCheckIns',
  'queryWithdrawals',
  'queryRewardItems',
  'queryRewardItem',
  'queryRedemptions',
  'queryEncouragements',
  'queryMilestones',
  'queryWeeklyRecap'
]);

function isMutationAction(action, payload = {}) {
  if (action === 'queryCompanionDetail') return payload.recordView !== false;
  return !READ_ONLY_ACTIONS.has(action);
}

async function handleStateAction(event) {
  const action = event && event.action;
  const payload = (event && event.payload) || {};

  return runWithCloudState(event, async (state, authContext) => {
    const input = {
      ...payload,
      authContext
    };

    if (action === 'login' || action === 'queryDashboard') {
      return findCurrentUser(state, authContext.openid)
        ? appService.getDashboard(input)
        : bindingRequiredPayload(state);
    }

    if (action === 'bindAsSponsor') {
      return bindAsSponsor(state, payload, authContext.openid);
    }

    if (action === 'bindByInvite') {
      return bindByInvite(state, payload, authContext.openid);
    }

    assertBound(state, authContext.openid);

    switch (action) {
      case 'queryAdventure':
        return appService.getAdventure(input);
      case 'queryBadges':
        return appService.getBadgeWall(input);
      case 'queryCalendarStats':
        return appService.getCalendarStats(input);
      case 'queryProfileEditState':
        return appService.getProfileEditState(input);
      case 'updateProfile':
        return appService.updateProfile(input);
      case 'equipBadges':
        return appService.equipBadges(input);
      case 'querySponsorDashboard':
        return appService.querySponsorDashboard(input);
      case 'queryCompanionDetail': {
        const result = appService.queryCompanionDetail(input);
        if (result.notice) {
          const nextState = appService.getState();
          result.notice = await trySendCompanionViewSubscription(nextState, result.notice);
          appService.saveState(nextState);
        }
        return result;
      }
      case 'recordCompanionView': {
        const notice = appService.recordCompanionView(input);
        const nextState = appService.getState();
        const sentNotice = await trySendCompanionViewSubscription(nextState, notice);
        appService.saveState(nextState);
        return sentNotice;
      }
      case 'queryViewNotices':
        return appService.listViewNotices(input);
      case 'markViewNoticesRead':
        return appService.markViewNoticesRead(input);
      case 'saveSubscriptionGrant':
        return appService.saveSubscriptionGrant(input);
      case 'queryLedgers':
        return appService.listLedgers(input);
      case 'queryHistory':
        return appService.listHistory(input);
      case 'queryPendingCheckIns':
        return appService.listPendingCheckIns(input);
      case 'queryWithdrawals':
        return appService.listWithdrawals(input);
      case 'queryRewardItems':
        return appService.listRewardItems(input);
      case 'queryRewardItem':
        return appService.getRewardItem(input);
      case 'queryRedemptions':
        return appService.listRedemptions(input);
      case 'queryEncouragements':
        return appService.queryEncouragements(input);
      case 'queryMilestones':
        return appService.queryMilestones(input);
      case 'queryWeeklyRecap':
        return appService.queryWeeklyRecap(input);
      case 'requestRelationshipUnbind':
        return appService.requestRelationshipUnbind(input);
      case 'cancelRelationshipUnbind':
        return appService.cancelRelationshipUnbind(input);
      case 'confirmRelationshipUnbind':
        return appService.confirmRelationshipUnbind(input);
      case 'generatePartnerInvite':
        return generatePartnerInvite(state, payload, authContext.openid);
      case 'sendEncouragement':
        return appService.sendEncouragement(input);
      case 'markEncouragementRead':
        return appService.markEncouragementRead(input);
      case 'markMilestoneSeen':
        return appService.markMilestoneSeen(input);
      case 'submitCheckIn':
        return appService.submitCheckIn(input);
      case 'reviewCheckIn':
        return dispatchAction(action, payload, state, authContext);
      case 'requestWithdrawal':
        return appService.requestWithdrawal(input);
      case 'processWithdrawal':
        return dispatchAction(action, payload, state, authContext);
      case 'updateRewardRule':
        return appService.updateRewardRule(input);
      case 'updateAdventureLevels':
        return appService.updateAdventureLevels(input);
      case 'redeemReward':
        return appService.redeemReward(input);
      case 'verifyRedemption':
        return appService.verifyRedemption(input);
      case 'requestCancelRedemption':
        return appService.requestCancelRedemption(input);
      case 'processCancelRedemption':
        return dispatchAction(action, payload, state, authContext);
      case 'saveRewardItem':
        return appService.saveRewardItem(input);
      case 'toggleRewardItem':
        return appService.toggleRewardItem(input);
      case 'deleteRewardItem':
        return appService.deleteRewardItem(input);
      default:
        throw new Error(`未知云函数动作：${action}`);
    }
  }, {
    mutation: isMutationAction(action, payload)
  });
}


const COUPLE_MESSAGE_ACTIONS = new Set([
  'bootstrapCoupleMessages',
  'queryCoupleMessages',
  'queryCoupleStickerCatalog',
  'queryCoupleRequestCatalog',
  'sendCoupleMessage',
  'sendCoupleRequest',
  'respondCoupleRequest',
  'cancelCoupleRequest',
  'markCoupleMessagesRead'
]);

function resolveCoupleMessageContext(state, openid) {
  const currentUser = assertBound(state, openid);
  const relationship = (state.relationships || []).find((item) => (
    item.sponsorId === currentUser.id || item.participantId === currentUser.id
  ));
  if (!relationship) throw new Error('找不到当前情侣关系');
  if (relationship.lifecycleStatus === 'frozen') throw new Error('旧关系已冻结，不能继续访问信笺');
  if (relationship.unbindRequest && relationship.unbindRequest.status === 'releasing') {
    throw new Error('关系解除正在安全收尾，信笺互动已暂停');
  }
  const currentRole = currentUser.id === relationship.sponsorId ? 'sponsor' : 'participant';
  const companionId = currentRole === 'sponsor' ? relationship.participantId : relationship.sponsorId;
  const companionUser = (state.users || []).find((item) => item.id === companionId) || null;
  const currentOpenid = currentRole === 'sponsor' ? relationship.sponsorOpenid : relationship.participantOpenid;
  const companionOpenid = currentRole === 'sponsor' ? relationship.participantOpenid : relationship.sponsorOpenid;
  return {
    relationship,
    currentRole,
    currentUser: { ...currentUser, role: currentRole, openid: currentOpenid || currentUser.openid },
    companionUser: companionUser ? {
      ...companionUser,
      role: currentRole === 'sponsor' ? 'participant' : 'sponsor',
      openid: companionOpenid || companionUser.openid || ''
    } : null
  };
}

function createCloudMessageService(db) {
  return createCoupleMessageService({
    repository: createCloudRepository({ db, command: db.command }),
    now: nowIso,
    stickerCatalog: STICKER_CATALOG,
    requestCatalog: REQUEST_CATALOG
  });
}

async function markCoupleMessagesRead({
  event,
  context,
  service,
  markLegacyViewNoticesRead,
  reloadContext
}) {
  let activeContext = context;
  if (activeContext.currentRole === 'participant') {
    await markLegacyViewNoticesRead(event);
    activeContext = await reloadContext();
  }
  return service.markRead({ context: activeContext });
}

async function handleCoupleMessageAction(event) {
  const action = event.action;
  const payload = event.payload || {};
  const authContext = getAuthContext(event);
  const db = getDb();
  await ensureCollections();
  let state = await loadCloudState(db);
  let context = resolveCoupleMessageContext(state, authContext.openid);
  const service = createCloudMessageService(db);

  if (action === 'bootstrapCoupleMessages') {
    return service.bootstrap({ context, state });
  }
  if (action === 'queryCoupleMessages') {
    return service.query({ context, beforeSortKey: payload.beforeSortKey, limit: payload.limit });
  }
  if (action === 'queryCoupleStickerCatalog') {
    return { stickers: STICKER_CATALOG };
  }
  if (action === 'queryCoupleRequestCatalog') {
    return { requests: REQUEST_CATALOG };
  }
  if (action === 'sendCoupleMessage') {
    return service.send({
      context,
      contentType: payload.contentType,
      content: payload.content,
      imageFileId: payload.imageFileId,
      imageWidth: payload.imageWidth,
      imageHeight: payload.imageHeight,
      stickerId: payload.stickerId,
      clientRequestId: payload.clientRequestId
    });
  }
  if (action === 'sendCoupleRequest') {
    return service.sendRequest({
      context,
      requestTemplateId: payload.requestTemplateId,
      customRequestText: payload.customRequestText,
      clientRequestId: payload.clientRequestId
    });
  }
  if (action === 'respondCoupleRequest') {
    return service.respondRequest({
      context,
      requestMessageId: payload.requestMessageId,
      decision: payload.decision,
      clientRequestId: payload.clientRequestId
    });
  }
  if (action === 'cancelCoupleRequest') {
    return service.cancelRequest({
      context,
      requestMessageId: payload.requestMessageId,
      clientRequestId: payload.clientRequestId
    });
  }
  if (action === 'markCoupleMessagesRead') {
    return markCoupleMessagesRead({
      event,
      context,
      service,
      markLegacyViewNoticesRead: async () => {
        await runWithCloudState(event, async (_state, trustedAuthContext) => {
          return appService.markViewNoticesRead({ authContext: trustedAuthContext, noticeIds: [] });
        }, { mutation: true });
      },
      reloadContext: async () => {
        state = await loadCloudState(db);
        return resolveCoupleMessageContext(state, authContext.openid);
      }
    });
  }
  throw new Error(`未知云函数动作：${action}`);
}

async function revokeRelationshipRealtimeAccess(db, relationshipId, openids, revokedAt = nowIso()) {
  const trustedRelationshipId = String(relationshipId || '').trim();
  const trustedOpenids = Array.from(new Set((openids || []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (!trustedRelationshipId || !trustedOpenids.length) {
    throw new Error('关系实时访问撤销参数不完整');
  }

  let updated = 0;
  for (const collectionName of ['coupleMessageInbox', 'coupleMessageStates']) {
    for (const recipientOpenid of trustedOpenids) {
      while (true) {
        const response = await db.collection(collectionName)
          .where({ relationshipId: trustedRelationshipId, recipientOpenid })
          .limit(100)
          .get();
        const rows = (response && response.data) || [];
        if (!rows.length) break;
        for (const row of rows) {
          if (!row || !row._id) throw new Error('信笺访问投影缺少文档标识，无法安全撤销');
          await db.collection(collectionName).doc(row._id).update({
            data: {
              recipientOpenid: '',
              accessRevokedAt: revokedAt
            }
          });
          updated += 1;
        }
        if (rows.length < 100) break;
      }
    }
  }
  return { updated };
}

async function assertNoPendingMediaChecks(db, relationshipId) {
  const response = await db.collection('mediaCheckTasks')
    .where({
      relationshipId: String(relationshipId || '').trim(),
      status: 'pending'
    })
    .limit(1)
    .get();
  if (response && response.data && response.data.length) {
    throw new Error('仍有图片内容安全检查待完成，请稍后再解除关系');
  }
}

function relationshipForTrustedOpenid(state, openid) {
  const currentUser = assertBound(state, openid);
  const relationship = (state.relationships || []).find((item) => (
    item.sponsorId === currentUser.id || item.participantId === currentUser.id
  ));
  if (!relationship) throw new Error('找不到当前情侣关系');
  return relationship;
}

async function handleRelationshipUnbindRequest(event) {
  const authContext = getAuthContext(event);
  const db = getDb();
  await ensureCollections();
  const state = await loadCloudState(db);
  const relationship = relationshipForTrustedOpenid(state, authContext.openid);
  await assertNoPendingMediaChecks(db, relationship.id);
  return handleStateAction(event);
}

async function handleRelationshipUnbindConfirmation(event) {
  const payload = (event && event.payload) || {};
  const db = getDb();
  await ensureCollections();
  const authContext = getAuthContext(event);
  const initialState = await loadCloudState(db);
  const existingReceipt = appService.__private.findOperationReceipt(
    initialState,
    'relationship.unbind.confirm',
    {
      ...payload,
      authContext
    }
  );
  if (existingReceipt) {
    return {
      deduped: true,
      released: true,
      needsBinding: true,
      relationshipId: existingReceipt.targetId,
      targetId: existingReceipt.targetId,
      action: existingReceipt.action,
      revision: Number((initialState.meta && initialState.meta.revision) || 0),
      message: '关系已解除；重复请求未再次执行'
    };
  }

  await runWithCloudState(event, async (_state, authContext) => {
    return appService.__private.beginRelationshipUnbindConfirmation({
      ...payload,
      authContext
    });
  }, { mutation: true });

  const state = await loadCloudState(db);
  const validation = appService.__private.validateRelationshipUnbindConfirmation(state, {
    ...payload,
    authContext
  });

  await assertNoPendingMediaChecks(db, validation.relationshipId);
  await revokeRelationshipRealtimeAccess(
    db,
    validation.relationshipId,
    validation.relationshipOpenids
  );
  return runWithCloudState(event, async (_state, trustedAuthContext) => {
    return appService.completeRelationshipUnbind({
      ...payload,
      authContext: trustedAuthContext
    });
  }, { mutation: true });
}

async function projectLegacyMessageBestEffort(event, action, result) {
  const legacy = action === 'sendEncouragement'
    ? result
    : (action === 'recordCompanionView' ? result : result && result.notice);
  if (!legacy || !legacy.id) return;
  try {
    const authContext = getAuthContext(event);
    const db = getDb();
    const state = await loadCloudState(db);
    const context = resolveCoupleMessageContext(state, authContext.openid);
    const service = createCloudMessageService(db);
    if (action === 'sendEncouragement') {
      await service.projectLegacy({
        context,
        type: 'encouragement',
        sourceType: 'encouragement',
        sourceId: legacy.id,
        senderUserId: legacy.senderUserId,
        recipientUserId: legacy.recipientUserId,
        content: legacy.message,
        readAt: legacy.readAt,
        createdAt: legacy.createdAt
      });
      return;
    }
    await service.projectLegacy({
      context,
      type: 'system',
      sourceType: 'companionView',
      sourceId: legacy.id,
      senderUserId: legacy.viewerUserId,
      recipientUserId: legacy.targetUserId,
      content: legacy.message,
      readAt: legacy.readAt,
      createdAt: legacy.createdAt
    });
  } catch (error) {
    console.warn('[energy-tree] message projection deferred to bootstrap', {
      action,
      sourceId: legacy.id,
      message: error && error.message
    });
  }
}

async function handleAction(event) {
  if (COUPLE_MESSAGE_ACTIONS.has(event && event.action)) {
    return handleCoupleMessageAction(event || {});
  }
  if (event && event.action === 'requestRelationshipUnbind') {
    return handleRelationshipUnbindRequest(event);
  }
  if (event && event.action === 'confirmRelationshipUnbind') {
    return handleRelationshipUnbindConfirmation(event);
  }
  const result = await handleStateAction(event || {});
  if (['sendEncouragement', 'recordCompanionView', 'queryCompanionDetail'].includes(event && event.action)) {
    await projectLegacyMessageBestEffort(event || {}, event.action, result);
  }
  return result;
}

async function handleAuthorizedAction(event, options = {}) {
  const actionHandler = options.actionHandler || handleAction;
  const hydrate = options.hydrate || hydrateAuthorizedMedia;
  const safety = options.contentSafety || contentSafety;
  const authResolver = options.authResolver || getAuthContext;
  const safeEvent = event || {};
  const authContext = authResolver(safeEvent);

  const safetyResult = await safety.assertEventAllowed({
    action: safeEvent.action,
    payload: safeEvent.payload || {},
    openid: authContext.openid
  });

  const result = await actionHandler(safeEvent);
  if (safetyResult && Array.isArray(safetyResult.imageChecks) && safetyResult.imageChecks.length) {
    const recorder = options.recordPendingMediaChecks || recordPendingMediaChecks;
    await recorder(safeEvent, authContext, safetyResult.imageChecks)
      .catch((error) => console.error('[energy-tree] record media check tasks failed', error && (error.code || error.message)));
  }
  return hydrate(result);
}

const {
  handleMediaCheckResult,
  hideRiskyStateMedia,
  recordPendingMediaChecks
} = createMediaCheckHandlers({
  appService,
  cloud,
  createCloudMessageService,
  ensureCollections,
  getDb,
  loadCloudState,
  logger: console,
  nowIso,
  randomToken,
  runStateMutationTransaction
});

exports.main = async (event) => {
  if (event && event.MsgType === 'event' && event.Event === 'wxa_media_check') {
    try {
      await handleMediaCheckResult(event);
    } catch (error) {
      console.error('[energy-tree] media check callback failed', error && (error.code || error.message));
    }
    return { ErrCode: 0, ErrMsg: 'success' };
  }
  try {
    return {
      ok: true,
      buildTag: CLOUD_BUILD_TAG,
      releaseTag: CLOUD_RELEASE_TAG,
      data: await handleAuthorizedAction(event || {})
    };
  } catch (error) {
    return {
      ok: false,
      code: error.code || 'ENERGY_TREE_ERROR',
      message: error.message || '云端请求失败',
      buildTag: CLOUD_BUILD_TAG,
      releaseTag: CLOUD_RELEASE_TAG
    };
  }
};

exports.__private = {
  COUPLE_MESSAGE_ACTIONS,
  assertNoPendingMediaChecks,
  bindAsSponsor,
  bindByInvite,
  bindingRequiredPayload,
  createCloudInitialState,
  createProjectionSnapshot,
  diffProjectionSnapshots,
  dispatchAction,
  generatePartnerInvite,
  getAuthContext,
  handleAuthorizedAction,
  handleCoupleMessageAction,
  handleMediaCheckResult,
  handleRelationshipUnbindRequest,
  handleRelationshipUnbindConfirmation,
  hideRiskyStateMedia,
  hydrateAuthorizedMedia,
  isMutationAction,
  markCoupleMessagesRead,
  projectLegacyMessageBestEffort,
  recordPendingMediaChecks,
  resolveCoupleMessageContext,
  revokeRelationshipRealtimeAccess,
  runWithCloudState,
  runStateMutationTransaction,
  trySendCompanionViewSubscription
};
