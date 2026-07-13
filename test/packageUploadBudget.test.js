const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const miniprogramRoot = path.join(projectRoot, 'miniprogram');
const projectConfigPath = path.join(projectRoot, 'project.config.json');
const MAX_MAIN_PACKAGE_BYTES = Math.floor(1.9 * 1024 * 1024);

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

test('upload source keeps safety headroom below the 2MB main-package limit', () => {
  const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
  const ignoredFiles = new Set(
    (config.packOptions && config.packOptions.ignore || [])
      .filter((entry) => entry && entry.type === 'file')
      .map((entry) => entry.value.replace(/^\/+/, ''))
  );
  const includedBytes = walkFiles(miniprogramRoot).reduce((total, absolutePath) => {
    const relativePath = path.relative(miniprogramRoot, absolutePath).split(path.sep).join('/');
    return ignoredFiles.has(relativePath) ? total : total + fs.statSync(absolutePath).size;
  }, 0);

  assert.ok(
    includedBytes <= MAX_MAIN_PACKAGE_BYTES,
    `main package source is ${includedBytes} bytes, exceeding ${MAX_MAIN_PACKAGE_BYTES}`
  );
});
