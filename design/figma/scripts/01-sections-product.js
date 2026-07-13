const page = await figma.getNodeByIdAsync('4:2');
if (!page || page.type !== 'PAGE') throw new Error('Product page not found');
await figma.setCurrentPageAsync(page);
const defs = [
  ['03 — Core / Girlfriend', 0, 0, 2300, 2200, '#E8DED0'],
  ['04 — Core / Boyfriend', 2500, 0, 3400, 2200, '#DED7C9'],
  ['05 — Rewards & Garden', 6100, 0, 3400, 2200, '#E5DCCB'],
  ['06 — Sponsor Operations', 0, 2400, 2300, 2200, '#DDD6C9'],
  ['07 — Profile & Weekly Recap', 2500, 2400, 2300, 2200, '#E8DED0'],
  ['08 — Dialogs & States', 5000, 2400, 4500, 4400, '#E4D9CA']
];
const hex = value => ({ r: parseInt(value.slice(1,3),16)/255, g: parseInt(value.slice(3,5),16)/255, b: parseInt(value.slice(5,7),16)/255 });
const existing = new Map(page.children.filter(n => n.type === 'SECTION').map(n => [n.name, n]));
const createdNodeIds = [];
const sections = {};
for (const [name, x, y, w, h, color] of defs) {
  let section = existing.get(name);
  if (!section) { section = figma.createSection(); section.name = name; createdNodeIds.push(section.id); }
  section.x = x; section.y = y; section.resize(w, h); section.fills = [{ type: 'SOLID', color: hex(color) }];
  sections[name] = section.id;
}
return { createdNodeIds, mutatedNodeIds: Object.values(sections), pageId: page.id, sections };
