const page = await figma.getNodeByIdAsync('4:2');
if (!page || page.type !== 'PAGE') throw new Error('Product page missing');
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('5:8');
if (!section || section.type !== 'SECTION') throw new Error('Sponsor operations section missing');

const expectedNames = [
  'Screen/17-SponsorReview/Default/390',
  'Screen/18-SponsorPayouts/Default/390',
  'Screen/19-SponsorRules/Default/390',
  'Screen/20-AdminRewards/Default/390'
];
const existingRoots = section.children.filter(n => n.type === 'FRAME' && expectedNames.includes(n.name));
if (existingRoots.length) {
  if (existingRoots.length !== expectedNames.length) throw new Error('Sponsor operations phase has an incomplete prior root set; inspect before retrying');
  const existingScreens = Object.fromEntries(existingRoots.map(n => [n.name, n.id]));
  const existingDoc = section.children.find(n => n.type === 'FRAME' && n.name === 'Documentation/SponsorOperations');
  return { createdNodeIds: [], mutatedNodeIds: [], screens: existingScreens, documentationNodeIds: existingDoc ? [existingDoc.id] : [], reused: true };
}

const fonts = {
  sans: { family: 'Noto Sans SC', style: 'Regular' }, med: { family: 'Noto Sans SC', style: 'Medium' },
  bold: { family: 'Noto Sans SC', style: 'Bold' }, serif: { family: 'Noto Serif SC', style: 'Medium' },
  serifB: { family: 'Noto Serif SC', style: 'SemiBold' }, latin: { family: 'Cormorant Garamond', style: 'SemiBold' },
  num: { family: 'Inter', style: 'Semi Bold' }
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
const ids = [];
const screens = {};
function add(parent, node) { parent.appendChild(node); ids.push(node.id); return node; }
function txt(parent, name, characters, x, y, width, size, font = fonts.sans, color = C.ink, align = 'LEFT', lineHeight = null) {
  const node = add(parent, figma.createText()); node.name = name; node.fontName = font; node.characters = characters; node.fontSize = size;
  node.fills = [solid(color)]; node.textAlignHorizontal = align; node.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.5) };
  node.resize(width, size * 6); node.textAutoResize = 'HEIGHT'; node.x = x; node.y = y; return node;
}
function rect(parent, name, x, y, width, height, color, radius = 0, stroke = null, opacity = 1) {
  const node = add(parent, figma.createRectangle()); node.name = name; node.x = x; node.y = y; node.resize(width, height);
  node.fills = [solid(color, opacity)]; node.cornerRadius = radius; if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function ell(parent, name, x, y, width, height, color, stroke = null, opacity = 1) {
  const node = add(parent, figma.createEllipse()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color, opacity)];
  if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function divider(parent, x, y, width, color = C.line) { return rect(parent, 'Divider', x, y, width, 1, color); }
function label(parent, characters, x, y, width, color = C.antique, align = 'LEFT') {
  const node = txt(parent, 'Eyebrow', characters.toUpperCase(), x, y, width, 10, fonts.med, color, align, 15);
  node.letterSpacing = { unit: 'PERCENT', value: 10 }; return node;
}
function caption(characters, x) { txt(section, 'ScreenLabel', characters, x, 108, 390, 14, fonts.med, C.burgundy, 'CENTER', 20); }
function screen(name, x) {
  const node = add(section, figma.createFrame()); node.name = name; node.x = x; node.y = 150; node.resize(390, 844);
  node.fills = [solid(C.cream)]; node.cornerRadius = 32; node.clipsContent = true; node.effects = [screenShadow]; screens[name] = node.id;
  txt(node, 'StatusTime', '9:41', 20, 9, 80, 11, fonts.num, C.ink, 'LEFT', 16);
  txt(node, 'StatusIcons', '●  ◒  ▰', 286, 9, 84, 10, fonts.sans, C.ink, 'RIGHT', 16); return node;
}
function card(parent, name, x, y, width, height, color = C.pearl, radius = 20, stroke = C.line) {
  const node = add(parent, figma.createFrame()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color)];
  node.cornerRadius = radius; node.clipsContent = true; if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function status(parent, x, y, textValue, color, fill = C.pearl, width = 96) {
  rect(parent, 'StatusPill', x, y, width, 30, fill, 15, color);
  txt(parent, 'StatusText', textValue, x, y + 6, width, 10, fonts.med, color, 'CENTER', 16);
}
function leaf(parent, x, y, scale, rotation, color = C.sage, opacity = 0.5) {
  const node = ell(parent, 'Leaf', x, y, 30 * scale, 13 * scale, color, null, opacity); node.rotation = rotation; return node;
}
function switchControl(parent, x, y, on) {
  rect(parent, 'SwitchTrack', x, y, 48, 28, on ? C.forest : C.line, 14);
  ell(parent, 'SwitchThumb', x + (on ? 23 : 3), y + 3, 22, 22, C.pearl);
}

const componentIds = { topBack: '12:5', primary: '12:19', secondary: '12:21', notice: '12:36', input: '12:43' };
const components = {};
for (const [key, id] of Object.entries(componentIds)) {
  const component = await figma.getNodeByIdAsync(id);
  if (!component || component.type !== 'COMPONENT') throw new Error('Missing production component ' + id);
  components[key] = component;
}
function inst(parent, key, x, y, overrides = {}) {
  const node = add(parent, components[key].createInstance()); node.x = x; node.y = y;
  for (const [layerName, value] of Object.entries(overrides)) {
    const target = node.findOne(child => child.type === 'TEXT' && child.name === layerName); if (target) target.characters = value;
  }
  return node;
}
function top(parent, title) { return inst(parent, 'topBack', 0, 24, { Title: title }); }
function button(parent, labelText, y, secondary = false) { return inst(parent, secondary ? 'secondary' : 'primary', 20, y, { Label: labelText }); }

// 17 — Review desk
caption('17 · sponsor-review / 私人花园审阅桌', 100);
const review = screen('Screen/17-SponsorReview/Default/390', 100);
top(review, '私人花园审阅桌');
const reviewHero = card(review, 'Review/Hero', 20, 108, 350, 104, C.forest, 20, C.forest);
label(reviewHero, 'Review with tenderness', 16, 14, 240, C.gold);
txt(reviewHero, 'Title', '先看见认真，再确认结果', 16, 42, 270, 19, fonts.serifB, C.pearl, 'LEFT', 28);
txt(reviewHero, 'Meta', '2 条待确认 · 最早 20:40', 16, 74, 250, 10, fonts.sans, C.parchment, 'LEFT', 16);
status(reviewHero, 250, 14, '2 条待办', C.gold, C.forest, 84);
const checkin = card(review, 'Review/CheckinCard', 20, 230, 350, 260, C.pearl, 20);
txt(checkin, 'Person', '她的晚风散步', 16, 16, 200, 17, fonts.serifB, C.ink, 'LEFT', 25);
status(checkin, 238, 14, '待确认', C.antique, C.parchment);
txt(checkin, 'Meta', '42 分钟 · 7月10日 20:40', 16, 50, 270, 10, fonts.num, C.muted, 'LEFT', 16);
const quote = card(checkin, 'Review/Quote', 16, 82, 318, 64, C.cream, 14, C.line);
txt(quote, 'Quote', '“树影像一封很慢的信，走完以后心也安静了。”', 14, 12, 290, 11, fonts.serif, C.forest, 'LEFT', 18);
rect(checkin, 'PhotoPlaceholder', 16, 160, 88, 72, C.parchment, 14, C.line);
txt(checkin, 'PhotoIcon', '♡', 16, 178, 88, 18, fonts.serifB, C.rose, 'CENTER', 26);
txt(checkin, 'PhotoNote', '跨账号照片受限时\n以文字与线下确认验收', 120, 166, 198, 10, fonts.sans, C.muted, 'LEFT', 17);
const compliment = card(review, 'Review/ComplimentField', 20, 510, 350, 92, C.pearl, 18);
label(compliment, 'A specific compliment', 16, 12, 220, C.rose);
txt(compliment, 'Value', '节奏很稳，也记得给自己留余地。', 16, 42, 300, 12, fonts.sans, C.ink, 'LEFT', 19);
const returnBox = card(review, 'Review/ReturnReason', 20, 618, 350, 78, C.cream, 18, C.line);
txt(returnBox, 'Title', '需要她补充时', 16, 11, 150, 11, fonts.med, C.burgundy, 'LEFT', 17);
txt(returnBox, 'Copy', '说明可修改的事实，不评价她是否“够努力”。', 16, 38, 308, 10, fonts.sans, C.muted, 'LEFT', 16);
button(review, '确认并送出鼓励', 720);

// 18 — Wish-fund fulfillment ledger
caption('18 · sponsor-payouts / 香槟金兑现账簿', 610);
const payouts = screen('Screen/18-SponsorPayouts/Default/390', 610);
top(payouts, '香槟金兑现账簿');
label(payouts, 'Manual wish-fund fulfilment', 20, 108, 300, C.antique);
txt(payouts, 'Title', '记录约定，不模拟支付', 20, 134, 350, 21, fonts.serifB, C.forest, 'LEFT', 31);
const payoutSummary = card(payouts, 'Payouts/Summary', 20, 180, 350, 108, C.parchment, 20);
txt(payoutSummary, 'PendingValue', '¥ 36', 16, 14, 126, 27, fonts.num, C.burgundy, 'LEFT', 34);
txt(payoutSummary, 'PendingLabel', '本周待线下兑现', 16, 56, 150, 10, fonts.med, C.muted, 'LEFT', 16);
txt(payoutSummary, 'MonthValue', '¥ 86', 198, 14, 136, 27, fonts.num, C.antique, 'RIGHT', 34);
txt(payoutSummary, 'MonthLabel', '本月约定累计', 184, 56, 150, 10, fonts.med, C.muted, 'RIGHT', 16);
txt(payoutSummary, 'Disclaimer', '无红包、转账或平台支付能力', 16, 84, 318, 10, fonts.sans, C.burgundy, 'LEFT', 16);
function payoutGroup(parent, y, week, amount, rows, state) {
  const box = card(parent, 'Payouts/Group', 20, y, 350, rows.length === 2 ? 176 : 144, C.pearl, 20);
  label(box, week, 16, 14, 180, C.rose);
  txt(box, 'Amount', amount, 238, 12, 96, 18, fonts.num, C.antique, 'RIGHT', 25);
  rows.forEach((row, index) => {
    const rowY = 46 + index * 44;
    txt(box, 'RowTitle', row[0], 16, rowY, 190, 11, fonts.med, C.ink, 'LEFT', 17);
    txt(box, 'RowAmount', row[1], 238, rowY, 96, 11, fonts.num, C.burgundy, 'RIGHT', 17);
    if (index < rows.length - 1) divider(box, 16, rowY + 31, 318);
  });
  status(box, 16, box.height - 42, state, state === '待兑现' ? C.antique : C.success, C.pearl, 92);
  txt(box, 'Action', state === '待兑现' ? '记录线下完成  ›' : '查看确认记录  ›', 154, box.height - 35, 180, 10, fonts.med, state === '待兑现' ? C.burgundy : C.success, 'RIGHT', 16);
}
payoutGroup(payouts, 310, 'JUL 08 — JUL 14', '¥ 36', [['晚风散步', '¥ 18'], ['公园慢跑', '¥ 18']], '待兑现');
payoutGroup(payouts, 504, 'JUL 01 — JUL 07', '¥ 50', [['本周固定心愿金', '¥ 50']], '已记录');
const payoutNotice = card(payouts, 'Payouts/Notice', 20, 666, 350, 62, C.midnight, 16, C.gold);
txt(payoutNotice, 'Copy', '点击“完成”只更新双方账簿状态，不触发资金流。', 16, 15, 318, 10, fonts.sans, C.parchment, 'LEFT', 17);
button(payouts, '记录本周线下兑现', 736);

// 19 — Couple contract
caption('19 · sponsor-rules / 双人花园契约', 1120);
const rules = screen('Screen/19-SponsorRules/Default/390', 1120);
top(rules, '双人花园契约');
const ruleHero = card(rules, 'Rules/Hero', 20, 108, 350, 124, C.midnight, 20, C.gold);
label(ruleHero, 'Private garden accord', 16, 14, 240, C.gold);
txt(ruleHero, 'Title', '规则清楚，陪伴才会轻松', 16, 44, 280, 20, fonts.serifB, C.pearl, 'LEFT', 29);
txt(ruleHero, 'Meta', '最近更新 · 2026年7月10日', 16, 84, 250, 10, fonts.sans, C.parchment, 'LEFT', 16);
txt(ruleHero, 'Seal', 'JV', 282, 42, 44, 22, fonts.latin, C.gold, 'CENTER', 30);
function ruleRow(parent, y, no, title, value, detail, enabled = true) {
  const box = card(parent, 'Rules/Row', 20, y, 350, 92, C.pearl, 18);
  txt(box, 'No', no, 16, 16, 34, 13, fonts.num, C.antique, 'LEFT', 19);
  txt(box, 'RuleTitle', title, 58, 13, 170, 13, fonts.med, C.ink, 'LEFT', 20);
  txt(box, 'RuleValue', value, 238, 13, 72, 13, fonts.num, C.burgundy, 'RIGHT', 20);
  txt(box, 'RuleDetail', detail, 58, 45, 236, 10, fonts.sans, C.muted, 'LEFT', 16);
  switchControl(box, 306, 12, enabled);
}
ruleRow(rules, 252, '01', '基础收藏奖励', '1 / 分钟', '按实际分钟固定计算，不随机。', true);
ruleRow(rules, 358, '02', '每日奖励上限', '60 能量', '超过上限仍记录成长，不额外累计。', true);
ruleRow(rules, 464, '03', '每月心愿金', '¥ 50', '只记录双方约定，线下手动兑现。', true);
ruleRow(rules, 570, '04', '连续收藏礼遇', '+120', '连续 7 天时一次性加入账簿。', true);
const mapRule = card(rules, 'Rules/MapReward', 20, 676, 350, 64, C.parchment, 16);
txt(mapRule, 'Title', '地图节点奖励另行列明', 16, 12, 240, 11, fonts.med, C.forest, 'LEFT', 17);
txt(mapRule, 'Copy', '每个节点固定可见，不使用盲盒或概率。', 16, 36, 280, 10, fonts.sans, C.muted, 'LEFT', 16);
button(rules, '保存契约修改', 752);

// 20 — Reward atelier management
caption('20 · admin-rewards / 礼物工坊目录', 1630);
const admin = screen('Screen/20-AdminRewards/Default/390', 1630);
top(admin, '礼物工坊目录');
label(admin, 'Maison des cadeaux', 20, 108, 240, C.rose);
txt(admin, 'Title', '管理礼物，不制造促销焦虑', 20, 134, 350, 21, fonts.serifB, C.forest, 'LEFT', 31);
const catalogSummary = card(admin, 'Admin/Summary', 20, 180, 350, 72, C.parchment, 18);
txt(catalogSummary, 'Published', '6 已发布', 16, 14, 120, 16, fonts.num, C.success, 'LEFT', 22);
txt(catalogSummary, 'Draft', '2 草稿', 132, 14, 96, 16, fonts.num, C.antique, 'CENTER', 22);
txt(catalogSummary, 'Hidden', '1 已下架', 238, 14, 96, 16, fonts.num, C.muted, 'RIGHT', 22);
txt(catalogSummary, 'Hint', '发布开关与编辑保存分离，避免误操作。', 16, 44, 318, 10, fonts.sans, C.muted, 'LEFT', 16);
function rewardAdminCard(parent, y, title, price, stock, published, accent) {
  const box = card(parent, 'Admin/RewardCard', 20, y, 350, 128, C.pearl, 20);
  rect(box, 'Artwork', 14, 14, 82, 82, C.parchment, 16, C.line);
  ell(box, 'ArtworkMedallion', 33, 31, 44, 44, C.pearl, accent);
  txt(box, 'ArtworkSymbol', '◇', 33, 38, 44, 16, fonts.serifB, accent, 'CENTER', 24);
  txt(box, 'RewardTitle', title, 112, 15, 150, 14, fonts.serifB, C.ink, 'LEFT', 21);
  txt(box, 'RewardMeta', price + ' 能量 · 库存 ' + stock, 112, 45, 180, 10, fonts.num, C.muted, 'LEFT', 16);
  status(box, 112, 76, published ? '已发布' : '草稿', published ? C.success : C.antique, C.pearl, 84);
  switchControl(box, 286, 16, published);
  txt(box, 'Order', '排序  ' + (published ? '01' : '03'), 250, 82, 80, 10, fonts.num, C.muted, 'RIGHT', 16);
}
rewardAdminCard(admin, 274, '周末花束', '680', '1', true, C.rose);
rewardAdminCard(admin, 418, '夜游门票', '920', '2', true, C.antique);
rewardAdminCard(admin, 562, '手写情书', '320', '不限', false, C.burgundy);
const destructive = card(admin, 'Admin/DestructiveHint', 20, 708, 350, 60, C.cream, 16, C.line);
txt(destructive, 'Copy', '删除已弱化为二级入口，并在弹窗中说明历史记录不受影响。', 16, 12, 310, 10, fonts.sans, C.muted, 'LEFT', 17);
button(admin, '新建一份礼物', 776);

// Operations documentation
const doc = add(section, figma.createFrame());
doc.name = 'Documentation/SponsorOperations'; doc.x = 100; doc.y = 1120; doc.resize(2070, 620);
doc.fills = [solid(C.midnight)]; doc.cornerRadius = 28; doc.clipsContent = true;
label(doc, 'Operational safeguards', 34, 34, 500, C.gold);
txt(doc, 'DocTitle', '运营能力保持克制、透明、可恢复', 34, 72, 1600, 28, fonts.serifB, C.pearl, 'LEFT', 42);
txt(doc, 'DocCopy', '审核、心愿金、规则与礼物管理全部强调事实、影响与恢复路径；不使用平台支付图像，不制造“立即付款”错觉。', 34, 126, 1900, 14, fonts.sans, C.parchment, 'LEFT', 25);
const notes = [
  ['审核', '先认可再处理\n退回只写可修改事实'],
  ['心愿金', '仅记录线下兑现\n不触发资金流'],
  ['规则', '固定透明\n每日上限可解释'],
  ['礼物', '发布与保存分离\n删除需二次确认']
];
notes.forEach((item, index) => {
  const x = 34 + index * 500;
  rect(doc, 'NoteCard', x, 230, 460, 210, C.midnight, 22, C.gold);
  txt(doc, 'NoteNo', String(index + 1).padStart(2, '0'), x + 22, 252, 70, 18, fonts.num, C.gold, 'LEFT', 24);
  txt(doc, 'NoteTitle', item[0], x + 22, 294, 180, 20, fonts.serifB, C.pearl, 'LEFT', 30);
  txt(doc, 'NoteCopy', item[1], x + 22, 340, 390, 12, fonts.sans, C.parchment, 'LEFT', 20);
});
txt(doc, 'Perf', 'NO REAL PAYMENT · NO URGENCY DARK PATTERN · CLEAR IMPACT · REVERSIBLE ACTIONS · 44PX TARGETS', 34, 510, 1900, 12, fonts.med, C.gold, 'LEFT', 18);

return { createdNodeIds: ids, mutatedNodeIds: Object.values(screens), screens, documentationNodeIds: [doc.id] };
