const deliveryPage = await figma.getNodeByIdAsync('4:3');
if (!deliveryPage || deliveryPage.type !== 'PAGE') throw new Error('Delivery page missing');
await figma.setCurrentPageAsync(deliveryPage);

const handoffSection = await figma.getNodeByIdAsync('5:12');
if (!handoffSection || handoffSection.type !== 'SECTION') throw new Error('Handoff section missing');

const HANDOFF_NAME = 'Documentation/HandoffIndex';
const HOTSPOT_MIN = 44;
const PRODUCT_SECTION_IDS = ['5:5', '5:6', '5:7', '5:8', '5:9', '5:10'];
const flowSpecs = [
  {
    name: '首次绑定',
    route: 'Bind → 绑定关系确认 → Home / Girlfriend',
    note: '邀请码与双方角色确认后才进入私人花园。'
  },
  {
    name: '女友成长与奖励',
    route: 'Home / Girlfriend → Checkin → History → AdventureMap → Shop → RewardDetail → Redemptions',
    note: '打卡、里程碑与礼物兑换均经过影响说明或确认画板。'
  },
  {
    name: '男友守护',
    route: 'Home / Boyfriend → SponsorCompanion → SponsorReview → SponsorPayouts',
    note: '只提供陪伴、审核与线下兑现记录，不出现代打卡。'
  },
  {
    name: '每周回顾',
    route: 'Home / Girlfriend → WeeklyRecap → Empty week → WeeklyRecap → Home',
    note: '空白周保持温柔，不补惩罚、不制造连续中断焦虑。'
  },
  {
    name: '资料与设置',
    route: 'Home / Girlfriend → Profile → ProfileEdit → Profile → Home',
    note: '头像昵称最小化展示，保存后回到情侣庄园纹章。'
  }
];

