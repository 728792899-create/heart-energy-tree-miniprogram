const test = require('node:test');
const assert = require('node:assert/strict');

const { __private } = require('../cloudfunctions/energyTree/index');

function makeContext(currentRole) {
  return {
    currentRole,
    currentUser: {
      id: currentRole === 'sponsor' ? 'user-sponsor' : 'user-participant',
      openid: currentRole === 'sponsor' ? 'openid-sponsor' : 'openid-participant'
    },
    companionUser: {
      id: currentRole === 'sponsor' ? 'user-participant' : 'user-sponsor',
      openid: currentRole === 'sponsor' ? 'openid-participant' : 'openid-sponsor'
    },
    relationship: { id: 'rel-main' }
  };
}

test('sponsor marks couple messages read without invoking participant-only legacy notice mutation', async () => {
  let legacyCalls = 0;
  let reloadCalls = 0;
  const context = makeContext('sponsor');

  const result = await __private.markCoupleMessagesRead({
    event: { action: 'markCoupleMessagesRead' },
    context,
    service: {
      markRead: async ({ context: receivedContext }) => {
        assert.equal(receivedContext, context);
        return { unreadCount: 0 };
      }
    },
    markLegacyViewNoticesRead: async () => { legacyCalls += 1; },
    reloadContext: async () => { reloadCalls += 1; return context; }
  });

  assert.deepEqual(result, { unreadCount: 0 });
  assert.equal(legacyCalls, 0);
  assert.equal(reloadCalls, 0);
});

test('participant marks legacy view notices read before clearing couple message unread state', async () => {
  const calls = [];
  const initialContext = makeContext('participant');
  const refreshedContext = { ...initialContext, refreshed: true };

  const result = await __private.markCoupleMessagesRead({
    event: { action: 'markCoupleMessagesRead' },
    context: initialContext,
    service: {
      markRead: async ({ context: receivedContext }) => {
        calls.push('message-read');
        assert.equal(receivedContext, refreshedContext);
        return { unreadCount: 0 };
      }
    },
    markLegacyViewNoticesRead: async () => { calls.push('legacy-read'); },
    reloadContext: async () => {
      calls.push('reload-context');
      return refreshedContext;
    }
  });

  assert.deepEqual(result, { unreadCount: 0 });
  assert.deepEqual(calls, ['legacy-read', 'reload-context', 'message-read']);
});

test('authorized media hydration resolves both partner avatars and message images without persisting URLs', async () => {
  const payload = {
    currentUser: { avatarFileId: 'cloud://env.bucket/relationships/rel-main/avatars/user-sponsor/a.png' },
    companionUser: { avatarFileId: 'cloud://env.bucket/relationships/rel-main/avatars/user-participant/b.png' },
    messages: [{
      messageId: 'image-1',
      imageFileId: 'cloud://env.bucket/relationships/rel-main/messages/user-participant/c.png'
    }]
  };
  const calls = [];
  const result = await __private.hydrateAuthorizedMedia(payload, async (fileIds) => {
    calls.push(fileIds);
    return Object.fromEntries(fileIds.map((fileId) => [fileId, `https://temp.example/${fileId.split('/').pop()}`]));
  });

  assert.equal(calls.length, 1);
  assert.equal(result.currentUser.avatarSrc, 'https://temp.example/a.png');
  assert.equal(result.companionUser.avatarSrc, 'https://temp.example/b.png');
  assert.equal(result.messages[0].imageSrc, 'https://temp.example/c.png');
  assert.equal(payload.currentUser.avatarSrc, undefined);
});

