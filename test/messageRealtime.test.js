const assert = require('node:assert/strict');
const test = require('node:test');

function createDbHarness() {
  const calls = [];
  const watchers = [];
  const db = {
    collection(name) {
      calls.push(['collection', name]);
      return {
        where(filter) {
          calls.push(['where', filter]);
          return {
            orderBy(field, direction) {
              calls.push(['orderBy', field, direction]);
              return {
                limit(value) {
                  calls.push(['limit', value]);
                  return {
                    watch(options) {
                      calls.push(['watch']);
                      const watcher = { closed: false, close() { this.closed = true; } };
                      watchers.push({ watcher, options });
                      return watcher;
                    }
                  };
                }
              };
            },
            watch(options) {
              calls.push(['watch']);
              const watcher = { closed: false, close() { this.closed = true; } };
              watchers.push({ watcher, options });
              return watcher;
            }
          };
        }
      };
    }
  };
  return { db, calls, watchers };
}

test('realtime listeners scope every query to recipient openid and close cleanly', () => {
  const { createMessageRealtime } = require('../miniprogram/services/messageRealtime');
  const { db, calls, watchers } = createDbHarness();
  const realtime = createMessageRealtime({ db });

  const stateWatcher = realtime.watchUnread({ openid: 'openid-a', onChange() {}, onError() {} });
  const inboxWatcher = realtime.watchInbox({ openid: 'openid-a', onChange() {}, onError() {} });

  const whereCalls = calls.filter(([kind]) => kind === 'where');
  assert.deepEqual(whereCalls, [
    ['where', { recipientOpenid: 'openid-a' }],
    ['where', { recipientOpenid: 'openid-a' }]
  ]);
  assert.ok(calls.some((item) => item[0] === 'orderBy' && item[1] === 'sortKey' && item[2] === 'desc'));
  assert.ok(calls.some((item) => item[0] === 'limit' && item[1] === 30));
  stateWatcher.close();
  inboxWatcher.close();
  assert.equal(watchers.every(({ watcher }) => watcher.closed), true);
});

test('tab unread helper caps badge at 99+ and removes zero badge', () => {
  const { updateMessageTabBadge } = require('../miniprogram/services/messageRealtime');
  const badgeCalls = [];
  const wxApi = {
    setTabBarBadge(options) { badgeCalls.push(['set', options]); },
    removeTabBarBadge(options) { badgeCalls.push(['remove', options]); }
  };
  updateMessageTabBadge(wxApi, 108);
  updateMessageTabBadge(wxApi, 0);
  assert.deepEqual(badgeCalls, [
    ['set', { index: 4, text: '99+' }],
    ['remove', { index: 4 }]
  ]);
});

test('app lifecycle starts unread watch in foreground and closes it in background', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../miniprogram/app.js'), 'utf8');
  assert.match(source, /startMessageUnreadWatch/);
  assert.match(source, /onShow\(\)/);
  assert.match(source, /onHide\(\)/);
  assert.match(source, /messageUnreadWatcher\.close\(\)/);
});
