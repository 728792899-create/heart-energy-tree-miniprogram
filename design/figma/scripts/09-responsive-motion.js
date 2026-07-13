const deliveryPage = await figma.getNodeByIdAsync('4:3');
if (!deliveryPage || deliveryPage.type !== 'PAGE') throw new Error('Delivery page missing');
await figma.setCurrentPageAsync(deliveryPage);
const section = await figma.getNodeByIdAsync('5:11');
if (!section || section.type !== 'SECTION') throw new Error('Responsive and motion section missing');

const expectedResponsiveNames = [
  'Responsive/Home/Girlfriend/375',
  'Responsive/Home/Girlfriend/390',
  'Responsive/Home/Girlfriend/430',
  'Responsive/SponsorReview/375',
  'Responsive/SponsorReview/390',
  'Responsive/SponsorReview/430'
];
const expectedMotionNames = [
  'Motion/01-GardenGrowth/Storyboard',
  'Motion/02-Ceremony/Storyboard'
];
const expectedNames = [...expectedResponsiveNames, ...expectedMotionNames];
const existingRoots = section.children.filter(node => node.type === 'FRAME' && expectedNames.includes(node.name));
if (existingRoots.length) {
  if (existingRoots.length !== expectedNames.length) {
    throw new Error('Responsive and motion phase has an incomplete prior root set; inspect before retrying');
  }
  const responsive = Object.fromEntries(existingRoots.filter(node => node.name.startsWith('Responsive/')).map(node => [node.name, node.id]));
  const motion = Object.fromEntries(existingRoots.filter(node => node.name.startsWith('Motion/')).map(node => [node.name, node.id]));
  return { createdNodeIds: [], mutatedNodeIds: [], responsive, motion, reused: true };
}

const fonts = {
  sans: { family: 'Noto Sans SC', style: 'Regular' },
  med: { family: 'Noto Sans SC', style: 'Medium' },
  bold: { family: 'Noto Sans SC', style: 'Bold' },
  serif: { family: 'Noto Serif SC', style: 'Medium' },
  serifB: { family: 'Noto Serif SC', style: 'SemiBold' },
  latin: { family: 'Cormorant Garamond', style: 'SemiBold' },
  num: { family: 'Inter', style: 'Semi Bold' }
};
await Promise.all(Object.values(fonts).map(font => figma.loadFontAsync(font)));

