const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FUNCTION_ROOT = path.join(ROOT, 'cloudfunctions/energyTree');
const RUNTIME_FILES = [
  'cloudRuntimeModels.js',
  'cloudRuntimeRewardEngine.js',
  'cloudRuntimeDate.js',
  'cloudRuntimeManualPayoutProvider.js',
  'cloudRuntimeStorage.js',
  'cloudRuntimeInputPolicy.js',
  'cloudRuntimeAppService.js'
];

test('cloud entry uses root-level runtime files that incremental deployment can package', () => {
  const entry = fs.readFileSync(path.join(FUNCTION_ROOT, 'index.js'), 'utf8');
  assert.match(entry, /loadRuntimeModule\('\.\/miniprogram\/services\/appService', '\.\/cloudRuntimeAppService'\)/);
  assert.match(entry, /loadRuntimeModule\('\.\/miniprogram\/services\/storage', '\.\/cloudRuntimeStorage'\)/);
  assert.match(entry, /require\('\.\/mediaCheck'\)/);
  assert.ok(fs.statSync(path.join(FUNCTION_ROOT, 'mediaCheck.js')).isFile());

  RUNTIME_FILES.forEach((file) => {
    assert.ok(fs.statSync(path.join(FUNCTION_ROOT, file)).isFile(), file);
  });

  const appService = require(path.join(FUNCTION_ROOT, 'cloudRuntimeAppService.js'));
  const storage = require(path.join(FUNCTION_ROOT, 'cloudRuntimeStorage.js'));
  assert.equal(typeof appService.getDashboard, 'function');
  assert.equal(typeof storage.runWithScopedStorage, 'function');
});
