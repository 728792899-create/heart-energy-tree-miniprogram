const assert = require('node:assert/strict');
const test = require('node:test');

const { DEMO_IDS, LEDGER_STATUS, REDEMPTION_STATUS, WITHDRAWAL_STATUS } = require('../miniprogram/core/models');
const api = require('../miniprogram/services/api');
const appService = require('../miniprogram/services/appService');
const storage = require('../miniprogram/services/storage');
const cloudFunction = require('../cloudfunctions/energyTree/index');
const cloudAppService = require('../cloudfunctions/energyTree/miniprogram/services/appService');
const cloudStorage = require('../cloudfunctions/energyTree/miniprogram/services/storage');
const { addDays, todayKey } = require('../miniprogram/utils/date');

const PARTICIPANT_AUTH = { authContext: { openid: 'demo_openid_participant' } };
const SPONSOR_AUTH = { authContext: { openid: 'demo_openid_sponsor' } };

function setTestDate(dateKey) {
  appService.__private.setNowForTests(`${dateKey}T04:00:00.000Z`);
}

function approveDemo(dateKey, extra = {}) {
  setTestDate(dateKey);
  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: `photo-${dateKey}.jpg`,
    ...extra
  });
  return appService.approveCheckIn({
    checkInId: checkIn.id,
    ...SPONSOR_AUTH,
    praise: '看见你的努力啦'
  });
}

test('submits one check-in per day and approval is the only balance entry point', () => {
  appService.resetDemo();
  setTestDate('2026-07-01');

  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'today.jpg',
    rewardCents: 999999
  });

  assert.equal(checkIn.status, 'submitted');
  assert.throws(() => {
    appService.submitCheckIn({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      photoFileId: 'duplicate.jpg'
    });
  }, /已经提交/);

  const before = appService.getState().relationships[0].balance.availableCents;
  assert.equal(before, 0);

  const result = appService.approveCheckIn({
    checkInId: checkIn.id,
    ...SPONSOR_AUTH
  });
  const state = appService.getState();

  assert.equal(result.ledger.amountCents, 500);
  assert.equal(state.relationships[0].balance.availableCents, 500);
  assert.equal(state.relationships[0].tree.sunshine, 12);
});

test('duplicate review cannot add balance twice', () => {
  appService.resetDemo();
  const result = approveDemo('2026-07-01');

  assert.throws(() => {
    appService.approveCheckIn({
      checkInId: result.checkIn.id,
      ...SPONSOR_AUTH
    });
  }, /已经审核/);

  const state = appService.getState();
  assert.equal(state.relationships[0].balance.availableCents, 500);
  assert.equal(state.ledgers.length, 1);
});

test('streak rewards add deterministic surprises and optional bonus money', () => {
  appService.resetDemo();
  const dates = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'];
  let last;
  dates.forEach((date) => {
    last = approveDemo(date);
  });

  const state = appService.getState();
  const rel = state.relationships[0];

  assert.equal(last.approval.streak, 7);
  assert.equal(last.approval.streakBonus.surpriseTitle, '约会基金加码');
  assert.equal(rel.tree.streak, 7);
  assert.equal(rel.tree.lastCard.surpriseTitle, '约会基金加码');
  assert.equal(rel.balance.availableCents, 3500);
  assert.equal(rel.adventure.completedLevelIds.includes('level-1'), true);
  assert.equal(state.badgeUnlocks.some((item) => item.badgeId === 'first_level'), true);
  assert.equal(state.badgeUnlocks.some((item) => item.badgeId === 'streak_7'), true);
});

test('withdrawal freezes balance, then manual payout marks paid ledger', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');

  const request = appService.requestWithdrawal({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    amountCents: 500,
    note: '领取一次'
  });
  let state = appService.getState();
  assert.equal(request.status, WITHDRAWAL_STATUS.PENDING_REVIEW);
  assert.equal(state.relationships[0].balance.availableCents, 0);
  assert.equal(state.relationships[0].balance.frozenCents, 500);

  appService.approveWithdrawal({
    withdrawalId: request.id,
    ...SPONSOR_AUTH
  });
  appService.markWithdrawalPaid({
    withdrawalId: request.id,
    ...SPONSOR_AUTH,
    transferNote: '微信已转',
    confirmed: true
  });

  state = appService.getState();
  const withdrawal = state.withdrawals[0];
  const ledger = state.ledgers.find((item) => item.sourceId === request.id);
  assert.equal(withdrawal.status, WITHDRAWAL_STATUS.PAID);
  assert.equal(ledger.status, LEDGER_STATUS.PAID_OUT);
  assert.equal(state.relationships[0].balance.frozenCents, 0);
  assert.equal(state.relationships[0].balance.paidOutCents, 500);
});