const hotspotDefs = [
  { flow: '首次绑定', source: 'Screen/01-Bind/Default/390', name: 'PrototypeHotspot/Binding/Confirm', target: 'DialogBoard/01-BindingConfirm/390', x: 20, y: 700, width: 350, height: 64 },
  { flow: '首次绑定', source: 'DialogBoard/01-BindingConfirm/390', name: 'PrototypeHotspot/Binding/EnterGarden', target: 'Screen/02-Home/Girlfriend/Default/390', x: 40, y: 556, width: 310, height: 64 },

  { flow: '女友成长与奖励', source: 'Screen/02-Home/Girlfriend/Default/390', name: 'PrototypeHotspot/Girlfriend/StartCheckin', target: 'Screen/04-Checkin/Default/390', x: 20, y: 250, width: 350, height: 92 },
  { flow: '女友成长与奖励', source: 'Screen/04-Checkin/Default/390', name: 'PrototypeHotspot/Girlfriend/SubmitCheckin', target: 'DialogBoard/02-CheckinSubmit/390', x: 20, y: 700, width: 350, height: 64 },
  { flow: '女友成长与奖励', source: 'DialogBoard/02-CheckinSubmit/390', name: 'PrototypeHotspot/Girlfriend/ViewHistory', target: 'Screen/06-History/Default/390', x: 40, y: 556, width: 310, height: 64 },
  { flow: '女友成长与奖励', source: 'Screen/06-History/Default/390', name: 'PrototypeHotspot/Girlfriend/OpenAdventureMap', target: 'Screen/05-AdventureMap/Default/390', x: 20, y: 120, width: 350, height: 92 },
  { flow: '女友成长与奖励', source: 'Screen/05-AdventureMap/Default/390', name: 'PrototypeHotspot/Girlfriend/OpenMilestoneCeremony', target: 'DialogBoard/08-Celebration/MilestoneGiftMap/390', x: 226, y: 238, width: 124, height: 124, duration: 0.72 },
  { flow: '女友成长与奖励', source: 'DialogBoard/08-Celebration/MilestoneGiftMap/390', name: 'PrototypeHotspot/Girlfriend/OpenShop', target: 'Screen/09-Shop/Default/390', x: 40, y: 526, width: 310, height: 64, duration: 0.72 },
  { flow: '女友成长与奖励', source: 'Screen/09-Shop/Default/390', name: 'PrototypeHotspot/Girlfriend/OpenReward', target: 'Screen/10-RewardDetail/Default/390', x: 20, y: 284, width: 350, height: 178 },
  { flow: '女友成长与奖励', source: 'Screen/10-RewardDetail/Default/390', name: 'PrototypeHotspot/Girlfriend/RedeemReward', target: 'DialogBoard/05-GiftRedemption/390', x: 20, y: 700, width: 350, height: 64 },
  { flow: '女友成长与奖励', source: 'DialogBoard/05-GiftRedemption/390', name: 'PrototypeHotspot/Girlfriend/ConfirmRedemption', target: 'Screen/11-Redemptions/Default/390', x: 40, y: 556, width: 310, height: 64 },

  { flow: '男友守护', source: 'Screen/03-Home/Boyfriend/Default/390', name: 'PrototypeHotspot/Boyfriend/OpenCompanion', target: 'Screen/12-SponsorCompanion/Default/390', x: 20, y: 594, width: 350, height: 132 },
  { flow: '男友守护', source: 'Screen/12-SponsorCompanion/Default/390', name: 'PrototypeHotspot/Boyfriend/OpenReview', target: 'Screen/17-SponsorReview/Default/390', x: 20, y: 594, width: 350, height: 132 },
  { flow: '男友守护', source: 'Screen/17-SponsorReview/Default/390', name: 'PrototypeHotspot/Boyfriend/ApproveCheckin', target: 'DialogBoard/03-ReviewApprove/390', x: 20, y: 700, width: 350, height: 64 },
  { flow: '男友守护', source: 'DialogBoard/03-ReviewApprove/390', name: 'PrototypeHotspot/Boyfriend/OpenPayouts', target: 'Screen/18-SponsorPayouts/Default/390', x: 40, y: 556, width: 310, height: 64 },
  { flow: '男友守护', source: 'Screen/18-SponsorPayouts/Default/390', name: 'PrototypeHotspot/Boyfriend/FulfilWishFund', target: 'DialogBoard/07-WishFundFulfilment/390', x: 20, y: 596, width: 350, height: 92 },
  { flow: '男友守护', source: 'DialogBoard/07-WishFundFulfilment/390', name: 'PrototypeHotspot/Boyfriend/ReturnToPayouts', target: 'Screen/18-SponsorPayouts/Default/390', x: 40, y: 556, width: 310, height: 64 },

  { flow: '每周回顾', source: 'Screen/02-Home/Girlfriend/Default/390', name: 'PrototypeHotspot/Recap/OpenWeeklyRecap', target: 'Screen/07-WeeklyRecap/Default/390', x: 202, y: 604, width: 168, height: 124 },
  { flow: '每周回顾', source: 'Screen/07-WeeklyRecap/Default/390', name: 'PrototypeHotspot/Recap/OpenEmptyWeek', target: 'StateBoard/07-WeeklyRecapEmpty/390', x: 202, y: 794, width: 168, height: 50 },
  { flow: '每周回顾', source: 'StateBoard/07-WeeklyRecapEmpty/390', name: 'PrototypeHotspot/Recap/ReturnToRecap', target: 'Screen/07-WeeklyRecap/Default/390', x: 0, y: 24, width: 76, height: 64 },
  { flow: '每周回顾', source: 'Screen/07-WeeklyRecap/Default/390', name: 'PrototypeHotspot/Recap/ReturnHome', target: 'Screen/02-Home/Girlfriend/Default/390', x: 0, y: 24, width: 76, height: 64 },

  { flow: '资料与设置', source: 'Screen/02-Home/Girlfriend/Default/390', name: 'PrototypeHotspot/Profile/OpenProfile', target: 'Screen/21-Profile/Default/390', x: 292, y: 768, width: 78, height: 76 },
  { flow: '资料与设置', source: 'Screen/21-Profile/Default/390', name: 'PrototypeHotspot/Profile/EditPrivateCard', target: 'Screen/22-ProfileEdit/Default/390', x: 20, y: 622, width: 350, height: 48 },
  { flow: '资料与设置', source: 'Screen/22-ProfileEdit/Default/390', name: 'PrototypeHotspot/Profile/SavePrivateCard', target: 'Screen/21-Profile/Default/390', x: 20, y: 748, width: 350, height: 76 },
  { flow: '资料与设置', source: 'Screen/21-Profile/Default/390', name: 'PrototypeHotspot/Profile/ReturnHome', target: 'Screen/02-Home/Girlfriend/Default/390', x: 0, y: 24, width: 76, height: 64 }
];

