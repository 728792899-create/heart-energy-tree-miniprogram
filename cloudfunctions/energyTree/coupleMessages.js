const crypto = require('crypto');
const { CUSTOM_REQUEST_CONSENT_NOTICE } = require('./requestCatalog');

const COLLECTIONS = {
  messages: 'coupleMessages',
  inbox: 'coupleMessageInbox',
  states: 'coupleMessageStates',
  migrations: 'coupleMessageMigrations'
};

const MESSAGE_TYPES = new Set(['chat', 'system', 'encouragement']);
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 30;
const HIDDEN_IMAGE_CONTENT = '该图片已被内容安全隐藏';

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function stableHash(value, length = 24) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

function normalizeDate(value, fallback) {
  const candidate = value || fallback;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) throw new Error('消息时间无效');
  return date.toISOString();
}

function normalizeCustomRequestText(value) {
  const normalized = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) throw new Error('请输入自定义请求');
  if (Array.from(normalized).length > 30) throw new Error('自定义请求最多 30 个字');
  return normalized;
}

function createSortKey(createdAt, messageId) {
  return `${String(new Date(createdAt).getTime()).padStart(13, '0')}_${messageId}`;
}

function stateDocumentId(recipientOpenid) {
  return `state_${stableHash(recipientOpenid)}`;
}

function inboxDocumentId(messageId, recipientOpenid) {
  return `${messageId}_${stableHash(recipientOpenid, 16)}`;
}

function assertContext(context) {
  const relationship = context && context.relationship;
  const currentUser = context && context.currentUser;
  if (!relationship || !relationship.id || !currentUser || !currentUser.openid) {
    throw new Error('请先创建或通过分享邀请加入情侣能量树');
  }
  return context;
}

function participantOpenids(context) {
  const relationship = context.relationship || {};
  return [relationship.sponsorOpenid, relationship.participantOpenid].filter(Boolean);
}

function roleForUser(context, userId) {
  if (!userId) return '';
  if (userId === context.relationship.sponsorId) return 'sponsor';
  if (userId === context.relationship.participantId) return 'participant';
  return '';
}

function openidForUser(context, userId) {
  if (!userId) return '';
  if (userId === context.relationship.sponsorId) return context.relationship.sponsorOpenid || '';
  if (userId === context.relationship.participantId) return context.relationship.participantOpenid || '';
  return '';
}

function createMemoryRepository(seed = {}) {
  const tables = new Map();
  Object.values(COLLECTIONS).forEach((name) => tables.set(name, new Map()));
  Object.entries(seed).forEach(([collection, documents]) => {
    const table = tables.get(collection) || new Map();
    (documents || []).forEach((document) => table.set(document._id || document.id, clone(document)));
    tables.set(collection, table);
  });

  const repository = {
    async get(collection, id) {
      const value = (tables.get(collection) || new Map()).get(id);
      return clone(value || null);
    },
    async set(collection, id, data) {
      if (!tables.has(collection)) tables.set(collection, new Map());
      const value = { ...clone(data), _id: id };
      tables.get(collection).set(id, value);
      return clone(value);
    },
    async queryInbox(recipientOpenid, beforeSortKey, limit) {
      const rows = Array.from((tables.get(COLLECTIONS.inbox) || new Map()).values())
        .filter((item) => item.recipientOpenid === recipientOpenid)
        .filter((item) => !beforeSortKey || item.sortKey < beforeSortKey)
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
        .slice(0, limit);
      return clone(rows);
    },
    async runTransaction(task) {
      return task(repository);
    },
    async hideMessageImageByFileId(relationshipId, fileId) {
      let messageCount = 0;
      let projectionCount = 0;
      const patchTable = (collection, countKey) => {
        const table = tables.get(collection) || new Map();
        table.forEach((item, id) => {
          if (item.relationshipId !== relationshipId || item.imageFileId !== fileId) return;
          table.set(id, {
            ...item,
            imageFileId: '',
            hidden: true,
            content: HIDDEN_IMAGE_CONTENT
          });
          if (countKey === 'message') messageCount += 1;
          else projectionCount += 1;
        });
      };
      patchTable(COLLECTIONS.messages, 'message');
      patchTable(COLLECTIONS.inbox, 'projection');
      return { messageCount, projectionCount };
    },
    all(collection) {
      return clone(Array.from((tables.get(collection) || new Map()).values()));
    },
    findState(recipientOpenid) {
      const row = Array.from((tables.get(COLLECTIONS.states) || new Map()).values())
        .find((item) => item.recipientOpenid === recipientOpenid);
      return clone(row || null);
    }
  };

  return repository;
}