test('withdrawal rejection returns frozen balance', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');

  const request = appService.requestWithdrawal({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    amountCents: 300
  });
  appService.rejectWithdrawal({
    withdrawalId: request.id,
    ...SPONSOR_AUTH,
    reason: '先留在小树里',
    confirmed: true
  });

  const state = appService.getState();
  assert.equal(state.withdrawals[0].status, WITHDRAWAL_STATUS.REJECTED);
  assert.equal(state.relationships[0].balance.availableCents, 500);
  assert.equal(state.relationships[0].balance.frozenCents, 0);
});

test('relationships keep balances and check-ins isolated', () => {
  appService.resetDemo();
  const second = appService.createRelationship({
    title: '朋友的能量树',
    sponsorName: '赞助者二号',
    participantName: '打卡者二号'
  });

  approveDemo('2026-07-01');
  const secondCheckIn = appService.submitCheckIn({
    relationshipId: second.id,
    authContext: { openid: second.participantOpenid },
    photoFileId: 'second.jpg'
  });
  appService.approveCheckIn({
    checkInId: secondCheckIn.id,
    authContext: { openid: second.sponsorOpenid }
  });

  const state = appService.getState();
  const main = state.relationships.find((item) => item.id === DEMO_IDS.relationship);
  const isolated = state.relationships.find((item) => item.id === second.id);

  assert.equal(main.balance.availableCents, 500);
  assert.equal(isolated.balance.availableCents, 500);
  assert.equal(state.checkIns.filter((item) => item.relationshipId === main.id).length, 1);
  assert.equal(state.checkIns.filter((item) => item.relationshipId === isolated.id).length, 1);
});

test('cannot withdraw more than available balance', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');

  assert.throws(() => {
    appService.requestWithdrawal({
      relationshipId: DEMO_IDS.relationship,
      ...PARTICIPANT_AUTH,
      amountCents: 501
    });
  }, /心愿金不足/);
});

test('rejected check-in can be resubmitted on the same day without balance changes', () => {
  appService.resetDemo();
  setTestDate('2026-07-02');
  const first = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'unclear.jpg'
  });
  appService.rejectCheckIn({
    checkInId: first.id,
    ...SPONSOR_AUTH,
    reason: '换一张更清楚的照片'
  });

  const second = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'clear.jpg'
  });
  const result = appService.approveCheckIn({
    checkInId: second.id,
    ...SPONSOR_AUTH
  });

  const state = appService.getState();
  assert.equal(result.ledger.amountCents, 500);
  assert.equal(state.relationships[0].balance.availableCents, 500);
  assert.equal(state.checkIns.filter((item) => item.dateKey === '2026-07-02').length, 2);
});

test('reward shop redemption deducts available coins and sponsor verifies once', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');
  approveDemo('2026-07-02');
  approveDemo('2026-07-03');

  const redemption = appService.redeemReward({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    rewardId: 'reward-milk-tea'
  });
  let state = appService.getState();
  const ledger = state.ledgers.find((item) => item.sourceId === redemption.id);

  assert.equal(redemption.status, REDEMPTION_STATUS.PENDING);
  assert.equal(ledger.status, LEDGER_STATUS.REDEEMED);
  assert.equal(state.relationships[0].balance.availableCents, 0);

  const verified = appService.verifyRedemption({
    redemptionId: redemption.id,
    ...SPONSOR_AUTH,
    note: '奶茶已经买啦',
    confirmed: true
  });
  assert.equal(verified.status, REDEMPTION_STATUS.USED);
  assert.throws(() => {
    appService.verifyRedemption({
      redemptionId: redemption.id,
      ...SPONSOR_AUTH,
      note: '重复核销',
      confirmed: true
    });
  }, /已经处理/);
});

