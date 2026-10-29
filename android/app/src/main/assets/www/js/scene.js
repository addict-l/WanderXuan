App.ready.then(function(){
'use strict';
const A=App,S=A.state;
A.mountHud();
const stage=document.getElementById('stage');
if(!window.THREE||!THREE.OrbitControls){stage.innerHTML='<p style="padding:180px 24px;text-align:center">3D 引擎没加载出来，刷新一下试试</p>';return;}
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- renderer / camera ---------- */
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;
stage.appendChild(renderer.domElement);Object.assign(renderer.domElement.style,{display:'block',touchAction:'none',cursor:'grab'});
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,120);camera.position.set(13,9.5,13);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.target.set(-.6,1.8,-1);Object.assign(controls,{enableDamping:true,dampingFactor:.08,enablePan:false,minDistance:6,maxDistance:26,minPolarAngle:.35,maxPolarAngle:1.42,minAzimuthAngle:.06,maxAzimuthAngle:Math.PI/2-.06,rotateSpeed:.6});
let firstPerson=null;

/* ---------- helpers ---------- */
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:0},o));
function add(m,parent){m.castShadow=true;m.receiveShadow=true;(parent||scene).add(m);return m;}
function box(w,h,d,mat,x,y,z,p){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return add(m,p);}
function cyl(rt,rb,h,mat,x,y,z,p,seg=28,open=false){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg,1,open),mat);m.position.set(x,y,z);return add(m,p);}
function sph(r,mat,x,y,z,p){const m=new THREE.Mesh(new THREE.SphereGeometry(r,24,18),mat);m.position.set(x,y,z);return add(m,p);}
function plane(w,h,mat,x,y,z,p){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.receiveShadow=true;(p||scene).add(m);return m;}
function ctex(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return {c,g:c.getContext('2d'),t};}
const frontFace=(tex,side='#eee',o={})=>{const s=M(side);return [s,s,s,s,M('#ffffff',Object.assign({map:tex,roughness:.6},o)),s];};
function wrap(g,text,maxW){const out=[];let line='';for(const ch of String(text)){if(g.measureText(line+ch).width>maxW&&line){out.push(line);line=ch;}else line+=ch;}if(line)out.push(line);return out;}
const font=(px,f='ZCOOL KuaiLe')=>`${px}px "${f}","PingFang SC","Microsoft YaHei",sans-serif`;
const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);};

/* hot objects: anything clickable registers an owner group */
const hot=[],owners=[];
function adopt(root,owner){root.traverse(o=>{if(o.isMesh&&!o.userData.owner){o.userData.owner=owner;hot.push(o);}});}
function dropMeshes(root){root.traverse(o=>{const j=hot.indexOf(o);if(j>=0)hot.splice(j,1);if(o.isMesh)o.userData.owner=null;});}
function makeHot(obj,meta,mode='scale'){obj.userData.meta=meta;obj.userData.mode=mode;obj.userData.baseScale=obj.scale.clone();obj.userData.basePos=obj.position.clone();owners.push(obj);adopt(obj,obj);}
function unHot(obj){const k=owners.indexOf(obj);if(k>=0)owners.splice(k,1);dropMeshes(obj);}
function clearGroup(g){dropMeshes(g);g.children.slice().forEach(c=>{if(owners.includes(c))unHot(c);g.remove(c);c.traverse(o=>{o.geometry&&o.geometry.dispose();});});}

/* simple tween list */
const anims=[];
function tween(dur,f,done){if(reduce){f(1);done&&done();return;}anims.push({t:0,dur,f,done});}

/* ---------- room shell ---------- */
const W=10,H=5.2,HW=W/2;
const floorT=ctex(1024,1024);
(function(){const g=floorT.g;g.fillStyle='#C08B5C';g.fillRect(0,0,1024,1024);
  for(let r=0;r<16;r++){for(let k=0;k<3;k++){const off=((r*397)%3)*130,x=(k*420+off)%1024;g.fillStyle=`hsl(${26+(r*7%6)},${42+(r*13%10)}%,${52+((r*5+k*3)%9)}%)`;g.fillRect(x,r*64,420,64);g.fillRect(x-1024,r*64,420,64);}
    g.fillStyle='rgba(70,40,20,.35)';g.fillRect(0,r*64,1024,2);}
  for(let i=0;i<500;i++){g.fillStyle='rgba(90,50,25,.08)';g.fillRect((i*733)%1024,(i*389)%1024,40+(i%80),1.5);}
  floorT.t.wrapS=floorT.t.wrapT=THREE.RepeatWrapping;floorT.t.repeat.set(1.8,1.8);})();
const floorMat=M('#fff',{map:floorT.t,roughness:.7}),baseSide=M('#8E6142');
const base=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.5,W+.4),[baseSide,baseSide,floorMat,baseSide,baseSide,baseSide]);base.position.set(-.2,-.25,-.2);base.receiveShadow=true;scene.add(base);
const wallMat=M('#C9CEEA'),wainMat=M('#A9B0DB'),trimMat=M('#F4F1FA');
box(W+.4,H,.2,wallMat,-.2,H/2,-HW-.1).castShadow=false;box(.2,H,W,wallMat,-HW-.1,H/2,0).castShadow=false;
box(W,1.3,.04,wainMat,0,.65,-HW+.02).castShadow=false;box(.04,1.3,W,wainMat,-HW+.02,.65,0).castShadow=false;
box(W,.08,.08,trimMat,0,1.32,-HW+.04);box(.08,.08,W,trimMat,-HW+.04,1.32,0);
box(W,.18,.06,trimMat,0,.09,-HW+.05);box(.06,.18,W,trimMat,-HW+.05,.09,0);
box(W+.4,.12,.3,trimMat,-.2,H+.06,-HW-.05);box(.3,.12,W+.2,trimMat,-HW-.05,H+.06,.1);
const rugT=ctex(512,512);(function(){const g=rugT.g,cols=['#F3D2D6','#E8577A','#F3D2D6','#FFF3EA','#F4A259','#FFF3EA','#F3D2D6'];g.fillStyle='#FFF3EA';g.fillRect(0,0,512,512);
  cols.forEach((c,k)=>{g.beginPath();g.arc(256,256,250-k*34,0,Math.PI*2);g.fillStyle=c;g.fill();});g.strokeStyle='rgba(255,255,255,.5)';g.setLineDash([6,8]);g.lineWidth=3;for(let r=40;r<250;r+=34){g.beginPath();g.arc(256,256,r,0,Math.PI*2);g.stroke();}})();
const rug=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,.03,64),[M('#E8577A'),M('#fff',{map:rugT.t}),M('#fff')]);rug.position.set(.3,.015,.6);rug.receiveShadow=true;scene.add(rug);