const C = {
  cream: '#FBF7EF', parchment: '#F2E9DA', pearl: '#FFFDF8', sage: '#748276', forest: '#294139',
  rose: '#A85570', burgundy: '#6D2942', gold: '#C9A866', antique: '#92743E', midnight: '#111A2D',
  ink: '#302D2A', muted: '#6D6862', line: '#DED3C4', success: '#55745E', warning: '#B77B4D',
  blush: '#F4E5E8', mint: '#E8F0E8', bluePaper: '#E7E9F0'
};
const rgb = hex => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255
});
const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: rgb(hex), opacity });
const boardShadow = {
  type: 'DROP_SHADOW',
  color: { ...rgb(C.midnight), a: 0.16 },
  offset: { x: 0, y: 18 },
  radius: 38,
  spread: -10,
  visible: true,
  blendMode: 'NORMAL'
};
const ids = [];
const responsive = {};
const motion = {};
function add(parent, node) {
  parent.appendChild(node);
  ids.push(node.id);
  return node;
}
function collectTree(node) {
  ids.push(node.id);
  if ('children' in node) node.children.forEach(collectTree);
}
function txt(parent, name, characters, x, y, width, size, font = fonts.sans, color = C.ink, align = 'LEFT', lineHeight = null) {
  const node = add(parent, figma.createText());
  node.name = name;
  node.fontName = font;
  node.characters = characters;
  node.fontSize = size;
  node.fills = [solid(color)];
  node.textAlignHorizontal = align;
  node.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.5) };
  node.resize(width, size * 7);
  node.textAutoResize = 'HEIGHT';
  node.x = x;
  node.y = y;
  return node;
}
function rect(parent, name, x, y, width, height, color, radius = 0, stroke = null, opacity = 1) {
  const node = add(parent, figma.createRectangle());
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(width, height);
  node.fills = [solid(color, opacity)];
  node.cornerRadius = radius;
  if (stroke) {
    node.strokes = [solid(stroke)];
    node.strokeWeight = 1;
  }
  return node;
}
function ell(parent, name, x, y, width, height, color, stroke = null, opacity = 1) {
  const node = add(parent, figma.createEllipse());
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(width, height);
  node.fills = [solid(color, opacity)];
  if (stroke) {
    node.strokes = [solid(stroke)];
    node.strokeWeight = 1;
  }
  return node;
}
function label(parent, characters, x, y, width, color = C.antique, align = 'LEFT') {
  const node = txt(parent, 'Eyebrow', characters.toUpperCase(), x, y, width, 12, fonts.med, color, align, 18);
  node.letterSpacing = { unit: 'PERCENT', value: 10 };
  return node;
}
function pill(parent, x, y, width, characters, color, fill) {
  rect(parent, 'Pill', x, y, width, 36, fill, 18, color);
  txt(parent, 'PillLabel', characters, x, y + 8, width, 12, fonts.med, color, 'CENTER', 18);
}
function leaf(parent, x, y, scale, rotation, color = C.sage, opacity = 0.72) {
  const node = ell(parent, 'BotanicalLeaf', x, y, 52 * scale, 22 * scale, color, null, opacity);
  node.rotation = rotation;
  return node;
}
function heart(parent, x, y, size, color, opacity = 1) {
  const node = txt(parent, 'Heart', '♥', x, y, size * 1.4, size, fonts.serifB, color, 'CENTER', size * 1.2);
  node.opacity = opacity;
  return node;
}
function pot(parent, x, y, scale = 1, dark = false) {
  const fill = dark ? C.midnight : C.parchment;
  rect(parent, 'PlanterRim', x, y, 118 * scale, 22 * scale, dark ? C.gold : C.antique, 11 * scale);
  const body = rect(parent, 'PlanterBody', x + 11 * scale, y + 18 * scale, 96 * scale, 72 * scale, fill, 18 * scale, dark ? C.gold : C.line);
  body.bottomLeftRadius = 28 * scale;
  body.bottomRightRadius = 28 * scale;
  return body;
}
function gift(parent, x, y, scale, open = false, dark = true) {
  const baseColor = dark ? C.midnight : C.pearl;
  const box = rect(parent, 'GiftBox', x, y + (open ? 52 : 34) * scale, 150 * scale, 112 * scale, baseColor, 18 * scale, C.gold);
  rect(parent, 'RibbonVertical', x + 67 * scale, y + (open ? 52 : 34) * scale, 16 * scale, 112 * scale, C.rose, 8 * scale);
  if (open) {
    const lid = rect(parent, 'GiftLidOpen', x - 8 * scale, y, 166 * scale, 30 * scale, baseColor, 15 * scale, C.gold);
    lid.rotation = -8;
    rect(parent, 'RibbonLid', x + 61 * scale, y - 2 * scale, 18 * scale, 34 * scale, C.rose, 9 * scale);
  } else {
    rect(parent, 'GiftLid', x - 8 * scale, y + 24 * scale, 166 * scale, 32 * scale, baseColor, 15 * scale, C.gold);
    rect(parent, 'RibbonLid', x + 66 * scale, y + 24 * scale, 18 * scale, 32 * scale, C.rose, 9 * scale);
  }
  return box;
}

// Source screens are located by stable direct-child names because later phase node IDs do not exist yet.
// Async cross-page reads avoid changing the current page inside this use_figma transaction.
const girlfriendSection = await figma.getNodeByIdAsync('5:5');
const sponsorSection = await figma.getNodeByIdAsync('5:8');
if (!girlfriendSection || girlfriendSection.type !== 'SECTION') throw new Error('Girlfriend section missing');
if (!sponsorSection || sponsorSection.type !== 'SECTION') throw new Error('Sponsor operations section missing');
const sourceHome = girlfriendSection.children.find(node => node.type === 'FRAME' && node.name === 'Screen/02-Home/Girlfriend/Default/390');
const sourceReview = sponsorSection.children.find(node => node.type === 'FRAME' && node.name === 'Screen/17-SponsorReview/Default/390');
if (!sourceHome || sourceHome.type !== 'FRAME') throw new Error('Girlfriend home source screen missing');
if (!sourceReview || sourceReview.type !== 'FRAME') throw new Error('Sponsor review source screen missing');
if (Math.round(sourceHome.width) !== 390 || Math.round(sourceHome.height) !== 844) throw new Error('Girlfriend home source screen has unexpected dimensions');
if (Math.round(sourceReview.width) !== 390 || Math.round(sourceReview.height) !== 844) throw new Error('Sponsor review source screen has unexpected dimensions');

