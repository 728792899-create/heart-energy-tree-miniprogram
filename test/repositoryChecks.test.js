const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function runScript(name) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'scripts', name)], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
}

test('repository JavaScript syntax check is executable and passes without parsing JSX as plain JS', () => {
  const result = runScript('check-javascript.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /JavaScript 语法检查通过/);
});

test('cloud function manifests use exact integrity-locked dependencies', () => {
  const result = runScript('check-cloud-dependencies.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /云函数依赖检查通过/);
});

test('main package and committed assets stay inside explicit release budgets', () => {
  const result = runScript('check-budgets.js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /主包与素材预算检查通过/);
});

test('GitHub Actions exercises public quality, clean cloud install, and real Remotion smoke jobs', () => {
  const workflow = fs.readFileSync(path.join(projectRoot, '.github/workflows/ci.yml'), 'utf8');
  [
    'npm test',
    'npm run check:shared',
    'npm run check:syntax',
    'npm run check:cloud-deps',
    'npm run check:budgets',
    'npm ci --prefix cloudfunctions/energyTree',
    'npm ci --prefix motion-studio',
    'npm run motion:compositions',
    'npm run motion:smoke'
  ].forEach((command) => assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.doesNotMatch(workflow, /project\.private\.config\.json/);
});
