const {
  AMOUNT_LIMITS,
  CHECKIN_STATUS,
  DEFAULT_ADVENTURE_LEVELS,
  DEFAULT_BADGES,
  DEFAULT_REWARD_RULE,
  DEFAULT_REWARD_ITEMS,
  DEMO_IDS,
  LEDGER_STATUS,
  PROFILE_EDIT_EXTRA_COST_CENTS,
  REDEMPTION_STATUS,
  WITHDRAWAL_STATUS
} = require('../core/models');
const rewardEngine = require('../core/rewardEngine');
const { chinaDateTimeParts, chinaWeekRange, displayDate, monthKey, parseDateKey, todayKey } = require('../utils/date');
const payoutProvider = require('./manualPayoutProvider');
const storage = require('./storage');
const {
  centsFromYuan,
  clientRequestIdFromInput,
  requireConfirmed,
  validateCents,
  validateCheckInPhotoFileId,
  validateNickname,
  validateOptionalDurationMinutes,
  validateRewardRule,
  validateText
} = require('./inputPolicy');

const DB_KEY = 'energy_tree_state_v1';
let nowOverride = null;

const ENCOURAGEMENT_TEMPLATES = Object.freeze({
  hug: {
    title: '抱抱送达',
    message: '今天也辛苦啦，先收下一个不催进度的抱抱。'
  },
  praise: {
    title: '认真夸夸',
    message: '你的每一点努力我都有看见，愿意开始就已经很棒。'
  },
  workout: {
    title: '陪你动一动',
    message: '想运动的时候叫上我，我们一起散步、拉伸或慢慢练。'
  },
  gentle: {
    title: '今天轻松一点',
    message: '状态普通也没关系，照顾好自己比完成多少更重要。'
  },
  date: {
    title: '小约会预告',
    message: '等你舒服地完成这一小步，我们安排一场只属于两个人的小约会。'
  }
});

