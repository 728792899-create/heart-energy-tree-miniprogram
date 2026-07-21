const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function localImageTargets(relativePath) {
  const source = read(relativePath);
  const markdownTargets = Array.from(source.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g), (match) => match[1]);
  const htmlTargets = Array.from(source.matchAll(/<img\s+[^>]*src="([^"]+)"/g), (match) => match[1]);
  return [...markdownTargets, ...htmlTargets]
    .filter((target) => !/^https?:\/\//.test(target))
    .map((target) => path.resolve(projectRoot, path.dirname(relativePath), target));
}

test('README presents the product, evidence, visual tour, and private-release boundaries', () => {
  const readme = read('README.md');

  assert.match(readme, /design\/prototype-v3\/assets\/scene-protected-garden\.jpg/);
  assert.match(readme, /actions\/workflows\/ci\.yml\/badge\.svg/);
  assert.match(readme, /version-3\.0\.0/);
  assert.match(readme, /228%20passing/);
  assert.match(readme, /design\/prototype-v3\/README\.md/);
  assert.match(readme, /8jtVG6uk2Z45OhUXbqLHHX/);
  assert.match(readme, /docs\/README\.md/);
  assert.match(readme, /docs\/page-catalog\.md/);
  assert.match(readme, /docs\/faq\.md/);
  assert.match(readme, /docs\/product-tour\.md/);
  assert.match(readme, /docs\/visual-language\.md/);
  assert.match(readme, /```mermaid/);
  assert.match(readme, /不接真实支付/);
  assert.match(readme, /固定两人关系|固定两人私人版/);
  assert.match(readme, /2026-07-22 提交微信审核/);
  assert.match(readme, /审核中，尚未点击发布/);
  assert.match(readme, /兼容协议标识/);
  assert.doesNotMatch(readme, /私人版 V2 体验|为 V2 新增动效素材/);

  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.version, '3.0.0');
});

test('generated README hero is a bounded non-empty JPEG outside the mini-program package', () => {
  const heroPath = path.join(projectRoot, 'docs/illustrations/heart-tree-readme-hero.jpg');
  const hero = fs.readFileSync(heroPath);

  assert.equal(hero[0], 0xff);
  assert.equal(hero[1], 0xd8);
  assert.equal(hero[2], 0xff);
  assert.ok(hero.length > 100 * 1024, 'hero should contain a real high-detail illustration');
  assert.ok(hero.length < 800 * 1024, 'README artwork should stay reasonably small for GitHub visitors');
  assert.equal(heroPath.startsWith(path.join(projectRoot, 'miniprogram')), false);
});

test('product tour references every committed screen and motion poster', () => {
  const tour = read('docs/product-tour.md');
  const screenshots = [
    '01-participant-home.png',
    '02-checkin.png',
    '03-adventure-map.png',
    '04-reward-shop.png',
    '05-sponsor-home.png',
    '06-messages.png',
    '07-weekly-recap.png',
    '08-wallet.png',
    '09-redemptions.png',
    '10-sponsor-review.png',
    '11-sponsor-rules.png',
    '12-sponsor-payouts.png',
    '13-admin-rewards.png'
  ];
  const posters = [
    'binding.jpg',
    'check-in.jpg',
    'approval.jpg',
    'encouragement.jpg',
    'streak-3.jpg',
    'streak-7.jpg',
    'streak-14.jpg',
    'map-complete.jpg',
    'badge-unlock.jpg',
    'redemption.jpg',
    'wish-fund-complete.jpg',
    'weekly-recap.jpg',
    'companion-empty.jpg'
  ];

  screenshots.forEach((name) => {
    assert.match(tour, new RegExp(name.replace('.', '\\.')));
    assert.ok(fs.existsSync(path.join(projectRoot, 'docs/screenshots', name)));
  });
  posters.forEach((name) => {
    assert.match(tour, new RegExp(name.replace('.', '\\.')));
    assert.ok(fs.existsSync(path.join(projectRoot, 'miniprogram/assets/motion', name)));
  });
  [
    'README.md',
    'docs/README.md',
    'docs/product-tour.md',
    'docs/page-catalog.md',
    'docs/visual-language.md'
  ].forEach((relativePath) => {
    localImageTargets(relativePath).forEach((target) => {
      assert.ok(fs.existsSync(target), `${relativePath} references missing image ${path.relative(projectRoot, target)}`);
    });
  });
});

test('documentation portal and FAQ route readers without weakening private-product boundaries', () => {
  const portal = read('docs/README.md');
  const faq = read('docs/faq.md');

  ['第一次了解产品', '准备部署', '安全与隐私', '发布验收'].forEach((term) => {
    assert.match(portal, new RegExp(term));
  });
  ['固定两人', '手动兑现', 'project.private.config.json', 'buildTag', '可信 OPENID',
    'check:shared', '内容安全', '三级降级', '数据删除', 'check:docs']
    .forEach((term) => assert.match(faq, new RegExp(term)));
  assert.match(faq, /不接真实支付/);
  assert.match(faq, /不会.*多租户|不.*公共多租户/);
});

test('page catalog documents every app route and the eight expanded simulator views', () => {
  const catalog = read('docs/page-catalog.md');
  const appConfig = JSON.parse(read('miniprogram/app.json'));

  assert.equal(appConfig.pages.length, 22);
  appConfig.pages.forEach((route) => {
    assert.match(catalog, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), route);
  });
  [
    '06-messages.png',
    '07-weekly-recap.png',
    '08-wallet.png',
    '09-redemptions.png',
    '10-sponsor-review.png',
    '11-sponsor-rules.png',
    '12-sponsor-payouts.png',
    '13-admin-rewards.png'
  ].forEach((name) => assert.match(catalog, new RegExp(name.replace('.', '\\.'))));
  assert.match(catalog, /虚构演示数据/);
  assert.match(catalog, /非双账号真机验收证据/);
});

test('documentation gallery keeps thirteen screens and three bounded original illustrations', () => {
  const screenshots = fs.readdirSync(path.join(projectRoot, 'docs/screenshots'))
    .filter((name) => /^\d{2}-.+\.png$/.test(name));
  const illustrations = [
    'heart-tree-readme-hero.jpg',
    'couple-journey.jpg',
    'trust-safety-garden.jpg'
  ];

  assert.equal(screenshots.length, 13);
  illustrations.forEach((name) => {
    const file = fs.readFileSync(path.join(projectRoot, 'docs/illustrations', name));
    assert.deepEqual(Array.from(file.subarray(0, 3)), [0xff, 0xd8, 0xff], `${name} must be a JPEG`);
    assert.ok(file.length > 100 * 1024, `${name} should contain a real high-detail illustration`);
    assert.ok(file.length <= 800 * 1024, `${name} exceeds the documentation per-image budget`);
    if (name !== 'heart-tree-readme-hero.jpg') {
      assert.ok(file.length <= 600 * 1024, `${name} exceeds the generated illustration budget`);
    }
  });
});

test('V3 prototype source keeps the complete asset set and private-product boundaries', () => {
  const handoff = read('design/prototype-v3/README.md');
  const assets = fs.readdirSync(path.join(projectRoot, 'design/prototype-v3/assets'))
    .filter((name) => name.endsWith('.jpg'));

  assert.equal(assets.length, 12);
  assert.match(handoff, /47 张业务画板/);
  assert.match(handoff, /固定两人私人版/);
  assert.match(handoff, /不接微信支付/);
  assert.match(handoff, /远程 MP4 → 本地 poster → 原生静态三级降级/);
  assets.forEach((name) => {
    const image = fs.readFileSync(path.join(projectRoot, 'design/prototype-v3/assets', name));
    assert.deepEqual(Array.from(image.subarray(0, 3)), [0xff, 0xd8, 0xff], name);
    assert.ok(image.length <= 600 * 1024, `${name} exceeds the V3 source-image budget`);
  });
});
