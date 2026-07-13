// Read-only structural, accessibility, and delivery validation.
// This script intentionally creates, modifies, and deletes no Figma nodes.
await figma.loadAllPagesAsync();
figma.skipInvisibleInstanceChildren = true;

const CONTRACT = {
  physicalPages: 3,
  semanticSections: 11,
  businessFrames: 46,
  coreScreens: 22,
  dialogs: 8,
  states: 8,
  responsive: 6,
  motion: 2,
  minimumComponents: 30,
  prototypeHotspots: 25,
  minimumTextSize: 12,
  minimumTapTarget: 44
};

const EXPECTED_PAGES = [
  { id: '0:1', name: '00 — System & Library' },
  { id: '4:2', name: '01 — Product Screens' },
  { id: '4:3', name: '02 — Delivery & Motion' }
];

const EXPECTED_SECTIONS = [
  { id: '5:2', name: '00 — Cover & Index' },
  { id: '5:3', name: '01 — Foundations' },
  { id: '5:4', name: '02 — Components' },
  { id: '5:5', name: '03 — Core / Girlfriend' },
  { id: '5:6', name: '04 — Core / Boyfriend' },
  { id: '5:7', name: '05 — Rewards & Garden' },
  { id: '5:8', name: '06 — Sponsor Operations' },
  { id: '5:9', name: '07 — Profile & Weekly Recap' },
  { id: '5:10', name: '08 — Dialogs & States' },
  { id: '5:11', name: '09 — Responsive & Motion' },
  { id: '5:12', name: '10 — Handoff Notes' }
];

const EXPECTED_SCREENS = [
  'Screen/01-Bind/Default/390',
  'Screen/02-Home/Girlfriend/Default/390',
  'Screen/03-Home/Boyfriend/Default/390',
  'Screen/04-Checkin/Default/390',
  'Screen/05-AdventureMap/Default/390',
  'Screen/06-History/Default/390',
  'Screen/07-WeeklyRecap/Default/390',
  'Screen/08-Wallet/Default/390',
  'Screen/09-Shop/Default/390',
  'Screen/10-RewardDetail/Default/390',
  'Screen/11-Redemptions/Default/390',
  'Screen/12-SponsorCompanion/Default/390',
  'Screen/13-SponsorCompanionHistory/Default/390',
  'Screen/14-SponsorCompanionBadges/Default/390',
  'Screen/15-SponsorCompanionLedgers/Default/390',
  'Screen/16-SponsorCompanionRedemptions/Default/390',
  'Screen/17-SponsorReview/Default/390',
  'Screen/18-SponsorPayouts/Default/390',
  'Screen/19-SponsorRules/Default/390',
  'Screen/20-AdminRewards/Default/390',
  'Screen/21-Profile/Default/390',
  'Screen/22-ProfileEdit/Default/390'
];
const EXPECTED_DIALOGS = [
  'DialogBoard/01-BindingConfirm/390',
  'DialogBoard/02-CheckinSubmit/390',
  'DialogBoard/03-ReviewApprove/390',
  'DialogBoard/04-ReviewReturn/390',
  'DialogBoard/05-GiftRedemption/390',
  'DialogBoard/06-RedemptionCancelRefund/390',
  'DialogBoard/07-WishFundFulfilment/390',
  'DialogBoard/08-Celebration/MilestoneGiftMap/390'
];
const EXPECTED_STATES = [
  'StateBoard/01-HomeSkeleton/390',
  'StateBoard/02-HomeOffline/390',
  'StateBoard/03-CheckinReturned/390',
  'StateBoard/04-HistoryEmpty/390',
  'StateBoard/05-ShopEmpty/390',
  'StateBoard/06-ReviewQueueEmpty/390',
  'StateBoard/07-WeeklyRecapEmpty/390',
  'StateBoard/08-PhotoPermissionLimited/390'
];
const EXPECTED_RESPONSIVE = [
  'Responsive/Home/Girlfriend/375',
  'Responsive/Home/Girlfriend/390',
  'Responsive/Home/Girlfriend/430',
  'Responsive/SponsorReview/375',
  'Responsive/SponsorReview/390',
  'Responsive/SponsorReview/430'
];
const EXPECTED_MOTION = [
  'Motion/01-GardenGrowth/Storyboard',
  'Motion/02-Ceremony/Storyboard'
];
const EXPECTED_BUSINESS_NAMES = [
  ...EXPECTED_SCREENS,
  ...EXPECTED_DIALOGS,
  ...EXPECTED_STATES,
  ...EXPECTED_RESPONSIVE,
  ...EXPECTED_MOTION
];
const EXPECTED_BUSINESS_SET = new Set(EXPECTED_BUSINESS_NAMES);
const HANDOFF_NAME = 'Documentation/HandoffIndex';
const BUSINESS_PREFIXES = ['Screen/', 'DialogBoard/', 'StateBoard/', 'Responsive/', 'Motion/'];
const ALLOWED_ROOT_PREFIXES = {
  '5:2': ['Documentation/'],
  '5:3': ['Documentation/'],
  '5:4': ['Library/', 'Documentation/'],
  '5:5': ['Screen/', 'Documentation/'],
  '5:6': ['Screen/', 'Documentation/'],
  '5:7': ['Screen/', 'Documentation/'],
  '5:8': ['Screen/', 'Documentation/'],
  '5:9': ['Screen/', 'Documentation/'],
  '5:10': ['DialogBoard/', 'StateBoard/', 'Documentation/'],
  '5:11': ['Responsive/', 'Motion/'],
  '5:12': ['Documentation/']
};

