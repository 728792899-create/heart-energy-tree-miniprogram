const pages = figma.root.children.map((page, index) => ({
  id: page.id,
  name: page.name,
  index,
  childCount: page.children.length
}));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();
const paintStyles = await figma.getLocalPaintStylesAsync();
const textStyles = await figma.getLocalTextStylesAsync();
const effectStyles = await figma.getLocalEffectStylesAsync();
const gridStyles = await figma.getLocalGridStylesAsync();
const components = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
const fonts = await figma.listAvailableFontsAsync();
const preferredFamilies = ['PingFang SC', 'Noto Sans SC', 'Source Han Sans CN', 'Source Han Sans SC', 'Inter', 'Georgia'];
const availablePreferred = {};
for (const family of preferredFamilies) {
  availablePreferred[family] = fonts
    .filter(item => item.fontName.family === family)
    .map(item => item.fontName.style)
    .filter((style, i, arr) => arr.indexOf(style) === i)
    .sort();
}

return {
  fileName: figma.root.name,
  editorType: figma.editorType,
  pages,
  variables: {
    collectionCount: collections.length,
    variableCount: variables.length,
    collections: collections.map(collection => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes
    }))
  },
  styles: {
    paint: paintStyles.map(style => ({ id: style.id, name: style.name })),
    text: textStyles.map(style => ({ id: style.id, name: style.name })),
    effect: effectStyles.map(style => ({ id: style.id, name: style.name })),
    grid: gridStyles.map(style => ({ id: style.id, name: style.name }))
  },
  components: components.map(node => ({ id: node.id, name: node.name, type: node.type })),
  fonts: {
    totalVariants: fonts.length,
    preferred: availablePreferred
  }
};
