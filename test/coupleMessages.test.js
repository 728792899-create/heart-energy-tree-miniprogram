const assert = require('node:assert/strict');
const test = require('node:test');

const { createCloudRepository, createCoupleMessageService, createMemoryRepository } = require('../cloudfunctions/energyTree/coupleMessages');

function context(overrides = {}) {
  return {
    relationship: {
      id: 'rel-1',
      sponsorId: 'sponsor-1',
      participantId: 'participant-1',
      sponsorOpenid: 'openid-sponsor',
      participantOpenid: 'openid-participant'
    },
    currentUser: { id: 'sponsor-1', role: 'sponsor', openid: 'openid-sponsor', name: '男朋友' },
    companionUser: { id: 'participant-1', role: 'participant', openid: 'openid-participant', name: '小鹿' },
    currentRole: 'sponsor',
    ...overrides
  };
}

function createService(now = '2026-07-12T08:00:00.000Z') {
  const repository = createMemoryRepository();
  return {
    repository,
    service: createCoupleMessageService({ repository, now: () => now })
  };
}


test('cloud repository treats WeChat does-not-exist document errors as an empty read', async () => {
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              throw new Error('document.get:fail document with _id legacy_missing does not exist');
            }
          };
        }
      };
    }
  };
  const repository = createCloudRepository({ db });

  assert.equal(await repository.get('coupleMessages', 'legacy_missing'), null);
});

test('chat send trims content, creates two inbox projections, and only increments partner unread', async () => {
  const { repository, service } = createService();

  const first = await service.send({
    context: context(),
    content: '  今天也很想你  ',
    clientRequestId: 'send-1'
  });
  const replay = await service.send({
    context: context(),
    content: '今天也很想你',
    clientRequestId: 'send-1'
  });

  assert.equal(first.message.content, '今天也很想你');
  assert.equal(first.message.recipientOpenid, 'openid-sponsor');
  assert.equal(first.message.isOwn, true);
  assert.equal(replay.message.messageId, first.message.messageId);
  assert.equal(replay.message.recipientOpenid, 'openid-sponsor');
  assert.equal(replay.message.isOwn, true);
  assert.equal(replay.deduped, true);
  assert.equal(repository.all('coupleMessages').length, 1);
  assert.equal(repository.all('coupleMessageInbox').length, 2);
  assert.equal(repository.findState('openid-sponsor').unreadCount, 0);
  assert.equal(repository.findState('openid-participant').unreadCount, 1);
});

test('chat validation rejects blank, oversized, and unbound partner messages', async () => {
  const { service } = createService();

  await assert.rejects(
    service.send({ context: context(), content: '   ', clientRequestId: 'blank' }),
    /写下想对对方说的话/
  );
  await assert.rejects(
    service.send({ context: context(), content: '爱'.repeat(201), clientRequestId: 'long' }),
    /最多 200 个字/
  );
  await assert.rejects(
    service.send({
      context: context({ companionUser: { id: 'participant-1', openid: '' } }),
      content: '等你加入',
      clientRequestId: 'unbound'
    }),
    /请先邀请另一半加入/
  );
});

test('query paginates newest messages by stable sort key and returns ascending display order', async () => {
  const { service } = createService();
  for (let index = 0; index < 35; index += 1) {
    await service.send({
      context: context(),
      content: `第 ${index + 1} 封信`,
      clientRequestId: `page-${String(index).padStart(2, '0')}`,
      createdAt: new Date(Date.UTC(2026, 6, 12, 8, 0, index)).toISOString()
    });
  }

  const firstPage = await service.query({ context: context(), limit: 30 });
  const secondPage = await service.query({
    context: context(),
    limit: 30,
    beforeSortKey: firstPage.nextCursor
  });

  assert.equal(firstPage.messages.length, 30);
  assert.equal(firstPage.hasMore, true);
  assert.equal(secondPage.messages.length, 5);
  assert.equal(secondPage.hasMore, false);
  assert.ok(firstPage.messages[0].sortKey < firstPage.messages.at(-1).sortKey);
  assert.ok(secondPage.messages.at(-1).sortKey < firstPage.messages[0].sortKey);
});

test('mark read clears message unread without accepting encouragement cards', async () => {
  const { repository, service } = createService();
  await service.send({ context: context(), content: '抱抱你', clientRequestId: 'read-1' });

  const participantContext = context({
    currentUser: { id: 'participant-1', role: 'participant', openid: 'openid-participant', name: '小鹿' },
    companionUser: { id: 'sponsor-1', role: 'sponsor', openid: 'openid-sponsor', name: '男朋友' },
    currentRole: 'participant'
  });
  const marked = await service.markRead({ context: participantContext });

  assert.equal(marked.unreadCount, 0);
  assert.equal(repository.findState('openid-participant').unreadCount, 0);
  assert.ok(repository.findState('openid-participant').lastReadSortKey);
});