const ruleTotals = {};
const severityTotals = { blocker: 0, warning: 0, info: 0 };
const sampleCounts = {};
const findings = [];
const MAX_SAMPLES_PER_RULE = 100;
const MAX_SAMPLES_TOTAL = 500;

function nodePath(node, stopAt = null) {
  const parts = [];
  let cursor = node;
  while (cursor && cursor !== stopAt && cursor.type !== 'DOCUMENT') {
    parts.unshift(cursor.name || cursor.type);
    cursor = cursor.parent;
  }
  return parts.join(' / ');
}

function record(rule, severity, message, details = {}) {
  ruleTotals[rule] = (ruleTotals[rule] || 0) + 1;
  severityTotals[severity] = (severityTotals[severity] || 0) + 1;
  sampleCounts[rule] = sampleCounts[rule] || 0;
  if (sampleCounts[rule] >= MAX_SAMPLES_PER_RULE || findings.length >= MAX_SAMPLES_TOTAL) return;
  sampleCounts[rule] += 1;
  findings.push({ rule, severity, message, ...details });
}

function walk(node, visitor) {
  visitor(node);
  if ('children' in node) {
    for (const child of node.children) {
      if ('visible' in child && child.visible === false) continue;
      walk(child, visitor);
    }
  }
}

function approximatelyEqual(actual, expected, tolerance = 0.5) {
  return Math.abs(actual - expected) <= tolerance;
}

function expectedDimensions(name) {
  if (name.startsWith('Screen/') || name.startsWith('DialogBoard/') || name.startsWith('StateBoard/')) return { width: 390, height: 844 };
  if (name.startsWith('Responsive/')) {
    if (name.endsWith('/375')) return { width: 375, height: 812 };
    if (name.endsWith('/390')) return { width: 390, height: 844 };
    if (name.endsWith('/430')) return { width: 430, height: 932 };
  }
  if (name.startsWith('Motion/')) return { width: 3300, height: 1420 };
  return null;
}

function isBusinessPrefix(name) {
  return BUSINESS_PREFIXES.some(prefix => name.startsWith(prefix));
}

function textClassification(node) {
  const path = nodePath(node);
  if (/StatusTime|StatusIcons|StatusBar/i.test(path)) return 'status-bar';
  if (/Eyebrow/i.test(node.name || '')) return 'english-eyebrow';
  return 'ordinary-copy';
}

function textSizes(node) {
  const result = [];
  if (typeof node.fontSize === 'number') result.push(node.fontSize);
  else {
    try {
      const segments = node.getStyledTextSegments(['fontSize']);
      for (const segment of segments) if (typeof segment.fontSize === 'number') result.push(segment.fontSize);
    } catch (error) {
      record('text-inspection-error', 'warning', 'Unable to inspect mixed text sizing', {
        nodeId: node.id,
        nodePath: nodePath(node),
        error: String(error)
      });
    }
  }
  return [...new Set(result.map(value => Math.round(value * 100) / 100))];
}

function textPreview(node) {
  return String(node.characters || '').replace(/\s+/g, ' ').slice(0, 96);
}

function isOutside(inner, outer, tolerance = 0.75) {
  return inner.x < outer.x - tolerance || inner.y < outer.y - tolerance ||
    inner.x + inner.width > outer.x + outer.width + tolerance ||
    inner.y + inner.height > outer.y + outer.height + tolerance;
}