/* ---------- bookshelf (back-left corner) ---------- */
const shelf=new THREE.Group();shelf.position.set(-4.15,0,-4.74);scene.add(shelf);
const shelfWood=M('#D9BE98'),shelfDark=M('#C4A67E');
box(.06,3.3,.5,shelfWood,-.72,1.65,0,shelf);box(.06,3.3,.5,shelfWood,.72,1.65,0,shelf);box(1.5,3.3,.03,shelfDark,0,1.65,-.235,shelf);
const shelfTops=[.085,.925,1.765,2.605];[.06,.9,1.74,2.58,3.28].forEach(y=>box(1.44,.05,.48,shelfWood,0,y,0,shelf));
/* decor on top shelf */
cyl(.05,.07,.06,M('#8E6142'),-.4,2.64,0,shelf);sph(.17,M('#6FB0D9'),-.4,2.85,0,shelf);
cyl(.09,.07,.16,M('#F2EEE6'),.15,2.69,0,shelf);[0,1,2,3].forEach(k=>{const l=sph(.07,M('#5BAE8C'),.15+Math.cos(k*1.6)*.06,2.82+k*.025,Math.sin(k*1.6)*.05,shelf);l.scale.set(1,.5,.7);});
box(.36,.06,.26,M('#E8577A'),.45,2.64,0,shelf);box(.32,.06,.24,M('#F4A259'),.45,2.7,0,shelf);
const booksG=new THREE.Group();shelf.add(booksG);const bookMeshes=[];let pulled=-1;
async function buildBooks(){
  await A.ensureFonts(S.books.map(b=>b.title).join(''));
  clearGroup(booksG);bookMeshes.length=0;
  let row=1,x=-.68;
  S.books.forEach((b,i)=>{
    const h0=hash(b.id),th=.12+(h0%6)*.012,h=.5+(h0%5)*.03;
    if(x+th>.68){row++;x=-.68;}if(row>2)return;
    const tx=ctex(64,384),g=tx.g;g.fillStyle=b.color;g.fillRect(0,0,64,384);g.fillStyle='rgba(255,255,255,.75)';g.fillRect(0,26,64,4);g.fillRect(0,354,64,4);
    g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';const chars=[...b.title].slice(0,6),fs=chars.length>4?36:42;g.font=font(fs);
    chars.forEach((ch,k)=>g.fillText(ch,32,70+k*(fs+4)));g.font='bold 15px sans-serif';g.fillStyle='rgba(255,255,255,.85)';g.fillText(b.date.slice(2,7).replace('-','.'),32,334);
    const side=M(b.color),pages=M('#F3EEE2');
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(th,h,.36),[side,side,pages,pages,M('#fff',{map:tx.t,roughness:.7}),side]);
    const grp=new THREE.Group();grp.position.set(x+th/2,shelfTops[row]+h/2,.04);grp.add(mesh);mesh.castShadow=true;booksG.add(grp);
    makeHot(grp,{kind:'book',i,label:()=>`${b.title} · ${b.date.slice(0,7).replace('-','.')}`},'pull');bookMeshes[i]=grp;
    x+=th+.012;
  });
  /* a leaning book at the end of row 2 for charm */
}
const shelfHot=new THREE.Group();shelf.add(shelfHot);

/* ---------- photo wall ---------- */
const SLOT=[[-2.55,3.8],[-1.5,3.8],[-.45,3.8],[.6,3.8],[-2.55,2.6],[-1.5,2.6],[-.45,2.6],[.6,2.6]];
const smallTilt=[-.05,.03,-.02,.04,-.04,.02,.03,-.03];
const slots=SLOT.map(([x,y],i)=>{
  const g=new THREE.Group();g.position.set(x,y,-HW+.06);scene.add(g);
  const tx=ctex(360,430);const face=new THREE.Mesh(new THREE.BoxGeometry(.86,1.03,.02),frontFace(tx.t));face.castShadow=true;g.add(face);
  const tape=plane(.32,.09,M(i%2?'#8FC1EA':'#F7C27A',{transparent:true,opacity:.85}),0,.5,.013,g);tape.rotation.z=i%2?.12:-.1;
  makeHot(g,{kind:'photo',i,label:()=>{const p=S.photos[i];return !p?'空相框 · 挂一张':p.crooked&&p.by!==S.me?`${p.title} · 歪着呢，点开扶正`:p.title;}});
  g.userData.targetRot=smallTilt[i];return {g,tx,face,tape,i};
});
async function drawSlot(s){
  const p=S.photos[s.i],{g,t}=s.tx;
  if(!p){g.clearRect(0,0,360,430);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(0,0,360,430);g.setLineDash([16,12]);g.lineWidth=6;g.strokeStyle='rgba(80,80,130,.55)';g.strokeRect(14,14,332,402);
    await A.ensureFonts('挂一张');g.setLineDash([]);g.fillStyle='rgba(60,60,110,.7)';g.textAlign='center';g.textBaseline='middle';g.font=font(90);g.fillText('+',180,190);g.font=font(36);g.fillText('挂一张',180,270);
    s.face.material[4].transparent=true;s.face.material[4].needsUpdate=true;t.needsUpdate=true;s.tape.visible=false;s.g.userData.targetRot=0;return;}
  s.tape.visible=true;if(s.face.material[4].transparent){s.face.material[4].transparent=false;s.face.material[4].needsUpdate=true;}
  s.g.userData.targetRot=p.crooked?(s.i%2?-.3:.3):smallTilt[s.i];
  await A.ensureFonts(p.title);
  const img=new Image();img.onload=()=>{g.fillStyle='#FFFFFF';g.fillRect(0,0,360,430);g.drawImage(img,16,16,328,328);g.fillStyle='#3A3448';g.font=font(38,'Long Cang');g.textAlign='center';g.textBaseline='middle';g.fillText(p.title,180,388);t.needsUpdate=true;};
  img.src=A.picSrc(p);
}
const bulbs=[];
for(let k=0;k<17;k++){const t=k/16,b=sph(.045,new THREE.MeshStandardMaterial({color:'#FFE9A8',emissive:['#FFC85A','#FF9DB4','#9FD3F5'][k%3],emissiveIntensity:.6}),-3.1+t*4.2,4.62-Math.sin(t*Math.PI)*.3,-HW+.08);b.castShadow=false;bulbs.push(b);}

