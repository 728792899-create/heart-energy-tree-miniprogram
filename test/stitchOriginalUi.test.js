const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('core pages implement the approved Stitch original screens with native mini-program UI', () => {
  const checkin = read('miniprogram/pages/checkin/checkin.wxml');
  const map = read('miniprogram/pages/adventure-map/adventure-map.wxml');
  const shop = read('miniprogram/pages/shop/shop.wxml');
  const profile = read('miniprogram/pages/profile/profile.wxml');
  const combined = [checkin, map, shop, profile].join('\n');

  assert.match(checkin, /class="checkin-bento/);
  assert.match(checkin, /\/assets\/stitch-original\/checkin-yoga\.jpg/);
  assert.match(checkin, /class="mood-strip/);

  assert.match(map, /class="map-scene stitch-map-route/);
  assert.match(map, /\/assets\/stitch-original\/map-hill\.jpg/);
  assert.match(map, /\/assets\/stitch-original\/map-couple\.jpg/);

  assert.match(shop, /class="shop-balance-card/);
  assert.match(shop, /\/assets\/stitch-original\/reward-massage\.jpg/);
  assert.match(shop, /\/assets\/stitch-original\/reward-dishes\.jpg/);
  assert.match(shop, /\/assets\/stitch-original\/reward-dinner\.jpg/);
  assert.match(shop, /class="reward-action/);

  assert.match(profile, /class="profile-cover/);
  assert.match(profile, /\/assets\/stitch-original\/profile-cover\.jpg/);
  assert.match(profile, /src="\{\{dashboard\.currentUser\.avatarSrc\}\}"/);
  assert.match(profile, /class="profile-couple-avatar-text"/);
  assert.match(profile, /class="profile-title-heart">与<\/text>/);
  assert.doesNotMatch(profile, /&amp;|profile-couple\.jpg/);
  assert.match(profile, /class="profile-bento-stats/);

  assert.doesNotMatch(combined, /视觉优化版/);
  assert.doesNotMatch(combined, /tailwind|className=|<div\b/i);
});


test('binding page follows the original first-day relationship hierarchy with native identity actions', () => {
  const binding = read('miniprogram/pages/bind/bind.wxml');
  const bindingScript = read('miniprogram/pages/bind/bind.js');
  const bindingStyles = read('miniprogram/pages/bind/bind.wxss');

  assert.match(binding, /class="relationship-opening-card/);
  assert.match(binding, /class="relationship-heart-seal/);
  assert.match(binding, /class="binding-form-card/);
  assert.match(binding, /class="binding-mode-badge/);
  assert.match(binding, /class="binding-step-grid/);
  assert.match(bindingScript, /api\.bindByInvite/);
  assert.match(bindingScript, /api\.bindAsSponsor/);
  assert.match(bindingStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.binding-step-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(binding, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(binding, /tailwind|className=|<div\b/i);
});


test('profile editor uses a compact native page hierarchy without stale preview whitespace or role spoofing', () => {
  const editor = read('miniprogram/pages/profile-edit/profile-edit.wxml');
  const editorScript = read('miniprogram/pages/profile-edit/profile-edit.js');
  const editorStyles = read('miniprogram/pages/profile-edit/profile-edit.wxss');

  assert.match(editor, /class="profile-edit-sheet/);
  assert.doesNotMatch(editor, /profile-edit-context|profile-edit-handle|profile-context-card/);
  assert.match(editor, /class="profile-avatar-editor/);
  assert.match(editor, /class="profile-role-display/);
  assert.match(editor, /class="profile-quota-panel/);
  assert.match(editorScript, /roleLabel/);
  assert.match(editorScript, /nicknameQuotaText/);
  assert.match(editorScript, /wx\.showModal/);
  assert.doesNotMatch(editor, /bindtap="[^"]*Role|bindchange="[^"]*Role/i);
  assert.doesNotMatch(editorStyles, /\.profile-edit-context|margin-top\s*:\s*-110rpx|min-height\s*:\s*360rpx/);
  assert.match(editorStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.profile-avatar-actions[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(editor, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(editor, /tailwind|className=|<div\b/i);
});


test('history uses the original single-footprint journal hierarchy with native record states', () => {
  const history = read('miniprogram/pages/history/history.wxml');
  const historyScript = read('miniprogram/pages/history/history.js');
  const historyStyles = read('miniprogram/pages/history/history.wxss');

  assert.match(history, /class="history-journal-header/);
  assert.match(history, /class="history-summary-grid/);
  assert.match(history, /class="history-entry-card/);
  assert.match(history, /class="history-status-badge/);
  assert.match(history, /class="history-empty-state/);
  assert.match(historyScript, /approvedCount/);
  assert.match(historyScript, /totalMinutes/);
  assert.match(historyScript, /totalRewardText/);
  assert.match(historyStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.history-summary-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(history, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(history, /tailwind|className=|<div\b/i);
});

test('weekly recap follows the approved original diary layout instead of an optimized variant', () => {
  const recap = read('miniprogram/pages/weekly-recap/weekly-recap.wxml');
  const recapStyles = read('miniprogram/pages/weekly-recap/weekly-recap.wxss');
  const recapScript = read('miniprogram/pages/weekly-recap/weekly-recap.js');

  assert.match(recap, /class="recap-summary-card/);
  assert.match(recap, /class="recap-metric-grid/);
  assert.match(recap, /class="recap-map-card/);
  assert.match(recap, /class="recap-activity-strip/);
  assert.match(recap, /class="recap-partner-quote/);
  assert.match(recap, /class="recap-next-goal/);
  assert.match(recap, /class="recap-footer-actions/);
  assert.match(recapScript, /activityDays/);
  assert.match(recapStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.recap-metric-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(recap, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(recap, /tailwind|className=|<div\b/i);
});

test('reward detail uses the original redemption confirmation hierarchy', () => {
  const detail = read('miniprogram/pages/reward-detail/reward-detail.wxml');
  const detailScript = read('miniprogram/pages/reward-detail/reward-detail.js');

  assert.match(detail, /class="redemption-confirm-card/);
  assert.match(detail, /class="confirm-reward-preview/);
  assert.match(detail, /class="confirm-balance-sheet/);
  assert.match(detail, /class="confirm-action-row/);
  assert.match(detailScript, /balanceAfterText/);
  assert.doesNotMatch(detail, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(detail, /tailwind|className=|<div\b/i);
});

test('redemption records use the original gift archive hierarchy and native actions', () => {
  const records = read('miniprogram/pages/redemptions/redemptions.wxml');
  const recordsScript = read('miniprogram/pages/redemptions/redemptions.js');
  const recordsStyles = read('miniprogram/pages/redemptions/redemptions.wxss');

  assert.match(records, /class="redemption-library-header/);
  assert.match(records, /class="redemption-voucher-card/);
  assert.match(records, /class="redemption-status-badge/);
  assert.match(records, /class="redemption-action-panel/);
  assert.match(recordsScript, /displayImageSrc/);
  assert.match(recordsScript, /statusTone/);
  assert.match(recordsStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.redemption-action-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(records, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(records, /tailwind|className=|<div\b/i);
});

test('wallet follows the original wish-fund task hierarchy with native withdrawal controls', () => {
  const wallet = read('miniprogram/pages/wallet/wallet.wxml');
  const walletScript = read('miniprogram/pages/wallet/wallet.js');
  const walletStyles = read('miniprogram/pages/wallet/wallet.wxss');

  assert.match(wallet, /class="wallet-balance-hero/);
  assert.match(wallet, /class="withdrawal-request-card/);
  assert.match(wallet, /class="withdrawal-record-card/);
  assert.match(wallet, /class="withdrawal-status-badge/);
  assert.match(walletScript, /statusTone/);
  assert.match(walletScript, /createdDateText/);
  assert.match(walletScript, /wx\.showModal/);
  assert.match(walletStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.wallet-balance-secondary[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(wallet, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(wallet, /tailwind|className=|<div\b/i);
});

test('sponsor manager follows the original pending-task dashboard with native navigation', () => {
  const manager = read('miniprogram/pages/sponsor-companion/sponsor-companion.wxml');
  const managerScript = read('miniprogram/pages/sponsor-companion/sponsor-companion.js');
  const managerStyles = read('miniprogram/pages/sponsor-companion/sponsor-companion.wxss');
  const managerConfig = read('miniprogram/pages/sponsor-companion/sponsor-companion.json');

  assert.match(manager, /class="sponsor-manager-header/);
  assert.match(manager, /class="sponsor-manager-tabs/);
  assert.match(manager, /class="sponsor-task-overview/);
  assert.match(manager, /class="sponsor-pending-card/);
  assert.match(manager, /class="sponsor-task-actions/);
  assert.match(manager, /class="sponsor-insight-grid/);
  assert.match(manager, /<encouragement-editor/);
  assert.match(managerScript, /pendingTaskCount/);
  assert.match(managerScript, /goRewards\s*\(/);
  assert.match(managerScript, /goRules\s*\(/);
  assert.match(managerConfig, /花园管理/);
  assert.match(managerStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.sponsor-manager-tabs[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(manager, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(manager, /tailwind|className=|<div\b/i);
});

test('sponsor review uses the original pending-response hierarchy with native locked decisions', () => {
  const review = read('miniprogram/pages/sponsor-review/sponsor-review.wxml');
  const reviewScript = read('miniprogram/pages/sponsor-review/sponsor-review.js');
  const reviewStyles = read('miniprogram/pages/sponsor-review/sponsor-review.wxss');

  assert.match(review, /class="review-inbox-header/);
  assert.match(review, /class="review-hero-card/);
  assert.match(review, /\/assets\/stitch-original\/checkin-yoga\.jpg/);
  assert.match(review, /class="review-queue-list/);
  assert.match(review, /class="review-queue-card/);
  assert.match(review, /class="review-evidence-panel/);
  assert.match(review, /class="review-decision-panel/);
  assert.match(review, /class="review-empty-state/);
  assert.match(reviewScript, /reviewNumber/);
  assert.match(reviewScript, /focusFirstReview\s*\(/);
  assert.match(reviewScript, /processingCheckInId/);
  assert.match(reviewStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.review-decision-actions[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(review, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(review, /tailwind|className=|<div\b/i);
});

test('sponsor payouts follows the original wish-fund inbox with native confirmed actions', () => {
  const payouts = read('miniprogram/pages/sponsor-payouts/sponsor-payouts.wxml');
  const payoutsScript = read('miniprogram/pages/sponsor-payouts/sponsor-payouts.js');
  const payoutsStyles = read('miniprogram/pages/sponsor-payouts/sponsor-payouts.wxss');

  assert.match(payouts, /class="payout-inbox-header/);
  assert.match(payouts, /class="payout-hero-card/);
  assert.match(payouts, /class="payout-summary-grid/);
  assert.match(payouts, /class="payout-task-list/);
  assert.match(payouts, /class="payout-task-card/);
  assert.match(payouts, /class="payout-status-badge/);
  assert.match(payouts, /class="payout-action-panel/);
  assert.match(payouts, /class="payout-empty-state/);
  assert.match(payoutsScript, /pendingTaskCount/);
  assert.match(payoutsScript, /pendingAmountText/);
  assert.match(payoutsScript, /processingWithdrawalId/);
  assert.match(payoutsScript, /wx\.showModal/);
  assert.match(payoutsStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.payout-decision-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(payouts, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(payouts, /tailwind|className=|<div\b/i);
});

test('reward manager uses the approved original list and empty-state hierarchy', () => {
  const rewards = read('miniprogram/pages/admin-rewards/admin-rewards.wxml');
  const rewardsScript = read('miniprogram/pages/admin-rewards/admin-rewards.js');
  const rewardsStyles = read('miniprogram/pages/admin-rewards/admin-rewards.wxss');

  assert.match(rewards, /class="admin-rewards-header/);
  assert.match(rewards, /class="reward-library-summary/);
  assert.match(rewards, /class="reward-admin-list/);
  assert.match(rewards, /class="reward-admin-card/);
  assert.match(rewards, /class="reward-status-switch/);
  assert.match(rewards, /class="reward-empty-state/);
  assert.match(rewards, /class="reward-floating-add/);
  assert.match(rewards, /class="reward-editor-sheet/);
  assert.match(rewardsScript, /formVisible/);
  assert.match(rewardsScript, /activeRewardCount/);
  assert.match(rewardsScript, /goRules\s*\(/);
  assert.match(rewardsScript, /processingRewardId/);
  assert.match(rewardsScript, /wx\.showModal/);
  assert.match(rewardsStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.reward-admin-actions[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(rewards, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(rewards, /tailwind|className=|<div\b/i);
});

test('sponsor rules uses the original settings hierarchy with native confirmed reward editing', () => {
  const rules = read('miniprogram/pages/sponsor-rules/sponsor-rules.wxml');
  const rulesScript = read('miniprogram/pages/sponsor-rules/sponsor-rules.js');
  const rulesStyles = read('miniprogram/pages/sponsor-rules/sponsor-rules.wxss');

  assert.match(rules, /class="rules-settings-header/);
  assert.match(rules, /class="rules-hero-card/);
  assert.match(rules, /class="rules-summary-grid/);
  assert.match(rules, /class="rules-section-list/);
  assert.match(rules, /class="rules-section-card/);
  assert.match(rules, /class="rules-field-row/);
  assert.match(rules, /class="streak-rule-list/);
  assert.match(rules, /class="level-progress-summary/);
  assert.match(rules, /class="level-rule-list/);
  assert.match(rules, /class="rules-save-dock/);
  assert.match(rulesScript, /totalFixedRewardYuan/);
  assert.match(rulesScript, /levelProgressPercent/);
  assert.match(rulesScript, /saving/);
  assert.match(rulesScript, /wx\.showModal/);
  assert.match(rulesStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.rules-summary-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(rules, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(rules, /tailwind|className=|<div\b/i);
});

test('sponsor companion history uses the original footprint journal with a native care summary', () => {
  const history = read('miniprogram/pages/sponsor-companion-history/sponsor-companion-history.wxml');
  const historyScript = read('miniprogram/pages/sponsor-companion-history/sponsor-companion-history.js');
  const historyStyles = read('miniprogram/pages/sponsor-companion-history/sponsor-companion-history.wxss');

  assert.match(history, /class="companion-history-header/);
  assert.match(history, /class="companion-history-summary-grid/);
  assert.match(history, /class="companion-history-entry-list/);
  assert.match(history, /class="companion-history-entry-card/);
  assert.match(history, /class="companion-history-status-badge/);
  assert.match(history, /class="companion-history-empty-state/);
  assert.match(historyScript, /approvedCount/);
  assert.match(historyScript, /totalMinutes/);
  assert.match(historyScript, /totalRewardText/);
  assert.match(historyScript, /latestApprovedDate/);
  assert.match(historyStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.companion-history-summary-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(history, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(history, /tailwind|className=|<div\b/i);
});

test('sponsor companion badges uses the original profile achievement wall without edit controls', () => {
  const badges = read('miniprogram/pages/sponsor-companion-badges/sponsor-companion-badges.wxml');
  const badgesScript = read('miniprogram/pages/sponsor-companion-badges/sponsor-companion-badges.js');
  const badgesStyles = read('miniprogram/pages/sponsor-companion-badges/sponsor-companion-badges.wxss');

  assert.match(badges, /class="companion-badges-header/);
  assert.match(badges, /class="companion-badges-summary-grid/);
  assert.match(badges, /class="companion-badges-showcase/);
  assert.match(badges, /class="companion-badge-grid/);
  assert.match(badges, /class="companion-badge-card/);
  assert.match(badges, /class="companion-badges-empty-state/);
  assert.match(badgesScript, /unlockedCount/);
  assert.match(badgesScript, /equippedCount/);
  assert.match(badgesScript, /lockedCount/);
  assert.match(badgesScript, /equippedBadges/);
  assert.doesNotMatch(badges, /bindtap="[^"]*equip|bindchange="[^"]*equip/i);
  assert.match(badgesStyles, /@media\s*\(max-width:\s*340px\)[\s\S]*?\.companion-badge-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(badges, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(badges, /tailwind|className=|<div\b/i);
});

test('sponsor companion ledgers uses the original wish-fund balance and native ledger timeline', () => {
  const ledgers = read('miniprogram/pages/sponsor-companion-ledgers/sponsor-companion-ledgers.wxml');
  const ledgersScript = read('miniprogram/pages/sponsor-companion-ledgers/sponsor-companion-ledgers.js');
  const ledgersStyles = read('miniprogram/pages/sponsor-companion-ledgers/sponsor-companion-ledgers.wxss');

  assert.match(ledgers, /class="companion-ledger-header/);
  assert.match(ledgers, /class="companion-ledger-balance-card/);
  assert.match(ledgers, /class="companion-ledger-summary-grid/);
  assert.match(ledgers, /class="companion-ledger-timeline/);
  assert.match(ledgers, /class="companion-ledger-entry/);
  assert.match(ledgers, /class="companion-ledger-empty-state/);
  assert.match(ledgersScript, /incomeTotalText/);
  assert.match(ledgersScript, /expenseTotalText/);
  assert.match(ledgersScript, /netTotalText/);
  assert.match(ledgersScript, /entryNumber/);
  assert.match(ledgersStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.companion-ledger-summary-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(ledgers, /视觉优化版|灵动交互版/);
  assert.doesNotMatch(ledgers, /tailwind|className=|<div\b/i);
});

test('sponsor companion redemptions uses the original gift archive as a native read-only keepsake shelf', () => {
  const redemptions = read('miniprogram/pages/sponsor-companion-redemptions/sponsor-companion-redemptions.wxml');
  const redemptionsScript = read('miniprogram/pages/sponsor-companion-redemptions/sponsor-companion-redemptions.js');
  const redemptionsStyles = read('miniprogram/pages/sponsor-companion-redemptions/sponsor-companion-redemptions.wxss');

  assert.match(redemptions, /class="companion-redemption-header/);
  assert.match(redemptions, /class="companion-redemption-summary-grid/);
  assert.match(redemptions, /class="companion-redemption-featured/);
  assert.match(redemptions, /class="companion-redemption-archive/);
  assert.match(redemptions, /class="companion-redemption-card/);
  assert.match(redemptions, /class="companion-redemption-status-badge/);
  assert.match(redemptions, /class="companion-redemption-empty-state/);
  assert.match(redemptionsScript, /queryCompanionDetail\(\{ viewType: 'redemptions' \}\)/);
  assert.match(redemptionsScript, /displayImageSrc/);
  assert.match(redemptionsScript, /statusTone/);
  assert.match(redemptionsScript, /pendingCount/);
  assert.match(redemptionsScript, /completedCount/);
  assert.match(redemptionsScript, /totalCostText/);
  assert.doesNotMatch(redemptionsScript, /verifyRedemption|requestCancelRedemption|approveCancelRedemption|rejectCancelRedemption/);
  assert.doesNotMatch(redemptions, /bindtap|bindchange|视觉优化版|灵动交互版/);
  assert.match(redemptionsStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.companion-redemption-summary-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(redemptions, /tailwind|className=|<div\b/i);
});
