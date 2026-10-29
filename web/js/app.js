(function(){
'use strict';
const KEY='couple-room-v2',DAY=864e5;
const CFG=window.ROOM_CONFIG||{};
const ACCTS=(CFG.accounts&&CFG.accounts.length>=2)?CFG.accounts:[{name:'唐小轩'},{name:'宛如'}];
const NAMES=ACCTS.map(a=>a.name);
const LIVE=!!(window.Sync&&Sync.live);
const pad=n=>String(n).padStart(2,'0');
const ds=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const today=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const T=()=>ds(today());
const fmt=d=>`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
const fmtS=s=>{const d=parseD(s);return `${d.getMonth()+1}月${d.getDate()}日`;};
let _id=Date.now();const uid=()=>(++_id).toString(36)+Math.random().toString(36).slice(2,5);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl=s=>esc(s).replace(/\n/g,'<br>');

/* ---------------- sample data ---------------- */
function sample(){
  const t=today(),now=Date.now(),checkins={};
  for(let k=1;k<=16;k++) checkins[ds(addDays(t,-k))]=k===5?[0]:k===9?[1]:[0,1];
  checkins[ds(t)]=[1];
  return {v:2,names:[...NAMES],me:0,start:'2024-05-20',
    cities:[{name:'上海',tz:'Asia/Shanghai',weather:'sunny'},{name:'伦敦',tz:'Europe/London',weather:'rain'}],
    photos:[
      {id:uid(),title:'第一次约会',date:'2024-05-20',note:'紧张到把菜单拿反了，你假装没看见。',by:0,crooked:false,g:0},
      {id:uid(),title:'海边那天',date:'2024-08-11',note:'晒伤了，但很值。回去的路上你睡着了。',by:1,crooked:false,g:1},
      {id:uid(),title:'一起包饺子',date:'2025-01-28',note:'形状各异，味道还行。有一个是硬币馅的，被你吃到了。',by:0,crooked:false,g:2},
      {id:uid(),title:'第一场雪',date:'2025-02-06',note:'雪地上踩了两行脚印，一行歪歪扭扭的是你。',by:1,crooked:false,g:3},
      {id:uid(),title:'猫咖',date:'2025-06-14',note:`那只橘猫只理${NAMES[1]}，${NAMES[0]}很不服气。`,by:0,crooked:false,g:4},
      {id:uid(),title:'生日蛋糕',date:'2025-10-03',note:'有一根蜡烛插歪了，许的愿是秘密。',by:1,crooked:true,g:5},
      null,null],
    events:[
      {id:uid(),date:ds(t),title:'晚上视频，一起看同一部电影',kind:'plan'},
      {id:uid(),date:ds(addDays(t,3)),title:'周末去吃那家火锅',kind:'plan'},
      {id:uid(),date:ds(addDays(t,16)),title:`${NAMES[1]}生日`,kind:'anniv'},
      {id:uid(),date:ds(addDays(t,57)),title:'见面！',kind:'plan'}],
    todos:[
      {id:uid(),from:0,to:0,text:'买牛奶和鸡蛋',done:true},
      {id:uid(),from:0,to:0,text:'订周六晚上的餐厅',done:false},
      {id:uid(),from:1,to:0,text:'今天要喝 8 杯水',done:false},
      {id:uid(),from:0,to:0,text:'偷偷挑生日礼物',done:false},
      {id:uid(),from:1,to:1,text:'修好浴室的灯',done:false},
      {id:uid(),from:1,to:1,text:'跑步 5 公里',done:true},
      {id:uid(),from:1,to:1,text:'选周末看的电影',done:false},
      {id:uid(),from:0,to:1,text:'早点睡，不许熬夜',done:false}],
    letters:[
      {id:uid(),from:1,to:0,title:'给周三的你',date:T(),opened:false,body:'听说你这周很累。\n冰箱里我留了你爱吃的布丁（假装我在冰箱里）。\n周末见面的时候，我要听你讲完所有吐槽。'},
      {id:uid(),from:0,to:1,title:'那天在海边没说的话',date:'2024-08-12',opened:true,body:'那天太阳很大，风也很大。\n我其实想说：以后每年夏天都一起去海边吧。'},
      {id:uid(),from:1,to:0,title:'考试加油',date:'2025-06-02',opened:true,body:'考完带你去吃烤肉，说到做到。'}],
    eats:[
      {id:uid(),text:'楼下新开的潮汕牛肉火锅',done:false,by:1},
      {id:uid(),text:'在家做一次寿喜烧',done:false,by:0},
      {id:uid(),text:'夜市的烤冷面',done:true,by:0},
      {id:uid(),text:`${NAMES[1]}妈妈的红烧肉`,done:false,by:1},
      {id:uid(),text:'攒钱吃一次米其林',done:false,by:0}],
    recipes:[
      {id:uid(),name:'糖糖的番茄牛腩',by:0,ing:'牛腩 500g、番茄 3 个、洋葱半个、姜、八角',steps:'牛腩焯水。\n番茄一半炒成酱，一半最后放。\n加热水小火炖 90 分钟，出锅前放剩下的番茄。'},
      {id:uid(),name:'豆豆的葱油拌面',by:1,ing:'细面、小葱一大把、生抽、老抽、糖',steps:'小葱切段小火慢炸到焦黄。\n关火倒入生抽、老抽和一点糖。\n拌上煮好的面。'}],
    books:[
      {id:uid(),title:'大理',date:'2024-10-02',place:'云南 · 大理',story:'第一次一起旅行。骑电动车环洱海，半路没电，推了两公里。',g:1,color:'#E8577A'},
      {id:uid(),title:'跨年夜',date:'2024-12-31',place:'外滩',story:'人太多什么都没看到，但倒数的时候牵着手。',g:0,color:'#3E86C9'},
      {id:uid(),title:'第一次见家长',date:'2025-04-05',place:`${NAMES[1]}家`,story:'紧张了一整晚，结果阿姨一直在夸我。',g:2,color:'#F4A259'},
      {id:uid(),title:'冬天的哈尔滨',date:'2025-02-06',place:'黑龙江 · 哈尔滨',story:'零下二十度，吃了三根冰棍。',g:3,color:'#5BAE8C'},
      {id:uid(),title:'猫咖日记',date:'2025-06-14',place:'街角的猫咖',story:'决定以后要养一只橘猫。',g:4,color:'#9B7FD1'}],
    songs:[
      {id:uid(),title:'小幸运',artist:'田馥甄',by:0,why:'第一次一起看电影的片尾曲',link:''},
      {id:uid(),title:'稳稳的幸福',artist:'陈奕迅',by:1,why:'想要的就是这种感觉',link:''},
      {id:uid(),title:'晴天',artist:'周杰伦',by:0,why:'你在 KTV 唱跑调的那首',link:''},
      {id:uid(),title:'Lover',artist:'Taylor Swift',by:1,why:'异地的时候每天睡前听',link:''}],
    playing:null,checkins,moods:['happy','miss'],lastSeen:[now,now-2*60e3]};
}
/* a fresh shared room: empty frames, two starter notes */
function blank(){
  const tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Shanghai';}catch(e){return 'Asia/Shanghai';}})();
  return {v:2,names:[...NAMES],me:0,start:T(),
    cities:[{name:'我这边',tz,weather:'sunny'},{name:'你那边',tz,weather:'sunny'}],
    photos:Array(8).fill(null),events:[],
    todos:[{id:'seed-1',from:0,to:0,text:'挂上我们的第一张照片',done:false,ord:1},{id:'seed-2',from:1,to:1,text:'写第一封信',done:false,ord:2}],
    letters:[],eats:[],recipes:[],books:[],songs:[],playing:null,checkins:{},moods:['happy','happy'],lastSeen:[0,0]};
}
let state=null;
if(LIVE) state=blank();
else{try{state=JSON.parse(localStorage.getItem(KEY));}catch(e){}if(!state||state.v!==2) state=sample();}
state.timeMode=(()=>{try{const v=localStorage.getItem('room-time-mode');return ['auto','day','dusk','night'].includes(v)?v:'auto';}catch(e){return 'auto';}})();
const me=()=>state.me,other=()=>1-state.me;

const subs=[];
const on=fn=>subs.push(fn);
const emit=(k,x)=>subs.forEach(f=>{try{f(k,x);}catch(e){console.error(e);}});
function save(){if(LIVE){Sync.push();return true;}try{const {timeMode,...rest}=state;localStorage.setItem(KEY,JSON.stringify(rest));return true;}catch(e){toast('浏览器存不下了，照片可能太大');return false;}}

/* ---------------- time, cities, presence ---------------- */
const TZS=[['Asia/Shanghai','北京时间'],['Asia/Hong_Kong','香港'],['Asia/Taipei','台北'],['Asia/Tokyo','东京'],['Asia/Seoul','首尔'],['Asia/Singapore','新加坡'],['Australia/Sydney','悉尼'],['Pacific/Auckland','奥克兰'],['Europe/London','英国'],['Europe/Paris','巴黎 / 柏林'],['America/New_York','美国东部'],['America/Chicago','美国中部'],['America/Los_Angeles','美国西部'],['America/Toronto','多伦多'],['America/Vancouver','温哥华']];
const WEATHER=[['sunny','晴'],['cloudy','多云'],['rain','下雨'],['snow','下雪']];
const wName=k=>(WEATHER.find(w=>w[0]===k)||WEATHER[0])[1];
function tzParts(tz){try{const s=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());const [h,m]=s.split(':').map(Number);return {h,m,str:pad(h)+':'+pad(m)};}
  catch(e){const d=new Date();return {h:d.getHours(),m:d.getMinutes(),str:pad(d.getHours())+':'+pad(d.getMinutes())};}}
const phaseFor=h=>h>=6&&h<8?'dawn':h>=8&&h<17?'day':h>=17&&h<19.5?'dusk':'night';
function cityPhase(w){if(w===state.me&&state.timeMode!=='auto')return state.timeMode;const p=tzParts(state.cities[w].tz);return phaseFor(p.h+p.m/60);}
const phase=()=>{if(state.timeMode!=='auto')return state.timeMode;const d=new Date();return phaseFor(d.getHours()+d.getMinutes()/60);};
const online=w=>LIVE?(w===state.me||(Sync.present&&Sync.present.has(w))||Date.now()-state.lastSeen[w]<3*60e3):Date.now()-state.lastSeen[w]<5*60e3;
function rel(ts){const m=Math.round((Date.now()-ts)/6e4);return m<1?'刚刚':m<60?`${m} 分钟前`:m<1440?`${Math.round(m/60)} 小时前`:`${Math.round(m/1440)} 天前`;}
function heartbeat(){state.lastSeen[state.me]=Date.now();save();}

/* ---------------- calendar ---------------- */
const daysTogether=()=>Math.round((today()-parseD(state.start))/DAY)+1;
function eventsOn(dstr){
  const out=state.events.filter(e=>e.date===dstr).map(e=>({...e,auto:false}));
  const s=parseD(state.start),d=parseD(dstr),n=Math.round((d-s)/DAY)+1;
  if(d.getMonth()===s.getMonth()&&d.getDate()===s.getDate()&&d.getFullYear()>s.getFullYear()) out.push({title:`在一起 ${d.getFullYear()-s.getFullYear()} 周年`,kind:'anniv',auto:true});
  if(n>0&&n%100===0) out.push({title:`在一起第 ${n} 天`,kind:'anniv',auto:true});
  return out;
}
function upcoming(n){const out=[];for(let k=0;k<400&&out.length<n;k++){const d=ds(addDays(today(),k));eventsOn(d).forEach(e=>out.push({...e,date:d,left:k}));}return out.slice(0,n);}

/* ---------------- plant ---------------- */
function plant(){
  const c=state.checkins;let both=0,last=null;
  for(const [d,a] of Object.entries(c)){if(a.includes(0)&&a.includes(1))both++;if(a.length&&(!last||d>last))last=d;}
  const idle=last?Math.round((today()-parseD(last))/DAY):99;
  let streak=0;for(let k=0;k<400;k++){const a=c[ds(addDays(today(),-k))]||[];if(a.includes(0)&&a.includes(1))streak++;else if(k>0)break;}
  const t=c[T()]||[];
  return {both,idle,wilted:idle>=3,level:Math.min(5,1+Math.floor(both/4)),streak,meToday:t.includes(state.me),otherToday:t.includes(other())};
}

/* ---------------- moods ---------------- */
const MOODS=[['happy','开心'],['miss','想你'],['sleepy','困了'],['angry','生气'],['sad','委屈'],['hungry','饿了']];
const POKE={happy:['嘿嘿','干嘛呀～','今天心情很好'],miss:['想你了','什么时候见面','抱抱'],sleepy:['zzz…','别戳，困','五分钟后叫我'],angry:['哼','不理你','……好吧，理你一下'],sad:['有点委屈','要哄','呜'],hungry:['饿饿','带我去吃火锅','冰箱里有啥']};
const pokeLine=w=>{const a=POKE[state.moods[w]]||POKE.happy;return a[Math.floor(Math.random()*a.length)];};
function drawFace(g,mood,s,bg){
  g.clearRect(0,0,s,s);if(bg){g.fillStyle=bg;g.beginPath();g.arc(s/2,s/2,s/2,0,Math.PI*2);g.fill();}
  const u=s/100,ink='#2A2230';g.lineCap='round';g.lineJoin='round';g.strokeStyle=ink;g.fillStyle=ink;g.lineWidth=4.5*u;
  const L=[34*u,46*u],R=[66*u,46*u];
  const dot=(p,r=5)=>{g.beginPath();g.arc(p[0],p[1],r*u,0,Math.PI*2);g.fill();};
  const arc=(p,up)=>{g.beginPath();g.arc(p[0],p[1]+(up?4:-4)*u,8*u,up?Math.PI*1.15:Math.PI*.15,up?Math.PI*1.85:Math.PI*.85);g.stroke();};
  const blush=()=>{g.fillStyle='rgba(255,130,160,.55)';g.beginPath();g.ellipse(22*u,62*u,9*u,5*u,0,0,Math.PI*2);g.ellipse(78*u,62*u,9*u,5*u,0,0,Math.PI*2);g.fill();g.fillStyle=ink;};
  const heart=(x,y,r,c)=>{g.save();g.translate(x,y);g.scale(r/16,r/16);g.beginPath();g.moveTo(0,6);g.bezierCurveTo(-18,-8,-8,-22,0,-12);g.bezierCurveTo(8,-22,18,-8,0,6);g.fillStyle=c;g.fill();g.restore();};
  switch(mood){
    case 'happy':arc(L,true);arc(R,true);g.beginPath();g.arc(50*u,60*u,10*u,.1*Math.PI,.9*Math.PI);g.stroke();blush();break;
    case 'miss':heart(L[0],L[1],9*u,'#E8577A');heart(R[0],R[1],9*u,'#E8577A');g.beginPath();g.arc(50*u,64*u,6*u,.15*Math.PI,.85*Math.PI);g.stroke();blush();break;
    case 'sleepy':[L,R].forEach(p=>{g.beginPath();g.moveTo(p[0]-8*u,p[1]+2*u);g.lineTo(p[0]+8*u,p[1]+2*u);g.stroke();});g.beginPath();g.arc(50*u,66*u,4*u,0,Math.PI*2);g.stroke();
      g.font=`bold ${18*u}px sans-serif`;g.fillText('z',76*u,24*u);g.font=`bold ${12*u}px sans-serif`;g.fillText('z',88*u,12*u);break;
    case 'angry':dot(L);dot(R);g.beginPath();g.moveTo(24*u,30*u);g.lineTo(42*u,37*u);g.moveTo(76*u,30*u);g.lineTo(58*u,37*u);g.stroke();g.beginPath();g.arc(50*u,72*u,9*u,1.15*Math.PI,1.85*Math.PI);g.stroke();
      g.strokeStyle='#E8577A';g.lineWidth=3*u;g.beginPath();g.moveTo(78*u,14*u);g.lineTo(86*u,22*u);g.moveTo(86*u,14*u);g.lineTo(78*u,22*u);g.stroke();break;
    case 'sad':dot(L);dot(R);g.beginPath();g.moveTo(40*u,68*u);g.quadraticCurveTo(45*u,62*u,50*u,68*u);g.quadraticCurveTo(55*u,74*u,60*u,68*u);g.stroke();
      g.fillStyle='#6FB6E8';g.beginPath();g.ellipse(R[0]+2*u,R[1]+12*u,3.5*u,6*u,0,0,Math.PI*2);g.fill();break;
    case 'hungry':dot(L);dot(R);g.beginPath();g.ellipse(50*u,66*u,9*u,8*u,0,0,Math.PI*2);g.fill();g.fillStyle='#8FD0F2';g.beginPath();g.ellipse(58*u,78*u,3*u,5*u,0,0,Math.PI*2);g.fill();blush();break;
  }
}
const faceURL=m=>{const c=document.createElement('canvas');c.width=c.height=120;drawFace(c.getContext('2d'),m,120,'#FFE3B8');return c.toDataURL();};

/* ---------------- placeholder pictures ---------------- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function genPhoto(i){
  const c=document.createElement('canvas');c.width=c.height=480;const g=c.getContext('2d');const R=rng(i*97+7);
  const lin=(y0,y1,st)=>{const gr=g.createLinearGradient(0,y0,0,y1);st.forEach((s,k)=>gr.addColorStop(k/(st.length-1),s));return gr;};
  const dot=(x,y,r,f)=>{g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=f;g.fill();};
  const ell=(x,y,rx,ry,f)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=f;g.fill();};
  const heart=(x,y,r,col)=>{g.save();g.translate(x,y);g.scale(r/16,r/16);g.beginPath();g.moveTo(0,6);g.bezierCurveTo(-18,-8,-8,-22,0,-12);g.bezierCurveTo(8,-22,18,-8,0,6);g.fillStyle=col;g.fill();g.restore();};
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  switch(i%6){
  case 0:{g.fillStyle=lin(0,400,['#2D2A5C','#86507F','#F3A27A']);g.fillRect(0,0,480,480);
    for(let k=0;k<10;k++){const w=36+R()*30,h=90+R()*150,x=k*50-12;g.fillStyle='#262145';g.fillRect(x,400-h,w,h);
      for(let wy=410-h;wy<392;wy+=16)for(let wx=x+6;wx<x+w-6;wx+=11)if(R()<.35){g.fillStyle='#FFD98E';g.fillRect(wx,wy,5,8);}}
    g.fillStyle='#3B2B40';g.fillRect(0,396,480,84);g.fillStyle='#F4E9DA';g.fillRect(0,396,480,8);
    [196,284].forEach(x=>{g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.moveTo(x-20,318);g.lineTo(x+20,318);g.lineTo(x+7,364);g.lineTo(x-7,364);g.closePath();g.fill();
      g.fillRect(x-2,364,4,28);g.fillRect(x-15,390,30,5);g.fillStyle='#C33E5E';g.beginPath();g.moveTo(x-15,334);g.lineTo(x+15,334);g.lineTo(x+7,362);g.lineTo(x-7,362);g.fill();});
    heart(240,268,26,'#FF9DB4');break;}
  case 1:{g.fillStyle=lin(0,280,['#6FBCEB','#D4EEFB']);g.fillRect(0,0,480,280);dot(360,120,46,'#FFE48C');[[90,90],[150,70],[120,100]].forEach(([x,y])=>dot(x,y,26,'#fff'));
    g.fillStyle=lin(270,390,['#2C8FC8','#176596']);g.fillRect(0,270,480,130);g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=4;
    for(let r=0;r<5;r++){g.beginPath();for(let x=0;x<=480;x+=8){const y=292+r*20+Math.sin(x/22+r)*4;x?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
    g.fillStyle='#F3D9A8';g.beginPath();g.moveTo(0,390);g.quadraticCurveTo(240,360,480,392);g.lineTo(480,480);g.lineTo(0,480);g.fill();
    [[210,'#E8912D'],[262,'#2F7BC0']].forEach(([x,col])=>{dot(x,368,13,'#3A2E2A');g.fillStyle=col;rr(x-15,382,30,58,10);g.fill();});
    g.strokeStyle='#3A2E2A';g.lineWidth=5;g.beginPath();g.moveTo(225,400);g.lineTo(247,400);g.stroke();break;}
  case 2:{g.fillStyle='#C88B57';g.fillRect(0,0,480,480);g.strokeStyle='rgba(90,50,20,.25)';g.lineWidth=3;for(let y=60;y<480;y+=80){g.beginPath();g.moveTo(0,y);g.lineTo(480,y);g.stroke();}
    dot(240,250,190,'#F5F0E8');dot(240,250,160,'#FFFFFF');
    for(let k=0;k<7;k++){const a=k/7*Math.PI*2,x=240+Math.cos(a)*100,y=250+Math.sin(a)*100;g.save();g.translate(x,y);g.rotate(a+Math.PI/2);
      g.beginPath();g.moveTo(-34,8);g.quadraticCurveTo(0,-46,34,8);g.quadraticCurveTo(0,20,-34,8);g.fillStyle='#FBF4E4';g.fill();g.strokeStyle='#D9C9A8';g.lineWidth=2;g.stroke();
      g.strokeStyle='#E2D3B2';for(let p=-2;p<=2;p++){g.beginPath();g.moveTo(p*9,-14);g.lineTo(p*7,0);g.stroke();}g.restore();}
    ell(240,250,28,18,'#FBF4E4');break;}
  case 3:{g.fillStyle=lin(0,330,['#AFC6E6','#EAF1FA']);g.fillRect(0,0,480,480);
    [[70,250,60],[140,270,44],[390,240,70],[440,280,40]].forEach(([x,y,h])=>{g.fillStyle='#2F5B57';g.beginPath();g.moveTo(x,y-h*2);g.lineTo(x+h*.7,y);g.lineTo(x-h*.7,y);g.fill();});
    g.fillStyle='#FFFFFF';g.beginPath();g.moveTo(0,300);g.quadraticCurveTo(240,250,480,300);g.lineTo(480,480);g.lineTo(0,480);g.fill();
    for(let k=0;k<12;k++){const t=k/12;[-1,1].forEach(s=>{const x=200+s*28+Math.sin(t*5)*50*(1-t)+t*40,y=470-t*170;ell(x+(k%2?6:-6),y,6*(1-t*.6),9*(1-t*.6),'#8FA9C9');});}
    for(let k=0;k<70;k++) dot(R()*480,R()*480,1+R()*3,'rgba(255,255,255,.9)');break;}
  case 4:{g.fillStyle='#F6DCC6';g.fillRect(0,0,480,480);g.fillStyle='#E9C4A6';for(let x=0;x<480;x+=40)g.fillRect(x,0,20,300);g.fillStyle='#8A5A3C';g.fillRect(0,300,480,180);
    ell(220,330,120,62,'#F09A47');dot(220,236,70,'#F09A47');
    [-1,1].forEach(s=>{g.fillStyle='#F09A47';g.beginPath();g.moveTo(220+s*62,210);g.lineTo(220+s*44,148);g.lineTo(220+s*18,180);g.fill();});
    g.strokeStyle='#3A2B22';g.lineWidth=5;g.lineCap='round';[-1,1].forEach(s=>{g.beginPath();g.arc(220+s*26,236,9,Math.PI*1.1,Math.PI*1.9);g.stroke();});
    ell(220,258,7,5,'#E25D6A');g.strokeStyle='#D9792F';g.lineWidth=8;[300,320].forEach(x=>{g.beginPath();g.moveTo(x,285);g.quadraticCurveTo(x+14,330,x-4,370);g.stroke();});
    ell(390,400,52,20,'#FFFFFF');ell(390,392,40,14,'#C08A5E');heart(390,396,9,'#FFF3E6');break;}
  default:{g.fillStyle='#FBD3DE';g.fillRect(0,0,480,480);g.strokeStyle='#C77E94';g.lineWidth=2;g.beginPath();g.moveTo(0,40);g.quadraticCurveTo(240,110,480,40);g.stroke();
    for(let k=0;k<9;k++){const x=30+k*52,y=40+Math.sin(k/8*Math.PI)*34;g.fillStyle=['#F4A259','#5B9BD5','#E8577A'][k%3];g.beginPath();g.moveTo(x-14,y);g.lineTo(x+14,y);g.lineTo(x,y+30);g.fill();}
    g.fillStyle='#F3E9F7';g.fillRect(0,400,480,80);ell(240,404,170,26,'#FFFFFF');g.fillStyle='#FFF6EC';g.fillRect(110,290,260,110);ell(240,400,130,20,'#FFF6EC');ell(240,290,130,20,'#F48CA8');
    g.fillStyle='#F48CA8';for(let x=114;x<370;x+=26){g.beginPath();g.arc(x+13,296,13,0,Math.PI);g.fill();}
    g.fillStyle='#FFF6EC';g.fillRect(150,220,180,74);ell(240,220,90,14,'#F48CA8');
    [[190,0],[240,0],[290,.35]].forEach(([x,r])=>{g.save();g.translate(x,212);g.rotate(r);g.fillStyle='#7FB5E8';g.fillRect(-5,-44,10,44);ell(0,-56,7,12,'#FFC94A');g.restore();});}
  }
  return c;
}
const gCache={};
const BLANK='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#E4E1EC"/></svg>');
const picSrc=o=>{if(!o)return '';if(o.src)return o.src;if(o.path)return BLANK;const k=o.g??0;if(!gCache[k])gCache[k]=genPhoto(k).toDataURL('image/jpeg',.88);return gCache[k];};
function readImage(file,cb){const rd=new FileReader();rd.onload=()=>{const img=new Image();img.onload=()=>{const s=Math.min(img.width,img.height),c=document.createElement('canvas');c.width=c.height=Math.min(720,s);
  c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.84));};img.src=rd.result;};rd.readAsDataURL(file);}
function ensureFonts(text){if(!document.fonts||!document.fonts.load)return Promise.resolve();const t=(text||'')+'今日待办在一起第天月';
  return Promise.all([document.fonts.load('32px "ZCOOL KuaiLe"',t),document.fonts.load('32px "Long Cang"',t)]).catch(()=>{});}

/* ---------------- HUD ---------------- */
let tipEl,toastEl,toastT,hudEl,dockEl;
const DOCK=[['photo','照片墙','var(--pa)'],['todo','待办','var(--pb)'],['cal','挂历','var(--accent)'],['letters','信封盒','#C9A15A'],['fridge','冰箱','#5BAE8C'],['books','书架','#9B7FD1'],['music','唱片机','#2A2230'],['plant','小树','#4E9A63'],['window','窗外','#6FBDEB'],['mood','我的心情','#F4A259'],['settings','设置','#9A98AE']];
function mountHud(){
  hudEl=document.createElement('div');hudEl.className='hud';document.body.appendChild(hudEl);
  dockEl=document.createElement('div');dockEl.className='dock';document.body.appendChild(dockEl);
  tipEl=document.createElement('div');tipEl.className='tip';document.body.appendChild(tipEl);
  toastEl=document.createElement('div');toastEl.className='toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);
  hudEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.classList.contains('hud-pill')){setHudOpen(!hudOpen);return;}
    if(b.dataset.go){setHudOpen(false);act(b.dataset.go,0);return;}
    if(b.dataset.me!==undefined&&+b.dataset.me!==state.me){state.me=+b.dataset.me;heartbeat();setHudOpen(true);emit('who');toast(`现在是 ${state.names[state.me]} 的视角`);}});
  hudEl.addEventListener('pointerdown',()=>{if(hudOpen)setHudOpen(true);});
  document.addEventListener('pointerdown',e=>{if(hudOpen&&!hudEl.contains(e.target))setHudOpen(false);},true);
  try{hintVisits=+(localStorage.getItem('room-hint-visits')||0)+1;localStorage.setItem('room-hint-visits',String(hintVisits));}catch(e){hintVisits=1;}
  dockEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b)act(b.dataset.go,0);});
  renderHud();on(k=>{if(['calendar','letters','who','names','all','presence','time'].includes(k))renderHud();});
}
let hudOpen=false,hudT=null,hintVisits=1;
function setHudOpen(o){hudOpen=!!o;clearTimeout(hudT);if(hudOpen)hudT=setTimeout(()=>setHudOpen(false),6000);renderHud();}
function renderHud(){
  const n=state.names,m=state.me,o=1-m,d=daysTogether(),nx=upcoming(1)[0],on=online(o),unread=state.letters.filter(l=>l.to===m&&!l.opened).length;
  const av=w=>`<span class="av${w===m?' me':''}" style="--c:var(--p${w?'b':'a'})">${esc(String(n[w]).slice(-1))}${w!==m&&online(w)?'<i></i>':''}</span>`;
  const seen=on?'在线':state.lastSeen[o]?rel(state.lastSeen[o])+'来过':'还没来过';
  hudEl.innerHTML=`<button type="button" class="hud-pill" aria-expanded="${hudOpen}" aria-label="${esc(n[0])}和${esc(n[1])}，在一起第 ${d} 天，${esc(n[o])}${on?'在线':'不在线'}。点开看详情">
      <span class="avs" aria-hidden="true">${av(0)}<span class="hheart">♥</span>${av(1)}</span><span class="dnum" aria-hidden="true"><b>${d}</b>天</span></button>
    ${hudOpen?`<div class="hud-more" role="region" aria-label="我们俩">
      <div class="hm-names"><span class="a">${esc(n[0])}</span><span class="h" aria-hidden="true">♥</span><span class="b">${esc(n[1])}</span></div>
      <p class="hm-days">在一起第 <b>${d}</b> 天 · 从 ${fmt(parseD(state.start))}</p>
      <ul>${nx?`<li><span>下一个纪念日</span><span>${nx.left===0?'就是今天':nx.left+' 天后'} · ${esc(nx.title)}</span></li>`:''}
        <li><span>${esc(n[o])}</span><span class="st${on?' on':''}"><i></i>${seen}</span></li></ul>
      <div class="hm-foot">${LIVE?`<span class="small" style="margin:0">我是 ${esc(n[m])}</span>`:`<div class="seg" role="group" aria-label="预览视角">${[0,1].map(w=>`<button type="button" data-me="${w}" aria-pressed="${m===w}">${esc(n[w])}</button>`).join('')}</div>`}<button type="button" class="link" data-go="cal">打开挂历</button></div>
    </div>`:''}`;
  dockEl.innerHTML=`<div class="hint${hintVisits>3?' gone':''}"><span>拖动旋转 · 缩放 · 点房间里的东西</span></div><div class="chips">${DOCK.map(([k,l,c])=>`<button type="button" data-go="${k}"><span class="dot" style="background:${c}"></span>${l}${k==='letters'&&unread?`<span class="badge">${unread}</span>`:''}</button>`).join('')}</div>`;
}
function tip(label,x,y){if(!tipEl)return;if(!label){tipEl.classList.remove('on');return;}tipEl.textContent=label;tipEl.style.left=x+'px';tipEl.style.top=y+'px';tipEl.classList.add('on');}
function toast(msg){if(!toastEl)return;toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),2600);}

/* ---------------- modal ---------------- */
let scrim=null,lastFocus=null,onClose=null;
function closeModal(){if(!scrim)return;scrim.remove();scrim=null;document.removeEventListener('keydown',escKey);const f=onClose;onClose=null;f&&f();if(lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true});}catch(e){}}
function escKey(e){if(e.key==='Escape')closeModal();}
function openModal(html,mount,opts={}){
  if(!scrim){lastFocus=document.activeElement;scrim=document.createElement('div');scrim.className='scrim';
    scrim.addEventListener('pointerdown',e=>{if(e.target===scrim)closeModal();});document.addEventListener('keydown',escKey);document.body.appendChild(scrim);}
  onClose=opts.onClose||null;
  scrim.innerHTML=`<div class="sheet ${opts.cls||''}" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="关闭">×</button>${html}</div>`;
  scrim.querySelector('.x').onclick=closeModal;const root=scrim.querySelector('.sheet');mount&&mount(root);
  if(!opts.keepScroll){const f=root.querySelector('[data-autofocus]')||root.querySelector('.x');f&&f.focus({preventScroll:true});}
  tip(null);return root;
}
const tabs=(list,cur)=>`<div class="tabs" role="tablist">${list.map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" aria-selected="${k===cur}">${l}</button>`).join('')}</div>`;

/* ---------------- photo wall ---------------- */
function openPhoto(i){
  i=Math.max(0,Math.min(7,i|0));const p=state.photos[i];
  if(!p){openModal(`<h2>空相框</h2><p class="sub">挂一张新照片上去。新挂的照片会先歪着，等 ${esc(state.names[other()])} 来点一下才扶正，算是"我看到了"。</p>
      <label class="btn primary" for="pv-file" tabindex="0" data-autofocus>选一张照片</label><input id="pv-file" type="file" accept="image/*" hidden>`,root=>{
      bindFile(root,src=>{state.photos[i]={id:uid(),title:'新照片',date:T(),note:'',by:state.me,crooked:true,src};save();emit('photos');toast('挂上去了，先歪着');openPhoto(i);});});return;}
  const idx=state.photos.map((x,k)=>x?k:-1).filter(k=>k>=0),pos=idx.indexOf(i);
  const canFix=p.crooked&&p.by!==state.me;
  openModal(`<h2 id="pv-h">${esc(p.title)}</h2><p class="sub">${esc(p.date)} · ${esc(state.names[p.by])} 挂上去的 · 点照片翻到背面</p>
    <div class="pv">
      <div class="flip" id="flip" role="button" tabindex="0" aria-label="翻到背面"><div class="card ${p.crooked?'tilt':''}">
        <figure class="face polaroid"><img src="${picSrc(p)}" alt="${esc(p.title)}"><figcaption id="pv-cap">${esc(p.title)}</figcaption></figure>
        <div class="face back"><p class="back-note" id="pv-back">${nl(p.note)||'（背面还空着）'}</p><p class="back-meta">${esc(p.date)} · ${esc(state.names[p.by])}</p></div>
      </div></div>
      <div class="pv-fields">
        ${p.crooked?(canFix?`<button class="btn primary" id="pv-fix" type="button">扶正（我看到了）</button>`:`<p class="status">这张还歪着，等 ${esc(state.names[other()])} 来扶正</p>`):`<p class="status ok">已经挂正了</p>`}
        <label class="field"><span>标题</span><input id="pv-title" maxlength="12" value="${esc(p.title)}"></label>
        <label class="field"><span>日期</span><input id="pv-date" type="date" value="${esc(p.date)}"></label>
        <label class="field"><span>背面写的话</span><textarea id="pv-note" rows="3" maxlength="120">${esc(p.note)}</textarea></label>
      </div>
      <div class="pv-actions">
        <button class="btn ghost" id="pv-prev" type="button">← 上一张</button>
        <label class="btn ghost" for="pv-file" tabindex="0">换一张照片</label><input id="pv-file" type="file" accept="image/*" hidden>
        <button class="btn ghost" id="pv-next" type="button" data-autofocus>下一张 →</button>
      </div></div>`,root=>{
    const flip=root.querySelector('#flip');const tg=()=>flip.classList.toggle('on');flip.onclick=tg;flip.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tg();}};
    root.querySelector('#pv-prev').onclick=()=>openPhoto(idx[(pos-1+idx.length)%idx.length]);
    root.querySelector('#pv-next').onclick=()=>openPhoto(idx[(pos+1)%idx.length]);
    const fix=root.querySelector('#pv-fix');if(fix)fix.onclick=()=>{p.crooked=false;save();emit('photos');toast(`扶正了，${state.names[p.by]} 会知道你看到了`);openPhoto(i);};
    const t=root.querySelector('#pv-title');t.oninput=()=>{p.title=t.value;root.querySelector('#pv-cap').textContent=t.value;root.querySelector('#pv-h').textContent=t.value;};t.onchange=()=>{save();emit('photos');};
    root.querySelector('#pv-date').onchange=e=>{p.date=e.target.value;save();};
    const nt=root.querySelector('#pv-note');nt.oninput=()=>{p.note=nt.value;root.querySelector('#pv-back').innerHTML=nl(nt.value)||'（背面还空着）';};nt.onchange=()=>save();
    bindFile(root,src=>{p.src=src;p.path=null;p.by=state.me;p.crooked=true;save();emit('photos');toast('换好了，先歪着挂');openPhoto(i);});
  });
}
function bindFile(root,cb){const inp=root.querySelector('#pv-file'),lab=root.querySelector('label[for="pv-file"]');
  lab.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click();}};
  inp.onchange=()=>{const f=inp.files&&inp.files[0];if(f)readImage(f,cb);};}

