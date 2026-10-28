/* 双人小屋 · 两个小人：唐小轩（who = 0）和宛如（who = 1）
 * 只用 three.js r128 自带的几何体拼成，不需要外部模型文件。
 * 用法见 CHARACTERS.md：
 *   const c = CoupleChars.create(THREE, { who: 0 });
 *   scene.add(c.group);   每帧调用 c.update(dt)
 * 坐标约定：原点在两脚中间的地面上，面朝 +z；1 个单位和房间的单位相同。 */
(function (root) {
'use strict';

const MOODS = ['neutral', 'happy', 'miss', 'sleepy', 'angry', 'sad', 'hungry'];
const PRESETS = [
  { name: '唐小轩', skin: '#FFE2CC', hair: '#3A2B2B', top: '#F2A24A', trim: '#D9862E', bottom: '#4A6FA5', shoes: '#FFFFFF', style: 'boy' },
  { name: '宛如',   skin: '#FFE6D8', hair: '#5B3A2E', top: '#9CCBEF', trim: '#FFFFFF', bottom: '#FFFFFF', shoes: '#5B4A5E', style: 'girl' }
];

/* ---------- face texture ---------- */
const FW = 576, FH = 400;            // the face patch is wider than tall; this keeps eyes round
function drawFace(g, mood, closed) {
  const u = FH / 100, X = p => p / 100 * FW, Y = p => p / 100 * FH;
  g.clearRect(0, 0, FW, FH);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = '#3A2A33';
  const eyes = [[X(33), Y(44)], [X(67), Y(44)]];
  const blush = (a = .5) => { g.fillStyle = `rgba(255,135,160,${a})`; for (const [x] of eyes) { g.beginPath(); g.ellipse(x + (x < FW / 2 ? -3 : 3) * u, Y(64), 9 * u, 4.6 * u, 0, 0, Math.PI * 2); g.fill(); } };
  const heart = (x, y, r, c) => { g.save(); g.translate(x, y); g.scale(r / 16, r / 16); g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(-18, -8, -8, -22, 0, -12); g.bezierCurveTo(8, -22, 18, -8, 0, 6); g.fillStyle = c; g.fill(); g.restore(); };
  const openEye = ([x, y], k = 1) => {
    g.fillStyle = ink; g.beginPath(); g.ellipse(x, y, 6.6 * u * k, 9 * u * k, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(0, y - 9 * u, 0, y + 9 * u); gr.addColorStop(0, 'rgba(120,70,90,0)'); gr.addColorStop(1, 'rgba(150,90,110,.9)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 2 * u * k, 5 * u * k, 6.4 * u * k, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 2.2 * u * k, y - 3.6 * u * k, 2.6 * u * k, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + 2.2 * u * k, y + 3 * u * k, 1.2 * u * k, 0, Math.PI * 2); g.fill();
  };
  const lineEye = ([x, y], curve) => { g.strokeStyle = ink; g.lineWidth = 2.6 * u; g.beginPath();
    if (curve === 'up') g.arc(x, y + 4 * u, 7 * u, Math.PI * 1.15, Math.PI * 1.85);
    else if (curve === 'down') g.arc(x, y - 3 * u, 7 * u, Math.PI * .15, Math.PI * .85);
    else { g.moveTo(x - 7 * u, y + 1 * u); g.lineTo(x + 7 * u, y + 1 * u); }
    g.stroke(); };
  const mouth = (kind) => { const x = X(50), y = Y(70); g.strokeStyle = ink; g.lineWidth = 2.2 * u; g.fillStyle = '#E86A7E';
    switch (kind) {
      case 'smile': g.beginPath(); g.arc(x, y - 2 * u, 4 * u, .15 * Math.PI, .85 * Math.PI); g.stroke(); break;
      case 'open': g.beginPath(); g.moveTo(x - 5 * u, y - 2 * u); g.quadraticCurveTo(x, y + 7 * u, x + 5 * u, y - 2 * u); g.closePath(); g.fill(); g.stroke(); break;
      case 'w': g.beginPath(); g.moveTo(x - 5 * u, y - 1 * u); g.quadraticCurveTo(x - 2.5 * u, y + 3 * u, x, y - .5 * u); g.quadraticCurveTo(x + 2.5 * u, y + 3 * u, x + 5 * u, y - 1 * u); g.stroke(); break;
      case 'o': g.beginPath(); g.ellipse(x, y, 2.4 * u, 2.8 * u, 0, 0, Math.PI * 2); g.stroke(); break;
      case 'pout': g.beginPath(); g.arc(x, y + 3 * u, 4 * u, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
      case 'wavy': g.beginPath(); g.moveTo(x - 6 * u, y); g.quadraticCurveTo(x - 3 * u, y - 3 * u, x, y); g.quadraticCurveTo(x + 3 * u, y + 3 * u, x + 6 * u, y); g.stroke(); break;
    } };
  switch (mood) {
    case 'happy':
      if (closed) eyes.forEach(e => lineEye(e, 'up')); else eyes.forEach(e => openEye(e));
      mouth('open'); blush(.6); break;
    case 'miss':
      if (closed) eyes.forEach(e => lineEye(e, 'down')); else eyes.forEach(([x, y]) => { openEye([x, y]); heart(x, y + 1 * u, 7 * u, '#FF7FA0'); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 2 * u, y - 4 * u, 1.8 * u, 0, Math.PI * 2); g.fill(); });
      mouth('w'); blush(.65); heart(X(84), Y(22), 6 * u, '#FF7FA0'); break;
    case 'sleepy':
      eyes.forEach(e => lineEye(e, 'down')); mouth('o'); blush(.35);
      g.fillStyle = '#7E8DC9'; g.font = `bold ${12 * u}px sans-serif`; g.fillText('z', X(80), Y(26)); g.font = `bold ${8 * u}px sans-serif`; g.fillText('z', X(88), Y(14)); break;
    case 'angry':
      if (closed) eyes.forEach(e => lineEye(e)); else eyes.forEach(e => openEye(e, .82));
      g.strokeStyle = ink; g.lineWidth = 2.6 * u; g.beginPath();
      g.moveTo(X(24), Y(24)); g.lineTo(X(40), Y(30)); g.moveTo(X(76), Y(24)); g.lineTo(X(60), Y(30)); g.stroke();
      mouth('pout'); blush(.75);
      g.strokeStyle = '#E8577A'; g.lineWidth = 2.4 * u; const ax = X(84), ay = Y(20);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(ax + dx * 2 * u, ay + dy * 6 * u); g.quadraticCurveTo(ax + dx * 2 * u, ay + dy * 2 * u, ax + dx * 6 * u, ay + dy * 2 * u); g.stroke(); }
      break;
    case 'sad':
      if (closed) eyes.forEach(e => lineEye(e, 'down')); else eyes.forEach(e => openEye(e));
      g.strokeStyle = ink; g.lineWidth = 2.2 * u; g.beginPath(); g.moveTo(X(26), Y(28)); g.lineTo(X(40), Y(25)); g.moveTo(X(74), Y(28)); g.lineTo(X(60), Y(25)); g.stroke();
      g.fillStyle = 'rgba(120,190,240,.9)'; g.beginPath(); g.ellipse(X(71), Y(60), 2.4 * u, 4.2 * u, 0, 0, Math.PI * 2); g.fill();
      mouth('wavy'); blush(.4); break;
    case 'hungry':
      if (closed) eyes.forEach(e => lineEye(e, 'up')); else eyes.forEach(e => openEye(e, 1.05));
      mouth('open'); g.fillStyle = 'rgba(140,200,240,.9)'; g.beginPath(); g.ellipse(X(56), Y(80), 1.8 * u, 3.2 * u, 0, 0, Math.PI * 2); g.fill(); blush(.55); break;
    default:
      if (closed) eyes.forEach(e => lineEye(e, 'down')); else eyes.forEach(e => openEye(e));
      mouth('smile'); blush(.45);
  }
}

/* ---------- builder ---------- */
function create(THREE, opts) {
  opts = opts || {};
  const who = opts.who === 1 ? 1 : 0;
  const C = Object.assign({}, PRESETS[who], opts.colors || {});
  const S = opts.scale || 1, toon = opts.toon !== false, useOutline = opts.outline !== false;
  const owned = [];
  const keep = x => { owned.push(x); return x; };

  let grad = null;
  if (toon) {
    grad = keep(new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat));
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
  }
  const mats = {};
  const mat = (c, extra) => { const k = c + (extra ? JSON.stringify(Object.keys(extra)) : ''); if (mats[k] && !extra) return mats[k];
    const m = keep(toon ? new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: grad }, extra || {})) : new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, extra || {})));
    if (!extra) mats[k] = m; return m; };
  const lineMat = keep(new THREE.MeshBasicMaterial({ color: opts.outlineColor || '#4A3A48', side: THREE.BackSide }));

  /* outline = a slightly inflated copy drawn from the inside (inverted hull) */
  function outline(mesh, w) {
    if (!useOutline) return;
    const s = (Math.abs(mesh.scale.x) + Math.abs(mesh.scale.y) + Math.abs(mesh.scale.z)) / 3 || 1;
    const g = keep(mesh.geometry.clone()), p = g.attributes.position, n = g.attributes.normal, d = (w || .011) / s;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
    const o = new THREE.Mesh(g, lineMat); o.userData.isOutline = true; o.castShadow = false; mesh.add(o);
  }
  function part(parent, geo, m, pos, scale, rot, ol) {
    keep(geo); const me = new THREE.Mesh(geo, m); if (pos) me.position.set(pos[0], pos[1], pos[2]); if (scale) me.scale.set(scale[0], scale[1], scale[2]);
    if (rot) me.rotation.set(rot[0], rot[1], rot[2]); me.castShadow = true; parent.add(me); if (ol !== false) outline(me, typeof ol === 'number' ? ol : undefined); return me;
  }
  const sph = (r, a, b) => new THREE.SphereGeometry(r, a || 32, b || 24);
  /* a rounded tube (limb) hanging from its joint along -y */
  function limb(parent, r, len, m, endR, endM, endScale) {
    const g = new THREE.Group(); parent.add(g);
    part(g, new THREE.CylinderGeometry(r, r * .92, len, 20, 1, true), m, [0, -len / 2, 0]);
    part(g, sph(r, 20, 14), m, [0, 0, 0]);
    const end = part(g, sph(endR || r, 24, 18), endM || m, [0, -len, 0], endScale);
    g.userData.end = end; return g;
  }

  const group = new THREE.Group(); group.name = C.name; group.scale.setScalar(S);
  const body = new THREE.Group(); group.add(body);                 // bobs and squashes as a whole

  /* legs (pivot at the hip) */
  const HIP = .42, legs = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(.11 * side, HIP, 0); body.add(pivot);
    const leg = limb(pivot, .072, .3, mat(C.bottom), .075, mat(C.bottom));
    const shoe = part(pivot, sph(.1, 24, 18), mat(C.shoes), [0, -.36, .045], [.9, .6, 1.35]);
    if (C.style === 'boy') part(pivot, sph(.1, 24, 12), mat('#E8577A'), [0, -.395, .045], [.92, .22, 1.37], null, false);
    else part(pivot, new THREE.TorusGeometry(.055, .012, 8, 20, Math.PI), mat('#3A2E3A'), [0, -.32, .075], null, [0, 0, 0], false);
    legs.push(pivot); void leg; void shoe;
  }

  /* torso: a lathe (hoodie for him, A-line dress for her) */
  const torso = new THREE.Group(); torso.position.y = .4; body.add(torso);
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const prof = C.style === 'boy'
    ? [V2(0, 0), V2(.25, 0), V2(.29, .05), V2(.295, .2), V2(.275, .36), V2(.225, .46), V2(.13, .52), V2(.085, .56), V2(0, .565)]
    : [V2(0, -.07), V2(.35, -.07), V2(.36, -.03), V2(.31, .1), V2(.255, .28), V2(.225, .42), V2(.13, .52), V2(.085, .56), V2(0, .565)];
  part(torso, new THREE.LatheGeometry(prof, 36), mat(C.top));
  if (C.style === 'boy') {
    part(torso, sph(.12, 24, 16), mat(C.trim), [0, .17, .255], [1.55, .62, .32], null, .008);          // kangaroo pocket
    part(torso, new THREE.TorusGeometry(.16, .06, 14, 28, Math.PI), mat(C.trim), [0, .52, -.05], [1.1, 1, 1], [Math.PI / 2 - .25, 0, Math.PI]); // hood folded behind the neck
    for (const s of [1, -1]) part(torso, new THREE.CylinderGeometry(.012, .012, .16, 8), mat('#FFFFFF'), [.055 * s, .4, .215], null, [.25, 0, 0], false); // drawstrings
  } else {
    for (const s of [1, -1]) part(torso, sph(.085, 20, 12), mat(C.trim), [.065 * s, .5, .14], [1.25, .35, .9], [-.5, 0, -.35 * s], .007); // petal collar
    part(torso, sph(.04, 16, 12), mat('#E8577A'), [0, .5, .19], [1.4, .9, .7], null, .006);              // little bow
    part(torso, new THREE.TorusGeometry(.325, .012, 8, 40), mat(C.trim), [0, .03, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false); // hem trim
  }

  /* arms (pivot at the shoulder); armL is on +x (her/his left) */
  const arms = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(.245 * side, .85, 0); body.add(pivot);
    limb(pivot, .062, .3, mat(C.top), .072, mat(C.skin));
    pivot.rotation.z = .26 * side; arms.push(pivot);
  }
  const [armL, armR] = arms, [legL, legR] = legs;

  /* head */
  const neck = new THREE.Group(); neck.position.y = .95; body.add(neck);
  const head = new THREE.Group(); head.position.y = .4; neck.add(head);   // head centre
  const skull = part(head, sph(.42, 48, 36), mat(C.skin), [0, 0, 0], [1.05, .95, 1]);
  for (const s of [1, -1]) part(head, sph(.07, 16, 12), mat(C.skin), [.43 * s, -.02, 0], [.55, 1, .8]);
  // face patch (canvas texture), slightly outside the skull
  const faceCanvas = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; return c; });
  const faceTex = faceCanvas.map(c => { const t = keep(new THREE.CanvasTexture(c)); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; });
  const faceMat = keep(new THREE.MeshBasicMaterial({ map: faceTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const face = part(skull, new THREE.SphereGeometry(.425, 40, 30, Math.PI / 2 - .85, 1.7, 1.03, 1.3), faceMat, [0, 0, 0], null, null, false);
  face.castShadow = false; face.renderOrder = 2;

  /* hair */
  const hairM = mat(C.hair);
  const hair = new THREE.Group(); head.add(hair);
  part(hair, new THREE.SphereGeometry(.455, 48, 24, 0, Math.PI * 2, 0, 1.42), hairM, [0, .02, -.01], [1.06, 1, 1.02], [-.12, 0, 0]);       // crown
  part(hair, new THREE.SphereGeometry(.452, 48, 24, Math.PI * .97, Math.PI * 1.06, 0, 2.15), hairM, [0, .01, -.02], [1.06, .97, 1.02]); // back of the head
  const fringe = (n, spread, y, r, sx, sy) => { for (let i = 0; i < n; i++) { const a = -spread + 2 * spread * i / (n - 1), jitter = (i % 2 ? .015 : -.01);
    part(hair, sph(r, 20, 14), hairM, [Math.sin(a) * .41 * 1.05, y + jitter, Math.cos(a) * .4], [sx, sy, .55], [-.35, a, 0], .009); } };
  if (C.style === 'boy') {
    fringe(6, .95, .2, .11, 1.05, .8);
    for (const s of [1, -1]) part(hair, sph(.1, 20, 14), hairM, [.43 * s, .08, .06], [.5, 1.05, .8], [0, 0, .2 * s], .009);   // sideburns
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .44, .02), new THREE.Vector3(.02, .56, .05), new THREE.Vector3(.09, .63, .07), new THREE.Vector3(.14, .58, .06)]);
    part(hair, new THREE.TubeGeometry(curve, 24, .022, 8, false), hairM, null, null, null, .007);                                   // the cowlick
    part(hair, sph(.024, 12, 10), hairM, [.14, .58, .06], null, null, .007);
  } else {
    fringe(7, 1.0, .16, .1, 1.0, .95);
    // long hair: an open shell behind the head down to the shoulders
    const shell = [V2(.462, .12), V2(.478, -.06), V2(.47, -.3), V2(.43, -.52), V2(.37, -.68), V2(.31, -.74)];
    const back = part(hair, new THREE.LatheGeometry(shell, 40, .95, Math.PI * 2 - 1.9), mat(C.hair, { side: THREE.DoubleSide }), [0, 0, -.02], [1.05, 1, .95]);
    void back;
    for (const s of [1, -1]) part(hair, sph(.11, 20, 16), hairM, [.405 * s, -.22, .14], [.42, 1.35, .55], [.1, 0, .08 * s], .009); // side locks
    // bunny hair clip on her left
    const clip = new THREE.Group(); clip.position.set(.29, .3, .17); clip.rotation.set(-.2, .3, -.45); hair.add(clip);
    for (const s of [1, -1]) { const ear = part(clip, sph(.06, 20, 14), mat('#FFFFFF'), [.04 * s, .07, 0], [.55, 1.6, .35], [0, 0, -.18 * s], .007);
      part(ear, sph(.045, 16, 12), mat('#FFC2D1'), [0, 0, .035], [.55, .8, .3], null, false); }
    part(clip, sph(.035, 16, 12), mat('#FFFFFF'), [0, 0, 0], null, null, .006);
  }

  group.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });

  /* ---------- state ---------- */
  let mood = 'neutral', motion = 'idle', oneShot = null, oneT = 0, t = Math.random() * 10, blinkIn = 2 + Math.random() * 3, blinking = 0, headYaw = 0;
  function renderFace() {
    drawFace(faceCanvas[0].getContext('2d'), mood, false); drawFace(faceCanvas[1].getContext('2d'), mood, true);
    faceTex[0].needsUpdate = faceTex[1].needsUpdate = true;
  }
  renderFace();
  const lerp = (a, b, k) => a + (b - a) * k;

  const api = {
    group, who, name: C.name,
    /* metres-ish numbers for the room, already multiplied by scale */
    info: { height: 1.84 * S, eyeHeight: 1.36 * S, hipHeight: HIP * S, seatOffset: .4 * S, radius: .34 * S },
    moods: MOODS.slice(),
    setMood(m) { if (MOODS.includes(m) && m !== mood) { mood = m; renderFace(); } return api; },
    getMood() { return mood; },
    /* 'idle' | 'walk' | 'sit' — continuous */
    setMotion(m) { if (['idle', 'walk', 'sit'].includes(m)) motion = m; return api; },
    getMotion() { return motion; },
    /* 'wave' | 'jump' | 'nod' — plays once, then returns to the current motion */
    play(name) { if (['wave', 'jump', 'nod'].includes(name)) { oneShot = name; oneT = 0; } return api; },
    /* turn only the head, radians, + is to the character's left */
    setHeadYaw(a) { headYaw = Math.max(-.9, Math.min(.9, a || 0)); return api; },
    /* world position between the eyes, for a first-person camera */
    getEyeWorldPosition(target) { target = target || new THREE.Vector3(); head.updateWorldMatrix(true, false); return target.set(0, -.02, .3).applyMatrix4(head.matrixWorld); },
    update(dt) {
      dt = Math.min(dt || 0, .1); t += dt; const k = Math.min(1, dt * 10);
      // targets for this frame
      let lL = 0, lR = 0, aLx = 0, aRx = 0, aLz = .26, aRz = -.26, bob = 0, sy = 1 + .012 * Math.sin(t * 2.2), hz = .035 * Math.sin(t * .9), hx = 0, tilt = 0;
      if (motion === 'walk') { const w = Math.sin(t * 9); lL = .55 * w; lR = -.55 * w; aLx = -.5 * w; aRx = .5 * w; bob = .035 * Math.abs(Math.cos(t * 9)); hz = .03 * w; tilt = .06; }
      if (motion === 'sit') { lL = lR = -1.45; aLx = aRx = -.35; aLz = .3; aRz = -.3; }
      if (oneShot) {
        oneT += dt;
        if (oneShot === 'wave') { const p = oneT / 1.6; aRz = -2.55 + .35 * Math.sin(oneT * 12); aRx = -.2; hz = .12; if (p >= 1) oneShot = null; }
        else if (oneShot === 'jump') { const p = oneT / .7; if (p < 1) { const h = Math.sin(Math.PI * p); bob += .32 * h; sy *= p < .12 ? 1 - .5 * (p / .12) * .3 : p > .88 ? 1 - .15 * ((p - .88) / .12) : 1 + .08 * h; aLz = .26 + 1.5 * h; aRz = -.26 - 1.5 * h; } else oneShot = null; }
        else if (oneShot === 'nod') { const p = oneT / .8; hx = .28 * Math.sin(Math.PI * 2 * p) * (p < 1 ? 1 : 0); if (p >= 1) oneShot = null; }
      }
      legL.rotation.x = lerp(legL.rotation.x, lL, k); legR.rotation.x = lerp(legR.rotation.x, lR, k);
      armL.rotation.x = lerp(armL.rotation.x, aLx, k); armR.rotation.x = lerp(armR.rotation.x, aRx, k);
      armL.rotation.z = lerp(armL.rotation.z, aLz, k); armR.rotation.z = lerp(armR.rotation.z, aRz, k);
      body.position.y = oneShot === 'jump' ? bob : lerp(body.position.y, bob, k);
      body.rotation.x = lerp(body.rotation.x, tilt, k);
      torso.scale.y = sy; neck.position.y = .95 + (sy - 1) * .5;
      head.rotation.z = lerp(head.rotation.z, hz, k); head.rotation.x = lerp(head.rotation.x, hx, k * 1.5); head.rotation.y = lerp(head.rotation.y, headYaw, k);
      // blinking (not while sleepy — the eyes are already shut)
      if (blinking > 0) { blinking -= dt; if (blinking <= 0) faceMat.map = faceTex[0]; }
      else if ((blinkIn -= dt) <= 0) { blinkIn = 2.2 + Math.random() * 3.2; if (mood !== 'sleepy') { blinking = .13; faceMat.map = faceTex[1]; } }
    },
    dispose() { group.parent && group.parent.remove(group); owned.forEach(o => o.dispose && o.dispose()); }
  };
  return api;
}

root.CoupleChars = { create, MOODS: MOODS.slice(), PRESETS: PRESETS.map(p => Object.assign({}, p)) };
})(typeof window !== 'undefined' ? window : globalThis);
