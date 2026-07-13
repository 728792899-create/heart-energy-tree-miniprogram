const page = await figma.getNodeByIdAsync('4:2');
if (!page || page.type !== 'PAGE') throw new Error('Product page missing');
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('5:6');
if (!section || section.type !== 'SECTION') throw new Error('Boyfriend section missing');

const expectedNames = [
  'Screen/03-Home/Boyfriend/Default/390',
  'Screen/12-SponsorCompanion/Default/390',
  'Screen/13-SponsorCompanionHistory/Default/390',
  'Screen/14-SponsorCompanionBadges/Default/390',
  'Screen/15-SponsorCompanionLedgers/Default/390',
  'Screen/16-SponsorCompanionRedemptions/Default/390'
];
const existingRoots = section.children.filter(n => n.type === 'FRAME' && expectedNames.includes(n.name));
if (existingRoots.length) {
  if (existingRoots.length !== expectedNames.length) throw new Error('Boyfriend phase has an incomplete prior root set; inspect before retrying');
  const existingScreens = Object.fromEntries(existingRoots.map(n => [n.name, n.id]));
  const existingDoc = section.children.find(n => n.type === 'FRAME' && n.name === 'Documentation/BoyfriendFlow');
  return { createdNodeIds: [], mutatedNodeIds: [], screens: existingScreens, documentationNodeIds: existingDoc ? [existingDoc.id] : [], reused: true };
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
  error: '#9A4B5B', brown: '#8A6654', bunny: '#F3E8D8'
};
const rgb = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });
const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: rgb(hex), opacity });
const screenShadow = { type: 'DROP_SHADOW', color: { ...rgb(C.midnight), a: 0.14 }, offset: { x: 0, y: 16 }, radius: 34, spread: -8, visible: true, blendMode: 'NORMAL' };
const ids = [];
const screens = {};
function add(parent, node) { parent.appendChild(node); ids.push(node.id); return node; }
function txt(parent, name, characters, x, y, width, size, font = fonts.sans, color = C.ink, align = 'LEFT', lineHeight = null) {
  const node = add(parent, figma.createText());
  node.name = name; node.fontName = font; node.characters = characters; node.fontSize = size;
  node.fills = [solid(color)]; node.textAlignHorizontal = align;
  node.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.5) };
  node.resize(width, size * 6); node.textAutoResize = 'HEIGHT'; node.x = x; node.y = y;
  return node;
}
function rect(parent, name, x, y, width, height, color, radius = 0, stroke = null, opacity = 1) {
  const node = add(parent, figma.createRectangle());
  node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color, opacity)]; node.cornerRadius = radius;
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; }
  return node;
}
function ell(parent, name, x, y, width, height, color, stroke = null, opacity = 1) {
  const node = add(parent, figma.createEllipse());
  node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color, opacity)];
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; }
  return node;
}
function divider(parent, x, y, width, color = C.line) { return rect(parent, 'Divider', x, y, width, 1, color); }
function label(parent, characters, x, y, width, color = C.antique, align = 'LEFT') {
  const node = txt(parent, 'Eyebrow', characters.toUpperCase(), x, y, width, 10, fonts.med, color, align, 15);
  node.letterSpacing = { unit: 'PERCENT', value: 10 };
  return node;
}
function caption(characters, x) { txt(section, 'ScreenLabel', characters, x, 108, 390, 14, fonts.med, C.burgundy, 'CENTER', 20); }
function screen(name, x) {
  const node = add(section, figma.createFrame());
  node.name = name; node.x = x; node.y = 150; node.resize(390, 844); node.fills = [solid(C.cream)];
  node.cornerRadius = 32; node.clipsContent = true; node.effects = [screenShadow];
  screens[name] = node.id;
  txt(node, 'StatusTime', '9:41', 20, 9, 80, 11, fonts.num, C.ink, 'LEFT', 16);
  txt(node, 'StatusIcons', '●  ◒  ▰', 286, 9, 84, 10, fonts.sans, C.ink, 'RIGHT', 16);
  return node;
}
function card(parent, name, x, y, width, height, color = C.pearl, radius = 20, stroke = C.line) {
  const node = add(parent, figma.createFrame());
  node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color)];
  node.cornerRadius = radius; node.clipsContent = true;
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; }
  return node;
}
function leaf(parent, x, y, scale, rotation, color = C.sage, opacity = 0.62) {
  const node = ell(parent, 'BotanicalLeaf', x, y, 30 * scale, 13 * scale, color, null, opacity);
  node.rotation = rotation; return node;
}
function avatar(parent, x, y, bunny = false) {
  ell(parent, 'AvatarHalo', x, y, 58, 58, C.parchment, C.gold);
  if (bunny) {
    ell(parent, 'EarLeft', x + 14, y + 3, 9, 24, C.bunny, C.gold);
    ell(parent, 'EarRight', x + 34, y + 3, 9, 24, C.bunny, C.gold);
    ell(parent, 'Head', x + 10, y + 15, 38, 36, C.bunny, C.gold);
  } else {
    ell(parent, 'EarLeft', x + 8, y + 7, 16, 16, C.brown, C.antique);
    ell(parent, 'EarRight', x + 34, y + 7, 16, 16, C.brown, C.antique);
    ell(parent, 'Head', x + 10, y + 13, 38, 38, C.brown, C.antique);
  }
}
function crest(parent, x, y) {
  ell(parent, 'CrestRing', x, y, 86, 86, C.pearl, C.gold);
  avatar(parent, x - 2, y + 14, false); avatar(parent, x + 30, y + 14, true);
  txt(parent, 'CrestHeart', '♥', x + 27, y + 48, 32, 13, fonts.serifB, C.rose, 'CENTER', 18);
}