const MILESTONE_PRIORITIES = Object.freeze({
  map_level_complete: 100,
  badge_unlock: 90,
  streak_14: 88,
  streak_7: 86,
  energy_520: 84,
  energy_300: 82,
  streak_3: 80,
  energy_100: 78,
  first_redemption: 76,
  wish_fund_complete: 74,
  cash_overflow_love_pack: 72,
  first_checkin: 70,
  checkin_surprise: 40
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeById(defaultItems, existingItems) {
  const existingById = new Map((existingItems || []).map((item) => [item.id, item]));
  const merged = (defaultItems || []).map((item) => ({
    ...item,
    ...(existingById.get(item.id) || {})
  }));
  (existingItems || []).forEach((item) => {
    if (!merged.some((mergedItem) => mergedItem.id === item.id)) {
      merged.push(item);
    }
  });
  return merged;
}

function nowMs() {
  return nowOverride === null ? Date.now() : nowOverride;
}

function nowIso() {
  return new Date(nowMs()).toISOString();
}

function setNowForTests(value) {
  nowOverride = value === null || value === undefined ? null : new Date(value).getTime();
  if (nowOverride !== null && !Number.isFinite(nowOverride)) {
    nowOverride = null;
    throw new Error('测试时钟必须是有效日期');
  }
}

function createDefaultAdventure() {
  return {
    currentLevelId: DEFAULT_ADVENTURE_LEVELS[0].id,
    levelProgress: 0,
    totalSteps: 0,
    completedLevelIds: [],
    lastCompletedLevelId: null,
    completedAt: null,
    postCompletionSteps: 0
  };
}

function createDefaultTree() {
  return {
    sunshine: 0,
    fruits: 0,
    level: 1,
    levelTitle: '发芽',
    progressPercent: 0,
    streak: 0,
    lastApprovedDate: null,
    lastCard: null
  };
}

function createDefaultBalance() {
  return {
    availableCents: 0,
    frozenCents: 0,
    paidOutCents: 0
  };
}

function createDefaultProfileEditUsage(currentMonth = monthKey()) {
  return {
    nickname: {
      monthKey: currentMonth,
      freeUsed: false,
      paidCount: 0
    },
    avatar: {
      monthKey: currentMonth,
      freeUsed: false,
      paidCount: 0
    }
  };
}

function createDefaultUser(input) {
  const name = input.name || (input.role === 'sponsor' ? '男朋友' : '小鹿');
  return {
    id: input.id,
    name,
    role: input.role,
    openid: input.openid || '',
    avatarText: input.avatarText || name.slice(0, 1),
    avatarFileId: input.avatarFileId || '',
    avatarUrl: input.avatarUrl || '',
    profileEditUsage: input.profileEditUsage || createDefaultProfileEditUsage()
  };
}

function createInitialState() {
  return {
    version: 4,
    currentRole: 'participant',
    activeRelationshipId: DEMO_IDS.relationship,
    users: [
      createDefaultUser({
        id: DEMO_IDS.participant,
        name: '小鹿',
        role: 'participant',
        openid: 'demo_openid_participant',
        avatarText: '她'
      }),
      createDefaultUser({
        id: DEMO_IDS.sponsor,
        name: '男朋友',
        role: 'sponsor',
        openid: 'demo_openid_sponsor',
        avatarText: '你'
      })
    ],
    relationships: [
      {
        id: DEMO_IDS.relationship,
        type: 'pair',
        lifecycleStatus: 'active',
        unbindRequest: null,
        title: '我们的运动能量树',
        sponsorId: DEMO_IDS.sponsor,
        participantId: DEMO_IDS.participant,
        sponsorOpenid: 'demo_openid_sponsor',
        participantOpenid: 'demo_openid_participant',
        rewardRule: clone(DEFAULT_REWARD_RULE),
        balance: createDefaultBalance(),
        tree: createDefaultTree(),
        adventure: createDefaultAdventure(),
        equippedBadgeIds: []
      }
    ],
    adventureLevels: clone(DEFAULT_ADVENTURE_LEVELS),
    rewardItems: clone(DEFAULT_REWARD_ITEMS),
    badges: clone(DEFAULT_BADGES),
    checkIns: [],
    ledgers: [],
    withdrawals: [],
    redemptions: [],
    badgeUnlocks: [],
    surpriseCards: [],
    encouragementCards: [],
    companionViewNotices: [],
    subscriptionGrants: [],
    auditLogs: [],
    operationReceipts: [],
    meta: {
      nextId: 1,
      revision: 0,
      seededAt: nowIso()
    }
  };
}

function ensureStateShape(state) {
  const next = state || createInitialState();
  next.version = 4;
  next.users = next.users || [];
  next.relationships = next.relationships || [];
  next.adventureLevels = next.meta && next.meta.adventureLevelsCustomized && next.adventureLevels && next.adventureLevels.length
    ? mergeById(DEFAULT_ADVENTURE_LEVELS, next.adventureLevels)
    : clone(DEFAULT_ADVENTURE_LEVELS);
  next.rewardItems = next.rewardItems && next.rewardItems.length ? next.rewardItems : clone(DEFAULT_REWARD_ITEMS);
  next.badges = mergeById(DEFAULT_BADGES, next.badges && next.badges.length ? next.badges : []);
  next.checkIns = next.checkIns || [];
  next.ledgers = next.ledgers || [];
  next.withdrawals = next.withdrawals || [];
  next.redemptions = next.redemptions || [];
  next.badgeUnlocks = next.badgeUnlocks || [];
  next.surpriseCards = next.surpriseCards || [];
  next.encouragementCards = next.encouragementCards || [];
  next.companionViewNotices = next.companionViewNotices || [];
  next.subscriptionGrants = next.subscriptionGrants || [];
  next.auditLogs = next.auditLogs || [];
  next.operationReceipts = Array.isArray(next.operationReceipts) ? next.operationReceipts : [];
  next.meta = next.meta || { nextId: 1, seededAt: nowIso() };
  if (!next.meta.nextId) next.meta.nextId = 1;
  if (!Number.isInteger(next.meta.revision) || next.meta.revision < 0) next.meta.revision = 0;

  next.users.forEach((user) => {
    user.avatarText = user.avatarText || String(user.name || '?').slice(0, 1);
    user.avatarFileId = user.avatarFileId || '';
    user.avatarUrl = user.avatarUrl || '';
    user.profileEditUsage = {
      ...createDefaultProfileEditUsage(),
      ...(user.profileEditUsage || {})
    };
    user.profileEditUsage.nickname = {
      ...createDefaultProfileEditUsage().nickname,
      ...(user.profileEditUsage.nickname || {})
    };
    user.profileEditUsage.avatar = {
      ...createDefaultProfileEditUsage().avatar,
      ...(user.profileEditUsage.avatar || {})
    };
  });

  next.relationships.forEach((rel) => {
    const sponsor = next.users.find((user) => user.id === rel.sponsorId);
    const participant = next.users.find((user) => user.id === rel.participantId);
    rel.lifecycleStatus = rel.lifecycleStatus === 'frozen' ? 'frozen' : 'active';
    if (rel.lifecycleStatus === 'frozen') {
      rel.sponsorOpenid = '';
      rel.participantOpenid = '';
      if (sponsor) sponsor.openid = '';
      if (participant) participant.openid = '';
    } else {
      rel.sponsorOpenid = rel.sponsorOpenid || (sponsor && sponsor.openid) || '';
      rel.participantOpenid = rel.participantOpenid || (participant && participant.openid) || '';
    }
    rel.unbindRequest = rel.unbindRequest && typeof rel.unbindRequest === 'object'
      ? {
        id: String(rel.unbindRequest.id || ''),
        status: ['pending', 'releasing', 'completed'].includes(rel.unbindRequest.status)
          ? rel.unbindRequest.status
          : 'pending',
        requestedByUserId: String(rel.unbindRequest.requestedByUserId || ''),
        requestedByRole: rel.unbindRequest.requestedByRole === 'sponsor' ? 'sponsor' : 'participant',
        requestedAt: String(rel.unbindRequest.requestedAt || ''),
        confirmedByUserIds: Array.isArray(rel.unbindRequest.confirmedByUserIds)
          ? Array.from(new Set(rel.unbindRequest.confirmedByUserIds.filter(Boolean)))
          : [],
        confirmedAt: String(rel.unbindRequest.confirmedAt || ''),
        releaseStartedAt: String(rel.unbindRequest.releaseStartedAt || ''),
        completedAt: String(rel.unbindRequest.completedAt || '')
      }
      : null;
    rel.rewardRule = rewardEngine.normalizeRule(rel.rewardRule);
    rel.balance = { ...createDefaultBalance(), ...(rel.balance || {}) };
    rel.tree = { ...createDefaultTree(), ...(rel.tree || {}) };
    rel.adventure = { ...createDefaultAdventure(), ...(rel.adventure || {}) };
    rel.equippedBadgeIds = Array.isArray(rel.equippedBadgeIds) ? rel.equippedBadgeIds.slice(0, 3) : [];
  });

  next.encouragementCards.forEach((card) => {
    const rel = next.relationships.find((item) => item.id === card.relationshipId);
    card.kind = card.kind || 'approval';
    card.templateKey = card.templateKey || (card.kind === 'approval' ? 'approval' : 'praise');
    card.senderUserId = card.senderUserId || (rel && rel.sponsorId) || '';
    card.recipientUserId = card.recipientUserId || (rel && rel.participantId) || '';
    card.clientRequestId = card.clientRequestId || '';
    card.readAt = card.readAt || null;
  });

  next.surpriseCards.forEach((card) => {
    card.sceneKey = card.sceneKey || 'checkin_surprise';
    card.eventKey = card.eventKey || card.id || `${card.sceneKey}:${card.createdAt || ''}`;
    card.priority = Number.isFinite(Number(card.priority))
      ? Number(card.priority)
      : Number(MILESTONE_PRIORITIES[card.sceneKey] || 0);
    card.seenByUserIds = Array.isArray(card.seenByUserIds)
      ? Array.from(new Set(card.seenByUserIds.filter(Boolean)))
      : [];
  });
  return next;
}

function getState() {
  const state = storage.get(DB_KEY, null);
  if (!state) {
    return createInitialState();
  }
  return ensureStateShape(state);
}

function saveState(state) {
  storage.set(DB_KEY, state);
  return state;
}

function seedDemoIfNeeded() {
  const existing = storage.get(DB_KEY, null);
  if (!existing) {
    saveState(createInitialState());
  }
}

function resetDemo() {
  return saveState(createInitialState());
}

function nextId(state, prefix) {
  const value = `${prefix}_${String(state.meta.nextId).padStart(4, '0')}`;
  state.meta.nextId += 1;
  return value;
}

const OPERATION_RECEIPT_LIMIT = 300;
const OPERATION_RECEIPT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function operationReceiptKey(openid, action, clientRequestId) {
  return `${openid}:${action}:${clientRequestId}`;
}

function findOperationReceipt(state, action, input = {}) {
  const actorOpenid = String((input.authContext && input.authContext.openid) || '').trim();
  const clientRequestId = clientRequestIdFromInput(input);
  if (!actorOpenid || !clientRequestId) return null;
  const key = operationReceiptKey(actorOpenid, action, clientRequestId);
  return (state.operationReceipts || []).find((receipt) => receipt.key === key) || null;
}

function pruneOperationReceipts(state) {
  const cutoff = new Date(nowIso()).getTime() - OPERATION_RECEIPT_TTL_MS;
  state.operationReceipts = (state.operationReceipts || [])
    .filter((receipt) => {
      const createdAt = new Date(receipt.createdAt || 0).getTime();
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    })
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .slice(-OPERATION_RECEIPT_LIMIT);
  return state.operationReceipts;
}

function mutationTargetId(result, input = {}, action = '') {
  if (result && result.checkIn && result.checkIn.id) return result.checkIn.id;
  if (result && result.redemption && result.redemption.id) return result.redemption.id;
  if (result && result.withdrawal && result.withdrawal.id) return result.withdrawal.id;
  if (result && result.id) return result.id;
  if (result && result.relationship && result.relationship.id) return result.relationship.id;
  if (result && result.relationshipId) return result.relationshipId;
  return input.checkInId
    || input.withdrawalId
    || input.redemptionId
    || input.rewardId
    || input.id
    || input.relationshipId
    || action;
}

function runMutationWithReceipt(action, input = {}, handler, options = {}) {
    const beforeState = getState();
    const clientRequestId = clientRequestIdFromInput(input);
    let actor = null;
    let actorOpenid = String(
      options.actorOpenid
      || (input.authContext && input.authContext.openid)
      || ''
    ).trim();
    let receiptKey = '';
    if (clientRequestId) {
      actor = actorOpenid ? null : getActor(beforeState, input);
      actorOpenid = actorOpenid || actor.openid;
      receiptKey = operationReceiptKey(actorOpenid, action, clientRequestId);
      pruneOperationReceipts(beforeState);
      const existing = beforeState.operationReceipts.find((receipt) => receipt.key === receiptKey);
      if (existing) {
        return {
          deduped: true,
          targetId: existing.targetId,
          action,
          revision: Number(beforeState.meta.revision || 0)
        };
      }
    }

    const mutationAction = String(action || '');
    if (
      !mutationAction.startsWith('relationship.unbind.')
      && !mutationAction.startsWith('identity.')
      && mutationAction !== 'relationship.create'
    ) {
      const trustedOpenid = String((input.authContext && input.authContext.openid) || '').trim();
      if (trustedOpenid) {
        const mutationActor = getActor(beforeState, input);
        const mutationRelationship = getRelationshipForActor(beforeState, mutationActor);
        const unbindStatus = mutationRelationship.unbindRequest && mutationRelationship.unbindRequest.status;
        if (unbindStatus === 'releasing') {
          throw new Error('关系解除正在安全收尾，新的业务操作已暂停');
        }
      }
    }

    const beforeJson = JSON.stringify(beforeState);
    const result = handler(input);
    const nextState = getState();
    if (JSON.stringify(nextState) === beforeJson) return result;

    nextState.meta.revision = Number(nextState.meta.revision || 0) + 1;
    const targetId = mutationTargetId(result, input, action);
    if (clientRequestId) {
      pruneOperationReceipts(nextState);
      nextState.operationReceipts.push({
        id: nextId(nextState, 'receipt'),
        key: receiptKey,
        action,
        actorOpenid,
        clientRequestId,
        targetId,
        createdAt: nowIso()
      });
      pruneOperationReceipts(nextState);
    }
    saveState(nextState);

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return {
        ...result,
        targetId,
        revision: nextState.meta.revision
      };
    }
    return result;
}

function withMutationReceipt(action, handler) {
  return function runMutation(input = {}) {
    return runMutationWithReceipt(action, input, () => handler(input));
  };
}

function getActor(state, input = {}) {
  const openid = input.authContext && input.authContext.openid;
  if (!openid) throw new Error('缺少可信登录身份');
  const user = state.users.find((item) => item.openid === openid);
  if (!user) throw new Error('当前用户不在这段激励关系中');
  return { openid, user };
}

function getRelationshipForActor(state, actor) {
  const rel = state.relationships.find((item) => item.sponsorOpenid === actor.openid || item.participantOpenid === actor.openid);
  if (!rel) throw new Error('当前用户不在这段激励关系中');
  return rel;
}

function resolveRelationshipForActor(state, input = {}) {
  const actor = getActor(state, input);
  const rel = getRelationshipForActor(state, actor);
  if (input.relationshipId && input.relationshipId !== rel.id) {
    throw new Error('客户端关系标识与当前登录身份不匹配，只能访问自己关系内的数据');
  }
  return { actor, rel };
}

function assertActorSponsor(state, rel, input) {
  const resolved = resolveRelationshipForActor(state, input);
  const actor = resolved.actor;
  if (resolved.rel.id !== rel.id) throw new Error('客户端关系标识与当前登录身份不匹配');
  if (actor.openid !== rel.sponsorOpenid) throw new Error('只有赞助者可以执行这个操作');
  return actor;
}

function assertActorParticipant(state, rel, input) {
  const resolved = resolveRelationshipForActor(state, input);
  const actor = resolved.actor;
  if (resolved.rel.id !== rel.id) throw new Error('客户端关系标识与当前登录身份不匹配');
  if (actor.openid !== rel.participantOpenid) throw new Error('只有打卡者可以执行这个操作');
  return actor;
}

function assertActorInRelationship(state, rel, input) {
  const resolved = resolveRelationshipForActor(state, input);
  const actor = resolved.actor;
  if (resolved.rel.id !== rel.id) throw new Error('客户端关系标识与当前登录身份不匹配');
  if (actor.openid !== rel.participantOpenid && actor.openid !== rel.sponsorOpenid) {
    throw new Error('只能查看自己关系内的数据');
  }
  return actor;
}

function addAuditLog(state, input) {
  state.auditLogs.push({
    id: nextId(state, 'audit'),
    relationshipId: input.relationshipId || '',
    actorOpenid: input.actorOpenid || '',
    action: input.action,
    targetId: input.targetId || '',
    amountCents: Number(input.amountCents || 0),
    note: input.note || '',
    createdAt: nowIso()
  });
}

function assertRelationshipActive(rel) {
  if (!rel || rel.lifecycleStatus === 'frozen') {
    throw new Error('旧关系已冻结，不能继续操作或重新绑定');
  }
}

function assertDoubleRelationshipConfirmation(input = {}) {
  if (input.confirmed !== true || input.confirmedTwice !== true) {
    throw new Error('请完整阅读警告并完成两次确认');
  }
}

function relationshipUnbindBlockers(state, rel) {
  const blockers = [];
  const submittedCheckIns = state.checkIns.filter((item) => (
    item.relationshipId === rel.id && item.status === CHECKIN_STATUS.SUBMITTED
  )).length;
  const pendingWithdrawals = state.withdrawals.filter((item) => (
    item.relationshipId === rel.id
    && item.status !== WITHDRAWAL_STATUS.PAID
    && item.status !== WITHDRAWAL_STATUS.REJECTED
  )).length;
  const pendingRedemptions = state.redemptions.filter((item) => (
    item.relationshipId === rel.id
    && (item.status === REDEMPTION_STATUS.PENDING || item.status === REDEMPTION_STATUS.CANCEL_REQUESTED)
  )).length;
  const frozenCents = Number((rel.balance && rel.balance.frozenCents) || 0);

  if (submittedCheckIns) blockers.push(`待审核打卡 ${submittedCheckIns} 条`);
  if (pendingWithdrawals) blockers.push(`待处理心愿金 ${pendingWithdrawals} 条`);
  if (pendingRedemptions) blockers.push(`待处理兑换 ${pendingRedemptions} 条`);
  if (frozenCents > 0) blockers.push('仍有冻结心愿金');
  return blockers;
}

function assertRelationshipCanUnbind(state, rel) {
  const blockers = relationshipUnbindBlockers(state, rel);
  if (blockers.length) {
    throw new Error(`请先处理关系内的待处理事项：${blockers.join('、')}`);
  }
}

function decorateRelationshipUnbindStatus(rel, currentUser) {
  const request = rel && rel.unbindRequest;
  if (!request || request.status === 'completed') {
    return {
      state: 'none',
      requestId: '',
      requestedAt: '',
      requestedByMe: false,
      canCancel: false,
      canConfirm: false,
      message: '双方确认后才会解除关系'
    };
  }
  const requestedByMe = Boolean(currentUser && request.requestedByUserId === currentUser.id);
  if (request.status === 'releasing') {
    return {
      state: 'finalizing',
      requestId: request.id,
      requestedAt: request.requestedAt,
      requestedByMe,
      canCancel: false,
      canConfirm: !requestedByMe,
      message: '双方已确认，正在撤销旧关系访问；失败时可由确认方安全重试'
    };
  }
  return {
    state: requestedByMe ? 'waiting_for_partner' : 'action_required',
    requestId: request.id,
    requestedAt: request.requestedAt,
    requestedByMe,
    canCancel: requestedByMe,
    canConfirm: !requestedByMe,
    message: requestedByMe
      ? '已发起，等待另一方完成两次确认'
      : '另一方申请解除关系，需要你完成两次确认'
  };
}

function requestRelationshipUnbind(input = {}) {
  const state = getState();
  const { actor, rel } = resolveRelationshipForActor(state, input);
  assertRelationshipActive(rel);
  assertDoubleRelationshipConfirmation(input);
  if (!rel.sponsorOpenid || !rel.participantOpenid) {
    throw new Error('另一方尚未绑定，不能发起双方解除流程');
  }
  assertRelationshipCanUnbind(state, rel);

  if (rel.unbindRequest && rel.unbindRequest.status !== 'completed') {
    if (rel.unbindRequest.status === 'releasing') {
      throw new Error('关系解除正在安全收尾，请勿重复发起');
    }
    if (rel.unbindRequest.requestedByUserId === actor.user.id) {
      throw new Error('解除申请已发出，正在等待另一方确认');
    }
    throw new Error('另一方已经发起解除申请，请在关系设置中确认或暂不处理');
  }

  const request = {
    id: nextId(state, 'unbind'),
    status: 'pending',
    requestedByUserId: actor.user.id,
    requestedByRole: actor.user.role,
    requestedAt: nowIso(),
    confirmedByUserIds: [actor.user.id],
    confirmedAt: '',
    releaseStartedAt: '',
    completedAt: ''
  };
  rel.unbindRequest = request;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'relationship.unbind.request',
    targetId: request.id,
    note: actor.user.role
  });
  saveState(state);
  return decorateRelationshipUnbindStatus(rel, actor.user);
}

function cancelRelationshipUnbind(input = {}) {
  const state = getState();
  const { actor, rel } = resolveRelationshipForActor(state, input);
  assertRelationshipActive(rel);
  const request = rel.unbindRequest;
  if (!request || request.status !== 'pending') throw new Error('当前没有待确认的解除申请');
  if (request.requestedByUserId !== actor.user.id) throw new Error('只有解除申请的发起方可以撤回');

  const requestId = request.id;
  rel.unbindRequest = null;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'relationship.unbind.cancel',
    targetId: requestId,
    note: actor.user.role
  });
  saveState(state);
  return decorateRelationshipUnbindStatus(rel, actor.user);
}

