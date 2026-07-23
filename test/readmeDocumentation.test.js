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
  assert.match(readme, /version-3\.1\.0/);
  assert.match(readme, /239%20passing/);
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
  assert.match(readme, /3\.0\.0.*2026-07-23.*正式发布/);
  assert.match(readme, /3\.1\.0.*候选/);
  assert.match(readme, /双方.*两次确认|两次警告.*双方确认/);
  assert.doesNotMatch(readme, /私人版 V2 体验|为 V2 新增动效素材/);
  assert.doesNotMatch(readme, /docs\/screenshots|assets\/motion\/.*\.jpg|assets\/generated\/tree-level/);
  assert.match(readme, /旧版粉色模拟器截图和熊兔营销插画已经从当前文档移除/);

  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.version, '3.1.0');
});

test('V3 README hero is a bounded non-empty JPEG outside the mini-program package', () => {
  const heroPath = path.join(projectRoot, 'design/prototype-v3/assets/scene-protected-garden.jpg');
  const hero = fs.readFileSync(heroPath);

  assert.equal(hero[0], 0xff);
  assert.equal(hero[1], 0xd8);
  assert.equal(hero[2], 0xff);
  assert.ok(hero.length > 100 * 1024, 'hero should contain a real high-detail illustration');
  assert.ok(hero.length <= 600 * 1024, 'README artwork should stay inside the V3 image budget');
  assert.equal(heroPath.startsWith(path.join(projectRoot, 'miniprogram')), false);
});

test('current documentation uses every V3 visual asset and no retired screenshot or poster gallery', () => {
  const tour = read('docs/product-tour.md');
  const v3Assets = [
    'duo-binding.jpg', 'duo-celebration.jpg', 'duo-growth.jpg',
    'scene-checkin.jpg', 'scene-map.jpg', 'scene-protected-garden.jpg', 'scene-reward.jpg',
    'tree-stage-1.jpg', 'tree-stage-2.jpg', 'tree-stage-3.jpg', 'tree-stage-4.jpg', 'tree-stage-5.jpg'
  ];

  v3Assets.forEach((name) => {
    assert.match(tour, new RegExp(name.replace('.', '\\.')));
    assert.ok(fs.existsSync(path.join(projectRoot, 'design/prototype-v3/assets', name)));
  });
  assert.doesNotMatch(tour, /screenshots\/|miniprogram\/assets\/(?:motion|generated)\/[^)\s]+\.(?:jpe?g|png)/);
  [
    'README.md',
    'docs/README.md',
    'docs/product-tour.md',
    'docs/page-catalog.md',
    'docs/visual-language.md'
  ].forEach((relativePath) => {
    const source = read(relativePath);
    assert.doesNotMatch(source, /!\[[^\]]*\]\([^)]*(?:docs\/screenshots|docs\/illustrations|miniprogram\/assets\/(?:generated|motion|stitch-original))/);
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

test('page catalog documents every app route and links the V3 visual baseline', () => {
  const catalog = read('docs/page-catalog.md');
  const appConfig = JSON.parse(read('miniprogram/app.json'));

  assert.equal(appConfig.pages.length, 22);
  appConfig.pages.forEach((route) => {
    assert.match(catalog, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), route);
  });
  ['scene-checkin.jpg', 'scene-map.jpg', 'scene-reward.jpg', 'scene-protected-garden.jpg']
    .forEach((name) => assert.match(catalog, new RegExp(name.replace('.', '\\.'))));
  assert.doesNotMatch(catalog, /screenshots\//);
  assert.match(catalog, /不是微信开发者工具或双账号真机验收证据/);
});

test('documentation gallery removes retired V2 images and keeps twelve bounded V3 assets', () => {
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs/screenshots')), false);
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs/illustrations')), false);
  const v3Assets = fs.readdirSync(path.join(projectRoot, 'design/prototype-v3/assets'))
    .filter((name) => name.endsWith('.jpg'));

  assert.equal(v3Assets.length, 12);
  v3Assets.forEach((name) => {
    const file = fs.readFileSync(path.join(projectRoot, 'design/prototype-v3/assets', name));
    assert.deepEqual(Array.from(file.subarray(0, 3)), [0xff, 0xd8, 0xff], `${name} must be a JPEG`);
    assert.ok(file.length > 100 * 1024, `${name} should contain a real high-detail illustration`);
    assert.ok(file.length <= 600 * 1024, `${name} exceeds the V3 illustration budget`);
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
