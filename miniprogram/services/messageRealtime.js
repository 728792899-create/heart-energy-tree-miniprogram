function getDefaultDb() {
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.database !== 'function') {
    throw new Error('当前环境不能建立信笺实时连接');
  }
  return wx.cloud.database();
}

function safeCallback(callback, value) {
  if (typeof callback === 'function') callback(value);
}

function createMessageRealtime(options = {}) {
  const db = options.db || getDefaultDb();

  function watchUnread(input = {}) {
    const openid = String(input.openid || '').trim();
    if (!openid) throw new Error('缺少当前用户 openid');
    return db.collection('coupleMessageStates')
      .where({ recipientOpenid: openid })
      .watch({
        onChange(snapshot) {
          const doc = snapshot && snapshot.docs && snapshot.docs[0];
          safeCallback(input.onChange, Number((doc && doc.unreadCount) || 0));
        },
        onError(error) {
          safeCallback(input.onError, error);
        }
      });
  }

  function watchInbox(input = {}) {
    const openid = String(input.openid || '').trim();
    if (!openid) throw new Error('缺少当前用户 openid');
    return db.collection('coupleMessageInbox')
      .where({ recipientOpenid: openid })
      .orderBy('sortKey', 'desc')
      .limit(30)
      .watch({
        onChange(snapshot) {
          const messages = ((snapshot && snapshot.docs) || [])
            .slice()
            .sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)));
          safeCallback(input.onChange, messages);
        },
        onError(error) {
          safeCallback(input.onError, error);
        }
      });
  }

  return { watchInbox, watchUnread };
}

function updateMessageTabBadge(wxApi, unreadCount) {
  const count = Math.max(0, Number(unreadCount) || 0);
  if (!wxApi) return;
  if (count > 0 && typeof wxApi.setTabBarBadge === 'function') {
    wxApi.setTabBarBadge({ index: 4, text: count > 99 ? '99+' : String(count) });
    return;
  }
  if (typeof wxApi.removeTabBarBadge === 'function') {
    wxApi.removeTabBarBadge({ index: 4 });
  }
}

module.exports = { createMessageRealtime, updateMessageTabBadge };