/* ---------------- todos ---------------- */
function openTodo(){
  const d=today(),wk='日一二三四五六'[d.getDay()],n=state.names,m=state.me;
  const col=w=>{const items=state.todos.filter(t=>t.to===w&&!t.done);
    return `<div class="td-col ${w?'b':'a'}"><h3>${esc(n[w])}<small>${items.length?`还剩 ${items.length} 件`:'全部完成'}</small></h3>
      <ul class="td-list">${items.map(t=>`<li><button class="ck" type="button" data-ck="${t.id}" aria-label="完成：${esc(t.text)}"></button><span>${esc(t.text)}${t.from!==t.to?`<em class="from">${esc(n[t.from])} 贴的</em>`:''}</span><button class="del" type="button" data-del="${t.id}" aria-label="删除">×</button></li>`).join('')||'<li class="empty">没有待办了</li>'}</ul></div>`;};
  const done=state.todos.filter(t=>t.done);
  openModal(`<h2>今日待办</h2><p class="sub">${d.getMonth()+1}月${d.getDate()}日 星期${wk} · 完成的便利贴会被揉成纸团丢进桌边的垃圾桶</p>
    <form class="td-new" id="td-new"><input id="td-in" maxlength="24" placeholder="写一件事…" aria-label="待办内容" data-autofocus>
      <select id="td-to" aria-label="贴给谁"><option value="${m}">贴给自己</option><option value="${1-m}">贴给 ${esc(n[1-m])}</option></select><button class="btn primary" type="submit">贴上去</button></form>
    <div class="td-cols">${col(0)}${col(1)}</div>
    <details class="trash"${done.length?'':' hidden'}><summary>垃圾桶里的纸团（${done.length}）</summary>
      <ul>${done.map(t=>`<li><span>${esc(n[t.to])}：${esc(t.text)}</span><button type="button" class="link" data-undo="${t.id}">捡回来</button></li>`).join('')}</ul>
      <button type="button" class="link" id="td-empty">倒掉垃圾</button></details>`,root=>{
    root.addEventListener('click',e=>{
      const ck=e.target.closest('[data-ck]'),del=e.target.closest('[data-del]'),un=e.target.closest('[data-undo]');
      if(ck){const t=state.todos.find(x=>x.id===ck.dataset.ck);t.done=true;save();closeModal();emit('todo-done',t.id);setTimeout(()=>toast(`${n[t.to]} 完成了「${t.text}」`),900);}
      if(del){state.todos=state.todos.filter(x=>x.id!==del.dataset.del);save();emit('todos');openTodo();}
      if(un){state.todos.find(x=>x.id===un.dataset.undo).done=false;save();emit('todos');openTodo();}
      if(e.target.id==='td-empty'){state.todos=state.todos.filter(x=>!x.done);save();emit('todos');openTodo();toast('垃圾倒掉了');}
    });
    root.querySelector('#td-new').addEventListener('submit',e=>{e.preventDefault();const v=root.querySelector('#td-in').value.trim();if(!v)return;const to=+root.querySelector('#td-to').value;
      state.todos.push({id:uid(),from:m,to,text:v,done:false});save();emit('todos');openTodo();if(to!==m)toast(`贴到 ${n[to]} 那边了`);});
  });
}