/* ---------- sideboard + record player ---------- */
const side=new THREE.Group();side.position.set(-1.0,0,-4.68);scene.add(side);
const sbWood=M('#E7D3B8'),sbDark=M('#B99B78');
box(3.6,.72,.6,sbWood,0,.47,0,side);[-1.7,1.7].forEach(x=>[-.22,.22].forEach(z=>cyl(.03,.025,.12,sbDark,x,.06,z,side,8)));
[-.6,.6].forEach(x=>box(.02,.62,.01,sbDark,x,.47,.305,side));[-1.2,0,1.2].forEach(x=>sph(.03,M('#C9A15A',{metalness:.5,roughness:.3}),x+.25,.5,.32,side));
cyl(.07,.1,.32,M('#F3C6CF'),-1.35,1.0,0,side);[[0,0],[.06,.04],[-.05,.05]].forEach(([dx,dz],k)=>{cyl(.008,.008,.3,M('#5C7A3A'),-1.35+dx,1.28,dz,side,6);sph(.05,M(['#FFF3EA','#F4A259','#E8577A'][k]),-1.35+dx,1.44+k*.02,dz,side);});
const rp=new THREE.Group();rp.position.set(.5,.83,0);side.add(rp);
box(.95,.16,.72,M('#8E6142'),0,.08,0,rp);box(.95,.01,.72,M('#6E4A32'),0,.165,0,rp);
cyl(.33,.33,.03,M('#2C2C34',{roughness:.5}),-.1,.18,0,rp,40);
const vinylT=ctex(256,256);(function(){const g=vinylT.g;g.fillStyle='#16161C';g.fillRect(0,0,256,256);g.strokeStyle='rgba(255,255,255,.07)';for(let r=40;r<126;r+=3){g.beginPath();g.arc(128,128,r,0,Math.PI*2);g.stroke();}
  g.fillStyle='#E8577A';g.beginPath();g.arc(128,128,38,0,Math.PI*2);g.fill();g.fillStyle='#FFF3EA';g.beginPath();g.arc(128,128,4,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(255,255,255,.85)';g.font='bold 14px sans-serif';g.textAlign='center';g.fillText('♥ OUR',128,118);g.fillText('SONGS',128,146);})();
const vinyl=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.015,48),[M('#16161C'),M('#fff',{map:vinylT.t,roughness:.35}),M('#16161C')]);vinyl.position.set(-.1,.2,0);vinyl.castShadow=true;rp.add(vinyl);
const arm=new THREE.Group();arm.position.set(.33,.2,-.25);rp.add(arm);
cyl(.04,.04,.05,M('#C9CED8',{metalness:.6,roughness:.3}),0,0,0,arm,16);box(.025,.025,.5,M('#C9CED8',{metalness:.6,roughness:.3}),0,.04,.25,arm);box(.05,.03,.08,M('#3A3448'),0,.03,.5,arm);
arm.rotation.y=.12;
box(.12,.05,.08,M('#E8577A'),.33,.19,.25,rp);
makeHot(rp,{kind:'music',label:()=>{const s=S.songs.find(x=>x.id===S.playing);return s?`正在放：${s.title}`:'唱片机 · 我们的歌单';}});
const noteTex=(()=>{const t=ctex(64,64);t.g.fillStyle='#fff';t.g.font='bold 52px sans-serif';t.g.textAlign='center';t.g.textBaseline='middle';t.g.fillText('♪',32,34);return t.t;})();
const notesFx=[];let noteTimer=0;

/* ---------- desk, corkboard, my lamp ---------- */
const wood=M('#E7D3B8'),wood2=M('#CDB394');
const desk=new THREE.Group();desk.position.set(2.65,0,-4.45);scene.add(desk);
box(2.6,.1,1.0,wood,0,1.5,0,desk);[[-1.2,-.4],[1.2,-.4],[-1.2,.4],[1.2,.4]].forEach(([x,z])=>box(.08,1.45,.08,wood2,x,.725,z,desk));
box(.85,.48,.85,wood2,-.8,1.16,0,desk);sph(.03,M('#C9A15A',{metalness:.5}),-.8,1.2,.43,desk);
const metal=M('#BFC4D2',{metalness:.3,roughness:.4});
box(.8,.04,.55,metal,.1,1.57,.12,desk);const scr=box(.8,.52,.03,metal,.1,1.83,-.16,desk);scr.rotation.x=-.18;
const scrT=ctex(256,160);(function(){const g=scrT.g,gr=g.createLinearGradient(0,0,256,160);gr.addColorStop(0,'#F7B9A8');gr.addColorStop(1,'#C9CEEA');g.fillStyle=gr;g.fillRect(0,0,256,160);g.fillStyle='#fff';g.font='bold 40px sans-serif';g.textAlign='center';g.fillText('♥',128,96);})();
const sf=plane(.72,.44,new THREE.MeshBasicMaterial({map:scrT.t}),.1,1.83,-.142,desk);sf.rotation.x=-.18;
cyl(.09,.08,.2,M('#F4A259'),-.55,1.65,.25,desk);
const cork=new THREE.Group();cork.position.set(2.65,3.3,-HW+.06);scene.add(cork);
box(2.6,1.7,.06,wood2,0,0,0,cork);
const boardT=ctex(1040,680);plane(2.48,1.58,M('#fff',{map:boardT.t,roughness:.95}),0,0,.035,cork);
const notesG=new THREE.Group();cork.add(notesG);const noteMesh={};
makeHot(cork,{kind:'todo',label:'今日待办'});
async function drawBoard(){
  await A.ensureFonts('今日待办'+S.names.join(''));
  const g=boardT.g,w=1040,h=680;g.fillStyle='#C99A68';g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){g.fillStyle=`rgba(${i%2?'120,80,40':'240,210,170'},.22)`;g.fillRect((i*137)%w,(i*271+i*i)%h,3,3);}
  g.save();g.translate(w/2,48);g.rotate(-.015);g.fillStyle='#fff';g.fillRect(-170,-32,340,64);g.fillStyle='#3A3448';g.font=font(42);g.textAlign='center';g.textBaseline='middle';const d=new Date();g.fillText(`今日待办 ${d.getMonth()+1}/${d.getDate()}`,0,2);g.restore();
  g.font=font(36);g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#B5651A';g.fillText(S.names[0],44,128);g.fillStyle='#2F6EA8';g.textAlign='right';g.fillText(S.names[1],w-44,128);
  boardT.t.needsUpdate=true;
}
const NOTEPOS=[[[-.9,.18],[-.36,.2],[-.88,-.4],[-.34,-.38]],[[.36,.2],[.9,.18],[.34,-.38],[.88,-.4]]];
async function buildNotes(){
  await A.ensureFonts(S.todos.map(t=>t.text).join('')+'贴的');
  dropMeshes(notesG);notesG.children.slice().forEach(c=>{notesG.remove(c);c.geometry.dispose();});for(const k in noteMesh)delete noteMesh[k];
  [0,1].forEach(w=>{S.todos.filter(t=>t.to===w&&!t.done).slice(0,4).forEach((t,k)=>{
    const tx=ctex(256,256),g=tx.g;g.fillStyle=w?'#C4E5F6':'#FFE08A';g.fillRect(0,0,256,256);g.fillStyle='rgba(0,0,0,.06)';g.fillRect(0,226,256,30);
    g.fillStyle=t.from!==t.to?'#3E9A6A':w?'#2F7BC0':'#E8577A';g.beginPath();g.arc(128,22,13,0,Math.PI*2);g.fill();
    g.fillStyle='#3A3448';g.font=font(36);g.textAlign='center';g.textBaseline='middle';const lines=wrap(g,t.text,216).slice(0,4);lines.forEach((l,j)=>g.fillText(l,128,118+j*44-(lines.length-1)*22));
    if(t.from!==t.to){g.font=font(22);g.fillStyle='rgba(58,52,72,.6)';g.fillText(`${S.names[t.from]} 贴的`,128,236);}
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),new THREE.MeshStandardMaterial({map:tx.t,roughness:.9,side:THREE.DoubleSide}));
    const [x,y]=NOTEPOS[w][k];m.position.set(x,y-.08,.05);m.rotation.z=((hash(t.id)%9)-4)*.02;m.castShadow=true;notesG.add(m);noteMesh[t.id]=m;});});
  adopt(notesG,cork);
}
/* lamp for person 0 on the desk */
function deskLamp(){
  const L=new THREE.Group();L.position.set(3.7,1.55,-4.6);scene.add(L);const met=M('#F2A24A',{roughness:.4,metalness:.2});
  cyl(.18,.2,.06,met,0,.03,0,L);const a1=cyl(.025,.025,.7,met,0,.38,0,L);a1.rotation.z=.25;const a2=cyl(.025,.025,.55,met,-.2,.88,0,L);a2.rotation.z=1.0;
  const sh=new THREE.Mesh(new THREE.ConeGeometry(.2,.28,24,1,true),new THREE.MeshStandardMaterial({color:'#F2A24A',side:THREE.DoubleSide,roughness:.5}));sh.position.set(-.45,.95,0);sh.rotation.z=.5;sh.castShadow=true;L.add(sh);
  const bm=new THREE.MeshStandardMaterial({color:'#FFF6DA',emissive:'#FFD27A',emissiveIntensity:1});const bulb=sph(.07,bm,-.5,.86,0,L);bulb.castShadow=false;
  const light=new THREE.PointLight('#FFC879',1,6,1.6);light.position.set(-.55,.75,0);L.add(light);
  makeHot(L,{kind:'lamp',i:0,label:()=>`${S.names[0]}的灯 · ${A.online(0)?'在线':'不在'}`});return {bm,light};
}
const lamps=[deskLamp()];

/* ---------- trash bin ---------- */
const bin=new THREE.Group();bin.position.set(1.0,0,-4.35);scene.add(bin);
cyl(.24,.19,.5,M('#7FB5A8',{side:THREE.DoubleSide}),0,.25,0,bin,28,true);cyl(.19,.19,.02,M('#6A9E92'),0,.01,0,bin);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.24,.015,8,32),M('#6A9E92'));ring.rotation.x=Math.PI/2;ring.position.y=.5;bin.add(ring);
const ballsG=new THREE.Group();bin.add(ballsG);
const paperMat=M('#FBF6E8',{roughness:1,flatShading:true}),paperMat2=M('#FFE08A',{roughness:1,flatShading:true}),paperMat3=M('#C4E5F6',{roughness:1,flatShading:true});
function ballGeo(){const geo=new THREE.IcosahedronGeometry(.07,1),p=geo.attributes.position,v=new THREE.Vector3();
  for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k);const n=1+.28*Math.sin(v.x*90+v.y*37)*Math.cos(v.z*71+v.x*23);v.multiplyScalar(n);p.setXYZ(k,v.x,v.y,v.z);}geo.computeVertexNormals();return geo;}
