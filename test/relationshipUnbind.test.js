const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appService = require('../miniprogram/services/appService');
const cloudFunction = require('../cloudfunctions/energyTree/index');

const PARTICIPANT_AUTH = { authContext: { openid: 'demo_openid_participant' } };
const SPONSOR_AUTH = { authContext: { openid: 'demo_openid_sponsor' } };

function projectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

function requestByParticipant(extra = {}) {
  return appService.requestRelationshipUnbind({
    ...PARTICIPANT_AUTH,
    confirmed: true,
    confirmedTwice: true,
    clientRequestId: 'request-unbind-participant',
    ...extra
  });
}

function createProjectionDb(seed) {
  const documents = new Map(Object.entries(seed || {}));
  const collection = (collectionName) => ({
    where(filters) {
      let queryLimit = Infinity;
      const query = {
        limit(value) {
          queryLimit = value;
          return query;
        },
        async get() {
          const prefix = `${collectionName}/`;
          const data = Array.from(documents.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => ({ ...value, _id: key.slice(prefix.length) }))
            .filter((item) => Object.entries(filters).every(([key, value]) => item[key] === value))
            .slice(0, queryLimit);
          return { data };
        }
      };
      return query;
    },
    doc(id) {
      return {
        async update({ data }) {
          const key = `${collectionName}/${id}`;
          documents.set(key, { ...(documents.get(key) || {}), ...data });
        }
      };
    }
  });
  return {
    db: { collection },
    documents
  };
}

test('relationship unbind requires two explicit warnings and cannot be completed by one member', () => {
  appService.resetDemo();

  assert.throws(() => {
    appService.requestRelationshipUnbind({
      ...PARTICIPANT_AUTH,
      confirmed: true
    });
  }, /两次确认/);

  const requested = requestByParticipant();
  assert.equal(requested.state, 'waiting_for_partner');
  assert.equal(requested.requestedByMe, true);

  let state = appService.getState();
  assert.equal(state.relationships[0].lifecycleStatus, 'active');
  assert.equal(state.relationships[0].unbindRequest.status, 'pending');
  assert.equal(state.relationships[0].participantOpenid, 'demo_openid_participant');
  assert.equal(state.relationships[0].sponsorOpenid, 'demo_openid_sponsor');

  assert.throws(() => {
    appService.confirmRelationshipUnbind({
      ...PARTICIPANT_AUTH,
      confirmed: true,
      confirmedTwice: true
    });
  }, /另一方/);

  state = appService.getState();
  assert.equal(state.relationships[0].lifecycleStatus, 'active');
});

test('only the other member can complete unbind after repeating the two warnings', () => {
  appService.resetDemo();
  requestByParticipant();

  assert.throws(() => {
    appService.confirmRelationshipUnbind({
      ...SPONSOR_AUTH,
      confirmed: true
    });
  }, /两次确认/);

  const released = appService.confirmRelationshipUnbind({
    ...SPONSOR_AUTH,
    confirmed: true,
    confirmedTwice: true,
    clientRequestId: 'confirm-unbind-sponsor'
  });

  assert.equal(released.released, true);
  assert.equal(released.needsBinding, true);

  const state = appService.getState();
  const relationship = state.relationships[0];
  assert.equal(relationship.lifecycleStatus, 'frozen');
  assert.equal(relationship.sponsorOpenid, '');
  assert.equal(relationship.participantOpenid, '');
  assert.equal(state.users.find((user) => user.id === relationship.sponsorId).openid, '');
  assert.equal(state.users.find((user) => user.id === relationship.participantId).openid, '');
  assert.equal(relationship.unbindRequest.status, 'completed');
  assert.equal(relationship.inviteTokens && relationship.inviteTokens.participant, '');
  assert.ok(state.auditLogs.some((item) => item.action === 'relationship.unbind.request'));
  assert.ok(state.auditLogs.some((item) => item.action === 'relationship.unbind.complete'));
});

