const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOTS = ['miniprogram', 'cloudfunctions', 'scripts', 'motion-studio'];
const IGNORED_DIRECTORIES = new Set(['node_modules', 'out', '.cache']);

function collectJavaScript(directory, files = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (IGNORED_DIRECTORIES.has(entry.name)) return;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScript(absolutePath, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolutePath);
  });
  return files;
}

const files = SOURCE_ROOTS.flatMap((relativePath) => collectJavaScript(path.join(ROOT, relativePath))).sort();
const failures = [];

files.forEach((file) => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${path.relative(ROOT, file)}\n${result.stderr || result.stdout}`);
  }
});

if (failures.length) {
  process.stderr.write(`JavaScript 语法检查失败：\n${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`JavaScript 语法检查通过（${files.length} 个文件，JSX 由 Remotion bundler 单独校验）。\n`);
}
