function nextBottomAnchor(scrollNonce) {
  const nextNonce = Math.max(0, Number(scrollNonce) || 0) + 1;
  const bottomAnchorId = `messages-end-${nextNonce}`;
  return { scrollNonce: nextNonce, bottomAnchorId };
}


function bottomScrollTarget(bottomAnchorId, animate) {
  return {
    scrollIntoView: String(bottomAnchorId || ''),
    scrollWithAnimation: Boolean(animate)
  };
}

function keyboardComposerState(height) {
  const keyboardHeight = Math.max(0, Number(height) || 0);
  return {
    keyboardHeight,
    keyboardOpen: keyboardHeight > 0,
    inputFocused: keyboardHeight > 0
  };
}

function unseenAfterWatcher(state, addedCount) {
  const count = Math.max(0, Number(addedCount) || 0);
  if (!count) {
    return { newMessageCount: 0, hasUnseenMessages: false, shouldScroll: false };
  }
  const newMessageCount = Math.max(0, Number(state && state.newMessageCount) || 0) + count;
  return { newMessageCount, hasUnseenMessages: newMessageCount > 0, shouldScroll: false };
}

function shouldCompensateMediaScroll(pendingMessageId, loadedMessageId, alreadyCompensated) {
  return Boolean(pendingMessageId && pendingMessageId === loadedMessageId && !alreadyCompensated);
}

module.exports = {
  nextBottomAnchor,
  bottomScrollTarget,
  keyboardComposerState,
  unseenAfterWatcher,
  shouldCompensateMediaScroll
};
