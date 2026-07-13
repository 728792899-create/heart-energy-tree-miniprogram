const page = await figma.getNodeByIdAsync('4:2');
if (!page || page.type !== 'PAGE') throw new Error('Product page missing');
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('5:10');
if (!section || section.type !== 'SECTION') throw new Error('Dialogs and states section missing');

const dialogNames = [
  'DialogBoard/01-BindingConfirm/390',
  'DialogBoard/02-CheckinSubmit/390',
  'DialogBoard/03-ReviewApprove/390',
  'DialogBoard/04-ReviewReturn/390',
  'DialogBoard/05-GiftRedemption/390',
  'DialogBoard/06-RedemptionCancelRefund/390',
  'DialogBoard/07-WishFundFulfilment/390',
  'DialogBoard/08-Celebration/MilestoneGiftMap/390'
];
const stateNames = [
  'StateBoard/01-HomeSkeleton/390',
  'StateBoard/02-HomeOffline/390',
  'StateBoard/03-CheckinReturned/390',
  'StateBoard/04-HistoryEmpty/390',
  'StateBoard/05-ShopEmpty/390',
  'StateBoard/06-ReviewQueueEmpty/390',
  'StateBoard/07-WeeklyRecapEmpty/390',
  'StateBoard/08-PhotoPermissionLimited/390'
];
const expectedNames = [...dialogNames, ...stateNames];
const existingRoots = section.children.filter(n => n.type === 'FRAME' && expectedNames.includes(n.name));
if (existingRoots.length) {
  if (existingRoots.length !== expectedNames.length) throw new Error('Dialogs/states phase has an incomplete prior root set; inspect before retrying');
  const dialogs = Object.fromEntries(existingRoots.filter(n => dialogNames.includes(n.name)).map(n => [n.name, n.id]));
  const states = Object.fromEntries(existingRoots.filter(n => stateNames.includes(n.name)).map(n => [n.name, n.id]));
  const existingDoc = section.children.find(n => n.type === 'FRAME' && n.name === 'Documentation/DialogsStates');
  return { createdNodeIds: [], mutatedNodeIds: [], dialogs, states, documentationNodeIds: existingDoc ? [existingDoc.id] : [], reused: true };
}

