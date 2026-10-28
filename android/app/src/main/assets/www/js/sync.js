/* 双人小屋 · 同步层（PocketBase 版）
 * 数据存在你们自己服务器上的 PocketBase 里，一样东西一行：items(kind, ref, data)。
 * 本地改动先改内存里的 state，再把有变化的行推上去；对方的改动通过实时订阅推下来。 */
(function(){
'use strict';
const C=window.ROOM_CONFIG||{};
const live=!!window.PocketBase;
const Sync={live,needsServer:true};
window.Sync=Sync;
if(!live) return;

const SKEY='couple-room-server';
let pb=null,A=null,me=null,myEmail='';
function norm(u){u=String(u||'').trim().replace(/\/+$/,'');if(u&&!/^https?:\/\//i.test(u))u='http://'+u;return u;}
Sync.server=()=>{try{return localStorage.getItem(SKEY)||norm(C.server);}catch(e){return norm(C.server);}};
Sync.setServer=u=>{u=norm(u);try{localStorage.setItem(SKEY,u);}catch(e){}pb=null;};
function client(){if(!pb){pb=new window.PocketBase(Sync.server());pb.autoCancellation(false);}return pb;}

const LIST={todo:'todos',event:'events',letter:'letters',eat:'eats',recipe:'recipes',book:'books',song:'songs'};
const last=new Map();           // 服务器上现在有什么：key -> {kind,ref,data,json}
const imgCache={};              // 照片路径 -> 可以直接显示的地址

function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{if(v[k]!==undefined)o[k]=canon(v[k]);});return o;}return v;}
const J=v=>JSON.stringify(canon(JSON.parse(JSON.stringify(v))));
const strip=o=>{const r={...o};delete r.src;return r;};
/* 每一行的记录 id 由 kind/ref 算出来（15 位小写字母数字），两台手机算出来的一样，所以不用先查再写 */
function rid(key){let a=0x811c9dc5,b=0x9e3779b1;for(const ch of key){const x=ch.codePointAt(0);a=Math.imul(a^x,16777619);b=Math.imul(b^x,2246822519);b^=b>>>15;}
  return ((a>>>0).toString(36)+(b>>>0).toString(36)+'000000000000000').slice(0,15);}

function toItems(s){
  const m=new Map(),put=(kind,ref,data,obj)=>m.set(kind+'/'+ref,{kind,ref:String(ref),data,obj});
  s.photos.forEach((p,i)=>{if(p)put('photo',i,strip(p),p);});
  for(const [k,arr] of Object.entries(LIST)) s[arr].forEach((o,i)=>{if(o.ord==null)o.ord=Date.now()+i;put(k,o.id,strip(o),o);});
  put('meta','main',{start:s.start,playing:s.playing||null});
  [0,1].forEach(w=>put('person',w,{name:s.names[w],city:s.cities[w],mood:s.moods[w],lastSeen:s.lastSeen[w]||0}));
  for(const [d,a] of Object.entries(s.checkins)) a.forEach(w=>put('checkin',`${d}:${w}`,{}));
  return m;
}

async function upload(obj){
  const blob=await (await fetch(obj.src)).blob();
  const fd=new FormData();fd.append('file',blob,'photo.jpg');
  const rec=await client().collection('photos').create(fd);
  obj.path=rec.id+'/'+rec.file;imgCache[obj.path]=obj.src;
}
async function download(path){
  const [id,name]=path.split('/');const token=await client().files.getToken();
  const res=await fetch(`${Sync.server()}/api/files/photos/${id}/${encodeURIComponent(name)}?token=${encodeURIComponent(token)}`);
  if(!res.ok)throw new Error('photo '+res.status);
  return URL.createObjectURL(await res.blob());
}

/* 所有读写排成一条队，避免同时推送互相打架 */
let chain=Promise.resolve(),timer=null,retryT=null,warned=false;
function enqueue(fn){chain=chain.then(fn).catch(e=>{console.error(e);
  if(!warned){warned=true;A&&A.toast('没同步上，网络好了会自动再试');}
  clearTimeout(retryT);retryT=setTimeout(()=>enqueue(doFlush),8000);});return chain;}
Sync.push=()=>{clearTimeout(timer);timer=setTimeout(()=>enqueue(doFlush),350);};
async function doFlush(){
  clearTimeout(timer);
  const col=client().collection('items'),cur=toItems(A.state),up=[],del=[];
  for(const [k,r] of cur){
    if(r.obj&&typeof r.obj.src==='string'&&r.obj.src.startsWith('data:')&&!r.obj.path){await upload(r.obj);r.data=strip(r.obj);}
    const json=J(r.data),prev=last.get(k);
    if(!prev||prev.json!==json) up.push({k,kind:r.kind,ref:r.ref,data:JSON.parse(json),json});
  }
  for(const [k,v] of last) if(!cur.has(k)) del.push({k,v});
  for(const u of up){
    const id=rid(u.k),body={kind:u.kind,ref:u.ref,data:u.data};
    try{await col.update(id,body);}
    catch(e){if(e&&e.status===404){try{await col.create({id,...body});}catch(e2){if(e2&&e2.status===400)await col.update(id,body);else throw e2;}}else throw e;}
    last.set(u.k,{kind:u.kind,ref:u.ref,data:u.data,json:u.json});
  }
  for(const d of del){try{await col.delete(rid(d.k));}catch(e){if(!(e&&e.status===404))throw e;}last.delete(d.k);}
  warned=false;
}

/* 用服务器的数据刷新 state，尽量保留原来的对象（打开着的面板还拿着它们） */
function rebuild(){rebuildState();A.emit('all');resolveImages();}
function rebuildState(){
  const s=A.state,rows=[...last.values()],by=k=>rows.filter(r=>r.kind===k);
  const assign=(obj,data)=>{const keep=obj.src;Object.keys(obj).forEach(k=>delete obj[k]);Object.assign(obj,JSON.parse(JSON.stringify(data)));
    obj.src=obj.path?(imgCache[obj.path]||null):keep;return obj;};
  const np=Array(8).fill(null);
  by('photo').forEach(r=>{const i=+r.ref;if(!(i>=0&&i<8))return;const ex=s.photos[i];np[i]=ex&&ex.id===r.data.id?assign(ex,r.data):assign({},r.data);});
  s.photos=np;
  for(const [k,arr] of Object.entries(LIST)){
    const ex=new Map(s[arr].map(o=>[o.id,o]));
    s[arr]=by(k).map(r=>{const o=ex.get(r.data.id);return o?assign(o,r.data):assign({},r.data);}).sort((a,b)=>(a.ord||0)-(b.ord||0)||(String(a.id)<String(b.id)?-1:1));
  }
  const meta=(last.get('meta/main')||{}).data;if(meta){if(meta.start)s.start=meta.start;s.playing=meta.playing||null;}
  [0,1].forEach(w=>{const p=(last.get('person/'+w)||{}).data;if(!p)return;if(p.name)s.names[w]=p.name;if(p.city)s.cities[w]=p.city;if(p.mood)s.moods[w]=p.mood;s.lastSeen[w]=p.lastSeen||0;});
  s.checkins={};by('checkin').forEach(r=>{const [d,w]=r.ref.split(':');(s.checkins[d]||(s.checkins[d]=[])).push(+w);});
}
let resolving=false;
async function resolveImages(){
  if(resolving)return;resolving=true;let got=false;
  try{
    const objs=[...A.state.photos.filter(Boolean),...A.state.books].filter(o=>o.path&&!imgCache[o.path]);
    for(const o of objs){if(imgCache[o.path])continue;try{imgCache[o.path]=await download(o.path);got=true;}catch(e){console.error(e);}}
    [...A.state.photos.filter(Boolean),...A.state.books].forEach(o=>{if(o.path&&imgCache[o.path])o.src=imgCache[o.path];});
  }finally{resolving=false;}
  if(got){A.emit('photos');A.emit('books');}
}

async function fetchAll(){
  const recs=await client().collection('items').getFullList({batch:500});
  last.clear();recs.forEach(r=>last.set(r.kind+'/'+r.ref,{kind:r.kind,ref:r.ref,data:r.data,json:J(r.data)}));
}
Sync.load=async()=>{
  await fetchAll();
  if(!last.has('meta/main')) await doFlush();   // 第一次进门：把空房间写上去
  else rebuild();
};
Sync.reload=()=>enqueue(async()=>{await doFlush();await fetchAll();rebuild();});

/* 收到对方的改动：马上并进 state（不然下一次推送会把它当成要删掉的东西），稍后再统一重绘 */
let rbT=null;
function laterRebuild(){rebuildState();clearTimeout(rbT);rbT=setTimeout(()=>{A.emit('all');resolveImages();},150);}
Sync.subscribe=()=>{
  client().collection('items').subscribe('*',e=>{
    enqueue(async()=>{
      await doFlush();
      const r=e.record,k=r.kind+'/'+r.ref;
      if(e.action==='delete'){if(!last.has(k))return;last.delete(k);}
      else{const json=J(r.data),prev=last.get(k);if(prev&&prev.json===json)return;last.set(k,{kind:r.kind,ref:r.ref,data:r.data,json});}
      laterRebuild();
    });
  }).catch(e=>console.error(e));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')Sync.reload();});
};

/* 登录 */
function netErr(e){return !e||!e.status;}   // status 0 = 连不上服务器
Sync.init=a=>{A=a;};
Sync.restore=async()=>{
  if(!Sync.server())return null;const c=client();if(!c.authStore.isValid)return null;
  try{const r=await c.collection('users').authRefresh();me=r.record.who;myEmail=r.record.email;return me;}
  catch(e){if(netErr(e))throw new Error('连不上服务器');c.authStore.clear();return null;}
};
Sync.signIn=async(email,pw)=>{
  if(!Sync.server())throw new Error('先填服务器地址');
  try{const r=await client().collection('users').authWithPassword(email,pw);me=r.record.who;myEmail=r.record.email;
    if(me!==0&&me!==1){client().authStore.clear();throw Object.assign(new Error('这个账号还没分配是谁'),{status:400});}return me;}
  catch(e){if(netErr(e))throw new Error('连不上服务器，检查地址和网络');throw new Error(e.status===400?'密码不对，再试一次':(e.message||'没登录上'));}
};
Sync.signOut=()=>{try{client().authStore.clear();}catch(e){}location.reload();};
Sync.changePassword=async(pw,oldPw)=>{
  const c=client(),id=c.authStore.record&&c.authStore.record.id;
  try{await c.collection('users').update(id,{oldPassword:oldPw,password:pw,passwordConfirm:pw});await c.collection('users').authWithPassword(myEmail,pw);}
  catch(e){throw new Error(e.status===400?'旧密码不对，或者新密码太短':'没改成功，检查网络');}
};
})();
