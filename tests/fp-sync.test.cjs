'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,rid,copy}=require('./helpers/fp-sync-harness.cjs');
const pose=(x,z=2,motion='walk')=>({x,z,ry:Math.PI,motion});

test('legacy rows load and unknown item kinds survive ordinary saves',async()=>{
 const{a,b,hub,clock}=await fixture();assert.equal(a.state.positions[0],null);assert.equal(b.state.names[0],'A');
 a.state.todos.push({id:'todo-a',text:'keep',done:false,ord:1});a.Sync.push();await clock.advance(350);
 assert(hub.rows.has(rid('future-kind/preserve')));assert.equal(b.state.todos[0].text,'keep');
});
test('two clients only publish their own person row and receive each other',async()=>{
 const{a,b,hub,clock}=await fixture();a.Sync.setPosition(pose(0));b.Sync.setPosition(pose(1));await clock.advance(0);
 assert.equal(a.state.positions[1].x,1);assert.equal(b.state.positions[0].x,0);
 assert(hub.writes.filter(w=>w.record.kind==='person').every(w=>w.who===+w.record.ref));
 assert.equal(hub.person(0).pos.x,0);assert.equal(hub.person(1).pos.x,1);
});
test('movement publishes at most one changed pose per second; stop publishes immediately',async()=>{
 const{a,hub,clock}=await fixture();for(let n=0;n<100;n++){a.Sync.setPosition(pose(n/100));if(n===25){a.state.names[0]='A updated';a.Sync.push();}await clock.advance(16);}
 const writes=hub.writes.filter(w=>w.record.kind==='person'&&w.record.data.pos);const distinct=writes.filter((w,i)=>!i||w.record.data.pos.at!==writes[i-1].record.data.pos.at);
 assert.equal(distinct.length,2);assert(distinct[1].at-distinct[0].at>=1000);
 a.Sync.setPosition(pose(1,2,'idle'),{stopped:true});await clock.advance(0);
 assert.equal(hub.person(0).pos.motion,'idle');assert.equal(hub.person(0).pos.x,1);assert.equal(hub.person(0).pos.at,clock.now);
});
test('remote SSE cannot overwrite a newer unsent local pose',async()=>{
 const{a,b,clock}=await fixture();a.Sync.setPosition(pose(0));await clock.advance(0);await clock.advance(300);
 a.Sync.setPosition(pose(.4));b.Sync.setPosition(pose(1));await clock.advance(0);
 assert.equal(a.state.positions[0].x,.4);await clock.advance(700);assert.equal(b.state.positions[0].x,.4);
});
test('editing both profiles uses owned bounded patches without overwriting peer movement',async()=>{
 const{a,b,hub,clock}=await fixture();b.Sync.setPosition(pose(2));await clock.advance(0);
 a.state.names[1]='B renamed';a.state.cities[1]={name:'new city',tz:'UTC',weather:'sunny'};a.Sync.push();await clock.advance(350);
 assert.equal(b.state.names[1],'B renamed');assert.equal(a.state.cities[1].name,'new city');assert.equal(hub.person(1).pos.x,2);
 b.state.names[0]='A renamed';b.Sync.push();await clock.advance(350);assert.equal(a.state.names[0],'A renamed');
 assert(hub.writes.filter(w=>w.record.kind==='person').every(w=>w.who===+w.record.ref));assert(Object.keys(hub.person(0).profileEdits).length<=6);
});
test('concurrent independent business edits merge and explicit deletion is retained',async()=>{
 const{a,b,hub,clock}=await fixture();a.state.todos.push({id:'a-note',text:'from A',ord:1});b.state.todos.push({id:'b-note',text:'from B',ord:2});a.Sync.push();b.Sync.push();await clock.advance(350);
 assert.deepEqual(copy(a.state.todos.map(x=>x.id).sort()),['a-note','b-note']);assert.deepEqual(copy(b.state.todos.map(x=>x.id).sort()),['a-note','b-note']);
 a.state.todos=a.state.todos.filter(x=>x.id!=='a-note');a.Sync.push();await clock.advance(350);assert(!hub.rows.has(rid('todo/a-note')));assert.equal(b.state.todos.length,1);
});
test('poke and emote coexist, deliver once and never rebuild the entire room',async()=>{
 const{a,b,hub,clock}=await fixture();b.events.length=0;a.Sync.sendEmote('wave');a.Sync.sendPoke(1,'hello');await clock.advance(0);
 assert.equal(b.events.filter(e=>e.kind==='remote-emote').length,1);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);assert.equal(b.events.find(e=>e.kind==='remote-poke').data.line,'hello');
 assert.equal(b.events.filter(e=>e.kind==='all').length,0);
 const record=copy(hub.rows.get(rid('person/0')));record.data.revision++;hub.rows.set(record.id,record);hub.broadcast({action:'update',record});await clock.settle();
 assert.equal(b.events.filter(e=>e.kind==='remote-emote').length,1);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);
});
test('reload and realtime reconnect suppress old events; fresh events still work',async()=>{
 const{a,b,hub,clock}=await fixture();a.Sync.sendPoke(1,'first');await clock.advance(0);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);
 await b.Sync.reload();await clock.settle();assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);
 hub.disconnect(1);a.Sync.sendEmote('jump');await clock.advance(0);hub.reconnect(1);await clock.settle();assert.equal(b.events.filter(e=>e.kind==='remote-emote').length,0);
 a.Sync.sendEmote('nod');await clock.advance(0);assert.equal(b.events.filter(e=>e.kind==='remote-emote').length,1);
});
test('explicit background presence is immediate, and an abrupt disconnect expires in 30 seconds',async()=>{
 const{a,b,hub,clock}=await fixture();await a.Sync.setPresence(true);await clock.settle();assert.equal(b.Sync.isOnline(0),true);
 await a.Sync.setPresence(false);await clock.settle();assert.equal(b.Sync.isOnline(0),false);
 await a.Sync.setPresence(true);await clock.settle();assert.equal(b.Sync.isOnline(0),true);hub.disconnect(0);clock.freeze(0);await clock.advance(30001);assert.equal(b.Sync.isOnline(0),false);
});
test('network recovery keeps queued events and refreshes missed state',async()=>{
 const{a,b,hub,clock}=await fixture();hub.disconnect(0);a.Sync.sendEmote('wave');a.Sync.sendPoke(1,'queued');await clock.advance(0);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,0);
 hub.reconnect(0);await clock.settle();await clock.advance(8000);assert.equal(b.events.filter(e=>e.kind==='remote-emote').length,1);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);
 assert(a.toasts.length<=1);
});