const componentIds = {
  topDefault: '12:2', topBack: '12:5', tab: '12:10', primary: '12:19', secondary: '12:21',
  pending: '12:23', approved: '12:25', returned: '12:27', notice: '12:36', metric: '12:40', input: '12:43'
};
const components = {};
for (const [key, id] of Object.entries(componentIds)) {
  const component = await figma.getNodeByIdAsync(id);
  if (!component || component.type !== 'COMPONENT') throw new Error('Missing production component ' + id);
  components[key] = component;
}
function inst(parent, key, x, y, overrides = {}) {
  const node = add(parent, components[key].createInstance()); node.x = x; node.y = y;
  for (const [layerName, value] of Object.entries(overrides)) {
    const target = node.findOne(child => child.type === 'TEXT' && child.name === layerName);
    if (target) target.characters = value;
  }
  return node;
}
function top(parent, title, back = true) { return inst(parent, back ? 'topBack' : 'topDefault', 0, 24, { Title: title }); }
function tab(parent) { return inst(parent, 'tab', 0, 768); }
function button(parent, labelText, y, secondary = false) { return inst(parent, secondary ? 'secondary' : 'primary', 20, y, { Label: labelText }); }
function statusPill(parent, x, y, textValue, color, fill) {
  rect(parent, 'StatusPill', x, y, 96, 30, fill, 15, color);
  txt(parent, 'StatusText', textValue, x, y + 6, 96, 10, fonts.med, color, 'CENTER', 16);
}
function miniMetric(parent, x, y, width, value, title, color = C.forest) {
  const box = card(parent, 'MetricCard', x, y, width, 92, C.pearl, 18);
  txt(box, 'MetricValue', value, 14, 14, width - 28, 24, fonts.num, color, 'LEFT', 30);
  txt(box, 'MetricLabel', title, 14, 54, width - 28, 11, fonts.med, C.muted, 'LEFT', 17);
  return box;
}