test('bootstrap backfills legacy encouragements and view notices idempotently', async () => {
  const { repository, service } = createService();
  const state = {
    encouragementCards: [{
      id: 'card-1',
      relationshipId: 'rel-1',
      senderUserId: 'sponsor-1',
      recipientUserId: 'participant-1',
      message: '今天也要夸夸你',
      readAt: null,
      createdAt: '2026-07-10T08:00:00.000Z'
    }],
    companionViewNotices: [{
      id: 'notice-1',
      relationshipId: 'rel-1',
      viewerUserId: 'sponsor-1',
      targetUserId: 'participant-1',
      message: '男朋友刚刚查看了你的运动进度',
      readAt: '2026-07-11T08:00:00.000Z',
      createdAt: '2026-07-09T08:00:00.000Z'
    }]
  };

  const first = await service.bootstrap({ context: context(), state });
  const second = await service.bootstrap({ context: context(), state });

  assert.equal(first.createdCount, 2);
  assert.equal(second.createdCount, 0);
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.findState('openid-participant').unreadCount, 1);
  const messages = repository.all('coupleMessages').sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  assert.equal(messages[0].type, 'system');
  assert.equal(messages[1].type, 'encouragement');
  assert.equal(repository.all('coupleMessageMigrations').length, 1);
});

test('chat messages support authorized image content and preserve compatibility placeholders', async () => {
  const { service } = createService();
  const imageFileId = 'cloud://env.bucket/relationships/rel-1/messages/sponsor-1/photo.jpg';

  const result = await service.send({
    context: context(),
    contentType: 'image',
    imageFileId,
    imageWidth: 1200,
    imageHeight: 900,
    clientRequestId: 'image-1'
  });

  assert.equal(result.message.contentType, 'image');
  assert.equal(result.message.content, '[图片]');
  assert.equal(result.message.imageFileId, imageFileId);
  assert.equal(result.message.imageWidth, 1200);
  assert.equal(result.message.imageHeight, 900);
});

test('image messages reject non-cloud ids and paths outside the trusted relationship sender directory', async () => {
  const { service } = createService();
  for (const imageFileId of [
    'https://example.com/photo.jpg',
    'cloud://env.bucket/relationships/rel-other/messages/sponsor-1/photo.jpg',
    'cloud://env.bucket/relationships/rel-1/messages/participant-1/photo.jpg',
    'cloud://env.bucket/tmp/relationships/rel-1/messages/sponsor-1/photo.jpg'
  ]) {
    await assert.rejects(service.send({
      context: context(),
      contentType: 'image',
      imageFileId,
      clientRequestId: `invalid-${imageFileId.length}`
    }), /图片路径无效/);
  }
});

test('sticker messages only accept the server catalog and persist a legacy-safe placeholder', async () => {
  const repository = createMemoryRepository();
  const service = createCoupleMessageService({
    repository,
    now: () => '2026-07-12T08:00:00.000Z',
    stickerCatalog: [{
      stickerId: 'hug',
      label: '抱抱',
      imageFileId: 'cloud://env.bucket/static/stickers/v1/hug.png'
    }]
  });

  const result = await service.send({
    context: context(),
    contentType: 'sticker',
    stickerId: 'hug',
    clientRequestId: 'sticker-1'
  });

  assert.equal(result.message.contentType, 'sticker');
  assert.equal(result.message.content, '[表情]');
  assert.equal(result.message.stickerId, 'hug');
  assert.equal(result.message.imageFileId, 'cloud://env.bucket/static/stickers/v1/hug.png');
  await assert.rejects(service.send({
    context: context(),
    contentType: 'sticker',
    stickerId: 'not-allowed',
    clientRequestId: 'sticker-bad'
  }), /表情不可用/);
});

function participantContext() {
  return context({
    currentUser: { id: 'participant-1', role: 'participant', openid: 'openid-participant', name: '小鹿' },
    companionUser: { id: 'sponsor-1', role: 'sponsor', openid: 'openid-sponsor', name: '男朋友' },
    currentRole: 'participant'
  });
}

function createRequestService(now = '2026-07-13T08:00:00.000Z') {
  const repository = createMemoryRepository();
  const requestCatalog = require('../cloudfunctions/energyTree/requestCatalog').REQUEST_CATALOG;
  return {
    repository,
    service: createCoupleMessageService({ repository, now: () => now, requestCatalog })
  };
}

