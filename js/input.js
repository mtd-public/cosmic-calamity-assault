// Unified input for an FPS: keyboard + mouse (pointer lock), touch (tablet),
// and gamepad (Xbox layout by default, via the Standard Gamepad mapping).
//
// Touch scheme (tablet first):
//   left 42%  : floating move stick (a new touch always takes it: template docs/04)
//   elsewhere : drag to look
//   buttons   : FIRE (hold; dragging on it also looks, like console-port shooters),
//               JUMP, CROUCH (toggle), ACTION (tap reload / hold pick up), SWAP,
//               GRENADE, MELEE, ZOOM, grenade type
// frame(dt) returns one input snapshot per render frame; edges are consumed.
import { TUNING as T } from './tuning.js';
import { PAD_PRESETS, padFamily, buttonName } from './pad.js';

const EDGE_KEYS = ['fireEdge', 'jump', 'reload', 'swap', 'grenade', 'melee', 'gswitch', 'zoom', 'pause', 'objective'];

export class Input {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;
    this.settings = { lookSens: 5, padSens: 5, touchSens: 5, invertY: false, southpaw: false, preset: 'classic', rumble: true, crouchToggle: true };
    this.keys = new Set();
    this.edges = {};
    this.mouse = { dx: 0, dy: 0, fire: false, locked: false, drag: null };
    this.touch = { stick: null, look: new Map(), held: {}, dx: 0, dy: 0, crouch: false };
    this.stick = { active: false, bx: 0, by: 0, tx: 0, ty: 0, x: 0, y: 0, R: 64 };
    this.pad = null; this.padPrev = {}; this.padCrouch = false; this.padTurnT = 0;
    this.device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'kbm';
    this.enabled = false; // gameplay input (menus get their own)
    this.onDevice = null;
    this._bind();
  }

  setDevice(d) { if (this.device !== d) { this.device = d; this.onDevice?.(d); } }
  glyphs() {
    if (this.device === 'pad') {
      const fam = padFamily(this.padId), map = PAD_PRESETS[this.settings.preset];
      return { action: buttonName(map.action[0], fam), reload: buttonName(map.action[0], fam), family: fam };
    }
    if (this.device === 'touch') return { action: 'ACTION', reload: 'ACTION' };
    return { action: 'E', reload: 'R' };
  }

  // ------------------------------------------------------------ bindings
  _bind() {
    const cv = this.canvas;
    cv.style.touchAction = 'none';
    // keyboard
    addEventListener('keydown', (e) => {
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(k)) e.preventDefault();
      this.setDevice('kbm');
      if (e.repeat) return;
      this.keys.add(k);
      const E = this.edges;
      if (k === 'Space') E.jump = true;
      if (k === 'KeyR') E.reload = true;
      if (k === 'Digit1' || k === 'Digit2' || k === 'Tab') E.swap = true;
      if (k === 'KeyG') E.grenade = true;
      if (k === 'KeyQ' || k === 'KeyV') E.melee = true;
      if (k === 'KeyT') E.gswitch = true;
      if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyZ') E.zoom = true;
      if (k === 'Escape' || k === 'KeyP') E.pause = true;
      if (k === 'KeyO') E.objective = true;
      this.onKey?.(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    // mouse
    cv.addEventListener('mousedown', (e) => {
      this.setDevice('kbm');
      if (!this.enabled) return;
      if (!this.mouse.locked) { this.requestLock(); this.mouse.drag = { x: e.clientX, y: e.clientY }; return; }
      if (e.button === 0) { this.mouse.fire = true; this.edges.fireEdge = true; }
      if (e.button === 2) this.edges.zoom = true;
      if (e.button === 1) { this.edges.grenade = true; e.preventDefault(); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.fire = false; this.mouse.drag = null; });
    addEventListener('mousemove', (e) => {
      if (this.mouse.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      else if (this.mouse.drag && e.buttons) { this.mouse.dx += e.clientX - this.mouse.drag.x; this.mouse.dy += e.clientY - this.mouse.drag.y; this.mouse.drag = { x: e.clientX, y: e.clientY }; }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.enabled && Math.abs(e.deltaY) > 10) this.edges.swap = true; }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === cv;
      if (!this.mouse.locked) { this.mouse.fire = false; this.onUnlock?.(); }
    });
    // touch: stick + look on the canvas
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.setDevice('touch');
      if (!this.enabled) return;
      e.preventDefault();
      if (e.clientX < innerWidth * 0.42) {
        // a new touch always takes the stick over (the old owner may have vanished)
        this.touch.stick = e.pointerId;
        Object.assign(this.stick, { active: true, bx: e.clientX, by: e.clientY, tx: e.clientX, ty: e.clientY, x: 0, y: 0 });
      } else this.touch.look.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
    }, { passive: false });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') return;
      if (e.pointerId === this.touch.stick) { this._stickMove(e.clientX, e.clientY); return; }
      const L = this.touch.look.get(e.pointerId);
      if (L) { this.touch.dx += e.clientX - L.x; this.touch.dy += e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; }
    }, { passive: false });
    const end = (e) => {
      if (e.pointerId === this.touch.stick) this.releaseStick();
      this.touch.look.delete(e.pointerId);
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
    // on-screen buttons
    for (const el of this.touchRoot.querySelectorAll('[data-btn]')) this.bindButton(el, el.dataset.btn);
    // anything that can swallow a pointerup: drop all held input
    addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    addEventListener('pagehide', () => this.reset());
    addEventListener('gamepadconnected', (e) => { this.padId = e.gamepad.id; this.onPadConnect?.(e.gamepad); });
  }

  requestLock() {
    if (navigator.userActivation && !navigator.userActivation.isActive) return; // needs a gesture
    const quiet = (r) => r?.catch?.(() => {});
    try {
      const r = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      r?.catch?.((e) => { if (e?.name === 'NotSupportedError') { try { quiet(this.canvas.requestPointerLock()); } catch (_) { /* none */ } } });
    } catch (_) { /* iframe without allow-pointer-lock */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock?.(); }

  bindButton(el, name) {
    el.style.touchAction = 'none';
    let owner = null, last = null;
    const on = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this.enabled) return;
      this.setDevice('touch');
      owner = e.pointerId; last = { x: e.clientX, y: e.clientY };
      this.touch.held[name] = true;
      el.classList.add('down');
      const E = this.edges;
      if (name === 'fire') E.fireEdge = true;
      if (name === 'jump') E.jump = true;
      if (name === 'swap') E.swap = true;
      if (name === 'grenade') E.grenade = true;
      if (name === 'melee') E.melee = true;
      if (name === 'gswitch') E.gswitch = true;
      if (name === 'zoom') E.zoom = true;
      if (name === 'crouch') { this.touch.crouch = !this.touch.crouch; el.classList.toggle('on', this.touch.crouch); }
      if (name === 'action') this.touch.actT = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    };
    const move = (e) => {
      if (e.pointerId !== owner || name !== 'fire') return;
      // the FIRE button doubles as a look pad while held
      this.touch.dx += e.clientX - last.x; this.touch.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    };
    const off = (e) => {
      if (owner !== null && e.pointerId !== owner) return;
      if (name === 'action' && this.touch.held.action && performance.now() - (this.touch.actT || 0) < 280) this.edges.reload = true; // a tap reloads
      owner = null;
      this.touch.held[name] = false;
      el.classList.remove('down');
    };
    el.addEventListener('pointerdown', on, { passive: false });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    (this._buttons ||= []).push(el);
  }

  _stickMove(x, y) {
    const s = this.stick;
    let dx = x - s.bx, dy = y - s.by;
    const d = Math.hypot(dx, dy);
    if (d > s.R) { s.bx += (dx / d) * (d - s.R); s.by += (dy / d) * (d - s.R); dx = x - s.bx; dy = y - s.by; }
    s.tx = s.bx + dx; s.ty = s.by + dy;
    const dd = Math.hypot(dx, dy), dead = 8;
    if (dd > dead) {
      const k = Math.min(1, (dd - dead) / (s.R * 0.8 - dead));
      const m = k * k * (3 - 2 * k);
      s.x = (dx / dd) * m; s.y = (dy / dd) * m;
    } else { s.x = 0; s.y = 0; }
  }
  releaseStick() { this.touch.stick = null; Object.assign(this.stick, { active: false, x: 0, y: 0 }); }

  reset() {
    this.releaseStick();
    this.keys.clear();
    this.touch.look.clear();
    for (const k in this.touch.held) this.touch.held[k] = false;
    for (const b of this._buttons || []) b.classList.remove('down');
    this.mouse.fire = false; this.mouse.dx = this.mouse.dy = 0; this.touch.dx = this.touch.dy = 0;
    this.edges = {};
  }

  // ------------------------------------------------------------ gamepad
  // Poll once per frame. Returns this frame's pressed edges (also used by menus).
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.pad = null; this.padPrev = {}; return {}; }
    this.padId = gp.id; this.gp = gp;
    const down = (i) => { const q = gp.buttons[i]; return !!q && (q.pressed || q.value > 0.35); };
    const map = PAD_PRESETS[this.settings.preset] || PAD_PRESETS.classic;
    const any = (l) => (l || []).some(down);
    const dz = (x, y, inner = 0.16) => { const m = Math.hypot(x, y); if (m < inner) return [0, 0, 0]; const k = Math.min(1, (m - inner) / (0.95 - inner)); return [x / m, y / m, k]; };
    let [lx, ly, lm] = dz(gp.axes[0] || 0, gp.axes[1] || 0), [rx, ry, rm] = dz(gp.axes[2] || 0, gp.axes[3] || 0, 0.12);
    if (this.settings.southpaw) [lx, ly, lm, rx, ry, rm] = [rx, ry, rm, lx, ly, lm];
    const now = { a: down(0), b: down(1), up: down(12), down: down(13), left: down(14), right: down(15) };
    for (const [k] of Object.entries(map)) now[k] = any(map[k]);
    for (let i = 0; i < gp.buttons.length; i++) now['b' + i] = down(i);
    const edges = {};
    for (const k in now) if (now[k] && !this.padPrev[k]) edges[k] = true;
    const moved = lm > 0 || rm > 0 || Object.keys(edges).length;
    if (moved) this.setDevice('pad');
    this.padPrev = now;
    this.pad = { lx, ly, lm, rx, ry, rm, now, edges };
    return edges;
  }

  rumble(strong, weak, ms) {
    if (!this.settings.rumble || this.device !== 'pad') return;
    try { this.gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (_) { /* unsupported */ }
  }

  // ------------------------------------------------------------ per-frame snapshot
  frame(dt) {
    const k = this.keys, E = this.edges, pad = this.pad, st = this.settings;
    const out = { mx: 0, my: 0, lookX: 0, lookY: 0, assisted: false, fire: false, crouch: false, action: false };
    // keyboard
    if (k.has('KeyA') || k.has('ArrowLeft')) out.mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) out.mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) out.my += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) out.my -= 1;
    const inv = st.invertY ? -1 : 1;
    const ms = T.mouseLook * (0.35 + st.lookSens * 0.13);
    out.lookX -= this.mouse.dx * ms; out.lookY -= this.mouse.dy * ms * inv;
    this.mouse.dx = this.mouse.dy = 0;
    out.fire = this.mouse.fire || k.has('KeyJ');
    if (k.has('KeyJ') && !this._kj) E.fireEdge = true;
    this._kj = k.has('KeyJ');
    out.crouch = k.has('KeyC') || k.has('ControlLeft');
    out.action = k.has('KeyE');
    // touch
    if (this.stick.active) { out.mx += this.stick.x; out.my -= this.stick.y; }
    const ts = T.touchLook * (0.35 + st.touchSens * 0.13);
    if (this.touch.dx || this.touch.dy) { out.lookX -= this.touch.dx * ts; out.lookY -= this.touch.dy * ts * inv; out.assisted = true; }
    this.touch.dx = this.touch.dy = 0;
    const H = this.touch.held;
    if (H.fire) out.fire = true;
    if (this.touch.crouch) out.crouch = true;
    if (H.action && performance.now() - (this.touch.actT || 0) > 200) out.action = true;
    if (this.device === 'touch') out.assisted = true;
    // gamepad
    if (pad) {
      out.mx += pad.lx * pad.lm; out.my -= pad.ly * pad.lm;
      if (pad.rm > 0) {
        // response curve + Halo's turn ramp at full tilt
        const curve = Math.pow(pad.rm, 1.8);
        if (pad.rm > 0.95) this.padTurnT += dt; else this.padTurnT = 0;
        const ramp = 1 + Math.min(1, Math.max(0, this.padTurnT - 0.3) / 0.35) * T.padLookAccel;
        const sp = T.padLookSpeed * (0.35 + st.padSens * 0.13) * curve * ramp;
        out.lookX -= pad.rx * sp * dt; out.lookY -= pad.ry * sp * 0.72 * dt * inv;
      } else this.padTurnT = 0;
      const n = pad.now, e = pad.edges;
      if (n.fire) out.fire = true;
      if (e.fire) E.fireEdge = true;
      if (e.jump) E.jump = true;
      if (e.melee) E.melee = true;
      if (e.swap) E.swap = true;
      if (e.grenade) E.grenade = true;
      if (e.gswitch) E.gswitch = true;
      if (e.zoom) E.zoom = true;
      if (e.pause) E.pause = true;
      if (e.objective) E.objective = true;
      if (e.crouch) this.padCrouch = !this.padCrouch;
      if (this.padCrouch) out.crouch = true;
      // X: tap = reload, hold = pick up / use (Halo 2)
      if (n.action) { this.padActT = (this.padActT || 0) + dt; if (this.padActT > 0.2) out.action = true; }
      else { if (this.padActT > 0 && this.padActT <= 0.2) E.reload = true; this.padActT = 0; }
      if (this.device === 'pad') out.assisted = true;
      if (Math.hypot(pad.lx, pad.ly) * pad.lm > 0.9 && this.padCrouch && pad.edges.jump) this.padCrouch = false;
    }
    const ml = Math.hypot(out.mx, out.my);
    if (ml > 1) { out.mx /= ml; out.my /= ml; }
    for (const key of EDGE_KEYS) out[key] = !!E[key];
    this.edges = {};
    return out;
  }
}