const pages = figma.root.children.filter(node => node.type === 'PAGE');
const pageById = new Map(pages.map(page => [page.id, page]));
if (pages.length !== CONTRACT.physicalPages) {
  record('physical-page-count', 'blocker', `Expected ${CONTRACT.physicalPages} physical pages, found ${pages.length}`, { expected: CONTRACT.physicalPages, actual: pages.length });
}
for (const expected of EXPECTED_PAGES) {
  const page = pageById.get(expected.id);
  if (!page) record('missing-page', 'blocker', `Missing physical page ${expected.name}`, expected);
  else if (page.name !== expected.name) record('page-name', 'blocker', `Physical page ${expected.id} has an unexpected name`, { expected: expected.name, actual: page.name, nodeId: page.id });
}

const actualSections = [];
for (const page of pages) {
  for (const child of page.children) if (child.type === 'SECTION') actualSections.push(child);
}
const sectionById = new Map(actualSections.map(section => [section.id, section]));
if (actualSections.length !== CONTRACT.semanticSections) {
  record('semantic-section-count', 'blocker', `Expected ${CONTRACT.semanticSections} semantic Sections, found ${actualSections.length}`, { expected: CONTRACT.semanticSections, actual: actualSections.length });
}
for (const expected of EXPECTED_SECTIONS) {
  const section = sectionById.get(expected.id) || await figma.getNodeByIdAsync(expected.id);
  if (!section || section.type !== 'SECTION') record('missing-section', 'blocker', `Missing semantic Section ${expected.name}`, expected);
  else {
    sectionById.set(expected.id, section);
    if (section.name !== expected.name) record('section-name', 'blocker', `Section ${expected.id} has an unexpected name`, { expected: expected.name, actual: section.name, nodeId: section.id });
  }
}

const rootFrames = [];
for (const expected of EXPECTED_SECTIONS) {
  const section = sectionById.get(expected.id);
  if (!section || section.type !== 'SECTION') continue;
  const allowedPrefixes = ALLOWED_ROOT_PREFIXES[expected.id] || [];
  for (const child of section.children) {
    if (child.type !== 'FRAME') continue;
    rootFrames.push(child);
    if (!allowedPrefixes.some(prefix => child.name.startsWith(prefix))) {
      record('unexpected-root-prefix', 'blocker', 'Direct Section child uses an unexpected business/documentation prefix', {
        nodeId: child.id,
        nodePath: nodePath(child),
        allowedPrefixes
      });
    }
  }
}

const businessFrames = rootFrames.filter(node => isBusinessPrefix(node.name));
const categoryFrames = {
  screens: businessFrames.filter(node => node.name.startsWith('Screen/')),
  dialogs: businessFrames.filter(node => node.name.startsWith('DialogBoard/')),
  states: businessFrames.filter(node => node.name.startsWith('StateBoard/')),
  responsive: businessFrames.filter(node => node.name.startsWith('Responsive/')),
  motion: businessFrames.filter(node => node.name.startsWith('Motion/'))
};
const actualCounts = {
  physicalPages: pages.length,
  semanticSections: actualSections.length,
  businessFrames: businessFrames.length,
  coreScreens: categoryFrames.screens.length,
  dialogs: categoryFrames.dialogs.length,
  states: categoryFrames.states.length,
  responsive: categoryFrames.responsive.length,
  motion: categoryFrames.motion.length
};
const countKeys = ['businessFrames', 'coreScreens', 'dialogs', 'states', 'responsive', 'motion'];
for (const key of countKeys) {
  if (actualCounts[key] !== CONTRACT[key]) record('business-frame-count', 'blocker', `Count mismatch for ${key}`, { category: key, expected: CONTRACT[key], actual: actualCounts[key] });
}

const rootsByName = new Map();
for (const root of businessFrames) {
  if (!rootsByName.has(root.name)) rootsByName.set(root.name, []);
  rootsByName.get(root.name).push(root);
}
for (const [name, matches] of rootsByName) {
  if (matches.length > 1) record('duplicate-business-root', 'blocker', `Duplicate business root name: ${name}`, { name, nodeIds: matches.map(node => node.id) });
}
for (const expectedName of EXPECTED_BUSINESS_NAMES) {
  if (!rootsByName.has(expectedName)) record('missing-business-root', 'blocker', `Missing business root: ${expectedName}`, { name: expectedName });
}
for (const actualName of rootsByName.keys()) {
  if (!EXPECTED_BUSINESS_SET.has(actualName)) record('unexpected-business-root', 'blocker', `Unexpected business root: ${actualName}`, { name: actualName });
}

