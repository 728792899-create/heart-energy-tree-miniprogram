const page = await figma.getNodeByIdAsync('0:1');
if (!page || page.type !== 'PAGE') throw new Error('System page not found');
await figma.setCurrentPageAsync(page);
const coverSection = await figma.getNodeByIdAsync('5:2');
const foundationSection = await figma.getNodeByIdAsync('5:3');
if (!coverSection || coverSection.type !== 'SECTION' || !foundationSection || foundationSection.type !== 'SECTION') throw new Error('Foundation section wrappers not found');

const fonts = {
  sans: { family: 'Noto Sans SC', style: 'Regular' },
  sansMed: { family: 'Noto Sans SC', style: 'Medium' },
  sansBold: { family: 'Noto Sans SC', style: 'Bold' },
  serif: { family: 'Noto Serif SC', style: 'Regular' },
  serifMed: { family: 'Noto Serif SC', style: 'Medium' },
  serifBold: { family: 'Noto Serif SC', style: 'SemiBold' },
  latin: { family: 'Cormorant Garamond', style: 'Regular' },
  latinMed: { family: 'Cormorant Garamond', style: 'SemiBold' },
  numeric: { family: 'Inter', style: 'Semi Bold' }
};
await Promise.all(Object.values(fonts).map(font => figma.loadFontAsync(font)));
const C = {
  cream: '#FBF7EF', parchment: '#F2E9DA', pearl: '#FFFDF8', sage: '#748276', forest: '#294139',
  rose: '#A85570', burgundy: '#6D2942', gold: '#C9A866', antique: '#92743E', midnight: '#111A2D',
  ink: '#302D2A', muted: '#6D6862', line: '#DED3C4', brown: '#8A6654', bunny: '#F3E8D8'
};
const rgb = hex => ({ r: parseInt(hex.slice(1,3),16)/255, g: parseInt(hex.slice(3,5),16)/255, b: parseInt(hex.slice(5,7),16)/255 });
const solid = (hex, opacity=1) => ({ type: 'SOLID', color: rgb(hex), opacity });
const shadow = (hex, opacity, y, radius, spread=0) => ({ type:'DROP_SHADOW', color:{...rgb(hex),a:opacity}, offset:{x:0,y}, radius, spread, visible:true, blendMode:'NORMAL' });
const allIds = [];
function add(parent,node){ parent.appendChild(node); allIds.push(node.id); return node; }
function frame(parent,name,x,y,w,h,fill=C.pearl,radius=24){
  const n=add(parent,figma.createFrame()); n.name=name; n.x=x; n.y=y; n.resize(w,h); n.fills=[solid(fill)]; n.cornerRadius=radius; n.clipsContent=true; return n;
}
function rect(parent,name,x,y,w,h,fill,radius=0,stroke=null){
  const n=add(parent,figma.createRectangle()); n.name=name; n.x=x;n.y=y;n.resize(w,h);n.fills=[solid(fill)];n.cornerRadius=radius;
  if(stroke){n.strokes=[solid(stroke)];n.strokeWeight=1;} return n;
}
function ellipse(parent,name,x,y,w,h,fill,stroke=null,opacity=1){
  const n=add(parent,figma.createEllipse()); n.name=name;n.x=x;n.y=y;n.resize(w,h);n.fills=[solid(fill,opacity)];
  if(stroke){n.strokes=[solid(stroke)];n.strokeWeight=1;} return n;
}
function text(parent,name,chars,x,y,w,size,font=fonts.sans,color=C.ink,align='LEFT',lineHeight=null){
  const n=add(parent,figma.createText()); n.name=name;n.fontName=font;n.characters=chars;n.fontSize=size;
  n.fills=[solid(color)]; n.textAlignHorizontal=align; n.lineHeight={unit:'PIXELS',value:lineHeight||Math.round(size*1.48)};
  n.resize(w,Math.max(size*2,40));n.textAutoResize='HEIGHT';n.x=x;n.y=y;return n;
}
function line(parent,x1,y1,x2,y2,color=C.gold,width=1,opacity=1){
  const n=add(parent,figma.createLine());n.x=x1;n.y=y1;n.resize(Math.hypot(x2-x1,y2-y1),0);n.rotation=Math.atan2(y2-y1,x2-x1)*180/Math.PI;n.strokes=[solid(color,opacity)];n.strokeWeight=width;return n;
}
function leaf(parent,x,y,scale,rotation,color=C.sage,opacity=.7){
  const n=ellipse(parent,'Botanical/Leaf',x,y,34*scale,15*scale,color,null,opacity);n.rotation=rotation;return n;
}
function flourish(parent,x,y,scale=1,dark=false){
  const color=dark?C.gold:C.sage;
  line(parent,x,y,x+190*scale,y-70*scale,color,1.5,.65);
  leaf(parent,x+25*scale,y-23*scale,scale,-28,color,.7);
  leaf(parent,x+63*scale,y-42*scale,scale,20,color,.6);
  leaf(parent,x+105*scale,y-57*scale,scale,-30,color,.72);
  leaf(parent,x+145*scale,y-63*scale,scale,22,color,.62);
}
function label(parent,chars,x,y,w,color=C.antique){
  const n=text(parent,'Label',chars.toUpperCase(),x,y,w,12,fonts.sansMed,color,'LEFT',18);n.letterSpacing={unit:'PERCENT',value:14};return n;
}
function pill(parent,chars,x,y,w,fill,color){
  rect(parent,'Pill',x,y,w,36,fill,18); text(parent,'Pill/Label',chars,x,y+7,w,12,fonts.sansMed,color,'CENTER',18);
}
function mascotCrest(parent,x,y){
  const crest=frame(parent,'Identity/CoupleCrest',x,y,430,240,C.cream,120);
  crest.strokes=[solid(C.gold,.8)];crest.strokeWeight=2;crest.effects=[shadow(C.midnight,.12,12,28,-4)];
  ellipse(crest,'Halo',78,34,274,174,C.parchment,C.gold,.82);
  // bear
  ellipse(crest,'Bear/Ear L',115,76,45,45,C.brown,C.antique); ellipse(crest,'Bear/Ear R',199,76,45,45,C.brown,C.antique);
  ellipse(crest,'Bear/Head',125,76,110,120,C.brown,C.antique);
  ellipse(crest,'Bear/Muzzle',151,133,58,42,'#CDAF98');
  ellipse(crest,'Bear/Eye L',152,119,7,7,C.midnight); ellipse(crest,'Bear/Eye R',199,119,7,7,C.midnight);
  ellipse(crest,'Bear/Nose',176,139,10,8,C.midnight);
  // bunny
  ellipse(crest,'Bunny/Ear L',246,38,30,82,C.bunny,C.gold); ellipse(crest,'Bunny/Ear R',294,35,30,86,C.bunny,C.gold);
  ellipse(crest,'Bunny/Head',238,80,105,116,C.bunny,C.gold);
  ellipse(crest,'Bunny/Eye L',262,122,7,7,C.midnight); ellipse(crest,'Bunny/Eye R',307,122,7,7,C.midnight);
  ellipse(crest,'Bunny/Nose',284,142,9,7,C.rose);
  text(crest,'Crest/Monogram','J  ·  V',0,201,430,15,fonts.latinMed,C.antique,'CENTER',20);
  return crest;
}

