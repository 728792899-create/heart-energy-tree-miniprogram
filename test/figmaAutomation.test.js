const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function compileFigmaScript(relativePath) {
  const source = read(relativePath);
  assert.doesNotThrow(
    () => new Function(`return (async()=>{\n${source}\n})`),
    `${relativePath} must compile in the use_figma top-level await/return wrapper`
  );
  assert.doesNotMatch(source, /figma\.notify\s*\(/, `${relativePath} must not call unsupported figma.notify()`);
  assert.doesNotMatch(source, /figma\.closePlugin\s*\(/, `${relativePath} must not close the managed plugin context`);
  return source;
}

test('responsive and motion Figma script creates the approved six viewport boards and two storyboards', () => {
  const source = compileFigmaScript('design/figma/scripts/09-responsive-motion.js');
  const expectedRoots = [
    'Responsive/Home/Girlfriend/375',
    'Responsive/Home/Girlfriend/390',
    'Responsive/Home/Girlfriend/430',
    'Responsive/SponsorReview/375',
    'Responsive/SponsorReview/390',
    'Responsive/SponsorReview/430',
    'Motion/01-GardenGrowth/Storyboard',
    'Motion/02-Ceremony/Storyboard'
  ];

  expectedRoots.forEach((name) => assert.match(source, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(source, /getNodeByIdAsync\(['"]5:11['"]\)/);
  assert.match(source, /375[\s\S]*812/);
  assert.match(source, /390[\s\S]*844/);
  assert.match(source, /430[\s\S]*932/);
  assert.match(source, /cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(source, /120[–-]180\s*ms|120–180ms/);
  assert.match(source, /transform[^\n]+opacity|opacity[^\n]+transform/i);
  assert.equal((source.match(/setCurrentPageAsync\s*\(/g) || []).length, 1, 'one use_figma script must set the current page only once');
});

test('prototype and handoff Figma script links five approved flows without modifying component internals', () => {
  const source = compileFigmaScript('design/figma/scripts/10-prototype-handoff.js');
  const flowNames = [
    '首次绑定',
    '女友成长与奖励',
    '男友守护',
    '每周回顾',
    '资料与设置'
  ];

  assert.match(source, /setReactionsAsync\s*\(/);
  assert.equal((source.match(/setCurrentPageAsync\s*\(/g) || []).length, 1, 'one use_figma script must set the current page only once');
  assert.match(source, /Documentation\/HandoffIndex/);
  assert.match(source, /getNodeByIdAsync\(['"]5:12['"]\)/);
  flowNames.forEach((name) => assert.match(source, new RegExp(name)));
  ['46', '22', '8', '8', '6', '2'].forEach((count) => assert.match(source, new RegExp(`\\b${count}\\b`)));
  assert.match(source, /HOTSPOT_MIN\s*=\s*44/);
  assert.match(source, /Math\.max\(HOTSPOT_MIN,\s*width\)/);
  assert.match(source, /Math\.max\(HOTSPOT_MIN,\s*height\)/);
  assert.match(source, /opacity\s*:\s*0\.01/);
  assert.doesNotMatch(source, /createComponent(?:FromNode)?\s*\(|detachInstance\s*\(|getMainComponentAsync\s*\(|setProperties\s*\(/, 'prototype phase must not modify component or instance internals');
});

test('structural validator is read-only and audits the complete 46-board delivery contract', () => {
  const source = compileFigmaScript('design/figma/scripts/11-validate.js');

  assert.match(source, /loadAllPagesAsync\s*\(/);
  assert.match(source, /physicalPages\s*:\s*3/);
  assert.match(source, /semanticSections\s*:\s*11/);
  assert.match(source, /businessFrames\s*:\s*46/);
  assert.match(source, /coreScreens\s*:\s*22/);
  assert.match(source, /dialogs\s*:\s*8/);
  assert.match(source, /states\s*:\s*8/);
  assert.match(source, /responsive\s*:\s*6/);
  assert.match(source, /motion\s*:\s*2/);
  assert.match(source, /minimumComponents\s*:\s*30/);
  ['Screen/', 'DialogBoard/', 'StateBoard/', 'Responsive/', 'Motion/', 'Documentation/HandoffIndex', 'PrototypeHotspot/'].forEach((name) => {
    assert.match(source, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(source, /hasMissingFont/);
  assert.match(source, /fontSize/);
  assert.match(source, /clipsContent/);
  assert.match(source, /44/);
  assert.match(source, /12/);
  assert.match(source, /reactions/);
  assert.match(source, /severityTotals\[severity\]\s*=\s*\(severityTotals\[severity\]\s*\|\|\s*0\)\s*\+\s*1/, 'mixed warning/blocker rules must retain exact severity totals');
  assert.doesNotMatch(source, /figma\.create[A-Z]\w*\s*\(|\.appendChild\s*\(|\.insertChild\s*\(|\.remove\s*\(|\.resize(?:WithoutConstraints)?\s*\(|setCurrentPageAsync\s*\(|setReactionsAsync\s*\(/, 'validation must not create, modify, or delete Figma nodes');
});
