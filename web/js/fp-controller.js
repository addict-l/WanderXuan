/* Runtime wiring for Claude's FPUI and CoupleChars. Neither module owns state. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FirstPersonController=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VIEW_KEY='couple-room-view';
function create(options){
  const {THREE,world,App:A,scene,camera,renderer,orbit,FPUI,CoupleChars}=options;
  const state=A.state,canvas=renderer.domElement;
  const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const mobile=()=>canvas.clientWidth/canvas.clientHeight<.8;
  const coarse=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches);
  const lowTier=coarse&&((navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4);
  const chars=[0,1].map(w=>CoupleChars.create(THREE,{who:w,outline:!lowTier}));
  const eye=new THREE.Vector3(),forward=new THREE.Vector3(),lookAt=new THREE.Vector3();
  const projected=new THREE.Vector3(),matrix=new THREE.Matrix4(),endQuat=new THREE.Quaternion();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),center=new THREE.Vector2(0,0);
  let self=state.me===1?1:0,yaw=world.SPAWNS[self].ry,pitch=0,view='overview';
  let moving=false,transition=null,enterToken=0,disposed=false,focused=true;
  let blockedBefore=false,clearing=false,target=null,highlight=[],multiLook=false;
  let pointerEpoch=0;
  let interactionSource=null;
  let remoteStamp='',remoteBlend=null,remoteReceivedAt=0;
  let nameKey='',frameCount=0,frameTotal=0,frameStart=performance.now(),fps=0;
  const moods=[null,null];
  const pointers=new Map(),disposers=[];
  const overview={position:camera.position.clone(),target:orbit.target.clone()};
  let preferred='fp';
  try{if(localStorage.getItem(VIEW_KEY)==='overview')preferred='overview';}catch(_){}
  const ui=FPUI.mount({names:[...state.names],me:self,view:'overview'});
  const partnerIndicator=ui.el.querySelector('.fp-partner');
  chars.forEach((c,w)=>{
    const spawn=world.SPAWNS[w];c.group.position.set(spawn.x,0,spawn.z);c.group.rotation.y=spawn.ry;
    scene.add(c.group);c.group.userData.characterWho=w;
    if(options.registerCharacter)options.registerCharacter(c.group,w);
  });
  function listen(element,event,fn,opts){element.addEventListener(event,fn,opts);disposers.push(()=>element.removeEventListener(event,fn,opts));}
  function blocked(){
    return document.hidden||!focused||!!transition||ui.el.classList.contains('blocked')||
      ui.el.classList.contains('menu-open')||!!document.querySelector('.scrim, .login, .fp-tut.on, .fp-enter.show');
  }
  function clearInputs(){
    if(clearing)return;
    clearing=true;
    for(const [id,element] of [...pointers]){
      let event;
      try{event=new PointerEvent('pointercancel',{pointerId:id,bubbles:true});}
      catch(_){event=new Event('pointercancel',{bubbles:true});Object.defineProperty(event,'pointerId',{value:id});}
      element.dispatchEvent(event);
    }
    pointers.clear();
    pointerEpoch++;multiLook=false;
    // FPUI exposes no reset method. Its existing blur handler clears WASD;
    // pointercancel above uses its existing joystick/look cancellation paths.
    window.dispatchEvent(new Event('blur'));
    ui.getMove(); // Refresh FPUI's walking fade after clearing held input.
    clearing=false;
  }
  function publish(stopped){
    if(A.setPosition)A.setPosition({x:chars[self].group.position.x,z:chars[self].group.position.z,
      ry:yaw,motion:moving?'walk':'idle'},{stopped:!!stopped});
  }
  function stop(){const wasMoving=moving;moving=false;chars[self].setMotion('idle');if(wasMoving)publish(true);}
  function setProjection(){
    camera.fov=view==='fp'?(mobile()?70:55):(mobile()?60:36);
    camera.near=view==='fp'?.05:.1;camera.updateProjectionMatrix();
  }
  function clearHighlight(){for(const [material,color] of highlight)material.emissive.copy(color);highlight=[];}
  function setTarget(next){
    if(next===target)return;
    clearHighlight();target=next;
    if(target){
      const seen=new Set();
      target.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material||[])){
        if(!m.emissive||seen.has(m))continue;seen.add(m);highlight.push([m,m.emissive.clone()]);
        m.emissive.add(new THREE.Color(.13,.07,.025));
      }});
      const meta=target.userData.meta;
      ui.setTarget({label:typeof meta.label==='function'?meta.label():meta.label,
        hint:meta.kind==='plush'&&meta.i===1-self?'点一下戳戳 TA':'点一下打开'});
    }else ui.setTarget(null);
  }
  function visible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
  function hitAt(point){
    camera.updateMatrixWorld(true);ray.setFromCamera(point,camera);ray.near=0;ray.far=2.5;
    return ray.intersectObjects(options.hot,false).find(h=>{
      const owner=h.object.userData.owner;
      return owner&&visible(h.object)&&owner.userData.characterWho!==self;
    })||null;
  }
  function interactAt(point){
    if(view!=='fp'||blocked())return;
    const hit=hitAt(point);if(!hit)return;
    const owner=hit.object.userData.owner;
    stop();clearInputs();setTarget(null);activate(owner);
  }
  function activate(owner){
    if(!owner||!owner.userData.meta)return;
    const previous=interactionSource;interactionSource=owner;
    try{const meta=owner.userData.meta;return A.act(meta.kind,meta.i);}
    finally{interactionSource=previous;}
  }
  function eyePosition(){
    chars[self].getEyeWorldPosition(eye);
    if(reduced())eye.set(0,chars[self].info.eyeHeight,.3).applyMatrix4(chars[self].group.matrixWorld);
    return eye;
  }
  function setFirstPersonCamera(){
    eyePosition();forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    camera.position.copy(eye);camera.lookAt(lookAt.copy(eye).add(forward));camera.updateMatrixWorld(true);
  }
  function restoreOverview(){
    const damping=orbit.enableDamping;orbit.enableDamping=false;orbit.update();
    camera.position.copy(overview.position);orbit.target.copy(overview.target);orbit.update();
    orbit.enableDamping=damping;orbit.enabled=true;
  }
  function setView(next,persist=true){
    if(next!=='fp'&&next!=='overview')return;
    const previous=view;
    if(previous==='overview'&&!transition){overview.position.copy(camera.position);overview.target.copy(orbit.target);}
    enterToken++;transition=null;stop();clearInputs();setTarget(null);view=next;ui.setView(next);
    if(persist)try{localStorage.setItem(VIEW_KEY,next);}catch(_){}
    orbit.enabled=next==='overview';chars[self].group.visible=next==='overview';setProjection();
    if(next==='overview'){restoreOverview();ui.setPartner({visible:false});}
    else{setFirstPersonCamera();ui.showTutorial();}
    if(options.onViewChange)options.onViewChange(next);
  }
  function playPoke(w,line){
    if(options.onPoke)options.onPoke(w,line||A.pokeLine(w),interactionSource);
    else chars[w].play('jump');
  }
  function resize(width,height){
    if(!(width>0&&height>0))return;
    camera.aspect=width/height;orbit.maxDistance=width/height<.8?30:26;setProjection();
  }
  function beginEntry(){
    const token=++enterToken;
    orbit.enabled=false;
    if(reduced()){
      view='fp';ui.setView('fp');chars[self].group.visible=false;setProjection();setFirstPersonCamera();
      ui.playEnter(state.names[self]).then(()=>{if(!disposed&&token===enterToken&&view==='fp')ui.showTutorial();});
      return;
    }
    transition={start:performance.now()+1000,from:camera.position.clone(),quaternion:camera.quaternion.clone(),started:false,token};
  }
  function updateEntry(now){
    if(!transition)return false;
    const t=transition;if(now<t.start)return true;
    if(!t.started){
      t.started=true;view='fp';ui.setView('fp');chars[self].group.visible=false;setProjection();
      ui.playEnter(state.names[self]).then(()=>{if(!disposed&&t.token===enterToken&&view==='fp')ui.showTutorial();});
    }
    const p=Math.min(1,(now-t.start)/1200),ease=p*p*(3-2*p);
    eyePosition();forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    endQuat.setFromRotationMatrix(matrix.lookAt(eye,lookAt.copy(eye).add(forward),camera.up));
    camera.position.lerpVectors(t.from,eye,ease);camera.quaternion.slerpQuaternions(t.quaternion,endQuat,ease);
    if(p===1)transition=null;
    return true;
  }
  function updateRemote(now){
    const w=1-self,c=chars[w],p=state.positions&&state.positions[w];
    c.group.visible=true;
    if(!A.online(w)||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.ry)){
      // Sit between the two original keepsakes, toward the cushion's front,
      // rather than occupying either toy's original seat.
      c.group.position.set(-3.75,.76-c.info.seatOffset,-.25);c.group.rotation.y=Math.PI/2;
      c.setMotion('sit');remoteStamp='';remoteBlend=null;return;
    }
    const stamp=[p.at,p.x,p.z,p.ry,p.motion].join(':');
    if(stamp!==remoteStamp){
      const valid=world.resolvePosition(p,c.info.radius);
      remoteBlend={start:now,from:{x:c.group.position.x,z:c.group.position.z,ry:c.group.rotation.y},
        fromY:c.group.position.y,to:{...p,x:valid.x,z:valid.z}};
      remoteStamp=stamp;remoteReceivedAt=now;
    }
    if(remoteBlend){
      const progress=Math.min(1,(now-remoteBlend.start)/400);
      const pose=world.interpolatePose(remoteBlend.from,remoteBlend.to,progress);
      c.group.position.set(pose.x,remoteBlend.fromY*(1-progress),pose.z);c.group.rotation.y=pose.ry;
    }
    c.setMotion(p.motion==='walk'&&now-remoteReceivedAt<1800?'walk':'idle');
  }
  function updatePartnerArrow(){
    const w=1-self;chars[w].getEyeWorldPosition(projected);
    const dx=projected.x-camera.position.x,dz=projected.z-camera.position.z,distance=Math.hypot(dx,dz);
    projected.project(camera);
    const inFrame=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1;
    ui.setPartner({visible:!inFrame,angle:world.wrapAngle(yaw-Math.atan2(dx,dz)),distance,name:state.names[w]});
    if(!inFrame&&partnerIndicator){
      // FPUI supplies the bearing. Clamp its existing indicator away from
      // host cutouts without moving the canvas or the center aiming ray.
      const left=partnerIndicator.style.left,top=partnerIndicator.style.top;
      partnerIndicator.style.left=`clamp(calc(var(--safe-left,0px) + 46px),${left},calc(100% - var(--safe-right,0px) - 46px))`;
      partnerIndicator.style.top=`clamp(calc(var(--safe-top,0px) + 110px),${top},calc(100% - var(--safe-bottom,0px) - 90px))`;
    }
  }
  function update(dt){
    if(disposed)return;
    const now=performance.now(),blockedNow=blocked();
    frameCount++;frameTotal+=now-frameStart;frameStart=now;
    if(frameTotal>=2000){fps=frameCount*1000/frameTotal;frameCount=0;frameTotal=0;}
    if(blockedNow!==blockedBefore){clearInputs();blockedBefore=blockedNow;}
    const nextSelf=state.me===1?1:0;
    if(nextSelf!==self){
      stop();self=nextSelf;yaw=world.SPAWNS[self].ry;pitch=0;
      chars[self].group.position.set(world.SPAWNS[self].x,0,world.SPAWNS[self].z);remoteStamp='';publish(true);
    }
    const names=state.names.join('\0')+self;
    if(names!==nameKey){nameKey=names;ui.setMe(self,[...state.names]);}
    chars.forEach((c,w)=>{if(moods[w]!==state.moods[w]){moods[w]=state.moods[w];c.setMood(moods[w]);}});
    let nextMoving=false;
    if(view==='fp'&&!blockedNow){
      const move=ui.getMove(),c=chars[self];
      const p=world.move(c.group.position,move,yaw,dt,c.info.radius);
      c.group.position.x=p.x;c.group.position.z=p.z;nextMoving=p.moving;
    }
    const stopped=moving&&!nextMoving;moving=nextMoving;chars[self].group.rotation.y=yaw;
    chars[self].setMotion(moving?'walk':'idle');chars[self].group.visible=view==='overview'&&!(transition&&transition.started);
    if(!document.hidden)publish(stopped);
    updateRemote(now);
    const distance=chars[0].group.position.distanceTo(chars[1].group.position);
    chars.forEach((c,w)=>{
      const other=chars[1-w].group.position;
      c.setHeadYaw(distance<1.2?world.wrapAngle(Math.atan2(other.x-c.group.position.x,other.z-c.group.position.z)-c.group.rotation.y):0);
      c.update(dt);c.group.updateMatrixWorld(true);
    });
    if(updateEntry(now)){setTarget(null);return;}
    if(view==='overview'){orbit.update();return;}
    setFirstPersonCamera();
    if(blockedNow)setTarget(null);
    else{const hit=hitAt(center);setTarget(hit?hit.object.userData.owner:null);}
    updatePartnerArrow();
  }
  function getSnapshot(){
    const c=chars[self],other=chars[1-self];
    return {view,self,entering:!!transition,position:{x:c.group.position.x,z:c.group.position.z,ry:yaw},pitch,
      moving,blocked:blocked(),partner:{x:other.group.position.x,y:other.group.position.y,z:other.group.position.z,
        ry:other.group.rotation.y,motion:other.getMotion()},target:target?target.userData.meta.kind:null,
      highlighted:highlight.length>0,fps:Number(fps.toFixed(1)),outline:!lowTier};
  }
  ui.on('look',({dx,dy})=>{if(view==='fp'&&!blocked()&&!multiLook){yaw=world.wrapAngle(yaw-dx*.005);pitch=world.clampPitch(pitch-dy*.005);}});
  ui.on('tap',({x,y})=>{if(multiLook)return;const r=canvas.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);interactAt(pointer);});
  ui.on('interact',()=>interactAt(center));
  ui.on('emote',name=>{if(view==='fp'&&!blocked()&&A.sendEmote)A.sendEmote(name);});
  ui.on('view',v=>setView(v));
  ui.on('menu',()=>{stop();clearInputs();setTarget(null);});
  ui.on('moveend',()=>{if(!ui.getMove().active)stop();});
  const lookPointers=()=>[...pointers.values()].filter(el=>el.closest&&el.closest('.fp-look')).length;
  listen(ui.el,'pointerdown',e=>{
    if(e.target.closest&&e.target.closest('.fp-look')&&!lookPointers())multiLook=false;
    pointerEpoch++;pointers.set(e.pointerId,e.target);if(lookPointers()>1)multiLook=true;
  },true);
  const releasePointer=e=>{
    pointers.delete(e.pointerId);const epoch=++pointerEpoch;
    // Native pointer dispatch can run microtasks between capture and target
    // listeners. Keep the whole multi-touch gesture blocked through lookUp.
    if(!lookPointers())setTimeout(()=>{if(epoch===pointerEpoch&&!lookPointers())multiLook=false;},0);
  };
  listen(window,'pointerup',releasePointer,true);
  listen(window,'pointercancel',releasePointer,true);
  listen(window,'keydown',e=>{
    const t=e.target,typing=t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName));
    // FPUI handles E when body is focused; preserve it after a toolbar button
    // gets focus too, without overriding Enter or typing in an existing panel.
    if(!e.defaultPrevented&&!e.repeat&&!typing&&e.code==='KeyE'&&view==='fp'&&!blocked()){
      e.preventDefault();interactAt(center);
    }
  });
  listen(window,'blur',()=>{if(!clearing){focused=false;clearInputs();stop();setTarget(null);}});
  listen(window,'focus',()=>{focused=true;clearInputs();});
  listen(document,'visibilitychange',()=>{
    clearInputs();stop();focused=!document.hidden;
    if(window.Sync&&Sync.setPresence)Sync.setPresence(!document.hidden);
  });
  listen(window,'pagehide',()=>{stop();if(window.Sync&&Sync.setPresence)Sync.setPresence(false);});
  A.on((event,data)=>{
    if(event==='poke'){
      const sent=[...((state.gestures&&state.gestures[self])||[])].reverse().find(e=>e.type==='poke'&&e.to===data);
      playPoke(data,sent&&sent.line||A.pokeLine(data));
    }
    else if(event==='emote'||event==='remote-emote'){if(data&&chars[data.who])chars[data.who].play(data.name);}
    else if(event==='remote-poke'&&data&&data.to===self){playPoke(self,data.line);ui.notifyPoke(state.names[data.from],data.line);}
    else if(['all','photos','books','mood','names'].includes(event))setTarget(null);
  });
  publish(true);
  if(window.Sync&&Sync.setPresence)Sync.setPresence(!document.hidden);
  if(preferred==='fp')beginEntry();else{orbit.enabled=true;setProjection();}
  return {update,resize,setView,activate,getView:()=>view,getSnapshot,getCharacter:w=>chars[w],
    allowsOverviewInput:()=>view==='overview'&&!transition&&!blocked(),
    destroy(){disposed=true;enterToken++;stop();clearHighlight();disposers.forEach(fn=>fn());ui.destroy();chars.forEach(c=>{
      if(options.unregisterCharacter)options.unregisterCharacter(c.group);c.dispose();
    });}};
}
return {create,VIEW_KEY};
});
