const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('shared romantic components and approved original page hierarchies are used by the main journeys', () => {
  const contracts = [
    ['miniprogram/pages/home/home.wxml', /<weekly-recap-card/],
    ['miniprogram/pages/home/home.wxml', /<milestone-card/],
    ['miniprogram/pages/home/home.wxml', /<celebration-layer/],
    ['miniprogram/pages/bind/bind.wxml', /<motion-scene/],
    ['miniprogram/pages/sponsor-companion/sponsor-companion.wxml', /<encouragement-editor/],
    ['miniprogram/pages/weekly-recap/weekly-recap.wxml', /<state-panel/],
    ['miniprogram/pages/weekly-recap/weekly-recap.wxml', /class="recap-summary-card/],
    ['miniprogram/pages/wallet/wallet.wxml', /class="wallet-balance-hero/],
    ['miniprogram/pages/reward-detail/reward-detail.wxml', /class="redemption-confirm-card/]
  ];

  contracts.forEach(([file, pattern]) => assert.match(read(file), pattern, file));
});

test('home promotes only one unseen milestone into an accessible celebration and accepts component events', () => {
  const script = read('miniprogram/pages/home/home.js');
  const markup = read('miniprogram/pages/home/home.wxml');

  assert.match(script, /require\(['"]\.\.\/\.\.\/services\/experience['"]\)/);
  assert.match(script, /activeCelebration:\s*null/);
  assert.match(script, /relationship:\s*\{[\s\S]*?title:\s*['"]我们的心动能量树['"]/);
  assert.match(script, /shownMilestoneIds:\s*\[\]/);
  assert.match(script, /event\.detail\s*&&\s*event\.detail\.id/);
  assert.match(script, /closeCelebration\s*\(/);
  assert.match(script, /experience\.playCue\(experience\.cueForScene\(nextCelebration\.sceneKey\)\)/);
  assert.match(markup, /<celebration-layer[^>]*wx:if="\{\{activeCelebration\}\}"[^>]*visible="\{\{true\}\}"/s);
  assert.match(markup, /bindclose="closeCelebration"/);
});

test('binding success uses the local romantic cue and keeps a native motion fallback', () => {
  const script = read('miniprogram/pages/bind/bind.js');
  const markup = read('miniprogram/pages/bind/bind.wxml');

  assert.match(script, /require\(['"]\.\.\/\.\.\/services\/experience['"]\)/);
  assert.ok((script.match(/experience\.playCue\(['"]binding['"]\)/g) || []).length >= 2);
  assert.match(markup, /<motion-scene[^>]*scene-key="binding"/s);
});

test('sponsor encouragement handlers accept values emitted by the shared editor component', () => {
  const script = read('miniprogram/pages/sponsor-companion/sponsor-companion.js');

  assert.match(script, /event\.detail\s*&&\s*event\.detail\.key/);
  assert.match(script, /event\.detail\s*&&\s*event\.detail\.value/);
});

test('key relationship moments use the persisted local sound preference', () => {
  const contracts = [
    ['miniprogram/pages/sponsor-review/sponsor-review.js', /experience\.playCue\(['"]approval['"]\)/],
    ['miniprogram/pages/reward-detail/reward-detail.js', /experience\.playCue\(['"]redemption['"]\)/],
    ['miniprogram/pages/redemptions/redemptions.js', /experience\.playCue\(['"]fulfillment['"]\)/],
    ['miniprogram/pages/sponsor-payouts/sponsor-payouts.js', /experience\.playCue\(['"]payout['"]\)/],
    ['miniprogram/pages/sponsor-companion/sponsor-companion.js', /experience\.playCue\(['"]encouragement['"]\)/],
    ['miniprogram/pages/home/home.js', /experience\.playCue\(['"]encouragement['"]\)/]
  ];

  contracts.forEach(([file, pattern]) => {
    const script = read(file);
    assert.match(script, /require\(['"]\.\.\/\.\.\/services\/experience['"]\)/, file);
    assert.match(script, pattern, file);
  });
});

test('sound preference defaults on, persists locally, and prevents playback when disabled', (t) => {
  const storage = new Map();
  const played = [];
  const destroyed = [];
  global.wx = {
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    createInnerAudioContext() {
      return {
        src: '',
        volume: 1,
        obeyMuteSwitch: false,
        play() {
          played.push(this.src);
        },
        onEnded(handler) {
          this.ended = handler;
        },
        onError(handler) {
          this.failed = handler;
        },
        destroy() {
          destroyed.push(this.src);
        }
      };
    }
  };
  t.after(() => delete global.wx);

  const modulePath = require.resolve('../miniprogram/services/experience');
  delete require.cache[modulePath];
  const experience = require(modulePath);

  assert.equal(experience.isSoundEnabled(), true);
  assert.equal(experience.playCue('binding'), true);
  assert.match(played[0], /^\/assets\/sounds\/.+\.wav$/);

  experience.setSoundEnabled(false);
  assert.equal(experience.isSoundEnabled(), false);
  assert.equal(experience.playCue('milestone'), false);
  assert.equal(played.length, 1);

  experience.setSoundEnabled(true);
  assert.equal(experience.playCue('milestone'), true);
  assert.equal(played.length, 2);
  assert.equal(destroyed.length, 0);
});

test('reduced-motion preference follows the system once, persists locally, and is user-overridable', (t) => {
  const storage = new Map();
  global.wx = {
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    getSystemSetting() {
      return { reduceMotionEnabled: true };
    }
  };
  t.after(() => delete global.wx);

  const modulePath = require.resolve('../miniprogram/services/experience');
  delete require.cache[modulePath];
  const experience = require(modulePath);

  assert.equal(experience.isReducedMotionEnabled(), true);
  assert.equal(experience.setReducedMotionEnabled(false), false);
  assert.equal(experience.isReducedMotionEnabled(), false);
  assert.equal(storage.get(experience.REDUCED_MOTION_STORAGE_KEY), false);
});

test('milestone scenes select distinct streak, map, badge, redemption, and payout cues', () => {
  const experience = require('../miniprogram/services/experience');

  assert.equal(experience.cueForScene('streak_3'), 'streak');
  assert.equal(experience.cueForScene('streak_14'), 'streak');
  assert.equal(experience.cueForScene('map_level_complete'), 'map');
  assert.equal(experience.cueForScene('badge_unlock'), 'badge');
  assert.equal(experience.cueForScene('energy_520'), 'badge');
  assert.equal(experience.cueForScene('first_redemption'), 'redemption');
  assert.equal(experience.cueForScene('wish_fund_complete'), 'payout');
  assert.equal(experience.cueForScene('unknown_scene'), 'milestone');

  const home = read('miniprogram/pages/home/home.js');
  assert.match(home, /experience\.playCue\(experience\.cueForScene\(nextCelebration\.sceneKey\)\)/);
});

test('original local sound cues are small valid wave files', () => {
  ['heart-chime.wav', 'milestone-bloom.wav', 'promise-bell.wav'].forEach((name) => {
    const filePath = path.join(projectRoot, 'miniprogram/assets/sounds', name);
    const bytes = fs.readFileSync(filePath);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', name);
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WAVE', name);
    assert.ok(bytes.length < 64 * 1024, `${name} exceeds the local cue budget`);
  });
});

test('profile exposes accessible persisted sound and reduced-motion switches', () => {
  const script = read('miniprogram/pages/profile/profile.js');
  const markup = read('miniprogram/pages/profile/profile.wxml');

  assert.match(script, /isSoundEnabled:\s*experience\.isSoundEnabled\(\)/);
  assert.match(script, /experience\.setSoundEnabled/);
  assert.match(markup, /<switch[^>]*checked="\{\{isSoundEnabled\}\}"/);
  assert.match(markup, /aria-label="开启或关闭心动提示音"/);
  assert.match(script, /reducedMotion:\s*experience\.isReducedMotionEnabled\(\)/);
  assert.match(script, /experience\.setReducedMotionEnabled/);
  assert.match(markup, /<switch[^>]*checked="\{\{reducedMotion\}\}"/);
  assert.match(markup, /aria-label="开启或关闭简化动效"/);
});

test('legacy saturated pink surfaces are removed from page styles', () => {
  const legacyColors = /#(?:fff7fa|f08ca7|b85270|ffe9f0|fff3f7)\b/i;
  const pageStyles = fs.readdirSync(path.join(projectRoot, 'miniprogram/pages'))
    .flatMap((name) => {
      const file = path.join(projectRoot, 'miniprogram/pages', name, `${name}.wxss`);
      return fs.existsSync(file) ? [[file, fs.readFileSync(file, 'utf8')]] : [];
    });

  pageStyles.forEach(([file, styles]) => {
    assert.doesNotMatch(styles, legacyColors, path.relative(projectRoot, file));
  });
});