const sections = [];
for (const sectionId of PRODUCT_SECTION_IDS) {
  const sectionNode = await figma.getNodeByIdAsync(sectionId);
  if (!sectionNode || sectionNode.type !== 'SECTION') throw new Error(`Product section missing: ${sectionId}`);
  sections.push(sectionNode);
}

const neededRootNames = new Set(hotspotDefs.flatMap(def => [def.source, def.target]));
const rootsByName = new Map();
for (const sectionNode of sections) {
  for (const child of sectionNode.children) {
    if (child.type !== 'FRAME' || !neededRootNames.has(child.name)) continue;
    if (rootsByName.has(child.name)) throw new Error(`Duplicate prototype root: ${child.name}`);
    rootsByName.set(child.name, child);
  }
}
for (const rootName of neededRootNames) {
  if (!rootsByName.has(rootName)) throw new Error(`Prototype root missing: ${rootName}`);
}

const handoffMatches = handoffSection.children.filter(node => node.type === 'FRAME' && node.name === HANDOFF_NAME);
if (handoffMatches.length > 1) throw new Error('Duplicate handoff index roots detected');
let existingHotspotCount = 0;
for (const def of hotspotDefs) {
  const source = rootsByName.get(def.source);
  const matches = source.children.filter(node => node.name === def.name);
  if (matches.length > 1) throw new Error(`Duplicate prototype hotspot: ${def.name}`);
  if (matches.length === 1) {
    const hotspot = matches[0];
    if (!('reactions' in hotspot) || hotspot.width < HOTSPOT_MIN || hotspot.height < HOTSPOT_MIN || hotspot.reactions.length !== 1) {
      throw new Error(`Prototype hotspot is incomplete: ${def.name}`);
    }
    const action = hotspot.reactions[0] && hotspot.reactions[0].actions && hotspot.reactions[0].actions[0];
    const target = rootsByName.get(def.target);
    if (!action || action.type !== 'NODE' || action.destinationId !== target.id) {
      throw new Error(`Prototype hotspot points to the wrong destination: ${def.name}`);
    }
    existingHotspotCount += 1;
  }
}

if (handoffMatches.length || existingHotspotCount) {
  if (handoffMatches.length !== 1 || existingHotspotCount !== hotspotDefs.length) {
    throw new Error('Prototype/handoff phase has an incomplete prior node set; inspect before retrying');
  }
  return {
    createdNodeIds: [],
    mutatedNodeIds: [],
    handoffIndex: handoffMatches[0].id,
    prototypeHotspots: Object.fromEntries(hotspotDefs.map(def => [def.name, rootsByName.get(def.source).children.find(node => node.name === def.name).id])),
    flows: flowSpecs.map(flow => flow.name),
    reused: true
  };
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
for (const font of Object.values(fonts)) await figma.loadFontAsync(font);

const C = {
  cream: '#FBF7EF', parchment: '#F2E9DA', pearl: '#FFFDF8', sage: '#748276', forest: '#294139',
  rose: '#A85570', burgundy: '#6D2942', gold: '#C9A866', antique: '#92743E', midnight: '#111A2D',
  ink: '#302D2A', muted: '#6D6862', line: '#DED3C4', success: '#55745E', warning: '#B77B4D', blush: '#F4E5E8'
};
const rgb = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });
const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: rgb(hex), opacity });
const shadow = { type: 'DROP_SHADOW', color: { ...rgb(C.midnight), a: 0.12 }, offset: { x: 0, y: 18 }, radius: 42, spread: -10, visible: true, blendMode: 'NORMAL' };
const createdNodeIds = [];
const mutatedNodeIds = [];
const hotspotIds = {};

