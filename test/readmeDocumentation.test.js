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

  assert.match(readme, /docs\/illustrations\/heart-tree-readme-hero\.jpg/);
  assert.match(readme, /actions\/workflows\/ci\.yml\/badge\.svg/);
  assert.match(readme, /222%20passing/);
  assert.match(readme, /docs\/product-tour\.md/);
  assert.match(readme, /docs\/visual-language\.md/);
  assert.match(readme, /```mermaid/);
  assert.match(readme, /不接真实支付/);
  assert.match(readme, /固定两人关系|固定两人私人版/);
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
    '05-sponsor-home.png'
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
  ['README.md', 'docs/product-tour.md', 'docs/visual-language.md'].forEach((relativePath) => {
    localImageTargets(relativePath).forEach((target) => {
      assert.ok(fs.existsSync(target), `${relativePath} references missing image ${path.relative(projectRoot, target)}`);
    });
  });
});