for (const root of businessFrames) {
  const dimensions = expectedDimensions(root.name);
  if (!root.clipsContent) record('business-root-clipping', 'blocker', 'Business root must clip its content', { nodeId: root.id, nodePath: nodePath(root), clipsContent: root.clipsContent });
  if (dimensions && (!approximatelyEqual(root.width, dimensions.width) || !approximatelyEqual(root.height, dimensions.height))) {
    record('business-root-size', 'blocker', 'Business root dimensions do not match its naming contract', {
      nodeId: root.id,
      nodePath: nodePath(root),
      expected: dimensions,
      actual: { width: root.width, height: root.height }
    });
  }

  const outer = root.absoluteBoundingBox;
  if (!outer) {
    record('root-bounds-missing', 'warning', 'Business root has no visible absolute bounds', { nodeId: root.id, nodePath: nodePath(root) });
  } else {
    const overflowQueue = [...root.children].map(node => ({ node, ancestorOutside: false }));
    while (overflowQueue.length) {
      const current = overflowQueue.shift();
      const node = current.node;
      if ('visible' in node && node.visible === false) continue;
      const bounds = 'absoluteBoundingBox' in node ? node.absoluteBoundingBox : null;
      const outside = !!bounds && isOutside(bounds, outer);
      if (outside && !current.ancestorOutside) {
        record('visible-overflow', 'warning', 'Visible descendant extends outside its business root and will be clipped', {
          rootId: root.id,
          rootName: root.name,
          nodeId: node.id,
          nodePath: nodePath(node, root),
          rootBounds: outer,
          nodeBounds: bounds
        });
      }
      if ('children' in node) {
        for (const child of node.children) overflowQueue.push({ node: child, ancestorOutside: current.ancestorOutside || outside });
      }
    }
  }

  walk(root, node => {
    if (node.type === 'TEXT') {
      if (node.hasMissingFont) {
        record('missing-font', 'blocker', 'Text node uses a missing font', { nodeId: node.id, nodePath: nodePath(node, root), rootName: root.name, text: textPreview(node) });
      }
      const classification = textClassification(node);
      for (const size of textSizes(node)) {
        if (size >= CONTRACT.minimumTextSize) continue;
        record('text-under-12', classification === 'ordinary-copy' ? 'blocker' : 'warning', `Text is smaller than ${CONTRACT.minimumTextSize}px`, {
          nodeId: node.id,
          nodePath: nodePath(node, root),
          rootName: root.name,
          size,
          classification,
          text: textPreview(node)
        });
      }
      return;
    }

    if (!('width' in node) || !('height' in node) || node === root) return;
    const reactionCount = 'reactions' in node ? node.reactions.length : 0;
    const heuristicName = /Button|IconButton|Action|Tab|Switch|Stepper|Chip|Control|CTA|Hotspot|Back|Next|Previous|Upload/i.test(node.name || '');
    if ((reactionCount > 0 || heuristicName) && (node.width < CONTRACT.minimumTapTarget || node.height < CONTRACT.minimumTapTarget)) {
      record('small-interaction-target', reactionCount > 0 ? 'blocker' : 'warning', `Interactive target may be smaller than ${CONTRACT.minimumTapTarget}×${CONTRACT.minimumTapTarget}px`, {
        nodeId: node.id,
        nodePath: nodePath(node, root),
        rootName: root.name,
        interactionEvidence: reactionCount > 0 ? 'reaction' : 'name-heuristic',
        reactions: reactionCount,
        width: node.width,
        height: node.height
      });
    }
  });
}

let componentNodes = [];
for (const page of pages) {
  walk(page, node => {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') componentNodes.push(node);
  });
}
if (componentNodes.length < CONTRACT.minimumComponents) {
  record('component-count', 'blocker', `Expected at least ${CONTRACT.minimumComponents} reusable component/component-set roots`, { expectedMinimum: CONTRACT.minimumComponents, actual: componentNodes.length });
}

if (figma.hasMissingFont) {
  record('document-missing-font', 'blocker', 'The Figma document reports at least one missing font', { hasMissingFont: true });
}

const handoffSection = sectionById.get('5:12');
const handoffRoots = handoffSection && handoffSection.type === 'SECTION'
  ? handoffSection.children.filter(node => node.type === 'FRAME' && node.name === HANDOFF_NAME)
  : [];
