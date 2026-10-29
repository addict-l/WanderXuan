'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const W=require('../web/js/fp-world.js');
const results=[];
function check(name,fn){test(name,()=>{try{fn();results.push({check:name,passed:true});}catch(e){results.push({check:name,passed:false,failure:e.message});throw e;}});}
const near=(a,b,tolerance=1e-6)=>assert(Math.abs(a-b)<=tolerance,`${a} is not within ${tolerance} of ${b}`);

check('separate door spawns face into the room and are collision free',()=>{
  assert(W.SPAWNS.every(s=>W.isWalkable(s)));
  assert(Math.hypot(W.SPAWNS[0].x-W.SPAWNS[1].x,W.SPAWNS[0].z-W.SPAWNS[1].z)>.68);
  for(const s of W.SPAWNS)near(Math.cos(s.ry),-1);
});
check('camera-relative forward and right movement use consistent character yaw',()=>{
  const front=W.move({x:0,z:0},{x:0,y:1},Math.PI,.5);
  near(front.x,0);near(front.z,-.8);assert(front.moving);
  const right=W.move({x:0,z:0},{x:1,y:0},Math.PI,.5);
  near(right.x,.8);near(right.z,0);
  const facingEast=W.move({x:0,z:0},{x:0,y:1},Math.PI/2,.5);
  near(facingEast.x,.8);near(facingEast.z,0);
});
check('diagonal input is normalized and zero input stays still',()=>{
  const p=W.move({x:0,z:0},{x:1,y:1},Math.PI,.5);
  near(Math.hypot(p.x,p.z),.8);
  assert.deepEqual(W.move({x:0,z:0},{x:0,y:0},0,10),{x:0,z:0,moving:false});
});
check('all rectangular furniture has character-radius clearance, including internal stale poses',()=>{
  for(const r of W.RECTS){
    const center={x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2};
    assert(!W.isWalkable(center),`${r.name} center should block movement`);
    const recovered=W.resolvePosition(center);
    assert(W.isWalkable(recovered),`${r.name} stale pose should be repaired`);
    const z=r.maxZ+.34+.03;
    if(W.isWalkable({x:center.x,z})){
      const hit=W.move({x:center.x,z},{x:0,y:1},Math.PI,2);
      assert(hit.z>=r.maxZ+.34-1e-6,`${r.name} was crossed`);
      assert(W.isWalkable(hit),`${r.name} final pose is blocked`);
    }
  }
});
check('all circular furniture blocks its expanded radius and repairs exact center poses',()=>{
  for(const c of W.CIRCLES){
    assert(!W.isWalkable(c),`${c.name} center should block movement`);
    const recovered=W.resolvePosition(c);
    assert(W.isWalkable(recovered),`${c.name} center should be repaired`);
    assert(Math.hypot(recovered.x-c.x,recovered.z-c.z)>=c.radius+.34-1e-6);
    const start={x:c.x+c.radius+.34+.05,z:c.z};
    if(W.isWalkable(start)){
      const hit=W.move(start,{x:0,y:1},-Math.PI/2,1);
      assert(W.isWalkable(hit),`${c.name} final pose is blocked`);
      assert(hit.x>=c.x+c.radius+.34-1e-6,`${c.name} was crossed`);
    }
  }
});
check('each room boundary stops movement before leaving the usable floor',()=>{
  for(const [start,input,yaw,axis,bound] of [
    [{x:4,z:0},{x:0,y:1},Math.PI/2,'x',4.6],
    [{x:-3,z:-2.5},{x:0,y:1},-Math.PI/2,'x',-4.6],
    [{x:0,z:4},{x:0,y:1},0,'z',4.6],
    [{x:0,z:-3},{x:0,y:1},Math.PI,'z',-4.04]
  ]){
    const end=W.move(start,input,yaw,5);
    assert(W.isWalkable(end));
    // The back wall is reached through the cabinet's clearance first.
    near(end[axis],bound,.12);
  }
});
check('diagonal approaches slide along the sofa instead of sticking or entering it',()=>{
  const start={x:-3.2,z:-.8},end=W.move(start,{x:1,y:1},0,1);
  assert(end.z>start.z+.4,'Character should keep progressing along sofa front');
  assert(end.x>=-3.26-1e-6,'Sofa clearance was crossed');
  assert(W.isWalkable(end));
});
check('a long elapsed frame cannot tunnel through the cabinet or sofa',()=>{
  const back=W.move({x:0,z:3},{x:0,y:1},Math.PI,10);
  assert(back.z>=-4.04-1e-6&&W.isWalkable(back));
  const side=W.move({x:3,z:0},{x:1,y:0},0,10);
  assert(side.x>=-3.26-1e-6&&W.isWalkable(side));
});
check('repaired out-of-bounds and overlapping wall/furniture poses are usable',()=>{
  for(const p of [{x:-100,z:-100},{x:100,z:100},{x:-4.59,z:1.4},{x:-4.6,z:2.1},{x:4.5,z:-4.5}]){
    const recovered=W.resolvePosition(p);
    assert(W.isWalkable(recovered),`Failed repair for ${JSON.stringify(p)}`);
  }
});
check('repeated movement stays valid around every furniture footprint',()=>{
  let p={...W.SPAWNS[0]};
  // A pinned deterministic sweep stresses every direction and edge; it is
  // intentionally unrelated to the implementation's projection algorithm.
  for(let i=0;i<2500;i++){
    const yaw=i*.173,input={x:Math.sin(i*.313),y:Math.cos(i*.217)};
    p=W.move(p,input,yaw,.15);
    assert(W.isWalkable(p),`Blocked pose after sweep step ${i}`);
  }
});
check('look pitch clamps to sixty degrees and yaw interpolation uses the short arc',()=>{
  near(W.clampPitch(100),Math.PI/3);near(W.clampPitch(-100),-Math.PI/3);
  const middle=W.lerpAngle(Math.PI-.1,-Math.PI+.1,.5);
  near(Math.abs(middle),Math.PI);
  near(W.wrapAngle(8*Math.PI+.2),.2);
});
check('remote interpolation stays between samples and preserves the latest motion/timestamp',()=>{
  const from={x:0,z:1,ry:Math.PI-.1,motion:'idle',at:100};
  const to={x:2,z:-1,ry:-Math.PI+.1,motion:'walk',at:200};
  const mid=W.interpolatePose(from,to,.5);
  near(mid.x,1);near(mid.z,0);near(Math.abs(mid.ry),Math.PI);
  assert.equal(mid.motion,'walk');assert.equal(mid.at,200);
  near(W.interpolatePose(from,to,99).x,2);near(W.interpolatePose(from,to,-99).x,0);
});
check('invalid numeric network or input values cannot create NaN positions',()=>{
  assert(W.isWalkable(W.resolvePosition({x:NaN,z:Infinity})));
  const result=W.move({x:0,z:0},{x:Infinity,y:NaN},NaN,NaN);
  assert.deepEqual(result,{x:0,z:0,moving:false});
  const pose=W.interpolatePose({x:0,z:0,ry:0},{x:NaN,z:Infinity,ry:NaN},.5);
  assert(Number.isFinite(pose.x)&&Number.isFinite(pose.z)&&Number.isFinite(pose.ry));
});

test.after(()=>{
  const artifact=path.resolve(__dirname,'../android/artifacts/first-person/motion-tests.json');
  fs.mkdirSync(path.dirname(artifact),{recursive:true});
  fs.writeFileSync(artifact,JSON.stringify({passed:results.every(r=>r.passed),checks:results},null,2)+'\n');
});
