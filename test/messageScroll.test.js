const assert = require('node:assert/strict');
const test = require('node:test');

const {
  nextBottomAnchor,
  bottomScrollTarget,
  keyboardComposerState,
  unseenAfterWatcher,
  shouldCompensateMediaScroll
} = require('../miniprogram/services/messageScroll');

test('local sends prepare a fresh bottom anchor before targeting it', () => {
  assert.deepEqual(nextBottomAnchor(0), {
    scrollNonce: 1,
    bottomAnchorId: 'messages-end-1'
  });
  assert.deepEqual(nextBottomAnchor(8), {
    scrollNonce: 9,
    bottomAnchorId: 'messages-end-9'
  });
  assert.deepEqual(bottomScrollTarget('messages-end-9', false), {
    scrollIntoView: 'messages-end-9',
    scrollWithAnimation: false
  });
  assert.deepEqual(bottomScrollTarget('messages-end-10', true), {
    scrollIntoView: 'messages-end-10',
    scrollWithAnimation: true
  });
});

test('keyboard height controls composer integration without guessing device dimensions', () => {
  assert.deepEqual(keyboardComposerState(326), {
    keyboardHeight: 326,
    keyboardOpen: true,
    inputFocused: true
  });
  assert.deepEqual(keyboardComposerState(0), {
    keyboardHeight: 0,
    keyboardOpen: false,
    inputFocused: false
  });
});

test('new partner watcher messages accumulate a badge without requesting auto scroll', () => {
  assert.deepEqual(unseenAfterWatcher({ newMessageCount: 2, isAtBottom: false }, 3), {
    newMessageCount: 5,
    hasUnseenMessages: true,
    shouldScroll: false
  });
  assert.deepEqual(unseenAfterWatcher({ newMessageCount: 2, isAtBottom: true }, 1), {
    newMessageCount: 3,
    hasUnseenMessages: true,
    shouldScroll: false
  });
});

test('media layout compensation only applies once to the latest local message', () => {
  assert.equal(shouldCompensateMediaScroll('m2', 'm2', false), true);
  assert.equal(shouldCompensateMediaScroll('m2', 'm1', false), false);
  assert.equal(shouldCompensateMediaScroll('m2', 'm2', true), false);
});
