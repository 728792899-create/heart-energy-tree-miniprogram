const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('weekly recap is registered and provides loading, error, empty, and week navigation states', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  assert.ok(appConfig.pages.includes('pages/weekly-recap/weekly-recap'));

  const script = read('miniprogram/pages/weekly-recap/weekly-recap.js');
  const markup = read('miniprogram/pages/weekly-recap/weekly-recap.wxml');
  const stateMarkup = read('miniprogram/components/state-panel/state-panel.wxml');
  assert.match(script, /api\.queryWeeklyRecap/);
  assert.match(script, /weekOffset/);
  assert.match(markup, /<state-panel/);
  assert.match(markup, /state="loading"/);
  assert.match(markup + stateMarkup, /重新加载/);
  assert.match(markup, /这一周也可以慢慢来/);
  assert.match(markup, /aria-label="查看上一周回顾"/);
  assert.match(markup, /aria-label="查看下一周回顾"/);
});

test('home surfaces unread encouragements, weekly recap, and shared milestones for both roles', () => {
  const script = read('miniprogram/pages/home/home.js');
  const markup = read('miniprogram/pages/home/home.wxml');
  assert.match(script, /api\.queryEncouragements/);
  assert.match(script, /api\.queryMilestones/);
  assert.match(script, /api\.markEncouragementRead/);
  assert.match(markup, /收下抱抱/);
  assert.match(markup, /每周恋爱运动回顾/);
  assert.match(markup, /我们的里程碑/);
});

test('sponsor companion offers five encouragement templates with a protected send action', () => {
  const script = read('miniprogram/pages/sponsor-companion/sponsor-companion.js');
  const markup = read('miniprogram/pages/sponsor-companion/sponsor-companion.wxml');
  const editorMarkup = read('miniprogram/components/encouragement-editor/encouragement-editor.wxml');
  assert.match(script, /api\.sendEncouragement/);
  ['抱抱', '夸夸', '陪练', '轻松一点', '小约会'].forEach((label) => {
    assert.match(script, new RegExp(label));
  });
  assert.match(markup, /<encouragement-editor/);
  assert.match(markup, /templates="\{\{encouragementTemplates\}\}"/);
  assert.match(editorMarkup, /wx:for="\{\{templates\}\}"/);
  assert.match(editorMarkup, /disabled="\{\{sending\}\}"/);
});

test('chat image picking requires privacy authorization with a message-specific explanation', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const privacyService = read('miniprogram/services/privacy.js');
  assert.match(script, /const privacy = require\('\.\.\/\.\.\/services\/privacy'\)/);
  assert.match(script, /await privacy\.ensurePhotoPrivacy\('发送聊天图片'\)/);
  assert.match(script, /if \(!authorized\) return/);
  assert.match(privacyService, /function ensurePhotoPrivacy\(usageLabel/);
  assert.match(privacyService, /需要同意隐私授权后才能\$\{usageLabel\}/);
});

test('letters tab and message page expose the original Stitch interaction contract', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  assert.ok(appConfig.pages.includes('pages/messages/messages'));
  assert.equal(appConfig.tabBar.list.length, 5);
  assert.equal(appConfig.tabBar.list[4].text, '信笺');
  assert.equal(appConfig.tabBar.list[4].pagePath, 'pages/messages/messages');

  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');
  const styles = read('miniprogram/pages/messages/messages.wxss');
  const config = JSON.parse(read('miniprogram/pages/messages/messages.json'));
  assert.equal(config.navigationBarTitleText, '我们的信笺');
  assert.match(script, /bootstrapCoupleMessages/);
  assert.match(script, /queryCoupleMessages/);
  assert.match(script, /sendCoupleMessage/);
  assert.match(script, /markCoupleMessagesRead/);
  assert.match(script, /mergeMessages/);
  assert.match(script, /close\(\)/);
  assert.match(markup, /<state-panel/);
  assert.match(markup, /state="loading"/);
  assert.match(markup, /bindretry="retryLoad"/);
  assert.match(markup, /maxlength="200"/);
  assert.match(markup, /今天也很想你/);
  assert.match(markup, /辛苦啦，抱抱你/);
  assert.match(markup, /记得好好休息/);
  assert.match(markup, /有你在真好/);
  assert.match(markup, /查看更早信笺/);
  assert.match(markup, /message\.type === 'chat'/);
  assert.match(markup, /message\.type === 'system'/);
  assert.match(markup, /message\.type === 'encouragement'/);
  assert.match(styles, /align-items:\s*center/);
  assert.match(styles, /justify-content:\s*center/);
});

