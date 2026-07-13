const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const studioRoot = path.join(projectRoot, 'motion-studio');

const expectedSceneKeys = [
  'binding',
  'check-in',
  'approval',
  'streak-3',
  'streak-7',
  'streak-14',
  'map-complete',
  'badge-unlock',
  'redemption',
  'wish-fund-complete',
  'encouragement',
  'weekly-recap',
  'companion-empty'
];

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function assertNonEmptyFile(relativePath, minimumBytes = 1) {
  const absolutePath = path.join(projectRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} should exist`);
  assert.ok(fs.statSync(absolutePath).size >= minimumBytes, `${relativePath} should be non-empty`);
}

test('motion studio pins matching exact Remotion versions and records them in its lockfile', () => {
  const packageJson = JSON.parse(read('motion-studio/package.json'));
  const lockfile = JSON.parse(read('motion-studio/package-lock.json'));
  const remotionVersion = packageJson.dependencies && packageJson.dependencies.remotion;
  const cliVersion = packageJson.devDependencies && packageJson.devDependencies['@remotion/cli'];

  assert.match(remotionVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(cliVersion, remotionVersion);
  assert.doesNotMatch(remotionVersion, /latest|[~^*]/i);
  assert.equal(lockfile.packages['node_modules/remotion'].version, remotionVersion);
  assert.equal(lockfile.packages['node_modules/@remotion/cli'].version, cliVersion);
  assert.equal(packageJson.dependencies.react, packageJson.dependencies['react-dom']);
  assert.match(packageJson.scripts.compositions, /remotion compositions/);
  assert.match(packageJson.scripts['render:smoke'], /remotion still/);
  assert.match(packageJson.scripts['render:preview'], /render-preview/);
  assert.match(packageJson.scripts['render:posters'], /render-posters/);
});

test('motion studio exposes every approved scene and reusable character component', () => {
  const { SCENES } = require(path.join(studioRoot, 'src/scene-definitions'));
  const rootSource = read('motion-studio/src/Root.jsx');
  const sceneSource = read('motion-studio/src/HeartTreeScene.jsx');
  const expectedComponents = [
    'Bear',
    'Rabbit',
    'HeartParticles',
    'LoveTree',
    'PaperPlane',
    'GiftBox',
    'GoldenRibbon'
  ];

  assert.deepEqual(SCENES.map((scene) => scene.sceneKey), expectedSceneKeys);
  assert.equal(new Set(SCENES.map((scene) => scene.compositionId)).size, SCENES.length);
  assert.equal(new Set(SCENES.map((scene) => scene.posterId)).size, SCENES.length);
  SCENES.forEach((scene) => {
    assert.equal(scene.fps, 24, scene.sceneKey);
    assert.ok(scene.durationInFrames >= 58 && scene.durationInFrames <= 108, scene.sceneKey);
    if (['binding', 'weekly-recap'].includes(scene.sceneKey)) {
      assert.deepEqual([scene.width, scene.height], [750, 1000], scene.sceneKey);
    } else {
      assert.deepEqual([scene.width, scene.height], [720, 720], scene.sceneKey);
    }
  });

  expectedComponents.forEach((componentName) => {
    assertNonEmptyFile(`motion-studio/src/components/${componentName}.jsx`, 120);
    assert.match(sceneSource, new RegExp(`<${componentName}\\b`), componentName);
  });
  assert.match(rootSource, /<Composition/);
  assert.match(rootSource, /<Still/);
  assert.match(rootSource, /SCENES\.map/);
  assert.match(sceneSource, /useCurrentFrame\s*\(/);
  assert.match(sceneSource, /interpolate\s*\(/);
  assert.match(sceneSource, /spring\s*\(/);
  assert.doesNotMatch(sceneSource, /animation\s*:/);
});

test('motion studio has discoverable render entrypoints and real smoke, preview, and poster outputs', () => {
  assertNonEmptyFile('motion-studio/src/index.jsx', 80);
  assertNonEmptyFile('motion-studio/remotion.config.js', 80);
  assertNonEmptyFile('motion-studio/scripts/render-preview.js', 120);
  assertNonEmptyFile('motion-studio/scripts/render-posters.js', 120);
  assertNonEmptyFile('motion-studio/out/smoke/binding-frame.png', 2_000);
  assertNonEmptyFile('motion-studio/out/previews/approval.mp4', 10_000);

  expectedSceneKeys.forEach((sceneKey) => {
    assertNonEmptyFile(`miniprogram/assets/motion/${sceneKey}.jpg`, 1_000);
  });
});
