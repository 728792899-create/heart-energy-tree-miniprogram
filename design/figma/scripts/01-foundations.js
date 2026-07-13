const createdNodeIds = [];
const updatedNodeIds = [];
const pageNames = [
  '00 — System & Library',
  '01 — Product Screens',
  '02 — Delivery & Motion'
];
const sectionNames = [
  '00 — Cover & Index',
  '01 — Foundations',
  '02 — Components',
  '03 — Core / Girlfriend',
  '04 — Core / Boyfriend',
  '05 — Rewards & Garden',
  '06 — Sponsor Operations',
  '07 — Profile & Weekly Recap',
  '08 — Dialogs & States',
  '09 — Responsive & Motion',
  '10 — Handoff Notes'
];

const existingPages = new Map(figma.root.children.map(page => [page.name, page]));
if (figma.root.children.length === 1 && figma.root.children[0].name === 'Page 1') {
  figma.root.children[0].name = pageNames[0];
  existingPages.set(pageNames[0], figma.root.children[0]);
  updatedNodeIds.push(figma.root.children[0].id);
}
for (const name of pageNames) {
  if (!existingPages.has(name)) {
    const page = figma.createPage();
    page.name = name;
    existingPages.set(name, page);
    createdNodeIds.push(page.id);
  }
}
pageNames.forEach((name, index) => figma.root.insertChild(index, existingPages.get(name)));
for (const page of existingPages.values()) {
  page.backgrounds = [{ type: 'SOLID', color: { r: 0.929, g: 0.898, b: 0.851 } }];
}

const hex = value => {
  const clean = value.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: 1
  };
};
const primitiveColors = {
  'Cream/Ivory': '#FBF7EF',
  'Paper/Parchment': '#F2E9DA',
  'Pearl/White': '#FFFDF8',
  'Sage/500': '#748276',
  'Forest/700': '#294139',
  'Rose/500': '#A85570',
  'Burgundy/700': '#6D2942',
  'Champagne/500': '#C9A866',
  'AntiqueGold/600': '#92743E',
  'Midnight/900': '#111A2D',
  'Ink/900': '#302D2A',
  'Ink/600': '#6D6862',
  'Line/Soft': '#DED3C4',
  'Success/500': '#55745E',
  'Warning/500': '#B77B4D',
  'Error/500': '#9A4B5B'
};
const semanticColors = {
  'Surface/App': '#FBF7EF',
  'Surface/Card': '#FFFDF8',
  'Surface/Subtle': '#F2E9DA',
  'Surface/Ceremony': '#111A2D',
  'Text/Primary': '#302D2A',
  'Text/Secondary': '#6D6862',
  'Text/OnDark': '#FFFDF8',
  'Border/Default': '#DED3C4',
  'Border/Strong': '#92743E',
  'Action/Primary': '#294139',
  'Action/Secondary': '#A85570',
  'Action/Danger': '#6D2942',
  'Accent/Gold': '#C9A866',
  'Status/Success': '#55745E',
  'Status/Warning': '#B77B4D',
  'Status/Error': '#9A4B5B'
};
const spacing = { '0': 0, '2': 2, '4': 4, '6': 6, '8': 8, '10': 10, '12': 12, '16': 16, '20': 20, '24': 24, '28': 28, '32': 32, '40': 40, '48': 48, '64': 64 };
const radii = { 'None': 0, 'XS': 6, 'SM': 10, 'MD': 16, 'LG': 22, 'XL': 28, 'Pill': 999 };
const motion = { 'Duration/Press': 120, 'Duration/Feedback': 240, 'Duration/Enter': 280, 'Duration/Ceremony': 800, 'Stagger/Group': 40, 'Stagger/Max': 160, 'Scale/Pressed': 0.98 };

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const collectionMap = new Map(collections.map(c => [c.name, c]));
const ensureCollection = name => {
  if (collectionMap.has(name)) return collectionMap.get(name);
  const collection = figma.variables.createVariableCollection(name);
  collectionMap.set(name, collection);
  return collection;
};
const allVariables = await figma.variables.getLocalVariablesAsync();
const ensureVariables = (collectionName, values, type) => {
  const collection = ensureCollection(collectionName);
  const modeId = collection.modes[0].modeId;
  const localByName = new Map(allVariables.filter(v => v.variableCollectionId === collection.id).map(v => [v.name, v]));
  const ids = {};
  for (const [name, rawValue] of Object.entries(values)) {
    let variable = localByName.get(name);
    if (!variable) {
      variable = figma.variables.createVariable(name, collection, type);
    }
    const value = type === 'COLOR' ? hex(rawValue) : rawValue;
    variable.setValueForMode(modeId, value);
    ids[name] = variable.id;
  }
  return { collectionId: collection.id, variables: ids };
};
const variableSummary = {
  primitives: ensureVariables('Primitives', primitiveColors, 'COLOR'),
  semantic: ensureVariables('Semantic Color', semanticColors, 'COLOR'),
  spacing: ensureVariables('Spacing', spacing, 'FLOAT'),
  radius: ensureVariables('Radius', radii, 'FLOAT'),
  motion: ensureVariables('Motion', motion, 'FLOAT')
};