function validateRelationshipUnbindConfirmation(state, input = {}) {
  const { actor, rel } = resolveRelationshipForActor(state, input);
  assertRelationshipActive(rel);
  assertDoubleRelationshipConfirmation(input);
  const request = rel.unbindRequest;
  if (!request || !['pending', 'releasing'].includes(request.status)) {
    throw new Error('当前没有待确认的解除申请');
  }
  if (request.requestedByUserId === actor.user.id) {
    throw new Error('解除关系必须由另一方确认，发起方不能单独完成');
  }
  assertRelationshipCanUnbind(state, rel);
  return {
    actor,
    rel,
    relationshipId: rel.id,
    relationshipOpenids: [rel.sponsorOpenid, rel.participantOpenid].filter(Boolean)
  };
}

function beginRelationshipUnbindConfirmation(input = {}) {
  const state = getState();
  const {
    actor,
    rel,
    relationshipOpenids
  } = validateRelationshipUnbindConfirmation(state, input);
  const request = rel.unbindRequest;
  if (request.status === 'pending') {
    const confirmedAt = nowIso();
    request.status = 'releasing';
    request.confirmedByUserIds = Array.from(new Set([
      ...(request.confirmedByUserIds || []),
      actor.user.id
    ]));
    request.confirmedAt = confirmedAt;
    request.releaseStartedAt = confirmedAt;
    addAuditLog(state, {
      relationshipId: rel.id,
      actorOpenid: actor.openid,
      action: 'relationship.unbind.confirm',
      targetId: request.id,
      note: actor.user.role
    });
    saveState(state);
  } else if (!(request.confirmedByUserIds || []).includes(actor.user.id)) {
    throw new Error('只有已完成双方确认的账号可以继续解除收尾');
  }
  return {
    releasePending: true,
    relationshipId: rel.id,
    relationshipOpenids
  };
}

function completeRelationshipUnbind(input = {}) {
  const state = getState();
  const { actor, rel } = resolveRelationshipForActor(state, input);
  assertRelationshipActive(rel);
  assertDoubleRelationshipConfirmation(input);
  const request = rel.unbindRequest;
  if (!request || request.status !== 'releasing') throw new Error('关系解除尚未完成双方确认');
  if (request.requestedByUserId === actor.user.id || !(request.confirmedByUserIds || []).includes(actor.user.id)) {
    throw new Error('只有完成确认的另一方可以执行解除收尾');
  }
  assertRelationshipCanUnbind(state, rel);
  const trustedOpenids = [rel.sponsorOpenid, rel.participantOpenid].filter(Boolean);

  const completedAt = nowIso();
  request.status = 'completed';
  request.completedAt = completedAt;
  rel.lifecycleStatus = 'frozen';
  rel.inviteTokens = { participant: '' };

  const relationshipOpenids = new Set(trustedOpenids);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'relationship.unbind.complete',
    targetId: request.id,
    note: '双方确认；旧关系冻结保留'
  });
  state.subscriptionGrants.forEach((grant) => {
    if (grant.relationshipId !== rel.id) return;
    grant.status = 'revoked';
    grant.revokedAt = completedAt;
    grant.openid = '';
  });
  state.companionViewNotices.forEach((notice) => {
    if (notice.relationshipId !== rel.id) return;
    notice.targetOpenid = '';
    notice.viewerOpenid = '';
  });
  state.users.forEach((user) => {
    if (relationshipOpenids.has(user.openid)) user.openid = '';
  });
  rel.sponsorOpenid = '';
  rel.participantOpenid = '';
  saveState(state);
  return {
    released: true,
    needsBinding: true,
    relationshipId: rel.id,
    message: '关系已解除；旧数据已冻结保留，不会重新分配给其他账号'
  };
}

function confirmRelationshipUnbind(input = {}) {
  beginRelationshipUnbindConfirmation(input);
  return completeRelationshipUnbind(input);
}

function profileUsageForField(user, field, currentMonth = monthKey()) {
  user.profileEditUsage = user.profileEditUsage || createDefaultProfileEditUsage(currentMonth);
  const current = user.profileEditUsage[field] || {};
  if (current.monthKey !== currentMonth) {
    user.profileEditUsage[field] = {
      monthKey: currentMonth,
      freeUsed: false,
      paidCount: 0
    };
  } else {
    user.profileEditUsage[field] = {
      monthKey: currentMonth,
      freeUsed: Boolean(current.freeUsed),
      paidCount: Number(current.paidCount || 0)
    };
  }
  return user.profileEditUsage[field];
}

function decorateProfileEditState(user, rel) {
  const currentMonth = monthKey();
  const fields = ['nickname', 'avatar'].reduce((result, field) => {
    const usage = profileUsageForField(user, field, currentMonth);
    const canBuyExtra = user.role === 'participant';
    result[field] = {
      monthKey: currentMonth,
      freeAvailable: !usage.freeUsed,
      freeUsed: usage.freeUsed,
      paidCount: usage.paidCount,
      canBuyExtra,
      extraCostCents: canBuyExtra ? PROFILE_EDIT_EXTRA_COST_CENTS : 0,
      extraCostText: canBuyExtra ? rewardEngine.moneyText(PROFILE_EDIT_EXTRA_COST_CENTS) : '0.00',
      extraAffordable: canBuyExtra && rel.balance.availableCents >= PROFILE_EDIT_EXTRA_COST_CENTS
    };
    return result;
  }, {});
  return fields;
}

function decorateUser(user, rel) {
  if (!user) return null;
  const { openid, ...safeUser } = user;
  return {
    ...safeUser,
    profileEditState: rel ? decorateProfileEditState(user, rel) : null
  };
}

function planProfileEditUsage(user, rel, fields) {
  const currentMonth = monthKey();
  const usageDraft = clone(user.profileEditUsage || createDefaultProfileEditUsage(currentMonth));
  let totalCostCents = 0;

  fields.forEach((field) => {
    const usage = {
      monthKey: currentMonth,
      freeUsed: false,
      paidCount: 0,
      ...(usageDraft[field] || {})
    };
    if (usage.monthKey !== currentMonth) {
      usage.monthKey = currentMonth;
      usage.freeUsed = false;
      usage.paidCount = 0;
    }
    if (!usage.freeUsed) {
      usage.freeUsed = true;
    } else if (user.role === 'participant') {
      totalCostCents += PROFILE_EDIT_EXTRA_COST_CENTS;
      usage.paidCount = Number(usage.paidCount || 0) + 1;
    } else {
      throw new Error('本月资料修改次数已用完，男友端不能付费追加修改次数');
    }
    usageDraft[field] = usage;
  });

  if (totalCostCents > rel.balance.availableCents) {
    throw new Error('能量币不足，无法追加修改资料');
  }
  return {
    usageDraft,
    totalCostCents
  };
}

function assertRelationship(state, relationshipId) {
  const rel = state.relationships.find((item) => item.id === relationshipId);
  if (!rel) throw new Error('找不到这段激励关系');
  return rel;
}

function getCurrentUser(state, input = {}) {
  const rel = assertRelationship(state, state.activeRelationshipId);
  if (input.authContext && input.authContext.openid) {
    return state.users.find((user) => user.openid === input.authContext.openid);
  }
  const userId = state.currentRole === 'sponsor' ? rel.sponsorId : rel.participantId;
  return state.users.find((user) => user.id === userId);
}

function relationshipCheckIns(state, relationshipId) {
  return state.checkIns.filter((item) => item.relationshipId === relationshipId);
}

function approvedDateKeys(state, relationshipId) {
  return relationshipCheckIns(state, relationshipId)
    .filter((item) => item.status === CHECKIN_STATUS.APPROVED)
    .map((item) => item.dateKey);
}

function earnedCentsOnDate(state, relationshipId, dateKey) {
  return state.ledgers
    .filter((item) => item.relationshipId === relationshipId && item.type === 'checkin_reward' && item.dateKey === dateKey && item.status === LEDGER_STATUS.EARNED)
    .reduce((sum, item) => sum + item.amountCents, 0);
}

function earnedCentsTotal(state, relationshipId) {
  return state.ledgers
    .filter((item) => item.relationshipId === relationshipId && (item.type === 'checkin_reward' || item.type === 'level_reward') && item.status === LEDGER_STATUS.EARNED)
    .reduce((sum, item) => sum + item.amountCents, 0);
}

function approvedCheckIns(state, relationshipId) {
  return relationshipCheckIns(state, relationshipId)
    .filter((item) => item.status === CHECKIN_STATUS.APPROVED);
}

function latestTodayCheckIn(state, relationshipId, today) {
  const todays = state.checkIns
    .filter((item) => item.relationshipId === relationshipId && item.dateKey === today)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return todays[0] || null;
}

function decorateRelationship(rel) {
  const {
    inviteTokens,
    unbindRequest,
    sponsorOpenid,
    participantOpenid,
    ...safeRelationship
  } = rel;
  return {
    ...safeRelationship,
    sponsorBound: Boolean(sponsorOpenid),
    participantBound: Boolean(participantOpenid),
    balanceText: {
      available: rewardEngine.moneyText(rel.balance.availableCents),
      frozen: rewardEngine.moneyText(rel.balance.frozenCents),
      paidOut: rewardEngine.moneyText(rel.balance.paidOutCents),
      availableCoins: rewardEngine.moneyText(rel.balance.availableCents)
    }
  };
}

function decorateWishFund(state, rel) {
  const currentMonth = monthKey();
  const targetCents = Number(rel.rewardRule.monthlyWishFundCents || 0);
  const earnedCents = state.ledgers
    .filter((item) => item.relationshipId === rel.id && item.type === 'checkin_reward' && item.status === LEDGER_STATUS.EARNED && item.dateKey.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + item.amountCents, 0);
  return {
    monthKey: currentMonth,
    targetCents,
    earnedCents,
    targetText: rewardEngine.moneyText(targetCents),
    earnedText: rewardEngine.moneyText(earnedCents),
    progressPercent: targetCents > 0 ? Math.min(100, Math.round((earnedCents / targetCents) * 100)) : 0
  };
}

function getStats(state, rel) {
  const approved = approvedCheckIns(state, rel.id);
  const allDates = approved.map((item) => item.dateKey).sort();
  let maxStreak = 0;
  allDates.forEach((dateKey) => {
    maxStreak = Math.max(maxStreak, rewardEngine.calculateStreak(allDates, dateKey));
  });
  const totalDurationMinutes = approved.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  return {
    totalCheckIns: approved.length,
    currentStreak: rel.tree.streak || 0,
    maxStreak,
    totalEarnedCents: earnedCentsTotal(state, rel.id),
    totalEarnedText: rewardEngine.moneyText(earnedCentsTotal(state, rel.id)),
    totalRedemptions: state.redemptions.filter((item) => item.relationshipId === rel.id).length,
    badgeCount: state.badgeUnlocks.filter((item) => item.relationshipId === rel.id).length,
    totalDurationMinutes
  };
}

function getCalendarStats(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  const currentMonth = input.monthKey || monthKey();
  const dates = relationshipCheckIns(state, rel.id)
    .filter((item) => item.dateKey.slice(0, 7) === currentMonth)
    .map((item) => ({
      dateKey: item.dateKey,
      day: Number(item.dateKey.slice(8, 10)),
      status: item.status
    }));
  const daysInMonth = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate();
  return {
    monthKey: currentMonth,
    daysInMonth,
    dates
  };
}

function getBadgeWall(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  const equippedIds = rel.equippedBadgeIds || [];
  return state.badges.map((badge) => {
    const unlock = state.badgeUnlocks.find((item) => item.relationshipId === rel.id && item.badgeId === badge.id);
    return {
      ...badge,
      unlocked: Boolean(unlock),
      equipped: equippedIds.includes(badge.id),
      unlockedAt: unlock ? unlock.unlockedAt : '',
      story: unlock ? unlock.story : ''
    };
  });
}

