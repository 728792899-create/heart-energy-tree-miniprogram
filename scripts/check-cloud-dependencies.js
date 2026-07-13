const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLOUD_ROOT = path.join(ROOT, 'cloudfunctions');
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const failures = [];
let checked = 0;

fs.readdirSync(CLOUD_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .forEach((entry) => {
    const functionRoot = path.join(CLOUD_ROOT, entry.name);
    const packagePath = path.join(functionRoot, 'package.json');
    if (!fs.existsSync(packagePath)) return;
    checked += 1;
    const lockPath = path.join(functionRoot, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
      failures.push(`${entry.name}: missing package-lock.json`);
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const lockfile = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!Number.isInteger(lockfile.lockfileVersion) || lockfile.lockfileVersion < 2) {
      failures.push(`${entry.name}: package-lock.json must use lockfileVersion >= 2`);
    }
    const manifestDependencies = manifest.dependencies || {};
    const lockedRootDependencies = lockfile.packages && lockfile.packages[''] && lockfile.packages[''].dependencies || {};
    Object.entries(manifestDependencies).forEach(([name, version]) => {
      if (!EXACT_VERSION.test(version)) failures.push(`${entry.name}: ${name} must use an exact version, received ${version}`);
      if (lockedRootDependencies[name] !== version) failures.push(`${entry.name}: ${name} root lock entry differs from package.json`);
      const installed = lockfile.packages && lockfile.packages[`node_modules/${name}`];
      if (!installed || installed.version !== version) failures.push(`${entry.name}: ${name}@${version} is not pinned in package-lock.json`);
      if (!installed || !installed.integrity) failures.push(`${entry.name}: ${name} lock entry is missing integrity`);
    });
  });

if (!checked) failures.push('no cloud function package.json found');

if (failures.length) {
  process.stderr.write(`云函数依赖检查失败：\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`云函数依赖检查通过（${checked} 个函数，均使用精确版本和完整锁文件）。\n`);
}
