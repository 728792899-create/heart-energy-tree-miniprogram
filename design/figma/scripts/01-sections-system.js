const page = await figma.getNodeByIdAsync('0:1');
if (!page || page.type !== 'PAGE') throw new Error('System page not found');
await figma.setCurrentPageAsync(page);
const defs = [
  ['00 — Cover & Index', 0, 0, 2500, 1700, '#E8DED0'],
  ['01 — Foundations', 2700, 0, 5200, 2900, '#E8DED0'],
  ['02 — Components', 0, 3100, 7900, 4700, '#E4D9CA']
];
const hex = value => ({ r: parseInt(value.slice(1,3),16)/255, g: parseInt(value.slice(3,5),16)/255, b: parseInt(value.slice(5,7),16)/255 });
const existing = new Map(page.children.filter(n => n.type === 'SECTION').map(n => [n.name, n]));
const createdNodeIds = [];
const sections = {};
for (const [name, x, y, w, h, color] of defs) {
  let section = existing.get(name);
  if (!section) {
    section = figma.createSection();
    section.name = name;
    createdNodeIds.push(section.id);
  }
  section.x = x; section.y = y; section.resize(w, h);
  section.fills = [{ type: 'SOLID', color: hex(color) }];
  sections[name] = section.id;
}
return { createdNodeIds, mutatedNodeIds: Object.values(sections), pageId: page.id, sections };
