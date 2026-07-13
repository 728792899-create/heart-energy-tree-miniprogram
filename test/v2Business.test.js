const assert = require('node:assert/strict');
const test = require('node:test');

const { DEMO_IDS } = require('../miniprogram/core/models');
const rewardEngine = require('../miniprogram/core/rewardEngine');
const appService = require('../miniprogram/services/appService');
const cloudFunction = require('../cloudfunctions/energyTree/index');
const cloudAppService = require('../cloudfunctions/energyTree/miniprogram/services/appService');
const cloudStorage = require('../cloudfunctions/energyTree/miniprogram/services/storage');

const PARTICIPANT_AUTH = { authContext: { openid: 'demo_openid_participant' } };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeTransactionalDb(initialState) {
  const documents = new Map([
    ['appStates/main', {
      state: clone(initialState),
      updatedAt: '2026-07-14T00:00:00.000Z'
    }]
  ]);
  const operations = [];
  let transactionCalls = 0;
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
              operations.push({ type: 'set', path, data: clone(data) });
            },
            async remove() {
              documents.delete(path);
              operations.push({ type: 'remove', path });
            },
            async delete() {
              documents.delete(path);
              operations.push({ type: 'remove', path });
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
        transactionCalls += 1;
        const execution = transactionQueue.then(() => task(createContext()));
        transactionQueue = execution.then(() => undefined, () => undefined);
        return execution.then((result) => ({
          result,
          errMsg: 'runTransaction:ok'
        }));
      }
    },
    documents,
    operations,
    transactionCalls: () => transactionCalls
  };
}

async function prepareCloudState(initialState, task) {
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: initialState
  }, task);
  return scoped.values[cloudAppService.__private.DB_KEY];
}

test('state migration preserves data and adds version 4 revision and receipts', () => {
  const legacy = appService.__private.createInitialState();
  legacy.version = 3;
  legacy.checkIns.push({ id: 'legacy-checkin' });
  delete legacy.meta.revision;
  delete legacy.operationReceipts;

  appService.saveState(legacy);
  const state = appService.getState();

  assert.equal(state.version, 4);
  assert.equal(state.meta.revision, 0);
  assert.deepEqual(state.operationReceipts, []);
  assert.equal(state.checkIns.some((item) => item.id === 'legacy-checkin'), true);
});

test('submit check-in uses injected server time instead of client occurredAt', () => {
  appService.resetDemo();
  appService.__private.setNowForTests('2026-07-10T16:30:00.000Z');

  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'local-test-photo.jpg',
    occurredAt: '1999-01-01T00:00:00.000Z'
  });

  assert.equal(checkIn.dateKey, '2026-07-11');
  assert.equal(checkIn.occurredAt, '2026-07-10T16:30:00.000Z');
});

test('check-in input requires a file id and validates duration and text limits', () => {
  appService.resetDemo();
  appService.__private.setNowForTests('2026-07-11T04:00:00.000Z');

  assert.throws(() => appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoPath: 'legacy-local-path.jpg'
  }), /文件 ID/);

  ['', '0', '1.5', '-1', '601', 'not-a-number'].forEach((durationMinutes) => {
    if (durationMinutes === '') return;
    assert.throws(() => appService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      photoFileId: 'local-test-photo.jpg',
      durationMinutes
    }), /1–600|1-600/);
  });

  assert.throws(() => appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'local-test-photo.jpg',
    note: '爱'.repeat(201)
  }), /200/);

  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'local-test-photo.jpg',
    durationMinutes: '',
    note: '今天轻轻动一动'
  });
  assert.equal(checkIn.durationMinutes, null);
});

test('cloud check-in file id must belong to the active relationship path', async () => {
  const state = cloudAppService.__private.createInitialState();
  state.meta.cloudMode = true;
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: state
  }, async () => {
    assert.throws(() => cloudAppService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      photoFileId: 'cloud://env.other/relationships/other-rel/checkins/photo.jpg'
    }), /打卡目录/);

    return cloudAppService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      photoFileId: 'cloud://env.bucket/relationships/rel-main/checkins/photo.jpg'
    });
  });

  assert.equal(scoped.result.relationshipId, DEMO_IDS.relationship);
});