/* ---------------- calendar ---------------- */
let calOff=0,calSel=null;
function openCal(){
  const t=today(),base=new Date(t.getFullYear(),t.getMonth()+calOff,1),y=base.getFullYear(),mo=base.getMonth();
  const first=base.getDay(),days=new Date(y,mo+1,0).getDate();let cells='';
  for(let k=0;k<first;k++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const s=`${y}-${pad(mo+1)}-${pad(d)}`,ev=eventsOn(s),isT=s===T();
    cells+=`<button type="button" class="${isT?'today':''} ${ev.length&&isT?'glow':''} ${calSel===s?'sel':''}" data-d="${s}" aria-label="${mo+1}月${d}日${ev.length?'，有 '+ev.length+' 件事':''}">${d}${ev.length?`<i>${ev.map(e=>`<b class="${e.kind}"></b>`).join('')}</i>`:''}</button>`;}
  const sel=calSel?eventsOn(calSel):[];
  openModal(`<h2>挂历</h2><p class="sub">在一起第 ${daysTogether()} 天 · 从 ${fmt(parseD(state.start))} 开始 · 日子到了那一格会发光</p>
    <div class="cal-nav"><button type="button" class="btn ghost" id="c-prev" aria-label="上个月">‹</button><strong>${y}年${mo+1}月</strong><button type="button" class="btn ghost" id="c-next" aria-label="下个月">›</button></div>
    <div class="cal-grid"><em>日</em><em>一</em><em>二</em><em>三</em><em>四</em><em>五</em><em>六</em>${cells}</div>
    <p class="legend"><b class="plan"></b>约会计划 <b class="anniv"></b>纪念日</p>
    ${calSel?`<div class="day-box"><strong>${fmtS(calSel)}</strong>${sel.length?`<ul>${sel.map(e=>`<li><b class="${e.kind}"></b>${esc(e.title)}${e.auto?'':`<button type="button" class="link" data-rm="${e.id}">删除</button>`}</li>`).join('')}</ul>`:'<p class="muted">这天还没安排</p>'}</div>`:''}
    <form class="ev-new" id="ev-new"><input type="date" id="ev-d" value="${calSel||T()}" aria-label="日期"><input id="ev-t" maxlength="20" placeholder="比如：一起去看展" aria-label="事情"><select id="ev-k" aria-label="类型"><option value="plan">约会计划</option><option value="anniv">纪念日</option></select><button class="btn primary" type="submit">写上去</button></form>
    <h3 class="h3">接下来</h3><ul class="ms">${upcoming(5).map(e=>`<li><strong><b class="${e.kind}"></b>${esc(e.title)}</strong><em>${e.left===0?'就是今天':'还有 '+e.left+' 天'}</em><small>${fmt(parseD(e.date))}</small></li>`).join('')}</ul>
    <div class="cal-edit"><label class="field"><span>在一起的日子</span><input id="c-start" type="date" value="${state.start}" max="${T()}"></label>
    <label class="field"><span>两个人的名字（空格隔开）</span><input id="c-names" maxlength="20" value="${esc(state.names.join(' '))}"></label></div>`,root=>{
    root.querySelector('#c-prev').onclick=()=>{calOff--;openCal();};root.querySelector('#c-next').onclick=()=>{calOff++;openCal();};
    root.addEventListener('click',e=>{const c=e.target.closest('[data-d]');if(c){calSel=c.dataset.d;openCal();}
      const rm=e.target.closest('[data-rm]');if(rm){state.events=state.events.filter(x=>x.id!==rm.dataset.rm);save();emit('calendar');openCal();}});
    root.querySelector('#ev-new').addEventListener('submit',e=>{e.preventDefault();const t2=root.querySelector('#ev-t').value.trim(),d=root.querySelector('#ev-d').value;if(!t2||!d)return;
      state.events.push({id:uid(),date:d,title:t2,kind:root.querySelector('#ev-k').value});calSel=d;save();emit('calendar');openCal();toast('写到挂历上了');});
    root.querySelector('#c-start').onchange=e=>{if(!e.target.value)return;state.start=e.target.value;save();emit('calendar');openCal();};
    root.querySelector('#c-names').onchange=e=>{const q=e.target.value.trim().split(/\s+/);if(q.length<2){toast('写两个名字，中间空一格');return;}state.names=[q[0].slice(0,6),q[1].slice(0,6)];save();emit('names');emit('calendar');toast('名字改好了');};
  },{keepScroll:true,onClose:()=>{calOff=0;calSel=null;}});
}

