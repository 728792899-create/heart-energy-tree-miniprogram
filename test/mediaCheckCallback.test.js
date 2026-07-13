const assert = require('node:assert/strict');
const test = require('node:test');

const cloudFunction = require('../cloudfunctions/energyTree/index');
const cloudAppService = require('../cloudfunctions/energyTree/miniprogram/services/appService');

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function createFakeCloudDb(initialState, seed = {}) {
  const documents = new Map([
    ['appStates/main', { state: clone(initialState), updatedAt: '2026-07-14T00:00:00.000Z' }]
  ]);
  Object.entries(seed).forEach(([path, value]) => documents.set(path, clone(value)));
  let sequence = 0;
  let transactionQueue = Promise.resolve();

  const matchingRows = (collectionName, where, limit = Infinity) => {
    const prefix = `${collectionName}/`;
    return Array.from(documents.entries())
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, data]) => ({ path, data }))
      .filter(({ data }) => Object.entries(where || {}).every(([key, value]) => data[key] === value))
      .slice(0, limit);
  };

  const createContext = () => ({
    collection(collectionName) {
      return {
        doc(id) {
          const path = `${collectionName}/${id}`;
          return {
            async get() {
              if (!documents.has(path)) throw new Error(`document not found: ${path}`);
              return { data: clone(documents.get(path)) };
            },
            async set({ data }) {
              documents.set(path, clone(data));
              return { _id: id };
            },
            async update({ data }) {
              if (!documents.has(path)) throw new Error(`document not found: ${path}`);
              documents.set(path, { ...documents.get(path), ...clone(data) });
              return { stats: { updated: 1 } };
            },
            async remove() {
              documents.delete(path);
            },
            async delete() {
              documents.delete(path);
            }
          };
        },
        async add({ data }) {
          const id = `media-task-${++sequence}`;
          documents.set(`${collectionName}/${id}`, { ...clone(data), _id: id });
          return { _id: id };
        },
        where(where) {
          let queryLimit = Infinity;
          const query = {
            limit(value) {
              queryLimit = value;
              return query;
            },
            async get() {
              return { data: matchingRows(collectionName, where, queryLimit).map(({ data }) => clone(data)) };
            },
            async update({ data }) {
              const matches = matchingRows(collectionName, where, queryLimit);
              matches.forEach(({ path, data: current }) => {
                documents.set(path, { ...current, ...clone(data) });
              });
              return { stats: { updated: matches.length } };
            }
          };
          return query;
        }
      };
    }
  });

  const context = createContext();
  return {
    db: {
      collection: context.collection,
      async createCollection() {},
      runTransaction(task) {
        const execution = transactionQueue.then(() => task(createContext()));
        transactionQueue = execution.then(() => undefined, () => undefined);
        return execution.then((result) => ({ result }));
      }
    },
    documents,
    rows(collectionName) {
      return matchingRows(collectionName, {}).map(({ data }) => clone(data));
    }
  };
}

function stateWithCheckIn(fileId) {
  const state = cloudAppService.__private.createInitialState();
  state.checkIns.push({
    id: 'checkin-media-1',
    relationshipId: state.relationships[0].id,
    participantId: state.relationships[0].participantId,
    sponsorId: state.relationships[0].sponsorId,
    status: 'submitted',
    photoFileId: fileId,
    photoPath: fileId
  });
  return state;
}

async function addPending(fake, { action = 'submitCheckIn', fileId, traceId, backendPayload = {} }) {
  const state = fake.documents.get('appStates/main').state;
  const relationshipId = state.relationships[0].id;
  const records = await cloudFunction.__private.recordPendingMediaChecks(
    { action, payload: { relationshipId, ...backendPayload } },
    { openid: 'demo_openid_participant' },
    [{ fileId, scene: 4, traceId }],
    { db: fake.db }
  );
  assert.equal(records.length, 1);
  return records[0];
}