const BALL=ballGeo();
const ballMat=t=>t&&t.to===1?paperMat3:paperMat2;
function buildBin(){
  dropMeshes(ballsG);ballsG.children.slice().forEach(c=>ballsG.remove(c));
  const done=S.todos.filter(t=>t.done).slice(-9);
  done.forEach((t,k)=>{const h=hash(t.id),m=new THREE.Mesh(BALL,ballMat(t));m.position.set(((h%7)-3)*.035,.08+k*.042,(((h>>3)%7)-3)*.035);m.rotation.set(h%6,h%5,h%4);m.castShadow=true;ballsG.add(m);});
  adopt(ballsG,bin);
}
makeHot(bin,{kind:'bin',label:()=>`垃圾桶 · ${S.todos.filter(t=>t.done).length} 个纸团`});
function crumple(id){
  const t=S.todos.find(x=>x.id===id),note=noteMesh[id],start=new THREE.Vector3();
  if(note)note.getWorldPosition(start);else start.set(2.65,3.3,-4.8);
  const ball=new THREE.Mesh(BALL,ballMat(t));ball.position.copy(start);ball.scale.setScalar(.01);ball.castShadow=true;scene.add(ball);
  const end=new THREE.Vector3(1.0,.62,-4.35),land=.1+Math.min(8,S.todos.filter(x=>x.done).length-1)*.042;
  const finish=()=>{scene.remove(ball);buildNotes();buildBin();};
  if(reduce){finish();return;}
  tween(.45,p=>{if(note){note.scale.setScalar(Math.max(.01,1-p));note.rotation.z+=.2;}ball.scale.setScalar(Math.max(.01,p*1.6));ball.rotation.x+=.3;},()=>{
    if(note)note.visible=false;ball.scale.setScalar(1);
    tween(.85,p=>{const e=p;ball.position.set(start.x+(end.x-start.x)*e,start.y+(end.y-start.y)*e+1.1*Math.sin(e*Math.PI),start.z+(end.z-start.z)*e+.9*Math.sin(e*Math.PI));ball.rotation.x+=.28;ball.rotation.z+=.2;},()=>{
      tween(.22,p=>{ball.position.y=end.y-(end.y-land)*p;},finish);});});
}

/* ---------- fridge ---------- */
const fridge=new THREE.Group();fridge.position.set(4.5,0,-4.55);scene.add(fridge);
const fBody=M('#BFE3D6',{roughness:.45}),fDoor=M('#CBEBDF',{roughness:.4}),chrome=M('#E8ECF2',{metalness:.6,roughness:.25});
box(.9,2.6,.82,fBody,0,1.34,0,fridge);[-.36,.36].forEach(x=>cyl(.04,.04,.06,M('#555'),x,.03,.32,fridge,8));
box(.86,.6,.05,fDoor,0,2.3,.43,fridge);box(.86,1.86,.05,fDoor,0,1.02,.43,fridge);
box(.04,.3,.06,chrome,-.36,2.2,.48,fridge);box(.04,.5,.06,chrome,-.36,1.6,.48,fridge);
const magT=ctex(330,680),topT=ctex(330,220);
const magPlane=plane(.76,1.57,M('#fff',{map:magT.t,transparent:true,roughness:.6}),.03,1.02,.457,fridge);
const topPlane=plane(.76,.5,M('#fff',{map:topT.t,transparent:true,roughness:.6}),.03,2.3,.457,fridge);
makeHot(fridge,{kind:'fridge',label:'冰箱 · 想一起吃的'});
async function drawFridge(){
  await A.ensureFonts(S.eats.map(e=>e.text).join('')+'想一起吃私房菜谱道');
  let g=magT.g;g.clearRect(0,0,330,680);
  g.fillStyle='#3A3448';g.font=font(40,'Long Cang');g.textAlign='center';g.textBaseline='middle';g.fillText('想一起吃 ♥',170,44);
  const cols=['#E8577A','#F4A259','#5B9BD5','#5BAE8C','#9B7FD1','#F2C14E','#E07A5F'];
  S.eats.slice(0,7).forEach((e,k)=>{const y=100+k*82,x=40+(k%2)*16,rot=((k*5)%5-2)*.04;g.save();g.translate(x,y);g.rotate(rot);
    g.fillStyle='rgba(0,0,0,.12)';g.fillRect(6,6,250,52);g.fillStyle='#FFFDF6';g.fillRect(0,0,250,52);
    g.fillStyle=e.done?'#9AA0A8':'#3A3448';g.font=font(26);g.textAlign='left';g.textBaseline='middle';const s=wrap(g,e.text,200)[0];g.fillText(s+(wrap(g,e.text,200).length>1?'…':''),36,27);
    if(e.done){g.fillRect(36,27,g.measureText(s).width,3);}
    const mc=cols[k%cols.length];g.fillStyle=mc;g.beginPath();if(k%3===0){g.arc(10,8,15,0,Math.PI*2);}else if(k%3===1){g.save();g.translate(10,8);g.scale(1.1,1.1);g.moveTo(0,8);g.bezierCurveTo(-18,-6,-8,-20,0,-10);g.bezierCurveTo(8,-20,18,-6,0,8);g.restore();}else{g.rect(-4,-6,26,26);}g.fill();
    if(e.done){g.strokeStyle='#3E9A6A';g.lineWidth=6;g.lineCap='round';g.beginPath();g.moveTo(222,26);g.lineTo(232,38);g.lineTo(248,14);g.stroke();}
    g.restore();});
  magT.t.needsUpdate=true;
  g=topT.g;g.clearRect(0,0,330,220);g.save();g.translate(165,112);g.rotate(.05);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(-104,-68,216,140);g.fillStyle='#FFF6E0';g.fillRect(-110,-74,216,140);
  g.fillStyle='#3A3448';g.font=font(30);g.textAlign='center';g.textBaseline='middle';g.fillText('私房菜谱',-2,-30);g.font=font(24);g.fillStyle='#6C6A80';g.fillText(`${S.recipes.length} 道`,-2,16);
  g.fillStyle='#E8577A';g.beginPath();g.arc(-2,-74,14,0,Math.PI*2);g.fill();g.restore();topT.t.needsUpdate=true;
}

