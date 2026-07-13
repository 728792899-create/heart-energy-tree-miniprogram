const { mkdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENES } = require('../src/scene-definitions');

const studioRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(studioRoot, '..');
const outputDirectory = path.join(projectRoot, 'miniprogram/assets/motion');
const remotionBinary = path.join(studioRoot, 'node_modules/.bin/remotion');
const entryPoint = path.join(studioRoot, 'src/index.jsx');
mkdirSync(outputDirectory, { recursive: true });

for (const scene of SCENES) {
  const outputPath = path.join(outputDirectory, `${scene.sceneKey}.jpg`);
  const result = spawnSync(
    remotionBinary,
    [
      'still',
      entryPoint,
      scene.posterId,
      outputPath,
      '--image-format=jpeg',
      '--jpeg-quality=52',
      '--scale=0.5',
      '--overwrite'
    ],
    { cwd: studioRoot, stdio: 'inherit' }
  );

  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
  process.stdout.write(`${scene.sceneKey}: ${statSync(outputPath).size} bytes\n`);
}