test('daily cash cap is allocated base then streak then map reward', () => {
  const approval = rewardEngine.evaluateApproval({
    rule: {
      perCheckInCents: 500,
      dailyMaxCents: 700,
      sunshinePerCheckIn: 12,
      fruitEverySunshine: 36,
      streakBonuses: [{ days: 3, bonusCents: 300, surpriseTitle: '三天约会' }]
    },
    todayKey: '2026-07-03',
    approvedDateKeys: ['2026-07-01', '2026-07-02'],
    todayEarnedCents: 0,
    mapRewardCents: 400,
    currentSunshine: 0
  });

  assert.equal(approval.baseCents, 500);
  assert.equal(approval.bonusCents, 200);
  assert.equal(approval.levelRewardCents, 0);
  assert.equal(approval.totalCents, 700);
  assert.equal(approval.cashOverflowCents, 500);
});

test('cash overflow adds one fixed love pack without exceeding balance cap', () => {
  appService.resetDemo();
  const state = appService.getState();
  const rel = state.relationships[0];
  rel.rewardRule = {
    ...rel.rewardRule,
    perCheckInCents: 500,
    dailyMaxCents: 600,
    streakBonuses: [{ days: 1, bonusCents: 300, surpriseTitle: '第一天加码' }]
  };
  state.adventureLevels[0].requiredSteps = 1;
  state.adventureLevels[0].rewardCents = 400;
  state.meta.adventureLevelsCustomized = true;
  appService.saveState(state);
  appService.__private.setNowForTests('2026-07-11T04:00:00.000Z');

  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'local-overflow-photo.jpg'
  });
  const result = appService.approveCheckIn({
    checkInId: checkIn.id,
    authContext: { openid: 'demo_openid_sponsor' }
  });
  const next = appService.getState();

  assert.equal(result.ledger.amountCents, 600);
  assert.equal(result.ledger.baseCents, 500);
  assert.equal(result.ledger.bonusCents, 100);
  assert.equal(result.ledger.levelRewardCents, 0);
  assert.equal(result.ledger.cashOverflowCents, 600);
  assert.equal(next.relationships[0].balance.availableCents, 600);
  assert.equal(next.relationships[0].tree.sunshine, 30);
  assert.equal(next.surpriseCards.filter((item) => item.sceneKey === 'cash_overflow_love_pack').length, 1);
});

test('approving an older check-in recomputes the current streak from the latest approved date', () => {
  appService.resetDemo();
  const submitAt = (dateKey) => {
    appService.__private.setNowForTests(`${dateKey}T04:00:00.000Z`);
    return appService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      photoFileId: `local-${dateKey}.jpg`
    });
  };
  const approve = (checkIn) => appService.approveCheckIn({
    checkInId: checkIn.id,
    authContext: { openid: 'demo_openid_sponsor' }
  });

  approve(submitAt('2026-07-10'));
  const middle = submitAt('2026-07-11');
  approve(submitAt('2026-07-12'));
  const result = approve(middle);
  const rel = appService.getState().relationships[0];

  assert.equal(result.approval.streak, 3);
  assert.equal(rel.tree.streak, 3);
  assert.equal(rel.tree.lastApprovedDate, '2026-07-12');
});

test('client request ids dedupe writes and revisions only count real mutations', () => {
  appService.resetDemo();
  appService.__private.setNowForTests('2026-07-13T04:00:00.000Z');
  const submitInput = {
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    clientRequestId: 'submit-20260713-one',
    photoFileId: 'local-idempotent-photo.jpg'
  };

  const firstSubmit = appService.submitCheckIn(submitInput);
  const replaySubmit = appService.submitCheckIn(submitInput);
  assert.equal(replaySubmit.deduped, true);
  assert.equal(replaySubmit.targetId, firstSubmit.id);

  const reviewInput = {
    checkInId: firstSubmit.id,
    authContext: { openid: 'demo_openid_sponsor' },
    clientRequestId: 'approve-20260713-one'
  };
  const firstApproval = appService.approveCheckIn(reviewInput);
  const replayApproval = appService.approveCheckIn(reviewInput);
  const state = appService.getState();

  assert.equal(replayApproval.deduped, true);
  assert.equal(replayApproval.targetId, firstApproval.checkIn.id);
  assert.equal(state.checkIns.length, 1);
  assert.equal(state.ledgers.length, 1);
  assert.equal(state.relationships[0].balance.availableCents, 500);
  assert.equal(state.meta.revision, 2);
  assert.equal(state.operationReceipts.length, 2);
});