/* ---------------- letters ---------------- */
function openLetters(tab='in',openId=null){
  const n=state.names,m=state.me,inbox=state.letters.filter(l=>l.to===m).slice().reverse(),sent=state.letters.filter(l=>l.from===m).slice().reverse();
  const unread=inbox.filter(l=>!l.opened).length;let body='';
  if(openId){const l=state.letters.find(x=>x.id===openId);
    body=`<article class="letter"><h3>${esc(l.title)}</h3><p>${nl(l.body)}</p><footer>${esc(n[l.from])} · ${fmtS(l.date)}</footer></article><button type="button" class="btn ghost" id="lt-back">← 回到信封盒</button>`;}
  else if(tab==='write') body=`<form class="lt-form" id="lt-form"><label class="field"><span>标题</span><input id="lt-title" maxlength="20" placeholder="写给${esc(n[1-m])}的信" data-autofocus></label>
      <label class="field"><span>正文</span><textarea id="lt-body" rows="7" maxlength="1000" placeholder="想说的话…"></textarea></label><button class="btn primary" type="submit">装进信封</button></form>`;
  else{const list=tab==='in'?inbox:sent;
    body=list.length?`<ul class="envs">${list.map(l=>`<li><button type="button" class="env ${l.opened?'':'sealed'}" data-open="${l.id}"><span class="seal" aria-hidden="true"></span><strong>${esc(l.title)}</strong><small>${tab==='in'?'来自 '+esc(n[l.from]):'寄给 '+esc(n[l.to])} · ${fmtS(l.date)} · ${l.opened?'已拆开':tab==='in'?'还没拆':'TA 还没拆'}</small></button></li>`).join('')}</ul>`:`<p class="muted">${tab==='in'?'还没有收到信':'还没寄过信'}</p>`;}
  openModal(`<h2>信封盒</h2><p class="sub">没拆的信会从盒子里冒出一角</p>
    ${openId?'':tabs([['in',`收到的${unread?'（'+unread+' 封没拆）':''}`],['write',`写给 ${esc(n[1-m])}`],['sent','我寄出的']],tab)}${body}`,root=>{
    root.addEventListener('click',e=>{const tb=e.target.closest('[data-tab]');if(tb)openLetters(tb.dataset.tab);
      const o=e.target.closest('[data-open]');if(o){const l=state.letters.find(x=>x.id===o.dataset.open);if(l.to===m&&!l.opened){l.opened=true;save();emit('letters');}openLetters(tab,l.id);}
      if(e.target.id==='lt-back')openLetters(tab);});
    const f=root.querySelector('#lt-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();const t=root.querySelector('#lt-title').value.trim()||'一封信',b=root.querySelector('#lt-body').value.trim();if(!b)return;
      state.letters.push({id:uid(),from:m,to:1-m,title:t,body:b,date:T(),opened:false});save();emit('letters');toast(`信放进去了，等 ${n[1-m]} 来拆`);openLetters('sent');});
  });
}