const paintStyles = await figma.getLocalPaintStylesAsync();
const paintMap = new Map(paintStyles.map(s => [s.name, s]));
const paintDefs = {
  'Surface/Cream': '#FBF7EF',
  'Surface/Parchment': '#F2E9DA',
  'Surface/Pearl': '#FFFDF8',
  'Accent/Forest': '#294139',
  'Accent/Rose': '#A85570',
  'Accent/Champagne': '#C9A866',
  'Ceremony/Midnight': '#111A2D'
};
const styleIds = { paint: {}, text: {}, effect: {} };
for (const [name, value] of Object.entries(paintDefs)) {
  let style = paintMap.get(name);
  if (!style) style = figma.createPaintStyle();
  style.name = name;
  style.paints = [{ type: 'SOLID', color: hex(value) }];
  style.description = 'Jardin des Vœux local design token';
  styleIds.paint[name] = style.id;
}

const textDefs = [
  ['Display/Latin Hero', { family: 'Cormorant Garamond', style: 'SemiBold' }, 56, 60, 0.04],
  ['Display/Chinese Hero', { family: 'Noto Serif SC', style: 'SemiBold' }, 44, 58, 0.02],
  ['Heading/H1', { family: 'Noto Serif SC', style: 'SemiBold' }, 32, 43, 0],
  ['Heading/H2', { family: 'Noto Serif SC', style: 'Medium' }, 24, 34, 0],
  ['Body/Emphasis', { family: 'Noto Sans SC', style: 'Medium' }, 16, 26, 0],
  ['Body/Default', { family: 'Noto Sans SC', style: 'Regular' }, 15, 24, 0],
  ['Caption/Label', { family: 'Noto Sans SC', style: 'Medium' }, 12, 18, 0.08],
  ['Numeric/Metric', { family: 'Inter', style: 'Semi Bold' }, 30, 36, -0.02]
];
await Promise.all(textDefs.map(def => figma.loadFontAsync(def[1])));
const textStyles = await figma.getLocalTextStylesAsync();
const textMap = new Map(textStyles.map(s => [s.name, s]));
for (const [name, fontName, fontSize, lineHeight, letterSpacing] of textDefs) {
  let style = textMap.get(name);
  if (!style) style = figma.createTextStyle();
  style.name = name;
  style.fontName = fontName;
  style.fontSize = fontSize;
  style.lineHeight = { unit: 'PIXELS', value: lineHeight };
  style.letterSpacing = { unit: 'PERCENT', value: letterSpacing * 100 };
  style.paragraphSpacing = Math.round(fontSize * 0.55);
  style.description = 'Jardin des Vœux typography';
  styleIds.text[name] = style.id;
}

const effectDefs = {
  'Effect/Paper Lift': [{ type: 'DROP_SHADOW', color: { r: 0.18, g: 0.12, b: 0.08, a: 0.10 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' }],
  'Effect/Floating Card': [{ type: 'DROP_SHADOW', color: { r: 0.12, g: 0.17, b: 0.14, a: 0.15 }, offset: { x: 0, y: 14 }, radius: 34, spread: -4, visible: true, blendMode: 'NORMAL' }],
  'Effect/Gold Glow': [{ type: 'DROP_SHADOW', color: { r: 0.79, g: 0.66, b: 0.40, a: 0.30 }, offset: { x: 0, y: 4 }, radius: 18, spread: 0, visible: true, blendMode: 'NORMAL' }]
};
const effectStyles = await figma.getLocalEffectStylesAsync();
const effectMap = new Map(effectStyles.map(s => [s.name, s]));
for (const [name, effects] of Object.entries(effectDefs)) {
  let style = effectMap.get(name);
  if (!style) style = figma.createEffectStyle();
  style.name = name;
  style.effects = effects;
  style.description = 'Static, performance-safe luxury depth';
  styleIds.effect[name] = style.id;
}

return {
  createdNodeIds,
  updatedNodeIds,
  pages: Object.fromEntries(pageNames.map(name => [name, existingPages.get(name).id])),
  plannedSections: sectionNames,
  variables: variableSummary,
  styles: styleIds,
  fonts: {
    body: 'Noto Sans SC',
    chineseDisplay: 'Noto Serif SC',
    latinDisplay: 'Cormorant Garamond',
    numeric: 'Inter'
  }
};
