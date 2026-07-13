const assert = require('node:assert/strict');
const test = require('node:test');

const cloudFunction = require('../cloudfunctions/energyTree/index');
const cloudAppService = require('../cloudfunctions/energyTree/miniprogram/services/appService');
const cloudStorage = require('../cloudfunctions/energyTree/miniprogram/services/storage');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeTransactionalDb(initialState) {
  const documents = new Map([
    ['appStates/main', { state: clone(initialState), updatedAt: '2026-07-14T00:00:00.000Z' }]
  ]);
  let transactionQueue = Promise.resolve();

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
            },
            async remove() {
              documents.delete(path);
            },
            async delete() {
              documents.delete(path);
            }
          };
        }
      };
    }
  });

  const context = createContext();
  return {
    db: {
      collection: context.collection,
      runTransaction(task) {
        const execution = transactionQueue.then(() => task(createContext()));
        transactionQueue = execution.then(() => undefined, () => undefined);
        return execution.then((result) => ({ result, errMsg: 'runTransaction:ok' }));
      }
    },
    documents
  };
}

async function prepareState(initialState, task) {
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: initialState
  }, task);
  return { state: scoped.values[cloudAppService.__private.DB_KEY], result: scoped.result };
}

function assertOneSuccessOneConflict(results, errorPattern) {
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = results.filter((item) => item.status === 'rejected');
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0].reason && rejected[0].reason.message), errorPattern);
}

test('concurrent approval of the same check-in credits balance exactly once', async () => {
  const initial = cloudAppService.__private.createInitialState();
  cloudAppService.__private.setNowForTests('2026-07-14T04:00:00.000Z');
  const prepared = await prepareState(initial, () => cloudAppService.submitCheckIn({
    relationshipId: initial.relationships[0].id,
    photoFileId: 'local-same-checkin.jpg',
    clientRequestId: 'prepare-same-checkin',
    authContext: { openid: 'demo_openid_participant' }
  }));
  const fake = createFakeTransactionalDb(prepared.state);

  const results = await Promise.allSettled(['first', 'second'].map((suffix) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, () => (
      cloudAppService.approveCheckIn({
        checkInId: prepared.result.id,
        praise: '同一条只奖励一次',
        clientRequestId: `same-checkin-${suffix}`,
        authContext: { openid: 'demo_openid_sponsor' }
      })
    ))
  )));

  assertOneSuccessOneConflict(results, /已经审核过/);
  const stored = fake.documents.get('appStates/main').state;
  const ledgers = stored.ledgers.filter((item) => item.type === 'checkin_reward' && item.sourceId === prepared.result.id);
  assert.equal(ledgers.length, 1);
  assert.equal(stored.relationships[0].balance.availableCents, ledgers[0].amountCents);
  assert.equal(stored.checkIns.find((item) => item.id === prepared.result.id).status, 'approved');
});

test('concurrent verification of the same redemption consumes it exactly once', async () => {
  const initial = cloudAppService.__private.createInitialState();
  initial.relationships[0].balance.availableCents = 10000;
  const prepared = await prepareState(initial, () => cloudAppService.redeemReward({
    rewardId: 'reward-milk-tea',
    clientRequestId: 'prepare-same-redemption',
    authContext: { openid: 'demo_openid_participant' }
  }));
  const fake = createFakeTransactionalDb(prepared.state);

  const results = await Promise.allSettled(['first', 'second'].map((suffix) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, () => (
      cloudAppService.verifyRedemption({
        redemptionId: prepared.result.id,
        note: '线下已经兑现',
        confirmed: true,
        clientRequestId: `same-redemption-${suffix}`,
        authContext: { openid: 'demo_openid_sponsor' }
      })
    ))
  )));

  assertOneSuccessOneConflict(results, /已经处理过/);
  const stored = fake.documents.get('appStates/main').state;
  assert.equal(stored.redemptions.find((item) => item.id === prepared.result.id).status, 'used');
  assert.equal(stored.auditLogs.filter((item) => (
    item.action === 'redemption.verify' && item.targetId === prepared.result.id
  )).length, 1);
});

test('concurrent payout of the same withdrawal moves frozen balance exactly once', async () => {
  const initial = cloudAppService.__private.createInitialState();
  initial.relationships[0].balance.availableCents = 5000;
  const prepared = await prepareState(initial, () => {
    const withdrawal = cloudAppService.requestWithdrawal({
      amountCents: 1200,
      note: '同一笔兑现测试',
      clientRequestId: 'prepare-same-withdrawal',
      authContext: { openid: 'demo_openid_participant' }
    });
    cloudAppService.approveWithdrawal({
      withdrawalId: withdrawal.id,
      clientRequestId: 'approve-same-withdrawal',
      authContext: { openid: 'demo_openid_sponsor' }
    });
    return withdrawal;
  });
  const fake = createFakeTransactionalDb(prepared.state);

  const results = await Promise.allSettled(['first', 'second'].map((suffix) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, () => (
      cloudAppService.markWithdrawalPaid({
        withdrawalId: prepared.result.id,
        transferNote: '已在线下手动兑现',
        confirmed: true,
        clientRequestId: `same-withdrawal-${suffix}`,
        authContext: { openid: 'demo_openid_sponsor' }
      })
    ))
  )));

  assertOneSuccessOneConflict(results, /请先通过心愿金申请/);
  const stored = fake.documents.get('appStates/main').state;
  const relationship = stored.relationships[0];
  assert.equal(relationship.balance.availableCents, 3800);
  assert.equal(relationship.balance.frozenCents, 0);
  assert.equal(relationship.balance.paidOutCents, 1200);
  assert.equal(stored.withdrawals.find((item) => item.id === prepared.result.id).status, 'paid');
  assert.equal(stored.auditLogs.filter((item) => (
    item.action === 'withdrawal.markPaid' && item.targetId === prepared.result.id
  )).length, 1);
});
