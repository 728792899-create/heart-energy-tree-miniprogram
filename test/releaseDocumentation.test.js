const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('database rule baseline covers every runtime collection and forbids all client writes', () => {
  const rules = JSON.parse(read('docs/cloud-database.rules.json'));
  const required = [
    'appStates', 'users', 'relationships', 'checkIns', 'rewardLedgers', 'claimRequests',
    'rewardItems', 'redemptions', 'badges', 'badgeUnlocks', 'surpriseCards',
    'encouragementCards', 'companionViewNotices', 'subscriptionGrants', 'auditLogs',
    'rewardRules', 'growthTreeStates', 'coupleMessages', 'coupleMessageInbox',
    'coupleMessageStates', 'coupleMessageMigrations', 'mediaCheckTasks'
  ];

  assert.deepEqual(Object.keys(rules).sort(), required.sort());
  Object.entries(rules).forEach(([collection, rule]) => {
    assert.equal(rule.write, false, `${collection} must reject client writes`);
  });
  assert.match(rules.coupleMessageInbox.read, /auth\.openid/);
  assert.match(rules.coupleMessageStates.read, /auth\.openid/);
});

test('data operations document collections, indexes, backup, restore and version 4 migration', () => {
  const document = read('docs/data-operations.md');
  ['appStates/main', 'coupleMessageInbox', 'mediaCheckTasks', '索引', '备份', '恢复', '版本迁移', 'version` 为 `4`']
    .forEach((term) => assert.match(document, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(document, /write` 必须为 `false`/);
  assert.match(document, /不得.*清空|不.*清库/);
});

test('privacy lifecycle covers unbinding, export, deletion, photos, consent withdrawal and account recovery', () => {
  const document = read('docs/privacy-data-lifecycle.md');
  ['解绑与关系解除', '数据导出', '数据删除', '照片生命周期', '撤回隐私授权', '异常账号恢复', '线下手动兑现']
    .forEach((term) => assert.match(document, new RegExp(term)));
  assert.match(document, /双方.*两次确认|两次警告.*双方确认/);
  assert.match(document, /不会自动删除|不自动删除/);
  assert.match(document, /数据导出.*人工|人工.*数据导出/s);
  assert.match(document, /私人版 V3 \/ 小程序 `3\.1\.0`/);
});

test('release, deployment, device, license and security handoff files are present', () => {
  [
    'docs/deployment-checklist.md',
    'docs/device-acceptance.md',
    'docs/release-checklist.md',
    'LICENSE',
    'SECURITY.md'
  ].forEach((file) => assert.ok(fs.statSync(path.join(ROOT, file)).size > 500, file));
  assert.match(read('docs/device-acceptance.md'), /Browser.*不得/);
  assert.match(read('docs/release-checklist.md'), /真实支付/);
  assert.match(read('docs/release-checklist.md'), /候选小程序版本：`3\.1\.0`/);
  assert.match(read('docs/deployment-checklist.md'), /3\.0\.0.*正式发布/);
  assert.match(read('docs/device-acceptance.md'), /REL-03.*3\.0\.0.*已发布/);
  assert.match(read('docs/device-acceptance.md'), /UNB-01.*待双账号真机/);
  assert.match(read('SECURITY.md'), /getWXContext\(\)\.OPENID/);
  assert.match(read('SECURITY.md'), /私人版 V3 \/ 小程序 `3\.1\.0`/);
});
