const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

test('public developer tools config keeps custom-component JavaScript dependencies in development builds', () => {
  const publicConfig = readJson('project.config.json');
  const privateConfigPath = path.join(projectRoot, 'project.private.config.json');
  const privateConfig = fs.existsSync(privateConfigPath)
    ? JSON.parse(fs.readFileSync(privateConfigPath, 'utf8'))
    : null;
  const motionScenePath = path.join(projectRoot, 'miniprogram/components/motion-scene/motion-scene.js');
  const motionAssetPath = path.join(projectRoot, 'miniprogram/config/motion-assets.js');

  assert.ok(fs.existsSync(motionScenePath), 'motion-scene component script must exist');
  assert.ok(fs.existsSync(motionAssetPath), 'motion asset manifest must exist');
  assert.equal(
    publicConfig.setting && publicConfig.setting.ignoreDevUnusedFiles,
    false,
    'public ignoreDevUnusedFiles must stay disabled so clean clones keep custom-component modules'
  );
  if (privateConfig && privateConfig.setting && 'ignoreDevUnusedFiles' in privateConfig.setting) {
    assert.equal(
      privateConfig.setting.ignoreDevUnusedFiles,
      false,
      'an optional private config must not override ignoreDevUnusedFiles to true'
    );
  }
});

test('repository provides a safe private developer tools config example without requiring the private file', () => {
  const example = readJson('project.private.config.example.json');
  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');

  assert.equal(example.setting && example.setting.ignoreDevUnusedFiles, false);
  assert.match(gitignore, /^project\.private\.config\.json$/m);
  assert.doesNotMatch(gitignore, /^project\.private\.config\.example\.json$/m);
});