test('final confirmation remains idempotent after trusted identities are cleared', () => {
  appService.resetDemo();
  requestByParticipant();
  const confirmation = {
    ...SPONSOR_AUTH,
    confirmed: true,
    confirmedTwice: true,
    clientRequestId: 'confirm-after-openids-cleared'
  };

  const first = appService.confirmRelationshipUnbind(confirmation);
  const second = appService.confirmRelationshipUnbind(confirmation);

  assert.equal(first.released, true);
  assert.equal(second.deduped, true);
  assert.equal(second.action, 'relationship.unbind.confirm');
  const finalState = appService.getState();
  assert.equal(finalState.auditLogs.filter((item) => item.action === 'relationship.unbind.complete').length, 1);
  assert.ok(appService.__private.findOperationReceipt(finalState, 'relationship.unbind.confirm', confirmation));
});

test('requester can cancel a pending request and partner cannot cancel it', () => {
  appService.resetDemo();
  requestByParticipant();

  assert.throws(() => {
    appService.cancelRelationshipUnbind({
      ...SPONSOR_AUTH,
      clientRequestId: 'cancel-by-partner'
    });
  }, /发起方/);

  const cancelled = appService.cancelRelationshipUnbind({
    ...PARTICIPANT_AUTH,
    clientRequestId: 'cancel-by-requester'
  });
  assert.equal(cancelled.state, 'none');
  assert.equal(appService.getState().relationships[0].unbindRequest, null);
});

test('unsettled business blocks both requesting and final confirmation', () => {
  appService.resetDemo();
  appService.submitCheckIn({
    ...PARTICIPANT_AUTH,
    photoFileId: 'pending.jpg'
  });

  assert.throws(() => {
    requestByParticipant();
  }, /待处理事项/);

  const state = appService.getState();
  state.checkIns[0].status = 'approved';
  appService.saveState(state);
  requestByParticipant();

  const changed = appService.getState();
  changed.relationships[0].balance.frozenCents = 500;
  appService.saveState(changed);
  assert.throws(() => {
    appService.confirmRelationshipUnbind({
      ...SPONSOR_AUTH,
      confirmed: true,
      confirmedTwice: true,
      clientRequestId: 'blocked-confirm'
    });
  }, /待处理事项/);
});

test('a pending request cannot unilaterally lock the relationship and final confirmation rechecks blockers', () => {
  appService.resetDemo();
  requestByParticipant();

  const checkIn = appService.submitCheckIn({
    ...PARTICIPANT_AUTH,
    photoFileId: 'pending-after-request.jpg',
    clientRequestId: 'checkin-after-unbind-request'
  });
  assert.equal(checkIn.status, 'submitted');
  assert.equal(appService.getState().relationships[0].unbindRequest.status, 'pending');

  assert.throws(() => {
    appService.confirmRelationshipUnbind({
      ...SPONSOR_AUTH,
      confirmed: true,
      confirmedTwice: true,
      clientRequestId: 'confirm-with-new-blocker'
    });
  }, /待处理事项/);
  assert.equal(appService.getState().relationships[0].lifecycleStatus, 'active');

  const settled = appService.getState();
  settled.checkIns[0].status = 'approved';
  appService.saveState(settled);
  appService.__private.beginRelationshipUnbindConfirmation({
    ...SPONSOR_AUTH,
    confirmed: true,
    confirmedTwice: true
  });
  assert.throws(() => {
    appService.submitCheckIn({
      ...PARTICIPANT_AUTH,
      photoFileId: 'blocked-during-release.jpg',
      clientRequestId: 'blocked-during-release'
    });
  }, /安全收尾/);
  assert.throws(() => {
    cloudFunction.__private.resolveCoupleMessageContext(
      appService.getState(),
      'demo_openid_sponsor'
    );
  }, /信笺互动已暂停/);
});

test('dashboard exposes only actor-safe unbind status and hides internal request fields', () => {
  appService.resetDemo();
  requestByParticipant();

  const participant = appService.getDashboard(PARTICIPANT_AUTH);
  const sponsor = appService.getDashboard(SPONSOR_AUTH);

  assert.equal(participant.relationship.unbindStatus.state, 'waiting_for_partner');
  assert.equal(participant.relationship.unbindStatus.canCancel, true);
  assert.equal(participant.relationship.unbindStatus.canConfirm, false);
  assert.equal(sponsor.relationship.unbindStatus.state, 'action_required');
  assert.equal(sponsor.relationship.unbindStatus.canConfirm, true);
  assert.equal(sponsor.relationship.unbindStatus.canCancel, false);
  assert.equal(Object.hasOwn(participant.relationship, 'unbindRequest'), false);
  assert.equal(JSON.stringify(participant).includes('demo_openid_sponsor'), false);
});

