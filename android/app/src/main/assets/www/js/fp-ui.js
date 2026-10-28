/* 双人小屋 · 小人视角界面
 * 这里只负责"画出来"和"把手指的动作翻译成事件"，不移动相机、不判断碰撞、不读写数据。
 * 接法见 docs/FP_UI.md：
 *   const ui = FPUI.mount({ names: ['唐小轩','宛如'], me: 0 });
 *   每帧读 ui.getMove()；监听 ui.on('look' | 'tap' | 'interact' | 'emote' | 'view' | 'menu', fn)
 *   需要时调用 ui.setTarget() / ui.setPartner() / ui.notifyPoke() / ui.playEnter() / ui.showTutorial() */
(function (root) {
'use strict';

const ICON = {
  hand: '<svg viewBox="0 0 24 24"><path d="M8.5 12.5V5.8a1.4 1.4 0 0 1 2.8 0v5.2M11.3 10V4.4a1.4 1.4 0 0 1 2.8 0V10m0-4.2a1.4 1.4 0 0 1 2.8 0V11m0-3a1.4 1.4 0 0 1 2.8 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6.5 6.5 0 0 1-5-2.4l-3-3.7a1.5 1.5 0 0 1 2.2-2l1.5 1.4"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M9.5 13.5V7.8a1.3 1.3 0 0 1 2.6 0v4.4m0-1.4V6.4a1.3 1.3 0 0 1 2.6 0v5.4m0-3.6a1.3 1.3 0 0 1 2.6 0v6.3a5.8 5.8 0 0 1-5.8 5.8h-.4a5.8 5.8 0 0 1-4.5-2.1l-2.4-3a1.3 1.3 0 0 1 1.9-1.8l1.4 1.3"/><path d="M4 7.5c.3-1.6 1.2-2.8 2.6-3.5M19.5 4.2c1 .6 1.7 1.6 1.9 2.8"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 8.5v5.5M8 10.5l4-2 4 2M9.5 18.5l2.5-4.5 2.5 4.5M5 21.5h14"/><path d="M5.5 14.5l-1.5-1.5M18.5 14.5l1.5-1.5"/></svg>',
  nod: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/><path d="M9.5 11.2h.01M14.5 11.2h.01M10 14.2c1.2.9 2.8.9 4 0"/><path d="M12 2.2v1.6M12 20.2v1.6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v10.2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9"/><path d="M12 17.2c-2-1.3-3-2.4-3-3.5a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.1-1 2.2-3 3.5z"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>'
};
const EMOTES = [['wave', '挥手'], ['jump', '跳一下'], ['nod', '点头']];
const COLORS = ['var(--pa)', 'var(--pb)'];
const TUT_KEY = 'fpui-tutorial-done';
const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function mount(opts) {
  opts = opts || {};
  const names = opts.names || ['唐小轩', '宛如'];
  let me = opts.me === 1 ? 1 : 0, view = opts.view === 'overview' ? 'overview' : 'fp';
  const handlers = {};
  const emit = (ev, data) => (handlers[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  const short = n => String(n || '').slice(-1);

  const el = document.createElement('div');
  el.className = 'fp';
  el.innerHTML = `
    <div class="fp-look" aria-hidden="true"></div>
    <div class="fp-glow" aria-hidden="true"></div>
    <div class="fp-cross" aria-hidden="true"><i></i></div>
    <div class="fp-target fp-glass" role="status" aria-live="polite"><b></b><span>点一下打开</span></div>
    <div class="fp-partner" aria-hidden="true"><span class="tip"></span><span class="av"></span><small></small></div>
    <div class="fp-poke fp-glass" role="status" aria-live="polite"><span class="av"></span><div><b></b><span></span></div></div>
    <div class="fp-stick fp-glass" role="application" aria-label="移动：拖动摇杆走路，电脑上用 WASD">
      <span class="ar u"></span><span class="ar d"></span><span class="ar l"></span><span class="ar r"></span>
      <div class="fp-knob"></div></div>
    <div class="fp-actions">
      ${EMOTES.map(([k, l]) => `<button type="button" class="fp-emote fp-glass" data-emote="${k}" aria-label="${l}">${ICON[k]}<small>${l}</small></button>`).join('')}
      <button type="button" class="fp-act" aria-disabled="true" aria-label="互动">${ICON.hand}<span>互动</span></button>
    </div>
    <div class="fp-top">
      <div class="fp-view fp-glass" role="group" aria-label="视角">
        <button type="button" data-view="fp" aria-pressed="true">${ICON.eye}小人</button>
        <button type="button" data-view="overview" aria-pressed="false">${ICON.house}俯瞰</button>
      </div>
      <button type="button" class="fp-menu fp-glass" aria-label="菜单" aria-expanded="false">${ICON.menu}</button>
    </div>
    <div class="fp-keys fp-glass"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走 · 拖动看 · <kbd>E</kbd> 互动</div>`;
  document.body.appendChild(el);

  const enter = document.createElement('div');
  enter.className = 'fp-enter';enter.setAttribute('aria-hidden', 'true');
  document.body.appendChild(enter);
  const tut = document.createElement('div');
  tut.className = 'fp-tut';tut.setAttribute('role', 'dialog');tut.setAttribute('aria-label', '怎么在小屋里走动');
  tut.innerHTML = `<div class="ring r1"></div><div class="ring r3"></div><div class="swipe"></div>
    <div class="note n1"><b>走路</b>按住左下角的圆圈往想去的方向拖</div>
    <div class="note n2"><b>看看四周</b>在屏幕空白处左右、上下拖动</div>
    <div class="note n3"><b>互动</b>准星对着东西、走近了，按这里打开</div>
    <button type="button">知道了</button>`;
  document.body.appendChild(tut);

  const $ = s => el.querySelector(s);
  const look = $('.fp-look'), stick = $('.fp-stick'), knob = $('.fp-knob'), cross = $('.fp-cross'), target = $('.fp-target'),
    act = $('.fp-act'), menu = $('.fp-menu'), partner = $('.fp-partner'), poke = $('.fp-poke'), glow = $('.fp-glow');

  function paint() {
    el.style.setProperty('--me', COLORS[me]); el.style.setProperty('--them', COLORS[1 - me]);
    enter.style.setProperty('--me', COLORS[me]);
    knob.textContent = short(names[me]);
    partner.querySelector('.av').textContent = short(names[1 - me]);
    poke.querySelector('.av').textContent = short(names[1 - me]);
    el.dataset.view = view;
    el.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    document.body.classList.toggle('fp-mode', view === 'fp');
  }

  /* ---------- joystick ---------- */
  const R = 40, DEAD = .12;
  let stickId = null, sx = 0, sy = 0, sv = { x: 0, y: 0 };
  function setKnob(dx, dy) {
    const d = Math.hypot(dx, dy), k = d > R ? R / d : 1; dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    let x = dx / R, y = -dy / R; const m = Math.hypot(x, y);
    if (m < DEAD) { x = 0; y = 0; } else { const s = (m - DEAD) / (1 - DEAD) / m; x *= s; y *= s; }
    sv = { x, y };
  }
  stick.addEventListener('pointerdown', e => {
    if (stickId !== null) return; stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stick.classList.add('on');
    const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; setKnob(e.clientX - sx, e.clientY - sy); emit('movestart'); e.preventDefault();
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) setKnob(e.clientX - sx, e.clientY - sy); });
  const stickUp = e => { if (e.pointerId !== stickId) return; stickId = null; stick.classList.remove('on'); setKnob(0, 0); knob.style.transform = ''; emit('moveend'); };
  stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);

  /* ---------- keyboard ---------- */
  const keys = new Set();
  const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); };
  function onKey(e) {
    if (view !== 'fp' || blocked || typing()) return;
    const k = KEYMAP[e.code];
    if (k) { if (e.type === 'keydown') keys.add(k); else keys.delete(k); e.preventDefault(); return; }
    if (e.type === 'keydown' && !e.repeat && (e.code === 'KeyE' || e.code === 'Enter') && e.target === document.body) { e.preventDefault(); fireInteract(); }
  }
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => keys.clear());

  /* ---------- drag to look, tap to pick ---------- */
  const lookPtrs = new Map();
  look.addEventListener('pointerdown', e => { look.setPointerCapture(e.pointerId); lookPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0 }); });
  look.addEventListener('pointermove', e => {
    const p = lookPtrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
    if (dx || dy) emit('look', { dx, dy, pointerType: e.pointerType });
  });
  const lookUp = e => {
    const p = lookPtrs.get(e.pointerId); if (!p) return; lookPtrs.delete(e.pointerId);
    if (e.type === 'pointerup' && p.moved < 10 && performance.now() - p.t < 350) emit('tap', { x: e.clientX, y: e.clientY });
  };
  look.addEventListener('pointerup', lookUp); look.addEventListener('pointercancel', lookUp);
  look.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- buttons ---------- */
  let hasTarget = false;
  function fireInteract() { if (hasTarget) emit('interact'); }
  act.addEventListener('click', fireInteract);
  el.querySelectorAll('.fp-emote').forEach(b => b.addEventListener('click', () => {
    emit('emote', b.dataset.emote); b.classList.add('cool'); setTimeout(() => b.classList.remove('cool'), 1100);
  }));
  el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view !== view) { api.setView(b.dataset.view); emit('view', view); } }));
  menu.addEventListener('click', () => api.setMenuOpen(!el.classList.contains('menu-open')));
  document.addEventListener('click', e => { if (el.classList.contains('menu-open') && e.target.closest && e.target.closest('.dock button')) api.setMenuOpen(false); }, true);
  tut.querySelector('button').addEventListener('click', () => { tut.classList.remove('on'); try { localStorage.setItem(TUT_KEY, '1'); } catch (e) {} emit('tutorialdone'); });

  /* ---------- hide controls while a panel or the login screen is up ---------- */
  let blocked = false;
  function checkBlocked() {
    const b = !!document.querySelector('.scrim, .login');
    if (b !== blocked) { blocked = b; el.classList.toggle('blocked', b); if (b) { keys.clear(); if (stickId !== null) stickUp({ pointerId: stickId }); } }
  }
  const mo = new MutationObserver(checkBlocked); mo.observe(document.body, { childList: true }); checkBlocked();

  /* ---------- public ---------- */
  let pokeT = null;
  const api = {
    el,
    on(ev, fn) { (handlers[ev] || (handlers[ev] = [])).push(fn); return () => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); }; },
    /* x: right +, y: forward +, both -1..1 (joystick and WASD combined) */
    getMove() {
      if (view !== 'fp' || blocked) return { x: 0, y: 0, active: false };
      let x = sv.x, y = sv.y;
      if (keys.size) { x += (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); y += (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0); }
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      return { x, y, active: m > 0 };
    },
    getView() { return view; },
    setView(v) { view = v === 'overview' ? 'overview' : 'fp'; if (view !== 'fp') { api.setTarget(null); api.setMenuOpen(false); } paint(); return api; },
    setMe(w, newNames) { me = w === 1 ? 1 : 0; if (newNames) names.splice(0, 2, newNames[0], newNames[1]); paint(); return api; },
    /* what the crosshair is on: { label: '冰箱 · 想一起吃的', hint?: '点一下打开' } or null */
    setTarget(t) {
      hasTarget = !!t;
      cross.classList.toggle('on', hasTarget); target.classList.toggle('on', hasTarget);
      act.setAttribute('aria-disabled', String(!hasTarget)); act.classList.toggle('pulse', hasTarget && !reduce());
      if (t) { target.querySelector('b').textContent = t.label || ''; target.querySelector('span').textContent = t.hint || '点一下打开'; act.setAttribute('aria-label', '互动：' + (t.label || '')); }
      else act.setAttribute('aria-label', '互动');
      return api;
    },
    /* partner arrow on the screen edge: { visible, angle (rad, 0 = straight ahead, + = to the right), distance?, name? } */
    setPartner(p) {
      const show = !!(p && p.visible) && view === 'fp';
      partner.classList.toggle('on', show); if (!show) return api;
      const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2, rx = W / 2 - 46, ry = H / 2 - 110;
      const a = p.angle || 0, sx2 = Math.sin(a), cy2 = -Math.cos(a);
      const k = Math.min(rx / Math.max(1e-6, Math.abs(sx2)), ry / Math.max(1e-6, Math.abs(cy2)));
      partner.style.left = (cx + sx2 * k) + 'px'; partner.style.top = (cy + cy2 * k + 20) + 'px';
      partner.style.setProperty('--rot', (a * 180 / Math.PI) + 'deg');
      partner.querySelector('small').textContent = (p.name || names[1 - me]) + (p.distance != null ? ` · ${p.distance.toFixed(1)} 米` : '');
      return api;
    },
    /* show "someone poked you" */
    notifyPoke(fromName, line) {
      poke.querySelector('b').textContent = `${fromName || names[1 - me]} 戳了你一下`;
      poke.querySelector('div span').textContent = line || '';
      poke.classList.add('on'); glow.classList.remove('on'); void glow.offsetWidth; glow.classList.add('on');
      if (navigator.vibrate) try { navigator.vibrate([18, 60, 18]); } catch (e) {}
      clearTimeout(pokeT); pokeT = setTimeout(() => poke.classList.remove('on'), 2800);
      return api;
    },
    /* "welcome home" iris; resolves when the room is fully visible */
    playEnter(name) {
      enter.innerHTML = `<div class="fp-enter-card"><small>欢迎回家</small><b>${String(name || names[me]).replace(/[<&]/g, '')}</b><i></i></div>`;
      enter.classList.remove('go'); enter.classList.add('show');
      return new Promise(res => {
        const done = () => { enter.classList.remove('show', 'go'); res(); };
        if (reduce()) { setTimeout(done, 700); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => enter.classList.add('go')));
        setTimeout(done, 1650);
      });
    },
    /* first-time guide; shows once unless force */
    showTutorial(force) { let seen = false; try { seen = !!localStorage.getItem(TUT_KEY); } catch (e) {} if (force || !seen) tut.classList.add('on'); return api; },
    setMenuOpen(o) { el.classList.toggle('menu-open', !!o); document.body.classList.toggle('fp-menu-open', !!o); menu.setAttribute('aria-expanded', String(!!o)); emit('menu', !!o); return api; },
    destroy() { mo.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); el.remove(); enter.remove(); tut.remove(); document.body.classList.remove('fp-mode', 'fp-menu-open'); }
  };
  paint();
  return api;
}

root.FPUI = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