test('operation receipts prune expired entries and retain at most 300 recent requests', () => {
  const state = appService.__private.createInitialState();
  state.operationReceipts = Array.from({ length: 305 }, (_, index) => ({
    id: `receipt-${index}`,
    key: `key-${index}`,
    createdAt: index === 0 ? '2026-05-01T00:00:00.000Z' : `2026-07-${String(1 + (index % 9)).padStart(2, '0')}T00:00:00.000Z`
  }));
  appService.__private.setNowForTests('2026-07-13T04:00:00.000Z');

  appService.__private.pruneOperationReceipts(state);

  assert.equal(state.operationReceipts.length, 300);
  assert.equal(state.operationReceipts.some((item) => item.id === 'receipt-0'), false);
});

test('all relationship reads reject a client-selected relationship outside the trusted identity', () => {
  appService.resetDemo();
  const other = appService.createRelationship({
    sponsorId: 'other-sponsor',
    participantId: 'other-participant',
    sponsorOpenid: 'other-sponsor-openid',
    participantOpenid: 'other-participant-openid',
    title: '另一段关系'
  });
  const spoofed = {
    relationshipId: other.id,
    ...PARTICIPANT_AUTH
  };

  [
    () => appService.getDashboard(spoofed),
    () => appService.getAdventure(spoofed),
    () => appService.getBadgeWall(spoofed),
    () => appService.getCalendarStats(spoofed),
    () => appService.listHistory(spoofed),
    () => appService.listWithdrawals(spoofed),
    () => appService.listLedgers(spoofed),
    () => appService.listRedemptions(spoofed),
    () => appService.listRewardItems(spoofed)
  ].forEach((read) => assert.throws(read, /关系.*不匹配|自己关系/));
});

test('reward detail and history queries require a trusted bound identity', () => {
  appService.resetDemo();
  const unbound = { authContext: { openid: 'not-bound-openid' } };
  assert.throws(() => appService.getRewardItem({ id: 'reward-milk-tea', ...unbound }), /不在这段激励关系/);
  assert.throws(() => appService.listHistory(unbound), /不在这段激励关系/);
});

test('cloud routed high-risk actions preserve client request ids for dedupe', async () => {
  const state = cloudAppService.__private.createInitialState();
  cloudAppService.__private.setNowForTests('2026-07-14T04:00:00.000Z');
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: state
  }, async () => {
    const checkIn = cloudAppService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      authContext: { openid: 'demo_openid_participant' },
      clientRequestId: 'cloud-submit-one',
      photoFileId: 'local-cloud-route-photo.jpg'
    });
    const payload = {
      checkInId: checkIn.id,
      decision: 'approved',
      note: '今天也很棒',
      clientRequestId: 'cloud-review-one'
    };
    const authContext = { openid: 'demo_openid_sponsor' };
    const first = await cloudFunction.__private.dispatchAction('reviewCheckIn', payload, state, authContext);
    const replay = await cloudFunction.__private.dispatchAction('reviewCheckIn', payload, state, authContext);
    return { first, replay };
  });

  assert.equal(scoped.result.replay.deduped, true);
  assert.equal(scoped.result.replay.targetId, scoped.result.first.checkIn.id);
});

test('cloud sponsor binding advances revision and dedupes the same client request', async () => {
  const initialState = cloudFunction.__private.createCloudInitialState();
  const fake = createFakeTransactionalDb(initialState);

  const first = await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.bindAsSponsor(state, {
      displayName: '我',
      clientRequestId: 'bind-sponsor-once'
    }, 'openid_new_sponsor')
  ));
  const replay = await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.bindAsSponsor(state, {
      displayName: '我',
      clientRequestId: 'bind-sponsor-once'
    }, 'openid_new_sponsor')
  ));

  const stored = fake.documents.get('appStates/main').state;
  assert.equal(first.currentRole, 'sponsor');
  assert.equal(replay.deduped, true);
  assert.equal(replay.targetId, DEMO_IDS.relationship);
  assert.equal(stored.meta.revision, 1);
  assert.equal(stored.auditLogs.filter((item) => item.action === 'identity.createSponsor').length, 1);
});

