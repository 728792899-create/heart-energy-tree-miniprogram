const SQUARE = { width: 720, height: 720, fps: 24 };
const PORTRAIT = { width: 750, height: 1000, fps: 24 };

const defineScene = (sceneKey, options = {}) => ({
  sceneKey,
  compositionId: `heart-tree-${sceneKey}`,
  posterId: `poster-${sceneKey}`,
  durationInFrames: options.durationInFrames || 72,
  masterArtwork: options.masterArtwork || 'couple-stand.png',
  motif: options.motif || 'tree',
  ribbonLabel: options.ribbonLabel || 'TOGETHER',
  ...(options.portrait ? PORTRAIT : SQUARE)
});

const SCENES = [
  defineScene('binding', {
    portrait: true,
    durationInFrames: 96,
    masterArtwork: 'couple-hold.png',
    motif: 'plane',
    ribbonLabel: 'OUR STORY'
  }),
  defineScene('check-in', {
    masterArtwork: 'couple-stand.png',
    motif: 'plane',
    ribbonLabel: 'LOVE NOTE'
  }),
  defineScene('approval', {
    masterArtwork: 'couple-jump.png',
    motif: 'tree',
    ribbonLabel: 'ENERGY +'
  }),
  defineScene('streak-3', {
    masterArtwork: 'couple-jump.png',
    motif: 'tree',
    ribbonLabel: '3 DAYS'
  }),
  defineScene('streak-7', {
    masterArtwork: 'couple-jump.png',
    motif: 'tree',
    ribbonLabel: '7 DAYS'
  }),
  defineScene('streak-14', {
    masterArtwork: 'couple-jump.png',
    motif: 'tree',
    ribbonLabel: '14 DAYS'
  }),
  defineScene('map-complete', {
    durationInFrames: 84,
    masterArtwork: 'couple-jump.png',
    motif: 'ribbon',
    ribbonLabel: 'NEW CHAPTER'
  }),
  defineScene('badge-unlock', {
    masterArtwork: 'couple-stand.png',
    motif: 'ribbon',
    ribbonLabel: 'SHINE ON'
  }),
  defineScene('redemption', {
    masterArtwork: 'couple-hold.png',
    motif: 'gift',
    ribbonLabel: 'FOR YOU'
  }),
  defineScene('wish-fund-complete', {
    durationInFrames: 84,
    masterArtwork: 'couple-hold.png',
    motif: 'gift',
    ribbonLabel: 'WISH KEPT'
  }),
  defineScene('encouragement', {
    masterArtwork: 'couple-hold.png',
    motif: 'plane',
    ribbonLabel: 'A HUG'
  }),
  defineScene('weekly-recap', {
    portrait: true,
    durationInFrames: 96,
    masterArtwork: 'couple-stand.png',
    motif: 'ribbon',
    ribbonLabel: 'OUR WEEK'
  }),
  defineScene('companion-empty', {
    masterArtwork: 'couple-stand.png',
    motif: 'tree',
    ribbonLabel: 'BY YOUR SIDE'
  })
];

module.exports = {
  SCENES,
  getSceneDefinition(sceneKey) {
    return SCENES.find((scene) => scene.sceneKey === sceneKey) || SCENES.at(-1);
  }
};