function getAdventure(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  const decorated = rewardEngine.decorateAdventure(rel.adventure, state.adventureLevels);
  return {
    adventure: decorated,
    levels: rewardEngine.getSortedAdventureLevels(state.adventureLevels).map((level) => ({
      ...level,
      completed: rel.adventure.completedLevelIds.includes(level.id),
      current: level.id === decorated.currentLevel.id
    }))
  };
}

function roleForRelationship(rel, user) {
  if (!user) return 'guest';
  if (user.openid === rel.sponsorOpenid) return 'sponsor';
  if (user.openid === rel.participantOpenid) return 'participant';
  return 'guest';
}

function getDashboard(input = {}) {
  const state = getState();
  const { actor, rel } = resolveRelationshipForActor(state, input);
  const currentUser = actor.user;
  const currentRole = roleForRelationship(rel, currentUser);
  const sponsor = state.users.find((user) => user.id === rel.sponsorId);
  const participant = state.users.find((user) => user.id === rel.participantId);
  const today = todayKey();
  const todaysCheckIn = latestTodayCheckIn(state, rel.id, today);
  const pendingCount = state.checkIns.filter((item) => item.relationshipId === rel.id && item.status === CHECKIN_STATUS.SUBMITTED).length;
  const waitingPayoutCount = state.withdrawals.filter((item) => item.relationshipId === rel.id && item.status !== WITHDRAWAL_STATUS.PAID && item.status !== WITHDRAWAL_STATUS.REJECTED).length;
  const pendingRedemptionCount = state.redemptions.filter((item) => item.relationshipId === rel.id && (item.status === REDEMPTION_STATUS.PENDING || item.status === REDEMPTION_STATUS.CANCEL_REQUESTED)).length;
  const trustedInput = { ...input, relationshipId: rel.id };
  const adventure = getAdventure(trustedInput);
  const stats = getStats(state, rel);
  const allBadges = getBadgeWall(trustedInput);
  const equippedBadges = allBadges.filter((badge) => badge.equipped && badge.unlocked);

  return {
    currentRole,
    currentUser: decorateUser(currentUser, rel),
    companionUser: currentRole === 'sponsor' ? decorateUser(participant, rel) : decorateUser(sponsor, rel),
    relationship: {
      ...decorateRelationship(rel),
      unbindStatus: decorateRelationshipUnbindStatus(rel, currentUser),
      wishFund: decorateWishFund(state, rel),
      adventure: adventure.adventure,
      stats,
      equippedBadges
    },
    todaysCheckIn,
    canSubmitToday: !todaysCheckIn || todaysCheckIn.status === CHECKIN_STATUS.REJECTED,
    pendingCount,
    waitingPayoutCount,
    pendingRedemptionCount,
    recentCheckIns: relationshipCheckIns(state, rel.id).slice(-5).reverse(),
    recentLedgers: state.ledgers.filter((item) => item.relationshipId === rel.id).slice(-5).reverse(),
    adventureLevels: adventure.levels,
    badges: allBadges.slice(0, 6),
    calendar: getCalendarStats(trustedInput)
  };
}

function switchRole(role) {
  const state = getState();
  state.currentRole = role === 'sponsor' ? 'sponsor' : 'participant';
  saveState(state);
  const rel = assertRelationship(state, state.activeRelationshipId);
  const userId = state.currentRole === 'sponsor' ? rel.sponsorId : rel.participantId;
  const user = state.users.find((item) => item.id === userId);
  return getDashboard({ authContext: { openid: user.openid } });
}

function login(input = {}) {
  const role = input.role === 'sponsor' ? 'sponsor' : 'participant';
  switchRole(role);
  const state = getState();
  const rel = assertRelationship(state, state.activeRelationshipId);
  const userId = role === 'sponsor' ? rel.sponsorId : rel.participantId;
  const user = state.users.find((item) => item.id === userId);
  const dashboard = getDashboard({ authContext: { openid: user.openid } });
  return {
    openid: user.openid,
    user: decorateUser(user, rel),
    relationship: dashboard.relationship
  };
}

function advanceAdventure(state, rel) {
  const adventure = rel.adventure;
  const current = rewardEngine.getCurrentAdventureLevel(state.adventureLevels, adventure.currentLevelId);
  const next = rewardEngine.getNextAdventureLevel(state.adventureLevels, current.id);
  const isFinalCompleted = !next && adventure.completedLevelIds.includes(current.id);
  adventure.totalSteps += 1;
  if (isFinalCompleted) {
    adventure.postCompletionSteps += 1;
    return {
      completedLevel: null,
      nextLevel: current,
      rewardCents: 0
    };
  }

  adventure.levelProgress += 1;

  if (adventure.levelProgress < Number(current.requiredSteps || 1)) {
    return {
      completedLevel: null,
      nextLevel: current,
      rewardCents: 0
    };
  }

  adventure.completedLevelIds = Array.from(new Set([...(adventure.completedLevelIds || []), current.id]));
  adventure.lastCompletedLevelId = current.id;
  if (next) {
    adventure.currentLevelId = next.id;
    adventure.levelProgress = 0;
  } else {
    adventure.levelProgress = Number(current.requiredSteps || adventure.levelProgress);
    adventure.completedAt = adventure.completedAt || nowIso();
  }

  return {
    completedLevel: current,
    nextLevel: next || current,
    rewardCents: validateCents(Number(current.rewardCents || 0), AMOUNT_LIMITS.levelReward, '关卡奖励')
  };
}

function milestoneSceneForBadge(badgeId) {
  const sceneByBadge = {
    first_checkin: 'first_checkin',
    streak_3: 'streak_3',
    streak_7: 'streak_7',
    hundred_coins: 'energy_100',
    coins_300: 'energy_300',
    coins_520: 'energy_520',
    first_redemption: 'first_redemption'
  };
  return sceneByBadge[badgeId] || 'badge_unlock';
}

function addMilestone(state, rel, input = {}) {
  const sceneKey = String(input.sceneKey || 'checkin_surprise');
  const sourceId = String(input.sourceId || '');
  const eventKey = String(input.eventKey || `${sceneKey}:${sourceId || nowIso()}`);
  const existing = state.surpriseCards.find((item) => (
    item.relationshipId === rel.id && String(item.eventKey || '') === eventKey
  ));
  if (existing) return existing;

  const milestone = {
    id: nextId(state, 'surprise'),
    relationshipId: rel.id,
    kind: input.kind || 'milestone',
    type: input.type || sceneKey,
    sceneKey,
    eventKey,
    sourceId,
    checkInId: input.checkInId || '',
    badgeId: input.badgeId || '',
    levelId: input.levelId || '',
    withdrawalId: input.withdrawalId || '',
    redemptionId: input.redemptionId || '',
    title: input.title || '我们的新里程碑',
    message: input.message || '这一小步值得我们一起认真记住。',
    priority: Number(input.priority || MILESTONE_PRIORITIES[sceneKey] || 0),
    seenByUserIds: [],
    createdAt: nowIso()
  };
  if (Number(input.cashOverflowCents || 0) > 0) {
    milestone.cashOverflowCents = Number(input.cashOverflowCents);
  }
  state.surpriseCards.push(milestone);
  return milestone;
}

function selectPrimaryMilestone(cards) {
  return (cards || []).slice().sort((left, right) => {
    const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDiff) return priorityDiff;
    return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
  })[0] || null;
}

function hasBadge(state, relationshipId, badgeId) {
  return state.badgeUnlocks.some((item) => item.relationshipId === relationshipId && item.badgeId === badgeId);
}

function unlockBadge(state, rel, badgeId, sourceId, story) {
  const badge = state.badges.find((item) => item.id === badgeId);
  if (!badge || hasBadge(state, rel.id, badgeId)) return null;
  const unlock = {
    id: nextId(state, 'badge'),
    relationshipId: rel.id,
    badgeId,
    badgeName: badge.name,
    sourceId: sourceId || '',
    story: story || badge.description,
    unlockedAt: nowIso()
  };
  state.badgeUnlocks.push(unlock);
  const sceneKey = milestoneSceneForBadge(badgeId);
  addMilestone(state, rel, {
    sceneKey,
    eventKey: `badge:${badgeId}`,
    sourceId: unlock.id,
    badgeId,
    title: badge.name,
    message: unlock.story
  });
  return unlock;
}

function isWeekendDate(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return false;
  const day = new Date(parsed.timestamp).getUTCDay();
  return day === 0 || day === 6;
}

function isEveningCheckIn(checkIn) {
  const raw = checkIn.occurredAt || checkIn.createdAt || '';
  const date = raw ? new Date(raw) : null;
  if (date && !Number.isNaN(date.getTime()) && chinaDateTimeParts(date).hour >= 18) return true;
  return String(checkIn.note || '').includes('晚') || String(checkIn.note || '').includes('散步');
}

function unlockBadgesForApproval(state, rel, checkIn, approval, adventureResult) {
  const unlocked = [];
  const approvedCount = approvedCheckIns(state, rel.id).length;
  const totalEarned = earnedCentsTotal(state, rel.id);
  const totalDurationMinutes = approvedCheckIns(state, rel.id).reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  const add = (badgeId, story) => {
    const unlock = unlockBadge(state, rel, badgeId, checkIn.id, story);
    if (unlock) unlocked.push(unlock);
  };

  if (approvedCount >= 1) add('first_checkin', '第一步已经完成，小树正式开始发芽。');
  if (approval.streak >= 3) add('streak_3', '连续三天点亮小火苗。');
  if (approval.streak >= 7) {
    add('streak_7', '连续一周都有认真动一动。');
    add('full_week', '这一周每天都给自己留了一点能量。');
  }
  if (adventureResult.completedLevel && adventureResult.completedLevel.rewardBadgeId) {
    add(adventureResult.completedLevel.rewardBadgeId, `通关「${adventureResult.completedLevel.name}」。`);
  }
  if (totalEarned >= 10000) add('hundred_coins', '累计获得 100 能量币。');
  if (totalEarned >= 30000) add('coins_300', '累计获得 300 能量币。');
  if (totalEarned >= 52000) add('coins_520', '累计获得 520 能量币。');
  if (approvedCount >= 15) add('half_month', '累计完成 15 次运动打卡。');
  if (approvedCount >= 30) add('monthly_30', '累计完成 30 次运动打卡。');
  if (totalDurationMinutes >= 300) add('duration_300', '累计运动 300 分钟。');
  if (isEveningCheckIn(checkIn)) add('evening_walk', '在晚风里完成了一次运动。');
  if (isWeekendDate(checkIn.dateKey)) add('weekend_move', '周末也有照顾自己。');

  return unlocked;
}

function submitCheckIn(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);

  const occurredAt = nowIso();
  const dateKey = todayKey(occurredAt);
  const duplicate = state.checkIns.find((item) => item.relationshipId === rel.id && item.participantId === rel.participantId && item.dateKey === dateKey && item.status !== CHECKIN_STATUS.REJECTED);
  if (duplicate) throw new Error('今天已经提交过打卡了');
  const photoFileId = validateCheckInPhotoFileId(input.photoFileId, rel, state);
  const durationMinutes = validateOptionalDurationMinutes(input.durationMinutes);
  const note = validateText(input.note, 200, '打卡备注');

  const checkIn = {
    id: nextId(state, 'checkin'),
    relationshipId: rel.id,
    participantId: rel.participantId,
    sponsorId: rel.sponsorId,
    dateKey,
    displayDate: displayDate(dateKey),
    photoPath: photoFileId,
    photoFileId,
    note,
    durationMinutes,
    occurredAt,
    status: CHECKIN_STATUS.SUBMITTED,
    pendingRewardCents: Number(rel.rewardRule.perCheckInCents || 0),
    pendingRewardText: rewardEngine.moneyText(rel.rewardRule.perCheckInCents || 0),
    createdAt: nowIso(),
    reviewedAt: null,
    reviewNote: ''
  };
  state.checkIns.push(checkIn);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'checkin.submit',
    targetId: checkIn.id
  });
  saveState(state);
  return checkIn;
}