if (handoffRoots.length !== 1) {
  record('handoff-index', 'blocker', `Expected exactly one ${HANDOFF_NAME}`, { expected: 1, actual: handoffRoots.length, nodeIds: handoffRoots.map(node => node.id) });
} else if (!approximatelyEqual(handoffRoots[0].width, 3000) || !approximatelyEqual(handoffRoots[0].height, 2700)) {
  record('handoff-index-size', 'warning', 'Handoff Index dimensions differ from the approved 3000×2700 board', {
    nodeId: handoffRoots[0].id,
    actual: { width: handoffRoots[0].width, height: handoffRoots[0].height }
  });
}

const prototypeHotspots = [];
for (const root of businessFrames) {
  for (const child of root.children) {
    if (child.name && child.name.startsWith('PrototypeHotspot/')) prototypeHotspots.push({ root, node: child });
  }
}
if (prototypeHotspots.length !== CONTRACT.prototypeHotspots) {
  record('prototype-hotspot-count', 'blocker', `Expected ${CONTRACT.prototypeHotspots} prototype hotspots`, { expected: CONTRACT.prototypeHotspots, actual: prototypeHotspots.length });
}
const hotspotNames = new Map();
for (const item of prototypeHotspots) {
  const hotspot = item.node;
  if (!hotspotNames.has(hotspot.name)) hotspotNames.set(hotspot.name, []);
  hotspotNames.get(hotspot.name).push(hotspot.id);
  const reactionCount = 'reactions' in hotspot ? hotspot.reactions.length : 0;
  if (reactionCount < 1) record('prototype-reaction', 'blocker', 'Prototype hotspot has no Reaction', { nodeId: hotspot.id, nodePath: nodePath(hotspot), rootName: item.root.name });
  if (!('width' in hotspot) || !('height' in hotspot) || hotspot.width < CONTRACT.minimumTapTarget || hotspot.height < CONTRACT.minimumTapTarget) {
    record('prototype-hotspot-size', 'blocker', 'Prototype hotspot is below the 44×44px contract', {
      nodeId: hotspot.id,
      nodePath: nodePath(hotspot),
      rootName: item.root.name,
      width: 'width' in hotspot ? hotspot.width : null,
      height: 'height' in hotspot ? hotspot.height : null
    });
  }
  if (reactionCount > 0) {
    const actions = hotspot.reactions[0].actions || [];
    const navigation = actions.find(action => action.type === 'NODE');
    if (!navigation || !navigation.destinationId) {
      record('prototype-destination', 'blocker', 'Prototype hotspot has no node destination', { nodeId: hotspot.id, nodePath: nodePath(hotspot), rootName: item.root.name });
    } else {
      const destination = await figma.getNodeByIdAsync(navigation.destinationId);
      if (!destination || destination.type !== 'FRAME' || !EXPECTED_BUSINESS_SET.has(destination.name)) {
        record('prototype-destination', 'blocker', 'Prototype hotspot destination is not an approved business root', {
          nodeId: hotspot.id,
          nodePath: nodePath(hotspot),
          rootName: item.root.name,
          destinationId: navigation.destinationId,
          destinationName: destination ? destination.name : null
        });
      }
    }
  }
}
for (const [name, ids] of hotspotNames) {
  if (ids.length > 1) record('duplicate-prototype-hotspot', 'blocker', `Duplicate prototype hotspot name: ${name}`, { name, nodeIds: ids });
}

const sampleSeverityCounts = { blocker: 0, warning: 0, info: 0 };
for (const finding of findings) sampleSeverityCounts[finding.severity] = (sampleSeverityCounts[finding.severity] || 0) + 1;
const totalFindingCount = Object.values(severityTotals).reduce((sum, value) => sum + value, 0);
const sampledFindingCount = findings.length;
const truncatedRules = Object.fromEntries(Object.entries(ruleTotals).filter(([rule, total]) => total > (sampleCounts[rule] || 0)).map(([rule, total]) => [rule, { total, sampled: sampleCounts[rule] || 0 }]));
const blockerCount = severityTotals.blocker;
const warningCount = severityTotals.warning;

return {
  status: blockerCount === 0 ? 'PASS' : 'FAIL',
  readOnly: true,
  contract: CONTRACT,
  inventory: {
    ...actualCounts,
    componentsAndComponentSets: componentNodes.length,
    handoffIndex: handoffRoots.length,
    prototypeHotspots: prototypeHotspots.length,
    missingFontReportedByDocument: figma.hasMissingFont
  },
  summary: {
    blockerCount,
    warningCount,
    totalFindingCount,
    sampledFindingCount,
    sampleSeverityCounts: severityCounts,
    ruleTotals,
    truncatedRules
  },
  findings
};