test('home replaces modal view notices with a dismissible low-interruption banner', () => {
  const script = read('miniprogram/pages/home/home.js');
  const markup = read('miniprogram/pages/home/home.wxml');
  assert.doesNotMatch(script, /wx\.showModal\([\s\S]*?有人想你啦/);
  assert.match(script, /dismissViewNotice/);
  assert.match(script, /openMessages/);
  assert.match(script, /api\.markViewNoticesRead/);
  assert.match(markup, /viewNotice/);
  assert.match(markup, /还有 \{\{viewNoticeExtraCount\}\} 条关心已收进信笺/);
  assert.match(markup, /bindtap="openMessages"/);
  assert.match(markup, /catchtap="dismissViewNotice"/);
});


test('letters refresh conversation identity on every show and after a newly watched message', () => {
  const script = read('miniprogram/pages/messages/messages.js');

  assert.match(script, /onShow\(\)[\s\S]{0,160}this\.resumeConversation\(\);/);
  assert.match(script, /async refreshConversationContext\(options = \{\}\)/);
  assert.match(script, /api\.queryCoupleMessages\(\{ limit: 1 \}\)/);
  assert.match(script, /currentAvatarSrc:\s*avatarSrc\(currentUser\)/);
  assert.match(script, /companionAvatarSrc:\s*avatarSrc\(companionUser\)/);
  assert.match(script, /if \(hadNewMessage\) this\.refreshConversationContext/);
  assert.doesNotMatch(script, /refreshConversationContext[\s\S]{0,900}bootstrapCoupleMessages/);
});

test('letters expose image sending, sticker catalog, preview, and mutually exclusive composer panels', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');
  const styles = read('miniprogram/pages/messages/messages.wxss');

  assert.match(script, /queryCoupleStickerCatalog/);
  assert.match(script, /wx\.chooseMedia/);
  assert.match(script, /uploadCoupleMessageImage/);
  assert.match(script, /wx\.previewImage/);
  assert.match(script, /sendSticker/);
  assert.match(markup, /class="composer-toolbar"/);
  assert.match(markup, /bindtap="toggleMorePanel"/);
  assert.match(markup, /bindtap="toggleStickerPanel"/);
  assert.match(markup, /message\.contentType === 'image'/);
  assert.match(markup, /message\.contentType === 'sticker'/);
  assert.match(markup, /class="sticker-panel"/);
  assert.doesNotMatch(markup, /<textarea[\s\S]{0,360}\sfixed(?:\s|>)/);
  assert.doesNotMatch(markup, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.composer-toolbar\s*\{[^}]*display\s*:\s*flex/s);
  assert.match(styles, /\.sticker-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4,/s);
});

test('letters keep quick greetings above a WeChat-style toolbar and expose bidirectional request cards', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');
  const styles = read('miniprogram/pages/messages/messages.wxss');

  assert.match(markup, /class="quick-bar"/);
  assert.match(markup, /傲娇请求/);
  assert.ok(markup.indexOf('class="quick-bar"') < markup.indexOf('class="composer-toolbar"'));
  assert.match(markup, /role="button"[^>]*aria-label="打开更多发送方式"/);
  assert.match(markup, /role="button"[^>]*aria-label="打开情侣表情"/);
  assert.doesNotMatch(markup, /<button[^>]*class="composer-icon-button"/);
  assert.match(markup, /message\.contentType === 'request'/);
  assert.match(markup, /message\.contentType === 'request-response'/);
  assert.match(markup, /同意/);
  assert.match(markup, /稍后再说/);
  assert.match(markup, /婉拒/);
  assert.match(markup, /撤回请求/);
  assert.match(markup, /message\.consentNotice/);
  assert.match(script, /queryCoupleRequestCatalog/);
  assert.match(script, /sendCoupleRequest/);
  assert.match(script, /respondCoupleRequest/);
  assert.match(script, /cancelCoupleRequest/);
  assert.match(styles, /\.request-card/);
});