let cover = coverSection.children.find(n => n.name === 'Documentation/00-Cover');
if (!cover) {
  cover = frame(coverSection,'Documentation/00-Cover',120,150,2260,1400,C.cream,34);
  cover.effects=[shadow(C.midnight,.14,18,48,-8)];
  const left=frame(cover,'Cover/Midnight Panel',0,0,1370,1400,C.midnight,0);
  rect(left,'Cover/Gold Edge',0,0,10,1400,C.gold,0);
  ellipse(left,'Cover/Orb 1',840,-170,680,680,C.rose,null,.15);
  ellipse(left,'Cover/Orb 2',980,740,520,520,C.sage,null,.17);
  flourish(left,84,260,1.3,true); flourish(left,1000,1220,1.5,true);
  label(left,'Private Edition · 2026',92,92,520,C.gold);
  text(left,'Cover/Latin','JARDIN\nDES VŒUX',88,184,920,110,fonts.latinMed,C.pearl,'LEFT',112);
  text(left,'Cover/Chinese','心愿花园高级定制',96,447,930,42,fonts.serifBold,C.pearl,'LEFT',60);
  text(left,'Cover/Subtitle','心动能量树私人版 V2 · 全量高保真设计系统',96,527,900,18,fonts.sansMed,C.gold,'LEFT',30);
  line(left,96,600,822,600,C.gold,1,.6);
  text(left,'Cover/Promise','不是监督她变成谁，\n而是一起把每一次努力，收藏成花园。',96,655,770,30,fonts.serif,C.pearl,'LEFT',50);
  mascotCrest(left,840,455);
  pill(left,'法式花园 70%',96,1032,185,C.forest,C.pearl);
  pill(left,'香槟宫廷 20%',295,1032,185,C.burgundy,C.pearl);
  pill(left,'午夜珠宝 10%',494,1032,185,C.antique,C.midnight);
  text(left,'Cover/Footnote','WECHAT MINI PROGRAM · PRODUCTION ORIENTED · MOTION SAFE',96,1305,900,12,fonts.sansMed,C.gold,'LEFT',18).letterSpacing={unit:'PERCENT',value:12};

  const right=frame(cover,'Cover/Index Panel',1370,0,890,1400,C.pearl,0);
  label(right,'Design Index',76,82,600,C.rose);
  text(right,'Cover/Index Title','一座可交付的\n双人心愿庄园',72,130,690,42,fonts.serifBold,C.forest,'LEFT',58);
  text(right,'Cover/Index Note','22 张核心页面 · 8 弹窗 · 8 状态\n6 响应式 · 2 动效分镜',76,280,680,17,fonts.sans,C.muted,'LEFT',29);
  const indexItems=[
    ['00–02','系统与组件','Foundations · Library'],
    ['03','女友成长','Invitation · Garden · Journal'],
    ['04','男友守护','Companion · Collection · Ledger'],
    ['05','花园奖励','Map · Wallet · Boutique'],
    ['06','守护运营','Review · Payout · Contract'],
    ['07','双人资料','Crest · Profile · Weekly'],
    ['08','弹窗状态','Dialog · Empty · Recovery'],
    ['09–10','动效交付','Responsive · Motion · Handoff']
  ];
  indexItems.forEach((item,i)=>{
    const y=410+i*102;
    text(right,'Index/No',item[0],76,y,90,16,fonts.numeric,C.rose,'LEFT',22);
    text(right,'Index/Title',item[1],168,y-2,250,19,fonts.serifMed,C.ink,'LEFT',28);
    text(right,'Index/English',item[2],168,y+32,520,12,fonts.sans,C.muted,'LEFT',18);
    line(right,76,y+77,766,y+77,C.line,1,.75);
  });
  rect(right,'Cover/Principle',72,1240,700,94,C.cream,18,C.line);
  text(right,'Cover/PrincipleText','流畅优先：静态金属渐变 · 同屏持续动画 ≤ 2 · 粒子 900ms 内结束',94,1261,656,14,fonts.sansMed,C.forest,'LEFT',24);
}