const fonts = {
  sans: { family: 'Noto Sans SC', style: 'Regular' }, med: { family: 'Noto Sans SC', style: 'Medium' },
  serif: { family: 'Noto Serif SC', style: 'Medium' }, serifB: { family: 'Noto Serif SC', style: 'SemiBold' },
  latin: { family: 'Cormorant Garamond', style: 'SemiBold' }, num: { family: 'Inter', style: 'Semi Bold' }
};
await Promise.all(Object.values(fonts).map(font => figma.loadFontAsync(font)));
const C = {
  cream: '#FBF7EF', parchment: '#F2E9DA', pearl: '#FFFDF8', sage: '#748276', forest: '#294139',
  rose: '#A85570', burgundy: '#6D2942', gold: '#C9A866', antique: '#92743E', midnight: '#111A2D',
  ink: '#302D2A', muted: '#6D6862', line: '#DED3C4', success: '#55745E', warning: '#B77B4D', error: '#9A4B5B'
};
const rgb = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });
const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: rgb(hex), opacity });
const screenShadow = { type: 'DROP_SHADOW', color: { ...rgb(C.midnight), a: 0.14 }, offset: { x: 0, y: 16 }, radius: 34, spread: -8, visible: true, blendMode: 'NORMAL' };
const modalShadow = { type: 'DROP_SHADOW', color: { ...rgb(C.midnight), a: 0.28 }, offset: { x: 0, y: 18 }, radius: 48, spread: -10, visible: true, blendMode: 'NORMAL' };
const ids = [];
const dialogs = {};
const states = {};
function add(parent, node) { parent.appendChild(node); ids.push(node.id); return node; }
function txt(parent, name, characters, x, y, width, size, font = fonts.sans, color = C.ink, align = 'LEFT', lineHeight = null) {
  const node = add(parent, figma.createText()); node.name = name; node.fontName = font; node.characters = characters; node.fontSize = size;
  node.fills = [solid(color)]; node.textAlignHorizontal = align; node.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.5) };
  node.resize(width, size * 8); node.textAutoResize = 'HEIGHT'; node.x = x; node.y = y; return node;
}
function rect(parent, name, x, y, width, height, color, radius = 0, stroke = null, opacity = 1) {
  const node = add(parent, figma.createRectangle()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color, opacity)]; node.cornerRadius = radius;
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function ell(parent, name, x, y, width, height, color, stroke = null, opacity = 1) {
  const node = add(parent, figma.createEllipse()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color, opacity)];
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function divider(parent, x, y, width, color = C.line) { return rect(parent, 'Divider', x, y, width, 1, color); }
function label(parent, characters, x, y, width, color = C.antique, align = 'LEFT') {
  const node = txt(parent, 'Eyebrow', characters.toUpperCase(), x, y, width, 10, fonts.med, color, align, 15); node.letterSpacing = { unit: 'PERCENT', value: 10 }; return node;
}
function sectionLabel(characters, y) { txt(section, 'SectionLabel', characters, 100, y, 4140, 18, fonts.serifB, C.burgundy, 'LEFT', 28); }
function board(parentName, x, y, fill = C.cream) {
  const node = add(section, figma.createFrame()); node.name = parentName; node.x = x; node.y = y; node.resize(390, 844); node.fills = [solid(fill)];
  node.cornerRadius = 32; node.clipsContent = true; node.effects = [screenShadow];
  txt(node, 'StatusTime', '9:41', 20, 9, 80, 11, fonts.num, fill === C.midnight ? C.pearl : C.ink, 'LEFT', 16);
  txt(node, 'StatusIcons', '●  ◒  ▰', 286, 9, 84, 10, fonts.sans, fill === C.midnight ? C.pearl : C.ink, 'RIGHT', 16); return node;
}
function card(parent, name, x, y, width, height, color = C.pearl, radius = 20, stroke = C.line) {
  const node = add(parent, figma.createFrame()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color)]; node.cornerRadius = radius;
  node.clipsContent = true; if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function top(parent, title, dark = false) {
  txt(parent, 'Back', '‹', 12, 37, 48, 32, fonts.serifB, dark ? C.pearl : C.forest, 'CENTER', 42);
  txt(parent, 'Title', title, 70, 44, 250, 17, fonts.serifB, dark ? C.pearl : C.ink, 'CENTER', 26);
  rect(parent, 'TopDivider', 0, 95, 390, 1, dark ? C.gold : C.line, 0, null, dark ? 0.35 : 1);
}
function button(parent, x, y, width, labelText, primary = true, danger = false, dark = false) {
  const fill = danger ? C.burgundy : primary ? (dark ? C.gold : C.forest) : (dark ? C.midnight : C.pearl);
  const stroke = primary ? fill : dark ? C.gold : C.line;
  rect(parent, 'Button', x, y, width, 52, fill, 26, stroke);
  const color = danger ? C.pearl : primary ? (dark ? C.midnight : C.pearl) : (dark ? C.gold : C.forest);
  txt(parent, 'ButtonLabel', labelText, x, y + 14, width, 13, fonts.med, color, 'CENTER', 21);
}
function status(parent, x, y, textValue, color, fill = C.pearl, width = 96) {
  rect(parent, 'StatusPill', x, y, width, 30, fill, 15, color); txt(parent, 'StatusText', textValue, x, y + 6, width, 10, fonts.med, color, 'CENTER', 16);
}
function botanicalSeal(parent, x, y, color = C.gold, dark = false) {
  ell(parent, 'SealRing', x, y, 76, 76, dark ? C.midnight : C.pearl, color);
  txt(parent, 'SealGlyph', 'JV', x, y + 17, 76, 23, fonts.latin, color, 'CENTER', 34);
}

