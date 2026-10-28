/* PocketBase transport. Local edits and remote snapshots are separate so a
 * received presence update never turns the other person's state into a write. */
(function(){
'use strict';
const C=window.ROOM_CONFIG||{},live=!!window.PocketBase;
const Sync={live,needsServer:true,present:new Set()};window.Sync=Sync;
if(!live)return;
const SKEY='couple-room-server',POSE_MS=1000,LEASE_MS=30000;
const LIST={todo:'todos',event:'events',letter:'letters',eat:'eats',recipe:'recipes',book:'books',song:'songs'};
const CHANGE={photo:'photos',todo:'todos',event:'calendar',letter:'letters',eat:'fridge',recipe:'fridge',book:'books',song:'music',meta:'all',checkin:'plant'};
const last=new Map(),pending=new Map(),seenEvents=new Set(),presenceLeases=new Map(),imgCache={};
let serverAnchor=null;
const monotonic=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
let pb=null,A=null,me=null,myEmail='',baseline=new Map(),profileSnapshot=null,loaded=false;
let chain=Promise.resolve(),timer=null,retryT=null,poseTimer=null,heartbeatT=null,leaseT=null,warned=false;
let serial=0,revision=0,runtimeVersion=0,runtimeDirty=false,poseVersion=0,poseDirty=false,forcePose=false;
let poseQueued=false,lastPoseWrite=-Infinity,publishedPose=null,localPose=false,active=true,acceptEvents=true,subscribed=false,connectedOnce=false;
const session=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{if(v[k]!==undefined)o[k]=canon(v[k]);});return o;}return v;}
const J=v=>JSON.stringify(canon(v));
function who(){return me===0||me===1?me:(A&&A.state.me===1?1:0);}
function stamp(){revision=Math.max(Date.now(),revision+1);return revision;}
function norm(u){u=String(u||'').trim().replace(/\/+$/,'');if(u&&!/^https?:\/\//i.test(u))u='http://'+u;return u;}
Sync.server=()=>{try{return localStorage.getItem(SKEY)||norm(C.server);}catch(e){return norm(C.server);}};
Sync.setServer=u=>{u=norm(u);try{localStorage.setItem(SKEY,u);}catch(e){}pb=null;};
function client(){if(!pb){pb=new window.PocketBase(Sync.server());pb.autoCancellation(false);}return pb;}
function rid(key){let a=0x811c9dc5,b=0x9e3779b1;for(const ch of key){const x=ch.codePointAt(0);a=Math.imul(a^x,16777619);b=Math.imul(b^x,2246822519);b^=b>>>15;}return((a>>>0).toString(36)+(b>>>0).toString(36)+'000000000000000').slice(0,15);}
function cleanEdits(edits){
  const result={};for(const[key,p]of Object.entries(edits||{})){
    if(/^[01]:(name|city|mood)$/.test(key)&&p&&Number.isFinite(p.at))result[key]={value:clone(p.value),at:p.at,id:String(p.id||'').slice(0,160)};
  }return result;
}
function ensure(){
  const s=A.state;
  for(const k of ['positions','presence'])if(!Array.isArray(s[k]))s[k]=[null,null];
  if(!Array.isArray(s.gestures))s.gestures=[[],[]];
  if(!Array.isArray(s.profileEdits))s.profileEdits=[{},{}];
  [0,1].forEach(w=>{s.gestures[w]=Array.isArray(s.gestures[w])?s.gestures[w]:[];s.profileEdits[w]=cleanEdits(s.profileEdits[w]);});
}
function position(p){
  if(!p||!['x','z','ry'].every(k=>Number.isFinite(p[k])))return null;
  return{x:Math.max(-4.6,Math.min(4.6,p.x)),z:Math.max(-4.6,Math.min(4.6,p.z)),ry:Math.atan2(Math.sin(p.ry),Math.cos(p.ry)),motion:['walk','idle','sit'].includes(p.motion)?p.motion:'idle',at:Number.isFinite(p.at)?p.at:Date.now()};
}
function profile(s,w){return{name:s.names[w],city:clone(s.cities[w]),mood:s.moods[w]};}
function snapshotProfiles(){return[profile(A.state,0),profile(A.state,1)];}
const strip=o=>{const r={...o};delete r.src;return r;};
function toItems(s){
  const m=new Map(),put=(kind,ref,data,obj)=>m.set(kind+'/'+ref,{kind,ref:String(ref),data,obj});
  s.photos.forEach((p,i)=>{if(p)put('photo',i,strip(p),p);});
  for(const[k,arr]of Object.entries(LIST))s[arr].forEach((o,i)=>{if(o.ord==null)o.ord=Date.now()+i;put(k,o.id,strip(o),o);});
  put('meta','main',{start:s.start,playing:s.playing||null});
  for(const[d,a]of Object.entries(s.checkins))a.forEach(w=>put('checkin',`${d}:${w}`,{}));
  return m;
}
function capture(){
  if(!A||!loaded)return;ensure();const cur=toItems(A.state);
  for(const[k,r]of cur)if(!baseline.has(k)||J(r.data)!==J(baseline.get(k).data))pending.set(k,{...r,data:clone(r.data),version:++serial});
  for(const[k,r]of baseline)if(!cur.has(k))pending.set(k,{kind:r.kind,ref:r.ref,deleted:true,version:++serial});
  baseline=new Map([...cur].map(([k,r])=>[k,{...r,data:clone(r.data)}]));
  const profiles=snapshotProfiles(),owner=who();
  if(profileSnapshot)for(const w of[0,1])for(const field of['name','city','mood'])if(J(profiles[w][field])!==J(profileSnapshot[w][field])){
    const at=stamp();A.state.profileEdits[owner][w+':'+field]={value:clone(profiles[w][field]),at,id:session+':'+(++serial)};runtimeDirty=true;runtimeVersion++;
  }
  profileSnapshot=profiles;
  const saved=last.get('person/'+owner);if(A.state.lastSeen[owner]!==((saved&&saved.data.lastSeen)||0)){runtimeDirty=true;runtimeVersion++;}
}
function rememberEvents(events){for(const e of events||[])if(e&&typeof e.id==='string')seenEvents.add(e.id);while(seenEvents.size>1024)seenEvents.delete(seenEvents.values().next().value);}
function consumeEvents(owner,data,silent){
  const events=Array.isArray(data.events)?data.events:[];
  for(const event of events){
    if(!event||typeof event.id!=='string'||seenEvents.has(event.id))continue;
    seenEvents.add(event.id);
    if(silent||!acceptEvents||owner===who()||event.from!==owner||!Number.isFinite(event.at))continue;
    if(event.type==='emote'&&['wave','jump','nod'].includes(event.name))A.emit('remote-emote',{who:owner,name:event.name,id:event.id,at:event.at});
    if(event.type==='poke'&&event.to===who())A.emit('remote-poke',{from:owner,to:who(),id:event.id,at:event.at,line:typeof event.line==='string'?event.line.slice(0,160):''});
  }
  rememberEvents([]);
}
function serverUpdated(record){
  const t=typeof record.updated==='number'?record.updated:Date.parse(String(record.updated||'').replace(' ','T'));
  return Number.isFinite(t)?t:null;
}
function row(record){return{kind:record.kind,ref:String(record.ref),data:clone(record.data||{}),updated:serverUpdated(record)};}
function store(record,options){
  const r=row(record),key=r.kind+'/'+r.ref,prev=last.get(key),ver=Number(r.data.revision)||0,oldVer=prev?(Number(prev.data.revision)||0):0;
  if(r.kind==='person'&&prev&&oldVer>ver)return false;
  // Retries/duplicate SSE must not make an unchanged revision look newly active.
  if(r.kind==='person'&&prev&&ver>0&&ver===oldVer)r.updated=prev.updated;
  last.set(key,r);
  if(r.kind==='person'){
    revision=Math.max(revision,ver);
    if(options&&options.live&&ver>oldVer)presenceLeases.set(+r.ref,{revision:ver,until:monotonic()+LEASE_MS});
  }
  if(options&&options.ack){
    const t=serverUpdated(record);
    if(t!==null){serverAnchor={server:t,local:monotonic()};presenceEvents();}
  }
  return !prev||J(prev.data)!==J(r.data);
}
function combined(){const rows=new Map(last);for(const[k,r]of pending)r.deleted?rows.delete(k):rows.set(k,r);return rows;}
function applyProfiles(rows){
  const s=A.state,before=snapshotProfiles(),edits=[];
  [0,1].forEach(w=>{
    const p=(rows.get('person/'+w)||{}).data;
    if(!p)return;
    if(p.name)s.names[w]=p.name;if(p.city)s.cities[w]=clone(p.city);if(p.mood)s.moods[w]=p.mood;
    s.lastSeen[w]=w===who()?Math.max(s.lastSeen[w]||0,p.lastSeen||0):(p.lastSeen||0);
    if(w!==who()||!localPose){const pos=position(p.pos);if(pos&&((Number(p.revision)||0)>0||!s.positions[w]||pos.at>=s.positions[w].at))s.positions[w]=pos;}
    if(w!==who())s.presence[w]=p.presence&&typeof p.presence.active==='boolean'?clone(p.presence):null;
    if(w!==who())s.gestures[w]=clone(Array.isArray(p.events)?p.events:[]);
    if(w!==who())s.profileEdits[w]=cleanEdits(p.profileEdits);
    else if(!runtimeDirty){s.profileEdits[w]=cleanEdits(p.profileEdits||s.profileEdits[w]);s.gestures[w]=clone(p.events||s.gestures[w]);}
  });
  for(const owner of[0,1])for(const[key,patch]of Object.entries(s.profileEdits[owner]||{})){
    if(!/^[01]:(name|city|mood)$/.test(key)||!patch||!Number.isFinite(patch.at))continue;
    revision=Math.max(revision,patch.at);edits.push({key,...patch});
  }
  edits.sort((a,b)=>a.at-b.at||(String(a.id||'')<String(b.id||'')?-1:String(a.id||'')>String(b.id||'')?1:0));
  for(const patch of edits){const[w,field]=patch.key.split(':');if(field==='name'&&typeof patch.value==='string')s.names[w]=patch.value;if(field==='city'&&patch.value&&typeof patch.value==='object')s.cities[w]=clone(patch.value);if(field==='mood'&&typeof patch.value==='string')s.moods[w]=patch.value;}
  profileSnapshot=snapshotProfiles();
  return{names:J(before.map(p=>p.name))!==J(profileSnapshot.map(p=>p.name)),cities:J(before.map(p=>p.city))!==J(profileSnapshot.map(p=>p.city)),mood:J(before.map(p=>p.mood))!==J(profileSnapshot.map(p=>p.mood))};
}
function rebuildState(){
  ensure();const s=A.state,rows=combined(),values=[...rows.values()],by=k=>values.filter(r=>r.kind===k);
  const assign=(obj,data)=>{const keep=obj.src;Object.keys(obj).forEach(k=>delete obj[k]);Object.assign(obj,clone(data));obj.src=obj.path?(imgCache[obj.path]||null):keep;return obj;};
  const np=Array(8).fill(null);by('photo').forEach(r=>{const i=+r.ref;if(!(i>=0&&i<8))return;const ex=s.photos[i];np[i]=ex&&ex.id===r.data.id?assign(ex,r.data):assign({},r.data);});s.photos=np;
  for(const[k,arr]of Object.entries(LIST)){const ex=new Map(s[arr].map(o=>[o.id,o]));s[arr]=by(k).map(r=>{const o=ex.get(r.data.id);return o?assign(o,r.data):assign({},r.data);}).sort((a,b)=>(a.ord||0)-(b.ord||0)||(String(a.id)<String(b.id)?-1:1));}
  const meta=(rows.get('meta/main')||{}).data;if(meta){if(meta.start)s.start=meta.start;s.playing=meta.playing||null;}
  s.checkins={};by('checkin').forEach(r=>{const[d,w]=r.ref.split(':');(s.checkins[d]||(s.checkins[d]=[])).push(+w);});
  const changes=applyProfiles(rows);baseline=new Map([...toItems(s)].map(([k,r])=>[k,{...r,data:clone(r.data)}]));return changes;
}
function presenceEvents(){
  if(!A)return;const next=new Set([0,1].filter(Sync.isOnline)),old=[...Sync.present].join(',');Sync.present=next;if(old!==[...next].join(','))A.emit('presence');
}
function emitRecordChange(kind,ref,changes){
  if(kind==='person'){
    if(changes.names)A.emit('names');if(changes.cities)A.emit('cities');if(changes.mood)A.emit('mood');
    A.emit('position',{who:+ref,pos:A.state.positions[+ref]});presenceEvents();
  }else if(CHANGE[kind])A.emit(CHANGE[kind]);
  resolveImages();
}
async function upload(obj){const blob=await(await fetch(obj.src)).blob(),fd=new FormData();fd.append('file',blob,'photo.jpg');const rec=await client().collection('photos').create(fd);obj.path=rec.id+'/'+rec.file;imgCache[obj.path]=obj.src;}
let resolving=false;
async function resolveImages(){
  if(resolving||!A)return;resolving=true;let got=false;
  try{const objs=[...A.state.photos.filter(Boolean),...A.state.books].filter(o=>o.path&&!imgCache[o.path]);for(const o of objs){try{const[id,name]=o.path.split('/'),token=await client().files.getToken();const res=await fetch(`${Sync.server()}/api/files/photos/${id}/${encodeURIComponent(name)}?token=${encodeURIComponent(token)}`);if(!res.ok)throw new Error('photo '+res.status);imgCache[o.path]=URL.createObjectURL(await res.blob());got=true;}catch(e){console.error('Photo download failed');}}[...A.state.photos.filter(Boolean),...A.state.books].forEach(o=>{if(o.path&&imgCache[o.path])o.src=imgCache[o.path];});}
  finally{resolving=false;}if(got){A.emit('photos');A.emit('books');}
}
function enqueue(fn){chain=chain.then(fn).catch(()=>{if(A&&!warned){warned=true;A.toast('没同步上，网络好了会自动再试');}clearTimeout(retryT);retryT=setTimeout(()=>enqueue(doFlush),8000);});return chain;}
function schedulePose(){
  clearTimeout(poseTimer);if(!poseDirty||!active||poseQueued)return;
  poseTimer=setTimeout(()=>{poseQueued=true;enqueue(doFlush).finally(()=>{poseQueued=false;schedulePose();});},forcePose?0:Math.max(0,lastPoseWrite+POSE_MS-monotonic()));
}
async function write(col,r,options){const id=rid(r.kind+'/'+r.ref),body={kind:r.kind,ref:r.ref,data:clone(r.data)};try{return await col.update(id,body,options);}catch(e){if(e&&e.status===404){try{return await col.create({id,...body},options);}catch(e2){if(e2&&e2.status===400)return col.update(id,body,options);throw e2;}}throw e;}}
async function flushPerson(col){
  const owner=who(),now=Date.now(),tick=monotonic(),publish=poseDirty&&(forcePose||tick-lastPoseWrite>=POSE_MS);
  if(!runtimeDirty&&!publish)return;
  const rv=runtimeVersion,pv=poseVersion,forced=forcePose;
  if(publish){publishedPose=clone(A.state.positions[owner]);publishedPose.at=now;lastPoseWrite=tick;forcePose=false;}
  // The publisher ages its own queue, so different phone clocks do not drop
  // fresh incoming gestures and a long-offline sender does not replay old ones.
  A.state.gestures[owner]=A.state.gestures[owner].filter(e=>e&&now-e.at>=0&&now-e.at<30000).slice(-32);
  const prior=(last.get('person/'+owner)||{}).data||{};
  const data={...clone(prior),...profile(A.state,owner),lastSeen:A.state.lastSeen[owner]||0,pos:clone(publishedPose||prior.pos||null),presence:clone(A.state.presence[owner]),events:clone(A.state.gestures[owner]),profileEdits:clone(A.state.profileEdits[owner]),revision:stamp()};
  try{
    const saved=await write(col,{kind:'person',ref:String(owner),data},{keepalive:true});store(saved||{kind:'person',ref:String(owner),data},{ack:true});
    if(runtimeVersion===rv)runtimeDirty=false;if(publish&&poseVersion===pv)poseDirty=false;
  }catch(e){if(publish)forcePose=forcePose||forced;throw e;}finally{schedulePose();}
}
async function doFlush(){
  if(!A||!loaded)return;capture();clearTimeout(timer);const col=client().collection('items');
  await flushPerson(col);
  for(const[k,entry]of[...pending]){
    const version=entry.version;
    if(entry.deleted){try{await col.delete(rid(k));}catch(e){if(!(e&&e.status===404))throw e;}last.delete(k);}
    else{
      if(entry.obj&&typeof entry.obj.src==='string'&&entry.obj.src.startsWith('data:')&&!entry.obj.path){await upload(entry.obj);entry.data=strip(entry.obj);}
      const saved=await write(col,entry);store(saved||entry,{ack:true});
    }
    if(pending.get(k)&&pending.get(k).version===version)pending.delete(k);
  }
  // Local edits made while an HTTP request was in flight remain pending.
  warned=false;capture();if(pending.size||runtimeDirty)clearTimeout(timer),timer=setTimeout(()=>enqueue(doFlush),0);
}
Sync.push=()=>{capture();clearTimeout(timer);timer=setTimeout(()=>enqueue(doFlush),350);};
Sync.setPosition=(p,opts)=>{
  if(!A)return false;ensure();const value=position(p);if(!value)return false;const owner=who(),prev=A.state.positions[owner];
  if(prev&&['x','z','ry','motion'].every(k=>prev[k]===value[k]))return false;
  value.at=Date.now();A.state.positions[owner]=value;localPose=true;poseDirty=true;poseVersion++;
  if((opts&&opts.stopped)||(prev&&prev.motion==='walk'&&value.motion!=='walk'))forcePose=true;
  schedulePose();return true;
};
function gesture(type,name,to,line){
  ensure();const owner=who(),event={id:session+':'+(++serial),from:owner,type,at:Date.now()};
  if(name)event.name=name;if(to===0||to===1)event.to=to;if(line)event.line=String(line).slice(0,160);
  A.state.gestures[owner]=A.state.gestures[owner].filter(e=>e&&event.at-e.at<30000).concat(event).slice(-32);
  runtimeDirty=true;runtimeVersion++;capture();enqueue(doFlush);return event;
}
Sync.sendEmote=name=>['wave','jump','nod'].includes(name)?gesture('emote',name):null;
Sync.sendPoke=(to,line)=>to===1-who()?gesture('poke',null,to,line):null;
Sync.setPresence=value=>{
  if(!A)return;ensure();active=!!value;const owner=who(),at=Date.now();
  A.state.presence[owner]={active,at};if(active)A.state.lastSeen[owner]=at;
  runtimeDirty=true;runtimeVersion++;if(!active)clearTimeout(poseTimer);presenceEvents();return enqueue(doFlush);
};
Sync.isOnline=w=>{
  if(!A)return false;if(w===who())return active;
  const p=A.state.presence&&A.state.presence[w];
  if(p&&typeof p.active==='boolean'){
    if(!p.active)return false;
    const r=last.get('person/'+w);if(!r)return false;
    const ver=Number(r.data.revision)||0,observed=presenceLeases.get(w),now=monotonic();
    if(observed&&observed.revision===ver)return now<observed.until;
    // A fetch is not fresh activity. Until a successful write anchors server
    // time, an initial active snapshot has unknown age and stays offline.
    if(!serverAnchor||r.updated===null)return false;
    const age=serverAnchor.server+(now-serverAnchor.local)-r.updated;
    const until=now+Math.max(0,LEASE_MS-Math.max(0,age));
    presenceLeases.set(w,{revision:ver,until});
    return now<until;
  }
  return Date.now()-(A.state.lastSeen[w]||0)<180000;
};
async function fetchAll(){
  const records=await client().collection('items').getFullList({batch:500});
  const next=new Map();for(const record of records){const r=row(record),key=r.kind+'/'+r.ref,old=last.get(key);if(r.kind==='person'&&old&&(r.data.revision||0)>0&&(old.data.revision||0)===(r.data.revision||0))r.updated=old.updated;next.set(key,r.kind==='person'&&old&&(old.data.revision||0)>(r.data.revision||0)?old:r);if(r.kind==='person'){revision=Math.max(revision,r.data.revision||0);rememberEvents(r.data.events);}}
  last.clear();for(const[k,r]of next)last.set(k,r);
}
Sync.load=async()=>{
  ensure();await fetchAll();const empty=!last.has('meta/main');loaded=true;
  if(empty){baseline=new Map();profileSnapshot=snapshotProfiles();capture();runtimeDirty=true;runtimeVersion++;await doFlush();}
  else{rebuildState();publishedPose=clone((last.get('person/'+who())||{}).data?.pos||null);A.emit('all');resolveImages();}
  presenceEvents();
};
Sync.reload=()=>enqueue(async()=>{capture();await fetchAll();rebuildState();A.emit('all');resolveImages();await doFlush();});
Sync.subscribe=()=>{
  if(subscribed)return;subscribed=true;const c=client();
  c.realtime.onDisconnect=()=>{acceptEvents=false;};
  c.realtime.subscribe('PB_CONNECT',()=>{
    if(!connectedOnce){connectedOnce=true;acceptEvents=true;return;}
    enqueue(async()=>{capture();await fetchAll();rebuildState();A.emit('all');acceptEvents=true;await doFlush();});
  }).catch(()=>{});
  c.collection('items').subscribe('*',event=>enqueue(async()=>{
    capture();const r=event.record,key=r.kind+'/'+r.ref;let changed;
    if(event.action==='delete'){changed=last.delete(key);}else changed=store(r,{live:true});
    if(!changed)return;
    const changes=rebuildState();if(event.action!=='delete'&&r.kind==='person')consumeEvents(+r.ref,r.data,false);
    emitRecordChange(r.kind,r.ref,changes);
  })).catch(()=>{});
  heartbeatT=setInterval(()=>{if(active)Sync.setPresence(true);},15000);
  leaseT=setInterval(presenceEvents,1000);
  window.addEventListener('online',()=>Sync.reload());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)Sync.reload();});
};
Sync.init=a=>{A=a;ensure();profileSnapshot=snapshotProfiles();};
function netErr(e){return !e||!e.status;}
Sync.restore=async()=>{if(!Sync.server())return null;const c=client();if(!c.authStore.isValid)return null;try{const r=await c.collection('users').authRefresh();me=r.record.who;myEmail=r.record.email;return me;}catch(e){if(netErr(e))throw new Error('连不上服务器');c.authStore.clear();return null;}};
Sync.signIn=async(email,pw)=>{if(!Sync.server())throw new Error('先填服务器地址');try{const r=await client().collection('users').authWithPassword(email,pw);me=r.record.who;myEmail=r.record.email;if(me!==0&&me!==1){client().authStore.clear();throw Object.assign(new Error('这个账号还没分配是谁'),{status:400});}return me;}catch(e){if(netErr(e))throw new Error('连不上服务器，检查地址和网络');throw new Error(e.status===400?'密码不对，再试一次':(e.message||'没登录上'));}};
Sync.signOut=async()=>{
  // Keep the authenticated session until the final offline lease is sent.
  await Promise.race([Sync.setPresence(false),new Promise(resolve=>setTimeout(resolve,800))]);
  clearInterval(heartbeatT);clearInterval(leaseT);
  try{client().authStore.clear();}catch(e){}location.reload();
};
Sync.changePassword=async(pw,oldPw)=>{const c=client(),id=c.authStore.record&&c.authStore.record.id;try{await c.collection('users').update(id,{oldPassword:oldPw,password:pw,passwordConfirm:pw});await c.collection('users').authWithPassword(myEmail,pw);}catch(e){throw new Error(e.status===400?'旧密码不对，或者新密码太短':'没改成功，检查网络');}};
})();