test('pending media task relationship comes from trusted openid instead of client payload', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/checkins/trusted-owner.jpg';
  const fake = createFakeCloudDb(stateWithCheckIn(fileId));
  const state = fake.documents.get('appStates/main').state;
  const trustedRelationshipId = state.relationships[0].id;

  const records = await cloudFunction.__private.recordPendingMediaChecks(
    { action: 'updateProfile', payload: { relationshipId: 'forged-relationship' } },
    { openid: state.relationships[0].participantOpenid },
    [{ fileId, scene: 1, traceId: 'trace-trusted-owner' }],
    { db: fake.db }
  );

  assert.equal(records[0].relationshipId, trustedRelationshipId);
  assert.equal(fake.rows('mediaCheckTasks')[0].relationshipId, trustedRelationshipId);
});

test('risky media callback hides a check-in, records an audit and deletes the cloud file', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/checkins/risky.jpg';
  const fake = createFakeCloudDb(stateWithCheckIn(fileId));
  await addPending(fake, { fileId, traceId: 'trace-risky' });
  const deleted = [];

  const result = await cloudFunction.__private.handleMediaCheckResult({
    Event: 'wxa_media_check',
    trace_id: 'trace-risky',
    result: { suggest: 'risky' }
  }, {
    db: fake.db,
    cloud: { deleteFile: async ({ fileList }) => deleted.push(...fileList) }
  });

  const state = fake.documents.get('appStates/main').state;
  const checkIn = state.checkIns.find((item) => item.id === 'checkin-media-1');
  const task = fake.rows('mediaCheckTasks')[0];
  assert.equal(result.status, 'risky');
  assert.equal(checkIn.photoFileId, '');
  assert.equal(checkIn.photoPath, '');
  assert.equal(checkIn.mediaHidden, true);
  assert.equal(task.status, 'risky');
  assert.equal(task.suggest, 'risky');
  assert.deepEqual(deleted, [fileId]);
  assert.equal(state.auditLogs.some((item) => (
    item.action === 'mediacheck.risky.autohide' && item.targetId === fileId
  )), true);
});

test('pass media callback keeps the image and resolves the task as pass', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/checkins/pass.jpg';
  const fake = createFakeCloudDb(stateWithCheckIn(fileId));
  await addPending(fake, { fileId, traceId: 'trace-pass' });

  const result = await cloudFunction.__private.handleMediaCheckResult({
    Event: 'wxa_media_check',
    trace_id: 'trace-pass',
    result: { suggest: 'pass' }
  }, { db: fake.db, cloud: { deleteFile: async () => assert.fail('pass image must not be deleted') } });

  const state = fake.documents.get('appStates/main').state;
  assert.equal(result.status, 'pass');
  assert.equal(state.checkIns[0].photoFileId, fileId);
  assert.equal(state.checkIns[0].mediaHidden, undefined);
  assert.equal(fake.rows('mediaCheckTasks')[0].status, 'pass');
});

test('duplicate callback for one trace id is idempotent and deletes only once', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/checkins/replay.jpg';
  const fake = createFakeCloudDb(stateWithCheckIn(fileId));
  await addPending(fake, { fileId, traceId: 'trace-replay' });
  let deleteCalls = 0;
  const options = {
    db: fake.db,
    cloud: { deleteFile: async () => { deleteCalls += 1; } }
  };
  const event = { Event: 'wxa_media_check', trace_id: 'trace-replay', result: { suggest: 'risky' } };

  const first = await cloudFunction.__private.handleMediaCheckResult(event, options);
  const replay = await cloudFunction.__private.handleMediaCheckResult(event, options);

  const state = fake.documents.get('appStates/main').state;
  assert.equal(first.status, 'risky');
  assert.equal(replay.ignored, true);
  assert.equal(deleteCalls, 1);
  assert.equal(state.auditLogs.filter((item) => item.action === 'mediacheck.risky.autohide').length, 1);
});