function approveCheckIn(input) {
  const state = getState();
  const checkIn = state.checkIns.find((item) => item.id === input.checkInId);
  if (!checkIn) throw new Error('找不到这条打卡');

  const rel = assertRelationship(state, checkIn.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (checkIn.status !== CHECKIN_STATUS.SUBMITTED) throw new Error('这条打卡已经审核过了');
  const milestoneIdsBefore = new Set(state.surpriseCards.map((item) => item.id));

  const adventureResult = advanceAdventure(state, rel);
  const configuredLevelRewardCents = Number(adventureResult.rewardCents || 0);
  const approval = rewardEngine.evaluateApproval({
    rule: rel.rewardRule,
    todayKey: checkIn.dateKey,
    approvedDateKeys: approvedDateKeys(state, rel.id),
    todayEarnedCents: earnedCentsOnDate(state, rel.id, checkIn.dateKey),
    currentSunshine: rel.tree.sunshine,
    mapRewardCents: configuredLevelRewardCents
  });
  const levelRewardCents = approval.levelRewardCents;
  const totalRewardCents = approval.totalCents;
  adventureResult.configuredRewardCents = configuredLevelRewardCents;
  adventureResult.rewardCents = levelRewardCents;
  const totalApprovedAfterThis = approvedDateKeys(state, rel.id).length + 1;
  const surpriseCard = rewardEngine.pickSurpriseCard(approval.streak, totalApprovedAfterThis);
  const praise = validateText(input.praise, 200, '审核夸奖') || approval.card.message;
  const ledger = {
    id: nextId(state, 'ledger'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sourceId: checkIn.id,
    type: 'checkin_reward',
    status: LEDGER_STATUS.EARNED,
    amountCents: totalRewardCents,
    baseCents: approval.baseCents,
    bonusCents: approval.bonusCents,
    levelRewardCents,
    configuredLevelRewardCents,
    cashOverflowCents: approval.cashOverflowCents,
    dateKey: checkIn.dateKey,
    note: praise,
    createdAt: nowIso()
  };

  checkIn.status = CHECKIN_STATUS.APPROVED;
  checkIn.reviewedAt = nowIso();
  checkIn.reviewNote = praise;
  checkIn.rewardCents = totalRewardCents;
  checkIn.levelRewardCents = levelRewardCents;
  checkIn.configuredLevelRewardCents = configuredLevelRewardCents;
  checkIn.cashOverflowCents = approval.cashOverflowCents;
  checkIn.sunshine = approval.sunshine;
  checkIn.fruitDelta = approval.fruitDelta;
  checkIn.streak = approval.streak;
  checkIn.completedLevelId = adventureResult.completedLevel ? adventureResult.completedLevel.id : '';

  rel.balance.availableCents += totalRewardCents;
  rel.tree.sunshine += approval.sunshine;
  rel.tree.fruits += approval.fruitDelta;
  const approvedDatesAfterReview = approvedDateKeys(state, rel.id);
  const latestApprovedDate = approvedDatesAfterReview.slice().sort().pop() || checkIn.dateKey;
  rel.tree.streak = rewardEngine.calculateStreak(approvedDatesAfterReview, latestApprovedDate);
  rel.tree.lastApprovedDate = latestApprovedDate;
  rel.tree.lastCard = {
    ...approval.card,
    surpriseTitle: surpriseCard ? surpriseCard.title : (approval.streakBonus ? approval.streakBonus.surpriseTitle : ''),
    dateKey: checkIn.dateKey
  };
  const level = rewardEngine.getTreeLevel(rel.tree.sunshine);
  rel.tree.level = level.level;
  rel.tree.levelTitle = level.title;
  rel.tree.progressPercent = level.progressPercent;

  state.ledgers.push(ledger);
  const unlockedBadges = unlockBadgesForApproval(state, rel, checkIn, approval, adventureResult);
  if (surpriseCard) {
    addMilestone(state, rel, {
      sceneKey: 'checkin_surprise',
      eventKey: `checkin-surprise:${checkIn.id}:${surpriseCard.type}`,
      sourceId: checkIn.id,
      checkInId: checkIn.id,
      type: surpriseCard.type,
      title: surpriseCard.title,
      message: surpriseCard.message
    });
  }
  if (approval.cashOverflowCents > 0) {
    addMilestone(state, rel, {
      sceneKey: 'cash_overflow_love_pack',
      eventKey: `cash-overflow:${checkIn.id}`,
      sourceId: checkIn.id,
      checkInId: checkIn.id,
      type: 'love_pack',
      title: '爱心加油包',
      message: '今天的现金奖励到上限啦，多出来的心意变成 12 点阳光和一次专属庆祝。',
      cashOverflowCents: approval.cashOverflowCents
    });
  }
  if (approval.streak === 14) {
    addMilestone(state, rel, {
      sceneKey: 'streak_14',
      eventKey: 'streak:14',
      sourceId: checkIn.id,
      checkInId: checkIn.id,
      title: '连续 14 天，温柔坚持',
      message: '十四天不是被催出来的，是你一次次愿意照顾自己累积起来的。'
    });
  }
  if (adventureResult.completedLevel) {
    addMilestone(state, rel, {
      sceneKey: 'map_level_complete',
      eventKey: `map-level:${adventureResult.completedLevel.id}`,
      sourceId: checkIn.id,
      checkInId: checkIn.id,
      levelId: adventureResult.completedLevel.id,
      title: `一起通关「${adventureResult.completedLevel.name}」`,
      message: '这段路是你一步步走出来的，我很开心能一直在旁边陪你。'
    });
  }
  state.encouragementCards.push({
    id: nextId(state, 'card'),
    relationshipId: rel.id,
    checkInId: checkIn.id,
    title: approval.card.title,
    kind: 'approval',
    templateKey: 'approval',
    senderUserId: rel.sponsorId,
    recipientUserId: rel.participantId,
    clientRequestId: clientRequestIdFromInput(input),
    message: praise,
    surpriseTitle: surpriseCard ? surpriseCard.title : (approval.streakBonus ? approval.streakBonus.surpriseTitle : ''),
    readAt: null,
    createdAt: nowIso()
  });
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'checkin.approve',
    targetId: checkIn.id,
    amountCents: totalRewardCents,
    note: praise
  });
  const primaryMilestone = selectPrimaryMilestone(
    state.surpriseCards.filter((item) => !milestoneIdsBefore.has(item.id))
  );
  saveState(state);
  return {
    checkIn,
    ledger,
    primaryMilestone,
    approval: {
      ...approval,
      levelRewardCents,
      totalCents: totalRewardCents,
      adventureResult,
      surpriseCard,
      unlockedBadges,
      primaryMilestone
    },
    relationship: decorateRelationship(rel)
  };
}

function rejectCheckIn(input) {
  const state = getState();
  const checkIn = state.checkIns.find((item) => item.id === input.checkInId);
  if (!checkIn) throw new Error('找不到这条打卡');

  const rel = assertRelationship(state, checkIn.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (checkIn.status !== CHECKIN_STATUS.SUBMITTED) throw new Error('这条打卡已经审核过了');

  const reason = validateText(input.reason, 200, '退回原因') || '这张照片看不清运动记录，我们换一张更清楚的再记奖励。';
  checkIn.status = CHECKIN_STATUS.REJECTED;
  checkIn.reviewedAt = nowIso();
  checkIn.reviewNote = reason;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'checkin.reject',
    targetId: checkIn.id,
    note: checkIn.reviewNote
  });
  saveState(state);
  return checkIn;
}

function requestWithdrawal(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);

  const amountCents = validateCents(Number(input.amountCents || 0), AMOUNT_LIMITS.withdrawal, '心愿金领取金额');
  if (rel.balance.availableCents < amountCents) throw new Error('可领取心愿金不足');

  rel.balance.availableCents -= amountCents;
  rel.balance.frozenCents += amountCents;

  const request = {
    id: nextId(state, 'withdraw'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sponsorId: rel.sponsorId,
    amountCents,
    amountText: rewardEngine.moneyText(amountCents),
    status: WITHDRAWAL_STATUS.PENDING_REVIEW,
    note: input.note || '',
    createdAt: nowIso()
  };
  const ledger = {
    id: nextId(state, 'ledger'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sourceId: request.id,
    type: 'withdrawal',
    status: LEDGER_STATUS.WITHDRAW_REQUESTED,
    amountCents: -amountCents,
    dateKey: todayKey(),
    note: '心愿金领取申请，等待赞助者手动兑现',
    createdAt: nowIso()
  };

  state.withdrawals.push(request);
  state.ledgers.push(ledger);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'withdrawal.request',
    targetId: request.id,
    amountCents,
    note: input.note || ''
  });
  saveState(state);
  return request;
}

function findWithdrawalWithLedger(state, withdrawalId) {
  const request = state.withdrawals.find((item) => item.id === withdrawalId);
  if (!request) throw new Error('找不到这条心愿金申请');
  const ledger = state.ledgers.find((item) => item.sourceId === request.id && item.type === 'withdrawal');
  return { request, ledger };
}

function approveWithdrawal(input) {
  const state = getState();
  const found = findWithdrawalWithLedger(state, input.withdrawalId);
  const rel = assertRelationship(state, found.request.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (found.request.status !== WITHDRAWAL_STATUS.PENDING_REVIEW) throw new Error('这条心愿金申请不能重复审核');

  Object.assign(found.request, payoutProvider.approve(found.request));
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'withdrawal.approve',
    targetId: found.request.id,
    amountCents: found.request.amountCents
  });
  saveState(state);
  return found.request;
}

function markWithdrawalPaid(input) {
  requireConfirmed(input, '标记已手动兑现', { requireNote: true });
  const state = getState();
  const found = findWithdrawalWithLedger(state, input.withdrawalId);
  const rel = assertRelationship(state, found.request.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (found.request.status !== WITHDRAWAL_STATUS.APPROVED_WAITING_TRANSFER) throw new Error('请先通过心愿金申请，再标记已兑现');

  Object.assign(found.request, payoutProvider.markPaid(found.request, input.transferNote));
  rel.balance.frozenCents -= found.request.amountCents;
  rel.balance.paidOutCents += found.request.amountCents;
  if (found.ledger) found.ledger.status = LEDGER_STATUS.PAID_OUT;
  const primaryMilestone = addMilestone(state, rel, {
    sceneKey: 'wish_fund_complete',
    eventKey: `wish-fund-complete:${found.request.id}`,
    sourceId: found.request.id,
    withdrawalId: found.request.id,
    title: '心愿被认真兑现',
    message: '这份奖励不是交易，是我想把答应你的事情好好做到。'
  });
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'withdrawal.markPaid',
    targetId: found.request.id,
    amountCents: found.request.amountCents,
    note: input.transferNote
  });
  saveState(state);
  return {
    ...found.request,
    primaryMilestone
  };
}

function rejectWithdrawal(input) {
  requireConfirmed(input, '退回心愿金申请', { requireNote: true });
  const state = getState();
  const found = findWithdrawalWithLedger(state, input.withdrawalId);
  const rel = assertRelationship(state, found.request.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (found.request.status === WITHDRAWAL_STATUS.PAID || found.request.status === WITHDRAWAL_STATUS.REJECTED) throw new Error('这条心愿金申请已经结束');

  Object.assign(found.request, payoutProvider.reject(found.request, input.reason));
  rel.balance.frozenCents -= found.request.amountCents;
  rel.balance.availableCents += found.request.amountCents;
  if (found.ledger) found.ledger.status = LEDGER_STATUS.CANCELLED;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'withdrawal.reject',
    targetId: found.request.id,
    amountCents: found.request.amountCents,
    note: input.reason
  });
  saveState(state);
  return found.request;
}

