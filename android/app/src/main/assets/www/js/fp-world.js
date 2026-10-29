(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FPWorld=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

// Coordinates and character clearance are shared with docs/CHARACTERS.md.
const WALK_BOUNDS=Object.freeze({minX:-4.6,maxX:4.6,minZ:-4.6,maxZ:4.6});
const SPAWNS=Object.freeze([
  Object.freeze({x:-.65,z:3.4,ry:Math.PI}),
  Object.freeze({x:.65,z:3.4,ry:Math.PI})
]);
const RECTS=Object.freeze([
  Object.freeze({name:'bookshelf',minX:-4.9,maxX:-3.4,minZ:-5,maxZ:-4.49}),
  Object.freeze({name:'cabinet',minX:-2.8,maxX:.8,minZ:-5,maxZ:-4.38}),
  Object.freeze({name:'desk',minX:1.35,maxX:3.95,minZ:-4.95,maxZ:-3.95}),
  Object.freeze({name:'fridge',minX:4.05,maxX:4.95,minZ:-5,maxZ:-4.1}),
  Object.freeze({name:'sofa',minX:-4.8,maxX:-3.6,minZ:-1.8,maxZ:1.3})
]);
const CIRCLES=Object.freeze([
  Object.freeze({name:'bin',x:1,z:-4.35,radius:.24}),
  Object.freeze({name:'floor-lamp',x:-4.45,z:1.75,radius:.24}),
  Object.freeze({name:'letter-table',x:-4.4,z:2.65,radius:.38}),
  Object.freeze({name:'tree',x:-4.2,z:3.85,radius:.33})
]);
const EPS=1e-7,TAU=2*Math.PI;
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const radiusOf=r=>clamp(finite(r,.34),.05,1);
const point=p=>({x:finite(p&&p.x,SPAWNS[0].x),z:finite(p&&p.z,SPAWNS[0].z)});
const distance2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;

function wrapAngle(angle){return ((finite(angle,0)+Math.PI)%TAU+TAU)%TAU-Math.PI;}
function lerpAngle(from,to,progress){
  return wrapAngle(finite(from,0)+wrapAngle(finite(to,0)-finite(from,0))*clamp(finite(progress,0),0,1));
}
function clampPitch(angle){return clamp(finite(angle,0),-Math.PI/3,Math.PI/3);}
function inBounds(p){return p.x>=WALK_BOUNDS.minX-EPS&&p.x<=WALK_BOUNDS.maxX+EPS&&p.z>=WALK_BOUNDS.minZ-EPS&&p.z<=WALK_BOUNDS.maxZ+EPS;}
function clampBounds(p){
  p.x=clamp(p.x,WALK_BOUNDS.minX,WALK_BOUNDS.maxX);
  p.z=clamp(p.z,WALK_BOUNDS.minZ,WALK_BOUNDS.maxZ);
  return p;
}
function rectDistance2(p,rect){
  const x=clamp(p.x,rect.minX,rect.maxX),z=clamp(p.z,rect.minZ,rect.maxZ);
  return (p.x-x)**2+(p.z-z)**2;
}
function isWalkable(position,radius){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)||!inBounds(position))return false;
  const r=radiusOf(radius);
  for(const rect of RECTS)if(rectDistance2(position,rect)<(r-EPS)**2)return false;
  for(const circle of CIRCLES)if(distance2(position,circle)<(r+circle.radius-EPS)**2)return false;
  return true;
}

function nearest(candidates,origin,radius,requireWalkable){
  let best=null,bestDistance=Infinity;
  for(const p of candidates){
    if(!inBounds(p)||(requireWalkable&&!isWalkable(p,radius)))continue;
    const d=distance2(p,origin);
    if(d<bestDistance){best=p;bestDistance=d;}
  }
  return best;
}
function rectExits(p,rect,r){
  return [
    {x:rect.minX-r-EPS,z:clamp(p.z,rect.minZ,rect.maxZ)},
    {x:rect.maxX+r+EPS,z:clamp(p.z,rect.minZ,rect.maxZ)},
    {x:clamp(p.x,rect.minX,rect.maxX),z:rect.minZ-r-EPS},
    {x:clamp(p.x,rect.minX,rect.maxX),z:rect.maxZ+r+EPS}
  ];
}