function add(parent, node) {
  parent.appendChild(node);
  createdNodeIds.push(node.id);
  return node;
}
function text(parent, name, characters, x, y, width, size = 16, font = fonts.sans, color = C.ink, align = 'LEFT', lineHeight = null) {
  const node = add(parent, figma.createText());
  node.name = name;
  node.fontName = font;
  node.characters = characters;
  node.fontSize = size;
  node.fills = [solid(color)];
  node.textAlignHorizontal = align;
  node.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.55) };
  node.resize(width, Math.max(80, size * 10));
  node.textAutoResize = 'HEIGHT';
  node.x = x;
  node.y = y;
  return node;
}
function rectangle(parent, name, x, y, width, height, fill, radius = 0, stroke = null, opacity = 1) {
  const node = add(parent, figma.createRectangle());
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(width, height);
  node.fills = [solid(fill, opacity)];
  node.cornerRadius = radius;
  if (stroke) {
    node.strokes = [solid(stroke)];
    node.strokeWeight = 1;
  }
  return node;
}
function ellipse(parent, name, x, y, width, height, fill, stroke = null, opacity = 1) {
  const node = add(parent, figma.createEllipse());
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(width, height);
  node.fills = [solid(fill, opacity)];
  if (stroke) {
    node.strokes = [solid(stroke)];
    node.strokeWeight = 1;
  }
  return node;
}
function frame(parent, name, x, y, width, height, fill = C.pearl, radius = 24, stroke = C.line) {
  const node = add(parent, figma.createFrame());
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(width, height);
  node.fills = [solid(fill)];
  node.cornerRadius = radius;
  node.clipsContent = true;
  if (stroke) {
    node.strokes = [solid(stroke)];
    node.strokeWeight = 1;
  }
  return node;
}
function eyebrow(parent, label, x, y, width, color = C.antique, align = 'LEFT') {
  const node = text(parent, 'Eyebrow', label.toUpperCase(), x, y, width, 13, fonts.med, color, align, 19);
  node.letterSpacing = { unit: 'PERCENT', value: 10 };
  return node;
}
function divider(parent, x, y, width, color = C.line) {
  return rectangle(parent, 'Divider', x, y, width, 1, color);
}
function bullet(parent, label, copy, x, y, width, accent = C.rose) {
  ellipse(parent, 'Bullet', x, y + 8, 9, 9, accent);
  text(parent, 'BulletLabel', label, x + 24, y, width - 24, 15, fonts.med, C.ink, 'LEFT', 22);
  text(parent, 'BulletCopy', copy, x + 24, y + 30, width - 24, 13, fonts.sans, C.muted, 'LEFT', 21);
}

const index = frame(handoffSection, HANDOFF_NAME, 100, 100, 3000, 2700, C.cream, 36, C.gold);
index.effects = [shadow];

rectangle(index, 'Cover/MidnightBand', 0, 0, 3000, 420, C.midnight);
ellipse(index, 'Cover/Glow', 2320, -320, 760, 760, C.gold, null, 0.08);
ellipse(index, 'Cover/RoseGlow', 2520, 60, 440, 440, C.rose, null, 0.10);
rectangle(index, 'Cover/GoldRule', 80, 340, 2840, 2, C.gold);
eyebrow(index, 'Jardin des Vœux · Design handoff', 92, 70, 1200, C.gold);
text(index, 'Cover/LatinTitle', 'Jardin des Vœux', 88, 112, 1460, 64, fonts.latin, C.pearl, 'LEFT', 72);
text(index, 'Cover/ChineseTitle', '心愿花园高级定制 · 全量交付索引', 92, 205, 1600, 35, fonts.serifB, C.pearl, 'LEFT', 50);
text(index, 'Cover/Subtitle', '法式花园 70% · 香槟宫廷 20% · 午夜珠宝 10%  ｜  微信小程序可实现  ｜  页面流畅性优先', 94, 282, 1900, 16, fonts.sans, C.parchment, 'LEFT', 25);
const crest = frame(index, 'Cover/CoupleCrest', 2480, 84, 300, 220, C.midnight, 110, C.gold);
ellipse(crest, 'Bear', 54, 52, 96, 96, '#8A6654', C.gold);
ellipse(crest, 'Bunny', 150, 52, 96, 96, '#F3E8D8', C.gold);
text(crest, 'Heart', '♥', 122, 90, 58, 30, fonts.serifB, C.rose, 'CENTER', 40);
text(crest, 'Signature', 'OURS, GENTLY', 40, 164, 220, 13, fonts.med, C.gold, 'CENTER', 18);

