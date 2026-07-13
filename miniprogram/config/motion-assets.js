const DEFAULT_SCENE_KEY = 'companion-empty';

function asset(sceneKey, nativeVariant) {
  return Object.freeze({
    videoSrc: '',
    cloudPath: `heart-tree/v2/${sceneKey}.mp4`,
    poster: `/assets/motion/${sceneKey}.jpg`,
    nativeVariant
  });
}

// Remote video IDs intentionally remain empty until the user uploads the
// rendered MP4 files. Every scene therefore resolves to a packaged poster now.
const MOTION_ASSETS = Object.freeze({
  binding: asset('binding', 'ribbon'),
  'check-in': asset('check-in', 'ribbon'),
  approval: asset('approval', 'hearts'),
  'streak-3': asset('streak-3', 'hearts'),
  'streak-7': asset('streak-7', 'hearts'),
  'streak-14': asset('streak-14', 'hearts'),
  'map-complete': asset('map-complete', 'ribbon'),
  'badge-unlock': asset('badge-unlock', 'ribbon'),
  redemption: asset('redemption', 'coins'),
  'wish-fund-complete': asset('wish-fund-complete', 'coins'),
  encouragement: asset('encouragement', 'hearts'),
  'weekly-recap': asset('weekly-recap', 'ribbon'),
  'companion-empty': asset('companion-empty', 'hearts')
});

const SCENE_ALIASES = Object.freeze({
  first_checkin: 'check-in',
  checkin_envelope: 'check-in',
  checkin_surprise: 'check-in',
  cash_overflow_love_pack: 'approval',
  streak_3: 'streak-3',
  streak_7: 'streak-7',
  streak_14: 'streak-14',
  map_level_complete: 'map-complete',
  badge_unlock: 'badge-unlock',
  energy_100: 'badge-unlock',
  energy_300: 'badge-unlock',
  energy_520: 'badge-unlock',
  first_redemption: 'redemption',
  wish_fund_complete: 'wish-fund-complete',
  gentle_empty_week: 'companion-empty'
});

function cleanOverride(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveMotionAsset(sceneKey, overrides = {}) {
  const requestedSceneKey = String(sceneKey || '');
  const canonicalSceneKey = SCENE_ALIASES[requestedSceneKey] || requestedSceneKey;
  const normalizedSceneKey = Object.prototype.hasOwnProperty.call(MOTION_ASSETS, canonicalSceneKey)
    ? canonicalSceneKey
    : DEFAULT_SCENE_KEY;
  const configured = MOTION_ASSETS[normalizedSceneKey];

  return {
    ...configured,
    sceneKey: normalizedSceneKey,
    videoSrc: cleanOverride(overrides.src || overrides.videoSrc) || configured.videoSrc,
    poster: cleanOverride(overrides.poster) || configured.poster
  };
}

module.exports = {
  DEFAULT_SCENE_KEY,
  MOTION_ASSETS,
  SCENE_ALIASES,
  resolveMotionAsset
};
