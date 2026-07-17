const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const config = require('../miniprogram/config/env');

function loadApiWithCloudBuildTag(buildTag) {
  const apiPath = require.resolve('../miniprogram/services/api');
  global.wx = {
    cloud: {
      async callFunction() {
        return {
          result: {
            ok: true,
            buildTag,
            data: { source: 'cloud' }
          }
        };
      }
    },
    getStorageSync() {
      return '';
    }
  };
  delete require.cache[apiPath];
  return { api: require(apiPath), apiPath };
}

test('successful cloud responses require the exact public client build tag', async (t) => {
  const cloudEntry = fs.readFileSync(path.resolve(__dirname, '../cloudfunctions/energyTree/index.js'), 'utf8');
  const readme = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf8');
  assert.match(cloudEntry, new RegExp(`CLOUD_BUILD_TAG = ['"]${config.buildTag}['"]`));
  assert.match(readme, new RegExp(config.buildTag));

  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  t.after(() => {
    console.error = originalConsoleError;
    delete global.wx;
    delete require.cache[require.resolve('../miniprogram/services/api')];
  });

  for (const buildTag of ['', 'heart-tree-private-v2-stale']) {
    const { api, apiPath } = loadApiWithCloudBuildTag(buildTag);
    await assert.rejects(api.queryDashboard(), (error) => {
      assert.equal(error.code, 'CLOUD_BUILD_MISMATCH');
      assert.equal(error.cloudBuildTag, buildTag);
      assert.match(error.message, /云函数版本过旧/);
      return true;
    });
    delete require.cache[apiPath];
  }

  const { api } = loadApiWithCloudBuildTag(config.buildTag);
  assert.deepEqual(await api.queryDashboard(), { source: 'cloud' });
  assert.equal(logs.length, 2);
  logs.forEach((entry) => {
    assert.equal(entry[0], '[energy-tree] cloud build tag mismatch');
    assert.equal(entry[1].expectedBuildTag, config.buildTag);
    assert.equal(Object.hasOwn(entry[1], 'payload'), false);
  });
});