const responsiveDefs = [
  { name: 'Responsive/Home/Girlfriend/375', source: sourceHome, width: 375, height: 812, x: 100, y: 170, margin: 16, role: '女友首页' },
  { name: 'Responsive/Home/Girlfriend/390', source: sourceHome, width: 390, height: 844, x: 535, y: 170, margin: 20, role: '女友首页' },
  { name: 'Responsive/Home/Girlfriend/430', source: sourceHome, width: 430, height: 932, x: 985, y: 170, margin: 24, role: '女友首页' },
  { name: 'Responsive/SponsorReview/375', source: sourceReview, width: 375, height: 812, x: 100, y: 1260, margin: 16, role: '审核台' },
  { name: 'Responsive/SponsorReview/390', source: sourceReview, width: 390, height: 844, x: 535, y: 1260, margin: 20, role: '审核台' },
  { name: 'Responsive/SponsorReview/430', source: sourceReview, width: 430, height: 932, x: 985, y: 1260, margin: 24, role: '审核台' }
];
const stagedClones = responsiveDefs.map(def => ({ def, node: def.source.clone() }));

label(section, 'Responsive verification', 100, 48, 620, C.burgundy);
txt(section, 'ResponsiveTitle', '同一套花园语言，在三种微信视口里保持从容', 100, 78, 1250, 30, fonts.serifB, C.forest, 'LEFT', 44);
txt(section, 'ResponsiveCopy', '375 使用 16px 边距，390 使用 20px，430 使用 24px；表单保持单列，底部操作与安全区分离。专项画板保留同源组件实例，验证长昵称、长鼓励和四位数金额。', 100, 120, 1300, 13, fonts.sans, C.muted, 'LEFT', 21);

for (const { def, node } of stagedClones) {
  section.appendChild(node);
  collectTree(node);
  node.name = def.name;
  const scale = def.width / 390;
  node.rescale(scale);
  node.resize(def.width, def.height);
  node.x = def.x;
  node.y = def.y;
  node.clipsContent = true;
  node.description = `${def.role} responsive verification at ${def.width}×${def.height}; target horizontal margin ${def.margin}px; safe-area aware.`;
  responsive[def.name] = node.id;

  const labelY = def.y - 58;
  txt(section, 'ViewportLabel', `${def.width} × ${def.height}`, def.x, labelY, def.width, 16, fonts.num, C.burgundy, 'CENTER', 22);
  txt(section, 'ViewportRule', `${def.margin}px margin · safe area`, def.x, labelY + 24, def.width, 12, fonts.med, C.muted, 'CENTER', 18);
}

function storyboard(name, x, y, eyebrow, title, subtitle, dark = false) {
  const board = add(section, figma.createFrame());
  board.name = name;
  board.x = x;
  board.y = y;
  board.resize(3300, 1420);
  board.fills = [solid(dark ? C.midnight : C.pearl)];
  board.cornerRadius = 32;
  board.clipsContent = true;
  board.strokes = [solid(C.gold)];
  board.strokeWeight = 1;
  board.effects = [boardShadow];
  board.description = 'Implementation storyboard with standard, low-performance, and reduced-motion behavior.';
  motion[name] = board.id;
  label(board, eyebrow, 48, 42, 700, dark ? C.gold : C.rose);
  txt(board, 'StoryboardTitle', title, 48, 78, 2100, 34, fonts.serifB, dark ? C.pearl : C.forest, 'LEFT', 48);
  txt(board, 'StoryboardSubtitle', subtitle, 48, 132, 2500, 14, fonts.sans, dark ? C.parchment : C.muted, 'LEFT', 23);
  pill(board, 2784, 48, 244, dark ? 'CEREMONY · L4' : 'GROWTH · L1–L3', dark ? C.gold : C.forest, dark ? C.midnight : C.cream);
  return board;
}
function shot(board, index, time, title, note, dark = false) {
  const x = 48 + index * 800;
  const frame = add(board, figma.createFrame());
  frame.name = `Shot/${String(index + 1).padStart(2, '0')}-${title}`;
  frame.x = x;
  frame.y = 222;
  frame.resize(708, 746);
  frame.fills = [solid(dark ? C.midnight : C.cream)];
  frame.cornerRadius = 24;
  frame.clipsContent = true;
  frame.strokes = [solid(dark ? C.gold : C.line)];
  frame.strokeWeight = 1;
  txt(frame, 'ShotNumber', String(index + 1).padStart(2, '0'), 24, 20, 76, 18, fonts.num, dark ? C.gold : C.antique, 'LEFT', 24);
  txt(frame, 'ShotTime', time, 454, 22, 230, 14, fonts.num, dark ? C.parchment : C.muted, 'RIGHT', 20);
  txt(frame, 'ShotTitle', title, 24, 60, 620, 24, fonts.serifB, dark ? C.pearl : C.forest, 'LEFT', 34);
  const stage = add(frame, figma.createFrame());
  stage.name = 'Stage';
  stage.x = 24;
  stage.y = 112;
  stage.resize(660, 430);
  stage.fills = [solid(dark ? C.midnight : C.pearl)];
  stage.cornerRadius = 20;
  stage.clipsContent = true;
  stage.strokes = [solid(dark ? C.gold : C.line)];
  stage.strokeWeight = 1;
  txt(frame, 'ShotNote', note, 24, 570, 650, 13, fonts.sans, dark ? C.parchment : C.muted, 'LEFT', 22);
  return stage;
}
function contractStrip(board, columns, dark = false) {
  const strip = add(board, figma.createFrame());
  strip.name = 'ImplementationContract';
  strip.x = 48;
  strip.y = 1020;
  strip.resize(3204, 330);
  strip.fills = [solid(dark ? C.midnight : C.parchment)];
  strip.cornerRadius = 22;
  strip.clipsContent = true;
  strip.strokes = [solid(dark ? C.gold : C.line)];
  strip.strokeWeight = 1;
  columns.forEach((column, index) => {
    const x = 28 + index * 786;
    if (index > 0) rect(strip, 'ColumnDivider', x - 22, 24, 1, 282, dark ? C.gold : C.line, 0, null, dark ? 0.45 : 1);
    label(strip, column[0], x, 28, 720, dark ? C.gold : C.rose);
    txt(strip, 'ContractTitle', column[1], x, 64, 700, 18, fonts.serifB, dark ? C.pearl : C.forest, 'LEFT', 27);
    txt(strip, 'ContractCopy', column[2], x, 108, 700, 13, fonts.sans, dark ? C.parchment : C.muted, 'LEFT', 22);
  });
}

