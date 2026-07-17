const ADULT_CONSENT_NOTICE = '这是成年人之间的亲密邀请，不代表同意。双方都可以拒绝，也可以在任何时候改变主意。';
const CUSTOM_REQUEST_CONSENT_NOTICE = '这是一次邀请，不代表同意。双方都可以拒绝，也可以在任何时候改变主意。';

function template(requestTemplateId, requestLabel, requestCategory, requestAdult = false) {
  return Object.freeze({
    requestTemplateId,
    requestLabel,
    requestCategory,
    requestAdult,
    ...(requestAdult ? { consentNotice: ADULT_CONSENT_NOTICE } : {})
  });
}

const REQUEST_CATALOG = Object.freeze([
  template('kiss', '亲亲请求', 'intimacy'),
  template('hug-renewal', '抱抱续费', 'intimacy'),
  template('head-pat', '摸摸头请求', 'intimacy'),
  template('cuddle-tonight', '今晚贴贴', 'intimacy'),
  template('hand-in-hand-walk', '牵手散步', 'intimacy'),
  template('shoulder-recharge', '靠肩充电', 'intimacy'),
  template('milk-tea', '奶茶续命', 'care'),
  template('feed-me', '投喂好吃的', 'care'),
  template('eat-together', '陪我吃饭', 'care'),
  template('pick-me-up', '接我下班', 'care'),
  template('massage-ten-minutes', '按摩十分钟', 'care'),
  template('sleep-coaching', '哄睡服务', 'care'),
  template('video-tonight', '今晚视频', 'companionship'),
  template('listen-to-me', '听我碎碎念', 'companionship'),
  template('weekend-date', '周末约会', 'companionship'),
  template('comfort-me', '主动哄我', 'companionship'),
  template('end-cold-war', '冷战终止请求', 'companionship'),
  template('emotional-value', '情绪价值补给', 'abstract'),
  template('cyber-hug', '赛博抱抱', 'abstract'),
  template('love-brain-protection', '恋爱脑保护程序', 'abstract'),
  template('attention-seeker-partner', '今日显眼包搭子', 'abstract'),
  template('backhand-opossum-walk', '背手负鼠式散步巡查', 'abstract'),
  template('crying-horse-rescue', '哭哭马情绪救援', 'abstract'),
  template('lobster-level-patience', '养龙虾级耐心陪伴', 'abstract')
]);

module.exports = { ADULT_CONSENT_NOTICE, CUSTOM_REQUEST_CONSENT_NOTICE, REQUEST_CATALOG };