function createCloudRepository(options = {}) {
  const db = options.db;
  const command = options.command || (db && db.command);
  if (!db) throw new Error('cloud database is required');

  function adapter(source) {
    return {
      async get(collection, id) {
        try {
          const response = await source.collection(collection).doc(id).get();
          return response && response.data ? response.data : null;
        } catch (error) {
          const text = String((error && (error.errMsg || error.message || error.code)) || '').toLowerCase();
          if (text.includes('not found') || text.includes('not exists') || text.includes('does not exist') || text.includes('不存在')) return null;
          throw error;
        }
      },
      async set(collection, id, data) {
        const value = clone(data);
        delete value._id;
        await source.collection(collection).doc(id).set({ data: value });
        return { ...value, _id: id };
      },
      async queryInbox(recipientOpenid, beforeSortKey, limit) {
        const where = { recipientOpenid };
        if (beforeSortKey) {
          if (!command || typeof command.lt !== 'function') throw new Error('云数据库缺少分页查询命令');
          where.sortKey = command.lt(beforeSortKey);
        }
        const response = await source.collection(COLLECTIONS.inbox)
          .where(where)
          .orderBy('sortKey', 'desc')
          .limit(limit)
          .get();
        return (response && response.data) || [];
      }
    };
  }

  const base = adapter(db);
  return {
    ...base,
    async hideMessageImageByFileId(relationshipId, fileId) {
      const patch = {
        imageFileId: '',
        hidden: true,
        content: HIDDEN_IMAGE_CONTENT
      };
      const [messages, inbox] = await Promise.all([
        db.collection(COLLECTIONS.messages).where({ relationshipId, imageFileId: fileId }).update({ data: patch }),
        db.collection(COLLECTIONS.inbox).where({ relationshipId, imageFileId: fileId }).update({ data: patch })
      ]);
      return {
        messageCount: Number(messages && messages.stats && messages.stats.updated) || 0,
        projectionCount: Number(inbox && inbox.stats && inbox.stats.updated) || 0
      };
    },
    async runTransaction(task) {
      if (typeof db.runTransaction !== 'function') return task(base);
      const response = await db.runTransaction(async (transaction) => task(adapter(transaction)));
      return response && Object.prototype.hasOwnProperty.call(response, 'result') ? response.result : response;
    }
  };
}