/* ---------------- fridge ---------------- */
function openFridge(tab='eat',rid=null){
  const n=state.names;let body='';
  if(tab==='eat') body=`<ul class="eats">${state.eats.map(e=>`<li class="${e.done?'done':''}"><button class="ck2" type="button" data-eat="${e.id}" aria-pressed="${e.done}" aria-label="吃过了：${esc(e.text)}">${e.done?'✓':''}</button><span>${esc(e.text)}</span><small>${esc(n[e.by])}</small><button class="del" type="button" data-rmeat="${e.id}" aria-label="删除">×</button></li>`).join('')}</ul>
    <form class="row-form" id="eat-form"><input id="eat-in" maxlength="24" placeholder="想一起吃的…" aria-label="想吃的东西"><button class="btn primary" type="submit">贴一个冰箱贴</button></form>`;
  else if(tab==='rec'){
    body=`<div class="recipes">${state.recipes.map(r=>`<details${r.id===rid?' open':''}><summary><strong>${esc(r.name)}</strong><small>${esc(n[r.by])} 的私房菜</small></summary><p class="ing"><b>材料</b>${esc(r.ing)}</p><ol>${r.steps.split('\n').filter(Boolean).map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`).join('')}</div>
      <details class="add-rec"><summary>写一道新菜谱</summary><form id="rec-form" class="lt-form"><label class="field"><span>菜名</span><input id="rc-n" maxlength="20"></label><label class="field"><span>材料</span><input id="rc-i" maxlength="80"></label><label class="field"><span>步骤（一行一步）</span><textarea id="rc-s" rows="4" maxlength="600"></textarea></label><button class="btn primary" type="submit">存进冰箱</button></form></details>`;}
  openModal(`<h2>冰箱</h2><p class="sub">冰箱贴是想一起吃的东西，门里夹着两个人的私房菜谱</p>${tabs([['eat','想一起吃'],['rec','私房菜谱']],tab)}${body}`,root=>{
    root.addEventListener('click',e=>{const tb=e.target.closest('[data-tab]');if(tb)openFridge(tb.dataset.tab);
      const ea=e.target.closest('[data-eat]');if(ea){const x=state.eats.find(z=>z.id===ea.dataset.eat);x.done=!x.done;save();emit('fridge');openFridge('eat');if(x.done)toast('吃到了！');}
      const rm=e.target.closest('[data-rmeat]');if(rm){state.eats=state.eats.filter(z=>z.id!==rm.dataset.rmeat);save();emit('fridge');openFridge('eat');}});
    const ef=root.querySelector('#eat-form');if(ef)ef.addEventListener('submit',e=>{e.preventDefault();const v=root.querySelector('#eat-in').value.trim();if(!v)return;state.eats.push({id:uid(),text:v,done:false,by:state.me});save();emit('fridge');openFridge('eat');});
    const rf=root.querySelector('#rec-form');if(rf)rf.addEventListener('submit',e=>{e.preventDefault();const nm=root.querySelector('#rc-n').value.trim();if(!nm)return;
      const r={id:uid(),name:nm,by:state.me,ing:root.querySelector('#rc-i').value.trim(),steps:root.querySelector('#rc-s').value.trim()};state.recipes.push(r);save();emit('fridge');openFridge('rec',r.id);});
  },{keepScroll:true});
}

/* ---------------- books ---------------- */
function openBook(i){
  const b=state.books[i];if(!b){openBookNew();return;}const N=state.books.length;
  emit('book-pull',i);
  openModal(`<div class="book-view" style="--bk:${b.color}"><img src="${picSrc(b)}" alt="${esc(b.title)}"><div>
      <p class="eyebrow">${esc(b.place)} · ${fmt(parseD(b.date))}</p><h2>${esc(b.title)}</h2><p class="story">${nl(b.story)}</p></div></div>
    <div class="pv-actions"><button class="btn ghost" id="bk-prev" type="button">← 上一本</button><button class="btn ghost" id="bk-new" type="button">放一本新的</button><button class="btn ghost" id="bk-next" type="button" data-autofocus>下一本 →</button></div>
    <p class="small">第 ${i+1} 本 / 共 ${N} 本 · <button type="button" class="link" id="bk-rm">从书架拿下来</button></p>`,root=>{
    root.querySelector('#bk-prev').onclick=()=>openBook((i-1+N)%N);root.querySelector('#bk-next').onclick=()=>openBook((i+1)%N);root.querySelector('#bk-new').onclick=openBookNew;
    root.querySelector('#bk-rm').onclick=e=>{if(e.target.dataset.sure){state.books.splice(i,1);save();emit('books');closeModal();toast('拿下来了');}else{e.target.dataset.sure='1';e.target.textContent='再点一次确认拿下来';}};
  },{onClose:()=>emit('book-back')});
}
const BOOKC=['#E8577A','#3E86C9','#F4A259','#5BAE8C','#9B7FD1','#D9831F','#2F6F68'];
function openBookNew(){
  emit('book-back');let src=null;
  openModal(`<h2>放一本新书</h2><p class="sub">每本书是一段回忆或一次旅行，书脊上会写着名字和日期</p>
    <form class="lt-form" id="bk-form"><label class="field"><span>书名（地点或事件）</span><input id="bk-t" maxlength="8" placeholder="比如：厦门" data-autofocus></label>
    <label class="field"><span>日期</span><input id="bk-d" type="date" value="${T()}"></label><label class="field"><span>在哪儿</span><input id="bk-p" maxlength="20"></label>
    <label class="field"><span>那次的故事</span><textarea id="bk-s" rows="4" maxlength="400"></textarea></label>
    <div class="row-form"><label class="btn ghost" for="pv-file" tabindex="0">加一张照片</label><input id="pv-file" type="file" accept="image/*" hidden><span class="muted" id="bk-ph">还没选照片</span></div>
    <button class="btn primary" type="submit">放上书架</button></form>`,root=>{
    bindFile(root,s=>{src=s;root.querySelector('#bk-ph').textContent='照片选好了';});
    root.querySelector('#bk-form').addEventListener('submit',e=>{e.preventDefault();const t=root.querySelector('#bk-t').value.trim();if(!t)return;
      state.books.push({id:uid(),title:t,date:root.querySelector('#bk-d').value||T(),place:root.querySelector('#bk-p').value.trim(),story:root.querySelector('#bk-s').value.trim(),src,g:state.books.length%6,color:BOOKC[state.books.length%BOOKC.length]});
      save();emit('books');openBook(state.books.length-1);toast('放上书架了');});
  });
}

/* ---------------- music ---------------- */
function songLinks(s){const q=encodeURIComponent(s.title+' '+s.artist);
  return (s.link?`<a href="${esc(s.link)}" target="_blank" rel="noopener">打开链接</a>`:'')+`<a href="https://music.163.com/#/search/m/?s=${q}" target="_blank" rel="noopener">网易云</a><a href="https://open.spotify.com/search/${q}" target="_blank" rel="noopener">Spotify</a>`;}
function openMusic(){
  const n=state.names;
  openModal(`<h2>我们的歌单</h2><p class="sub">点"放这首"唱片机就会转起来。真正的播放请点后面的音乐平台链接。</p>
    <ul class="songs">${state.songs.map(s=>`<li class="${state.playing===s.id?'on':''}"><button type="button" class="play" data-play="${s.id}" aria-label="${state.playing===s.id?'停下':'放这首'}">${state.playing===s.id?'❚❚':'▶'}</button>
      <div><strong>${esc(s.title)}</strong> <span class="muted">${esc(s.artist)}</span><p>“${esc(s.why)}” <span class="muted">—— ${esc(n[s.by])}</span></p><div class="links">${songLinks(s)}<button type="button" class="link" data-rmsong="${s.id}">删除</button></div></div></li>`).join('')}</ul>
    <details class="add-rec"><summary>加一首歌</summary><form id="sg-form" class="lt-form"><label class="field"><span>歌名</span><input id="sg-t" maxlength="40"></label><label class="field"><span>歌手</span><input id="sg-a" maxlength="40"></label>
      <label class="field"><span>为什么是它</span><input id="sg-w" maxlength="60"></label><label class="field"><span>音乐平台链接（可不填）</span><input id="sg-l" type="url" maxlength="300" placeholder="https://"></label><button class="btn primary" type="submit">加进歌单</button></form></details>`,root=>{
    root.addEventListener('click',e=>{const p=e.target.closest('[data-play]');if(p){state.playing=state.playing===p.dataset.play?null:p.dataset.play;save();emit('music');openMusic();}
      const rm=e.target.closest('[data-rmsong]');if(rm){state.songs=state.songs.filter(s=>s.id!==rm.dataset.rmsong);if(state.playing===rm.dataset.rmsong)state.playing=null;save();emit('music');openMusic();}});
    root.querySelector('#sg-form').addEventListener('submit',e=>{e.preventDefault();const t=root.querySelector('#sg-t').value.trim();if(!t)return;let l=root.querySelector('#sg-l').value.trim();if(l&&!/^https?:\/\//.test(l))l='';
      state.songs.push({id:uid(),title:t,artist:root.querySelector('#sg-a').value.trim(),why:root.querySelector('#sg-w').value.trim(),link:l,by:state.me});save();emit('music');openMusic();});
  },{keepScroll:true});
}

/* ---------------- plant ---------------- */
function openPlant(){
  const p=plant(),n=state.names,m=state.me;let grid='';
  for(let k=13;k>=0;k--){const d=addDays(today(),-k),a=state.checkins[ds(d)]||[];
    grid+=`<div class="pd${a.length===2?' both':''}${k===0?' now':''}"><i class="${a.includes(0)?'y':''}" style="--c:var(--pa)"></i><i class="${a.includes(1)?'y':''}" style="--c:var(--pb)"></i><small>${k===0?'今天':d.getDate()}</small></div>`;}
  const msg=p.wilted?`已经 ${p.idle} 天没人来浇水了，它有点蔫…`:p.meToday&&p.otherToday?'今天你们都来过了，它很开心':p.meToday?`你浇过了，等 ${n[1-m]} 也来一下`:p.otherToday?`${n[1-m]} 今天已经来过了，就差你`:'今天还没人来浇水';
  openModal(`<h2>小树 Lv.${p.level}</h2><p class="sub">两个人每天都来打卡它才会长；断太久会蔫掉</p>
    <p class="plant-msg ${p.wilted?'warn':''}">${msg}</p>
    <div class="pgrid">${grid}</div><p class="legend"><b style="background:var(--pa)"></b>${esc(n[0])} <b style="background:var(--pb)"></b>${esc(n[1])}</p>
    <div class="td-foot"><span>一起打卡 ${p.both} 天</span><div class="bar"><i style="width:${p.level>=5?100:(p.both%4)*25}%"></i></div><span>连续 ${p.streak} 天</span></div>
    <button class="btn primary wide" id="pl-go" type="button" ${p.meToday?'disabled':''} data-autofocus>${p.meToday?'今天已经浇过了':'浇水打卡'}</button>`,root=>{
    root.querySelector('#pl-go').onclick=()=>{const t=T(),a=state.checkins[t]||(state.checkins[t]=[]);if(!a.includes(m))a.push(m);const before=p.level;save();emit('plant','water');
      const q=plant();toast(q.level>before?'小树长大了一级！':q.meToday&&q.otherToday?'今天两个人都来过了':'浇好了');openPlant();};
  });
}

/* ---------------- windows ---------------- */
function openWindow(){
  const n=state.names,m=state.me;
  const card=w=>{const c=state.cities[w],t=tzParts(c.tz),mine=w===m;
    return `<div class="wcard" style="--c:var(--p${w?'b':'a'})"><h3>${esc(n[w])} 那边</h3><p class="big">${t.str}<small>${{dawn:'清晨',day:'白天',dusk:'黄昏',night:'夜里'}[phaseFor(t.h+t.m/60)]} · ${wName(c.weather)}</small></p>
      ${mine?`<label class="field"><span>城市</span><input data-city="${w}" maxlength="10" value="${esc(c.name)}"></label>
      <label class="field"><span>时区</span><select data-tz="${w}">${(TZS.some(z=>z[0]===c.tz)?TZS:[[c.tz,c.tz],...TZS]).map(([k,l])=>`<option value="${k}"${k===c.tz?' selected':''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>我这里的天气</span><select data-wx="${w}">${WEATHER.map(([k,l])=>`<option value="${k}"${k===c.weather?' selected':''}>${l}</option>`).join('')}</select></label>`
      :`<p class="muted">${esc(c.name)} · 天气由 ${esc(n[w])} 自己设置</p>`}</div>`;};
  openModal(`<h2>窗外</h2><p class="sub">左边的窗是你们各自那边的天空，跟着当地的真实时间变化</p><div class="wcards">${card(m)}${card(1-m)}</div>
    <p class="small">网页里拿不到实时天气，所以天气由各自手动设置。</p>`,root=>{
    root.addEventListener('change',e=>{const el=e.target;
      if(el.dataset.city!==undefined)state.cities[+el.dataset.city].name=el.value.trim()||'某地';
      if(el.dataset.tz!==undefined)state.cities[+el.dataset.tz].tz=el.value;
      if(el.dataset.wx!==undefined)state.cities[+el.dataset.wx].weather=el.value;
      save();emit('cities');openWindow();});
  },{keepScroll:true});
}

/* ---------------- moods ---------------- */
function openMood(){
  const m=state.me,cur=state.moods[m];
  openModal(`<h2>${esc(state.names[m])} 今天的心情</h2><p class="sub">沙发上代表你的那只玩偶会换成这个表情，${esc(state.names[1-m])} 戳它的时候会听到对应的回应</p>
    <div class="moods">${MOODS.map(([k,l])=>`<button type="button" data-mood="${k}" aria-pressed="${k===cur}"><img src="${faceURL(k)}" alt=""><span>${l}</span></button>`).join('')}</div>
    <p class="small">${esc(state.names[1-m])} 今天：${(MOODS.find(x=>x[0]===state.moods[1-m])||MOODS[0])[1]}</p>`,root=>{
    root.addEventListener('click',e=>{const b=e.target.closest('[data-mood]');if(!b)return;state.moods[m]=b.dataset.mood;save();emit('mood');openMood();});
  },{keepScroll:true});
}

/* ---------------- dispatcher ---------------- */
function act(kind,i){
  const n=state.names;
  switch(kind){
    case 'photo':openPhoto(i);break;
    case 'todo':openTodo();break;
    case 'cal':openCal();break;
    case 'letters':openLetters();break;
    case 'fridge':openFridge();break;
    case 'book':openBook(i);break;
    case 'books':state.books.length?openBook(0):openBookNew();break;
    case 'music':openMusic();break;
    case 'plant':openPlant();break;
    case 'window':openWindow();break;
    case 'mood':openMood();break;
    case 'settings':openSettings();break;
    case 'plush':if(i===state.me)openMood();else{state.lastPoke=Date.now();emit('poke',i);}break;
    case 'lamp':toast(online(i)?`${n[i]} 在线，这边的灯亮着`:`${n[i]} 不在，上次来是 ${rel(state.lastSeen[i])}`);break;
    case 'bin':{const k=state.todos.filter(t=>t.done).length;toast(k?`垃圾桶里有 ${k} 个纸团，都是完成的事`:'垃圾桶是空的');break;}
  }
}

/* ---------------- settings ---------------- */
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;});
function openSettings(){
  const n=state.names,m=state.me;
  openModal(`<h2>设置</h2><p class="sub">${LIVE?`已登录：${esc(n[m])}`:'现在是本地预览模式，数据只存在这台设备上（还没填 config.js）'}</p>
    <div class="set-list">
      <label class="field"><span>我的名字</span><input id="st-name" maxlength="6" value="${esc(n[m])}"></label>
      <div class="set-row"><span>房间光线</span><div class="seg" role="group" aria-label="房间光线">${[['auto','跟着真实时间'],['day','白天'],['dusk','黄昏'],['night','夜晚']].map(([k,l])=>`<button type="button" data-t="${k}" aria-pressed="${state.timeMode===k}">${l}</button>`).join('')}</div></div>
      ${installEvt?'<button class="btn primary" id="st-install" type="button">安装到手机桌面</button>':'<p class="small">要装到桌面：在 Chrome 菜单里选"添加到主屏幕"或"安装应用"。</p>'}
      ${LIVE?`<form id="st-pw" class="row-form"><input id="st-pw0" type="password" maxlength="72" placeholder="旧密码" aria-label="旧密码" autocomplete="current-password"><input id="st-pw1" type="password" minlength="6" maxlength="72" placeholder="新密码（至少 6 位）" aria-label="新密码" autocomplete="new-password"><button class="btn ghost" type="submit">改密码</button></form>
      ${Sync.needsServer?`<p class="small">服务器：${esc(Sync.server())}</p>`:''}
      <button class="btn ghost" id="st-out" type="button">退出登录</button>`:''}
    </div>`,root=>{
    root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{state.timeMode=b.dataset.t;try{localStorage.setItem('room-time-mode',b.dataset.t);}catch(e){}emit('time');openSettings();});
    root.querySelector('#st-name').onchange=e=>{const v=e.target.value.trim().slice(0,6);if(!v)return;state.names[m]=v;save();emit('names');toast('名字改好了');};
    const ins=root.querySelector('#st-install');if(ins)ins.onclick=async()=>{const ev=installEvt;installEvt=null;closeModal();ev.prompt();try{await ev.userChoice;}catch(e){}};
    const pw=root.querySelector('#st-pw');if(pw)pw.addEventListener('submit',async e=>{e.preventDefault();const v=root.querySelector('#st-pw1').value;if(v.length<6){toast('密码至少 6 位');return;}
      try{await Sync.changePassword(v,(root.querySelector('#st-pw0')||{}).value||'');root.querySelector('#st-pw1').value='';const o=root.querySelector('#st-pw0');if(o)o.value='';toast('改好了，下次用新密码');}catch(err){toast(err.message);}});
    const out=root.querySelector('#st-out');if(out)out.onclick=()=>Sync.signOut();
  });
}

/* ---------------- login ---------------- */
const HOUSE='<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><path d="M8 30 32 10l24 20v24a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#F4F1FA" stroke="#2B2A3A" stroke-width="3" stroke-linejoin="round"/><path d="M32 47c-7-4.5-10-8.2-10-11.6a5.4 5.4 0 0 1 10-2.8 5.4 5.4 0 0 1 10 2.8C42 38.8 39 42.5 32 47z" fill="#D9456B"/></svg>';
function loginScreen(){
  return new Promise(resolve=>{
    const el=document.createElement('div');el.className='login';let pick=null;
    el.innerHTML=`<div class="login-card">${HOUSE}<h1>双人小屋</h1><p class="sub">谁回来了？</p>
      <div class="who">${ACCTS.map((a,w)=>`<button type="button" data-w="${w}" aria-pressed="false" style="--c:var(--p${w?'b':'a'})"><span class="av">${esc(a.name.slice(-1))}</span>${esc(a.name)}</button>`).join('')}</div>
      <form id="lg" class="lg">${Sync.needsServer?`<input id="lg-srv" class="srv" inputmode="url" placeholder="服务器地址，例如 47.100.1.2:8090" aria-label="服务器地址" value="${esc(Sync.server())}">`:''}<input id="lg-pw" type="password" placeholder="密码" autocomplete="current-password" aria-label="密码" disabled><button class="btn primary" id="lg-go" type="submit" disabled>进门</button></form>
      <p class="err" id="lg-err" role="alert"></p></div>`;
    document.body.appendChild(el);
    const pw=el.querySelector('#lg-pw'),go=el.querySelector('#lg-go'),er=el.querySelector('#lg-err');
    el.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{pick=+b.dataset.w;el.querySelectorAll('[data-w]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));pw.disabled=false;go.disabled=false;er.textContent='';pw.focus();});
    el.querySelector('#lg').addEventListener('submit',async e=>{e.preventDefault();if(pick==null||!pw.value)return;
      const srv=el.querySelector('#lg-srv');if(srv){if(!srv.value.trim()){er.textContent='先填服务器地址';srv.focus();return;}Sync.setServer(srv.value);}
      go.disabled=true;go.textContent='开门中…';
      try{const who=await Sync.signIn(ACCTS[pick].email,pw.value);el.remove();resolve(who);}
      catch(err){er.textContent=err.message;go.disabled=false;go.textContent='进门';pw.select();}});
  });
}
function cover(msg,retry){const el=document.createElement('div');el.className='login';el.innerHTML=`<div class="login-card">${HOUSE}<p class="sub" style="margin-top:12px">${esc(msg)}</p>${retry?'<button class="btn primary" type="button">再试一次</button>':''}</div>`;
  document.body.appendChild(el);const b=el.querySelector('button');if(b)b.onclick=()=>location.reload();return el;}

const ready=(async()=>{
  if(!LIVE){heartbeat();setInterval(()=>{heartbeat();emit('time');},60000);return;}
  Sync.init({state,emit,toast});
  let who=null;
  try{who=await Sync.restore();}catch(e){cover('连不上网络，检查一下再试',true);throw e;}
  while(who==null) who=await loginScreen();
  state.me=who;
  const c=cover('正在开门…');
  try{await Sync.load();}catch(e){c.remove();cover('房间没打开：'+(e.message||'网络问题'),true);throw e;}
  c.remove();
  heartbeat();setInterval(heartbeat,60000);setInterval(()=>emit('time'),60000);
  Sync.subscribe();
})();

window.__back=()=>{if(scrim){closeModal();return true;}return false;};
window.App={ready,state,on,emit,save,esc,phase,cityPhase,tzParts,wName,online,rel,daysTogether,eventsOn,upcoming,T,ds,parseD,plant,pokeLine,drawFace,picSrc,ensureFonts,mountHud,tip,toast,act,MOODS};
})();