test('risky couple-message image is hidden in the source message and both inbox projections', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/messages/user-participant/risky.jpg';
  const state = cloudAppService.__private.createInitialState();
  const relationshipId = state.relationships[0].id;
  const message = {
    messageId: 'chat-image-1',
    relationshipId,
    type: 'chat',
    contentType: 'image',
    content: '[图片]',
    imageFileId: fileId
  };
  const fake = createFakeCloudDb(state, {
    'coupleMessages/chat-image-1': { ...message, _id: 'chat-image-1' },
    'coupleMessageInbox/chat-image-1-sponsor': { ...message, _id: 'chat-image-1-sponsor', recipientOpenid: 'demo_openid_sponsor' },
    'coupleMessageInbox/chat-image-1-participant': { ...message, _id: 'chat-image-1-participant', recipientOpenid: 'demo_openid_participant' }
  });
  await cloudFunction.__private.recordPendingMediaChecks(
    { action: 'sendCoupleMessage', payload: {} },
    { openid: 'demo_openid_participant' },
    [{ fileId, scene: 2, traceId: 'trace-message' }],
    { db: fake.db }
  );

  const result = await cloudFunction.__private.handleMediaCheckResult({
    Event: 'wxa_media_check',
    trace_id: 'trace-message',
    result: { suggest: 'risky' }
  }, { db: fake.db, cloud: { deleteFile: async () => {} } });

  const source = fake.documents.get('coupleMessages/chat-image-1');
  const inbox = fake.rows('coupleMessageInbox');
  const task = fake.rows('mediaCheckTasks')[0];
  assert.equal(result.status, 'risky');
  assert.equal(task.relationshipId, relationshipId);
  assert.equal(source.hidden, true);
  assert.equal(source.imageFileId, '');
  assert.equal(source.content, '该图片已被内容安全隐藏');
  assert.equal(inbox.length, 2);
  inbox.forEach((item) => {
    assert.equal(item.hidden, true);
    assert.equal(item.imageFileId, '');
  });
});

test('a retry that only hides a remaining inbox projection still resolves as risky', async () => {
  const fileId = 'cloud://env.bucket/relationships/rel-main/messages/user-participant/retry.jpg';
  const state = cloudAppService.__private.createInitialState();
  const relationshipId = state.relationships[0].id;
  const fake = createFakeCloudDb(state, {
    'coupleMessages/chat-image-retry': {
      _id: 'chat-image-retry',
      messageId: 'chat-image-retry',
      relationshipId,
      contentType: 'image',
      content: '该图片已被内容安全隐藏',
      imageFileId: '',
      hidden: true
    },
    'coupleMessageInbox/chat-image-retry-sponsor': {
      _id: 'chat-image-retry-sponsor',
      messageId: 'chat-image-retry',
      relationshipId,
      recipientOpenid: 'demo_openid_sponsor',
      contentType: 'image',
      content: '[图片]',
      imageFileId: fileId
    }
  });
  await cloudFunction.__private.recordPendingMediaChecks(
    { action: 'sendCoupleMessage', payload: { relationshipId } },
    { openid: 'demo_openid_participant' },
    [{ fileId, scene: 2, traceId: 'trace-message-retry' }],
    { db: fake.db }
  );

  const result = await cloudFunction.__private.handleMediaCheckResult({
    Event: 'wxa_media_check',
    trace_id: 'trace-message-retry',
    result: { suggest: 'risky' }
  }, { db: fake.db, cloud: { deleteFile: async () => {} } });

  assert.equal(result.status, 'risky');
  assert.equal(result.hiddenCount, 1);
  assert.equal(fake.rows('mediaCheckTasks')[0].status, 'risky');
  const inbox = fake.documents.get('coupleMessageInbox/chat-image-retry-sponsor');
  assert.equal(inbox.hidden, true);
  assert.equal(inbox.imageFileId, '');
});
