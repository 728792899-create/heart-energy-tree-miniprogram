const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
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

function loadComponentDefinition(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const previousComponent = global.Component;
  let definition = null;
  global.Component = (value) => {
    definition = value;
  };
  try {
    delete require.cache[require.resolve(absolutePath)];
    require(absolutePath);
  } finally {
    global.Component = previousComponent;
  }
  return definition;
}

function createComponentContext(data, methods = {}) {
  const events = [];
  return {
    ...methods,
    data: { ...data },
    events,
    setData(update) {
      this.data = { ...this.data, ...update };
    },
    triggerEvent(name, detail) {
      events.push({ name, detail });
    }
  };
}

test('motion asset manifest covers every scene with stable local posters and native variants', () => {
  const { MOTION_ASSETS, SCENE_ALIASES, resolveMotionAsset } = require('../miniprogram/config/motion-assets');
  assert.deepEqual(Object.keys(MOTION_ASSETS), expectedSceneKeys);

  expectedSceneKeys.forEach((sceneKey) => {
    const asset = MOTION_ASSETS[sceneKey];
    assert.equal(asset.videoSrc, '', `${sceneKey} remote video remains opt-in`);
    assert.equal(asset.poster, `/assets/motion/${sceneKey}.jpg`);
    assert.ok(['hearts', 'ribbon', 'coins'].includes(asset.nativeVariant), sceneKey);
    assert.ok(fs.existsSync(path.join(projectRoot, 'miniprogram', asset.poster)), asset.poster);
  });

  const defaultAsset = resolveMotionAsset('not-a-scene');
  assert.equal(defaultAsset.sceneKey, 'companion-empty');
  assert.deepEqual(SCENE_ALIASES, {
    first_checkin: 'check-in',
    checkin_envelope: 'check-in',
    checkin_surprise: 'check-in',
    cash_overflow_love_pack: 'approval',
    streak_3: 'streak-3',
    streak_7: 'streak-7',
    streak_14: 'streak-14',
    map_level_complete: 'map-complete',
    badge_unlock: 'badge-unlock',
    energy_100: 'badge-unlock',
    energy_300: 'badge-unlock',
    energy_520: 'badge-unlock',
    first_redemption: 'redemption',
    wish_fund_complete: 'wish-fund-complete',
    gentle_empty_week: 'companion-empty'
  });
  Object.entries(SCENE_ALIASES).forEach(([alias, canonical]) => {
    const resolved = resolveMotionAsset(alias);
    assert.equal(resolved.sceneKey, canonical, alias);
    assert.equal(resolved.poster, `/assets/motion/${canonical}.jpg`, alias);
  });
  const overridden = resolveMotionAsset('approval', {
    src: 'cloud://example/static/approval.mp4',
    poster: '/assets/custom-approval.jpg'
  });
  assert.equal(overridden.videoSrc, 'cloud://example/static/approval.mp4');
  assert.equal(overridden.poster, '/assets/custom-approval.jpg');
});

test('motion scene transitions from video to poster to native fallback and emits ended', () => {
  const definition = loadComponentDefinition('miniprogram/components/motion-scene/motion-scene.js');
  assert.ok(definition);
  const context = createComponentContext({
    sceneKey: 'approval',
    videoFailed: false,
    posterFailed: false,
    resolvedSrc: 'cloud://example/static/approval.mp4',
    resolvedPoster: '/assets/motion/approval.jpg'
  }, definition.methods);

  definition.methods.onVideoError.call(context);
  assert.equal(context.data.videoFailed, true);
  assert.deepEqual(context.events.at(-1), {
    name: 'fallback',
    detail: { level: 'poster', sceneKey: 'approval' }
  });

  definition.methods.onPosterError.call(context);
  assert.equal(context.data.posterFailed, true);
  assert.deepEqual(context.events.at(-1), {
    name: 'fallback',
    detail: { level: 'native', sceneKey: 'approval' }
  });

  definition.methods.onEnded.call(context);
  assert.deepEqual(context.events.at(-1), {
    name: 'ended',
    detail: { sceneKey: 'approval' }
  });
});