test('cloud participant invite binding can replay after the one-time token rotates', async () => {
  const initialState = cloudFunction.__private.createCloudInitialState();
  const fake = createFakeTransactionalDb(initialState);

  await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.bindAsSponsor(state, {
      displayName: '我',
      clientRequestId: 'bind-existing-sponsor'
    }, 'openid_new_sponsor')
  ));
  const invite = await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.generatePartnerInvite(state, {
      clientRequestId: 'invite-participant-once'
    }, 'openid_new_sponsor')
  ));
  const payload = {
    inviteToken: invite.inviteToken,
    displayName: '她',
    clientRequestId: 'bind-participant-once'
  };
  const first = await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.bindByInvite(state, payload, 'openid_new_participant')
  ));
  const replay = await cloudFunction.__private.runStateMutationTransaction(fake.db, async (state) => (
    cloudFunction.__private.bindByInvite(state, payload, 'openid_new_participant')
  ));

  const stored = fake.documents.get('appStates/main').state;
  assert.equal(first.currentRole, 'participant');
  assert.equal(replay.deduped, true);
  assert.equal(replay.targetId, DEMO_IDS.relationship);
  assert.equal(stored.meta.revision, 2);
  assert.equal(stored.auditLogs.filter((item) => item.action === 'identity.bind.participant').length, 1);
});

test('private release keeps companion subscription delivery disabled outside business transactions', async () => {
  const initialState = cloudAppService.__private.createInitialState();
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: initialState
  }, async () => (
    cloudAppService.recordCompanionView({
      authContext: { openid: 'demo_openid_sponsor' },
      viewType: 'history',
      clientRequestId: 'subscription-disabled-view'
    })
  ));
  const state = scoped.values[cloudAppService.__private.DB_KEY];
  const notice = scoped.result;

  const previousTemplateId = process.env.COMPANION_VIEW_TEMPLATE_ID;
  process.env.COMPANION_VIEW_TEMPLATE_ID = 'configured-but-disabled';
  try {
    const result = await cloudFunction.__private.trySendCompanionViewSubscription(state, notice);
    assert.equal(result.subscriptionStatus, 'not_configured');
    assert.equal(state.companionViewNotices.find((item) => item.id === notice.id).subscriptionStatus, 'not_configured');
  } finally {
    if (previousTemplateId === undefined) delete process.env.COMPANION_VIEW_TEMPLATE_ID;
    else process.env.COMPANION_VIEW_TEMPLATE_ID = previousTemplateId;
  }
});

test('cloud mutations commit state and only changed projections in one transaction', async () => {
  const initialState = cloudAppService.__private.createInitialState();
  const fake = createFakeTransactionalDb(initialState);
  cloudAppService.__private.setNowForTests('2026-07-14T04:00:00.000Z');

  await cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
    cloudAppService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      authContext: { openid: 'demo_openid_participant' },
      clientRequestId: 'transaction-submit-one',
      photoFileId: 'local-transaction-photo.jpg'
    })
  ));

  const setPaths = fake.operations.filter((item) => item.type === 'set').map((item) => item.path);
  assert.equal(fake.transactionCalls(), 1);
  assert.equal(setPaths.includes('appStates/main'), true);
  assert.equal(setPaths.some((path) => path.startsWith('checkIns/')), true);
  assert.equal(setPaths.some((path) => path.startsWith('auditLogs/')), true);
  assert.equal(setPaths.some((path) => path.startsWith('users/')), false);
  assert.equal(setPaths.some((path) => path.startsWith('relationships/')), false);
});

