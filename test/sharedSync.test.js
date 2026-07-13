const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SHARED_FILES = [
  'services/appService.js',
  'services/inputPolicy.js',
  'core/rewardEngine.js',
  'utils/date.js'
];

test('cloud function dependency is pinned and shared deployment files are byte-identical', () => {
  const cloudPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudfunctions/energyTree/package.json'), 'utf8'));
  assert.equal(cloudPackage.dependencies['wx-server-sdk'], '4.0.2');

  SHARED_FILES.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(ROOT, 'miniprogram', relativePath));
    const deployed = fs.readFileSync(path.join(ROOT, 'cloudfunctions/energyTree/miniprogram', relativePath));
    assert.deepEqual(deployed, source, relativePath);
  });

  const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts/sync-shared.js'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});
