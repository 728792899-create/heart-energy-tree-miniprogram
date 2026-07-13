const page = await figma.getNodeByIdAsync('0:1');
if (!page || page.type !== 'PAGE') throw new Error('System page not found');
await figma.setCurrentPageAsync(page);
const section = await figma.getNodeByIdAsync('5:4');
if (!section || section.type !== 'SECTION') throw new Error('Components section not found');
const C={pearl:'#FFFDF8',cream:'#FBF7EF',midnight:'#111A2D',line:'#DED3C4',rose:'#A85570',forest:'#294139',muted:'#6D6862'};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const solid=(h,o=1)=>({type:'SOLID',color:rgb(h),opacity:o});
const fonts=[{family:'Noto Sans SC',style:'Regular'},{family:'Noto Sans SC',style:'Medium'},{family:'Noto Serif SC',style:'SemiBold'}];
await Promise.all(fonts.map(f=>figma.loadFontAsync(f)));
const createdNodeIds=[];
function add(p,n){p.appendChild(n);createdNodeIds.push(n.id);return n;}
function txt(p,c,x,y,w,s,font,color,line){const n=add(p,figma.createText());n.fontName=font;n.characters=c;n.fontSize=s;n.fills=[solid(color)];n.lineHeight={unit:'PIXELS',value:line||Math.round(s*1.5)};n.resize(w,s*3);n.textAutoResize='HEIGHT';n.x=x;n.y=y;return n;}
const defs=[
 ['Library/00-Navigation-Actions',120,160,3700,1800,'导航与动作','Navigation · Buttons · Bars'],
 ['Library/01-Inputs-Controls',3980,160,3700,1800,'输入与控制','Inputs · Chips · Controls'],
 ['Library/02-Cards-Content',120,2080,4900,2400,'卡片与内容','Cards · Lists · Garden Objects'],
 ['Library/03-States-Feedback',5200,2080,2480,2400,'状态与反馈','States · Stamps · Dialogs']
];
const boards={};
for(const [name,x,y,w,h,title,en] of defs){
 let board=section.children.find(n=>n.name===name);
 if(!board){board=add(section,figma.createFrame());board.name=name;board.x=x;board.y=y;board.resize(w,h);board.fills=[solid(C.pearl)];board.cornerRadius=28;board.clipsContent=true;board.strokes=[solid(C.line)];board.strokeWeight=1;
   txt(board,en.toUpperCase(),48,38,w-96,12,{family:'Noto Sans SC',style:'Medium'},C.rose,18).letterSpacing={unit:'PERCENT',value:12};
   txt(board,title,46,76,w-96,32,{family:'Noto Serif SC',style:'SemiBold'},C.forest,46);
   txt(board,'本地组件 · 语义令牌 · 最小点击区 44 px · 微信小程序可实现',48,132,w-96,14,{family:'Noto Sans SC',style:'Regular'},C.muted,22);
   const divider=add(board,figma.createRectangle());divider.x=48;divider.y=180;divider.resize(w-96,1);divider.fills=[solid(C.line)];
 }
 boards[name]=board.id;
}
return {createdNodeIds,rootNodeIds:Object.values(boards),boards};
