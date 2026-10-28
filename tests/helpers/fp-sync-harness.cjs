'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
class Surface{
 constructor(){this.listeners=new Map();this.hidden=false;}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
 emit(name){for(const fn of this.listeners.get(name)||[])fn({type:name});}
 get visibilityState(){return this.hidden?'hidden':'visible';}
}
class Clock{
 constructor(){this.now=1800000000000;this.offsets=new Map();this.next=1;this.timers=new Map();}
 set(fn,delay,interval,owner){const id=this.next++;this.timers.set(id,{fn,at:this.now+Math.max(0,delay||0),interval,owner});return id;}
 clear(id){this.timers.delete(id);}
 freeze(owner){for(const[id,t]of this.timers)if(t.owner===owner)this.timers.delete(id);}
 async settle(){for(let n=0;n<40;n++)await Promise.resolve();}
 async advance(ms){const until=this.now+ms;let count=0;await this.settle();for(;;){let next=null,id=null;for(const[key,t]of this.timers)if(t.at<=until&&(!next||t.at<next.at||t.at===next.at&&key<id)){next=t;id=key;}if(!next)break;if(++count>20000)throw new Error('Timer loop exceeded 20000 callbacks');this.now=next.at;if(next.interval)next.at+=next.interval;else this.timers.delete(id);next.fn();await this.settle();}this.now=until;await this.settle();}
}
function state(who,now){return{v:2,me:who,names:['A','B'],cities:[{name:'A city',tz:'UTC',weather:'sunny'},{name:'B city',tz:'UTC',weather:'rain'}],moods:['happy','happy'],lastSeen:[now,now],positions:[null,null],presence:[null,null],gestures:[[],[]],profileEdits:[{},{}],start:'2026-10-29',playing:null,photos:Array(8).fill(null),todos:[],events:[],letters:[],eats:[],recipes:[],books:[],songs:[],checkins:{}};}
class Hub{
 constructor(clock){this.clock=clock;this.rows=new Map();this.clients=[];this.writes=[];this.offline=new Set();this.seed('meta','main',{start:'2026-10-29',playing:null});const s=state(0,clock.now);for(const w of[0,1])this.seed('person',String(w),{name:s.names[w],city:s.cities[w],mood:s.moods[w],lastSeen:clock.now});this.seed('future-kind','preserve',{unrecognized:true});}
 seed(kind,ref,data){const record={id:rid(kind+'/'+ref),kind,ref,data:copy(data),updated:new Date(this.clock.now).toISOString()};this.rows.set(record.id,record);return record;}
 broadcast(event){for(const client of this.clients)if(!this.offline.has(client.who))for(const fn of client.listeners)queueMicrotask(()=>fn(copy(event)));}
 reconnect(who){this.offline.delete(who);for(const client of this.clients)if(client.who===who)for(const fn of client.connections)fn({});}
 disconnect(who){this.offline.add(who);for(const client of this.clients)if(client.who===who&&client.realtime.onDisconnect)client.realtime.onDisconnect(['items/*']);}
 factory(who){const hub=this;return class PocketBase{
  constructor(){this.who=who;this.listeners=[];this.connections=[];this.authStore={isValid:true,record:{id:'user'+who},clear(){this.isValid=false;}};this.realtime={onDisconnect:null,subscribe:async(topic,fn)=>{if(topic==='PB_CONNECT'){this.connections.push(fn);queueMicrotask(()=>fn({}));}return()=>{};}};this.files={getToken:async()=>({})};hub.clients.push(this);}
  autoCancellation(){}
  collection(name){const self=this;return{
   getFullList:async()=>{if(hub.offline.has(who))throw{status:0};return[...hub.rows.values()].map(copy);},
   subscribe:async(topic,fn)=>{self.listeners.push(fn);return()=>{};},
   update:async(id,body)=>{if(!self.authStore.isValid)throw{status:401};if(hub.offline.has(who))throw{status:0};const prior=hub.rows.get(id);if(!prior)throw{status:404};const record={...copy(prior),...copy(body),id,updated:new Date(hub.clock.now).toISOString()};hub.rows.set(id,record);hub.writes.push({who,at:hub.clock.now,record:copy(record),action:'update'});hub.broadcast({action:'update',record});return copy(record);},
   create:async body=>{if(hub.offline.has(who))throw{status:0};if(hub.rows.has(body.id))throw{status:400};const record={...copy(body),updated:new Date(hub.clock.now).toISOString()};hub.rows.set(record.id,record);hub.writes.push({who,at:hub.clock.now,record:copy(record),action:'create'});hub.broadcast({action:'create',record});return copy(record);},
   delete:async id=>{if(hub.offline.has(who))throw{status:0};const record=hub.rows.get(id);if(!record)throw{status:404};hub.rows.delete(id);hub.writes.push({who,at:hub.clock.now,record:copy(record),action:'delete'});hub.broadcast({action:'delete',record});},
   authRefresh:async()=>({token:'test-only',record:{who,id:'user'+who,email:who+'@example.invalid'}}),
   authWithPassword:async()=>({token:'test-only',record:{who,id:'user'+who,email:who+'@example.invalid'}})
  };}
 };}
 person(w){return this.rows.get(rid('person/'+w)).data;}
}
function rid(key){let a=0x811c9dc5,b=0x9e3779b1;for(const ch of key){const x=ch.codePointAt(0);a=Math.imul(a^x,16777619);b=Math.imul(b^x,2246822519);b^=b>>>15;}return((a>>>0).toString(36)+(b>>>0).toString(36)+'000000000000000').slice(0,15);}
async function fixture(options={}){const clock=new Clock(),hub=new Hub(clock),clients=[];for(const[key,value]of Object.entries(options.offsets||{}))clock.offsets.set(+key,value);if(options.beforeClients)options.beforeClients(hub,clock);for(const who of[0,1]){const events=[],toasts=[],document=new Surface(),window=new Surface(),store=new Map();const FakeDate=class extends Date{constructor(...args){super(...(args.length?args:[clock.now+(clock.offsets.get(who)||0)]));}static now(){return clock.now+(clock.offsets.get(who)||0);}};Object.assign(window,{ROOM_CONFIG:{server:'https://test.invalid'},PocketBase:hub.factory(who)});const context={window,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},Date:FakeDate,performance:{now:()=>clock.now},console,location:{reload(){window.reloaded=true;}},crypto:{randomUUID:()=> 'client-'+who},setTimeout:(fn,ms)=>clock.set(fn,ms,null,who),clearTimeout:id=>clock.clear(id),setInterval:(fn,ms)=>clock.set(fn,ms,ms,who),clearInterval:id=>clock.clear(id),URL,Math};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../web/js/sync.js'),'utf8'),context);const client={who,Sync:window.Sync,state:state(who,clock.now),events,toasts,document,window};client.Sync.init({state:client.state,emit:(kind,data)=>events.push({kind,data:copy(data)}),toast:s=>toasts.push(s)});await client.Sync.load();client.Sync.subscribe();await clock.settle();clients.push(client);}return{clock,hub,a:clients[0],b:clients[1]};}
module.exports={fixture,rid,copy};