test('sponsor can edit and safely delete reward items', () => {
  appService.resetDemo();
  const item = appService.saveRewardItem({
    ...SPONSOR_AUTH,
    name: '新电影券',
    description: '一起看一场她想看的电影。',
    priceCents: 1000,
    category: 'date',
    imageFileId: 'cloud://reward.png',
    stock: -1
  });
  assert.equal(item.imageFileId, 'cloud://reward.png');

  const deleted = appService.deleteRewardItem({
    ...SPONSOR_AUTH,
    rewardId: item.id,
    confirmed: true
  });
  assert.equal(deleted.deleted, true);

  approveDemo('2026-07-20');
  approveDemo('2026-07-21');
  approveDemo('2026-07-22');
  const redemption = appService.redeemReward({
    ...PARTICIPANT_AUTH,
    rewardId: 'reward-milk-tea'
  });
  const deactivated = appService.deleteRewardItem({
    ...SPONSOR_AUTH,
    rewardId: redemption.rewardId,
    confirmed: true
  });
  assert.equal(deactivated.deactivated, true);
  assert.equal(appService.getState().rewardItems.find((reward) => reward.id === redemption.rewardId).isActive, false);
});

test('login exposes pseudo openid and monthly wish fund progress', () => {
  appService.resetDemo();
  const login = appService.login({ role: 'participant' });
  assert.equal(login.openid, 'demo_openid_participant');

  appService.updateRewardRule({
    relationshipId: DEMO_IDS.relationship,
    ...SPONSOR_AUTH,
    rule: {
      monthlyWishFundCents: 1000
    }
  });
  approveDemo(todayKey());

  const dashboard = appService.getDashboard(PARTICIPANT_AUTH);
  assert.equal(dashboard.relationship.wishFund.targetCents, 1000);
  assert.equal(dashboard.relationship.wishFund.earnedCents, 500);
  assert.equal(dashboard.relationship.wishFund.progressPercent, 50);
});

test('api facade supports review and manual payout flow', () => {
  api.resetDemo();
  setTestDate('2026-07-08');
  const dashboard = api.queryDashboard();
  const checkIn = api.uploadCheckIn({
    relationshipId: dashboard.relationship.id,
    photoFileId: 'api.jpg'
  });
  api.switchRole('sponsor');
  const approval = api.reviewCheckIn({
    checkInId: checkIn.id,
    decision: 'approved',
    note: 'API 门面通过审核'
  });

  assert.equal(api.formatMoney(approval.ledger.amountCents), '5.00');

  api.switchRole('participant');
  const withdrawal = api.requestWithdrawal({
    relationshipId: dashboard.relationship.id,
    amountCents: api.centsFromYuan('5')
  });
  api.switchRole('sponsor');
  api.processWithdrawal({ withdrawalId: withdrawal.id, action: 'approve' });
  const paid = api.processWithdrawal({
    withdrawalId: withdrawal.id,
    action: 'mark_paid',
    note: '手动转账完成',
    confirmed: true
  });

  assert.equal(paid.status, WITHDRAWAL_STATUS.PAID);
});

test('permission boundaries reject spoofed high-risk operations', () => {
  appService.resetDemo();
  setTestDate('2026-07-09');
  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'permission.jpg'
  });

  assert.throws(() => {
    appService.approveCheckIn({
      checkInId: checkIn.id,
      ...PARTICIPANT_AUTH
    });
  }, /只有赞助者/);

  assert.throws(() => {
    appService.requestWithdrawal({
      relationshipId: DEMO_IDS.relationship,
      ...SPONSOR_AUTH,
      amountCents: 100
    });
  }, /只有打卡者/);
});

test('final adventure level reward is paid only once', () => {
  appService.resetDemo();
  let last;
  for (let index = 0; index < 76; index += 1) {
    last = approveDemo(addDays('2026-08-01', index));
  }

  const state = appService.getState();
  const rel = state.relationships[0];
  assert.equal(rel.adventure.completedLevelIds.includes('level-5'), true);
  assert.equal(Boolean(rel.adventure.completedAt), true);
  assert.equal(rel.adventure.postCompletionSteps, 31);
  assert.equal(last.ledger.levelRewardCents, 0);
});

test('sponsor can tune adventure levels within 45 total days', () => {
  appService.resetDemo();
  assert.throws(() => {
    appService.updateAdventureLevels({
      ...SPONSOR_AUTH,
      levels: [
        { id: 'level-1', requiredSteps: 20, rewardCents: 500 },
        { id: 'level-2', requiredSteps: 20, rewardCents: 500 },
        { id: 'level-3', requiredSteps: 20, rewardCents: 500 }
      ]
    });
  }, /总天数不能超过 45/);

  const result = appService.updateAdventureLevels({
    ...SPONSOR_AUTH,
    levels: [
      { id: 'level-1', requiredSteps: 6, rewardCents: 600 },
      { id: 'level-2', requiredSteps: 7, rewardCents: 700 },
      { id: 'level-3', requiredSteps: 8, rewardCents: 800 },
      { id: 'level-4', requiredSteps: 9, rewardCents: 900 },
      { id: 'level-5', requiredSteps: 10, rewardCents: 1000 }
    ]
  });

  assert.equal(result.levels.reduce((sum, item) => sum + item.requiredSteps, 0), 40);
  assert.equal(result.levels.find((item) => item.id === 'level-1').rewardCents, 600);
});