test('letters use dynamic bottom anchors and do not auto-scroll partner watcher messages', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');

  assert.match(script, /bottomAnchorId:\s*'messages-end-0'/);
  assert.match(script, /scrollAfterLocalSend\(messageId/);
  assert.doesNotMatch(script, /scrollIntoView:\s*''/);
  assert.match(markup, /id="\{\{bottomAnchorId\}\}"/);
  assert.match(markup, /bindscrolltolower="onScrollToLower"/);
  assert.match(markup, /有 \{\{newMessageCount\}\} 条新信笺/);
  assert.match(markup, /bindtap="showNewestMessages"/);
});

test('letters integrate the composer with the native keyboard and restore the tab bar safely', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');
  const styles = read('miniprogram/pages/messages/messages.wxss');

  assert.match(markup, /scroll-with-animation="\{\{scrollWithAnimation\}\}"/);
  assert.match(markup, /bindfocus="onComposerFocus"/);
  assert.match(markup, /bindblur="onComposerBlur"/);
  assert.match(markup, /bindkeyboardheightchange="onKeyboardHeightChange"/);
  assert.match(script, /inputFocused:\s*false/);
  assert.match(script, /keyboardHeight:\s*0/);
  assert.match(script, /keyboardOpen:\s*false/);
  assert.match(script, /scrollWithAnimation:\s*false/);
  assert.match(script, /wx\.hideTabBar\(\{\s*animation:\s*false/);
  assert.match(script, /wx\.showTabBar\(\{\s*animation:\s*false/);
  assert.match(script, /onComposerFocus\(\)[\s\S]{0,500}scrollAfterLocalSend/);
  assert.match(script, /onKeyboardHeightChange\(event\)/);
  assert.match(script, /_keyboardScrollToken/);
  assert.match(script, /_tabBarHiddenByComposer/);
  assert.match(script, /_pendingKeyboardScrollMessageId/);
  assert.match(styles, /\.composer\.is-keyboard-open/);
  assert.match(styles, /\.composer-input-shell\s*\{[^}]*background:\s*#fff/s);
});

test('letters commit a rendered bottom anchor before assigning scroll-into-view', () => {
  const script = read('miniprogram/pages/messages/messages.js');

  assert.match(script, /const anchor = nextBottomAnchor\(this\.data\.scrollNonce\)/);
  assert.match(script, /this\.setData\(\{[\s\S]{0,320}bottomAnchorId:[\s\S]{0,320}\}, \(\) =>/);
  assert.match(script, /bottomScrollTarget\(anchor\.bottomAnchorId/);
  assert.doesNotMatch(script, /\.\.\.anchor,[\s\S]{0,200}pendingLocalScrollMessageId/);
});

test('letters request panel supports one-time custom requests and consent text from message data', () => {
  const script = read('miniprogram/pages/messages/messages.js');
  const markup = read('miniprogram/pages/messages/messages.wxml');
  const styles = read('miniprogram/pages/messages/messages.wxss');

  assert.match(script, /customRequestDraft:\s*''/);
  assert.match(script, /canSendCustomRequest:\s*false/);
  assert.match(script, /onCustomRequestInput\(event\)/);
  assert.match(script, /onCustomRequestFocus\(\)/);
  assert.match(script, /sendCustomCoupleRequest\(\)/);
  assert.match(script, /api\.sendCoupleRequest\(\{\s*customRequestText/);
  assert.match(markup, /class="custom-request-input"/);
  assert.match(markup, /maxlength="30"/);
  assert.match(markup, /bindinput="onCustomRequestInput"/);
  assert.match(markup, /bindfocus="onCustomRequestFocus"/);
  assert.match(markup, /bindkeyboardheightchange="onKeyboardHeightChange"/);
  assert.match(markup, /bindconfirm="sendCustomCoupleRequest"/);
  assert.match(markup, /\{\{customRequestCount\}\}\s*\/\s*30/);
  assert.match(markup, /wx:if="\{\{message\.consentNotice\}\}"[\s\S]{0,120}\{\{message\.consentNotice\}\}/);
  assert.doesNotMatch(markup, /wx:if="\{\{message\.requestAdult\}\}" class="request-consent"/);
  assert.match(styles, /\.custom-request-shell/);
  assert.match(styles, /\.custom-request-input/);
});