/* ---------- calendar (left wall) ---------- */
const cal=new THREE.Group();cal.position.set(-HW+.05,3.15,-3.7);cal.rotation.y=Math.PI/2;scene.add(cal);
const calT=ctex(500,620);
const glowMat=new THREE.MeshBasicMaterial({color:'#FFD27A',transparent:true,opacity:0,depthWrite:false});plane(1.5,1.82,glowMat,0,0,-.005,cal);
const calFace=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.55,.03),frontFace(calT.t,'#ddd'));calFace.castShadow=true;cal.add(calFace);
cyl(.025,.025,.04,M('#555'),0,.82,.02,cal);
makeHot(cal,{kind:'cal',label:()=>{const e=A.eventsOn(A.T());return e.length?`挂历 · 今天：${e[0].title}`:'挂历';}});
async function drawCal(){
  const n=A.daysTogether(),d=new Date(),y=d.getFullYear(),mo=d.getMonth(),up=A.upcoming(2).find(e=>e.left>0)||null;
  await A.ensureFonts('月在一起第天下一件后'+(up?up.title:''));
  const g=calT.g;g.fillStyle='#FFFDF8';g.fillRect(0,0,500,620);
  g.fillStyle='#D9456B';g.fillRect(0,0,500,120);for(let k=0;k<7;k++){g.fillStyle='#444';g.beginPath();g.arc(45+k*68,10,7,0,Math.PI*2);g.fill();}
  g.fillStyle='#fff';g.textAlign='left';g.textBaseline='middle';g.font=font(64);g.fillText(`${mo+1}月`,30,70);
  g.textAlign='right';g.font=font(28);g.fillText('在一起第',470,46);g.font=font(44);g.fillText(`${n} 天`,470,90);
  const first=new Date(y,mo,1).getDay(),days=new Date(y,mo+1,0).getDate(),cw=62,x0=33,y0=176;
  g.textAlign='center';g.font=font(22);g.fillStyle='#9A98AE';'日一二三四五六'.split('').forEach((c,k)=>g.fillText(c,x0+k*cw+cw/2,148));
  for(let dd=1;dd<=days;dd++){const idx=first+dd-1,cx=x0+(idx%7)*cw+cw/2,cy=y0+Math.floor(idx/7)*58+20,s=`${y}-${String(mo+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`,ev=A.eventsOn(s),isT=dd===d.getDate();
    if(isT&&ev.length){const gr=g.createRadialGradient(cx,cy,4,cx,cy,34);gr.addColorStop(0,'rgba(255,214,110,1)');gr.addColorStop(1,'rgba(255,214,110,0)');g.fillStyle=gr;g.fillRect(cx-34,cy-34,68,68);}
    if(isT){g.strokeStyle='#D9456B';g.lineWidth=4;g.beginPath();g.arc(cx,cy,22,0,Math.PI*2);g.stroke();}
    g.fillStyle=(idx%7===0||idx%7===6)?'#D9456B':'#3A3448';g.font=font(26);g.fillText(dd,cx,cy);
    ev.slice(0,3).forEach((e,k)=>{g.fillStyle=e.kind==='anniv'?'#D9456B':'#2F7BC0';g.beginPath();g.arc(cx-(ev.length-1)*6+k*12,cy+22,4.5,0,Math.PI*2);g.fill();});}
  if(up){g.fillStyle='#F2F0F8';g.fillRect(24,548,452,52);g.fillStyle='#3A3448';g.font=font(24);g.textAlign='center';let s=`${up.left} 天后：${up.title}`;if(g.measureText(s).width>430)s=s.slice(0,18)+'…';g.fillText(s,250,575);}
  calT.t.needsUpdate=true;
}

/* ---------- two windows (left wall) ---------- */
const WINZ=[-1.55,1.05],frameMat=M('#FFFFFF');
const wins=[0,1].map(w=>{
  const g=new THREE.Group();g.position.set(-HW+.05,3.3,WINZ[w]);g.rotation.y=Math.PI/2;scene.add(g);
  const sky=ctex(512,400);plane(1.8,1.4,new THREE.MeshBasicMaterial({map:sky.t}),0,0,.01,g);
  box(2,.1,.1,frameMat,0,.75,.04,g);box(2,.14,.2,frameMat,0,-.76,.08,g);box(.1,1.6,.1,frameMat,-.95,0,.04,g);box(.1,1.6,.1,frameMat,.95,0,.04,g);box(.05,1.4,.05,frameMat,0,0,.04,g);box(1.8,.05,.05,frameMat,0,.12,.04,g);
  const cm=M(w?'#C9DDF2':'#F3C6CF');[-1.15,1.15].forEach(x=>box(.32,1.95,.1,cm,x,-.05,.12,g).castShadow=false);
  const pl=ctex(400,100);const plq=plane(1.0,.25,M('#fff',{map:pl.t,roughness:.7}),0,-1.02,.02,g);
  makeHot(g,{kind:'window',label:()=>{const c=S.cities[w];return `${S.names[w]}那边 · ${c.name} ${A.tzParts(c.tz).str} · ${A.wName(c.weather)}`;}});
  const R=[];for(let k=0;k<90;k++)R.push([Math.random(),Math.random(),.5+Math.random()]);
  return {g,sky,pl,R,w};
});
const SKY={dawn:['#F7B9A8','#FBE3C8'],day:['#6FBDEB','#CFEAFA'],dusk:['#4E4C8E','#F19A79'],night:['#0E1236','#2A2F68']};
function mix(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const c=[16,8,0].map(s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t));return `rgb(${c.join(',')})`;}
function drawSky(win,time){
  const c=S.cities[win.w],ph=A.cityPhase(win.w),wx=c.weather,g=win.sky.g,w=512,h=400;let [top,bot]=SKY[ph];
  const grey=wx==='rain'?.55:wx==='cloudy'?.35:wx==='snow'?.3:0;if(grey){top=mix(top,'#8C93A6',grey);bot=mix(bot,'#B8BDC9',grey);}
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,top);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(0,0,w,h);
  if(ph==='night'&&wx!=='rain'){for(let i=0;i<60;i++){g.fillStyle=`rgba(255,255,255,${.3+win.R[i][2]*.4})`;g.fillRect(win.R[i][0]*w,win.R[i][1]*h*.7,2,2);}}
  if(ph==='night'){if(wx==='sunny'){g.fillStyle='#FFF6D6';g.beginPath();g.arc(380,90,34,0,Math.PI*2);g.fill();g.fillStyle=top;g.beginPath();g.arc(396,80,30,0,Math.PI*2);g.fill();}}
  else if(wx==='sunny'||wx==='cloudy'){const sy={dawn:300,day:90,dusk:290}[ph];g.fillStyle=ph==='day'?'#FFF2B0':'#FFD08A';g.globalAlpha=wx==='cloudy'?.5:1;g.beginPath();g.arc(150,sy,40,0,Math.PI*2);g.fill();g.globalAlpha=1;}
  const cloud=(x,y,s,col)=>{g.fillStyle=col;[[0,0,26],[30,-10,32],[64,0,24],[30,8,26]].forEach(([dx,dy,r])=>{g.beginPath();g.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);g.fill();});};
  const drift=(time*6)%600;
  if(wx==='sunny'){cloud((300+drift)%600-80,120,1,'rgba(255,255,255,.85)');}
  else{const cc=ph==='night'?'rgba(120,125,150,.85)':wx==='cloudy'?'rgba(245,246,250,.92)':'rgba(170,176,192,.95)';[[60,70,1.3],[260,50,1.5],[420,90,1.2],[160,120,1.1]].forEach(([x,y,s])=>cloud((x+drift)%620-60,y,s,cc));}
  const city=ph==='night'?'#151838':ph==='dusk'?'#3A3466':mix('#7A9CC4','#8C93A6',grey);
  [[0,300,70,100],[60,262,60,138],[130,322,90,78],[230,242,50,158],[290,292,80,108],[380,252,60,148],[450,302,62,98]].forEach(([x,y,ww,hh],b)=>{g.fillStyle=city;g.fillRect(x,y,ww,hh);
    if(ph==='night'||ph==='dusk'){g.fillStyle='#FFD98E';for(let yy=y+10;yy<h;yy+=22)for(let xx=x+8;xx<x+ww-8;xx+=16)if(((xx*7+yy*13+b)%5)<2)g.fillRect(xx,yy,6,9);}});
  if(wx==='rain'){g.strokeStyle='rgba(220,230,255,.6)';g.lineWidth=2;for(const [rx,ry,sp] of win.R){const x=(rx*w+time*60)%w,y=(ry*h+time*520*sp)%h;g.beginPath();g.moveTo(x,y);g.lineTo(x-6,y+18);g.stroke();}}
  if(wx==='snow'){g.fillStyle='rgba(255,255,255,.95)';for(const [rx,ry,sp] of win.R){const x=(rx*w+Math.sin(time+ry*9)*14+w)%w,y=(ry*h+time*50*sp)%h;g.beginPath();g.arc(x,y,2+sp*1.6,0,Math.PI*2);g.fill();}}
  win.sky.t.needsUpdate=true;
}
async function drawPlaque(win){
  const c=S.cities[win.w],t=A.tzParts(c.tz);await A.ensureFonts(S.names[win.w]+c.name+A.wName(c.weather)+'那边');
  const g=win.pl.g;g.fillStyle='#FFFDF8';g.fillRect(0,0,400,100);g.fillStyle=win.w?'#2F7BC0':'#D9831F';g.fillRect(0,0,10,100);
  g.fillStyle='#3A3448';g.textBaseline='middle';g.textAlign='left';g.font=font(34);g.fillText(`${S.names[win.w]} · ${c.name}`,28,36);
  g.font='600 28px ui-monospace,Menlo,monospace';g.fillStyle='#6C6A80';g.fillText(t.str,28,76);g.font=font(26);g.fillText(A.wName(c.weather),130,76);
  g.textAlign='right';g.fillStyle=A.online(win.w)?'#3E9A6A':'#9A98AE';g.beginPath();g.arc(372,36,9,0,Math.PI*2);g.fill();g.font=font(22);g.fillText(A.online(win.w)?'在线':'不在',356,76);
  win.pl.t.needsUpdate=true;
}