// 03 — Boyfriend home
caption('03 · home / 花园守护人总览', 100);
const home = screen('Screen/03-Home/Boyfriend/Default/390', 100);
top(home, '花园守护人', false);
const homeHero = card(home, 'BoyfriendHome/Hero', 20, 108, 350, 184, C.forest, 24, C.forest);
leaf(homeHero, 274, -3, 2.8, 28, C.gold, 0.22); leaf(homeHero, 298, 40, 2.2, -32, C.rose, 0.34);
label(homeHero, 'Guardian of the garden', 18, 18, 250, C.gold);
txt(homeHero, 'HeroTitle', '她负责好好照顾自己，\n你负责一直为她加油。', 18, 50, 278, 21, fonts.serifB, C.pearl, 'LEFT', 31);
txt(homeHero, 'HeroMeta', '本周 184 分钟 · 连续收藏 6 天', 18, 126, 260, 11, fonts.sans, C.parchment, 'LEFT', 18);
avatar(homeHero, 277, 104, false);
miniMetric(home, 20, 312, 168, '2', '待你温柔确认', C.burgundy);
miniMetric(home, 202, 312, 168, '¥ 86', '本月约定心愿金', C.antique);
const pending = card(home, 'BoyfriendHome/Pending', 20, 420, 350, 122, C.pearl, 20);
label(pending, 'Today', 16, 14, 100, C.rose);
txt(pending, 'Title', '她刚收藏了一段晚风散步', 16, 42, 240, 15, fonts.serifB, C.ink, 'LEFT', 23);
txt(pending, 'Copy', '看见她的认真，再留下一句具体的认可。', 16, 72, 280, 11, fonts.sans, C.muted, 'LEFT', 18);
statusPill(pending, 238, 16, '待确认', C.antique, C.parchment);
const homeEncourage = card(home, 'BoyfriendHome/Encouragement', 20, 558, 350, 84, C.parchment, 18, C.line);
txt(homeEncourage, 'Quote', '“今天也有好好把自己放在心上。”', 16, 14, 298, 13, fonts.serif, C.forest, 'LEFT', 21);
txt(homeEncourage, 'Link', '写一句新的鼓励  ›', 16, 52, 250, 11, fonts.med, C.burgundy, 'LEFT', 17);
const recap = card(home, 'BoyfriendHome/Recap', 20, 658, 350, 86, C.midnight, 18, C.gold);
label(recap, 'Weekly gazette', 16, 12, 180, C.gold);
txt(recap, 'Title', '这一周，她把生活过成了花园', 16, 38, 285, 13, fonts.serifB, C.pearl, 'LEFT', 20);
txt(recap, 'Arrow', '›', 304, 26, 30, 24, fonts.serifB, C.gold, 'RIGHT', 32);
tab(home);

// 12 — Sponsor companion workspace
caption('12 · sponsor-companion / 花园守护人工作台', 610);
const companion = screen('Screen/12-SponsorCompanion/Default/390', 610);
top(companion, '守护人工作台');
label(companion, 'Private companion desk', 20, 108, 280, C.burgundy);
txt(companion, 'Title', '把陪伴落在清楚的小事里', 20, 134, 350, 22, fonts.serifB, C.forest, 'LEFT', 32);
miniMetric(companion, 20, 184, 106, '2', '待确认', C.burgundy);
miniMetric(companion, 142, 184, 106, '1', '待兑现', C.antique);
miniMetric(companion, 264, 184, 106, '6', '连续日', C.success);
const editor = card(companion, 'Companion/EncouragementEditor', 20, 294, 350, 150, C.pearl, 20);
label(editor, 'A note for her', 16, 14, 190, C.rose);
txt(editor, 'Title', '今天想对她说', 16, 39, 180, 15, fonts.serifB, C.ink, 'LEFT', 23);
rect(editor, 'EditorField', 16, 72, 318, 58, C.cream, 14, C.line);
txt(editor, 'EditorValue', '你不是在完成任务，是在认真照顾自己。', 28, 87, 286, 11, fonts.sans, C.muted, 'LEFT', 18);
const assets = card(companion, 'Companion/Assets', 20, 462, 350, 96, C.parchment, 18);
txt(assets, 'Balance', '1,840', 16, 14, 130, 24, fonts.num, C.forest, 'LEFT', 30);
txt(assets, 'BalanceLabel', '她的能量币', 16, 52, 130, 10, fonts.med, C.muted, 'LEFT', 15);
divider(assets, 168, 16, 1, C.line).resize(1, 64);
txt(assets, 'Fund', '¥ 86', 194, 14, 130, 24, fonts.num, C.antique, 'LEFT', 30);
txt(assets, 'FundLabel', '约定心愿金', 194, 52, 130, 10, fonts.med, C.muted, 'LEFT', 15);
const links = card(companion, 'Companion/Links', 20, 576, 350, 138, C.pearl, 18);
[['成长收藏册', '只读查看她的历程'], ['庄园收藏柜', '查看共同徽章'], ['高级会所账簿', '核对固定规则账目']].forEach((item, index) => {
  const y = 12 + index * 40;
  txt(links, 'LinkTitle', item[0], 16, y, 150, 12, fonts.med, C.ink, 'LEFT', 18);
  txt(links, 'LinkMeta', item[1], 168, y, 138, 10, fonts.sans, C.muted, 'RIGHT', 16);
  txt(links, 'LinkArrow', '›', 312, y - 3, 22, 16, fonts.serif, C.antique, 'RIGHT', 24);
  if (index < 2) divider(links, 16, y + 30, 318);
});
button(companion, '处理 2 条待确认', 724);