test('high-risk actions require confirmation and notes', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');
  const request = appService.requestWithdrawal({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    amountCents: 500
  });
  appService.approveWithdrawal({
    withdrawalId: request.id,
    ...SPONSOR_AUTH
  });

  assert.throws(() => {
    appService.markWithdrawalPaid({
      withdrawalId: request.id,
      ...SPONSOR_AUTH,
      transferNote: '微信已转'
    });
  }, /二次确认/);

  assert.throws(() => {
    appService.markWithdrawalPaid({
      withdrawalId: request.id,
      ...SPONSOR_AUTH,
      confirmed: true
    });
  }, /备注/);
});

test('amount validation rejects unsafe reward rules', () => {
  appService.resetDemo();
  assert.throws(() => {
    appService.updateRewardRule({
      relationshipId: DEMO_IDS.relationship,
      ...SPONSOR_AUTH,
      rule: {
        perCheckInCents: -1
      }
    });
  }, /单次打卡奖励/);

  assert.throws(() => {
    appService.updateRewardRule({
      relationshipId: DEMO_IDS.relationship,
      ...SPONSOR_AUTH,
      rule: {
        perCheckInCents: 500,
        dailyMaxCents: 100
      }
    });
  }, /每日现金上限不能低于/);
});

test('redemption cancellation requires participant request and sponsor approval', () => {
  appService.resetDemo();
  approveDemo('2026-07-01');
  approveDemo('2026-07-02');
  approveDemo('2026-07-03');

  const redemption = appService.redeemReward({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    rewardId: 'reward-milk-tea'
  });
  const requested = appService.requestCancelRedemption({
    redemptionId: redemption.id,
    ...PARTICIPANT_AUTH,
    reason: '先取消'
  });
  assert.equal(requested.status, REDEMPTION_STATUS.CANCEL_REQUESTED);

  assert.throws(() => {
    appService.approveCancelRedemption({
      redemptionId: redemption.id,
      ...SPONSOR_AUTH,
      note: '同意'
    });
  }, /二次确认/);

  const refunded = appService.approveCancelRedemption({
    redemptionId: redemption.id,
    ...SPONSOR_AUTH,
    note: '同意退款',
    confirmed: true
  });
  const state = appService.getState();
  assert.equal(refunded.status, REDEMPTION_STATUS.CANCELLED_REFUNDED);
  assert.equal(state.relationships[0].balance.availableCents, 1500);
  assert.equal(state.ledgers.some((item) => item.sourceId === redemption.id && item.status === LEDGER_STATUS.REFUNDED), true);
});

test('submit check-in accepts cloud storage file id', () => {
  appService.resetDemo();
  setTestDate('2026-07-10');
  const checkIn = appService.submitCheckIn({
    relationshipId: DEMO_IDS.relationship,
    ...PARTICIPANT_AUTH,
    photoFileId: 'cloud://env.relationships/rel-main/checkins/today.jpg'
  });

  assert.equal(checkIn.photoPath, 'cloud://env.relationships/rel-main/checkins/today.jpg');
  assert.equal(checkIn.photoFileId, 'cloud://env.relationships/rel-main/checkins/today.jpg');
});

test('cloud invite binding attaches trusted openid to one role', async () => {
  const state = cloudFunction.__private.createCloudInitialState();
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: state
  }, async () => {
    cloudFunction.__private.bindAsSponsor(state, {
      displayName: '我'
    }, 'openid_sponsor');
    const invite = cloudFunction.__private.generatePartnerInvite(state, {}, 'openid_sponsor');
    return cloudFunction.__private.bindByInvite(state, {
      inviteToken: invite.inviteToken,
      displayName: '她'
    }, 'openid_from_cloud');
  });

  const nextState = scoped.values[cloudAppService.__private.DB_KEY];
  const relationship = nextState.relationships[0];

  assert.equal(scoped.result.currentRole, 'participant');
  assert.equal(relationship.participantOpenid, 'openid_from_cloud');
  assert.equal(nextState.users.find((user) => user.id === relationship.participantId).name, '她');
});

