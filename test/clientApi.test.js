const assert = require('node:assert/strict');
const test = require('node:test');

function loadCloudApi() {
  const calls = [];
  global.wx = {
    cloud: {
      async callFunction(options) {
        calls.push(options);
        return {
          result: {
            ok: true,
            data: {
              action: options.data.action,
              payload: options.data.payload
            }
          }
        };
      }
    },
    getStorageSync() {
      return '';
    }
  };

  const apiPath = require.resolve('../miniprogram/services/api');
  delete require.cache[apiPath];
  return {
    api: require(apiPath),
    calls
  };
}

test('couple feature reads use their cloud actions without mutation request ids', async (t) => {
  const { api, calls } = loadCloudApi();
  t.after(() => {
    delete global.wx;
  });

  await api.queryEncouragements({ unreadOnly: true });
  await api.queryMilestones({ unseenOnly: true });
  await api.queryWeeklyRecap({ weekOffset: -1 });

  assert.deepEqual(calls.map((item) => item.data.action), [
    'queryEncouragements',
    'queryMilestones',
    'queryWeeklyRecap'
  ]);
  calls.forEach((item) => {
    assert.equal(Object.hasOwn(item.data.payload, 'clientRequestId'), false);
  });
});

test('couple feature writes automatically preserve a stable client request id', async (t) => {
  const { api, calls } = loadCloudApi();
  t.after(() => {
    delete global.wx;
  });

  const sent = await api.sendEncouragement({ templateKey: 'hug', message: '今天也抱抱你' });
  await api.markEncouragementRead({ encouragementId: 'enc-1' });
  await api.markMilestoneSeen({ milestoneId: 'milestone-1', clientRequestId: 'keep-this-id' });

  assert.equal(sent.action, 'sendEncouragement');
  assert.match(calls[0].data.payload.clientRequestId, /^sendEncouragement-/);
  assert.match(calls[1].data.payload.clientRequestId, /^markEncouragementRead-/);
  assert.equal(calls[2].data.payload.clientRequestId, 'keep-this-id');
});

test('message reads and writes use dedicated cloud actions and mutation request ids', async (t) => {
  const { api, calls } = loadCloudApi();
  t.after(() => delete global.wx);

  await api.bootstrapCoupleMessages();
  await api.queryCoupleMessages({ beforeSortKey: 'cursor-1', limit: 30 });
  await api.queryCoupleStickerCatalog();
  await api.queryCoupleRequestCatalog();
  await api.sendCoupleMessage({ content: '有你在真好' });
  await api.sendCoupleRequest({ requestTemplateId: 'kiss' });
  await api.respondCoupleRequest({ requestMessageId: 'request-1', decision: 'accepted' });
  await api.cancelCoupleRequest({ requestMessageId: 'request-2' });
  await api.markCoupleMessagesRead({});

  assert.deepEqual(calls.map((item) => item.data.action), [
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
  assert.equal(Object.hasOwn(calls[0].data.payload, 'clientRequestId'), false);
  assert.equal(Object.hasOwn(calls[1].data.payload, 'clientRequestId'), false);
  assert.equal(Object.hasOwn(calls[2].data.payload, 'clientRequestId'), false);
  assert.equal(Object.hasOwn(calls[3].data.payload, 'clientRequestId'), false);
  assert.match(calls[4].data.payload.clientRequestId, /^sendCoupleMessage-/);
  assert.match(calls[5].data.payload.clientRequestId, /^sendCoupleRequest-/);
  assert.match(calls[6].data.payload.clientRequestId, /^respondCoupleRequest-/);
  assert.match(calls[7].data.payload.clientRequestId, /^cancelCoupleRequest-/);
  assert.match(calls[8].data.payload.clientRequestId, /^markCoupleMessagesRead-/);
});