sectionLabel('08A — KEY DIALOGS · 8 BOARDS', 62);
const dialogDefs = [
  {
    name: dialogNames[0], title: '确认进入彼此的花园？', eyebrow: 'PRIVATE INVITATION',
    copy: '绑定后，仅你们两个人能看到彼此在本小程序中的花园信息。', impact: '不会读取通讯录，也不会公开关系。',
    primary: '确认绑定', secondary: '再看一眼', accent: C.rose, icon: '♥'
  },
  {
    name: dialogNames[1], title: '收藏今天的成长？', eyebrow: 'CHECK-IN CONFIRMATION',
    copy: '将记录 42 分钟晚风散步，并提交给他温柔确认。', impact: '提交后可在审核前补充文字；照片按云权限展示。',
    primary: '确认收藏', secondary: '继续编辑', accent: C.forest, icon: '♧'
  },
  {
    name: dialogNames[2], title: '确认并送出鼓励？', eyebrow: 'APPROVE WITH CARE',
    copy: '本次通过将增加 42 能量币，并发送你写下的具体认可。', impact: '账簿变化：+42 能量币；状态变为“已通过”。',
    primary: '确认通过', secondary: '再检查一下', accent: C.success, icon: '✓'
  },
  {
    name: dialogNames[3], title: '请她补充一点信息？', eyebrow: 'RETURN FOR EDIT',
    copy: '退回只说明可修改的事实，不评价努力程度。', impact: '原因：请补充活动时长；她可修改后再次提交。',
    primary: '温柔退回', secondary: '取消', accent: C.error, icon: '↺', danger: true
  },
  {
    name: dialogNames[4], title: '兑换这束周末花？', eyebrow: 'GIFT REDEMPTION',
    copy: '兑换后进入线下兑现流程，不会触发真实支付。', impact: '余额变化：1,840 → 1,160 能量币；库存 1 → 0。',
    primary: '用 680 能量兑换', secondary: '暂时收藏', accent: C.antique, icon: '◇'
  },
  {
    name: dialogNames[5], title: '取消并退还能量币？', eyebrow: 'CANCEL & REFUND',
    copy: '取消后，本次礼物履约将终止，历史记录仍保留。', impact: '余额变化：1,160 → 1,840 能量币；退还 +680。',
    primary: '确认取消并退还', secondary: '继续保留', accent: C.error, icon: '−', danger: true
  },
  {
    name: dialogNames[6], title: '记录线下兑现完成？', eyebrow: 'MANUAL FULFILMENT',
    copy: '这里只更新双方账簿，不进行红包、转账或平台付款。', impact: '待兑现 ¥36 → 已记录 ¥36；资金仍由双方线下处理。',
    primary: '确认已线下完成', secondary: '还没有', accent: C.antique, icon: '¥'
  },
  {
    name: dialogNames[7], title: '花园里亮起一颗新星', eyebrow: 'A MOMENT TO KEEP',
    copy: '可用于里程碑、礼物开启与地图抵达；庆祝结束后自动停止。', impact: '标准 800ms · 低性能仅淡入 · 减少动态 160ms。',
    primary: '收藏这一刻', secondary: '轻轻关闭', accent: C.gold, icon: '✦', ceremony: true
  }
];