test('remote video resolution covers direct URL, cloud failure, and reduced-motion poster paths', async (t) => {
  const definition = loadComponentDefinition('miniprogram/components/motion-scene/motion-scene.js');
  const originalWx = global.wx;
  t.after(() => {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  });

  const direct = createComponentContext({ sceneKey: 'approval', videoFailed: false }, definition.methods);
  definition.methods.resolveVideoSource.call(direct, 'https://example.invalid/approval.mp4', 1);
  assert.equal(direct.data.resolvedSrc, 'https://example.invalid/approval.mp4');

  delete global.wx;
  const unavailable = createComponentContext({ sceneKey: 'approval', videoFailed: false }, definition.methods);
  definition.methods.resolveVideoSource.call(unavailable, 'cloud://env/motion/approval.mp4', 1);
  assert.equal(unavailable.data.videoFailed, true);
  assert.deepEqual(unavailable.events.at(-1), {
    name: 'fallback',
    detail: { level: 'poster', sceneKey: 'approval' }
  });

  const reduced = createComponentContext({
    sceneKey: 'approval',
    src: 'https://example.invalid/approval.mp4',
    poster: '',
    reducedMotion: true
  }, definition.methods);
  definition.methods.syncAssets.call(reduced);
  assert.equal(reduced.data.resolvedSrc, '');
  assert.equal(reduced.data.resolvedPoster, '/assets/motion/approval.jpg');
});

test('motion scene markup and styles preserve video, poster, and 300-600ms native fallbacks', () => {
  const script = read('miniprogram/components/motion-scene/motion-scene.js');
  const markup = read('miniprogram/components/motion-scene/motion-scene.wxml');
  const styles = read('miniprogram/components/motion-scene/motion-scene.wxss');
  const celebration = read('miniprogram/components/celebration-layer/celebration-layer.wxml');

  assert.match(script, /require\(['"]\.\.\/\.\.\/config\/motion-assets['"]\)/);
  assert.match(script, /resolvedSrc/);
  assert.match(script, /resolvedPoster/);
  assert.match(script, /getTempFileURL/);
  assert.match(script, /reducedMotion/);
  assert.match(markup, /<video[^>]*src="\{\{resolvedSrc\}\}"[^>]*binderror="onVideoError"[^>]*bindended="onEnded"/s);
  assert.match(markup, /!reducedMotion\s*&&\s*resolvedSrc/);
  assert.match(markup, /<image[^>]*src="\{\{resolvedPoster\}\}"[^>]*binderror="onPosterError"/s);
  assert.match(markup, /native-\{\{nativeVariant\}\}/);
  assert.match(markup, /native-gift-image/);
  assert.match(markup, /native-tree-image/);
  assert.match(markup, /native-particle/);
  assert.doesNotMatch(markup, /¥|TOGETHER|<view[^>]*>\s*[♥★♧]/);
  assert.match(styles, /(?:300|3\d\d|4\d\d|5\d\d|600)ms/);
  assert.match(styles, /\.is-reduced-motion[\s\S]*?animation:\s*none/);
  assert.match(celebration, /<motion-scene[^>]*scene-key="\{\{sceneKey\}\}"/s);
  assert.match(celebration, /reduced-motion="\{\{reducedMotion\}\}"/);
});

test('new local motion posters stay within the 400KB mini program budget', () => {
  const assetsDirectory = path.join(projectRoot, 'miniprogram/assets/motion');
  const totalBytes = fs.readdirSync(assetsDirectory)
    .filter((name) => fs.statSync(path.join(assetsDirectory, name)).isFile())
    .reduce((total, name) => total + fs.statSync(path.join(assetsDirectory, name)).size, 0);

  assert.ok(totalBytes > 0);
  assert.ok(totalBytes <= 400 * 1024, `motion assets use ${totalBytes} bytes`);
});