test('cloud share invitation binds sponsor first and participant through token', async () => {
  const state = cloudFunction.__private.createCloudInitialState();
  const scoped = await cloudStorage.runWithScopedStorage({
    [cloudAppService.__private.DB_KEY]: state
  }, async () => {
    const sponsorDashboard = cloudFunction.__private.bindAsSponsor(state, {
      displayName: '我'
    }, 'openid_sponsor');
    const invite = cloudFunction.__private.generatePartnerInvite(state, {}, 'openid_sponsor');
    const participantDashboard = cloudFunction.__private.bindByInvite(state, {
      inviteToken: invite.inviteToken,
      displayName: '她'
    }, 'openid_participant');
    return { sponsorDashboard, invite, participantDashboard };
  });

  const nextState = scoped.values[cloudAppService.__private.DB_KEY];
  const relationship = nextState.relationships[0];

  assert.equal(scoped.result.sponsorDashboard.currentRole, 'sponsor');
  assert.equal(scoped.result.participantDashboard.currentRole, 'participant');
  assert.equal(relationship.sponsorOpenid, 'openid_sponsor');
  assert.equal(relationship.participantOpenid, 'openid_participant');
  assert.match(scoped.result.invite.path, /pages\/bind\/bind\?inviteRole=participant&inviteToken=/);
  assert.notEqual(relationship.inviteTokens.participant, scoped.result.invite.inviteToken);
});

test('profile edits use monthly free quota and participant extra edits cost coins', () => {
  appService.resetDemo();

  const firstName = appService.updateProfile({
    ...PARTICIPANT_AUTH,
    name: '小鹿今天动动'
  });
  assert.equal(firstName.costCents, 0);

  approveDemo('2026-07-11');
  const paidName = appService.updateProfile({
    ...PARTICIPANT_AUTH,
    name: '小鹿闪闪'
  });
  assert.equal(paidName.costCents, 200);

  const freeAvatar = appService.updateProfile({
    ...PARTICIPANT_AUTH,
    avatarFileId: 'cloud://avatar-a.png'
  });
  assert.equal(freeAvatar.costCents, 0);

  const paidAvatar = appService.updateProfile({
    ...PARTICIPANT_AUTH,
    avatarFileId: 'cloud://avatar-b.png'
  });
  const state = appService.getState();
  const feeLedgers = state.ledgers.filter((item) => item.type === 'profile_edit_fee');
  assert.equal(paidAvatar.costCents, 200);
  assert.equal(feeLedgers.length, 2);
  assert.equal(state.relationships[0].balance.availableCents, 100);
});

test('sponsor profile edits cannot buy extra monthly changes', () => {
  appService.resetDemo();
  appService.updateProfile({
    ...SPONSOR_AUTH,
    name: '认真兑现的男友'
  });

  assert.throws(() => {
    appService.updateProfile({
      ...SPONSOR_AUTH,
      name: '本月第二次改名'
    });
  }, /不能付费追加/);
});

test('participant can equip only unlocked badges and at most three', () => {
  appService.resetDemo();
  approveDemo('2026-07-12');

  const badges = appService.equipBadges({
    ...PARTICIPANT_AUTH,
    badgeIds: ['first_checkin']
  });
  assert.equal(badges.find((item) => item.id === 'first_checkin').equipped, true);

  assert.throws(() => {
    appService.equipBadges({
      ...SPONSOR_AUTH,
      badgeIds: ['first_checkin']
    });
  }, /只有打卡者/);

  assert.throws(() => {
    appService.equipBadges({
      ...PARTICIPANT_AUTH,
      badgeIds: ['summit_star']
    });
  }, /已经解锁/);
});

test('sponsor companion views create deduped participant notices', () => {
  appService.resetDemo();
  const first = appService.recordCompanionView({
    ...SPONSOR_AUTH,
    viewType: 'history'
  });
  const second = appService.recordCompanionView({
    ...SPONSOR_AUTH,
    viewType: 'history'
  });

  assert.equal(first.deduped, undefined);
  assert.equal(second.deduped, true);

  const unread = appService.listViewNotices({
    ...PARTICIPANT_AUTH,
    unreadOnly: true
  });
  assert.equal(unread.length, 1);
  assert.match(unread[0].message, /查看了你的打卡历史/);

  const marked = appService.markViewNoticesRead({
    ...PARTICIPANT_AUTH,
    noticeIds: [unread[0].id]
  });
  assert.equal(marked.count, 1);
  assert.equal(appService.listViewNotices({
    ...PARTICIPANT_AUTH,
    unreadOnly: true
  }).length, 0);
});
