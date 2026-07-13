const SOUND_STORAGE_KEY = 'heartTree.soundEnabled.v1';

const SOUND_CUES = {
  binding: '/assets/sounds/heart-chime.wav',
  encouragement: '/assets/sounds/heart-chime.wav',
  approval: '/assets/sounds/milestone-bloom.wav',
  streak: '/assets/sounds/milestone-bloom.wav',
  milestone: '/assets/sounds/milestone-bloom.wav',
  map: '/assets/sounds/milestone-bloom.wav',
  badge: '/assets/sounds/milestone-bloom.wav',
  redemption: '/assets/sounds/promise-bell.wav',
  fulfillment: '/assets/sounds/promise-bell.wav',
  payout: '/assets/sounds/promise-bell.wav'
};

function cueForScene(sceneKey) {
  const key = String(sceneKey || '');
  if (/^streak_(?:3|7|14)$/.test(key)) return 'streak';
  if (key === 'map_level_complete') return 'map';
  if (key === 'first_redemption') return 'redemption';
  if (key === 'wish_fund_complete') return 'payout';
  if (key === 'badge_unlock' || key === 'first_checkin' || /^energy_(?:100|300|520)$/.test(key)) return 'badge';
  return 'milestone';
}

function runtime() {
  return typeof wx !== 'undefined' ? wx : null;
}

function isSoundEnabled() {
  const host = runtime();
  if (!host || typeof host.getStorageSync !== 'function') return true;
  const stored = host.getStorageSync(SOUND_STORAGE_KEY);
  return stored === '' || stored === undefined || stored === null
    ? true
    : stored === true || stored === 1 || stored === 'on';
}

function setSoundEnabled(enabled) {
  const next = Boolean(enabled);
  const host = runtime();
  if (host && typeof host.setStorageSync === 'function') {
    host.setStorageSync(SOUND_STORAGE_KEY, next);
  }
  return next;
}

function playCue(sceneKey) {
  const host = runtime();
  if (!isSoundEnabled() || !host || typeof host.createInnerAudioContext !== 'function') return false;

  const src = SOUND_CUES[sceneKey] || SOUND_CUES.milestone;
  let audio;
  try {
    audio = host.createInnerAudioContext();
    audio.autoplay = false;
    audio.obeyMuteSwitch = true;
    audio.volume = 0.48;
    audio.src = src;
    const dispose = () => {
      if (audio && typeof audio.destroy === 'function') audio.destroy();
      audio = null;
    };
    if (typeof audio.onEnded === 'function') audio.onEnded(dispose);
    if (typeof audio.onError === 'function') audio.onError(dispose);
    audio.play();
    return true;
  } catch (error) {
    if (audio && typeof audio.destroy === 'function') audio.destroy();
    console.warn('[heart-tree] local cue unavailable', { sceneKey });
    return false;
  }
}

module.exports = {
  SOUND_STORAGE_KEY,
  SOUND_CUES,
  cueForScene,
  isSoundEnabled,
  setSoundEnabled,
  playCue
};
