const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'core/models.js',
  'core/rewardEngine.js',
  'utils/date.js',
  'services/manualPayoutProvider.js',
  'services/storage.js',
  'services/inputPolicy.js',
  'services/appService.js'
];
const FLAT_RUNTIME_FILES = {
  'core/models.js': 'cloudRuntimeModels.js',
  'core/rewardEngine.js': 'cloudRuntimeRewardEngine.js',
  'utils/date.js': 'cloudRuntimeDate.js',
  'services/manualPayoutProvider.js': 'cloudRuntimeManualPayoutProvider.js',
  'services/storage.js': 'cloudRuntimeStorage.js',
  'services/inputPolicy.js': 'cloudRuntimeInputPolicy.js',
  'services/appService.js': 'cloudRuntimeAppService.js'
};

function flattenRuntimeRequires(relativePath, source) {
  const replacements = {
    'core/rewardEngine.js': [
      ["require('./models')", "require('./cloudRuntimeModels')"],
      ["require('../utils/date')", "require('./cloudRuntimeDate')"]
    ],
    'services/manualPayoutProvider.js': [
      ["require('../core/models')", "require('./cloudRuntimeModels')"]
    ],
    'services/inputPolicy.js': [
      ["require('../core/models')", "require('./cloudRuntimeModels')"],
      ["require('../core/rewardEngine')", "require('./cloudRuntimeRewardEngine')"]
    ],
    'services/appService.js': [
      ["require('../core/models')", "require('./cloudRuntimeModels')"],
      ["require('../core/rewardEngine')", "require('./cloudRuntimeRewardEngine')"],
      ["require('../utils/date')", "require('./cloudRuntimeDate')"],
      ["require('./manualPayoutProvider')", "require('./cloudRuntimeManualPayoutProvider')"],
      ["require('./storage')", "require('./cloudRuntimeStorage')"],
      ["require('./inputPolicy')", "require('./cloudRuntimeInputPolicy')"]
    ]
  };
  return (replacements[relativePath] || []).reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    source
  );
}
const checkOnly = process.argv.includes('--check');
const drifts = [];

FILES.forEach((relativePath) => {
  const sourcePath = path.join(ROOT, 'miniprogram', relativePath);
  const source = fs.readFileSync(sourcePath);
  const targets = [
    {
      label: relativePath,
      path: path.join(ROOT, 'cloudfunctions/energyTree/miniprogram', relativePath),
      content: source
    },
    {
      label: FLAT_RUNTIME_FILES[relativePath],
      path: path.join(ROOT, 'cloudfunctions/energyTree', FLAT_RUNTIME_FILES[relativePath]),
      content: Buffer.from(flattenRuntimeRequires(relativePath, source.toString('utf8')))
    }
  ];

  targets.forEach((target) => {
    const current = fs.existsSync(target.path) ? fs.readFileSync(target.path) : null;
    if (current && target.content.equals(current)) return;
    drifts.push(target.label);
    if (!checkOnly) {
      fs.mkdirSync(path.dirname(target.path), { recursive: true });
      fs.writeFileSync(target.path, target.content);
    }
  });
});

if (checkOnly && drifts.length) {
  process.stderr.write(`共享业务代码存在漂移：${drifts.join(', ')}\n请先运行 npm run sync:shared。\n`);
  process.exitCode = 1;
} else if (drifts.length) {
  process.stdout.write(`已同步共享业务代码：${drifts.join(', ')}\n`);
} else {
  process.stdout.write('共享业务代码一致。\n');
}
