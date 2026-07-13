const DEFINITIONS = Object.freeze([
  { stickerId: 'miss-you', label: '今天也想你', cloudPath: 'static/stickers/v1/miss-you.png' },
  { stickerId: 'hug', label: '抱抱', cloudPath: 'static/stickers/v1/hug.png' },
  { stickerId: 'kiss', label: '亲亲', cloudPath: 'static/stickers/v1/kiss.png' },
  { stickerId: 'happy-spin', label: '开心转圈', cloudPath: 'static/stickers/v1/happy-spin.png' },
  { stickerId: 'sad', label: '委屈巴巴', cloudPath: 'static/stickers/v1/sad.png' },
  { stickerId: 'angry', label: '生气了', cloudPath: 'static/stickers/v1/angry.png' },
  { stickerId: 'heart', label: '给你小心心', cloudPath: 'static/stickers/v1/heart.png' },
  { stickerId: 'hard-work', label: '辛苦啦', cloudPath: 'static/stickers/v1/hard-work.png' },
  { stickerId: 'cheer', label: '加油', cloudPath: 'static/stickers/v1/cheer.png' },
  { stickerId: 'eat', label: '吃饭了吗', cloudPath: 'static/stickers/v1/eat.png' },
  { stickerId: 'good-night', label: '晚安', cloudPath: 'static/stickers/v1/good-night.png' },
  { stickerId: 'love-you', label: '爱你', cloudPath: 'static/stickers/v1/love-you.png' }
]);

let uploaded = {};
try {
  uploaded = require('./stickerCatalog.generated.json');
} catch (error) {
  uploaded = {};
}

const STICKER_CATALOG = Object.freeze(DEFINITIONS.map((item) => Object.freeze({
  ...item,
  imageFileId: String(uploaded[item.stickerId] || '')
})));

module.exports = { DEFINITIONS, STICKER_CATALOG };
