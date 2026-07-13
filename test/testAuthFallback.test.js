const assert = require('node:assert/strict');
const test = require('node:test');

const { __private } = require('../cloudfunctions/energyTree/index');

test('__testOpenid fallback requires the explicit test-only environment switch', () => {
  const previous = process.env.ENERGY_TREE_ALLOW_TEST_AUTH;
  try {
    delete process.env.ENERGY_TREE_ALLOW_TEST_AUTH;
    assert.throws(
      () => __private.getAuthContext({ __testOpenid: 'test-openid' }),
      /无法获取可信 openid/
    );

    process.env.ENERGY_TREE_ALLOW_TEST_AUTH = '1';
    assert.deepEqual(
      __private.getAuthContext({ __testOpenid: 'test-openid' }),
      { openid: 'test-openid' }
    );
  } finally {
    if (previous === undefined) delete process.env.ENERGY_TREE_ALLOW_TEST_AUTH;
    else process.env.ENERGY_TREE_ALLOW_TEST_AUTH = previous;
  }
});