// 13 — Read-only history
caption('13 · companion-history / 她的成长收藏册', 1120);
const history = screen('Screen/13-SponsorCompanionHistory/Default/390', 1120);
top(history, '她的成长收藏册');
label(history, 'Pressed botanical archive', 20, 108, 290, C.rose);
txt(history, 'Title', '看见她一路留下的认真', 20, 134, 330, 21, fonts.serifB, C.forest, 'LEFT', 31);
const readOnly = card(history, 'History/ReadOnlyNotice', 20, 180, 350, 58, C.parchment, 16);
txt(readOnly, 'Copy', '只读收藏 · 不提供代打卡或修改入口', 16, 18, 300, 11, fonts.med, C.antique, 'LEFT', 18);
function timelineItem(parent, y, date, title, copy, state, color) {
  ell(parent, 'TimelineDot', 28, y + 10, 18, 18, C.pearl, color);
  rect(parent, 'TimelineStem', 36, y + 31, 2, 100, C.line, 1);
  txt(parent, 'Date', date, 58, y, 120, 10, fonts.num, C.antique, 'LEFT', 16);
  txt(parent, 'TimelineTitle', title, 58, y + 24, 240, 15, fonts.serifB, C.ink, 'LEFT', 23);
  txt(parent, 'TimelineCopy', copy, 58, y + 53, 286, 11, fonts.sans, C.muted, 'LEFT', 18);
  statusPill(parent, 258, y + 2, state, color, C.pearl);
}
timelineItem(history, 266, 'JUL 10 · 20:40', '晚风散步 42 分钟', '她写下：树影像一封很慢的信。', '待确认', C.antique);
timelineItem(history, 402, 'JUL 09 · 19:20', '公园慢跑 28 分钟', '你回复：节奏很稳，也记得给自己留余地。', '已通过', C.success);
timelineItem(history, 538, 'JUL 08 · 18:05', '河边散步 36 分钟', '文字已同步；跨账号照片按权限规则展示。', '已通过', C.success);
const photoNotice = card(history, 'History/PhotoPermission', 20, 684, 350, 60, C.cream, 16, C.line);
txt(photoNotice, 'NoticeIcon', '♡', 16, 14, 28, 18, fonts.serifB, C.rose, 'CENTER', 26);
txt(photoNotice, 'NoticeCopy', '照片不可见时，以文字和双方线下确认验收。', 54, 14, 276, 10, fonts.sans, C.muted, 'LEFT', 17);
tab(history);

// 14 — Badge cabinet
caption('14 · companion-badges / 庄园收藏柜', 1630);
const badges = screen('Screen/14-SponsorCompanionBadges/Default/390', 1630);
top(badges, '庄园收藏柜');
const cabinet = card(badges, 'Badges/CabinetHero', 20, 108, 350, 152, C.midnight, 22, C.gold);
label(cabinet, 'Cabinet of keepsakes', 18, 16, 260, C.gold);
txt(cabinet, 'Title', '共同收藏 8 / 18', 18, 48, 220, 24, fonts.serifB, C.pearl, 'LEFT', 34);
txt(cabinet, 'Copy', '徽章记录共同经历，不做公开排名。', 18, 92, 255, 11, fonts.sans, C.parchment, 'LEFT', 18);
crest(cabinet, 256, 38);
function badgeCard(parent, x, y, symbol, title, meta, unlocked, accent) {
  const box = card(parent, 'Badge/Card', x, y, 168, 156, unlocked ? C.pearl : C.parchment, 20, unlocked ? C.line : C.parchment);
  ell(box, 'Medallion', 45, 16, 78, 78, unlocked ? C.pearl : C.cream, accent, unlocked ? 1 : 0.6);
  txt(box, 'Symbol', symbol, 45, 34, 78, 24, fonts.serifB, unlocked ? accent : C.muted, 'CENTER', 34);
  txt(box, 'BadgeTitle', title, 12, 105, 144, 13, fonts.serifB, unlocked ? C.ink : C.muted, 'CENTER', 20);
  txt(box, 'BadgeMeta', meta, 12, 130, 144, 9, fonts.sans, C.muted, 'CENTER', 14);
}
badgeCard(badges, 20, 282, '✦', '晨光初绽', '连续收藏 3 天', true, C.gold);
badgeCard(badges, 202, 282, '◇', '晚风来信', '共同确认 10 次', true, C.rose);
badgeCard(badges, 20, 454, '♧', '花园漫游家', '地图抵达第 7 站', true, C.forest);
badgeCard(badges, 202, 454, '⌁', '月下礼盒', '尚待共同完成', false, C.antique);
const badgeFooter = card(badges, 'Badges/Rule', 20, 642, 350, 84, C.cream, 18, C.line);
txt(badgeFooter, 'Title', '收藏规则保持固定、透明', 16, 14, 280, 12, fonts.med, C.forest, 'LEFT', 18);
txt(badgeFooter, 'Copy', '不抽卡、不随机掉落，也不设置公开排行榜。', 16, 42, 306, 10, fonts.sans, C.muted, 'LEFT', 17);
tab(badges);