function updateRewardRule(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  rel.rewardRule = validateRewardRule({
    ...rewardEngine.normalizeRule(rel.rewardRule),
    ...input.rule,
    streakBonuses: input.rule.streakBonuses || rel.rewardRule.streakBonuses
  });
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'rewardRule.update',
    targetId: rel.id
  });
  saveState(state);
  return rel.rewardRule;
}

function updateAdventureLevels(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  const byId = new Map(state.adventureLevels.map((level) => [level.id, level]));
  const levels = (input.levels || []).map((levelInput) => {
    const existing = byId.get(levelInput.id);
    if (!existing) throw new Error('找不到这个地图关卡');
    const requiredSteps = Number(levelInput.requiredSteps);
    if (!Number.isInteger(requiredSteps) || requiredSteps < 1 || requiredSteps > 45) {
      throw new Error('每个地图关卡天数必须是 1 到 45 的整数');
    }
    const rewardCents = validateCents(Number(levelInput.rewardCents || 0), AMOUNT_LIMITS.levelReward, '地图通关奖励');
    return {
      ...existing,
      requiredSteps,
      rewardCents
    };
  });
  const mergedById = new Map(state.adventureLevels.map((level) => [level.id, level]));
  levels.forEach((level) => mergedById.set(level.id, level));
  const merged = Array.from(mergedById.values()).sort((left, right) => Number(left.sortOrder || left.levelId) - Number(right.sortOrder || right.levelId));
  const totalSteps = merged.reduce((sum, level) => sum + Number(level.requiredSteps || 0), 0);
  if (totalSteps > 45) throw new Error('地图关卡总天数不能超过 45 天');
  state.adventureLevels = merged;
  state.meta.adventureLevelsCustomized = true;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'adventureLevels.update',
    targetId: rel.id,
    note: `totalSteps=${totalSteps}`
  });
  saveState(state);
  return getAdventure({ ...input, relationshipId: rel.id });
}

function listPendingCheckIns(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  assertActorSponsor(state, rel, input);
  return relationshipCheckIns(state, rel.id)
    .filter((item) => item.status === CHECKIN_STATUS.SUBMITTED)
    .reverse();
}

function listWithdrawals(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  return state.withdrawals.filter((item) => item.relationshipId === rel.id).slice().reverse();
}

function listHistory(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  return relationshipCheckIns(state, rel.id).slice().reverse();
}

function listLedgers(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  return state.ledgers
    .filter((item) => item.relationshipId === rel.id)
    .slice()
    .reverse()
    .map((item) => ({
      ...item,
      amountText: rewardEngine.moneyText(Math.abs(Number(item.amountCents || 0))),
      signedAmountText: `${Number(item.amountCents || 0) >= 0 ? '+' : '-'}${rewardEngine.moneyText(Math.abs(Number(item.amountCents || 0)))}`
    }));
}

function getProfileEditState(input = {}) {
  const state = getState();
  const actor = getActor(state, input);
  const rel = getRelationshipForActor(state, actor);
  return decorateProfileEditState(actor.user, rel);
}

function updateProfile(input = {}) {
  const state = getState();
  const actor = getActor(state, input);
  const rel = getRelationshipForActor(state, actor);
  const changes = {};
  const fields = [];

  if (Object.prototype.hasOwnProperty.call(input, 'name') || Object.prototype.hasOwnProperty.call(input, 'nickname')) {
    const nextName = validateNickname(Object.prototype.hasOwnProperty.call(input, 'name') ? input.name : input.nickname);
    if (nextName !== actor.user.name) {
      changes.name = nextName;
      fields.push('nickname');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'avatarFileId') || Object.prototype.hasOwnProperty.call(input, 'avatarUrl')) {
    const nextAvatarFileId = String(input.avatarFileId || '').trim();
    const nextAvatarUrl = String(input.avatarUrl || '').trim();
    if (!nextAvatarFileId && !nextAvatarUrl) throw new Error('请先选择头像');
    if (nextAvatarFileId !== actor.user.avatarFileId || nextAvatarUrl !== actor.user.avatarUrl) {
      changes.avatarFileId = nextAvatarFileId;
      changes.avatarUrl = nextAvatarUrl;
      fields.push('avatar');
    }
  }

  if (!fields.length) {
    return {
      user: decorateUser(actor.user, rel),
      costCents: 0,
      costText: '0.00',
      changedFields: []
    };
  }

  const plan = planProfileEditUsage(actor.user, rel, fields);
  Object.assign(actor.user, changes);
  if (changes.name && !actor.user.avatarFileId && !actor.user.avatarUrl) {
    actor.user.avatarText = changes.name.slice(0, 1);
  }
  actor.user.profileEditUsage = plan.usageDraft;

  if (plan.totalCostCents > 0) {
    rel.balance.availableCents -= plan.totalCostCents;
    state.ledgers.push({
      id: nextId(state, 'ledger'),
      relationshipId: rel.id,
      userId: actor.user.id,
      sourceId: actor.user.id,
      type: 'profile_edit_fee',
      status: LEDGER_STATUS.REDEEMED,
      amountCents: -plan.totalCostCents,
      dateKey: todayKey(),
      note: `额外修改${fields.map((field) => field === 'nickname' ? '昵称' : '头像').join('和')}`,
      createdAt: nowIso()
    });
  }

  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'profile.update',
    targetId: actor.user.id,
    amountCents: plan.totalCostCents,
    note: fields.join(',')
  });
  saveState(state);
  return {
    user: decorateUser(actor.user, rel),
    costCents: plan.totalCostCents,
    costText: rewardEngine.moneyText(plan.totalCostCents),
    changedFields: fields
  };
}

function equipBadges(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);
  const badgeIds = Array.from(new Set(input.badgeIds || [])).filter(Boolean);
  if (badgeIds.length > 3) throw new Error('最多只能佩戴 3 个成就');
  badgeIds.forEach((badgeId) => {
    if (!hasBadge(state, rel.id, badgeId)) throw new Error('只能佩戴已经解锁的成就');
  });
  rel.equippedBadgeIds = badgeIds;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'badge.equip',
    targetId: rel.id,
    note: badgeIds.join(',')
  });
  saveState(state);
  return getBadgeWall({ ...input, relationshipId: rel.id });
}

function viewTypeLabel(viewType) {
  const labels = {
    progress: '运动进度',
    history: '打卡历史',
    badges: '成就墙',
    ledgers: '能量币记录',
    redemptions: '兑换记录',
    profile: '个人资料'
  };
  return labels[viewType] || '动态';
}

function recordCompanionView(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  const participant = state.users.find((user) => user.id === rel.participantId);
  const viewType = input.viewType || 'progress';
  const viewLabel = input.viewLabel || viewTypeLabel(viewType);
  const now = nowIso();
  const duplicate = state.companionViewNotices
    .filter((notice) => notice.relationshipId === rel.id && notice.viewerOpenid === actor.openid && notice.viewType === viewType)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  if (duplicate && nowMs() - new Date(duplicate.createdAt).getTime() < 5 * 60 * 1000) {
    return {
      ...duplicate,
      deduped: true
    };
  }

  const notice = {
    id: nextId(state, 'notice'),
    relationshipId: rel.id,
    targetUserId: rel.participantId,
    targetOpenid: rel.participantOpenid,
    viewerUserId: actor.user.id,
    viewerOpenid: actor.openid,
    viewType,
    viewLabel,
    message: `${actor.user.name || '男朋友'}刚刚查看了你的${viewLabel}`,
    subscriptionStatus: 'not_configured',
    createdAt: now,
    readAt: ''
  };
  state.companionViewNotices.push(notice);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'companion.view',
    targetId: rel.participantId,
    note: viewType
  });
  saveState(state);
  return {
    ...notice,
    targetUser: decorateUser(participant, rel)
  };
}

function listViewNotices(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);
  return state.companionViewNotices
    .filter((notice) => notice.relationshipId === rel.id && notice.targetOpenid === actor.openid)
    .filter((notice) => !input.unreadOnly || !notice.readAt)
    .slice()
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function markViewNoticesRead(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);
  const ids = input.noticeIds || input.ids || [];
  const idSet = new Set(ids);
  const now = nowIso();
  let count = 0;
  state.companionViewNotices.forEach((notice) => {
    const shouldMark = notice.relationshipId === rel.id
      && notice.targetOpenid === actor.openid
      && !notice.readAt
      && (!idSet.size || idSet.has(notice.id));
    if (shouldMark) {
      notice.readAt = now;
      count += 1;
    }
  });
  if (count) {
    addAuditLog(state, {
      relationshipId: rel.id,
      actorOpenid: actor.openid,
      action: 'notice.read',
      targetId: rel.participantId,
      note: String(count)
    });
    saveState(state);
  }
  return { count };
}

function saveSubscriptionGrant(input = {}) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);
  const grant = {
    id: nextId(state, 'sub'),
    relationshipId: rel.id,
    userId: actor.user.id,
    openid: actor.openid,
    type: input.type || 'companion_view',
    templateId: input.templateId || '',
    status: input.status || 'accepted',
    createdAt: nowIso()
  };
  state.subscriptionGrants.push(grant);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'subscription.saveGrant',
    targetId: grant.id,
    note: grant.status
  });
  saveState(state);
  return grant;
}

function sendEncouragement(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  const actor = assertActorSponsor(state, rel, input);
  const templateKey = String(input.templateKey || '').trim();
  const template = ENCOURAGEMENT_TEMPLATES[templateKey];
  if (!template) throw new Error('请选择有效的鼓励模板');
  const customMessage = validateText(input.customMessage, 60, '真心话');
  const card = {
    id: nextId(state, 'card'),
    relationshipId: rel.id,
    kind: 'manual',
    templateKey,
    senderUserId: rel.sponsorId,
    recipientUserId: rel.participantId,
    clientRequestId: clientRequestIdFromInput(input),
    title: template.title,
    templateMessage: template.message,
    customMessage,
    message: customMessage || template.message,
    readAt: null,
    createdAt: nowIso()
  };
  state.encouragementCards.push(card);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'encouragement.send',
    targetId: card.id,
    note: templateKey
  });
  saveState(state);
  return card;
}

