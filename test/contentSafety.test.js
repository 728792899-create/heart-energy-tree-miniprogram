const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createContentSafetyService,
  collectImageChecks,
  collectTextChecks
} = require('../cloudfunctions/energyTree/contentSafety');

function makeCloud(overrides = {}) {
  const calls = [];
  const cloud = {
    openapi: {
      security: {
        msgSecCheck: async (payload) => {
          calls.push(['text', payload]);
          return { result: { suggest: 'pass', label: 100 }, errCode: 0 };
        },
        mediaCheckAsync: async (payload) => {
          calls.push(['image', payload]);
          return { traceId: 'trace-1', errCode: 0 };
        }
      }
    },
    getTempFileURL: async ({ fileList }) => ({
      fileList: fileList.map((fileID) => ({
        fileID,
        status: 0,
        tempFileURL: `https://temp.example/${fileID.split('/').pop()}`
      }))
    }),
    ...overrides
  };
  return { cloud, calls };
}

test('collectTextChecks covers all user-authored release surfaces without moderating static templates', () => {
  assert.deepEqual(collectTextChecks('bindAsSponsor', { displayName: '阿树' }), ['阿树']);
  assert.deepEqual(collectTextChecks('updateProfile', { name: '小花' }), ['小花']);
  assert.deepEqual(collectTextChecks('sendEncouragement', { customMessage: '今天也很棒' }), ['今天也很棒']);
  assert.deepEqual(collectTextChecks('submitCheckIn', { note: '跑步三公里' }), ['跑步三公里']);
  assert.deepEqual(collectTextChecks('reviewCheckIn', { note: '继续加油' }), ['继续加油']);
  assert.deepEqual(collectTextChecks('requestWithdrawal', { note: '周末约会基金' }), ['周末约会基金']);
  assert.deepEqual(collectTextChecks('saveRewardItem', { name: '电影夜', description: '一起看电影' }), ['电影夜', '一起看电影']);
  assert.deepEqual(collectTextChecks('requestCancelRedemption', { reason: '临时改期' }), ['临时改期']);
  assert.deepEqual(collectTextChecks('sendCoupleMessage', { contentType: 'text', content: '想你啦' }), ['想你啦']);
  assert.deepEqual(collectTextChecks('sendCoupleMessage', { contentType: 'sticker', content: '[表情]' }), []);
  assert.deepEqual(collectTextChecks('sendCoupleRequest', { requestTemplateId: 'kiss' }), []);
  assert.deepEqual(collectTextChecks('sendCoupleRequest', { customRequestText: '陪我散步' }), ['陪我散步']);
});

test('collectImageChecks covers uploaded avatars, check-ins, rewards and chat images', () => {
  assert.deepEqual(collectImageChecks('updateProfile', { avatarFileId: 'cloud://env/avatars/a.jpg' }), [{ fileId: 'cloud://env/avatars/a.jpg', scene: 1 }]);
  assert.deepEqual(collectImageChecks('submitCheckIn', { photoFileId: 'cloud://env/checkins/c.jpg' }), [{ fileId: 'cloud://env/checkins/c.jpg', scene: 4 }]);
  assert.deepEqual(collectImageChecks('saveRewardItem', { imageFileId: 'cloud://env/rewards/r.jpg' }), [{ fileId: 'cloud://env/rewards/r.jpg', scene: 1 }]);
  assert.deepEqual(collectImageChecks('sendCoupleMessage', { contentType: 'image', imageFileId: 'cloud://env/messages/m.jpg' }), [{ fileId: 'cloud://env/messages/m.jpg', scene: 2 }]);
  assert.deepEqual(collectImageChecks('sendCoupleMessage', { contentType: 'text', content: 'hello' }), []);
});

test('text moderation uses trusted openid and rejects risky or review content', async () => {
  const { cloud, calls } = makeCloud();
  const service = createContentSafetyService({ cloud });
  await service.assertEventAllowed({
    action: 'sendCoupleMessage',
    payload: { contentType: 'text', content: '你好' },
    openid: 'trusted-openid'
  });
  assert.deepEqual(calls[0], ['text', {
    content: '你好',
    version: 2,
    scene: 2,
    openid: 'trusted-openid'
  }]);

  cloud.openapi.security.msgSecCheck = async () => ({ result: { suggest: 'risky', label: 20003 }, errCode: 0 });
  await assert.rejects(
    service.assertEventAllowed({
      action: 'updateProfile',
      payload: { name: '违规昵称' },
      openid: 'trusted-openid'
    }),
    (error) => error && error.code === 'CONTENT_SECURITY_REJECTED'
  );

  cloud.openapi.security.msgSecCheck = async () => ({ result: { suggest: 'review', label: 21000 }, errCode: 0 });
  await assert.rejects(
    service.assertEventAllowed({
      action: 'submitCheckIn',
      payload: { note: '需要复核' },
      openid: 'trusted-openid'
    }),
    (error) => error && error.code === 'CONTENT_SECURITY_REJECTED'
  );
});

test('image moderation resolves a temporary URL and submits the official asynchronous check', async () => {
  const { cloud, calls } = makeCloud();
  const service = createContentSafetyService({ cloud });
  const result = await service.assertEventAllowed({
    action: 'submitCheckIn',
    payload: { photoFileId: 'cloud://env/relationships/rel/checkins/photo.jpg' },
    openid: 'trusted-openid'
  });
  assert.deepEqual(calls[0], ['image', {
    mediaUrl: 'https://temp.example/photo.jpg',
    mediaType: 2,
    version: 2,
    scene: 4,
    openid: 'trusted-openid'
  }]);
  assert.deepEqual(result, {
    imageChecks: [{
      fileId: 'cloud://env/relationships/rel/checkins/photo.jpg',
      scene: 4,
      traceId: 'trace-1'
    }]
  });
});

test('content safety fails closed when the official service or image URL is unavailable', async () => {
  const missingOpenApi = createContentSafetyService({ cloud: { getTempFileURL: async () => ({ fileList: [] }) } });
  await assert.rejects(
    missingOpenApi.assertEventAllowed({
      action: 'updateProfile',
      payload: { name: '昵称' },
      openid: 'trusted-openid'
    }),
    (error) => error && error.code === 'CONTENT_SECURITY_UNAVAILABLE'
  );

  const { cloud } = makeCloud({ getTempFileURL: async () => ({ fileList: [] }) });
  const service = createContentSafetyService({ cloud });
  await assert.rejects(
    service.assertEventAllowed({
      action: 'updateProfile',
      payload: { avatarFileId: 'cloud://env/relationships/rel/avatars/a.jpg' },
      openid: 'trusted-openid'
    }),
    (error) => error && error.code === 'CONTENT_SECURITY_UNAVAILABLE'
  );
});