const inventory = frame(index, 'Inventory/Overview', 80, 470, 2840, 330, C.pearl, 28, C.line);
eyebrow(inventory, 'Delivery inventory', 30, 26, 500, C.rose);
text(inventory, 'Title', '46 张业务画板，结构完整且可按名称自动验收', 30, 60, 1600, 28, fonts.serifB, C.forest, 'LEFT', 40);
const counts = [
  ['46', '业务画板', '总交付'], ['22', '核心页面', 'Screen/'], ['8', '关键弹窗', 'DialogBoard/'],
  ['8', '跨页状态', 'StateBoard/'], ['6', '响应式验证', 'Responsive/'], ['2', '动效分镜', 'Motion/']
];
counts.forEach((item, indexNo) => {
  const x = 30 + indexNo * 460;
  const card = frame(inventory, `Inventory/Count/${item[1]}`, x, 126, 420, 160, indexNo === 0 ? C.midnight : C.cream, 22, indexNo === 0 ? C.gold : C.line);
  text(card, 'Value', item[0], 20, 18, 150, 42, fonts.num, indexNo === 0 ? C.gold : C.forest, 'LEFT', 52);
  text(card, 'Label', item[1], 20, 78, 220, 16, fonts.med, indexNo === 0 ? C.pearl : C.ink, 'LEFT', 24);
  text(card, 'Meta', item[2], 20, 110, 220, 13, fonts.sans, indexNo === 0 ? C.parchment : C.muted, 'LEFT', 20);
});

const map = frame(index, 'Architecture/FileMap', 80, 840, 880, 760, C.pearl, 28, C.line);
eyebrow(map, 'File architecture', 30, 28, 500, C.rose);
text(map, 'Title', '3 个物理页面 · 11 个语义 Section', 30, 64, 800, 25, fonts.serifB, C.forest, 'LEFT', 36);
const pageRows = [
  ['00', 'System & Library', 'Cover · Foundations · Components'],
  ['01', 'Product Screens', 'Girlfriend · Boyfriend · Rewards · Operations · Profile'],
  ['02', 'Delivery & Motion', 'Dialogs · Responsive · Motion · Handoff']
];
pageRows.forEach((row, indexNo) => {
  const y = 132 + indexNo * 112;
  text(map, 'PageNo', row[0], 30, y, 70, 24, fonts.num, C.antique, 'LEFT', 32);
  text(map, 'PageTitle', row[1], 116, y, 330, 17, fonts.med, C.ink, 'LEFT', 25);
  text(map, 'PageMeta', row[2], 116, y + 34, 670, 13, fonts.sans, C.muted, 'LEFT', 21);
  if (indexNo < pageRows.length - 1) divider(map, 30, y + 88, 820);
});
text(map, 'SectionList', '00 Cover & Index\n01 Foundations\n02 Components\n03 Core / Girlfriend\n04 Core / Boyfriend\n05 Rewards & Garden\n06 Sponsor Operations\n07 Profile & Weekly Recap\n08 Dialogs & States\n09 Responsive & Motion\n10 Handoff Notes', 30, 486, 820, 14, fonts.sans, C.ink, 'LEFT', 23);

const flows = frame(index, 'Prototype/Flows', 1000, 840, 1920, 760, C.pearl, 28, C.line);
eyebrow(flows, 'Clickable prototype', 30, 28, 500, C.rose);
text(flows, 'Title', '五条双账号核心路径', 30, 64, 900, 25, fonts.serifB, C.forest, 'LEFT', 36);
text(flows, 'Intro', `共 ${hotspotDefs.length} 个透明热点；全部至少 44×44 px，并使用 240ms 标准缓动。`, 30, 104, 1300, 14, fonts.sans, C.muted, 'LEFT', 22);
flowSpecs.forEach((flow, indexNo) => {
  const column = indexNo % 2;
  const row = Math.floor(indexNo / 2);
  const x = 30 + column * 930;
  const y = 154 + row * 178;
  const flowCard = frame(flows, `Prototype/Flow/${flow.name}`, x, y, 880, 150, row === 2 ? C.midnight : C.cream, 20, row === 2 ? C.gold : C.line);
  text(flowCard, 'Index', String(indexNo + 1).padStart(2, '0'), 18, 16, 54, 18, fonts.num, row === 2 ? C.gold : C.antique, 'LEFT', 24);
  text(flowCard, 'Name', flow.name, 78, 14, 310, 18, fonts.serifB, row === 2 ? C.pearl : C.ink, 'LEFT', 26);
  text(flowCard, 'Route', flow.route, 78, 48, 770, 13, fonts.med, row === 2 ? C.gold : C.forest, 'LEFT', 20);
  text(flowCard, 'Note', flow.note, 78, 84, 770, 13, fonts.sans, row === 2 ? C.parchment : C.muted, 'LEFT', 21);
});