function resolvePosition(position,radius){
  const r=radiusOf(radius),origin=clampBounds(point(position)),p={...origin};
  if(isWalkable(p,r))return p;
  // Normal movement needs only one projection. Repeating handles touching
  // furniture and a wall without sending a character through either one.
  for(let iteration=0;iteration<12;iteration++){
    for(const rect of RECTS){
      const x=clamp(p.x,rect.minX,rect.maxX),z=clamp(p.z,rect.minZ,rect.maxZ);
      const dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);
      if(d>=r-EPS)continue;
      if(d>EPS){p.x=x+dx/d*(r+EPS);p.z=z+dz/d*(r+EPS);}
      else{
        const exits=rectExits(p,rect,r),exit=nearest(exits,p,r,true)||nearest(exits,p,r,false);
        if(exit){p.x=exit.x;p.z=exit.z;}
      }
    }
    for(const circle of CIRCLES){
      const dx=p.x-circle.x,dz=p.z-circle.z,d=Math.hypot(dx,dz),clearance=r+circle.radius;
      if(d>=clearance-EPS)continue;
      p.x=circle.x+(d>EPS?dx/d:1)*(clearance+EPS);
      p.z=circle.z+(d>EPS?dz/d:0)*(clearance+EPS);
    }
    clampBounds(p);
    if(isWalkable(p,r))return p;
  }
  // A stale/invalid remote pose can start inside overlapping furniture. Find
  // a legal nearby boundary rather than oscillating between the constraints.
  const candidates=[...SPAWNS.map(s=>({x:s.x,z:s.z}))];
  for(const rect of RECTS)candidates.push(...rectExits(origin,rect,r));
  for(const circle of CIRCLES){
    for(let i=0;i<64;i++){
      const angle=i/64*TAU,d=r+circle.radius+EPS;
      candidates.push({x:circle.x+Math.cos(angle)*d,z:circle.z+Math.sin(angle)*d});
    }
  }
  return nearest(candidates,origin,r,true)||{x:0,z:0};
}

function move(position,input,yaw,dt,radius,speed){
  const r=radiusOf(radius),start=resolvePosition(position,r),p={...start};
  let ix=finite(input&&input.x,0),iy=finite(input&&input.y,0);
  const magnitude=Math.hypot(ix,iy);
  if(magnitude>1){ix/=magnitude;iy/=magnitude;}
  const time=Math.max(0,finite(dt,0)),velocity=Math.max(0,finite(speed,1.6)),angle=finite(yaw,0);
  const dx=(Math.sin(angle)*iy-Math.cos(angle)*ix)*velocity*time;
  const dz=(Math.cos(angle)*iy+Math.sin(angle)*ix)*velocity*time;
  const length=Math.hypot(dx,dz);
  if(!length)return {x:p.x,z:p.z,moving:false};
  const steps=Math.ceil(length/Math.min(.12,r/2)),sx=dx/steps,sz=dz/steps;
  for(let step=0;step<steps;step++){
    const next=resolvePosition({x:p.x+sx,z:p.z+sz},r);
    if(distance2(next,p)<=(sx*sx+sz*sz)*1.01+EPS){
      if(distance2(next,p)<EPS*EPS)break;
      p.x=next.x;p.z=next.z;
    }else{
      // Never accept a repair on the far side of an obstacle during a step.
      // Separated axes still let a diagonal approach slide along its edge.
      const xOnly={x:p.x+sx,z:p.z},zOnly={x:p.x,z:p.z+sz};
      const xOk=isWalkable(xOnly,r),zOk=isWalkable(zOnly,r);
      if(xOk&&(Math.abs(sx)>=Math.abs(sz)||!zOk))p.x=xOnly.x;
      else if(zOk)p.z=zOnly.z;
      else break;
    }
  }
  return {x:p.x,z:p.z,moving:distance2(start,p)>EPS*EPS};
}

function interpolatePose(from,to,progress){
  const a=from||SPAWNS[0],b=to||a,t=clamp(finite(progress,0),0,1);
  const ax=finite(a.x,0),az=finite(a.z,0);
  return {x:ax+(finite(b.x,ax)-ax)*t,z:az+(finite(b.z,az)-az)*t,
    ry:lerpAngle(a.ry,b.ry,t),motion:b.motion||a.motion||'idle',at:finite(b.at,finite(a.at,0))};
}

return {SPAWNS,WALK_BOUNDS,RECTS,CIRCLES,clampPitch,wrapAngle,lerpAngle,
  isWalkable,resolvePosition,move,interpolatePose};
});