test('cloud binding status prevents a frozen private relationship from being reused', () => {
  const state = cloudFunction.__private.createCloudInitialState();
  state.relationships[0].lifecycleStatus = 'frozen';
  state.relationships[0].sponsorOpenid = '';
  state.relationships[0].participantOpenid = '';

  const payload = cloudFunction.__private.bindingRequiredPayload(state);
  assert.equal(payload.needsBinding, true);
  assert.equal(payload.bindingStatus.relationshipFrozen, true);
  assert.equal(payload.bindingStatus.canCreateSponsor, false);
  assert.match(payload.message, /旧关系已冻结/);
  assert.throws(() => {
    cloudFunction.__private.bindAsSponsor(state, { displayName: '新用户' }, 'new-openid');
  }, /旧关系已冻结/);
});

test('cloud revokes both members direct inbox and unread-state access without deleting retained messages', async () => {
  const fake = createProjectionDb({
    'coupleMessageInbox/inbox-1': {
      relationshipId: 'rel-main',
      recipientOpenid: 'openid-a',
      content: '保留的信笺'
    },
    'coupleMessageInbox/inbox-2': {
      relationshipId: 'rel-main',
      recipientOpenid: 'openid-b',
      content: '另一份保留投影'
    },
    'coupleMessageStates/state-1': {
      relationshipId: 'rel-main',
      recipientOpenid: 'openid-a',
      unreadCount: 2
    },
    'coupleMessageInbox/other': {
      relationshipId: 'another-relationship',
      recipientOpenid: 'openid-a',
      content: '其他关系'
    }
  });

  const result = await cloudFunction.__private.revokeRelationshipRealtimeAccess(
    fake.db,
    'rel-main',
    ['openid-a', 'openid-b'],
    '2026-07-23T12:00:00.000Z'
  );

  assert.equal(result.updated, 3);
  assert.equal(fake.documents.get('coupleMessageInbox/inbox-1').recipientOpenid, '');
  assert.equal(fake.documents.get('coupleMessageInbox/inbox-1').content, '保留的信笺');
  assert.equal(fake.documents.get('coupleMessageInbox/inbox-2').recipientOpenid, '');
  assert.equal(fake.documents.get('coupleMessageStates/state-1').recipientOpenid, '');
  assert.equal(fake.documents.get('coupleMessageInbox/other').recipientOpenid, 'openid-a');
});

test('cloud refuses unbind while an asynchronous image safety check is pending', async () => {
  const fake = createProjectionDb({
    'mediaCheckTasks/task-1': {
      relationshipId: 'rel-main',
      status: 'pending'
    }
  });
  await assert.rejects(
    cloudFunction.__private.assertNoPendingMediaChecks(fake.db, 'rel-main'),
    /图片内容安全检查待完成/
  );
});

test('client and profile wire all unbind mutations with double warning UI and in-flight locks', () => {
  const api = projectFile('miniprogram/services/api.js');
  const profileScript = projectFile('miniprogram/pages/profile/profile.js');
  const profileMarkup = projectFile('miniprogram/pages/profile/profile.wxml');

  [
    'requestRelationshipUnbind',
    'cancelRelationshipUnbind',
    'confirmRelationshipUnbind'
  ].forEach((action) => {
    assert.match(api, new RegExp(`['"]${action}['"]`));
    assert.match(api, new RegExp(`function ${action}\\(`));
  });
  assert.match(profileScript, /async requestRelationshipUnbind\(\)/);
  assert.match(profileScript, /async confirmRelationshipUnbind\(\)/);
  assert.match(profileScript, /showRelationshipWarning[\s\S]*showRelationshipWarning/);
  assert.match(profileMarkup, /bindtap="requestRelationshipUnbind"/);
  assert.match(profileMarkup, /bindtap="confirmRelationshipUnbind"/);
  assert.match(profileMarkup, /disabled="\{\{unbindSubmitting\}\}"/);
  assert.match(profileMarkup, /aria-label="发起解除关系申请"/);
  assert.match(profileMarkup, /aria-label="确认解除关系"/);
});