test('profile edits use a monotonic observed clock and fresh events tolerate phone clock skew',async()=>{
 const{a,b,hub,clock}=await fixture();await b.Sync.setPresence(true);await clock.settle();
 clock.offsets.set(0,-60000);a.state.names[1]='edited on a slow clock';a.Sync.push();await clock.advance(350);
 assert.equal(b.state.names[1],'edited on a slow clock');assert(hub.person(0).profileEdits['1:name'].at>1800000000000);
 a.Sync.sendPoke(1,'fresh across clocks');await clock.advance(0);assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,1);
});
test('out-of-order stale person snapshots cannot move the peer back',async()=>{
 const{a,b,hub,clock}=await fixture();a.Sync.setPosition(pose(0));await clock.advance(0);const old=copy(hub.rows.get(rid('person/0')));
 await clock.advance(1000);a.Sync.setPosition(pose(1));await clock.advance(0);hub.broadcast({action:'update',record:old});await clock.settle();
 assert.equal(b.state.positions[0].x,1);
});
test('events queued for longer than their lifetime are not played after sender recovery',async()=>{
 const{a,b,hub,clock}=await fixture();hub.disconnect(0);a.Sync.sendPoke(1,'expired');await clock.advance(31000);hub.reconnect(0);await clock.settle();await clock.advance(8000);
 assert.equal(b.events.filter(e=>e.kind==='remote-poke').length,0);assert.equal(hub.person(0).events.length,0);
});

test('sign out sends offline while authentication is still available',async()=>{
 const{a,b,hub,clock}=await fixture();await a.Sync.setPresence(true);await clock.settle();
 await a.Sync.signOut();await clock.settle();assert.equal(hub.person(0).presence.active,false);assert.equal(b.Sync.isOnline(0),false);assert.equal(a.window.reloaded,true);
});

test('a slow in-flight write cannot erase newer local movement or the final stop',async()=>{
 const{a,b,hub,clock}=await fixture();const client=hub.clients.find(c=>c.who===0),collection=client.collection.bind(client);
 let release,blocked=false;const gate=new Promise(resolve=>release=resolve);
 client.collection=name=>{const col=collection(name),update=col.update;col.update=async(id,body,...options)=>{if(body.kind==='person'&&!blocked){blocked=true;await gate;}return update(id,body,...options);};return col;};
 a.Sync.setPosition(pose(0));await clock.advance(0);assert.equal(blocked,true);
 await clock.advance(300);a.Sync.setPosition(pose(.5));b.Sync.setPosition(pose(2));await clock.advance(0);assert.equal(a.state.positions[0].x,.5);
 await clock.advance(1000);a.Sync.setPosition(pose(1,2,'idle'),{stopped:true});release();await clock.settle();await clock.advance(0);
 assert.equal(a.state.positions[0].x,1);assert.equal(hub.person(0).pos.x,1);assert.equal(b.state.positions[0].motion,'idle');
 assert.equal(hub.writes.filter(w=>w.who===0&&w.record.kind==='person').length,2);
});