function queryEncouragements(input = {}) {
  const state = getState();
  const { rel, actor } = resolveRelationshipForActor(state, input);
  const isParticipant = actor.user.id === rel.participantId;
  const relevant = state.encouragementCards.filter((card) => {
    if (card.relationshipId !== rel.id) return false;
    if (isParticipant) return card.recipientUserId === actor.user.id;
    return card.senderUserId === actor.user.id;
  });
  return relevant
    .filter((card) => !input.unreadOnly || !card.readAt)
    .slice()
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

function markEncouragementRead(input = {}) {
  const state = getState();
  const card = state.encouragementCards.find((item) => item.id === input.encouragementId);
  if (!card) throw new Error('找不到这张鼓励卡');
  const rel = assertRelationship(state, card.relationshipId);
  const actor = assertActorInRelationship(state, rel, input);
  if (actor.user.id !== card.recipientUserId) throw new Error('只有这张鼓励卡的收件人女朋友可以收下抱抱');
  if (!card.readAt) card.readAt = nowIso();
  saveState(state);
  return card;
}

function queryMilestones(input = {}) {
  const state = getState();
  const { rel, actor } = resolveRelationshipForActor(state, input);
  return state.surpriseCards
    .filter((item) => item.relationshipId === rel.id)
    .filter((item) => !input.unseenOnly || !(item.seenByUserIds || []).includes(actor.user.id))
    .slice()
    .sort((left, right) => {
      const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
      if (priorityDiff) return priorityDiff;
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    });
}

function markMilestoneSeen(input = {}) {
  const state = getState();
  const milestone = state.surpriseCards.find((item) => item.id === input.milestoneId);
  if (!milestone) throw new Error('找不到这段共同里程碑');
  const rel = assertRelationship(state, milestone.relationshipId);
  const actor = assertActorInRelationship(state, rel, input);
  milestone.seenByUserIds = Array.from(new Set([...(milestone.seenByUserIds || []), actor.user.id]));
  saveState(state);
  return milestone;
}

function recordDateKey(value) {
  if (!value) return '';
  return todayKey(value);
}

function isDateKeyWithin(dateKey, startDateKey, endDateKey) {
  return Boolean(dateKey) && dateKey >= startDateKey && dateKey <= endDateKey;
}

function inferredCheckInSunshine(checkIn, rel) {
  const stored = Number(checkIn.sunshine);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  const rule = rewardEngine.normalizeRule(rel.rewardRule);
  const hasStreakBonus = Boolean(rewardEngine.resolveStreakBonus(rule, Number(checkIn.streak || 0)));
  return Number(rule.sunshinePerCheckIn || 0)
    + (hasStreakBonus ? 6 : 0)
    + (Number(checkIn.cashOverflowCents || 0) > 0 ? 12 : 0);
}

function queryWeeklyRecap(input = {}) {
  const state = getState();
  const { rel, actor } = resolveRelationshipForActor(state, input);
  const weekOffset = input.weekOffset === undefined ? 0 : Number(input.weekOffset);
  if (!Number.isInteger(weekOffset) || weekOffset > 0 || weekOffset < -12) {
    throw new Error('每周回顾仅支持 0 到 -12 周');
  }
  const { startDateKey, endDateKey } = chinaWeekRange(nowIso(), weekOffset);
  const checkIns = relationshipCheckIns(state, rel.id)
    .filter((item) => item.status === CHECKIN_STATUS.APPROVED)
    .filter((item) => isDateKeyWithin(item.dateKey, startDateKey, endDateKey));
  const badgeItems = state.badgeUnlocks.filter((item) => (
    item.relationshipId === rel.id
    && isDateKeyWithin(recordDateKey(item.unlockedAt), startDateKey, endDateKey)
  ));
  const redemptionItems = state.redemptions.filter((item) => (
    item.relationshipId === rel.id
    && isDateKeyWithin(recordDateKey(item.redeemedAt || item.createdAt), startDateKey, endDateKey)
  ));
  const encouragementItems = state.encouragementCards.filter((item) => (
    item.relationshipId === rel.id
    && item.recipientUserId === rel.participantId
    && isDateKeyWithin(recordDateKey(item.createdAt), startDateKey, endDateKey)
  ));
  const completedCheckIns = checkIns.filter((item) => item.completedLevelId);
  const maxStreak = checkIns.reduce((maximum, item) => Math.max(maximum, Number(item.streak || 0)), 0);
  const stats = {
    approvedDays: new Set(checkIns.map((item) => item.dateKey)).size,
    durationMinutes: checkIns.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0),
    cashRewardCents: checkIns.reduce((sum, item) => sum + Number(item.rewardCents || 0), 0),
    sunshine: checkIns.reduce((sum, item) => sum + inferredCheckInSunshine(item, rel), 0),
    badges: badgeItems.length,
    mapSteps: checkIns.length,
    completedLevels: completedCheckIns.length,
    redemptions: redemptionItems.length,
    encouragementsReceived: encouragementItems.length,
    maxStreak
  };

  let bestMoment;
  if (completedCheckIns.length) {
    const latest = completedCheckIns.slice().sort((left, right) => String(right.dateKey).localeCompare(String(left.dateKey)))[0];
    const level = state.adventureLevels.find((item) => item.id === latest.completedLevelId);
    bestMoment = {
      sceneKey: 'map_level_complete',
      title: level ? `一起通关「${level.name}」` : '一起完成了地图新关卡',
      message: '这一段路，是你一步步走出来的。'
    };
  } else if (badgeItems.length) {
    const latest = badgeItems.slice().sort((left, right) => String(right.unlockedAt || '').localeCompare(String(left.unlockedAt || '')))[0];
    bestMoment = {
      sceneKey: milestoneSceneForBadge(latest.badgeId),
      title: `解锁「${latest.badgeName || '新成就'}」`,
      message: latest.story || '你的认真又被小树记住了一次。'
    };
  } else if (maxStreak >= 3) {
    const streakScene = maxStreak >= 14 ? 'streak_14' : maxStreak >= 7 ? 'streak_7' : 'streak_3';
    bestMoment = {
      sceneKey: streakScene,
      title: `连续 ${maxStreak} 天温柔坚持`,
      message: '不是为了赶进度，而是在一次次认真照顾自己。'
    };
  } else if (checkIns.length) {
    bestMoment = {
      sceneKey: 'checkin_envelope',
      title: '这周的每一次开始都很珍贵',
      message: '愿意动一动，就已经是一份值得被看见的小胜利。'
    };
  } else {
    bestMoment = {
      sceneKey: 'gentle_empty_week',
      title: '这一周也可以慢慢来',
      message: '休息不是退步，我会陪着你，等你舒服的时候再一起出发。'
    };
  }

  const isParticipant = actor.user.id === rel.participantId;
  const isEmpty = checkIns.length === 0
    && badgeItems.length === 0
    && redemptionItems.length === 0
    && encouragementItems.length === 0;
  return {
    relationshipId: rel.id,
    role: isParticipant ? 'participant' : 'sponsor',
    weekOffset,
    startDateKey,
    endDateKey,
    weekLabel: `${displayDate(startDateKey)}—${displayDate(endDateKey)}`,
    headline: isParticipant
      ? '这周的每一步，都被好好看见了'
      : '这周她的努力，你一直有认真陪着',
    isEmpty,
    activityDays: Array.from(new Set(checkIns.map((item) => item.dateKey))).sort(),
    stats: {
      ...stats,
      cashRewardText: rewardEngine.moneyText(stats.cashRewardCents)
    },
    bestMoment,
    badges: badgeItems.map((item) => ({
      id: item.id,
      badgeId: item.badgeId,
      badgeName: item.badgeName,
      unlockedAt: item.unlockedAt
    })),
    redemptions: redemptionItems.map((item) => ({
      id: item.id,
      rewardName: item.rewardName || '',
      costCents: Number(item.costCents || 0),
      redeemedAt: item.redeemedAt || item.createdAt || ''
    })),
    encouragements: encouragementItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      templateKey: item.templateKey,
      title: item.title,
      message: item.message,
      createdAt: item.createdAt
    }))
  };
}

function querySponsorDashboard(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  assertActorSponsor(state, rel, input);
  const participant = state.users.find((user) => user.id === rel.participantId);
  const badges = getBadgeWall({ ...input, relationshipId: rel.id });
  return {
    dashboard: getDashboard(input),
    companionUser: decorateUser(participant, rel),
    stats: getStats(state, rel),
    recentCheckIns: relationshipCheckIns(state, rel.id).slice(-5).reverse(),
    recentLedgers: listLedgers(input).slice(0, 5),
    recentRedemptions: listRedemptions(input).slice(0, 5),
    equippedBadges: badges.filter((badge) => badge.equipped && badge.unlocked),
    badges
  };
}

function queryCompanionDetail(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  assertActorSponsor(state, rel, input);
  const viewType = input.viewType || 'progress';
  const notice = input.recordView === false ? null : recordCompanionView({
    ...input,
    viewType,
    viewLabel: input.viewLabel || viewTypeLabel(viewType)
  });
  const dashboard = getDashboard(input);
  const result = {
    viewType,
    viewLabel: viewTypeLabel(viewType),
    notice,
    dashboard,
    companionUser: dashboard.companionUser
  };
  if (viewType === 'history') result.history = listHistory(input);
  if (viewType === 'badges') result.badges = getBadgeWall(input);
  if (viewType === 'ledgers') result.ledgers = listLedgers(input);
  if (viewType === 'redemptions') result.redemptions = listRedemptions(input);
  if (viewType === 'progress') {
    result.stats = getStats(state, rel);
    result.calendar = getCalendarStats(input);
    result.adventure = getAdventure(input);
  }
  return result;
}

function listRewardItems(input = {}) {
  const state = getState();
  const { rel, actor } = resolveRelationshipForActor(state, input);
  if (input.includeInactive) {
    if (actor.openid !== rel.sponsorOpenid) throw new Error('只有赞助者可以查看停用奖品');
  }
  const category = input.category || 'all';
  return state.rewardItems
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => input.includeInactive || item.isActive)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((item) => ({
      ...item,
      priceText: rewardEngine.moneyText(item.priceCents),
      soldOut: Number(item.stock) === 0
    }));
}

function getRewardItem(input = {}) {
  const state = getState();
  resolveRelationshipForActor(state, input);
  const id = input.id;
  const item = state.rewardItems.find((reward) => reward.id === id);
  if (!item) throw new Error('找不到这个奖励');
  return {
    ...item,
    priceText: rewardEngine.moneyText(item.priceCents),
    soldOut: Number(item.stock) === 0
  };
}

function listRedemptions(input = {}) {
  const state = getState();
  const { rel } = resolveRelationshipForActor(state, input);
  return state.redemptions
    .filter((item) => item.relationshipId === rel.id)
    .slice()
    .reverse()
    .map((item) => ({
      ...item,
      costText: rewardEngine.moneyText(item.costCents)
    }));
}

function redeemReward(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorParticipant(state, rel, input);
  const milestoneIdsBefore = new Set(state.surpriseCards.map((record) => record.id));
  const item = state.rewardItems.find((reward) => reward.id === input.rewardId);
  if (!item) throw new Error('找不到这个奖励');
  validateCents(Number(item.priceCents || 0), AMOUNT_LIMITS.rewardItem, '奖品价格');
  if (!item.isActive) throw new Error('这个奖励暂时下架了');
  if (Number(item.stock) === 0) throw new Error('这个奖励已经兑完了');
  if (rel.balance.availableCents < item.priceCents) throw new Error('能量币还不够，再攒几天就能换啦');

  rel.balance.availableCents -= item.priceCents;
  if (Number(item.stock) > 0) item.stock -= 1;

  const redemption = {
    id: nextId(state, 'redeem'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sponsorId: rel.sponsorId,
    rewardId: item.id,
    rewardName: item.name,
    rewardDescription: item.description,
    category: item.category,
    costCents: item.priceCents,
    status: REDEMPTION_STATUS.PENDING,
    note: input.note || '',
    redeemedAt: nowIso(),
    usedAt: null
  };
  const ledger = {
    id: nextId(state, 'ledger'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sourceId: redemption.id,
    type: 'redemption',
    status: LEDGER_STATUS.REDEEMED,
    amountCents: -item.priceCents,
    dateKey: todayKey(),
    note: `兑换「${item.name}」`,
    createdAt: nowIso()
  };
  state.redemptions.push(redemption);
  state.ledgers.push(ledger);
  const redemptionCount = state.redemptions.filter((record) => record.relationshipId === rel.id).length;
  unlockBadge(state, rel, 'first_redemption', redemption.id, '第一次把能量币换成了认真兑现的小奖励。');
  if (redemptionCount >= 5) {
    unlockBadge(state, rel, 'redemption_collector', redemption.id, '已经累计兑换 5 次奖励。');
  }
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'redemption.create',
    targetId: redemption.id,
    amountCents: item.priceCents,
    note: item.name
  });
  const primaryMilestone = selectPrimaryMilestone(
    state.surpriseCards.filter((record) => !milestoneIdsBefore.has(record.id))
  );
  saveState(state);
  return {
    ...redemption,
    costText: rewardEngine.moneyText(redemption.costCents),
    primaryMilestone
  };
}

function verifyRedemption(input) {
  requireConfirmed(input, '核销兑换券', { requireNote: true });
  const state = getState();
  const redemption = state.redemptions.find((item) => item.id === input.redemptionId);
  if (!redemption) throw new Error('找不到这张兑换券');
  const rel = assertRelationship(state, redemption.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (redemption.status !== REDEMPTION_STATUS.PENDING) throw new Error('这张兑换券已经处理过了');
  redemption.status = REDEMPTION_STATUS.USED;
  redemption.usedAt = nowIso();
  redemption.verifyNote = input.note || '男朋友已线下兑现';
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'redemption.verify',
    targetId: redemption.id,
    amountCents: redemption.costCents,
    note: redemption.verifyNote
  });
  saveState(state);
  return redemption;
}

