#!/usr/bin/env node
'use strict';
// Two real browser clients, real WebGL/FPUI, and an isolated PocketBase server.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),ART=path.join(ROOT,'android/artifacts/first-person');
const credentials=JSON.parse(fs.readFileSync(process.env.FP_TEST_CREDENTIALS||path.join(os.homedir(),'.local/share/couple-room/fp-candidate-credentials.json'),'utf8'));
const server=process.env.FP_TEST_SERVER||credentials.server;
const endpoint=new URL(server);
assert(endpoint.protocol==='https:'&&endpoint.pathname.includes('/validation/'),'Use an isolated /validation/ backend, never the production room');
const secrets=credentials.accounts.map(a=>a.password);
const redact=s=>secrets.reduce((text,key)=>text.split(key).join('<redacted>'),String(s)).replace(/token=[^\s&"']+/g,'token=<redacted>');
const checks=[],errors=[],pages=[];
fs.mkdirSync(ART,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
async function check(name,fn){
  const start=Date.now();
  try{await fn();checks.push({check:name,passed:true,seconds:+((Date.now()-start)/1000).toFixed(2)});}
  catch(error){checks.push({check:name,passed:false,error:redact(error.message)});throw error;}
}
async function client(who){
  const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  await context.addInitScript(url=>localStorage.setItem('couple-room-server',url),server);
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(redact(e.message)));
  await page.route('https://appassets.androidplatform.net/assets/www/**',async route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/assets/www/'.length));
    const file=path.resolve(ROOT,'web',relative),base=path.resolve(ROOT,'web')+path.sep;
    if(!file.startsWith(base)||!fs.existsSync(file))return route.fulfill({status:404,body:'missing asset'});
    const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf'};
    return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://appassets.androidplatform.net/assets/www/index.html');
  await page.locator(`[data-w="${who}"]`).click();
  await page.locator('#lg-pw').fill(credentials.accounts[who].password);
  await page.locator('#lg-go').click();
  await page.waitForFunction(()=>window.App&&App.firstPerson,null,{timeout:45000});
  await page.waitForSelector('.fp-tut.on',{timeout:30000});
  await page.locator('.fp-tut button').click();
  await page.waitForFunction(()=>!App.firstPerson.getSnapshot().blocked,null,{timeout:10000});
  await page.evaluate(()=>{
    window.__plays=[];window.__heads=[0,0];
    for(const who of [0,1]){
      const c=App.firstPerson.getCharacter(who),play=c.play;
      c.play=function(name){window.__plays.push({who,name});return play.call(this,name);};
      const head=c.setHeadYaw;c.setHeadYaw=function(angle){window.__heads[who]=angle;return head.call(this,angle);};
    }
  });
  pages.push(page);return page;
}
const snapshot=p=>p.evaluate(()=>App.firstPerson.getSnapshot());
async function keyMove(page,key,duration){
  await page.keyboard.down(key);await delay(duration);await page.keyboard.up(key);await delay(200);
}
async function look(page,yaw,pitch=0){
  const current=await snapshot(page);
  const wrapped=Math.atan2(Math.sin(yaw-current.position.ry),Math.cos(yaw-current.position.ry));
  let dx=-wrapped/.005,dy=-(pitch-current.pitch)/.005;
  if(Math.abs(dx)+Math.abs(dy)<1)return;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx)/200,Math.abs(dy)/140)));
  for(let n=0;n<steps;n++){
    const sx=dx>=0?70:320,sy=dy>=0?250:420;
    await page.mouse.move(sx,sy);await page.mouse.down();
    await page.mouse.move(sx+dx/steps,sy+dy/steps,{steps:5});await page.mouse.up();
  }
  await delay(150);
}
async function touchPair(page,points,liftFirst=true){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points[liftFirst?1:0]]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();await delay(200);
}
async function walkTo(page,x,z){
  const p=await snapshot(page),dx=x-p.position.x,dz=z-p.position.z;
  const distance=Math.hypot(dx,dz);if(distance<.08)return;
  await look(page,Math.atan2(dx,dz),0);await page.keyboard.down('KeyW');
  try{await page.waitForFunction(({x,z})=>{const p=App.firstPerson.getSnapshot().position;return Math.hypot(p.x-x,p.z-z)<.09;},{x,z},{timeout:15000});}
  finally{await page.keyboard.up('KeyW');}
  await delay(150);
}
async function aimAtToy(page,who){
  const point=await page.evaluate(w=>{
    const toy=App.firstPerson.getCharacter(0).group.parent.getObjectByName('sofa-plush-'+w);
    toy.updateWorldMatrix(true,false);return toy.localToWorld(new THREE.Vector3(.235,.55,0)).toArray();
  },who);
  const p=await snapshot(page),dx=point[0]-p.position.x,dz=point[2]-p.position.z;
  await look(page,Math.atan2(dx,dz),Math.atan2(point[1]-1.36,Math.hypot(dx,dz)-.3));
}
async function run(){
  const executable=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser=await chromium.launch({...(fs.existsSync(executable)?{executablePath:executable}:{}),headless:true,
    args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(process.env.FP_SOFTWARE_WEBGL?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
  let a,b;
  await check('login_entry_tutorial_and_real_webgl',async()=>{
    a=await client(0);b=await client(1);
    assert.equal((await snapshot(a)).view,'fp');assert.equal((await snapshot(b)).view,'fp');
    await a.screenshot({path:path.join(ART,'browser-a-first-person.png')});
    await b.screenshot({path:path.join(ART,'browser-b-first-person.png')});
  });
  await check('original_sofa_keepsakes_coexist_with_characters_in_both_views',async()=>{
    const toys=()=>a.evaluate(()=>[0,1].map(w=>{
      const p=App.firstPerson.getCharacter(0).group.parent.getObjectByName('sofa-plush-'+w),position=p.getWorldPosition(new THREE.Vector3());
      return {visible:p.visible,kind:p.userData.meta.kind,who:p.userData.meta.i,position:position.toArray(),clickable:p.children.some(c=>c.isMesh&&c.userData.owner===p)};
    }));
    const before=await toys();
    assert(before.every((p,w)=>p.visible&&p.clickable&&p.kind==='plush'&&p.who===w));
    assert.deepEqual(before.map(p=>p.position),[[-4.3,.76,-.87],[-4.3,.76,.30000000000000004]]);
    assert.equal(await a.evaluate(()=>App.firstPerson.getCharacter(0).group.visible),false);
    await a.locator('[data-view="overview"]').click();assert.equal(await a.evaluate(()=>App.firstPerson.getCharacter(0).group.visible),true);
    assert.deepEqual(await toys(),before);await a.screenshot({path:path.join(ART,'browser-restored-sofa-overview.png')});
    await a.locator('[data-view="fp"]').click();assert.deepEqual(await toys(),before);
  });
  await check('partner_arrow_and_two_account_presence',async()=>{
    await a.waitForFunction(()=>App.online(1)&&App.state.positions[1]&&App.firstPerson.getSnapshot().partner.motion!=='sit',null,{timeout:15000});
    await a.waitForFunction(()=>document.querySelector('.fp-partner').classList.contains('on'),null,{timeout:5000});
    assert(parseFloat(await a.locator('.fp-partner').evaluate(el=>el.style.getPropertyValue('--rot')))>0);
  });
  await check('far_photo_cannot_be_interacted_with',async()=>{
    const p=await snapshot(a),dx=-.45-p.position.x,dz=-4.94-p.position.z;
    await look(a,Math.atan2(dx,dz),Math.atan2(2.6-1.36,Math.hypot(dx,dz)-.3));
    assert.equal(await a.locator('.fp-act').getAttribute('aria-disabled'),'true');
    await a.locator('.fp-act').click({force:true});assert.equal(await a.locator('.scrim').count(),0);
    await look(a,Math.PI,0);
  });
  await check('movement_reaches_partner_and_is_seen_by_the_other_client',async()=>{
    const before=await snapshot(a);
    await a.keyboard.down('KeyW');
    try{await a.waitForFunction(z=>App.firstPerson.getSnapshot().position.z<z-.6,before.position.z,{timeout:15000});}
    finally{await a.keyboard.up('KeyW');}
    await a.keyboard.down('KeyD');
    try{await a.waitForFunction(x=>App.firstPerson.getSnapshot().position.x>x+.5,before.position.x,{timeout:15000});}
    finally{await a.keyboard.up('KeyD');}
    await delay(300);
    const moved=await snapshot(a);assert(before.position.z-moved.position.z>.3);assert(moved.position.x>before.position.x+.25);
    await b.waitForFunction(expected=>Math.hypot(App.firstPerson.getSnapshot().partner.x-expected.x,App.firstPerson.getSnapshot().partner.z-expected.z)<.12,moved.position,{timeout:15000});
    await b.waitForFunction(()=>window.__heads.every(angle=>Math.abs(angle)>.1),null,{timeout:5000});
    await b.screenshot({path:path.join(ART,'browser-partner-arrived.png')});
  });
  await check('wave_is_played_once_on_both_clients',async()=>{
    await a.locator('[data-emote="wave"]').click();
    await b.waitForFunction(()=>window.__plays.some(e=>e.who===0&&e.name==='wave'),null,{timeout:15000});
    assert.equal(await b.evaluate(()=>window.__plays.filter(e=>e.who===0&&e.name==='wave').length),1);
    assert.equal(await a.evaluate(()=>window.__plays.filter(e=>e.who===0&&e.name==='wave').length),1);
  });
  await check('poking_partner_uses_actual_ui_and_notifies_the_other_phone_ui',async()=>{
    const p=await snapshot(a),target=await b.evaluate(()=>App.state.positions[1]);
    await look(a,Math.atan2(target.x-p.position.x,target.z-p.position.z),0);
    await a.waitForFunction(()=>App.firstPerson.getSnapshot().target==='plush',null,{timeout:10000});
    await a.locator('.fp-act').click();
    await b.waitForSelector('.fp-poke.on',{timeout:15000});
    assert((await b.locator('.fp-poke b').textContent()).includes(credentials.accounts[0].name));
    const line=await b.locator('.fp-poke div span').textContent();
    assert((await a.locator('.bubble').textContent()).endsWith(line),'The two clients displayed different poke lines');
    assert((await b.evaluate(()=>window.__plays.filter(e=>e.who===1&&e.name==='jump').length))>=1);
    await b.screenshot({path:path.join(ART,'browser-received-poke.png')});
  });
  await check('mood_panel_updates_the_remote_character',async()=>{
    await a.evaluate(()=>App.act('mood',0));await a.locator('[data-mood="sleepy"]').click();
    await b.waitForFunction(()=>App.firstPerson.getCharacter(0).getMood()==='sleepy',null,{timeout:15000});
    await a.locator('[data-mood="happy"]').click();await a.locator('.scrim .x').click();
    await b.waitForFunction(()=>App.firstPerson.getCharacter(0).getMood()==='happy',null,{timeout:15000});
  });
  await check('offline_partner_returns_to_sofa_and_online_partner_interpolates_back',async()=>{
    await b.evaluate(()=>Sync.setPresence(false));
    await a.waitForFunction(()=>App.firstPerson.getSnapshot().partner.motion==='sit',null,{timeout:15000});
    const seated=(await snapshot(a)).partner;assert.equal(seated.x,-3.75);assert.equal(seated.y,.36);assert.equal(seated.z,-.25);
    assert(await a.evaluate(()=>[0,1].every(w=>App.firstPerson.getCharacter(0).group.parent.getObjectByName('sofa-plush-'+w).visible)));
    await b.evaluate(()=>Sync.setPresence(true));
    await a.waitForFunction(()=>App.firstPerson.getSnapshot().partner.motion!=='sit',null,{timeout:15000});
  });
  await check('restored_toys_keep_mood_poke_bounce_and_remote_notice',async()=>{
    await b.evaluate(()=>Sync.setPresence(false));
    try{
      await a.waitForFunction(()=>App.firstPerson.getSnapshot().partner.motion==='sit',null,{timeout:15000});
      await walkTo(a,(await snapshot(a)).position.x,-.87);await walkTo(a,-2.6,-.87);await aimAtToy(a,0);
      await a.waitForFunction(()=>document.querySelector('.fp-target b').textContent.includes('我的心情'),null,{timeout:5000});
      await a.locator('.fp-act').click();await a.waitForSelector('.moods');
      await a.locator('[data-mood="hungry"]').click();await a.locator('.scrim .x').click();
      await b.waitForFunction(()=>App.firstPerson.getCharacter(0).getMood()==='hungry',null,{timeout:15000});
      await aimAtToy(a,0);await a.locator('.fp-act').click();await a.locator('[data-mood="happy"]').click();await a.locator('.scrim .x').click();
      await walkTo(a,-2.6,1.15);await aimAtToy(a,1);
      await a.waitForFunction(()=>document.querySelector('.fp-target b').textContent.includes('戳戳'),null,{timeout:5000});
      await a.screenshot({path:path.join(ART,'browser-restored-sofa-first-person.png')});
      await a.locator('.fp-act').click();
      assert(await a.evaluate(()=>App.firstPerson.getCharacter(0).group.parent.getObjectByName('sofa-plush-1').userData.bounce>0));
      await a.waitForSelector('.bubble.on');await b.waitForSelector('.fp-poke.on',{timeout:15000});
      const line=await b.locator('.fp-poke div span').textContent();assert((await a.locator('.bubble').textContent()).endsWith(line));
      await a.screenshot({path:path.join(ART,'browser-restored-toy-poke.png')});
    }finally{await b.evaluate(()=>Sync.setPresence(true));}
    await walkTo(a,-.05,1.15);
  });
  await check('near_photo_highlights_and_opens_original_panel',async()=>{
    await look(a,Math.PI,0);await a.keyboard.down('KeyW');
    try{await a.waitForFunction(()=>App.firstPerson.getSnapshot().position.z<=-3,null,{timeout:20000});}finally{await a.keyboard.up('KeyW');}
    const p=await snapshot(a),dx=-.45-p.position.x,dz=-4.94-p.position.z;
    await look(a,Math.atan2(dx,dz),Math.atan2(2.6-1.36,Math.hypot(dx,dz)-.3));
    await a.waitForFunction(()=>App.firstPerson.getSnapshot().target==='photo',null,{timeout:10000});
    assert((await snapshot(a)).highlighted);
    await a.screenshot({path:path.join(ART,'browser-photo-target.png')});
    // Native Chromium touch dispatch, not JS dispatchEvent: multi-touch release
    // must not trigger FPUI's per-pointer tap events on the nearby photo.
    await touchPair(a,[{id:1,x:190,y:400},{id:2,x:210,y:400}]);
    assert.equal(await a.locator('.scrim').count(),0,'Stationary two-finger release opened a photo');
    await a.locator('.fp-act').click();await a.waitForSelector('.scrim');
    const before=await snapshot(a);await keyMove(a,'KeyW',300);const after=await snapshot(a);
    assert(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)<.001,'Panel did not stop movement');
    await a.screenshot({path:path.join(ART,'browser-original-photo-panel.png')});await a.locator('.scrim .x').click();
  });
  await check('menu_clears_held_movement_without_resuming_stale_input',async()=>{
    await look(a,Math.PI,0);await a.keyboard.down('KeyS');await delay(150);
    await a.locator('.fp-menu').click();const before=await snapshot(a);await delay(350);
    await a.keyboard.up('KeyS');await a.locator('.fp-menu').click();await delay(350);
    const after=await snapshot(a);assert(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)<.03);
  });
  await check('overview_and_restart_remember_view_without_replaying_actions',async()=>{
    await a.locator('[data-view="overview"]').click();assert.equal((await snapshot(a)).view,'overview');
    await a.screenshot({path:path.join(ART,'browser-overview.png')});await a.reload();
    await a.waitForFunction(()=>window.App&&App.firstPerson,null,{timeout:45000});
    assert.equal((await snapshot(a)).view,'overview');assert.equal((await snapshot(a)).entering,false);
    assert.equal(await a.locator('.fp-poke.on').count(),0);
    const count=await b.evaluate(()=>window.__plays.filter(e=>e.who===0&&e.name==='wave').length);
    await b.evaluate(()=>Sync.reload());await delay(1500);
    assert.equal(await b.evaluate(()=>window.__plays.filter(e=>e.who===0&&e.name==='wave').length),count);
  });
  await check('no_runtime_errors',async()=>assert.deepEqual(errors,[]));
}
(async()=>{
  let failure=null;
  try{await run();}catch(error){failure=redact(error.message);}
  const observations=[];
  for(const page of pages){try{
    observations.push(await snapshot(page));
    if(failure&&await page.locator('.login').count()===0)await page.screenshot({path:path.join(ART,'browser-failure-'+pages.indexOf(page)+'.png')});
    await page.evaluate(()=>Sync.setPresence(false));
  }catch(_){} }
  if(browser)await browser.close();
  const result={passed:!failure,checks,failure,observations,environment:'Two headless Chromium/WebGL clients with real isolated PocketBase; not physical Android performance acceptance'};
  fs.writeFileSync(path.join(ART,'browser-e2e.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));process.exitCode=failure?1:0;
})();