dialogDefs.forEach((def, index) => {
  const x = 100 + index * 510;
  const frame = board(def.name, x, 100, def.ceremony ? C.midnight : C.cream); dialogs[def.name] = frame.id;
  top(frame, index % 2 === 0 ? '我的心愿花园' : '花园守护人', !!def.ceremony);
  // Underlying page context
  const under = card(frame, 'UnderlyingContent', 20, 120, 350, 580, def.ceremony ? C.midnight : C.pearl, 24, def.ceremony ? C.gold : C.line);
  label(under, 'Garden context', 18, 18, 240, def.ceremony ? C.gold : C.rose);
  rect(under, 'UnderHero', 18, 50, 314, 104, def.ceremony ? C.midnight : C.parchment, 18, def.ceremony ? C.gold : C.line);
  rect(under, 'UnderLine1', 18, 180, 236, 14, def.ceremony ? C.gold : C.line, 7, null, def.ceremony ? 0.22 : 0.7);
  rect(under, 'UnderLine2', 18, 212, 286, 12, def.ceremony ? C.gold : C.line, 6, null, def.ceremony ? 0.16 : 0.55);
  rect(under, 'UnderCard', 18, 252, 314, 142, def.ceremony ? C.midnight : C.cream, 18, def.ceremony ? C.gold : C.line);
  // Modal overlay
  rect(frame, 'Overlay', 0, 96, 390, 748, C.midnight, 0, null, def.ceremony ? 0.28 : 0.48);
  const modalHeight = def.ceremony ? 470 : 430;
  const modalY = def.ceremony ? 184 : 214;
  const modal = card(frame, 'Dialog/Modal', 20, modalY, 350, modalHeight, def.ceremony ? C.midnight : C.pearl, 28, def.ceremony ? C.gold : C.line);
  modal.effects = [modalShadow];
  if (def.ceremony) {
    ell(modal, 'Glow', 78, -46, 194, 194, C.gold, null, 0.12);
    [['✦', 54, 58], ['·', 276, 44], ['✧', 286, 126], ['·', 42, 154]].forEach(item => txt(modal, 'Sparkle', item[0], item[1], item[2], 28, 16, fonts.serifB, C.gold, 'CENTER', 24));
  }
  ell(modal, 'IconHalo', 135, 28, 80, 80, def.ceremony ? C.midnight : C.parchment, def.accent);
  txt(modal, 'DialogIcon', def.icon, 135, 48, 80, 25, fonts.serifB, def.accent, 'CENTER', 34);
  label(modal, def.eyebrow, 24, 124, 302, def.ceremony ? C.gold : def.accent, 'CENTER');
  txt(modal, 'DialogTitle', def.title, 24, 154, 302, def.ceremony ? 21 : 20, fonts.serifB, def.ceremony ? C.pearl : C.ink, 'CENTER', 30);
  txt(modal, 'DialogCopy', def.copy, 28, 204, 294, 11, fonts.sans, def.ceremony ? C.parchment : C.muted, 'CENTER', 18);
  const impact = card(modal, 'Dialog/Impact', 20, 270, 310, 64, def.ceremony ? C.midnight : C.cream, 16, def.ceremony ? C.gold : C.line);
  txt(impact, 'Impact', def.impact, 14, 13, 282, 10, fonts.sans, def.ceremony ? C.gold : (def.danger ? C.burgundy : C.forest), 'CENTER', 17);
  button(modal, 20, def.ceremony ? 352 : 352, 310, def.primary, true, !!def.danger, !!def.ceremony);
  txt(modal, 'SecondaryAction', def.secondary, 20, def.ceremony ? 422 : 410, 310, 11, fonts.med, def.ceremony ? C.gold : C.muted, 'CENTER', 18);
  if (def.ceremony) {
    const chips = [['里程碑', C.rose], ['礼物', C.gold], ['地图', C.sage]];
    chips.forEach((chip, chipIndex) => {
      const chipX = 32 + chipIndex * 96; rect(modal, 'VariantChip', chipX, 318, 86, 24, C.midnight, 12, chip[1]);
      txt(modal, 'VariantLabel', chip[0], chipX, 322, 86, 9, fonts.med, chip[1], 'CENTER', 14);
    });
  }
});

sectionLabel('08B — CROSS-PAGE STATES · 8 BOARDS', 1054);
const stateDefs = [
  { name: stateNames[0], type: 'skeleton', title: '首页加载骨架', subtitle: '保持布局稳定，不使用旋转大图标。' },
  { name: stateNames[1], type: 'offline', title: '暂时没有连上花园', subtitle: '已显示上次同步内容；恢复网络后可重试。' },
  { name: stateNames[2], type: 'returned', title: '这条收藏可以再补充', subtitle: '原因：请补充活动时长。修改后可再次提交。' },
  { name: stateNames[3], type: 'historyEmpty', title: '花园还在等第一片叶子', subtitle: '从一次轻松的散步开始，也很好。' },
  { name: stateNames[4], type: 'shopEmpty', title: '礼物工坊正在整理', subtitle: '当前没有可兑换礼物，能量币会安全保留。' },
  { name: stateNames[5], type: 'reviewEmpty', title: '今天没有待确认的收藏', subtitle: '无需操作；可以写一句轻松的鼓励。' },
  { name: stateNames[6], type: 'recapEmpty', title: '这周也可以只是好好休息', subtitle: '没有记录不代表没有成长，下周再见。' },
  { name: stateNames[7], type: 'permission', title: '这张照片暂时不可见', subtitle: '跨账号权限受限；请使用文字与线下确认验收。' }
];

