const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('app shell uses the heart-tree brand, romantic palette, and accessible touch sizes', () => {
  const app = JSON.parse(read('miniprogram/app.json'));
  const styles = read('miniprogram/app.wxss');

  assert.equal(app.window.navigationBarTitleText, '心动能量树');
  assert.equal(app.window.navigationBarBackgroundColor, '#FFF8F8');
  assert.equal(app.window.backgroundColor, '#FFF8F8');
  ['#FFF8F8', '#FFF0F2', '#FF897E', '#8F3653', '#711E3C', '#CCEBC5', '#22191B']
    .forEach((color) => assert.match(styles, new RegExp(color, 'i')));
  assert.match(styles, /button\s*\{[^}]*min-height\s*:\s*88rpx/s);
  assert.match(styles, /padding-bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.card\s*\{[^}]*border-radius\s*:\s*(?:24|28|30|32)rpx/s);
});

test('five tab items have selected and unselected custom artwork', () => {
  const app = JSON.parse(read('miniprogram/app.json'));
  assert.equal(app.tabBar.list.length, 5);
  app.tabBar.list.forEach((item) => {
    assert.match(item.iconPath, /^assets\/tabbar\/.+\.png$/);
    assert.match(item.selectedIconPath, /^assets\/tabbar\/.+-selected\.png$/);
    assert.ok(fs.existsSync(path.join(projectRoot, 'miniprogram', item.iconPath)), item.iconPath);
    assert.ok(fs.existsSync(path.join(projectRoot, 'miniprogram', item.selectedIconPath)), item.selectedIconPath);
  });
});

test('shared romantic UI components are globally registered and contain accessible states', () => {
  const app = JSON.parse(read('miniprogram/app.json'));
  const expected = [
    'couple-hero',
    'state-panel',
    'amount-card',
    'milestone-card',
    'weekly-recap-card',
    'encouragement-editor',
    'motion-scene',
    'celebration-layer',
    'love-dialog'
  ];

  expected.forEach((name) => {
    assert.equal(app.usingComponents[name], `/components/${name}/${name}`);
    ['js', 'json', 'wxml', 'wxss'].forEach((extension) => {
      assert.ok(fs.existsSync(path.join(projectRoot, `miniprogram/components/${name}/${name}.${extension}`)), `${name}.${extension}`);
    });
  });

  const stateMarkup = read('miniprogram/components/state-panel/state-panel.wxml');
  assert.match(stateMarkup, /加载中/);
  assert.match(stateMarkup, /重新加载/);
  assert.match(stateMarkup, /aria-label/);
});

test('core surfaces carry the companionship promise and adult bear-rabbit identity', () => {
  const home = read('miniprogram/pages/home/home.wxml');
  const bind = read('miniprogram/pages/bind/bind.wxml');

  assert.match(home + bind, /你负责好好照顾自己，我负责一直为你加油/);
  assert.match(home, /couple-hero/);
  assert.match(bind, /couple-hero/);
  assert.match(home + bind, /暖棕小熊|奶白小兔|熊兔/);
});

test('all 22 registered pages keep a responsive page root and a branded navigation title', () => {
  const app = JSON.parse(read('miniprogram/app.json'));
  assert.equal(app.pages.length, 22);
  app.pages.forEach((pagePath) => {
    const markup = read(`miniprogram/${pagePath}.wxml`);
    const config = JSON.parse(read(`miniprogram/${pagePath}.json`));
    assert.match(markup, /class="page(?:\s|\")/, pagePath);
    assert.ok(config.navigationBarTitleText, `${pagePath} missing navigation title`);
  });
});


test('component styles use class selectors instead of unsupported element selectors', () => {
  const componentsRoot = path.join(projectRoot, 'miniprogram/components');
  const elementSelector = /(^|[\s>+~,])(?:view|text|button|image|video|input|textarea|scroll-view)(?=[:.#\[\s>+~,]|$)/;
  const violations = [];

  fs.readdirSync(componentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const relativePath = `miniprogram/components/${entry.name}/${entry.name}.wxss`;
      const absolutePath = path.join(projectRoot, relativePath);
      if (!fs.existsSync(absolutePath)) return;
      const styles = fs.readFileSync(absolutePath, 'utf8');
      for (const match of styles.matchAll(/([^{}]+)\{/g)) {
        const selector = match[1].trim().replace(/\s+/g, ' ');
        if (!selector || selector.startsWith('@')) continue;
        if (elementSelector.test(selector)) violations.push(`${relativePath}: ${selector}`);
      }
    });

  assert.deepEqual(violations, []);
});