for(const offset of[-60000,60000])test(`presence from a sender ${offset} ms off clock stays online then expires locally`,async()=>{
 const{a,b,hub,clock}=await fixture();clock.offsets.set(0,offset);await a.Sync.setPresence(true);await clock.settle();
 assert.equal(a.Sync.isOnline(0),true);assert.equal(b.Sync.isOnline(0),true,'Fresh presence was rejected because of sender clock');
 hub.disconnect(0);clock.freeze(0);await clock.advance(30001);assert.equal(b.Sync.isOnline(0),false,'Presence outlived its local receive lease');
});
test('repeated or older revisions cannot renew a receive lease',async()=>{
 const{a,b,hub,clock}=await fixture();await a.Sync.setPresence(true);await clock.settle();const old=copy(hub.rows.get(rid('person/0')));
 hub.disconnect(0);clock.freeze(0);await clock.advance(29000);const duplicate=copy(old);duplicate.updated=new Date(clock.now).toISOString();hub.broadcast({action:'update',record:duplicate});
 const stale=copy(duplicate);stale.data.revision--;stale.data.presence.at=clock.now+3600000;hub.broadcast({action:'update',record:stale});await clock.settle();
 await clock.advance(1001);assert.equal(b.Sync.isOnline(0),false);
});
test('a newly observed live revision renews only a local receive lease',async()=>{
 const{a,b,hub,clock}=await fixture();await a.Sync.setPresence(true);await clock.settle();hub.disconnect(0);clock.freeze(0);await clock.advance(29000);
 const fresh=copy(hub.rows.get(rid('person/0')));fresh.data.revision++;fresh.updated=new Date(clock.now).toISOString();fresh.data.presence.at=-123456;hub.rows.set(fresh.id,fresh);hub.broadcast({action:'update',record:fresh});await clock.settle();
 await clock.advance(2000);assert.equal(b.Sync.isOnline(0),true);await clock.advance(28001);assert.equal(b.Sync.isOnline(0),false);
});
test('initial old active snapshot is not revived by fetch or clock skew',async()=>{
 const{b,clock}=await fixture({offsets:{0:60000,1:-120000},beforeClients(hub,clock){
  const p=hub.rows.get(rid('person/0'));p.data.presence={active:true,at:clock.now+60000};p.data.revision=100;p.updated=new Date(clock.now-60000).toISOString();
 }});clock.freeze(0);assert.equal(b.Sync.isOnline(0),false,'Unknown-age active snapshot should be conservative before clock anchor');
 await b.Sync.setPresence(true);await clock.settle();assert.equal(b.Sync.isOnline(0),false,'Old snapshot became online after server clock anchor');
 await b.Sync.reload();await clock.settle();assert.equal(b.Sync.isOnline(0),false,'Fetching an unchanged old snapshot renewed it');
});
test('initial recent snapshot gets only its remaining server-time lifetime',async()=>{
 const{b,clock}=await fixture({offsets:{0:-60000,1:120000},beforeClients(hub,clock){
  const p=hub.rows.get(rid('person/0'));p.data.presence={active:true,at:clock.now-60000};p.data.revision=100;p.updated=new Date(clock.now-5000).toISOString();
 }});clock.freeze(0);await b.Sync.setPresence(true);await clock.settle();assert.equal(b.Sync.isOnline(0),true);
 await clock.advance(24999);await b.Sync.reload();await clock.settle();assert.equal(b.Sync.isOnline(0),true);await clock.advance(2);assert.equal(b.Sync.isOnline(0),false,'Snapshot age was reset by a later fetch');
});
test('changing the receiver wall clock cannot extend or cancel an observed lease',async()=>{
 const{a,b,hub,clock}=await fixture();await a.Sync.setPresence(true);await clock.settle();hub.disconnect(0);clock.freeze(0);
 clock.offsets.set(1,7200000);assert.equal(b.Sync.isOnline(0),true);await clock.advance(29999);clock.offsets.set(1,-7200000);assert.equal(b.Sync.isOnline(0),true);
 await clock.advance(2);assert.equal(b.Sync.isOnline(0),false);
});
test('pose cadence and newer revisions survive a sender clock correction',async()=>{
 const{a,b,clock}=await fixture();clock.offsets.set(0,60000);
 a.Sync.setPosition(pose(0));await clock.advance(0);
 clock.offsets.set(0,0);a.Sync.setPosition(pose(.5));await clock.advance(1000);
 assert.equal(b.state.positions[0].x,.5,'Corrected sender clock delayed or rejected a fresh pose');
 a.Sync.setPosition(pose(1,2,'idle'),{stopped:true});await clock.advance(0);
 assert.equal(b.state.positions[0].x,1);assert.equal(b.state.positions[0].motion,'idle');
});