stateDefs.forEach((def, index) => {
  const x = 100 + index * 510;
  const frame = board(def.name, x, 1110, def.type === 'recapEmpty' ? C.midnight : C.cream); states[def.name] = frame.id;
  top(frame, def.type === 'reviewEmpty' ? '私人花园审阅桌' : def.type === 'shopEmpty' ? '巴黎花园礼物店' : '我的心愿花园', def.type === 'recapEmpty');
  if (def.type === 'skeleton') {
    const hero = card(frame, 'Skeleton/Hero', 20, 120, 350, 190, C.parchment, 22, C.parchment);
    rect(hero, 'SkeletonLine', 18, 24, 116, 12, C.line, 6, null, 0.65);
    rect(hero, 'SkeletonTitle1', 18, 56, 244, 22, C.line, 11, null, 0.75);
    rect(hero, 'SkeletonTitle2', 18, 90, 194, 22, C.line, 11, null, 0.58);
    rect(hero, 'SkeletonButton', 18, 132, 314, 42, C.line, 21, null, 0.72);
    [0, 1, 2].forEach(i => {
      const box = card(frame, 'Skeleton/Card', 20, 330 + i * 116, 350, 98, C.pearl, 18);
      rect(box, 'SkeletonIcon', 16, 16, 52, 52, C.parchment, 18);
      rect(box, 'SkeletonText', 84, 18, 160 + i * 22, 14, C.line, 7, null, 0.68);
      rect(box, 'SkeletonText', 84, 48, 206 - i * 18, 12, C.line, 6, null, 0.5);
    });
    txt(frame, 'SkeletonNote', '骨架与真实布局同构 · 不造成页面跳动', 20, 704, 350, 10, fonts.sans, C.muted, 'CENTER', 16);
    return;
  }
  const dark = def.type === 'recapEmpty';
  const content = card(frame, 'State/Content', 20, 138, 350, 550, dark ? C.midnight : C.pearl, 26, dark ? C.gold : C.line);
  if (dark) {
    ell(content, 'Glow', 70, 16, 210, 210, C.gold, null, 0.08);
  }
  const accent = def.type === 'offline' ? C.warning : def.type === 'returned' ? C.error : def.type === 'permission' ? C.rose : def.type === 'reviewEmpty' ? C.success : dark ? C.gold : C.sage;
  const glyph = def.type === 'offline' ? '⌁' : def.type === 'returned' ? '↺' : def.type === 'permission' ? '♡' : def.type === 'reviewEmpty' ? '✓' : dark ? '☾' : '♧';
  ell(content, 'StateHalo', 121, 58, 108, 108, dark ? C.midnight : C.cream, accent);
  txt(content, 'StateGlyph', glyph, 121, 86, 108, 30, fonts.serifB, accent, 'CENTER', 42);
  label(content, 'A gentle state', 34, 194, 282, accent, 'CENTER');
  txt(content, 'StateTitle', def.title, 34, 226, 282, 20, fonts.serifB, dark ? C.pearl : C.ink, 'CENTER', 30);
  txt(content, 'StateCopy', def.subtitle, 40, 292, 270, 11, fonts.sans, dark ? C.parchment : C.muted, 'CENTER', 18);
  if (def.type === 'returned') {
    status(content, 127, 350, '可修改', C.error, C.pearl, 96);
    const reason = card(content, 'Returned/Reason', 24, 394, 302, 68, C.cream, 16, C.line);
    txt(reason, 'Reason', '请补充活动时长；其余内容已保留。', 14, 14, 274, 10, fonts.sans, C.burgundy, 'CENTER', 17);
    button(content, 24, 480, 302, '去补充并再次提交', true, false, false);
  } else if (def.type === 'permission') {
    const alternative = card(content, 'Permission/Alternative', 24, 364, 302, 98, C.cream, 16, C.line);
    txt(alternative, 'Title', '可替代验收方式', 14, 12, 274, 11, fonts.med, C.forest, 'CENTER', 17);
    txt(alternative, 'Copy', '查看文字、时间与双方线下确认；不暗示图片已成功同步。', 14, 40, 274, 10, fonts.sans, C.muted, 'CENTER', 17);
    button(content, 24, 480, 302, '知道了', true, false, false);
  } else if (def.type === 'offline') {
    status(content, 119, 354, '上次同步 20:42', C.warning, C.cream, 112);
    button(content, 24, 420, 302, '重新连接花园', true, false, false);
    txt(content, 'NoDataLoss', '未提交的文字仍保存在本机。', 24, 486, 302, 10, fonts.sans, C.muted, 'CENTER', 16);
  } else if (def.type === 'reviewEmpty') {
    status(content, 127, 354, '无需操作', C.success, C.pearl, 96);
    button(content, 24, 420, 302, '写一句轻松的鼓励', false, false, false);
  } else if (def.type === 'shopEmpty') {
    status(content, 119, 354, '余额已保留', C.antique, C.pearl, 112);
    txt(content, 'NoAction', '无需刷新；礼物发布后会自动出现。', 24, 420, 302, 10, fonts.sans, C.muted, 'CENTER', 17);
  } else if (def.type === 'historyEmpty') {
    button(content, 24, 410, 302, '收藏第一次轻松散步', true, false, false);
  } else if (def.type === 'recapEmpty') {
    status(content, 127, 354, '允许休息', C.gold, C.midnight, 96);
    txt(content, 'NoAction', '不提供“补打卡”入口，也不显示连续天数中断惩罚。', 24, 412, 302, 10, fonts.sans, C.parchment, 'CENTER', 17);
  }
});

