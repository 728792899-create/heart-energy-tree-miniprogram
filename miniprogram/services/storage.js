const memory = {};
const scopedStores = [];

function canUseWxStorage() {
  return typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentScopedStore() {
  return scopedStores.length ? scopedStores[scopedStores.length - 1] : null;
}

function get(key, fallback) {
  const scoped = currentScopedStore();
  if (scoped) {
    return Object.prototype.hasOwnProperty.call(scoped, key) ? clone(scoped[key]) : fallback;
  }
  if (canUseWxStorage()) {
    const value = wx.getStorageSync(key);
    return value === '' || value === undefined || value === null ? fallback : value;
  }
  return Object.prototype.hasOwnProperty.call(memory, key) ? clone(memory[key]) : fallback;
}

function set(key, value) {
  const scoped = currentScopedStore();
  if (scoped) {
    scoped[key] = clone(value);
    return;
  }
  if (canUseWxStorage()) {
    wx.setStorageSync(key, value);
    return;
  }
  memory[key] = clone(value);
}

function remove(key) {
  const scoped = currentScopedStore();
  if (scoped) {
    delete scoped[key];
    return;
  }
  if (canUseWxStorage()) {
    wx.removeStorageSync(key);
    return;
  }
  delete memory[key];
}

async function runWithScopedStorage(initialValues, task) {
  const scoped = clone(initialValues || {});
  scopedStores.push(scoped);
  try {
    const result = await task();
    return {
      result,
      values: clone(scoped)
    };
  } finally {
    scopedStores.pop();
  }
}

module.exports = {
  get,
  remove,
  runWithScopedStorage,
  set
};