test('request catalog keeps affectionate presets but excludes explicit adult templates', () => {
  const { REQUEST_CATALOG } = require('../cloudfunctions/energyTree/requestCatalog');
  const abstract = REQUEST_CATALOG.find((item) => item.requestTemplateId === 'backhand-opossum-walk');
  const labels = REQUEST_CATALOG.map((item) => item.requestLabel).join(' ');

  assert.ok(REQUEST_CATALOG.length >= 20);
  assert.equal(REQUEST_CATALOG.some((item) => item.requestAdult), false);
  assert.equal(REQUEST_CATALOG.some((item) => item.requestCategory === 'adult-intimacy'), false);
  assert.equal(REQUEST_CATALOG.some((item) => item.requestTemplateId.startsWith('adult-intimacy')), false);
  assert.doesNotMatch(labels, /做爱请求|今晚亲密升级请求/);
  assert.equal(abstract.requestCategory, 'abstract');
});

test('either partner can send an allowlisted request to the bound companion', async () => {
  const { repository, service } = createRequestService();
  const sponsorRequest = await service.sendRequest({
    context: context(), requestTemplateId: 'kiss', clientRequestId: 'request-sponsor'
  });
  const participantRequest = await service.sendRequest({
    context: participantContext(), requestTemplateId: 'hug-renewal', clientRequestId: 'request-participant'
  });

  assert.equal(sponsorRequest.message.contentType, 'request');
  assert.equal(sponsorRequest.message.requestRecipientUserId, 'participant-1');
  assert.equal(sponsorRequest.message.requestStatus, 'pending');
  assert.equal(participantRequest.message.requestRecipientUserId, 'sponsor-1');
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.all('coupleMessageInbox').length, 4);
  assert.equal(repository.findState('openid-sponsor').unreadCount, 1);
  assert.equal(repository.findState('openid-participant').unreadCount, 1);

  await assert.rejects(service.sendRequest({
    context: context(), requestTemplateId: 'forged-template', clientRequestId: 'request-invalid'
  }), /请求不可用/);
});

test('only the request recipient can respond and idempotent replay creates one response and unread', async () => {
  const { repository, service } = createRequestService();
  const sent = await service.sendRequest({
    context: context(), requestTemplateId: 'kiss', clientRequestId: 'request-respond'
  });

  await assert.rejects(service.respondRequest({
    context: context(), requestMessageId: sent.message.messageId, decision: 'accepted', clientRequestId: 'wrong-actor'
  }), /只有收到请求的一方可以回应/);

  const first = await service.respondRequest({
    context: participantContext(), requestMessageId: sent.message.messageId, decision: 'accepted', clientRequestId: 'response-1'
  });
  const replay = await service.respondRequest({
    context: participantContext(), requestMessageId: sent.message.messageId, decision: 'accepted', clientRequestId: 'response-1'
  });

  assert.equal(first.requestMessage.requestStatus, 'accepted');
  assert.equal(first.responseMessage.contentType, 'request-response');
  assert.equal(first.responseMessage.requestDecision, 'accepted');
  assert.equal(replay.responseMessage.messageId, first.responseMessage.messageId);
  assert.equal(replay.deduped, true);
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.all('coupleMessageInbox').length, 4);
  assert.equal(repository.findState('openid-sponsor').unreadCount, 1);
  const requestProjections = repository.all('coupleMessageInbox').filter((item) => item.messageId === sent.message.messageId);
  assert.ok(requestProjections.every((item) => item.requestStatus === 'accepted'));

  await assert.rejects(service.respondRequest({
    context: participantContext(), requestMessageId: sent.message.messageId, decision: 'declined', clientRequestId: 'response-2'
  }), /该请求已经处理/);
});

test('only the requester can cancel a pending request and cancellation is idempotent', async () => {
  const { repository, service } = createRequestService();
  const sent = await service.sendRequest({
    context: context(), requestTemplateId: 'video-tonight', clientRequestId: 'request-cancel'
  });

  await assert.rejects(service.cancelRequest({
    context: participantContext(), requestMessageId: sent.message.messageId, clientRequestId: 'cancel-wrong'
  }), /只有发起请求的一方可以撤回/);

  const first = await service.cancelRequest({
    context: context(), requestMessageId: sent.message.messageId, clientRequestId: 'cancel-1'
  });
  const replay = await service.cancelRequest({
    context: context(), requestMessageId: sent.message.messageId, clientRequestId: 'cancel-1'
  });

  assert.equal(first.requestMessage.requestStatus, 'cancelled');
  assert.equal(first.responseMessage.requestDecision, 'cancelled');
  assert.equal(replay.responseMessage.messageId, first.responseMessage.messageId);
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.findState('openid-participant').unreadCount, 2);
});