// 15 — Club ledger
caption('15 · companion-ledgers / 高级会所账簿', 2140);
const ledgers = screen('Screen/15-SponsorCompanionLedgers/Default/390', 2140);
top(ledgers, '高级会所账簿');
label(ledgers, 'Private club ledger', 20, 108, 260, C.antique);
txt(ledgers, 'Title', '每一笔变化，都可以被解释', 20, 134, 350, 21, fonts.serifB, C.forest, 'LEFT', 31);
const summary = card(ledgers, 'Ledger/Summary', 20, 180, 350, 118, C.parchment, 20);
txt(summary, 'Energy', '1,840', 16, 16, 140, 27, fonts.num, C.forest, 'LEFT', 34);
txt(summary, 'EnergyLabel', '当前能量币', 16, 56, 140, 10, fonts.med, C.muted, 'LEFT', 16);
txt(summary, 'Fund', '¥ 86', 194, 16, 140, 27, fonts.num, C.antique, 'LEFT', 34);
txt(summary, 'FundLabel', '约定心愿金', 194, 56, 140, 10, fonts.med, C.muted, 'LEFT', 16);
txt(summary, 'Rule', '固定规则 · 手动兑现 · 无真实支付接口', 16, 90, 318, 10, fonts.sans, C.burgundy, 'LEFT', 16);
function ledgerRow(parent, y, title, meta, value, color, mark) {
  const box = card(parent, 'Ledger/Row', 20, y, 350, 82, C.pearl, 16);
  rect(box, 'Mark', 14, 16, 34, 34, C.cream, 17, color);
  txt(box, 'MarkText', mark, 14, 21, 34, 14, fonts.serifB, color, 'CENTER', 22);
  txt(box, 'RowTitle', title, 62, 14, 180, 12, fonts.med, C.ink, 'LEFT', 18);
  txt(box, 'RowMeta', meta, 62, 42, 190, 10, fonts.sans, C.muted, 'LEFT', 16);
  txt(box, 'RowValue', value, 250, 24, 84, 14, fonts.num, color, 'RIGHT', 21);
}
ledgerRow(ledgers, 320, '晚风散步通过', '7月10日 · 固定规则', '+42', C.success, '+');
ledgerRow(ledgers, 416, '周末花束兑换', '7月10日 · 等待线下兑现', '−680', C.burgundy, '◇');
ledgerRow(ledgers, 512, '本月心愿金记账', '7月01日 · 双方约定', '+¥86', C.antique, '¥');
const ledgerNotice = card(ledgers, 'Ledger/Notice', 20, 624, 350, 102, C.midnight, 18, C.gold);
label(ledgerNotice, 'No payment rail', 16, 12, 220, C.gold);
txt(ledgerNotice, 'Copy', '这里只记录双方约定；兑现在线下完成，不接入红包、转账或平台支付。', 16, 40, 308, 11, fonts.sans, C.parchment, 'LEFT', 18);
tab(ledgers);

