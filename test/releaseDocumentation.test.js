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
  assert.match(document, /当前没有.*一键解绑/);
  assert.match(document, /不能把本文当作功能已经自动化的证明/);
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
  assert.match(read('SECURITY.md'), /getWXContext\(\)\.OPENID/);
});
