const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const studioRoot = path.resolve(__dirname, '..');
const outputPath = path.join(studioRoot, 'out/previews/approval.mp4');
mkdirSync(path.dirname(outputPath), { recursive: true });

const result = spawnSync(
  path.join(studioRoot, 'node_modules/.bin/remotion'),
  [
    'render',
    path.join(studioRoot, 'src/index.jsx'),
    'heart-tree-approval',
    outputPath,
    '--codec=h264',
    '--crf=30',
    '--pixel-format=yuv420p',
    '--overwrite'
  ],
  { cwd: studioRoot, stdio: 'inherit' }
);

if (result.error) throw result.error;
process.exitCode = result.status || 0;
