const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeMessage, mergeMessages, normalizeDraftInput, normalizeCustomRequestDraft } = require('../miniprogram/services/messageView');

const currentUser = { id: 'user-me', openid: 'openid-me' };

function message(overrides = {}) {
  return {
    messageId: 'message-1',
    sortKey: '0001_message-1',
    type: 'chat',
    senderUserId: 'user-me',
    content: '今天也很想你',
    createdAt: '2026-07-12T12:00:00.000Z',
    ...overrides
  };
}

test('normalizes a just-sent chat as own from trusted sender identity when isOwn is missing', () => {
  const normalized = normalizeMessage(message(), currentUser);

  assert.equal(normalized.isOwn, true);
  assert.equal(normalized.displayTime, '07-12 20:00');
});

test('trusted sender identity overrides a stale isOwn projection for chat messages', () => {
  assert.equal(normalizeMessage(message({ isOwn: false }), currentUser).isOwn, true);
  assert.equal(normalizeMessage(message({ senderUserId: 'user-partner', isOwn: true }), currentUser).isOwn, false);
});

test('merges send and watcher copies by messageId without duplicating or changing direction', () => {
  const sent = normalizeMessage(message(), currentUser);
  const watched = normalizeMessage(message({ recipientOpenid: 'openid-me', isOwn: true }), currentUser);
  const merged = mergeMessages([sent], [watched], currentUser);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].isOwn, true);
  assert.equal(merged[0].recipientOpenid, 'openid-me');
});


test('draft normalization enforces the 200 character client limit even for programmatic input', () => {
  assert.equal(normalizeDraftInput('长'.repeat(205)).length, 200);
  assert.equal(normalizeDraftInput(null), '');
});

test('message normalization defaults legacy chats to text and keeps media metadata', () => {
  const legacy = normalizeMessage({ type: 'chat', senderUserId: 'u1', createdAt: '2026-07-12T08:00:00.000Z' }, { id: 'u1' });
  const image = normalizeMessage({
    type: 'chat',
    contentType: 'image',
    imageSrc: 'https://temp.example/image.png',
    senderUserId: 'u2',
    createdAt: '2026-07-12T08:00:00.000Z'
  }, { id: 'u1' });

  assert.equal(legacy.contentType, 'text');
  assert.equal(image.contentType, 'image');
  assert.equal(image.imageSrc, 'https://temp.example/image.png');
});

test('request messages expose requester/recipient controls and readable final status', () => {
  const incoming = normalizeMessage(message({
    contentType: 'request',
    senderUserId: 'user-partner',
    requestStatus: 'pending',
    requestRecipientUserId: 'user-me',
    requestLabel: '抱抱续费'
  }), currentUser);
  const completed = normalizeMessage(message({
    contentType: 'request',
    requestStatus: 'later',
    requestLabel: '今晚视频',
    respondedAt: '2026-07-12T13:05:00.000Z'
  }), currentUser);

  assert.equal(incoming.canRespondRequest, true);
  assert.equal(incoming.canCancelRequest, false);
  assert.equal(completed.requestStatusText, '稍后再说');
  assert.equal(completed.respondedDisplayTime, '07-12 21:05');
});

test('request view normalizes legacy source and preserves custom consent notices', () => {
  const legacy = normalizeMessage({
    messageId: 'legacy-request',
    type: 'chat',
    contentType: 'request',
    senderUserId: 'user-other',
    requestStatus: 'pending',
    requestLabel: '亲亲请求'
  }, { id: 'user-me' });
  const custom = normalizeMessage({
    messageId: 'custom-request',
    type: 'chat',
    contentType: 'request',
    senderUserId: 'user-me',
    requestSource: 'custom',
    requestStatus: 'pending',
    requestLabel: '陪我散步',
    consentNotice: '这是一次邀请，不代表同意。双方都可以拒绝，也可以在任何时候改变主意。'
  }, { id: 'user-me' });

  assert.equal(legacy.requestSource, 'preset');
  assert.equal(custom.requestSource, 'custom');
  assert.match(custom.consentNotice, /不代表同意/);
});


test('custom request draft normalization limits Unicode code points without splitting emoji', () => {
  assert.equal(Array.from(normalizeCustomRequestDraft('😀'.repeat(31))).length, 30);
  assert.equal(normalizeCustomRequestDraft(null), '');
});