test('concurrent check-in approvals preserve both rewards and reviews', async () => {
  let state = cloudAppService.__private.createInitialState();
  state = await prepareCloudState(state, async () => {
    cloudAppService.__private.setNowForTests('2026-07-14T04:00:00.000Z');
    const first = cloudAppService.submitCheckIn({
      authContext: { openid: 'demo_openid_participant' },
      photoFileId: 'local-concurrent-approval-one.jpg',
      clientRequestId: 'prepare-approval-one'
    });
    cloudAppService.__private.setNowForTests('2026-07-15T04:00:00.000Z');
    const second = cloudAppService.submitCheckIn({
      authContext: { openid: 'demo_openid_participant' },
      photoFileId: 'local-concurrent-approval-two.jpg',
      clientRequestId: 'prepare-approval-two'
    });
    return { first, second };
  });
  const pendingIds = state.checkIns.map((item) => item.id);
  const fake = createFakeTransactionalDb(state);

  await Promise.all(pendingIds.map((checkInId, index) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
      cloudAppService.approveCheckIn({
        checkInId,
        praise: '并发审核也要稳稳记住',
        clientRequestId: `concurrent-approval-${index}`,
        authContext: { openid: 'demo_openid_sponsor' }
      })
    ))
  )));

  const stored = fake.documents.get('appStates/main').state;
  const rewardLedgers = stored.ledgers.filter((item) => item.type === 'checkin_reward');
  assert.equal(stored.checkIns.filter((item) => item.status === 'approved').length, 2);
  assert.equal(rewardLedgers.length, 2);
  assert.equal(stored.relationships[0].balance.availableCents, rewardLedgers.reduce((sum, item) => sum + item.amountCents, 0));
});

test('concurrent withdrawals preserve both frozen amounts', async () => {
  const state = cloudAppService.__private.createInitialState();
  state.relationships[0].balance.availableCents = 3000;
  const fake = createFakeTransactionalDb(state);

  await Promise.all([500, 700].map((amountCents, index) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
      cloudAppService.requestWithdrawal({
        amountCents,
        note: '并发领取测试',
        clientRequestId: `concurrent-withdrawal-${index}`,
        authContext: { openid: 'demo_openid_participant' }
      })
    ))
  )));

  const stored = fake.documents.get('appStates/main').state;
  assert.equal(stored.withdrawals.length, 2);
  assert.equal(stored.relationships[0].balance.availableCents, 1800);
  assert.equal(stored.relationships[0].balance.frozenCents, 1200);
});

test('concurrent reward redemptions preserve both deductions', async () => {
  const state = cloudAppService.__private.createInitialState();
  state.relationships[0].balance.availableCents = 10000;
  const fake = createFakeTransactionalDb(state);
  const rewardIds = ['reward-milk-tea', 'reward-massage'];

  await Promise.all(rewardIds.map((rewardId, index) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
      cloudAppService.redeemReward({
        rewardId,
        clientRequestId: `concurrent-redemption-${index}`,
        authContext: { openid: 'demo_openid_participant' }
      })
    ))
  )));

  const stored = fake.documents.get('appStates/main').state;
  assert.equal(stored.redemptions.length, 2);
  assert.equal(stored.relationships[0].balance.availableCents, 5500);
  assert.equal(stored.ledgers.filter((item) => item.type === 'redemption').length, 2);
});

test('concurrent cancellation approvals preserve both refunds', async () => {
  let state = cloudAppService.__private.createInitialState();
  state.relationships[0].balance.availableCents = 10000;
  state = await prepareCloudState(state, async () => {
    const redemptions = ['reward-milk-tea', 'reward-massage'].map((rewardId, index) => (
      cloudAppService.redeemReward({
        rewardId,
        clientRequestId: `prepare-refund-redemption-${index}`,
        authContext: { openid: 'demo_openid_participant' }
      })
    ));
    redemptions.forEach((redemption, index) => {
      cloudAppService.requestCancelRedemption({
        redemptionId: redemption.id,
        reason: '并发退款测试',
        clientRequestId: `prepare-refund-request-${index}`,
        authContext: { openid: 'demo_openid_participant' }
      });
    });
  });
  const redemptionIds = state.redemptions.map((item) => item.id);
  const fake = createFakeTransactionalDb(state);

  await Promise.all(redemptionIds.map((redemptionId, index) => (
    cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
      cloudAppService.approveCancelRedemption({
        redemptionId,
        note: '并发退款仍只返还一次',
        confirmed: true,
        clientRequestId: `concurrent-refund-${index}`,
        authContext: { openid: 'demo_openid_sponsor' }
      })
    ))
  )));

  const stored = fake.documents.get('appStates/main').state;
  assert.equal(stored.redemptions.filter((item) => item.status === 'cancelled_refunded').length, 2);
  assert.equal(stored.relationships[0].balance.availableCents, 10000);
  assert.equal(stored.ledgers.filter((item) => item.type === 'redemption_refund').length, 2);
});