test('either partner can send a sanitized one-time custom request with trusted fields', async () => {
  const { CUSTOM_REQUEST_CONSENT_NOTICE } = require('../cloudfunctions/energyTree/requestCatalog');
  const { repository, service } = createRequestService();
  const sponsorRequest = await service.sendRequest({
    context: context(),
    customRequestText: '  陪我\t散步\n十分钟  ',
    requestRecipientUserId: 'forged-user',
    requestCategory: 'adult-intimacy',
    requestAdult: true,
    consentNotice: '伪造提示',
    clientRequestId: 'custom-request-sponsor'
  });
  const participantRequest = await service.sendRequest({
    context: participantContext(),
    customRequestText: '给我一个赛博抱抱',
    clientRequestId: 'custom-request-participant'
  });

  assert.equal(sponsorRequest.message.content, '[请求] 陪我 散步 十分钟');
  assert.equal(sponsorRequest.message.requestSource, 'custom');
  assert.equal(sponsorRequest.message.requestLabel, '陪我 散步 十分钟');
  assert.equal(sponsorRequest.message.requestCategory, 'custom');
  assert.equal(sponsorRequest.message.requestAdult, false);
  assert.equal(sponsorRequest.message.consentNotice, CUSTOM_REQUEST_CONSENT_NOTICE);
  assert.equal(sponsorRequest.message.requestRecipientUserId, 'participant-1');
  assert.equal(participantRequest.message.requestRecipientUserId, 'sponsor-1');
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.all('coupleMessageInbox').length, 4);
  assert.equal(repository.findState('openid-sponsor').unreadCount, 1);
  assert.equal(repository.findState('openid-participant').unreadCount, 1);
});

test('custom request input is exclusive, non-empty, control-safe, and limited by Unicode characters', async () => {
  const { service } = createRequestService();

  await assert.rejects(service.sendRequest({
    context: context(), customRequestText: ' \t\n ', clientRequestId: 'custom-blank'
  }), /请输入自定义请求/);
  await assert.rejects(service.sendRequest({
    context: context(), customRequestText: '爱'.repeat(31), clientRequestId: 'custom-long'
  }), /最多 30 个字/);
  await assert.rejects(service.sendRequest({
    context: context(), customRequestText: '😀'.repeat(31), clientRequestId: 'custom-emoji-long'
  }), /最多 30 个字/);
  await assert.rejects(service.sendRequest({
    context: context(), requestTemplateId: 'kiss', customRequestText: '抱抱我', clientRequestId: 'custom-both'
  }), /只能选择一种请求/);
  await assert.rejects(service.sendRequest({
    context: context(), clientRequestId: 'custom-neither'
  }), /请选择预设请求或输入自定义请求/);

  const accepted = await service.sendRequest({
    context: context(), customRequestText: '😀'.repeat(30), clientRequestId: 'custom-emoji-limit'
  });
  assert.equal(Array.from(accepted.message.requestLabel).length, 30);
});

test('custom request retries are idempotent and responses preserve source and label', async () => {
  const { repository, service } = createRequestService();
  const first = await service.sendRequest({
    context: context(), customRequestText: '陪我看一集动画', clientRequestId: 'custom-idempotent'
  });
  const replay = await service.sendRequest({
    context: context(), customRequestText: '不应覆盖原文', clientRequestId: 'custom-idempotent'
  });
  const response = await service.respondRequest({
    context: participantContext(),
    requestMessageId: first.message.messageId,
    decision: 'later',
    clientRequestId: 'custom-response'
  });

  assert.equal(replay.deduped, true);
  assert.equal(replay.message.requestLabel, '陪我看一集动画');
  assert.equal(response.responseMessage.requestSource, 'custom');
  assert.equal(response.responseMessage.requestLabel, '陪我看一集动画');
  assert.equal(response.responseMessage.content, '[请求回应] 稍后再说：陪我看一集动画');
  assert.equal(repository.all('coupleMessages').length, 2);
  assert.equal(repository.all('coupleMessageInbox').length, 4);
});

test('preset requests persist an explicit preset source for new messages', async () => {
  const { service } = createRequestService();
  const sent = await service.sendRequest({
    context: context(), requestTemplateId: 'kiss', clientRequestId: 'preset-source'
  });
  assert.equal(sent.message.requestSource, 'preset');
});