const boardDefs=[
  ['Documentation/01-Color',120,160,1500,1180],
  ['Documentation/02-Type',1700,160,1500,1180],
  ['Documentation/03-LayoutMotion',3280,160,1780,1180],
  ['Documentation/04-Principles',120,1440,4940,1270]
];
const foundationBoards={};
for(const [name,x,y,w,h] of boardDefs){
  let board=foundationSection.children.find(n=>n.name===name);
  if(!board){board=frame(foundationSection,name,x,y,w,h,C.pearl,28);board.effects=[shadow(C.midnight,.08,10,30,-6)];}
  foundationBoards[name]=board;
}
const colorBoard=foundationBoards['Documentation/01-Color'];
if(colorBoard.children.length===0){
  label(colorBoard,'01 · Color Atelier',56,46,700,C.rose);
  text(colorBoard,'Title','花园色彩工坊',52,86,800,34,fonts.serifBold,C.forest,'LEFT',48);
  text(colorBoard,'Note','奶油纸张承载日常，森林绿负责行动，玫瑰与酒红表达关系，香槟金只做克制高光。',52,145,1220,15,fonts.sans,C.muted,'LEFT',25);
  const swatches=[
    ['奶油象牙白','Cream Ivory','#FBF7EF'],['羊皮纸','Parchment','#F2E9DA'],['珍珠白','Pearl','#FFFDF8'],
    ['鼠尾草绿','Sage','#748276'],['深森林绿','Forest','#294139'],['古董玫瑰','Rose','#A85570'],
    ['勃艮第酒红','Burgundy','#6D2942'],['香槟金','Champagne','#C9A866'],['古董金','Antique Gold','#92743E'],
    ['午夜蓝','Midnight','#111A2D'],['墨色正文','Ink','#302D2A'],['柔和分割','Soft Line','#DED3C4']
  ];
  swatches.forEach((s,i)=>{
    const col=i%3,row=Math.floor(i/3),x=52+col*460,y=245+row*205;
    const card=frame(colorBoard,'Swatch/'+s[1],x,y,410,166,C.cream,20);
    rect(card,'Color',0,0,410,92,s[2],20);
    text(card,'Name',s[0],18,108,180,14,fonts.sansMed,C.ink,'LEFT',20);
    text(card,'Hex',s[2],205,108,184,13,fonts.numeric,C.muted,'RIGHT',20);
    text(card,'English',s[1],18,133,270,11,fonts.sans,C.muted,'LEFT',16);
  });
}
const typeBoard=foundationBoards['Documentation/02-Type'];
if(typeBoard.children.length===0){
  label(typeBoard,'02 · Typography',56,46,700,C.rose);
  text(typeBoard,'Title','法式秩序，中文呼吸',52,86,900,34,fonts.serifBold,C.forest,'LEFT',48);
  text(typeBoard,'Note','线上不下载大型中文字体包。生产端以系统字体回退，设计稿使用可用的 Noto 字族验证层级。',52,145,1320,15,fonts.sans,C.muted,'LEFT',25);
  text(typeBoard,'Sample/Latin','Jardin des Vœux',56,245,1200,76,fonts.latinMed,C.midnight,'LEFT',86);
  label(typeBoard,'Cormorant Garamond · Display',60,345,700,C.antique);
  line(typeBoard,56,395,1430,395,C.line,1,.8);
  text(typeBoard,'Sample/Chinese','把今天的温柔，收藏进花园。',56,450,1300,42,fonts.serifBold,C.forest,'LEFT',64);
  label(typeBoard,'Noto Serif SC · Chinese Display',60,535,700,C.antique);
  line(typeBoard,56,585,1430,585,C.line,1,.8);
  text(typeBoard,'Sample/Body','她完成的每一步都不是成绩，而是被认真看见的成长。今天可以慢一点，也仍然值得被爱。',56,642,1250,20,fonts.sans,C.ink,'LEFT',34);
  label(typeBoard,'Noto Sans SC · Body 15/24 · Minimum 14px',60,750,900,C.antique);
  const metric=frame(typeBoard,'Type/Metric',56,840,610,230,C.midnight,24);
  label(metric,'This Week',28,24,250,C.gold); text(metric,'Metric','184',26,60,290,76,fonts.numeric,C.pearl,'LEFT',86); text(metric,'Unit','MINUTES TOGETHER',250,110,300,12,fonts.sansMed,C.gold,'LEFT',18);
  const quote=frame(typeBoard,'Type/Quote',710,840,720,230,C.cream,24); flourish(quote,490,196,.9,false); text(quote,'Quote','“成长不是赶路，\n是我们一起照顾的花。”',34,44,590,26,fonts.serifMed,C.burgundy,'LEFT',43);
}
const layoutBoard=foundationBoards['Documentation/03-LayoutMotion'];
if(layoutBoard.children.length===0){
  label(layoutBoard,'03 · Layout & Motion',56,46,900,C.rose);
  text(layoutBoard,'Title','流畅性先于装饰密度',52,86,1080,34,fonts.serifBold,C.forest,'LEFT',48);
  text(layoutBoard,'Note','390 px 为主设计，375 / 430 px 验证；Auto Layout、真实骨架尺寸和微信安全区贯穿全部页面。',52,145,1540,15,fonts.sans,C.muted,'LEFT',25);
  const deviceWidths=[['375',375],['390',390],['430',430]];
  deviceWidths.forEach((item,i)=>{
    const x=56+i*535; const shell=frame(layoutBoard,'Layout/'+item[0],x,245,460,620,C.cream,28); shell.strokes=[solid(C.line)];shell.strokeWeight=1;
    label(shell,item[0]+' px',28,24,200,C.antique); rect(shell,'SafeArea',28,72,404,44,C.parchment,12); rect(shell,'Hero',28,134,404,170,i===1?C.forest:C.pearl,20,C.line);
    rect(shell,'CardA',28,322,192,118,C.pearl,18,C.line); rect(shell,'CardB',240,322,192,118,C.pearl,18,C.line); rect(shell,'CTA',28,470,404,52,C.rose,26); rect(shell,'Tab',28,542,404,52,C.midnight,22);
    text(shell,'WidthNote',i===0?'16 px margin':i===1?'20 px margin':'24 px margin',28,593,404,12,fonts.sansMed,C.muted,'CENTER',18);
  });
  const motions=[
    ['L1','90–160 ms','按压 / 标签 / 开关'],['L2','180–280 ms','反馈 / 弹窗 / 内容替换'],['L3','220–320 ms','页面淡入与轻上移'],['L4','600–900 ms','一次性仪式，随后停止']
  ];
  motions.forEach((m,i)=>{
    const x=56+i*410; const card=frame(layoutBoard,'Motion/'+m[0],x,930,370,170,i===3?C.midnight:C.cream,20);
    pill(card,m[0],20,18,58,i===3?C.gold:C.forest,i===3?C.midnight:C.pearl);
    text(card,'Duration',m[1],96,24,230,20,fonts.numeric,i===3?C.pearl:C.ink,'LEFT',26);
    text(card,'Meaning',m[2],20,86,325,14,fonts.sans,i===3?C.gold:C.muted,'LEFT',24);
  });
}
const principleBoard=foundationBoards['Documentation/04-Principles'];
if(principleBoard.children.length===0){
  label(principleBoard,'04 · Experience Charter',56,46,900,C.rose);
  text(principleBoard,'Title','让陪伴被看见，而不是让焦虑被放大',52,86,1600,36,fonts.serifBold,C.forest,'LEFT',52);
  text(principleBoard,'Note','所有视觉、文案和交互决策都服务于温柔、尊重、可实现与可持续。',52,150,1500,16,fonts.sans,C.muted,'LEFT',26);
  const principles=[
    ['01','共同成长','不用体重对比、排名、惩罚或命令式表达。'],
    ['02','成年情侣','小熊与小兔作为纹章和陪伴符号，不做儿童化头像框。'],
    ['03','真实可交付','不伪造跨账号照片，不模拟平台支付，不依赖重型字体包。'],
    ['04','状态可恢复','空白、离线、失败和权限限制都提供清晰下一步。'],
    ['05','性能克制','主要动画只使用 transform / opacity；默认页无常驻粒子。'],
    ['06','无障碍语义','状态不只靠颜色；主要点击区 ≥ 44 px；正文 ≥ 14 px。']
  ];
  principles.forEach((p,i)=>{
    const col=i%3,row=Math.floor(i/3),x=52+col*1610,y=255+row*360;
    const card=frame(principleBoard,'Principle/'+p[0],x,y,1500,300,i===0?C.forest:C.cream,24);
    card.strokes=[solid(i===0?C.forest:C.line)];card.strokeWeight=1;
    text(card,'No',p[0],30,28,120,18,fonts.numeric,i===0?C.gold:C.rose,'LEFT',24);
    text(card,'Title',p[1],30,78,600,28,fonts.serifBold,i===0?C.pearl:C.forest,'LEFT',40);
    text(card,'Copy',p[2],30,145,1350,16,fonts.sans,i===0?C.parchment:C.muted,'LEFT',28);
    flourish(card,1170,260,.8,i===0);
  });
  const footer=frame(principleBoard,'Principle/Footer',52,1010,4725,180,C.midnight,24);
  text(footer,'Quote','“今天也可以慢慢来。”',40,38,1100,32,fonts.serifMed,C.pearl,'LEFT',46);
  text(footer,'Meta','Reduce Motion 120–180ms fade · Max 2 continuous animations · Static metallic gradients',1130,59,3320,13,fonts.sansMed,C.gold,'RIGHT',22);
}

return {
  createdNodeIds: allIds,
  rootNodeIds: [cover.id, ...Object.values(foundationBoards).map(board => board.id)],
  coverId: cover.id,
  foundationBoardIds: Object.fromEntries(Object.entries(foundationBoards).map(([name,node])=>[name,node.id]))
};