test('authorized media hydration resolves check-in photos for the bound companion review flow', async () => {
  const payload = {
    pending: [{
      id: 'checkin-1',
      photoFileId: 'cloud://env.bucket/relationships/rel-main/checkins/checkin-1.jpg'
    }]
  };
  const result = await __private.hydrateAuthorizedMedia(payload, async (fileIds) => {
    assert.deepEqual(fileIds, ['cloud://env.bucket/relationships/rel-main/checkins/checkin-1.jpg']);
    return {
      'cloud://env.bucket/relationships/rel-main/checkins/checkin-1.jpg': 'https://temp.example/checkin-1.jpg'
    };
  });

  assert.equal(result.pending[0].photoSrc, 'https://temp.example/checkin-1.jpg');
  assert.equal(payload.pending[0].photoSrc, undefined);
});

test('all authorized cloud action responses pass through content safety then server-side media hydration', async () => {
  const calls = [];
  const result = await __private.handleAuthorizedAction(
    { action: 'queryPendingCheckIns', payload: {}, __testOpenid: 'trusted-openid' },
    {
      contentSafety: {
        assertEventAllowed: async ({ action, payload, openid }) => {
          calls.push(['safety', action, payload, openid]);
        }
      },
      actionHandler: async (event) => {
        calls.push(['action', event.action]);
        return [{ photoFileId: 'cloud://env.bucket/relationships/rel-main/checkins/checkin-2.jpg' }];
      },
      hydrate: async (payload) => {
        calls.push(['hydrate', payload[0].photoFileId]);
        return [{ ...payload[0], photoSrc: 'https://temp.example/checkin-2.jpg' }];
      }
    }
  );

  assert.equal(result[0].photoSrc, 'https://temp.example/checkin-2.jpg');
  assert.deepEqual(calls, [
    ['safety', 'queryPendingCheckIns', {}, 'trusted-openid'],
    ['action', 'queryPendingCheckIns'],
    ['hydrate', 'cloud://env.bucket/relationships/rel-main/checkins/checkin-2.jpg']
  ]);
});

test('content safety always receives the trusted cloud identity instead of client supplied openid fields', async () => {
  let safetyOpenid = '';
  await __private.handleAuthorizedAction(
    {
      action: 'sendCoupleMessage',
      payload: {
        contentType: 'text',
        content: 'hello',
        openid: 'forged-payload-openid'
      },
      openid: 'forged-event-openid',
      __testOpenid: 'trusted-openid'
    },
    {
      contentSafety: {
        assertEventAllowed: async ({ openid }) => { safetyOpenid = openid; }
      },
      actionHandler: async () => ({ ok: true }),
      hydrate: async (value) => value
    }
  );

  assert.equal(safetyOpenid, 'trusted-openid');
});

test('content safety rejection stops the cloud mutation before its handler runs', async () => {
  let handlerCalls = 0;
  await assert.rejects(
    __private.handleAuthorizedAction(
      {
        action: 'sendCoupleMessage',
        payload: { contentType: 'text', content: 'bad' },
        __testOpenid: 'trusted-openid'
      },
      {
        contentSafety: {
          assertEventAllowed: async () => {
            const error = new Error('内容未通过安全检查');
            error.code = 'CONTENT_SECURITY_REJECTED';
            throw error;
          }
        },
        actionHandler: async () => { handlerCalls += 1; return {}; },
        hydrate: async (value) => value
      }
    ),
    (error) => error && error.code === 'CONTENT_SECURITY_REJECTED'
  );
  assert.equal(handlerCalls, 0);
});

test('couple request actions are routed through the dedicated message handler', () => {
  const actions = __private.COUPLE_MESSAGE_ACTIONS;
  assert.ok(actions instanceof Set);
  [
    'queryCoupleRequestCatalog',
    'sendCoupleRequest',
    'respondCoupleRequest',
    'cancelCoupleRequest'
  ].forEach((action) => assert.equal(actions.has(action), true, `${action} should be a couple message action`));
});

test('sendCoupleRequest route forwards custom request text to the message service', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/energyTree/index.js'), 'utf8');
  assert.match(source, /if \(action === 'sendCoupleRequest'\)[\s\S]{0,320}customRequestText:\s*payload\.customRequestText/);
});
