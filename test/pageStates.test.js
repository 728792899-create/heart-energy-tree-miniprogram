const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const recoverableDataPages = [
  'adventure-map',
  'shop',
  'history',
  'profile',
  'reward-detail',
  'wallet',
  'redemptions',
  'sponsor-review',
  'sponsor-payouts',
  'sponsor-rules',
  'admin-rewards',
  'sponsor-companion-history',
  'sponsor-companion-badges',
  'sponsor-companion-ledgers',
  'sponsor-companion-redemptions'
];

function readPage(pageName, extension) {
  return fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages', pageName, `${pageName}.${extension}`),
    'utf8'
  );
}

test('every remote data page exposes loading, retryable error, and isolated content states', () => {
  const violations = [];

  recoverableDataPages.forEach((pageName) => {
    const script = readPage(pageName, 'js');
    const markup = readPage(pageName, 'wxml');

    if (!/loading:\s*true/.test(script)) violations.push(`${pageName}: missing initial loading state`);
    if (!/errorMessage:\s*['"]{2}/.test(script)) violations.push(`${pageName}: missing error message state`);
    if (!/this\.setData\(\{\s*loading:\s*true,\s*errorMessage:\s*['"]{2}\s*\}\)/s.test(script)) {
      violations.push(`${pageName}: load does not reset loading and error state`);
    }
    if (!/loading:\s*false/.test(script)) violations.push(`${pageName}: load never settles`);
    if (!/errorMessage:\s*error\.message\s*\|\|/.test(script)) {
      violations.push(`${pageName}: load errors are not rendered in-page`);
    }
    if (!/retryLoad\s*\(\)/.test(script)) violations.push(`${pageName}: missing retry handler`);

    if (!/<state-panel[\s\S]*?wx:if="\{\{loading\}\}"[\s\S]*?state="loading"/.test(markup)) {
      violations.push(`${pageName}: missing loading panel`);
    }
    if (!/<state-panel[\s\S]*?wx:elif="\{\{errorMessage\}\}"[\s\S]*?state="error"[\s\S]*?bindretry="retryLoad"/.test(markup)) {
      violations.push(`${pageName}: missing retryable error panel`);
    }
    if (!/<block\s+wx:else>/.test(markup)) violations.push(`${pageName}: content is not isolated behind wx:else`);
  });

  assert.deepEqual(violations, []);
});