/* ---------- sofa + plushies ---------- */
const sofa=new THREE.Group();sofa.position.set(-4.25,0,-.25);scene.add(sofa);
const fab=M('#2F6F68'),fab2=M('#3B827A');
box(1.15,.5,2.8,fab,.05,.35,0,sofa);box(.35,1.05,2.8,fab,-.45,.62,0,sofa);box(1.15,.75,.3,fab2,.05,.45,-1.4,sofa);box(1.15,.75,.3,fab2,.05,.45,1.4,sofa);
box(.9,.16,1.2,fab2,.15,.68,-.62,sofa);box(.9,.16,1.2,fab2,.15,.68,.62,sofa);
[[-.45,-1.25],[.5,-1.25],[-.45,1.25],[.5,1.25]].forEach(([x,z])=>cyl(.04,.03,.12,M('#3A2B22'),x,.05,z,sofa,8));
const pillow=box(.18,.42,.55,M('#F3C6CF'),-.18,1.02,-1.0,sofa);pillow.rotation.x=.15;
const throwB=box(.6,.04,.7,M('#F4A259'),.1,.79,.95,sofa);throwB.rotation.z=-.05;
function plush(color,isBunny,z,w){
  const p=new THREE.Group();p.position.set(-.05,.76,z);sofa.add(p);const m=M(color,{roughness:1});
  sph(.24,m,0,.2,0,p).scale.set(1,.9,1);sph(.21,m,0,.56,0,p);
  if(isBunny){[-.07,.07].forEach(dz=>{const e=sph(.06,m,0,.82,dz,p);e.scale.set(.8,2.6,.8);});}else{[-.15,.15].forEach(dz=>sph(.075,m,0,.72,dz,p));}
  sph(.08,M('#FFF3EA',{roughness:1}),.18,.18,0,p).scale.set(.6,1,1);
  const ft=ctex(200,200);const face=plane(.34,.34,new THREE.MeshBasicMaterial({map:ft.t,transparent:true,depthWrite:false}),.235,.55,0,p);face.rotation.y=Math.PI/2;
  const tag=ctex(160,60);const tg=plane(.3,.11,new THREE.MeshBasicMaterial({map:tag.t,transparent:true}),.25,.02,0,p);tg.rotation.y=Math.PI/2;
  p.userData.bounce=0;makeHot(p,{kind:'plush',i:w,label:()=>w===S.me?`我的心情：${A.MOODS.find(x=>x[0]===S.moods[w])[1]}（点它换）`:`戳戳${S.names[w]}`});
  return {p,ft,tag,w};
}
const plushes=[plush('#F2A24A',false,-.62,0),plush('#7DB4E8',true,.55,1)];
plushes[0].p.rotation.y=.25;plushes[1].p.rotation.y=-.25;
async function drawPlush(pl){
  drawFace(pl.ft.g,S.moods[pl.w],200);pl.ft.t.needsUpdate=true;
  await A.ensureFonts(S.names[pl.w]);const g=pl.tag.g;g.clearRect(0,0,160,60);g.fillStyle='#FFFDF8';g.beginPath();g.moveTo(14,0);g.lineTo(146,0);g.quadraticCurveTo(160,0,160,14);g.lineTo(160,46);g.quadraticCurveTo(160,60,146,60);g.lineTo(14,60);g.quadraticCurveTo(0,60,0,46);g.lineTo(0,14);g.quadraticCurveTo(0,0,14,0);g.fill();
  g.fillStyle=pl.w?'#2F7BC0':'#B5651A';g.font=font(34);g.textAlign='center';g.textBaseline='middle';g.fillText(S.names[pl.w],80,32);pl.tag.t.needsUpdate=true;
}
function drawFace(g,mood,s){A.drawFace(g,mood,s,null);}

/* ---------- floor lamp for person 1 ---------- */
function floorLamp(){
  const L=new THREE.Group();L.position.set(-4.45,0,1.75);scene.add(L);const met=M('#5E9BD6',{roughness:.4,metalness:.2});
  cyl(.22,.24,.05,met,0,.025,0,L);cyl(.025,.025,2.0,met,0,1.03,0,L);
  const sh=cyl(.2,.32,.38,new THREE.MeshStandardMaterial({color:'#9FC8EE',side:THREE.DoubleSide,roughness:.6,emissive:'#FFD9A0',emissiveIntensity:0}),0,2.08,0,L,28,true);
  const bm=new THREE.MeshStandardMaterial({color:'#FFF6DA',emissive:'#FFD27A',emissiveIntensity:1});const bulb=sph(.07,bm,0,1.98,0,L);bulb.castShadow=false;
  const light=new THREE.PointLight('#FFC879',1,7,1.5);light.position.set(0,1.85,0);L.add(light);
  makeHot(L,{kind:'lamp',i:1,label:()=>`${S.names[1]}的灯 · ${A.online(1)?'在线':'不在'}`});return {bm,light,shade:sh.material};
}
lamps.push(floorLamp());

/* ---------- side table + letter box ---------- */
const lt=new THREE.Group();lt.position.set(-4.4,0,2.65);scene.add(lt);
cyl(.38,.38,.05,M('#E7D3B8'),0,.64,0,lt,36);cyl(.04,.04,.6,M('#CDB394'),0,.33,0,lt,10);cyl(.22,.24,.04,M('#CDB394'),0,.02,0,lt,24);
const lbox=new THREE.Group();lbox.position.set(0,.665,0);lbox.rotation.y=.3;lt.add(lbox);
const bw=M('#C98B5A');box(.5,.02,.34,bw,0,.01,0,lbox);box(.5,.2,.02,bw,0,.1,.16,lbox);box(.5,.2,.02,bw,0,.1,-.16,lbox);box(.02,.2,.34,bw,.24,.1,0,lbox);box(.02,.2,.34,bw,-.24,.1,0,lbox);
const heartT=ctex(64,64);heartT.g.fillStyle='#E8577A';heartT.g.translate(32,34);heartT.g.scale(1.6,1.6);heartT.g.beginPath();heartT.g.moveTo(0,8);heartT.g.bezierCurveTo(-18,-6,-8,-20,0,-10);heartT.g.bezierCurveTo(8,-20,18,-6,0,8);heartT.g.fill();
const ht=plane(.09,.09,new THREE.MeshBasicMaterial({map:heartT.t,transparent:true}),0,.11,.171,lbox);
const envG=new THREE.Group();lbox.add(envG);
const envTex=(()=>{const t=ctex(256,170),g=t.g;g.fillStyle='#FFF7E3';g.fillRect(0,0,256,170);g.strokeStyle='#D8C7A2';g.lineWidth=3;g.beginPath();g.moveTo(0,0);g.lineTo(128,90);g.lineTo(256,0);g.stroke();g.fillStyle='#D9456B';g.beginPath();g.arc(128,92,16,0,Math.PI*2);g.fill();return t.t;})();
const envMat=new THREE.MeshStandardMaterial({map:envTex,side:THREE.DoubleSide,roughness:.8});
function buildEnvelopes(){
  dropMeshes(envG);envG.children.slice().forEach(c=>envG.remove(c));
  const k=Math.min(3,S.letters.filter(l=>l.to===S.me&&!l.opened).length);
  box(.44,.03,.28,M('#F6EEDC'),0,.04,0,envG);box(.44,.03,.28,M('#EFE4CC'),.01,.07,.01,envG);
  for(let j=0;j<k;j++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.4,.27),envMat);m.position.set(-.08+j*.08,.2+j*.025,-.06+j*.06);m.rotation.set(-.15,0,(j-1)*.18);m.castShadow=true;envG.add(m);}
  adopt(envG,lbox);
}
makeHot(lbox,{kind:'letters',label:()=>{const k=S.letters.filter(l=>l.to===S.me&&!l.opened).length;return k?`信封盒 · ${k} 封没拆`:'信封盒';}});

