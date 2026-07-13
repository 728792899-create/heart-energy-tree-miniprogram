const assert = require('node:assert/strict');
const test = require('node:test');

test('cloud call failures log only action and bounded error metadata', async () => {
  const apiPath = require.resolve('../miniprogram/services/api');
  const previousWx = global.wx;
  const previousConsoleError = console.error;
  const rawError = new Error('must-not-log-secret-payload');
  rawError.errCode = -1;
  rawError.errMsg = 'callFunction:fail network error';
  rawError.code = 'NETWORK_ERROR';
  rawError.payload = { privateNote: 'must-not-appear' };
  const logs = [];

  try {
    global.wx = {
      cloud: {
        callFunction: async () => { throw rawError; }
      }
    };
    console.error = (...args) => logs.push(args);
    delete require.cache[apiPath];
    const api = require('../miniprogram/services/api');

    await assert.rejects(api.queryDashboard(), (error) => error === rawError);

    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], '[energy-tree] cloud function call failed');
    assert.deepEqual(logs[0][1], {
      action: 'queryDashboard',
      errCode: -1,
      errMsg: 'callFunction:fail network error',
      code: 'NETWORK_ERROR'
    });
    assert.equal(JSON.stringify(logs).includes('must-not-log-secret-payload'), false);
    assert.equal(JSON.stringify(logs).includes('must-not-appear'), false);
  } finally {
    delete require.cache[apiPath];
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
    console.error = previousConsoleError;
  }
});