const growth = storyboard(
  'Motion/01-GardenGrowth/Storyboard',
  1550,
  170,
  'Motion storyboard 01',
  '花园生长：让反馈像植物舒展，而不是像任务进度条催促',
  'L1 90–160ms · L2 180–280ms · L3 220–320ms · 只使用 transform 与 opacity；同屏持续动画最多两个。'
);
const growthStages = [
  shot(growth, 0, '0 ms', '安静落位', '首屏先稳定呈现；标题、今日卡与导航都可立即阅读。'),
  shot(growth, 1, '160 ms', '轻柔发芽', '标题与首卡上移 8px 并淡入；内容级联每组错峰 40ms。'),
  shot(growth, 2, '360 ms', '回应成长', '提交反馈以 scale 0.98 → 1 与透明度变化表达，不改变布局。'),
  shot(growth, 3, '720 ms', '回到静止', '枝叶只完成一次生长后停止；滚动时暂停装饰性变化。')
];
// Growth stage 1
pot(growthStages[0], 274, 292, 0.9);
rect(growthStages[0], 'Stem', 326, 236, 8, 62, C.sage, 4);
leaf(growthStages[0], 285, 246, 0.72, -28);
// Growth stage 2
pot(growthStages[1], 274, 292, 0.9);
rect(growthStages[1], 'Stem', 326, 166, 8, 132, C.sage, 4);
leaf(growthStages[1], 278, 218, 0.82, -28);
leaf(growthStages[1], 330, 188, 0.82, 28);
ell(growthStages[1], 'Bud', 310, 142, 40, 40, C.blush, C.rose);
// Growth stage 3
pot(growthStages[2], 274, 292, 0.9);
rect(growthStages[2], 'Stem', 326, 116, 8, 182, C.sage, 4);
leaf(growthStages[2], 270, 220, 0.92, -28);
leaf(growthStages[2], 332, 188, 0.92, 28);
leaf(growthStages[2], 278, 152, 0.78, -34);
leaf(growthStages[2], 336, 132, 0.78, 34);
ell(growthStages[2], 'BloomOuter', 288, 66, 84, 84, C.blush, C.rose);
ell(growthStages[2], 'BloomInner', 308, 86, 44, 44, C.rose);
heart(growthStages[2], 426, 96, 24, C.rose, 0.8);
// Growth stage 4
pot(growthStages[3], 274, 292, 0.9);
rect(growthStages[3], 'Stem', 326, 96, 8, 202, C.forest, 4);
leaf(growthStages[3], 260, 220, 1, -28, C.sage, 0.86);
leaf(growthStages[3], 334, 188, 1, 28, C.sage, 0.86);
leaf(growthStages[3], 268, 144, 0.88, -34, C.sage, 0.86);
leaf(growthStages[3], 342, 122, 0.88, 34, C.sage, 0.86);
ell(growthStages[3], 'BloomOuter', 282, 46, 96, 96, C.blush, C.rose);
ell(growthStages[3], 'BloomInner', 305, 69, 50, 50, C.rose);
pill(growthStages[3], 430, 326, 170, '+20 能量', C.forest, C.mint);
contractStrip(growth, [
  ['Standard', '标准效果', '进入使用 cubic-bezier(0.22, 1, 0.36, 1)；最多四组级联，总延迟不超过 160ms。'],
  ['Low performance', '低性能降级', '省略枝叶逐段生长；直接显示终态 poster，仅保留一次 180ms 淡入。'],
  ['Reduce motion', '减少动态', '取消位移、缩放和 overshoot，仅保留 120–180 ms opacity 淡入淡出。'],
  ['WeChat budget', '小程序实现预算', '优先 transform / opacity；页面滚动时停止装饰；不使用常驻粒子或实时模糊。']
]);