/* ---------- plant ---------- */
const plantG=new THREE.Group();plantG.position.set(-4.2,0,3.85);scene.add(plantG);
cyl(.32,.24,.55,M('#F2EEE6'),0,.275,0,plantG);cyl(.33,.33,.06,M('#3F7D6E'),0,.48,0,plantG);cyl(.29,.29,.02,M('#5A3E2B'),0,.53,0,plantG);
const leaves=new THREE.Group();plantG.add(leaves);
makeHot(plantG,{kind:'plant',label:()=>{const p=A.plant();return `小树 Lv.${p.level}${p.wilted?' · 有点蔫':p.meToday?'':' · 今天还没浇水'}`;}});
function buildPlant(){
  dropMeshes(leaves);leaves.children.slice().forEach(c=>leaves.remove(c));
  const p=A.plant(),lv=p.level,h=.5+lv*.32,wil=p.wilted;
  cyl(.03,.04,h,M(wil?'#8A7A4A':'#5C7A3A'),0,.53+h/2,0,leaves);
  const greens=wil?['#B9A15A','#A88F4E','#C9B26A']:['#4E9A63','#6DB57A','#3E8556'];
  const n=3+lv*3;for(let k=0;k<n;k++){const t=k/n,a=k*2.4,r=.12+t*.25+(lv>3?.1:0);
    const l=sph(.17+lv*.012,M(greens[k%3]),Math.cos(a)*r,.6+t*h+.1-(wil?.12*t:0),Math.sin(a)*r,leaves);l.scale.set(1,.45,.6);l.rotation.set(wil?1.1:.3+((k*37)%10)/10,a,wil?1.2:.6);}
  if(lv>=4&&!wil)[0,1,2].forEach(k=>{const f=sph(.06,M('#FF8FAA',{emissive:'#FF8FAA',emissiveIntensity:.15}),Math.cos(k*2.1)*.25,.62+h*.7+k*.12,Math.sin(k*2.1)*.25,leaves);f.castShadow=false;});
  adopt(leaves,plantG);
}
const drops=[];
function water(){if(reduce)return;for(let k=0;k<10;k++){const d=sph(.035,new THREE.MeshStandardMaterial({color:'#8FD0F2',transparent:true,opacity:.9}),plantG.position.x+(Math.random()-.5)*.5,2.6+Math.random()*.8,plantG.position.z+(Math.random()-.5)*.5);d.castShadow=false;drops.push({m:d,v:0});}plantG.userData.bounce=1;}

/* ---------- lights ---------- */
const hemi=new THREE.HemisphereLight('#ffffff','#C9A88A',.7);scene.add(hemi);
const amb=new THREE.AmbientLight('#ffffff',.15);scene.add(amb);
const sun=new THREE.DirectionalLight('#FFF4E0',1);sun.position.set(7,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});sun.shadow.bias=-.0006;sun.shadow.radius=4;scene.add(sun);
const winLights=WINZ.map(z=>{const l=new THREE.SpotLight('#FFF1D6',.7,12,.7,.6,1);l.position.set(-6.5,4.4,z);l.target.position.set(0,0,z);scene.add(l);scene.add(l.target);return l;});
const PH={
  dawn:{bg:'linear-gradient(180deg,#F7C9BE,#F3E3D8)',hemi:['#FFE1D2',.55],sun:['#FFC4A0',.7],amb:.12,fairy:.6,lamp:.7},
  day:{bg:'linear-gradient(180deg,#CFE2F6,#EEF0F7)',hemi:['#FFFFFF',.72],sun:['#FFF4E0',1],amb:.15,fairy:.35,lamp:.45},
  dusk:{bg:'linear-gradient(180deg,#5C578F,#F1A988)',hemi:['#FFC7A6',.45],sun:['#FFA36C',.65],amb:.1,fairy:1.2,lamp:1.1},
  night:{bg:'linear-gradient(180deg,#0F1230,#2B2D5C)',hemi:['#6E77C2',.2],sun:['#7F8BD8',.12],amb:.06,fairy:2.2,lamp:1.8}};
const WINI={dawn:.6,day:.85,dusk:.5,night:.12};
function applyLight(){
  const ph=A.phase(),p=PH[ph];stage.style.background=p.bg;
  hemi.color.set(p.hemi[0]);hemi.intensity=p.hemi[1];sun.color.set(p.sun[0]);sun.intensity=p.sun[1];amb.intensity=p.amb;
  bulbs.forEach(b=>b.material.emissiveIntensity=p.fairy);
  winLights.forEach((l,w)=>{const cp=A.cityPhase(w),wx=S.cities[w].weather;l.intensity=WINI[cp]*(wx==='sunny'?1:.6);l.color.set(cp==='night'?'#8C9BE8':cp==='day'?'#FFF6E4':'#FFB98A');});
  lamps.forEach((L,w)=>{const on=A.online(w);L.light.intensity=on?p.lamp:0;L.bm.emissiveIntensity=on?1.4:0;L.bm.color.set(on?'#FFF6DA':'#CFCFCF');if(L.shade)L.shade.emissiveIntensity=on?.5:0;});
}

/* ---------- interaction ---------- */
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let hover=null,downAt=null;
const label=m=>typeof m.label==='function'?m.label():m.label;
function pick(e){const r=renderer.domElement.getBoundingClientRect();ptr.x=(e.clientX-r.left)/r.width*2-1;ptr.y=-(e.clientY-r.top)/r.height*2+1;
  ray.setFromCamera(ptr,camera);const hit=ray.intersectObjects(hot,false).find(h=>h.object.userData.owner&&h.object.visible);return hit?hit.object.userData.owner:null;}
const cv=renderer.domElement;
cv.addEventListener('pointermove',e=>{if(firstPerson&&!firstPerson.allowsOverviewInput()){hover=null;downAt=null;A.tip(null);return;}if(downAt&&e.buttons){A.tip(null);return;}const o=e.pointerType==='mouse'?pick(e):null;hover=o;cv.style.cursor=o?'pointer':'grab';o?A.tip(label(o.userData.meta),e.clientX,e.clientY):A.tip(null);});
cv.addEventListener('pointerleave',()=>{hover=null;A.tip(null);});
cv.addEventListener('pointerdown',e=>{if(firstPerson&&!firstPerson.allowsOverviewInput())return;downAt=[e.clientX,e.clientY];});
cv.addEventListener('pointerup',e=>{if(firstPerson&&!firstPerson.allowsOverviewInput()){downAt=null;return;}if(!downAt)return;const mv=Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1]);downAt=null;if(mv>6)return;const o=pick(e);if(!o)return;const m=o.userData.meta;A.act(m.kind,m.i);});

/* speech bubble over a plush */
const bubble=document.createElement('div');bubble.className='bubble';bubble.setAttribute('aria-live','polite');document.body.appendChild(bubble);let bubbleFor=null,bubbleT=0;
function poke(w,line){const c=firstPerson&&firstPerson.getCharacter(w);if(c){c.play('jump');if(w===S.me&&firstPerson.getView()==='fp')return;bubbleFor={p:c.group,height:c.info.height+.25};}else{const pl=plushes[w];pl.p.userData.bounce=1;bubbleFor=pl;}bubble.textContent=`${S.names[w]}：${line||A.pokeLine(w)}`;bubbleT=2.4;bubble.classList.add('on');}
const tmpV=new THREE.Vector3();