function findRedemptionWithLedger(state, redemptionId) {
  const redemption = state.redemptions.find((item) => item.id === redemptionId);
  if (!redemption) throw new Error('找不到这张兑换券');
  const ledger = state.ledgers.find((item) => item.sourceId === redemption.id && item.type === 'redemption');
  return { redemption, ledger };
}

function requestCancelRedemption(input) {
  const state = getState();
  const found = findRedemptionWithLedger(state, input.redemptionId);
  const rel = assertRelationship(state, found.redemption.relationshipId);
  const actor = assertActorParticipant(state, rel, input);
  if (found.redemption.status !== REDEMPTION_STATUS.PENDING) throw new Error('只有待使用兑换券可以申请取消');
  found.redemption.status = REDEMPTION_STATUS.CANCEL_REQUESTED;
  found.redemption.cancelReason = input.reason || '想先取消这次兑换';
  found.redemption.cancelRequestedAt = nowIso();
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'redemption.cancelRequest',
    targetId: found.redemption.id,
    amountCents: found.redemption.costCents,
    note: found.redemption.cancelReason
  });
  saveState(state);
  return found.redemption;
}

function approveCancelRedemption(input) {
  requireConfirmed(input, '确认取消并退款', { requireNote: true });
  const state = getState();
  const found = findRedemptionWithLedger(state, input.redemptionId);
  const rel = assertRelationship(state, found.redemption.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (found.redemption.status !== REDEMPTION_STATUS.CANCEL_REQUESTED) throw new Error('这张兑换券没有待确认的取消申请');

  const rewardItem = state.rewardItems.find((item) => item.id === found.redemption.rewardId);
  rel.balance.availableCents += found.redemption.costCents;
  if (rewardItem && Number(rewardItem.stock) >= 0) rewardItem.stock += 1;
  found.redemption.status = REDEMPTION_STATUS.CANCELLED_REFUNDED;
  found.redemption.cancelApprovedAt = nowIso();
  found.redemption.cancelApproveNote = input.note;
  if (found.ledger) found.ledger.status = LEDGER_STATUS.CANCELLED;
  state.ledgers.push({
    id: nextId(state, 'ledger'),
    relationshipId: rel.id,
    userId: rel.participantId,
    sourceId: found.redemption.id,
    type: 'redemption_refund',
    status: LEDGER_STATUS.REFUNDED,
    amountCents: found.redemption.costCents,
    dateKey: todayKey(),
    note: `取消兑换「${found.redemption.rewardName}」并退款`,
    createdAt: nowIso()
  });
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'redemption.cancelApprove',
    targetId: found.redemption.id,
    amountCents: found.redemption.costCents,
    note: input.note
  });
  saveState(state);
  return found.redemption;
}

function rejectCancelRedemption(input) {
  requireConfirmed(input, '拒绝取消申请', { requireNote: true });
  const state = getState();
  const found = findRedemptionWithLedger(state, input.redemptionId);
  const rel = assertRelationship(state, found.redemption.relationshipId);
  const actor = assertActorSponsor(state, rel, input);
  if (found.redemption.status !== REDEMPTION_STATUS.CANCEL_REQUESTED) throw new Error('这张兑换券没有待确认的取消申请');
  found.redemption.status = REDEMPTION_STATUS.PENDING;
  found.redemption.cancelRejectedAt = nowIso();
  found.redemption.cancelRejectReason = input.reason || input.note;
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: 'redemption.cancelReject',
    targetId: found.redemption.id,
    amountCents: found.redemption.costCents,
    note: found.redemption.cancelRejectReason
  });
  saveState(state);
  return found.redemption;
}

function saveRewardItem(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  const id = input.id || nextId(state, 'reward');
  const existing = state.rewardItems.find((item) => item.id === id);
  const priceCents = validateCents(Number(input.priceCents || 0), AMOUNT_LIMITS.rewardItem, '奖品价格');
  const stock = input.stock === undefined || input.stock === '' ? -1 : Number(input.stock);
  if (!Number.isInteger(stock) || stock < -1) throw new Error('库存必须是 -1 或非负整数');
  const item = {
    id,
    name: input.name || '新的奖励',
    description: input.description || '一份认真兑现的小奖励。',
    priceCents,
    category: input.category || 'emotion',
    imageTone: input.imageTone || (existing && existing.imageTone) || '#ffe0ea',
    imageFileId: input.imageFileId || (existing && existing.imageFileId) || '',
    imageUrl: input.imageUrl || (existing && existing.imageUrl) || '',
    stock,
    isActive: input.isActive === undefined
      ? (existing ? existing.isActive !== false : true)
      : Boolean(input.isActive),
    sortOrder: input.sortOrder === undefined ? state.rewardItems.length + 1 : Number(input.sortOrder)
  };
  if (existing) {
    Object.assign(existing, item);
  } else {
    state.rewardItems.push(item);
  }
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: existing ? 'rewardItem.update' : 'rewardItem.create',
    targetId: item.id,
    amountCents: item.priceCents,
    note: item.name
  });
  saveState(state);
  return item;
}

function deleteRewardItem(input) {
  requireConfirmed(input, '删除奖品');
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  const index = state.rewardItems.findIndex((reward) => reward.id === input.rewardId);
  if (index < 0) throw new Error('找不到这个奖励');
  const item = state.rewardItems[index];
  const hasRedemptions = state.redemptions.some((redemption) => redemption.rewardId === item.id);
  if (hasRedemptions) {
    item.isActive = false;
    item.deletedAt = nowIso();
    item.deleteMode = 'deactivated_due_to_history';
  } else {
    state.rewardItems.splice(index, 1);
  }
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: hasRedemptions ? 'rewardItem.deleteAsDeactivate' : 'rewardItem.delete',
    targetId: item.id,
    amountCents: item.priceCents,
    note: input.note || item.name
  });
  saveState(state);
  return {
    ...item,
    deleted: !hasRedemptions,
    deactivated: hasRedemptions
  };
}

function toggleRewardItem(input) {
  const state = getState();
  const rel = assertRelationship(state, input.relationshipId || state.activeRelationshipId);
  const actor = assertActorSponsor(state, rel, input);
  const item = state.rewardItems.find((reward) => reward.id === input.rewardId);
  if (!item) throw new Error('找不到这个奖励');
  item.isActive = input.isActive === undefined ? !item.isActive : Boolean(input.isActive);
  addAuditLog(state, {
    relationshipId: rel.id,
    actorOpenid: actor.openid,
    action: item.isActive ? 'rewardItem.activate' : 'rewardItem.deactivate',
    targetId: item.id,
    note: item.name
  });
  saveState(state);
  return item;
}

function createRelationship(input) {
  const state = getState();
  const sponsorId = input.sponsorId || nextId(state, 'user');
  const participantId = input.participantId || nextId(state, 'user');
  if (!state.users.find((user) => user.id === sponsorId)) {
    state.users.push(createDefaultUser({ id: sponsorId, name: input.sponsorName || '赞助者', role: 'sponsor', openid: input.sponsorOpenid || `${sponsorId}_openid`, avatarText: '赞' }));
  }
  if (!state.users.find((user) => user.id === participantId)) {
    state.users.push(createDefaultUser({ id: participantId, name: input.participantName || '打卡者', role: 'participant', openid: input.participantOpenid || `${participantId}_openid`, avatarText: '卡' }));
  }
  const sponsor = state.users.find((user) => user.id === sponsorId);
  const participant = state.users.find((user) => user.id === participantId);
  const rel = {
    id: nextId(state, 'rel'),
    type: input.type || 'pair',
    lifecycleStatus: 'active',
    unbindRequest: null,
    title: input.title || '新的能量树',
    sponsorId,
    participantId,
    sponsorOpenid: sponsor.openid,
    participantOpenid: participant.openid,
    rewardRule: clone(DEFAULT_REWARD_RULE),
    balance: createDefaultBalance(),
    tree: createDefaultTree(),
    adventure: createDefaultAdventure(),
    equippedBadgeIds: []
  };
  state.relationships.push(rel);
  saveState(state);
  return rel;
}

module.exports = {
  approveCheckIn: withMutationReceipt('checkin.approve', approveCheckIn),
  approveCancelRedemption: withMutationReceipt('redemption.cancelApprove', approveCancelRedemption),
  approveWithdrawal: withMutationReceipt('withdrawal.approve', approveWithdrawal),
  centsFromYuan,
  createRelationship: withMutationReceipt('relationship.create', createRelationship),
  deleteRewardItem: withMutationReceipt('rewardItem.delete', deleteRewardItem),
  equipBadges: withMutationReceipt('badge.equip', equipBadges),
  getAdventure,
  getBadgeWall,
  getCalendarStats,
  getDashboard,
  getProfileEditState,
  getRewardItem,
  getState,
  listLedgers,
  listHistory,
  listPendingCheckIns,
  listRedemptions,
  listRewardItems,
  listWithdrawals,
  login,
  markEncouragementRead: withMutationReceipt('encouragement.read', markEncouragementRead),
  markMilestoneSeen: withMutationReceipt('milestone.seen', markMilestoneSeen),
  markWithdrawalPaid: withMutationReceipt('withdrawal.markPaid', markWithdrawalPaid),
  markViewNoticesRead: withMutationReceipt('notice.read', markViewNoticesRead),
  moneyText: rewardEngine.moneyText,
  queryEncouragements,
  queryCompanionDetail,
  queryMilestones,
  querySponsorDashboard,
  queryWeeklyRecap,
  requestRelationshipUnbind: withMutationReceipt('relationship.unbind.request', requestRelationshipUnbind),
  cancelRelationshipUnbind: withMutationReceipt('relationship.unbind.cancel', cancelRelationshipUnbind),
  confirmRelationshipUnbind: withMutationReceipt('relationship.unbind.confirm', confirmRelationshipUnbind),
  completeRelationshipUnbind: withMutationReceipt('relationship.unbind.confirm', completeRelationshipUnbind),
  recordCompanionView: withMutationReceipt('companion.view', recordCompanionView),
  rejectCheckIn: withMutationReceipt('checkin.reject', rejectCheckIn),
  rejectCancelRedemption: withMutationReceipt('redemption.cancelReject', rejectCancelRedemption),
  rejectWithdrawal: withMutationReceipt('withdrawal.reject', rejectWithdrawal),
  redeemReward: withMutationReceipt('redemption.create', redeemReward),
  requestCancelRedemption: withMutationReceipt('redemption.cancelRequest', requestCancelRedemption),
  requestWithdrawal: withMutationReceipt('withdrawal.request', requestWithdrawal),
  resetDemo,
  saveState,
  saveRewardItem: withMutationReceipt('rewardItem.save', saveRewardItem),
  saveSubscriptionGrant: withMutationReceipt('subscription.saveGrant', saveSubscriptionGrant),
  seedDemoIfNeeded,
  sendEncouragement: withMutationReceipt('encouragement.send', sendEncouragement),
  submitCheckIn: withMutationReceipt('checkin.submit', submitCheckIn),
  switchRole,
  toggleRewardItem: withMutationReceipt('rewardItem.toggle', toggleRewardItem),
  updateAdventureLevels: withMutationReceipt('adventure.updateLevels', updateAdventureLevels),
  updateProfile: withMutationReceipt('profile.update', updateProfile),
  updateRewardRule: withMutationReceipt('rewardRule.update', updateRewardRule),
  verifyRedemption: withMutationReceipt('redemption.verify', verifyRedemption),
  listViewNotices,
  __private: {
    DB_KEY,
    ENCOURAGEMENT_TEMPLATES,
    MILESTONE_PRIORITIES,
    addMilestone,
    assertRelationshipCanUnbind,
    beginRelationshipUnbindConfirmation,
    createInitialState,
    decorateRelationshipUnbindStatus,
    findOperationReceipt,
    PROFILE_EDIT_EXTRA_COST_CENTS,
    pruneOperationReceipts,
    runMutationWithReceipt,
    selectPrimaryMilestone,
    setNowForTests,
    validateRelationshipUnbindConfirmation
  }
};