// 16 — Companion redemptions
caption('16 · companion-redemptions / 礼物兑现总览', 2650);
const redemptions = screen('Screen/16-SponsorCompanionRedemptions/Default/390', 2650);
top(redemptions, '礼物兑现总览');
label(redemptions, 'Promises in progress', 20, 108, 250, C.rose);
txt(redemptions, 'Title', '把答应她的礼物，好好完成', 20, 134, 350, 21, fonts.serifB, C.forest, 'LEFT', 31);
const redSummary = card(redemptions, 'Redemptions/Summary', 20, 180, 350, 72, C.parchment, 18);
txt(redSummary, 'Pending', '1 待确认', 16, 15, 120, 16, fonts.num, C.burgundy, 'LEFT', 22);
txt(redSummary, 'Done', '7 已兑现', 136, 15, 104, 16, fonts.num, C.success, 'CENTER', 22);
txt(redSummary, 'Refund', '1 已退还', 244, 15, 90, 16, fonts.num, C.antique, 'RIGHT', 22);
txt(redSummary, 'Meta', '所有状态变化都会同步余额影响。', 16, 44, 318, 10, fonts.sans, C.muted, 'LEFT', 16);
function redemptionCard(parent, y, title, meta, status, color, next, action) {
  const box = card(parent, 'Redemption/Card', 20, y, 350, 170, C.pearl, 20);
  txt(box, 'Title', title, 16, 16, 210, 16, fonts.serifB, C.ink, 'LEFT', 24);
  statusPill(box, 238, 14, status, color, C.pearl);
  txt(box, 'Meta', meta, 16, 50, 310, 10, fonts.sans, C.muted, 'LEFT', 16);
  divider(box, 16, 78, 318);
  txt(box, 'NextLabel', '下一步', 16, 96, 80, 10, fonts.med, C.rose, 'LEFT', 15);
  txt(box, 'Next', next, 16, 120, 232, 11, fonts.sans, C.ink, 'LEFT', 18);
  txt(box, 'Action', action + '  ›', 244, 118, 90, 11, fonts.med, color, 'RIGHT', 18);
}
redemptionCard(redemptions, 274, '周末花束', '−680 能量币 · 7月10日', '待确认', C.antique, '和她确认周末收花时间', '去处理');
redemptionCard(redemptions, 462, '夜游门票', '−920 能量币 · 7月03日', '已兑现', C.success, '已由双方线下确认完成', '看纪念');
const redNotice = card(redemptions, 'Redemptions/Safety', 20, 650, 350, 78, C.cream, 18, C.line);
txt(redNotice, 'Title', '取消与退还需要二次确认', 16, 13, 280, 12, fonts.med, C.burgundy, 'LEFT', 18);
txt(redNotice, 'Copy', '先说明影响，再退还能量币，不使用模糊按钮。', 16, 41, 306, 10, fonts.sans, C.muted, 'LEFT', 16);
tab(redemptions);

// Flow documentation
const doc = add(section, figma.createFrame());
doc.name = 'Documentation/BoyfriendFlow'; doc.x = 100; doc.y = 1120; doc.resize(3090, 620);
doc.fills = [solid(C.midnight)]; doc.cornerRadius = 28; doc.clipsContent = true;
label(doc, 'Companion journey', 34, 34, 500, C.gold);
txt(doc, 'DocTitle', '守护不是监督，而是看见、回应与兑现', 34, 72, 2200, 28, fonts.serifB, C.pearl, 'LEFT', 42);
txt(doc, 'DocCopy', '男友侧始终不出现代打卡入口；核心动作只有温柔确认、具体鼓励、规则维护与线下兑现。所有长列表采用静态卡片、细分割线和按需加载语义。', 34, 126, 2860, 14, fonts.sans, C.parchment, 'LEFT', 25);
const principles = [
  ['角色边界', '只读成长记录\n不修改她的收藏'],
  ['语言', '具体认可\n不使用监督口吻'],
  ['资产', '固定规则账簿\n无真实支付'],
  ['兑现', '影响说明清楚\n线下双方确认'],
  ['性能', '无实时模糊\n长列表按需渲染'],
  ['隐私', '照片受限时\n提供文字替代验收']
];
principles.forEach((item, index) => {
  const x = 34 + index * 500;
  rect(doc, 'PrincipleCard', x, 230, 460, 210, C.midnight, 22, C.gold);
  txt(doc, 'PrincipleNo', String(index + 1).padStart(2, '0'), x + 22, 252, 70, 18, fonts.num, C.gold, 'LEFT', 24);
  txt(doc, 'PrincipleTitle', item[0], x + 22, 294, 180, 20, fonts.serifB, C.pearl, 'LEFT', 30);
  txt(doc, 'PrincipleCopy', item[1], x + 22, 340, 390, 12, fonts.sans, C.parchment, 'LEFT', 20);
});
txt(doc, 'Perf', 'ROLE SAFE · SUPPORTIVE COPY · FIXED RULES · MANUAL FULFILMENT · REDUCED MOTION READY', 34, 510, 2860, 12, fonts.med, C.gold, 'LEFT', 18);

return { createdNodeIds: ids, mutatedNodeIds: Object.values(screens), screens, documentationNodeIds: [doc.id] };
