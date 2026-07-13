const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MINIPROGRAM_ROOT = path.join(ROOT, 'miniprogram');
const LIMITS = Object.freeze({
  mainPackage: Math.floor(1.9 * 1024 * 1024),
  packagedAssets: 1_400 * 1024,
  motionAssets: 400 * 1024,
  soundAssets: 128 * 1024,
  tabBarAssets: 96 * 1024,
  largestAsset: 160 * 1024,
  imagegenSources: 1 * 1024 * 1024
});

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

function sizeOf(directory) {
  return walkFiles(directory).reduce((total, file) => total + fs.statSync(file).size, 0);
}

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
const ignoredFiles = new Set(((config.packOptions && config.packOptions.ignore) || [])
  .filter((entry) => entry && entry.type === 'file')
  .map((entry) => entry.value.replace(/^\/+/, '')));
const packagedFiles = walkFiles(MINIPROGRAM_ROOT).filter((file) => {
  const relativePath = path.relative(MINIPROGRAM_ROOT, file).split(path.sep).join('/');
  return !ignoredFiles.has(relativePath);
});
const packagedAssetFiles = packagedFiles.filter((file) => file.startsWith(path.join(MINIPROGRAM_ROOT, 'assets') + path.sep));
const measurements = {
  mainPackage: packagedFiles.reduce((total, file) => total + fs.statSync(file).size, 0),
  packagedAssets: packagedAssetFiles.reduce((total, file) => total + fs.statSync(file).size, 0),
  motionAssets: sizeOf(path.join(MINIPROGRAM_ROOT, 'assets/motion')),
  soundAssets: sizeOf(path.join(MINIPROGRAM_ROOT, 'assets/sounds')),
  tabBarAssets: sizeOf(path.join(MINIPROGRAM_ROOT, 'assets/tabbar')),
  largestAsset: Math.max(...packagedAssetFiles.map((file) => fs.statSync(file).size)),
  imagegenSources: sizeOf(path.join(ROOT, 'design/imagegen-source'))
};
const failures = Object.entries(measurements)
  .filter(([name, bytes]) => bytes > LIMITS[name])
  .map(([name, bytes]) => `${name}: ${bytes} > ${LIMITS[name]} bytes`);

if (failures.length) {
  process.stderr.write(`包体/素材预算超限：\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ measurements, limits: LIMITS }, null, 2)}\n`);
  process.stdout.write('主包与素材预算检查通过。\n');
}