const doc = add(section, figma.createFrame());
doc.name = 'Documentation/DialogsStates'; doc.x = 100; doc.y = 2160; doc.resize(4140, 650); doc.fills = [solid(C.midnight)]; doc.cornerRadius = 28; doc.clipsContent = true;
label(doc, 'State language system', 34, 34, 500, C.gold);
txt(doc, 'DocTitle', '每一次确认都说明影响，每一种状态都给出恢复路径', 34, 72, 3300, 28, fonts.serifB, C.pearl, 'LEFT', 42);
txt(doc, 'DocCopy', '弹窗不制造紧迫感；涉及余额、退还、履约与退回时明确前后变化。空白状态若无需操作，就清楚地说“无需操作”。', 34, 126, 3800, 14, fonts.sans, C.parchment, 'LEFT', 25);
const policies = [
  ['影响可见', '金额、状态、库存\n前后变化写清楚'],
  ['动作分层', '主操作明确\n破坏性动作不抢眼'],
  ['恢复优先', '离线、失败、权限\n都有替代路径'],
  ['情绪安全', '允许休息与空白\n不责备不催促'],
  ['性能克制', '无持续粒子\n骨架与布局同构'],
  ['可访问性', '文字 + 图标 + 边框\n44px 点击区域'],
  ['内容安全', '无真实支付\n不暗示照片可见'],
  ['减少动态', '120–180ms 淡入\n取消位移与 overshoot']
];
policies.forEach((item, index) => {
  const x = 34 + index * 500;
  rect(doc, 'PolicyCard', x, 230, 460, 230, C.midnight, 22, C.gold);
  txt(doc, 'PolicyNo', String(index + 1).padStart(2, '0'), x + 22, 252, 70, 18, fonts.num, C.gold, 'LEFT', 24);
  txt(doc, 'PolicyTitle', item[0], x + 22, 294, 190, 20, fonts.serifB, C.pearl, 'LEFT', 30);
  txt(doc, 'PolicyCopy', item[1], x + 22, 340, 390, 12, fonts.sans, C.parchment, 'LEFT', 20);
});
txt(doc, 'Perf', '8 DIALOGS · 8 STATES · EXPLICIT IMPACT · RECOVERY ACTION OR NO-ACTION EXPLANATION', 34, 535, 3800, 12, fonts.med, C.gold, 'LEFT', 18);

return { createdNodeIds: ids, mutatedNodeIds: [...Object.values(dialogs), ...Object.values(states)], dialogs, states, documentationNodeIds: [doc.id] };
