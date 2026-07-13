const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadCloudApi(overrides = {}) {
  const deleted = [];
  global.wx = {
    cloud: {
      async callFunction(options) {
        return { result: { ok: true, data: options.data } };
      },
      async deleteFile(options) {
        deleted.push(options);
        if (overrides.deleteError) throw overrides.deleteError;
        return { fileList: [] };
      }
    },
    getStorageSync() {
      return '';
    }
  };
  const apiPath = require.resolve('../miniprogram/services/api');
  delete require.cache[apiPath];
  return { api: require(apiPath), deleted };
}

test('uploaded cloud files can be cleaned up without masking the original business error', async (t) => {
  const { api, deleted } = loadCloudApi();
  t.after(() => delete global.wx);

  assert.equal(await api.cleanupUploadedFile('cloud://env/relationships/r/checkins/new.jpg'), true);
  assert.deepEqual(deleted, [{ fileList: ['cloud://env/relationships/r/checkins/new.jpg'] }]);

  const failed = loadCloudApi({ deleteError: new Error('permission denied') });
  assert.equal(await failed.api.cleanupUploadedFile('cloud://env/relationships/r/checkins/new.jpg'), false);
});

test('check-in submission is locked and removes a newly uploaded file when saving fails', () => {
  const script = read('miniprogram/pages/checkin/checkin.js');
  const markup = read('miniprogram/pages/checkin/checkin.wxml');

  assert.match(script, /if \(this\.data\.submitting\) return;/);
  assert.match(script, /let uploadedPhotoFileId = '';/);
  assert.match(script, /await api\.cleanupUploadedFile\(uploadedPhotoFileId\)/);
  assert.match(markup, /disabled="\{\{submitting \|\| choosingPhoto\}\}"/);
  assert.match(markup, /disabled="\{\{submitting\}\}"/);
});

test('profile and reward image uploads clean up only newly uploaded unreferenced files', () => {
  const profile = read('miniprogram/pages/profile-edit/profile-edit.js');
  const rewards = read('miniprogram/pages/admin-rewards/admin-rewards.js');

  assert.match(profile, /await api\.cleanupUploadedFile\(uploadedAvatarFileId\)/);
  assert.match(rewards, /await api\.cleanupUploadedFile\(uploadedImageFileId\)/);
  assert.match(rewards, /editingIsActive/);
  assert.doesNotMatch(rewards, /isActive:\s*true\s*\n\s*\}\);/);
});

test('review actions use an in-flight record lock and offer recovery when an authorized photo fails to load', () => {
  const script = read('miniprogram/pages/sponsor-review/sponsor-review.js');
  const markup = read('miniprogram/pages/sponsor-review/sponsor-review.wxml');

  assert.match(script, /processingCheckInId/);
  assert.match(script, /if \(this\.data\.processingCheckInId\) return;/);
  assert.match(markup, /disabled="\{\{processingCheckInId\}\}"/);
  assert.match(markup, /照片暂时没有加载出来/);
  assert.match(markup, /请点击页面重试/);
  assert.doesNotMatch(markup, /跨账号照片暂不可预览/);
});

test('high-risk mutation pages expose visible in-flight locks', () => {
  const contracts = [
    ['miniprogram/pages/reward-detail/reward-detail.js', /redeeming/],
    ['miniprogram/pages/reward-detail/reward-detail.wxml', /disabled="\{\{[^\"]*redeeming/],
    ['miniprogram/pages/redemptions/redemptions.js', /processingRedemptionId/],
    ['miniprogram/pages/redemptions/redemptions.wxml', /disabled="\{\{processingRedemptionId\}\}"/],
    ['miniprogram/pages/wallet/wallet.js', /requesting/],
    ['miniprogram/pages/wallet/wallet.wxml', /disabled="\{\{requesting\}\}"/],
    ['miniprogram/pages/sponsor-payouts/sponsor-payouts.js', /processingWithdrawalId/],
    ['miniprogram/pages/sponsor-payouts/sponsor-payouts.wxml', /disabled="\{\{processingWithdrawalId\}\}"/],
    ['miniprogram/pages/sponsor-rules/sponsor-rules.js', /saving/],
    ['miniprogram/pages/sponsor-rules/sponsor-rules.wxml', /disabled="\{\{saving\}\}"/],
    ['miniprogram/pages/admin-rewards/admin-rewards.js', /processingRewardId/],
    ['miniprogram/pages/admin-rewards/admin-rewards.wxml', /disabled="\{\{processingRewardId\}\}"/]
  ];

  contracts.forEach(([file, pattern]) => assert.match(read(file), pattern, file));
});