/* ---------- sizing + loop ---------- */
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);cv.style.width=w+'px';cv.style.height=h+'px';
  if(firstPerson)firstPerson.resize(w,h);else{camera.aspect=w/h;camera.fov=w/h<.8?60:36;controls.maxDistance=w/h<.8?30:26;camera.updateProjectionMatrix();}}
window.addEventListener('resize',resize);resize();
// Native rotation/IME relayout can settle after the window resize event.
// Size from the actual stage so no old portrait-width canvas remains visible.
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);
if(stage.clientWidth/stage.clientHeight<.8)camera.position.set(15.5,12,15.5);
const clock=new THREE.Clock();let skyAcc=0;
function loop(){
  const frame=clock.getDelta(),dt=Math.min(frame,.05),t=clock.elapsedTime;if(firstPerson)firstPerson.update(Math.min(frame,.1));else controls.update();
  for(let k=anims.length-1;k>=0;k--){const a=anims[k];a.t+=dt;const p=Math.min(1,a.t/a.dur);a.f(p);if(p>=1){anims.splice(k,1);a.done&&a.done();}}
  owners.forEach(o=>{const u=o.userData;
    if(u.mode==='pull'){const tz=u.basePos.z+(o===hover?.07:0)+(bookMeshes[pulled]===o?.3:0);o.position.z+=(tz-o.position.z)*Math.min(1,dt*10);}
    else{const target=o===hover?1.045:1;const b=u.baseScale,s=o.scale.x/b.x,n=s+(target-s)*Math.min(1,dt*12);o.scale.set(b.x*n,b.y*n,b.z*n);}
    if(u.targetRot!==undefined)o.rotation.z+=(u.targetRot-o.rotation.z)*Math.min(1,dt*(reduce?60:5));});
  plushes.forEach(pl=>{const u=pl.p.userData;if(u.bounce>0){u.bounce=Math.max(0,u.bounce-dt*1.5);pl.p.position.y=.76+Math.abs(Math.sin(u.bounce*Math.PI*3))*.28*u.bounce;}});
  if(plantG.userData.bounce>0){plantG.userData.bounce=Math.max(0,plantG.userData.bounce-dt*1.2);const b=plantG.userData.bounce;leaves.scale.set(1+Math.sin(b*12)*.06*b,1-Math.sin(b*12)*.06*b,1+Math.sin(b*12)*.06*b);}
  for(let k=drops.length-1;k>=0;k--){const d=drops[k];d.v+=dt*9;d.m.position.y-=d.v*dt;if(d.m.position.y<1.0){scene.remove(d.m);drops.splice(k,1);}}
  if(bubbleFor){bubbleT-=dt;bubbleFor.p.getWorldPosition(tmpV);tmpV.y+=bubbleFor.height||1.05;tmpV.project(camera);const r=cv.getBoundingClientRect();
    bubble.style.left=(r.left+(tmpV.x+1)/2*r.width)+'px';bubble.style.top=(r.top+(1-tmpV.y)/2*r.height)+'px';if(bubbleT<=0){bubble.classList.remove('on');bubbleFor=null;}}
  const playing=!!S.playing;
  if(playing&&!reduce)vinyl.rotation.y-=dt*3.4;
  arm.rotation.y+=((playing?-.55:.12)-arm.rotation.y)*Math.min(1,dt*3);
  if(playing&&!reduce){noteTimer-=dt;if(noteTimer<=0){noteTimer=.7;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:noteTex,color:['#E8577A','#F4A259','#5B9BD5'][Math.floor(t*10)%3],transparent:true}));
    rp.getWorldPosition(tmpV);s.position.set(tmpV.x-.1+(Math.random()-.5)*.3,tmpV.y+.35,tmpV.z+.1);s.scale.setScalar(.22);scene.add(s);notesFx.push({s,life:2.2,dx:(Math.random()-.5)*.3});}}
  for(let k=notesFx.length-1;k>=0;k--){const n=notesFx[k];n.life-=dt;n.s.position.y+=dt*.45;n.s.position.x+=n.dx*dt;n.s.material.opacity=Math.min(1,n.life);if(n.life<=0){scene.remove(n.s);n.s.material.dispose();notesFx.splice(k,1);}}
  const todayEv=A.eventsOn(A.T()).length>0;glowMat.opacity=todayEv?(reduce?.5:.35+.3*Math.sin(t*3)):0;
  if(!reduce){bulbs.forEach((b,k)=>b.scale.setScalar(1+Math.sin(t*2+k)*.12));leaves.rotation.y=Math.sin(t*.6)*.05;}
  skyAcc+=dt;if(skyAcc>.09){skyAcc=0;wins.forEach(wn=>{const wx=S.cities[wn.w].weather;if(!reduce&&(wx==='rain'||wx==='snow'||wx==='cloudy'||wx==='sunny'))drawSky(wn,t);});}
  renderer.render(scene,camera);requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
function drawAllPhotos(){slots.forEach(drawSlot);}
drawAllPhotos();buildBooks();drawBoard();buildNotes();buildBin();drawFridge();drawCal();wins.forEach(w=>{drawSky(w,0);drawPlaque(w);});plushes.forEach(drawPlush);buildEnvelopes();buildPlant();applyLight();
plushes.forEach(pl=>{pl.p.visible=false;unHot(pl.p);});
shelf.userData.meta={kind:'books',i:0,label:()=>`书架 · ${S.books.length?S.books.length+' 本回忆':'放一本回忆'}`};adopt(shelf,shelf);
controls.update();
firstPerson=FirstPersonController.create({THREE,world:FPWorld,App:A,scene,camera,renderer,orbit:controls,FPUI,CoupleChars,hot,
  registerCharacter(group,w){group.userData.meta={kind:'plush',i:w,label:()=>`${S.names[w]} · ${(A.MOODS.find(m=>m[0]===S.moods[w])||['',''])[1]}`};adopt(group,group);},
  unregisterCharacter:dropMeshes,onPoke:poke,onViewChange(){hover=null;downAt=null;A.tip(null);}});
A.firstPerson=firstPerson;resize();loop();
const ev=A.eventsOn(A.T());if(ev.length)setTimeout(()=>A.toast(`今天：${ev[0].title}`),1200);
A.on((k,x)=>{
  switch(k){
    case 'photos':drawAllPhotos();break;
    case 'todos':buildNotes();buildBin();break;
    case 'todo-done':crumple(x);break;
    case 'calendar':drawCal();break;
    case 'letters':buildEnvelopes();break;
    case 'fridge':drawFridge();break;
    case 'books':buildBooks();break;
    case 'book-pull':pulled=x;break;
    case 'book-back':pulled=-1;break;
    case 'music':break;
    case 'plant':buildPlant();if(x==='water')water();break;
    case 'mood':plushes.forEach(drawPlush);break;
    case 'poke':break; // FirstPersonController animates the character and speech bubble.
    case 'cities':wins.forEach(w=>{drawSky(w,clock.elapsedTime);drawPlaque(w);});applyLight();break;
    case 'time':applyLight();drawCal();drawBoard();wins.forEach(w=>{drawSky(w,clock.elapsedTime);drawPlaque(w);});break;
    case 'who':drawAllPhotos();buildEnvelopes();buildPlant();applyLight();wins.forEach(drawPlaque);break;
    case 'names':drawBoard();buildNotes();plushes.forEach(drawPlush);wins.forEach(drawPlaque);break;
    case 'presence':applyLight();wins.forEach(drawPlaque);break;
    case 'all':drawAllPhotos();buildBooks();drawBoard();buildNotes();buildBin();drawFridge();drawCal();wins.forEach(w=>{drawSky(w,clock.elapsedTime);drawPlaque(w);});plushes.forEach(drawPlush);buildEnvelopes();buildPlant();applyLight();break;
  }
});
}).catch(e=>console.error(e));