test('cloud reward deletion removes its derived projection inside the transaction', async () => {
  const initialState = cloudAppService.__private.createInitialState();
  const fake = createFakeTransactionalDb(initialState);

  await cloudFunction.__private.runStateMutationTransaction(fake.db, async () => (
    cloudAppService.deleteRewardItem({
      relationshipId: DEMO_IDS.relationship,
      rewardId: 'reward-milk-tea',
      confirmed: true,
      note: '验收删除未兑换测试奖励',
      clientRequestId: 'transaction-delete-reward-one',
      authContext: { openid: 'demo_openid_sponsor' }
    })
  ));

  const removedPaths = fake.operations.filter((item) => item.type === 'remove').map((item) => item.path);
  assert.deepEqual(removedPaths, ['rewardItems/reward-milk-tea']);
});

test('cloud query runner reads normally while mutation runner opens a transaction', async () => {
  const initialState = cloudAppService.__private.createInitialState();
  const fake = createFakeTransactionalDb(initialState);
  const event = { __testOpenid: 'demo_openid_participant' };

  const queryResult = await cloudFunction.__private.runWithCloudState(
    event,
    async (state) => state.version,
    { db: fake.db, mutation: false }
  );
  assert.equal(queryResult, 4);
  assert.equal(fake.transactionCalls(), 0);

  const mutationResult = await cloudFunction.__private.runWithCloudState(
    event,
    async () => 'mutated',
    { db: fake.db, mutation: true }
  );
  assert.equal(mutationResult, 'mutated');
  assert.equal(fake.transactionCalls(), 1);
});

test('cloud action classification keeps pure reads outside transactions', () => {
  [
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
  ].forEach((action) => {
    assert.equal(cloudFunction.__private.isMutationAction(action, {}), false, action);
  });
  assert.equal(cloudFunction.__private.isMutationAction('queryCompanionDetail', { recordView: false }), false);
  assert.equal(cloudFunction.__private.isMutationAction('queryCompanionDetail', {}), true);
  assert.equal(cloudFunction.__private.isMutationAction('submitCheckIn', {}), true);
  assert.equal(cloudFunction.__private.isMutationAction('reviewCheckIn', {}), true);
  assert.equal(cloudFunction.__private.isMutationAction('sendEncouragement', {}), true);
  assert.equal(cloudFunction.__private.isMutationAction('markEncouragementRead', {}), true);
  assert.equal(cloudFunction.__private.isMutationAction('markMilestoneSeen', {}), true);
});

test('editing a deactivated reward does not silently reactivate it', () => {
  appService.resetDemo();
  appService.toggleRewardItem({
    rewardId: 'reward-milk-tea',
    isActive: false,
    authContext: { openid: 'demo_openid_sponsor' }
  });

  const updated = appService.saveRewardItem({
    id: 'reward-milk-tea',
    name: '暖心奶茶约会',
    description: '一起慢慢喝杯热奶茶。',
    priceCents: 1200,
    stock: -1,
    authContext: { openid: 'demo_openid_sponsor' }
  });

  assert.equal(updated.isActive, false);
});

test('state migration preserves approval encouragements and normalizes shared milestone fields', () => {
  const legacy = appService.__private.createInitialState();
  legacy.encouragementCards.push({
    id: 'legacy-approval-card',
    relationshipId: DEMO_IDS.relationship,
    checkInId: 'legacy-checkin',
    title: '旧夸夸卡',
    message: '以前的鼓励也要好好保留。',
    createdAt: '2026-07-01T04:00:00.000Z'
  });
  legacy.surpriseCards.push({
    id: 'legacy-surprise-card',
    relationshipId: DEMO_IDS.relationship,
    type: 'letter',
    title: '旧情话卡',
    message: '你慢慢来，我一直在。',
    createdAt: '2026-07-01T04:00:00.000Z'
  });

  appService.saveState(legacy);
  const migrated = appService.getState();
  const encouragement = migrated.encouragementCards[0];
  const milestone = migrated.surpriseCards[0];

  assert.equal(encouragement.kind, 'approval');
  assert.equal(encouragement.senderUserId, DEMO_IDS.sponsor);
  assert.equal(encouragement.recipientUserId, DEMO_IDS.participant);
  assert.equal(encouragement.readAt, null);
  assert.equal(milestone.sceneKey, 'checkin_surprise');
  assert.deepEqual(milestone.seenByUserIds, []);
});