const tokens = frame(index, 'Handoff/Tokens', 80, 1640, 880, 500, C.pearl, 28, C.line);
eyebrow(tokens, 'Foundations & components', 30, 28, 600, C.rose);
text(tokens, 'Title', '语义令牌与复用边界', 30, 64, 800, 25, fonts.serifB, C.forest, 'LEFT', 36);
const swatches = [[C.cream, 'Surface/App'], [C.pearl, 'Surface/Card'], [C.forest, 'Action/Primary'], [C.rose, 'Accent/Rose'], [C.gold, 'Accent/Gold'], [C.midnight, 'Surface/Ceremony']];
swatches.forEach((item, indexNo) => {
  const x = 30 + (indexNo % 3) * 270;
  const y = 126 + Math.floor(indexNo / 3) * 94;
  rectangle(tokens, 'Token/Swatch', x, y, 56, 56, item[0], 16, item[0] === C.cream || item[0] === C.pearl ? C.line : null);
  text(tokens, 'Token/Name', item[1], x + 72, y + 6, 186, 13, fonts.med, C.ink, 'LEFT', 20);
  text(tokens, 'Token/Value', item[0], x + 72, y + 31, 186, 12, fonts.num, C.muted, 'LEFT', 18);
});
bullet(tokens, '组件复用', '导航、按钮、输入、卡片、状态和反馈来自本地组件库；原型热点只追加到业务根画板。', 30, 338, 800, C.sage);
bullet(tokens, '组件保护', '不拆解 Instance，不修改 Main Component 内部结构，不复制散落样式。', 30, 414, 800, C.rose);

const responsive = frame(index, 'Handoff/Responsive', 1000, 1640, 920, 500, C.pearl, 28, C.line);
eyebrow(responsive, 'Responsive rules', 30, 28, 520, C.rose);
text(responsive, 'Title', '375 / 390 / 430 三档验证', 30, 64, 840, 25, fonts.serifB, C.forest, 'LEFT', 36);
const viewportRules = [
  ['375×812', '紧凑安全区', '左右留白 16–20；主操作不下沉到不可达区域。'],
  ['390×844', '设计基准', '所有核心页面以该视口建立视觉与内容基线。'],
  ['430×932', '宽屏舒展', '卡片内容扩展但文字行长受控，不做简单等比放大。']
];
viewportRules.forEach((item, indexNo) => {
  const y = 126 + indexNo * 104;
  text(responsive, 'Viewport', item[0], 30, y, 150, 18, fonts.num, C.antique, 'LEFT', 24);
  text(responsive, 'RuleTitle', item[1], 196, y, 190, 15, fonts.med, C.ink, 'LEFT', 22);
  text(responsive, 'RuleCopy', item[2], 396, y, 472, 13, fonts.sans, C.muted, 'LEFT', 21);
  if (indexNo < viewportRules.length - 1) divider(responsive, 30, y + 78, 840);
});
text(responsive, 'TapRule', '点击目标：视觉可小于 44px，但交互热区必须 ≥44×44px。', 30, 438, 840, 14, fonts.med, C.burgundy, 'LEFT', 22);

const motion = frame(index, 'Handoff/Motion', 1960, 1640, 960, 500, C.midnight, 28, C.gold);
eyebrow(motion, 'Motion performance budget', 30, 28, 600, C.gold);
text(motion, 'Title', '顺滑优先，仪式感必须可降级', 30, 64, 880, 25, fonts.serifB, C.pearl, 'LEFT', 36);
const motionRules = [
  ['90–160ms', '按钮与轻触反馈', '仅 transform / opacity'],
  ['220–280ms', '页面进入与原型跳转', 'cubic-bezier(0.22, 1, 0.36, 1)'],
  ['600–900ms', '里程碑与礼物仪式', '播放一次后停止'],
  ['120–180ms', '减少动态', '不位移、不缩放，仅短淡入']
];
motionRules.forEach((item, indexNo) => {
  const y = 126 + indexNo * 72;
  text(motion, 'Duration', item[0], 30, y, 150, 16, fonts.num, C.gold, 'LEFT', 22);
  text(motion, 'Use', item[1], 196, y, 250, 14, fonts.med, C.pearl, 'LEFT', 21);
  text(motion, 'Rule', item[2], 460, y, 450, 13, fonts.sans, C.parchment, 'LEFT', 21);
});
divider(motion, 30, 414, 900, C.gold);
text(motion, 'Fallback', 'Remotion 动效 → poster 静态海报 → 原生 transform / opacity 反馈；低性能设备不加载重资产。', 30, 434, 890, 13, fonts.sans, C.gold, 'LEFT', 21);

