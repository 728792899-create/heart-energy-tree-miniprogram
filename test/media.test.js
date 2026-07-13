const test = require('node:test');
const assert = require('node:assert/strict');

const media = require('../miniprogram/services/media');

test('avatar source rejects placeholder values instead of resolving them as page-relative images', () => {
  assert.equal(media.avatarSource({ avatarUrl: '<URL>' }), '');
  assert.equal(media.avatarSource({ avatarUrl: 'undefined' }), '');
  assert.equal(media.resolvedSource('<URL>'), '');
});

test('avatar source preserves supported remote, temporary, and local asset paths', () => {
  assert.equal(media.avatarSource({ avatarUrl: 'https://example.com/avatar.png' }), 'https://example.com/avatar.png');
  assert.equal(media.avatarSource({ avatarUrl: 'wxfile://tmp/avatar.png' }), 'wxfile://tmp/avatar.png');
  assert.equal(media.avatarSource({ avatarUrl: '/assets/stitch-original/participant-avatar.jpg' }), '/assets/stitch-original/participant-avatar.jpg');
});

test('server-authorized media URLs survive client decoration when cloud file ids are unreadable', () => {
  const value = {
    avatarFileId: 'cloud://env.bucket/relationships/rel-1/avatars/user-2/avatar.png',
    avatarSrc: 'https://authorized.example/avatar.png',
    imageFileId: 'cloud://env.bucket/relationships/rel-1/messages/user-2/photo.png',
    imageSrc: 'https://authorized.example/photo.png'
  };

  media.decorate(value);

  assert.equal(value.avatarSrc, 'https://authorized.example/avatar.png');
  assert.equal(value.imageSrc, 'https://authorized.example/photo.png');
});
