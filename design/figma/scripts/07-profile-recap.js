const page = await figma.getNodeByIdAsync('4:2');
if (!page || page.type !== 'PAGE') throw new Error('Product page missing');
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('5:9');
if (!section || section.type !== 'SECTION') throw new Error('Profile and recap section missing');

const expectedNames = [
  'Screen/21-Profile/Default/390',
  'Screen/22-ProfileEdit/Default/390',
  'Screen/07-WeeklyRecap/Default/390'
];
const existingRoots = section.children.filter(n => n.type === 'FRAME' && expectedNames.includes(n.name));
if (existingRoots.length) {
  if (existingRoots.length !== expectedNames.length) throw new Error('Profile phase has an incomplete prior root set; inspect before retrying');
  const existingScreens = Object.fromEntries(existingRoots.map(n => [n.name, n.id]));
  const existingDoc = section.children.find(n => n.type === 'FRAME' && n.name === 'Documentation/ProfileRecap');
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
  ink: '#302D2A', muted: '#6D6862', line: '#DED3C4', success: '#55745E', warning: '#B77B4D', error: '#9A4B5B',
  brown: '#8A6654', bunny: '#F3E8D8'
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
  node.resize(width, size * 7); node.textAutoResize = 'HEIGHT'; node.x = x; node.y = y; return node;
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
function caption(characters, x) { txt(section, 'ScreenLabel', characters, x, 108, 390, 14, fonts.med, C.burgundy, 'CENTER', 20); }
function screen(name, x, fill = C.cream) {
  const node = add(section, figma.createFrame()); node.name = name; node.x = x; node.y = 150; node.resize(390, 844); node.fills = [solid(fill)];
  node.cornerRadius = 32; node.clipsContent = true; node.effects = [screenShadow]; screens[name] = node.id;
  txt(node, 'StatusTime', '9:41', 20, 9, 80, 11, fonts.num, fill === C.midnight ? C.pearl : C.ink, 'LEFT', 16);
  txt(node, 'StatusIcons', '●  ◒  ▰', 286, 9, 84, 10, fonts.sans, fill === C.midnight ? C.pearl : C.ink, 'RIGHT', 16); return node;
}
function card(parent, name, x, y, width, height, color = C.pearl, radius = 20, stroke = C.line) {
  const node = add(parent, figma.createFrame()); node.name = name; node.x = x; node.y = y; node.resize(width, height); node.fills = [solid(color)];
  node.cornerRadius = radius; node.clipsContent = true; if (stroke) { node.strokes = [solid(stroke)]; node.strokeWeight = 1; } return node;
}
function leaf(parent, x, y, scale, rotation, color = C.sage, opacity = 0.5) {
  const node = ell(parent, 'Leaf', x, y, 30 * scale, 13 * scale, color, null, opacity); node.rotation = rotation; return node;
}
function avatar(parent, x, y, bunny) {
  ell(parent, 'AvatarHalo', x, y, 66, 66, C.parchment, C.gold);
  if (bunny) {
    ell(parent, 'EarLeft', x + 16, y + 4, 10, 27, C.bunny, C.gold); ell(parent, 'EarRight', x + 40, y + 3, 10, 28, C.bunny, C.gold);
    ell(parent, 'Head', x + 12, y + 18, 42, 40, C.bunny, C.gold);
  } else {
    ell(parent, 'EarLeft', x + 8, y + 9, 18, 18, C.brown, C.antique); ell(parent, 'EarRight', x + 40, y + 9, 18, 18, C.brown, C.antique);
    ell(parent, 'Head', x + 12, y + 16, 42, 42, C.brown, C.antique);
  }
}
function status(parent, x, y, textValue, color, fill = C.pearl, width = 90) {
  rect(parent, 'StatusPill', x, y, width, 30, fill, 15, color); txt(parent, 'StatusText', textValue, x, y + 6, width, 10, fonts.med, color, 'CENTER', 16);
}
function switchControl(parent, x, y, on) {
  rect(parent, 'SwitchTrack', x, y, 48, 28, on ? C.forest : C.line, 14); ell(parent, 'SwitchThumb', x + (on ? 23 : 3), y + 3, 22, 22, C.pearl);
}

const componentIds = { topBack: '12:5', tab: '12:10', primary: '12:19', secondary: '12:21', input: '12:43' };
const components = {};
for (const [key, id] of Object.entries(componentIds)) {
  const component = await figma.getNodeByIdAsync(id); if (!component || component.type !== 'COMPONENT') throw new Error('Missing production component ' + id); components[key] = component;
}
function inst(parent, key, x, y, overrides = {}) {
  const node = add(parent, components[key].createInstance()); node.x = x; node.y = y;
  for (const [layerName, value] of Object.entries(overrides)) {
    const target = node.findOne(child => child.type === 'TEXT' && child.name === layerName); if (target) target.characters = value;
  }
  return node;
}
function top(parent, title) { return inst(parent, 'topBack', 0, 24, { Title: title }); }
function tab(parent) { return inst(parent, 'tab', 0, 768); }
function button(parent, labelText, y, secondary = false) { return inst(parent, secondary ? 'secondary' : 'primary', 20, y, { Label: labelText }); }

// 21 — Couple profile
caption('21 · profile / 情侣庄园纹章', 100);
const profile = screen('Screen/21-Profile/Default/390', 100);
top(profile, '我们的庄园');
const crest = card(profile, 'Profile/Crest', 20, 108, 350, 188, C.midnight, 24, C.gold);
leaf(crest, 18, 116, 2.4, -28, C.gold, 0.25); leaf(crest, 292, 18, 2.4, 28, C.rose, 0.3);
ell(crest, 'CrestRing', 132, 20, 86, 86, C.midnight, C.gold);
avatar(crest, 102, 38, false); avatar(crest, 176, 38, true);
txt(crest, 'CrestHeart', '♥', 161, 76, 28, 13, fonts.serifB, C.rose, 'CENTER', 18);
label(crest, 'Jardin privé', 86, 116, 178, C.gold, 'CENTER');
txt(crest, 'CoupleName', '小熊与小兔的心愿花园', 34, 142, 282, 17, fonts.serifB, C.pearl, 'CENTER', 25);
const identities = card(profile, 'Profile/Identities', 20, 314, 350, 106, C.pearl, 20);
avatar(identities, 16, 18, true); avatar(identities, 202, 18, false);
txt(identities, 'HerName', '小兔 · 女友', 88, 20, 100, 12, fonts.med, C.ink, 'LEFT', 18);
txt(identities, 'HerRole', '记录自己的成长', 88, 48, 104, 10, fonts.sans, C.muted, 'LEFT', 16);
txt(identities, 'HisName', '小熊 · 男友', 274, 20, 64, 12, fonts.med, C.ink, 'RIGHT', 18);
txt(identities, 'HisRole', '陪伴与兑现约定', 226, 48, 112, 10, fonts.sans, C.muted, 'RIGHT', 16);
const relation = card(profile, 'Profile/Relation', 20, 438, 350, 78, C.parchment, 18);
label(relation, 'Private relationship', 16, 12, 200, C.rose);
txt(relation, 'State', '双账号已绑定 · 仅双方可见', 16, 40, 250, 12, fonts.med, C.forest, 'LEFT', 18);
status(relation, 258, 24, '已连接', C.success, C.pearl, 76);
const menu = card(profile, 'Profile/Menu', 20, 534, 350, 194, C.pearl, 18);
const menuItems = [
  ['本周花园周刊', '共同回顾'], ['声音与轻触', '已开启'], ['编辑私人名片', '昵称与头像'], ['角色权限说明', '女友记录 · 男友陪伴']
];
menuItems.forEach((item, index) => {
  const y = 14 + index * 44;
  txt(menu, 'MenuTitle', item[0], 16, y, 150, 12, fonts.med, C.ink, 'LEFT', 18);
  txt(menu, 'MenuMeta', item[1], 168, y, 138, 10, fonts.sans, C.muted, 'RIGHT', 16);
  txt(menu, 'MenuArrow', '›', 312, y - 4, 22, 16, fonts.serif, C.antique, 'RIGHT', 24);
  if (index < menuItems.length - 1) divider(menu, 16, y + 31, 318);
});
tab(profile);

// 22 — Profile edit
caption('22 · profile-edit / 私人名片定制', 610);
const edit = screen('Screen/22-ProfileEdit/Default/390', 610);
top(edit, '私人名片定制');
label(edit, 'Edit your private card', 20, 108, 280, C.rose);
txt(edit, 'Title', '只展示你愿意分享的样子', 20, 134, 350, 21, fonts.serifB, C.forest, 'LEFT', 31);
const avatarEdit = card(edit, 'ProfileEdit/Avatar', 20, 180, 350, 132, C.pearl, 20);
avatar(avatarEdit, 20, 24, true);
txt(avatarEdit, 'Title', '更换头像', 108, 24, 160, 13, fonts.med, C.ink, 'LEFT', 20);
txt(avatarEdit, 'Copy', '建议使用仅双方可辨认的照片或插画。', 108, 52, 210, 10, fonts.sans, C.muted, 'LEFT', 16);
status(avatarEdit, 108, 84, '上传中 68%', C.antique, C.parchment, 104);
rect(avatarEdit, 'UploadProgress', 222, 94, 108, 5, C.line, 3);
rect(avatarEdit, 'UploadProgressFill', 222, 94, 73, 5, C.rose, 3);
const nickname = card(edit, 'ProfileEdit/Nickname', 20, 330, 350, 84, C.pearl, 18);
txt(nickname, 'Label', '昵称', 16, 10, 100, 10, fonts.med, C.muted, 'LEFT', 15);
txt(nickname, 'Value', '小兔', 16, 34, 250, 14, fonts.sans, C.ink, 'LEFT', 21);
txt(nickname, 'Counter', '2 / 12', 274, 36, 60, 10, fonts.num, C.muted, 'RIGHT', 16);
divider(nickname, 16, 68, 318, C.rose);
const privacy = card(edit, 'ProfileEdit/Privacy', 20, 432, 350, 100, C.parchment, 18);
label(privacy, 'Privacy first', 16, 12, 180, C.antique);
txt(privacy, 'Copy', '头像与昵称仅用于两人的私人空间。跨账号图片加载失败时，保留原头像并提供重试。', 16, 40, 308, 10, fonts.sans, C.muted, 'LEFT', 17);
const states = card(edit, 'ProfileEdit/StateStrip', 20, 550, 350, 112, C.pearl, 18);
txt(states, 'Title', '保存状态', 16, 12, 120, 11, fonts.med, C.ink, 'LEFT', 17);
[['未保存修改', C.rose], ['上传失败可重试', C.error], ['保存成功', C.success]].forEach((item, index) => {
  const x = 16 + index * 106;
  rect(states, 'StateDot', x, 44, 10, 10, item[1], 5);
  txt(states, 'StateLabel', item[0], x, 62, 96, 9, fonts.sans, C.muted, 'LEFT', 14);
});
const soundRow = card(edit, 'ProfileEdit/Sound', 20, 680, 350, 58, C.cream, 16, C.line);
txt(soundRow, 'Title', '保存成功轻触反馈', 16, 18, 210, 11, fonts.med, C.ink, 'LEFT', 17);
switchControl(soundRow, 286, 15, true);
button(edit, '保存私人名片', 758);

// 07 — Weekly recap
caption('07 · weekly-recap / 花园周刊特刊', 1120);
const recap = screen('Screen/07-WeeklyRecap/Default/390', 1120, C.midnight);
const cover = card(recap, 'WeeklyRecap/Cover', 0, 24, 390, 270, C.midnight, 0, null);
leaf(cover, 8, 190, 3.8, -24, C.gold, 0.24); leaf(cover, 318, 24, 3.8, 28, C.rose, 0.3);
label(cover, 'La gazette du jardin · No. 07', 24, 30, 342, C.gold, 'CENTER');
txt(cover, 'Week', 'JUL 06 — JUL 12', 24, 62, 342, 11, fonts.num, C.parchment, 'CENTER', 16);
ell(cover, 'SealRing', 151, 96, 88, 88, C.midnight, C.gold);
txt(cover, 'Seal', 'JV', 151, 116, 88, 27, fonts.latin, C.gold, 'CENTER', 38);
txt(cover, 'Title', '这一周，花园里\n长出了温柔的光', 34, 196, 322, 23, fonts.serifB, C.pearl, 'CENTER', 32);
const paper = card(recap, 'WeeklyRecap/Paper', 12, 286, 366, 558, C.cream, 28, C.gold);
label(paper, 'For the two of you', 20, 20, 326, C.rose, 'CENTER');
txt(paper, 'Opening', '她认真照顾自己，你也认真看见了。', 20, 48, 326, 16, fonts.serifB, C.forest, 'CENTER', 24);
const metrics = card(paper, 'WeeklyRecap/Metrics', 20, 92, 326, 100, C.pearl, 18);
[['184', '分钟'], ['6', '收藏日'], ['+420', '能量']].forEach((item, index) => {
  const x = 12 + index * 102;
  txt(metrics, 'MetricValue', item[0], x, 16, 98, 22, fonts.num, index === 2 ? C.antique : C.forest, 'CENTER', 29);
  txt(metrics, 'MetricLabel', item[1], x, 54, 98, 10, fonts.med, C.muted, 'CENTER', 16);
  if (index < 2) { const line = divider(metrics, x + 98, 18, 1); line.resize(1, 62); }
});
const moment = card(paper, 'WeeklyRecap/BestMoment', 20, 210, 326, 112, C.parchment, 18);
label(moment, 'Best moment', 14, 12, 180, C.antique);
txt(moment, 'Title', '周三的河边散步', 14, 40, 200, 14, fonts.serifB, C.ink, 'LEFT', 21);
txt(moment, 'Copy', '“晚风把心事吹得很轻。”', 14, 68, 250, 11, fonts.serif, C.forest, 'LEFT', 18);
txt(moment, 'Meta', '36 分钟 · 已共同确认', 14, 92, 220, 9, fonts.num, C.muted, 'LEFT', 14);
const encouragement = card(paper, 'WeeklyRecap/Encouragement', 20, 340, 326, 104, C.midnight, 18, C.gold);
label(encouragement, 'A note from him', 14, 12, 190, C.gold);
txt(encouragement, 'Quote', '你不是在追赶谁，只是在一点点把自己照顾得更好。', 14, 40, 288, 12, fonts.serif, C.pearl, 'LEFT', 20);
const emptySafety = card(paper, 'WeeklyRecap/EmptySafety', 20, 462, 326, 60, C.cream, 16, C.line);
txt(emptySafety, 'Copy', '若本周没有记录：显示“这周也可以只是好好休息”。', 14, 14, 294, 10, fonts.sans, C.muted, 'LEFT', 17);
txt(paper, 'Navigation', '‹  上一周                         下一周  ›', 20, 532, 326, 11, fonts.med, C.burgundy, 'CENTER', 18);

// Documentation
const doc = add(section, figma.createFrame());
doc.name = 'Documentation/ProfileRecap'; doc.x = 100; doc.y = 1120; doc.resize(1560, 620);
doc.fills = [solid(C.midnight)]; doc.cornerRadius = 28; doc.clipsContent = true;
label(doc, 'Identity and memory', 34, 34, 500, C.gold);
txt(doc, 'DocTitle', '资料克制，回顾温柔，隐私始终优先', 34, 72, 1300, 28, fonts.serifB, C.pearl, 'LEFT', 42);
txt(doc, 'DocCopy', '情侣纹章用于识别两人的私人关系，不展示公开社交信息；周报强调共同记忆，不做排名、比较或身材数据。', 34, 126, 1400, 14, fonts.sans, C.parchment, 'LEFT', 25);
const notes = [
  ['资料', '昵称与头像最小化\n只在双方空间展示'],
  ['上传', '失败可恢复\n不覆盖原头像'],
  ['周报', '午夜色仅作封面\n正文回到象牙纸'],
  ['空周', '允许休息\n不制造愧疚感']
];
notes.forEach((item, index) => {
  const x = 34 + index * 375;
  rect(doc, 'NoteCard', x, 230, 335, 210, C.midnight, 22, C.gold);
  txt(doc, 'NoteNo', String(index + 1).padStart(2, '0'), x + 20, 252, 60, 18, fonts.num, C.gold, 'LEFT', 24);
  txt(doc, 'NoteTitle', item[0], x + 20, 294, 150, 20, fonts.serifB, C.pearl, 'LEFT', 30);
  txt(doc, 'NoteCopy', item[1], x + 20, 340, 286, 12, fonts.sans, C.parchment, 'LEFT', 20);
});
txt(doc, 'Perf', 'GENERIC PLACEHOLDERS · PRIVATE BY DEFAULT · SAFE EMPTY WEEK · NO BODY METRICS · REDUCED MOTION', 34, 510, 1400, 12, fonts.med, C.gold, 'LEFT', 18);

return { createdNodeIds: ids, mutatedNodeIds: Object.values(screens), screens, documentationNodeIds: [doc.id] };