test('sponsor encouragement validates templates and text, dedupes retries, and is readable only by its recipient', () => {
  appService.resetDemo();
  appService.__private.setNowForTests('2026-07-10T04:00:00.000Z');

  assert.throws(() => appService.sendEncouragement({
    templateKey: 'hug',
    authContext: { openid: 'demo_openid_participant' }
  }), /赞助者|男朋友/);
  assert.throws(() => appService.sendEncouragement({
    templateKey: 'unknown-template',
    authContext: { openid: 'demo_openid_sponsor' }
  }), /鼓励模板/);
  assert.throws(() => appService.sendEncouragement({
    templateKey: 'hug',
    customMessage: '爱'.repeat(61),
    authContext: { openid: 'demo_openid_sponsor' }
  }), /60/);

  const input = {
    templateKey: 'hug',
    customMessage: '今天不追求完美，完成一点点也值得抱抱。',
    clientRequestId: 'encouragement-hug-one',
    authContext: { openid: 'demo_openid_sponsor' }
  };
  const sent = appService.sendEncouragement(input);
  const replay = appService.sendEncouragement(input);
  const participantCards = appService.queryEncouragements({
    authContext: { openid: 'demo_openid_participant' }
  });
  const sponsorCards = appService.queryEncouragements({
    authContext: { openid: 'demo_openid_sponsor' }
  });

  assert.equal(sent.kind, 'manual');
  assert.equal(sent.templateKey, 'hug');
  assert.equal(sent.senderUserId, DEMO_IDS.sponsor);
  assert.equal(sent.recipientUserId, DEMO_IDS.participant);
  assert.equal(sent.readAt, null);
  assert.equal(replay.deduped, true);
  assert.equal(replay.targetId, sent.id);
  assert.equal(participantCards.length, 1);
  assert.equal(sponsorCards.length, 1);

  assert.throws(() => appService.markEncouragementRead({
    encouragementId: sent.id,
    clientRequestId: 'encouragement-read-wrong-role',
    authContext: { openid: 'demo_openid_sponsor' }
  }), /收件人|女朋友/);

  const read = appService.markEncouragementRead({
    encouragementId: sent.id,
    clientRequestId: 'encouragement-read-one',
    authContext: { openid: 'demo_openid_participant' }
  });
  assert.ok(read.readAt);
  assert.equal(appService.queryEncouragements({
    unreadOnly: true,
    authContext: { openid: 'demo_openid_participant' }
  }).length, 0);
});

test('shared milestones pick the highest-priority animation and remain unseen independently for both partners', () => {
  const state = appService.__private.createInitialState();
  state.adventureLevels[0].requiredSteps = 1;
  state.meta.adventureLevelsCustomized = true;
  appService.saveState(state);
  appService.__private.setNowForTests('2026-07-10T04:00:00.000Z');

  const checkIn = appService.submitCheckIn({
    photoFileId: 'local-test-photo.jpg',
    clientRequestId: 'milestone-submit-one',
    authContext: { openid: 'demo_openid_participant' }
  });
  const approval = appService.approveCheckIn({
    checkInId: checkIn.id,
    praise: '第一步和第一关都值得认真庆祝。',
    clientRequestId: 'milestone-approval-one',
    authContext: { openid: 'demo_openid_sponsor' }
  });

  assert.equal(approval.primaryMilestone.sceneKey, 'map_level_complete');
  const participantMilestones = appService.queryMilestones({
    unseenOnly: true,
    authContext: { openid: 'demo_openid_participant' }
  });
  const sponsorMilestones = appService.queryMilestones({
    unseenOnly: true,
    authContext: { openid: 'demo_openid_sponsor' }
  });
  assert.ok(participantMilestones.some((item) => item.sceneKey === 'first_checkin'));
  assert.ok(participantMilestones.some((item) => item.sceneKey === 'map_level_complete'));
  assert.equal(participantMilestones.length, sponsorMilestones.length);
  participantMilestones.forEach((item) => assert.deepEqual(item.seenByUserIds, []));

  const first = participantMilestones[0];
  appService.markMilestoneSeen({
    milestoneId: first.id,
    clientRequestId: 'milestone-seen-participant-one',
    authContext: { openid: 'demo_openid_participant' }
  });
  assert.equal(appService.queryMilestones({
    unseenOnly: true,
    authContext: { openid: 'demo_openid_participant' }
  }).some((item) => item.id === first.id), false);
  assert.equal(appService.queryMilestones({
    unseenOnly: true,
    authContext: { openid: 'demo_openid_sponsor' }
  }).some((item) => item.id === first.id), true);
});

