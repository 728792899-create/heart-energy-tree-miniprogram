const { chinaDateTimeParts } = require('../utils/date');

function displayTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const parts = chinaDateTimeParts(date);
  return `${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function normalizeMessage(message, currentUser) {
  if (!message) return message;
  const normalized = {
    ...message,
    displayTime: displayTime(message.createdAt)
  };
  if (message.type === 'chat') {
    normalized.contentType = message.contentType || 'text';
    const currentUserId = currentUser && currentUser.id;
    normalized.isOwn = currentUserId && message.senderUserId
      ? message.senderUserId === currentUserId
      : Boolean(message.isOwn);
    if (normalized.contentType === 'request') {
      const statusText = {
        pending: '等待回应',
        accepted: '已同意',
        later: '稍后再说',
        declined: '已婉拒',
        cancelled: '已撤回'
      };
      normalized.requestSource = message.requestSource || 'preset';
      normalized.requestStatus = message.requestStatus || 'pending';
      normalized.requestStatusText = statusText[normalized.requestStatus] || '已处理';
      normalized.respondedDisplayTime = message.respondedAt ? displayTime(message.respondedAt) : '';
      normalized.canCancelRequest = normalized.requestStatus === 'pending' && normalized.isOwn;
      normalized.canRespondRequest = normalized.requestStatus === 'pending'
        && !normalized.isOwn
        && (!message.requestRecipientUserId || message.requestRecipientUserId === currentUserId);
    }
    if (normalized.contentType === 'request-response') {
      const decisionText = { accepted: '同意', later: '稍后再说', declined: '婉拒', cancelled: '撤回' };
      normalized.requestDecisionText = decisionText[message.requestDecision] || '处理';
    }
  }
  return normalized;
}

function normalizeDraftInput(value) {
  return String(value || '').slice(0, 200);
}

function normalizeCustomRequestDraft(value) {
  return Array.from(String(value || '')).slice(0, 30).join('');
}

function mergeMessages(current, incoming, currentUser) {
  const byId = new Map();
  [...(current || []), ...(incoming || [])].forEach((message) => {
    if (message && message.messageId) {
      byId.set(message.messageId, normalizeMessage(message, currentUser));
    }
  });
  return Array.from(byId.values()).sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)));
}

module.exports = {
  displayTime,
  normalizeMessage,
  normalizeDraftInput,
  normalizeCustomRequestDraft,
  mergeMessages
};
