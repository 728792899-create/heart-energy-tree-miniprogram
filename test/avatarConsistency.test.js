const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const pagesRoot = path.join(projectRoot, 'miniprogram/pages');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function collectFiles(root, extension, result = []) {
  fs.readdirSync(root, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, extension, result);
    if (entry.isFile() && entry.name.endsWith(extension)) result.push(fullPath);
  });
  return result;
}

test('user avatar images never bind directly to avatarUrl', () => {
  const violations = [];
  collectFiles(pagesRoot, '.wxml').forEach((filePath) => {
    const markup = fs.readFileSync(filePath, 'utf8');
    const imageTags = markup.match(/<image\b[\s\S]*?>/g) || [];
    imageTags.forEach((tag) => {
      if (/avatarUrl/.test(tag)) {
        violations.push(`${path.relative(projectRoot, filePath)}: ${tag.replace(/\s+/g, ' ')}`);
      }
    });
  });
  assert.deepEqual(violations, []);
});

test('profile and companion detail pages resolve stored avatars through media.avatarSource', () => {
  const profile = read('miniprogram/pages/profile/profile.js');
  const profileEdit = read('miniprogram/pages/profile-edit/profile-edit.js');
  const detailPages = [
    'sponsor-companion-history',
    'sponsor-companion-badges',
    'sponsor-companion-ledgers'
  ];

  assert.match(profile, /require\('\.\.\/\.\.\/services\/media'\)/);
  assert.match(profile, /avatarSrc:\s*media\.avatarSource\(user\)/);
  assert.match(profileEdit, /require\('\.\.\/\.\.\/services\/media'\)/);
  assert.match(profileEdit, /avatarPreview:\s*media\.avatarSource\(user\)/);

  detailPages.forEach((pageName) => {
    const source = read(`miniprogram/pages/${pageName}/${pageName}.js`);
    assert.match(source, /require\('\.\.\/\.\.\/services\/media'\)/, pageName);
    assert.match(source, /avatarSrc:\s*media\.avatarSource\(companionUser\)/, pageName);
  });
});

test('companion history badges and ledgers render avatarSrc with text fallback', () => {
  [
    'sponsor-companion-history',
    'sponsor-companion-badges',
    'sponsor-companion-ledgers'
  ].forEach((pageName) => {
    const markup = read(`miniprogram/pages/${pageName}/${pageName}.wxml`);
    assert.match(markup, /<image\s+wx:if="\{\{companionUser\.avatarSrc\}\}"[^>]*src="\{\{companionUser\.avatarSrc\}\}"/s, pageName);
    assert.match(markup, /wx:else[^>]*>\{\{companionUser\.avatarText \|\| '她'\}\}/s, pageName);
  });
});