test('weekly recap uses China Monday-to-Sunday ranges and summarizes relationship activity without photos', () => {
  const state = appService.__private.createInitialState();
  state.checkIns.push(
    {
      id: 'recap-checkin-one',
      relationshipId: DEMO_IDS.relationship,
      status: 'approved',
      dateKey: '2026-07-07',
      occurredAt: '2026-07-07T04:00:00.000Z',
      durationMinutes: 30,
      rewardCents: 500,
      sunshine: 12,
      streak: 1,
      photoFileId: 'private-photo-one'
    },
    {
      id: 'recap-checkin-two',
      relationshipId: DEMO_IDS.relationship,
      status: 'approved',
      dateKey: '2026-07-09',
      occurredAt: '2026-07-09T04:00:00.000Z',
      durationMinutes: 45,
      rewardCents: 800,
      sunshine: 18,
      streak: 2,
      completedLevelId: 'level-1',
      photoFileId: 'private-photo-two'
    }
  );
  state.badgeUnlocks.push({
    id: 'recap-badge-one',
    relationshipId: DEMO_IDS.relationship,
    badgeId: 'first_checkin',
    badgeName: '第一步',
    unlockedAt: '2026-07-08T04:00:00.000Z'
  });
  state.redemptions.push({
    id: 'recap-redemption-one',
    relationshipId: DEMO_IDS.relationship,
    costCents: 600,
    redeemedAt: '2026-07-10T04:00:00.000Z'
  });
  state.encouragementCards.push({
    id: 'recap-encouragement-one',
    relationshipId: DEMO_IDS.relationship,
    kind: 'manual',
    senderUserId: DEMO_IDS.sponsor,
    recipientUserId: DEMO_IDS.participant,
    title: '抱抱',
    message: '今天也辛苦啦。',
    createdAt: '2026-07-11T04:00:00.000Z'
  });
  appService.saveState(state);
  appService.__private.setNowForTests('2026-07-10T04:00:00.000Z');

  const participantRecap = appService.queryWeeklyRecap({
    weekOffset: 0,
    authContext: { openid: 'demo_openid_participant' }
  });
  const sponsorRecap = appService.queryWeeklyRecap({
    weekOffset: 0,
    authContext: { openid: 'demo_openid_sponsor' }
  });

  assert.equal(participantRecap.startDateKey, '2026-07-06');
  assert.equal(participantRecap.endDateKey, '2026-07-12');
  assert.equal(participantRecap.stats.approvedDays, 2);
  assert.deepEqual(participantRecap.activityDays, ['2026-07-07', '2026-07-09']);
  assert.equal(participantRecap.stats.durationMinutes, 75);
  assert.equal(participantRecap.stats.cashRewardCents, 1300);
  assert.equal(participantRecap.stats.sunshine, 30);
  assert.equal(participantRecap.stats.badges, 1);
  assert.equal(participantRecap.stats.mapSteps, 2);
  assert.equal(participantRecap.stats.completedLevels, 1);
  assert.equal(participantRecap.stats.redemptions, 1);
  assert.equal(participantRecap.stats.encouragementsReceived, 1);
  assert.equal(participantRecap.bestMoment.sceneKey, 'map_level_complete');
  assert.equal(JSON.stringify(participantRecap).includes('private-photo'), false);
  assert.deepEqual(sponsorRecap.stats, participantRecap.stats);
  assert.notEqual(sponsorRecap.headline, participantRecap.headline);

  const empty = appService.queryWeeklyRecap({
    weekOffset: -1,
    authContext: { openid: 'demo_openid_participant' }
  });
  assert.equal(empty.isEmpty, true);
  assert.match(empty.bestMoment.message, /慢慢来|陪着|休息/);
  assert.throws(() => appService.queryWeeklyRecap({
    weekOffset: 1,
    authContext: { openid: 'demo_openid_participant' }
  }), /0.*-12|-12.*0/);
  assert.throws(() => appService.queryWeeklyRecap({
    weekOffset: -13,
    authContext: { openid: 'demo_openid_participant' }
  }), /0.*-12|-12.*0/);
});