const constraints = frame(index, 'Handoff/Acceptance', 80, 2180, 2840, 440, C.pearl, 28, C.line);
eyebrow(constraints, 'Implementation & acceptance', 30, 26, 700, C.rose);
text(constraints, 'Title', '微信小程序实现边界与验收原则', 30, 60, 1200, 25, fonts.serifB, C.forest, 'LEFT', 36);
const acceptanceItems = [
  ['流畅性', '不使用实时模糊、超大阴影动画或无限粒子；长列表采用细分割线与按需加载。'],
  ['照片受限', '跨账号云照片不可见时，以文字、时间和双方线下确认为替代验收，不伪造同步成功。'],
  ['资金安全', '没有真实支付、红包、转账或随机现金能力；所有心愿金仅记录线下手动兑现。'],
  ['可读性', '普通正文与交互文字不小于 12px；状态栏和英文 eyebrow 单独记录为例外候选。'],
  ['交互目标', '所有点击区域至少 44×44px；透明热点填充 1% 仅用于 Figma 原型，不进入生产视觉。'],
  ['动效降级', '标准、低性能、减少动态三档均可独立成立；动画结束后必须停止。']
];
acceptanceItems.forEach((item, indexNo) => {
  const column = indexNo % 3;
  const row = Math.floor(indexNo / 3);
  const x = 30 + column * 930;
  const y = 126 + row * 136;
  const card = frame(constraints, `Acceptance/${item[0]}`, x, y, 880, 112, row === 1 && column === 2 ? C.midnight : C.cream, 18, row === 1 && column === 2 ? C.gold : C.line);
  text(card, 'Title', item[0], 18, 14, 160, 16, fonts.med, row === 1 && column === 2 ? C.gold : C.burgundy, 'LEFT', 23);
  text(card, 'Copy', item[1], 18, 46, 842, 13, fonts.sans, row === 1 && column === 2 ? C.parchment : C.muted, 'LEFT', 21);
});
text(index, 'Footer', 'HANDOFF INDEX · JARDIN DES VŒUX · PRIVATE COUPLE EXPERIENCE · 2026-07-10', 80, 2652, 2840, 13, fonts.med, C.antique, 'CENTER', 20);

function transitionFor(def) {
  return {
    type: 'SMART_ANIMATE',
    easing: {
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: { x1: 0.22, y1: 1, x2: 0.36, y2: 1 }
    },
    duration: def.duration || 0.24
  };
}

for (const def of hotspotDefs) {
  const source = rootsByName.get(def.source);
  const target = rootsByName.get(def.target);
  const hotspot = figma.createRectangle();
  source.appendChild(hotspot);
  createdNodeIds.push(hotspot.id);
  hotspot.name = def.name;
  hotspot.x = def.x;
  hotspot.y = def.y;
  const width = def.width;
  const height = def.height;
  hotspot.resize(Math.max(HOTSPOT_MIN, width), Math.max(HOTSPOT_MIN, height));
  hotspot.fills = [{ type: 'SOLID', color: rgb(C.pearl), opacity: 0.01 }];
  hotspot.strokes = [];
  await hotspot.setReactionsAsync([
    {
      trigger: { type: 'ON_CLICK' },
      actions: [
        {
          type: 'NODE',
          destinationId: target.id,
          navigation: 'NAVIGATE',
          transition: transitionFor(def),
          resetScrollPosition: true
        }
      ]
    }
  ]);
  hotspotIds[def.name] = hotspot.id;
  mutatedNodeIds.push(hotspot.id);
}

return {
  createdNodeIds,
  mutatedNodeIds,
  handoffIndex: index.id,
  prototypeHotspots: hotspotIds,
  flows: Object.fromEntries(flowSpecs.map(flow => [flow.name, hotspotDefs.filter(def => def.flow === flow.name).map(def => def.name)])),
  counts: { businessFrames: 46, coreScreens: 22, dialogs: 8, states: 8, responsive: 6, motion: 2 },
  reused: false
};
