const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

test('developer tools keep custom-component JavaScript dependencies in development builds', () => {
  const privateConfig = readJson('project.private.config.json');
  const motionScenePath = path.join(projectRoot, 'miniprogram/components/motion-scene/motion-scene.js');
  const motionAssetPath = path.join(projectRoot, 'miniprogram/config/motion-assets.js');

  assert.ok(fs.existsSync(motionScenePath), 'motion-scene component script must exist');
  assert.ok(fs.existsSync(motionAssetPath), 'motion asset manifest must exist');
  assert.equal(
    privateConfig.setting && privateConfig.setting.ignoreDevUnusedFiles,
    false,
    'ignoreDevUnusedFiles must stay disabled so development builds do not prune modules used by custom components'
  );
});
