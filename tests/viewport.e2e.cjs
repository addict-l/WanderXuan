#!/usr/bin/env node
'use strict';
// Actual scene and UI, including old-WebView native safe-area fallback.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'android/artifacts/landscape');
const credentials=JSON.parse(fs.readFileSync(process.env.FP_TEST_CREDENTIALS||path.join(os.homedir(),'.local/share/couple-room/fp-candidate-credentials.json'),'utf8'));
const server=credentials.server,baseline=process.argv.includes('--baseline');
assert(new URL(server).pathname.includes('/validation/'),'Use an isolated validation server');
const checks=[],errors=[],observations=[];let browser,page;
const redact=s=>credentials.accounts.reduce((s,a)=>s.split(a.password).join('<redacted>'),String(s));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
fs.mkdirSync(output,{recursive:true});
async function bounds(selector){return page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>{const r=n.getBoundingClientRect();return {element:n.className||n.tagName,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));}
async function check(name,fn){try{await fn();checks.push({check:name,passed:true});}catch(error){checks.push({check:name,passed:false});throw error;}}
async function run(){
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  await context.addInitScript(server=>{
    localStorage.setItem('couple-room-server',server);
    localStorage.setItem('fpui-tutorial-done','1');
    localStorage.setItem('couple-room-view','fp');
  },server);
  page=await context.newPage();page.on('pageerror',e=>errors.push(redact(e.message)));
  await page.route('https://appassets.androidplatform.net/assets/www/**',route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/assets/www/'.length));
    const file=path.resolve(root,'web',relative);
    if(!file.startsWith(path.join(root,'web')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'missing asset'});
    const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf'};
    // Negative control: the previous app has no viewport stylesheet.
    return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:baseline&&relative==='css/viewport.css'?'':fs.readFileSync(file)});
  });
  await page.goto('https://appassets.androidplatform.net/assets/www/index.html');
  await page.locator('[data-w="1"]').click();await page.locator('#lg-pw').fill(credentials.accounts[1].password);await page.locator('#lg-go').click();
  await page.waitForFunction(()=>window.App&&App.firstPerson&&!App.firstPerson.getSnapshot().blocked,null,{timeout:45000});
  await check('hud_capsule_and_detail_use_upstream_design',async()=>{
    const pill=await page.locator('.hud-pill').boundingBox();assert.equal(pill.height,44);
    assert(await page.locator('.hud').evaluate(el=>getComputedStyle(el).paddingTop==='0px'&&getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'));
    await page.locator('.hud-pill').click();await page.waitForSelector('.hud-more');
    await page.locator('.hud-more [data-go="cal"]').click();await page.waitForSelector('.scrim');
    assert.equal(await page.locator('.hud-more').count(),0);await page.locator('.scrim .x').click();
    await page.locator('.hud-pill').click();await page.waitForSelector('.hud-more');
    await page.touchscreen.tap(200,400);await page.waitForSelector('.hud-more',{state:'detached'});
    await page.locator('.hud-pill').click();await page.waitForSelector('.hud-more');
    await page.waitForSelector('.hud-more',{state:'detached',timeout:8000});
  });
  await check('walking_to_overview_clears_capsule_fade_and_keeps_details_usable',async()=>{
    await page.keyboard.down('KeyW');
    await page.waitForFunction(()=>document.body.classList.contains('fp-moving'));
    try{await page.locator('[data-view="overview"]').click();}
    finally{await page.keyboard.up('KeyW');}
    await page.waitForFunction(()=>!document.body.classList.contains('fp-moving'),null,{timeout:1500});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hud')).opacity==='1',null,{timeout:1500});
    await page.locator('.hud-pill').click();await page.waitForSelector('.hud-more');
    await page.locator('.dock [data-go="todo"]').click();await page.waitForSelector('.scrim');
    assert.equal(await page.locator('.hud-more').count(),0);await page.locator('.scrim .x').click();
    await page.locator('[data-view="fp"]').click();
  });
  const pose=await page.evaluate(()=>App.firstPerson.getSnapshot().position);
  const cases=[
    {name:'portrait',w:393,h:852,t:48,r:0,b:24,l:0},
    {name:'landscape-left-cutout',w:852,h:393,t:0,r:0,b:24,l:54},
    {name:'landscape-right-cutout',w:852,h:393,t:0,r:54,b:24,l:0},
    {name:'compact-landscape',w:640,h:320,t:0,r:0,b:20,l:32},
    {name:'return-portrait',w:393,h:852,t:48,r:0,b:24,l:0},
  ];
  for(const c of cases){
    await page.setViewportSize({width:c.w,height:c.h});
    await page.evaluate(c=>{for(const [key,value] of Object.entries({top:c.t,right:c.r,bottom:c.b,left:c.l}))document.documentElement.style.setProperty('--android-safe-'+key,value+'px');},c);
    await pause(300);
    await check(c.name+'_canvas_and_center_aim_fill_viewport',async()=>{
      const [canvas]=await bounds('#stage canvas');
      assert.equal(canvas.x,0);assert.equal(canvas.y,0);assert.equal(canvas.width,c.w);assert.equal(canvas.height,c.h);
      const [aim]=await bounds('.fp-cross');assert(Math.abs(aim.x+aim.width/2-c.w/2)<1);assert(Math.abs(aim.y+aim.height/2-c.h/2)<1);
    });
    await check(c.name+'_controls_and_labels_avoid_cutout_and_gesture_edges',async()=>{
      for(const rect of await bounds('.hud, .fp-top, .fp-stick, .fp-act, .fp-emote, .fp-emote small, .fp-partner.on')){
        assert(rect.x>=c.l-.5,rect.element+' is behind the left cutout');
        assert(rect.right<=c.w-c.r+.5,rect.element+' is behind the right cutout');
        assert(rect.y>=c.t-.5,rect.element+' is behind the top cutout');
        assert(rect.bottom<=c.h-c.b+.5,rect.element+' is inside the home gesture area');
      }
      const [hud]=await bounds('.hud'),[toolbar]=await bounds('.fp-top');assert(hud.right<toolbar.x,'Name card overlaps view switch');
    });
    await check(c.name+'_original_panel_fits_and_keeps_close_button_reachable',async()=>{
      await page.evaluate(()=>App.act('settings'));
      await page.locator('.sheet').evaluate(el=>Promise.allSettled(el.getAnimations().map(animation=>animation.finished)));
      const [sheet]=await bounds('.sheet'),[close]=await bounds('.sheet .x');
      // A bottom sheet may paint behind the home area; its controls may not.
      assert(sheet.x>=c.l-.5&&sheet.right<=c.w-c.r+.5&&sheet.y>=c.t-.5&&sheet.bottom<=c.h+.5,'Panel escapes the viewport: '+JSON.stringify(sheet));
      assert(close.y>=c.t-.5&&close.bottom<=c.h-c.b+.5,'Panel close button is obscured');
      const last=page.locator('.sheet').locator('button,input,textarea,select').last();
      await last.scrollIntoViewIfNeeded();
      const rect=await last.boundingBox();assert(rect&&rect.y>=c.t-.5&&rect.y+rect.height<=c.h-c.b+.5,'Last panel control cannot be scrolled clear of the home area');
      await page.locator('.sheet').evaluate(el=>el.scrollTop=0);
      await page.locator('.sheet .x').click();
    });
    if(c.name==='landscape-left-cutout')await page.screenshot({path:path.join(output,'browser-wanru-landscape.png')});
  }
  await check('rotation_keeps_wanru_identity_position_and_view',async()=>{
    const snapshot=await page.evaluate(()=>App.firstPerson.getSnapshot());
    assert.equal(snapshot.self,1);assert.equal(snapshot.view,'fp');assert.deepEqual(snapshot.position,pose);
  });
  await check('room_light_moves_to_settings_and_survives_reload_locally',async()=>{
    await page.evaluate(()=>App.act('settings'));await page.locator('.set-row [data-t="night"]').click();
    assert.equal(await page.evaluate(()=>App.state.timeMode),'night');assert.equal(await page.evaluate(()=>localStorage.getItem('room-time-mode')),'night');
    await page.reload();await page.waitForFunction(()=>window.App&&App.firstPerson&&!App.firstPerson.getSnapshot().blocked,null,{timeout:45000});
    assert.equal(await page.evaluate(()=>App.state.timeMode),'night');
    await page.evaluate(()=>App.act('settings'));assert.equal(await page.locator('.set-row [data-t="night"]').getAttribute('aria-pressed'),'true');
    await page.locator('.set-row [data-t="auto"]').click();await page.locator('.scrim .x').click();
  });
  await page.setViewportSize({width:320,height:800});
  await page.evaluate(()=>{
    for(const edge of ['top','right','bottom','left'])document.documentElement.style.setProperty('--android-safe-'+edge,'0px');
    document.querySelector('.hud .dnum b').textContent='892';
  });await pause(200);
  const [pill]=await bounds('.hud-pill'),[toolbar]=await bounds('.fp-top');
  observations.push({scenario:'320px with 892-day label (display-only probe)',headerOverlapPx:Math.max(0,pill.right-toolbar.x),status:pill.right>toolbar.x?'UI owner follow-up':'fits'});
  await page.screenshot({path:path.join(output,'browser-hud-320.png')});
  await check('no_runtime_errors',async()=>assert.deepEqual(errors,[]));
}
(async()=>{
  let failure=null;try{await run();}catch(e){failure=redact(e.message);}
  if(page)try{await page.evaluate(()=>Sync.setPresence(false));}catch(_){}
  if(browser)await browser.close();
  const result={passed:!failure,baseline,checks,observations,failure,environment:'Real Chrome/WebGL + isolated PocketBase, Wanru account; injected numeric safe-area values model the Android host, not a physical phone'};
  fs.writeFileSync(path.join(output,baseline?'browser-viewport-before.json':'browser-viewport.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));process.exitCode=failure?1:0;
})();