function createCoupleMessageService(options = {}) {
  const repository = options.repository;
  const now = options.now || (() => new Date().toISOString());
  const stickerCatalog = Array.isArray(options.stickerCatalog) ? options.stickerCatalog : [];
  const stickerById = new Map(stickerCatalog.map((item) => [String(item.stickerId || ''), item]));
  const requestCatalog = Array.isArray(options.requestCatalog) ? options.requestCatalog : [];
  const requestById = new Map(requestCatalog.map((item) => [String(item.requestTemplateId || ''), item]));
  if (!repository) throw new Error('couple message repository is required');

  async function ensureState(tx, recipientOpenid, relationshipId, updatedAt) {
    const id = stateDocumentId(recipientOpenid);
    const existing = await tx.get(COLLECTIONS.states, id);
    if (existing) return existing;
    const state = {
      recipientOpenid,
      relationshipId,
      unreadCount: 0,
      lastReadSortKey: '',
      lastMessageSortKey: '',
      updatedAt
    };
    await tx.set(COLLECTIONS.states, id, state);
    return state;
  }

  async function persistMessage(tx, context, input) {
    if (!MESSAGE_TYPES.has(input.type)) throw new Error('不支持的消息类型');
    const existing = await tx.get(COLLECTIONS.messages, input.messageId);
    if (existing) return { message: existing, created: false };

    const createdAt = normalizeDate(input.createdAt, now());
    const message = {
      messageId: input.messageId,
      relationshipId: context.relationship.id,
      sortKey: createSortKey(createdAt, input.messageId),
      type: input.type,
      senderUserId: input.senderUserId || '',
      senderRole: input.senderRole || '',
      content: String(input.content || '').trim(),
      ...(input.type === 'chat' ? { contentType: input.contentType || 'text' } : {}),
      ...(input.imageFileId ? { imageFileId: input.imageFileId } : {}),
      ...(Number(input.imageWidth) > 0 ? { imageWidth: Math.round(Number(input.imageWidth)) } : {}),
      ...(Number(input.imageHeight) > 0 ? { imageHeight: Math.round(Number(input.imageHeight)) } : {}),
      ...(input.stickerId ? { stickerId: input.stickerId } : {}),
      ...(input.requestTemplateId ? { requestTemplateId: input.requestTemplateId } : {}),
      ...(input.requestSource ? { requestSource: input.requestSource } : {}),
      ...(input.requestLabel ? { requestLabel: input.requestLabel } : {}),
      ...(input.requestCategory ? { requestCategory: input.requestCategory } : {}),
      ...(typeof input.requestAdult === 'boolean' ? { requestAdult: input.requestAdult } : {}),
      ...(input.consentNotice ? { consentNotice: input.consentNotice } : {}),
      ...(input.requestStatus ? { requestStatus: input.requestStatus } : {}),
      ...(input.requestRecipientUserId ? { requestRecipientUserId: input.requestRecipientUserId } : {}),
      ...(input.respondedAt ? { respondedAt: input.respondedAt } : {}),
      ...(input.respondedByUserId ? { respondedByUserId: input.respondedByUserId } : {}),
      ...(input.responseMessageId ? { responseMessageId: input.responseMessageId } : {}),
      ...(input.requestMessageId ? { requestMessageId: input.requestMessageId } : {}),
      ...(input.requestDecision ? { requestDecision: input.requestDecision } : {}),
      sourceType: input.sourceType || '',
      sourceId: input.sourceId || '',
      createdAt
    };
    await tx.set(COLLECTIONS.messages, message.messageId, message);

    const senderOpenid = input.senderOpenid || openidForUser(context, message.senderUserId);
    const unreadRecipientOpenid = input.unreadRecipientOpenid || '';
    const openids = participantOpenids(context);
    for (const recipientOpenid of openids) {
      const projection = {
        ...message,
        recipientOpenid,
        isOwn: Boolean(senderOpenid && recipientOpenid === senderOpenid)
      };
      await tx.set(COLLECTIONS.inbox, inboxDocumentId(message.messageId, recipientOpenid), projection);
      const state = await ensureState(tx, recipientOpenid, context.relationship.id, createdAt);
      const shouldIncrement = recipientOpenid === unreadRecipientOpenid && input.incrementUnread !== false;
      await tx.set(COLLECTIONS.states, stateDocumentId(recipientOpenid), {
        ...state,
        unreadCount: Math.max(0, Number(state.unreadCount) || 0) + (shouldIncrement ? 1 : 0),
        lastMessageSortKey: state.lastMessageSortKey > message.sortKey ? state.lastMessageSortKey : message.sortKey,
        updatedAt: createdAt
      });
    }
    return { message, created: true };
  }

  async function send(input = {}) {
    const context = assertContext(input.context);
    const contentType = ['text', 'image', 'sticker'].includes(input.contentType) ? input.contentType : 'text';
    let content = String(input.content || '').trim();
    let imageFileId = '';
    let stickerId = '';

    if (contentType === 'text') {
      if (!content) throw new Error('写下想对对方说的话');
      if (Array.from(content).length > 200) throw new Error('最多 200 个字');
    } else if (contentType === 'image') {
      imageFileId = String(input.imageFileId || '').trim();
      const marker = `/relationships/${context.relationship.id}/messages/${context.currentUser.id}/`;
      const objectPathStart = imageFileId.indexOf('/', 'cloud://'.length);
      const objectPath = objectPathStart >= 0 ? imageFileId.slice(objectPathStart) : '';
      if (!imageFileId.startsWith('cloud://') || !objectPath.startsWith(marker)) {
        throw new Error('图片路径无效，请重新选择');
      }
      content = '[图片]';
    } else {
      stickerId = String(input.stickerId || '').trim();
      const sticker = stickerById.get(stickerId);
      if (!sticker || !String(sticker.imageFileId || '').startsWith('cloud://')) {
        throw new Error('表情不可用，请稍后再试');
      }
      imageFileId = sticker.imageFileId;
      content = '[表情]';
    }

    if (!context.companionUser || !context.companionUser.openid) {
      throw new Error('请先邀请另一半加入');
    }
    const clientRequestId = String(input.clientRequestId || '').trim();
    if (!clientRequestId) throw new Error('缺少发送请求标识');
    const messageId = `chat_${stableHash(`${context.relationship.id}:${context.currentUser.openid}:${clientRequestId}`, 32)}`;

    return repository.runTransaction(async (tx) => {
      const result = await persistMessage(tx, context, {
        messageId,
        type: 'chat',
        contentType,
        senderUserId: context.currentUser.id,
        senderRole: context.currentRole || context.currentUser.role || '',
        senderOpenid: context.currentUser.openid,
        content,
        imageFileId,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        stickerId,
        sourceType: 'chat',
        sourceId: clientRequestId,
        createdAt: input.createdAt,
        unreadRecipientOpenid: context.companionUser.openid
      });
      return {
        message: {
          ...result.message,
          recipientOpenid: context.currentUser.openid,
          isOwn: true
        },
        deduped: !result.created
      };
    });
  }


  function currentProjection(message, context) {
    return {
      ...clone(message),
      recipientOpenid: context.currentUser.openid,
      isOwn: message.senderUserId === context.currentUser.id
    };
  }

  async function updateRequestEverywhere(tx, context, requestMessage, patch) {
    const updated = { ...requestMessage, ...patch };
    delete updated._id;
    await tx.set(COLLECTIONS.messages, updated.messageId, updated);
    const senderOpenid = openidForUser(context, updated.senderUserId);
    for (const recipientOpenid of participantOpenids(context)) {
      await tx.set(COLLECTIONS.inbox, inboxDocumentId(updated.messageId, recipientOpenid), {
        ...updated,
        recipientOpenid,
        isOwn: Boolean(senderOpenid && senderOpenid === recipientOpenid)
      });
    }
    return updated;
  }

  async function sendRequest(input = {}) {
    const context = assertContext(input.context);
    if (!context.companionUser || !context.companionUser.openid) throw new Error('请先邀请另一半加入');
    const requestTemplateId = String(input.requestTemplateId || '').trim();
    const hasCustomRequest = input.customRequestText !== undefined && input.customRequestText !== null;
    if (requestTemplateId && hasCustomRequest) throw new Error('只能选择一种请求');
    if (!requestTemplateId && !hasCustomRequest) throw new Error('请选择预设请求或输入自定义请求');

    let requestDefinition;
    if (hasCustomRequest) {
      const requestLabel = normalizeCustomRequestText(input.customRequestText);
      requestDefinition = {
        requestSource: 'custom',
        requestTemplateId: '',
        requestLabel,
        requestCategory: 'custom',
        requestAdult: false,
        consentNotice: CUSTOM_REQUEST_CONSENT_NOTICE
      };
    } else {
      const requestTemplate = requestById.get(requestTemplateId);
      if (!requestTemplate) throw new Error('这个请求不可用，请稍后再试');
      requestDefinition = {
        requestSource: 'preset',
        requestTemplateId,
        requestLabel: requestTemplate.requestLabel,
        requestCategory: requestTemplate.requestCategory,
        requestAdult: Boolean(requestTemplate.requestAdult),
        consentNotice: requestTemplate.consentNotice || ''
      };
    }
    const clientRequestId = String(input.clientRequestId || '').trim();
    if (!clientRequestId) throw new Error('缺少发送请求标识');
    const messageId = `request_${stableHash(`${context.relationship.id}:${context.currentUser.openid}:${clientRequestId}`, 32)}`;

    return repository.runTransaction(async (tx) => {
      const result = await persistMessage(tx, context, {
        messageId,
        type: 'chat',
        contentType: 'request',
        senderUserId: context.currentUser.id,
        senderRole: context.currentRole || context.currentUser.role || '',
        senderOpenid: context.currentUser.openid,
        content: `[请求] ${requestDefinition.requestLabel}`,
        requestSource: requestDefinition.requestSource,
        requestTemplateId: requestDefinition.requestTemplateId,
        requestLabel: requestDefinition.requestLabel,
        requestCategory: requestDefinition.requestCategory,
        requestAdult: requestDefinition.requestAdult,
        consentNotice: requestDefinition.consentNotice,
        requestStatus: 'pending',
        requestRecipientUserId: context.companionUser.id,
        sourceType: 'couple-request',
        sourceId: clientRequestId,
        createdAt: input.createdAt,
        unreadRecipientOpenid: context.companionUser.openid
      });
      return { message: currentProjection(result.message, context), deduped: !result.created };
    });
  }

  function responseContent(decision, label) {
    const text = { accepted: '已同意', later: '稍后再说', declined: '已婉拒', cancelled: '已撤回' }[decision];
    return `[请求回应] ${text}：${label}`;
  }

  async function settleRequest(input = {}, mode) {
    const context = assertContext(input.context);
    const requestMessageId = String(input.requestMessageId || '').trim();
    const decision = mode === 'cancel' ? 'cancelled' : String(input.decision || '').trim();
    if (mode !== 'cancel' && !['accepted', 'later', 'declined'].includes(decision)) throw new Error('请求回应无效');
    const clientRequestId = String(input.clientRequestId || '').trim();
    if (!clientRequestId) throw new Error('缺少发送请求标识');
    const responseMessageId = `request_response_${stableHash(`${context.relationship.id}:${requestMessageId}:${context.currentUser.openid}:${clientRequestId}`, 32)}`;

    return repository.runTransaction(async (tx) => {
      const replay = await tx.get(COLLECTIONS.messages, responseMessageId);
      if (replay) {
        const currentRequest = await tx.get(COLLECTIONS.messages, requestMessageId);
        return {
          requestMessage: currentProjection(currentRequest, context),
          responseMessage: currentProjection(replay, context),
          deduped: true
        };
      }
      const requestMessage = await tx.get(COLLECTIONS.messages, requestMessageId);
      if (!requestMessage || requestMessage.relationshipId !== context.relationship.id || requestMessage.contentType !== 'request') {
        throw new Error('找不到这条请求');
      }
      if (mode === 'cancel') {
        if (requestMessage.senderUserId !== context.currentUser.id) throw new Error('只有发起请求的一方可以撤回');
      } else if (requestMessage.requestRecipientUserId !== context.currentUser.id) {
        throw new Error('只有收到请求的一方可以回应');
      }
      if (requestMessage.requestStatus !== 'pending') throw new Error('该请求已经处理');

      const respondedAt = normalizeDate(input.createdAt, now());
      const updatedRequest = await updateRequestEverywhere(tx, context, requestMessage, {
        requestStatus: decision,
        respondedAt,
        respondedByUserId: context.currentUser.id,
        responseMessageId
      });
      const response = await persistMessage(tx, context, {
        messageId: responseMessageId,
        type: 'chat',
        contentType: 'request-response',
        senderUserId: context.currentUser.id,
        senderRole: context.currentRole || context.currentUser.role || '',
        senderOpenid: context.currentUser.openid,
        content: responseContent(decision, requestMessage.requestLabel),
        requestMessageId,
        requestSource: requestMessage.requestSource || 'preset',
        requestTemplateId: requestMessage.requestTemplateId,
        requestLabel: requestMessage.requestLabel,
        requestDecision: decision,
        sourceType: 'couple-request-response',
        sourceId: clientRequestId,
        createdAt: respondedAt,
        unreadRecipientOpenid: context.companionUser && context.companionUser.openid
      });
      return {
        requestMessage: currentProjection(updatedRequest, context),
        responseMessage: currentProjection(response.message, context),
        deduped: false
      };
    });
  }

  async function respondRequest(input = {}) {
    return settleRequest(input, 'respond');
  }

  async function cancelRequest(input = {}) {
    return settleRequest(input, 'cancel');
  }

  async function query(input = {}) {
    const context = assertContext(input.context);
    const requestedLimit = Number(input.limit) || DEFAULT_PAGE_SIZE;
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit));
    const rows = await repository.queryInbox(
      context.currentUser.openid,
      String(input.beforeSortKey || ''),
      limit + 1
    );
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const nextCursor = hasMore && selected.length ? selected[selected.length - 1].sortKey : '';
    return {
      messages: selected.reverse(),
      hasMore,
      nextCursor,
      currentUser: clone(context.currentUser),
      companionUser: clone(context.companionUser || null),
      relationship: clone(context.relationship)
    };
  }

  async function markRead(input = {}) {
    const context = assertContext(input.context);
    return repository.runTransaction(async (tx) => {
      const timestamp = normalizeDate(input.updatedAt, now());
      const state = await ensureState(tx, context.currentUser.openid, context.relationship.id, timestamp);
      const lastReadSortKey = state.lastMessageSortKey || state.lastReadSortKey || '';
      const nextState = {
        ...state,
        unreadCount: 0,
        lastReadSortKey,
        updatedAt: timestamp
      };
      await tx.set(COLLECTIONS.states, stateDocumentId(context.currentUser.openid), nextState);
      return clone(nextState);
    });
  }

  async function hideMessageImageByFileId(relationshipId, fileId) {
    const trustedRelationshipId = String(relationshipId || '').trim();
    const trustedFileId = String(fileId || '').trim();
    if (!trustedRelationshipId || !trustedFileId.startsWith('cloud://')) {
      return { messageCount: 0, projectionCount: 0 };
    }
    if (typeof repository.hideMessageImageByFileId !== 'function') {
      throw new Error('信笺仓库不支持隐藏风险图片');
    }
    return repository.hideMessageImageByFileId(trustedRelationshipId, trustedFileId);
  }

  async function projectLegacy(tx, context, legacy) {
    const sourceId = String(legacy.sourceId || '').trim();
    const sourceType = String(legacy.sourceType || '').trim();
    const messageId = `legacy_${stableHash(`${context.relationship.id}:${sourceType}:${sourceId}`, 32)}`;
    return persistMessage(tx, context, {
      messageId,
      type: legacy.type,
      senderUserId: legacy.senderUserId,
      senderRole: roleForUser(context, legacy.senderUserId),
      senderOpenid: openidForUser(context, legacy.senderUserId),
      content: legacy.content,
      sourceType,
      sourceId,
      createdAt: legacy.createdAt,
      unreadRecipientOpenid: legacy.readAt ? '' : openidForUser(context, legacy.recipientUserId),
      incrementUnread: !legacy.readAt
    });
  }

  async function bootstrap(input = {}) {
    const context = assertContext(input.context);
    const state = input.state || {};
    return repository.runTransaction(async (tx) => {
      let createdCount = 0;
      const records = [];
      (state.encouragementCards || [])
        .filter((card) => card.relationshipId === context.relationship.id)
        .forEach((card) => records.push({
          type: 'encouragement',
          sourceType: 'encouragement',
          sourceId: card.id,
          senderUserId: card.senderUserId,
          recipientUserId: card.recipientUserId,
          content: card.message,
          readAt: card.readAt,
          createdAt: card.createdAt
        }));
      (state.companionViewNotices || [])
        .filter((notice) => notice.relationshipId === context.relationship.id)
        .forEach((notice) => records.push({
          type: 'system',
          sourceType: 'companionView',
          sourceId: notice.id,
          senderUserId: notice.viewerUserId,
          recipientUserId: notice.targetUserId,
          content: notice.message,
          readAt: notice.readAt,
          createdAt: notice.createdAt
        }));

      records.sort((a, b) => createSortKey(a.createdAt, a.sourceId).localeCompare(createSortKey(b.createdAt, b.sourceId)));
      for (const record of records) {
        const result = await projectLegacy(tx, context, record);
        if (result.created) createdCount += 1;
      }

      const migrationId = `migration_${stableHash(`${context.relationship.id}:${context.currentUser.openid}`, 32)}`;
      await tx.set(COLLECTIONS.migrations, migrationId, {
        relationshipId: context.relationship.id,
        recipientOpenid: context.currentUser.openid,
        lastCreatedCount: createdCount,
        completedAt: normalizeDate(null, now()),
        updatedAt: normalizeDate(null, now())
      });
      const stateId = stateDocumentId(context.currentUser.openid);
      const messageState = await tx.get(COLLECTIONS.states, stateId)
        || await ensureState(tx, context.currentUser.openid, context.relationship.id, normalizeDate(null, now()));
      return {
        createdCount,
        unreadCount: Number(messageState.unreadCount) || 0,
        currentOpenid: context.currentUser.openid,
        canSend: Boolean(context.companionUser && context.companionUser.openid),
        currentUser: clone(context.currentUser),
        companionUser: clone(context.companionUser || null),
        relationship: clone(context.relationship)
      };
    });
  }

  return {
    send,
    sendRequest,
    respondRequest,
    cancelRequest,
    query,
    markRead,
    hideMessageImageByFileId,
    bootstrap,
    projectLegacy: (input) => repository.runTransaction((tx) => projectLegacy(tx, assertContext(input.context), input))
  };
}

module.exports = {
  COLLECTIONS,
  createCloudRepository,
  createCoupleMessageService,
  createMemoryRepository,
  createSortKey,
  normalizeCustomRequestText,
  inboxDocumentId,
  stableHash,
  stateDocumentId
};