const ceremony = storyboard(
  'Motion/02-Ceremony/Storyboard',
  1550,
  1740,
  'Motion storyboard 02',
  '礼物与里程碑仪式：华丽只出现一次，珍藏感留下来',
  'L4 600–900ms 后必须停止 · 最多一次轻柔 overshoot · Remotion 视频失败时依次回落 poster 与原生动画。',
  true
);
const ceremonyStages = [
  shot(ceremony, 0, '0 ms', '礼盒静候', '先显示完整信息与关闭入口；动效不是理解状态的前提。', true),
  shot(ceremony, 1, '180 ms', '缎带松开', '礼盒以 transform 轻微上移，缎带旋转一次；背景保持静止。', true),
  shot(ceremony, 2, '480 ms', '心愿绽放', '仅成功场景出现少量心形与金色微光，粒子不循环。', true),
  shot(ceremony, 3, '820 ms', '纪念落册', '900ms 前收束为静态纪念卡；可继续浏览、关闭或返回。', true)
];
gift(ceremonyStages[0], 252, 138, 1, false, true);
heart(ceremonyStages[0], 300, 78, 34, C.gold, 0.72);
gift(ceremonyStages[1], 252, 138, 1, false, true);
const ribbonTail = rect(ceremonyStages[1], 'RibbonTail', 398, 154, 86, 16, C.rose, 8);
ribbonTail.rotation = -18;
heart(ceremonyStages[1], 288, 72, 32, C.gold, 0.82);
gift(ceremonyStages[2], 252, 156, 1, true, true);
heart(ceremonyStages[2], 250, 64, 34, C.rose);
heart(ceremonyStages[2], 328, 30, 44, C.gold);
heart(ceremonyStages[2], 414, 78, 28, C.rose, 0.78);
ell(ceremonyStages[2], 'Glow', 238, 36, 202, 202, C.gold, null, 0.08);
const memoryCard = rect(ceremonyStages[3], 'MemoryCard', 104, 82, 452, 264, C.pearl, 26, C.gold);
label(ceremonyStages[3], 'A shared keepsake', 140, 112, 380, C.antique, 'CENTER');
heart(ceremonyStages[3], 278, 154, 58, C.rose);
txt(ceremonyStages[3], 'KeepsakeTitle', '花园小径 · 已点亮', 140, 226, 380, 24, fonts.serifB, C.forest, 'CENTER', 34);
txt(ceremonyStages[3], 'KeepsakeMeta', '一次庆祝，永久留在共同收藏里', 140, 274, 380, 13, fonts.sans, C.muted, 'CENTER', 21);
contractStrip(ceremony, [
  ['Standard', '标准仪式', '180ms 启动、480ms 峰值、820ms 落定；最多一次柔和 overshoot，900ms 后完全停止。'],
  ['Low performance', '低性能降级', 'Remotion 不可用时展示静态 poster，再用 300–600ms 原生 ribbon / hearts 反馈。'],
  ['Reduce motion', '减少动态', '150ms 交叉淡入纪念卡；取消位移、粒子、旋转与 overshoot，信息保持完整。'],
  ['Safety', '内容与性能边界', '无常驻粒子、无无限循环、无真实支付视觉；关闭按钮始终拥有 44×44px 点击区域。']
], true);

return {
  createdNodeIds: ids,
  mutatedNodeIds: [...Object.values(responsive), ...Object.values(motion)],
  responsive,
  motion,
  sourceScreenIds: { girlfriendHome: sourceHome.id, sponsorReview: sourceReview.id }
};
