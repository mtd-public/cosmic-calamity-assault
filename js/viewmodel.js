// First-person arms + weapon. The gun is posed procedurally (sway, bob, kick,
// action clips); both arms then reach it through two-bone IK, so the hands
// stay on the grip and foregrip through every animation, and the elbows and
// shoulders bend to follow. Clips move the left hand to the magazine, the
// charging handle, the loading port, the belt (grenades) or off-screen, and
// move the gun's own parts (magazine, slide, pump, vents).
//
//   vm = new ViewModel(vmScene, vmCam)
//   vm.onEvent(e, w)            sim events: fire, reload, shell, melee, throw, overheat...
//   vm.update(w, dt, t, fx)     pose everything for this frame
import * as THREE from 'three';
import { makeWeapon, makeHeldGrenade } from './gunmodels.js';
import { makePlayerArms, childPose } from './rigs.js';
import { ik2, ikHand, K, bump } from './rig.js';
import { emissiveMat } from './models.js';
import { spriteTex } from './textures.js';
import { WEAPONS } from './weapons.js';
import { TUNING as T } from './tuning.js';

const KSCALE = 0.56; // the held assembly's on-screen scale (Halo-sized)
const V = () => new THREE.Vector3();
const _v = V(), _v2 = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const SHOULDER = { R: [0.26, -0.4, -0.12], L: [-0.26, -0.4, -0.12] };
const REST_L = [-0.36, -0.82, -0.42]; // left hand hanging at the side (one-handed weapons)
const BELT = [-0.28, -0.8, -0.3];  // where grenades come from

export class ViewModel {
  constructor(scene, cam) {
    this.root = new THREE.Group(); this.root.scale.setScalar(KSCALE);
    cam.add(this.root);
    this.arms = makePlayerArms();
    this.arms.right.root.position.set(...SHOULDER.R); this.arms.left.root.position.set(...SHOULDER.L);
    this.root.add(this.arms.right.root, this.arms.left.root);
    this.gunHolder = new THREE.Group(); this.root.add(this.gunHolder);
    this.gun = null; this.id = null;
    this.sway = new THREE.Vector2(); this.last = new THREE.Vector2(); this.bob = 0; this.kick = 0; this.kickR = 0;
    this.clip = null; // { name, t, dur, data }
    this.slideT = 9; this.pumpT = 9; this.landT = 9; this.flashT = 0; this.ventK = 0; this.lastMag = -1;
    this.leftPos = V(); this.leftQ = new THREE.Quaternion(); this.rightPos = V(); this.rightQ = new THREE.Quaternion();
    this.leftInit = false;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('flash'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.scale.set(0.34, 0.34, 1); this.flash.visible = false;
    this.light = new THREE.PointLight(0xffd8a0, 0, 3, 2); scene.add(this.light);
    this.grenades = { frag: makeHeldGrenade('frag'), plasma: makeHeldGrenade('plasma') };
    for (const g of Object.values(this.grenades)) { g.visible = false; this.root.add(g); }
    this.scene = scene;
  }

  setWeapon(id) {
    if (this.gun) this.gunHolder.remove(this.gun.group);
    this.gun = makeWeapon(id);
    this.gun.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.gunHolder.add(this.gun.group);
    this.gun.muzzle.add(this.flash);
    this.id = id; this.lastMag = -1; this.clip = null;
  }

  play(name, dur, data = {}) { this.clip = { name, t: 0, dur, data }; }

  onEvent(e, w) {
    const p = w.player, ws = p.weapons[p.cur], d = ws && WEAPONS[ws.id];
    switch (e.type) {
      case 'fire': {
        const wd = WEAPONS[e.id];
        this.kick = Math.min(1.4, this.kick + (wd.recoil * 18 + 0.25) * (e.charged ? 2 : 1));
        this.kickR = (Math.random() - 0.5) * wd.recoil * 6;
        this.flashT = 0.05; this.slideT = 0;
        if (e.id === 'shotgun') this.pumpT = 0;
        this.brass = e.id !== 'needler' && wd.kind === 'ballistic' && !wd.projectile ? (e.id === 'shotgun' ? 'shell' : 'brass') : null;
        break;
      }
      case 'reload': if (d) this.play(d.shellReload ? 'shellStart' : (this.gun?.vm?.kind === 'pistol' ? 'magPistol' : 'magRifle'), d.shellReload ? d.reload + 0.25 : d.reload); break;
      case 'shell': this.play('shell', d?.reload || 0.5); break;
      case 'reloadCancel': this.clip = null; this.pumpT = 0; break;
      case 'melee': this.play(this.gun?.vm?.kind === 'pistol' ? 'whip' : 'butt', 0.42); break;
      case 'throw': this.play('throw', 0.55, { g: e.g }); break;
      case 'overheat': this.play('vent', d?.ventTime || 2.2); break;
      case 'land': this.landT = 0; break;
      case 'switch': this.clip = null; break;
      default: break;
    }
  }

  // ------------------------------------------------------------ clips
  // Each returns { gun: {p, r}, left: {space, p, q?} | 'fore' | 'rest', mag, charge, slide, grenade, curlL }
  clipPose(k) {
    const c = this.clip, g = this.gun, out = { gun: { p: [0, 0, 0], r: [0, 0, 0] }, left: null, magOff: 0, magVis: true, magOnHand: false, charge: 0, curlL: null, grenade: null };
    if (!c || !g) return out;
    const magHome = g.mag ? g.mag.home : null;
    const hold = (p, off) => ({ space: 'gun', p: [p.x + off[0], p.y + off[1], p.z + off[2]] });
    switch (c.name) {
      case 'magRifle': case 'magPistol': {
        const pistol = c.name === 'magPistol';
        out.gun.r = K(k, [[0, [0, 0, 0]], [0.12, pistol ? [-0.25, 0.35, 0.55] : [-0.15, 0.12, 0.4]], [0.55, pistol ? [-0.25, 0.35, 0.55] : [-0.12, 0.12, 0.42]], [0.6, pistol ? [-0.2, 0.3, 0.5] : [-0.05, 0.1, 0.25]], [0.86, pistol ? [-0.2, 0.3, 0.5] : [-0.05, 0.1, 0.25]], [1, [0, 0, 0]]]);
        out.gun.p = K(k, [[0, [0, 0, 0]], [0.12, [-0.05, -0.04, 0.05]], [0.86, [-0.05, -0.04, 0.05]], [1, [0, 0, 0]]]);
        const pull = K(k, [[0.12, 0], [0.22, 0.16], [0.3, 0.3], [0.36, 0.3], [0.48, 0.14], [0.56, 0]]);
        out.magOff = pull; out.magVis = !(k > 0.29 && k < 0.36); out.magOnHand = k > 0.36 && k < 0.5;
        if (magHome) {
          const grasp = [-0.03, -0.07, 0.0];
          if (k < 0.12) { const a = hold(magHome, grasp); const f = this.forePose(); out.left = { space: 'mix', a, b: f, u: 1 - k / 0.12 }; }
          else if (k < 0.22) { _v.set(0, -pull, 0).applyQuaternion(g.mag.quaternion); out.left = hold(magHome, [grasp[0] + _v.x, grasp[1] + _v.y, grasp[2] + _v.z]); }
          else if (k < 0.36) { _v.set(0, -0.16, 0).applyQuaternion(g.mag.quaternion); out.left = { space: 'mix', a: hold(magHome, [grasp[0] + _v.x, grasp[1] + _v.y, grasp[2] + _v.z]), b: { space: 'root', p: [-0.24, -0.85, -0.42] }, u: K(k, [[0.22, 0], [0.3, 1], [0.36, 1]]) }; }
          else if (k < 0.56) { _v.set(0, -pull, 0).applyQuaternion(g.mag.quaternion); out.left = { space: 'mix', a: { space: 'root', p: [-0.24, -0.85, -0.42] }, b: hold(magHome, [grasp[0] + _v.x, grasp[1] + _v.y, grasp[2] + _v.z]), u: K(k, [[0.36, 0], [0.46, 1]]) }; }
          else if (k < 0.86 && (g.parts.charge || g.parts.slide)) {
            const part = g.parts.charge || g.parts.slide;
            const off = g.parts.charge ? [-0.035, 0.0, 0.0] : [-0.005, 0.03, 0.04];
            const pullZ = K(k, [[0.66, 0], [0.74, g.parts.charge ? 0.06 : 0.035], [0.8, g.parts.charge ? 0.06 : 0.035], [0.82, 0]]);
            out.charge = pullZ;
            const pp = { x: part.position.x, y: part.position.y, z: (part.home ?? part.position.z) + pullZ };
            out.left = { space: 'mix', a: hold(magHome, grasp), b: hold(pp, off), u: K(k, [[0.56, 0], [0.66, 1]]) };
          } else if (k < 0.86) out.left = hold(magHome, grasp);
          else { const f = this.forePose(); out.left = { space: 'mix', a: g.parts.charge || g.parts.slide ? hold({ x: (g.parts.charge || g.parts.slide).position.x, y: (g.parts.charge || g.parts.slide).position.y, z: ((g.parts.charge || g.parts.slide).home ?? 0) }, g.parts.charge ? [-0.035, 0, 0] : [-0.005, 0.03, 0.04]) : hold(magHome, grasp), b: f, u: (k - 0.86) / 0.14 }; }
        }
        out.curlL = k > 0.12 && k < 0.86 ? 0.85 : null;
        if (k > 0.5 && k < 0.58) out.gun.r[2] += bump((k - 0.5) / 0.08) * 0.12; // the slap
        break;
      }
      case 'shellStart': { // the shotgun: tilt, then shells come one by one via 'shell'
        out.gun.r = K(k, [[0, [0, 0, 0]], [0.3, [-0.2, 0.25, 0.7]], [1, [-0.2, 0.25, 0.7]]]);
        out.gun.p = K(k, [[0, [0, 0, 0]], [0.3, [-0.06, -0.05, 0.06]], [1, [-0.06, -0.05, 0.06]]]);
        const port = g.port ? g.port.position : { x: 0, y: 0, z: -0.1 };
        out.left = { space: 'mix', a: this.forePose(), b: { space: 'root', p: [-0.22, -0.82, -0.42] }, u: K(k, [[0.2, 0], [0.7, 1]]) };
        void port;
        break;
      }
      case 'shell': { // one shell: from the belt up to the loading port, thumbed in, back down
        out.gun.r = [-0.2, 0.25, 0.7]; out.gun.p = [-0.06, -0.05, 0.06];
        const port = g.port ? g.port.position : { x: 0, y: 0, z: -0.1 };
        const at = hold(port, [-0.02, -0.06, 0.02]), belt = { space: 'root', p: [-0.22, -0.82, -0.42] };
        if (k < 0.45) out.left = { space: 'mix', a: belt, b: at, u: K(k, [[0, 0], [0.4, 1]]) };
        else if (k < 0.6) out.left = hold(port, [-0.02, -0.06 + bump((k - 0.45) / 0.15) * 0.035, 0.02]);
        else out.left = { space: 'mix', a: at, b: belt, u: K(k, [[0.6, 0], [1, 1]]) };
        out.curlL = 0.7;
        out.grenade = k > 0.05 && k < 0.5 ? 'shell' : null;
        break;
      }
      case 'butt': { // rifle butt-strike: the gun swings in from the right, both hands on it
        const b = bump(k);
        out.gun.r = [0.3 * b, -1.1 * b, 0.55 * b]; out.gun.p = [-0.18 * b, -0.02 * b, -0.12 * b];
        break;
      }
      case 'whip': { // pistol whip
        const b = bump(k);
        out.gun.r = [-0.5 * b, -0.4 * b, 1.3 * b]; out.gun.p = [-0.2 * b, 0.06 * b, -0.18 * b];
        break;
      }
      case 'throw': { // left hand: belt → cocked back → thrown forward → back to the gun
        const p = K(k, [[0, [0, 0, 0]], [0.2, BELT], [0.42, [-0.4, -0.18, -0.25]], [0.62, [-0.08, -0.28, -0.95]], [0.8, [-0.2, -0.45, -0.7]], [1, [0, 0, 0]]]);
        const f = this.forePose();
        if (k < 0.08) out.left = { space: 'mix', a: f, b: { space: 'root', p: BELT }, u: k / 0.08 };
        else if (k > 0.85) out.left = { space: 'mix', a: { space: 'root', p }, b: f, u: (k - 0.85) / 0.15 };
        else out.left = { space: 'root', p, q: K(k, [[0.2, [-0.6, 0.2, 0.2]], [0.42, [-1.6, 0.3, 0.4]], [0.62, [-0.4, 0.1, 0.1]]]) };
        out.gun.r = [0.08 * bump(k), 0.15 * bump(k), -0.35 * bump(k)]; out.gun.p = [0.05 * bump(k), -0.04 * bump(k), 0.02];
        out.grenade = k > 0.14 && k < 0.58 ? this.clip.data.g : null;
        out.curlL = k > 0.14 && k < 0.6 ? 0.8 : 0.3;
        break;
      }
      case 'vent': { // plasma overheat: roll the gun out, flaps open, steam
        const o = K(k, [[0, 0], [0.12, 1], [0.85, 1], [1, 0]]);
        out.gun.r = [0.1 * o, -0.2 * o, 0.7 * o]; out.gun.p = [-0.04 * o, -0.05 * o, 0.04 * o];
        out.ventOpen = o;
        break;
      }
      default: break;
    }
    return out;
  }
  forePose() { const g = this.gun; return { space: 'gun', p: [g.fore.position.x, g.fore.position.y, g.fore.position.z], node: g.fore }; }

  // ------------------------------------------------------------ per-frame
  update(w, dt, t, fx, cam) {
    const p = w.player, ws = p.weapons[p.cur];
    if (!ws || p.vehicle) { this.root.visible = false; this.light.intensity = 0; return; }
    if (this.id !== ws.id) this.setWeapon(ws.id);
    const d = WEAPONS[ws.id], g = this.gun, vmd = g.vm || { pos: [0.2, -0.3, -0.4], rot: [0, 0, 0], left: 'fore', kind: 'rifle' };
    const scoped = p.zoom && d.zoom;
    this.root.visible = !scoped && w.mode !== 'dead';
    if (!this.root.visible) { this.light.intensity = 0; return; }
    // --- clip timing
    if (this.clip) { this.clip.t += dt; if (this.clip.t >= this.clip.dur) this.clip = null; }
    const cp = this.clipPose(this.clip ? this.clip.t / this.clip.dur : 0);
    // --- continuous layers: sway (lags the look), bob (walk), kick (recoil), jump/land, crouch
    const dYaw = Math.atan2(Math.sin(p.yaw - this.last.x), Math.cos(p.yaw - this.last.x)), dPitch = p.pitch - this.last.y;
    this.last.set(p.yaw, p.pitch);
    this.sway.x += (-dYaw * 1.6 - this.sway.x) * Math.min(1, dt * 9);
    this.sway.y += (dPitch * 1.6 - this.sway.y) * Math.min(1, dt * 9);
    this.sway.x = Math.max(-0.08, Math.min(0.08, this.sway.x)); this.sway.y = Math.max(-0.06, Math.min(0.06, this.sway.y));
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround) this.bob += dt * speed * 1.9;
    const bobA = Math.min(1, speed / T.walkSpeed) * (p.onGround ? 1 : 0.15);
    this.kick *= Math.exp(-dt * 13); this.kickR *= Math.exp(-dt * 10);
    this.landT += dt; this.slideT += dt; this.pumpT += dt;
    const land = this.landT < 0.35 ? bump(this.landT / 0.35) : 0;
    const air = p.onGround ? 0 : 1;
    this.airK = (this.airK ?? 0) + (air - (this.airK ?? 0)) * Math.min(1, dt * 6);
    const sw = p.switchT > 0 ? p.switchT / 0.45 : 0;
    const charge = d.charge && p.charge > 0 ? Math.min(1, p.charge / d.charge.time) : 0;
    const px = vmd.pos[0] + this.sway.x * 0.6 + Math.sin(this.bob) * 0.018 * bobA + cp.gun.p[0] + (Math.random() - 0.5) * charge * 0.006;
    const py = vmd.pos[1] + this.sway.y * 0.6 - Math.abs(Math.cos(this.bob)) * 0.014 * bobA + p.crouch * 0.02 - land * 0.06 + this.airK * 0.03 + cp.gun.p[1] - sw * 0.5 + (Math.random() - 0.5) * charge * 0.006;
    const pz = vmd.pos[2] + this.kick * 0.06 + cp.gun.p[2] + sw * 0.1;
    g.group.position.set(px, py, pz);
    g.group.rotation.set(vmd.rot[0] + this.kick * 0.14 + cp.gun.r[0] - land * 0.08 + this.airK * 0.06 - sw * 1.3 + Math.sin(this.bob * 0.5) * 0.006 * bobA,
      vmd.rot[1] + this.sway.x * 0.9 + this.kickR + cp.gun.r[1], vmd.rot[2] + cp.gun.r[2] + Math.sin(this.bob) * 0.012 * bobA + this.sway.x * 0.3);
    g.group.scale.setScalar(1);
    // --- moving parts
    if (g.mag) {
      _v.set(0, -cp.magOff, 0).applyQuaternion(g.mag.quaternion);
      g.mag.position.copy(g.mag.home).add(_v); g.mag.visible = cp.magVis;
    }
    if (g.parts.charge) g.parts.charge.position.z = g.parts.charge.home + cp.charge;
    if (g.parts.slide) g.parts.slide.position.z = (this.slideT < 0.1 ? bump(this.slideT / 0.1) * 0.035 : 0) + (cp.charge && !g.parts.charge ? cp.charge : 0);
    if (g.parts.pump) { const k = this.pumpT > 0.15 && this.pumpT < 0.65 ? bump((this.pumpT - 0.15) / 0.5) : 0; g.parts.pump.position.z = g.parts.pump.home + k * 0.09; }
    if (g.parts.barrels) g.parts.barrels.rotation.z += dt * 20;
    if (g.vents) { const open = Math.max(cp.ventOpen || 0, ws.vent > 0 ? 1 : (ws.heat || 0) * 0.5); this.ventK += (open - this.ventK) * Math.min(1, dt * 8); for (const v of g.vents) v.m.rotation.z = v.side * (0.3 + this.ventK * 0.9); if (this.ventK > 0.5 && Math.random() < 0.5 * fx.budget) { g.vents[0].m.getWorldPosition(_v); fx.spawn({ p: [_v.x, _v.y, _v.z], v: [0, 0.6, 0], life: 0.5, size: 0.08, size1: 0.3, color: 0xa0ffd0, alpha: 0.35, tile: 1, additive: false }); } }
    // --- hand targets (root space)
    g.group.updateMatrix();
    childPose(g.group, g.grip, this.rightPos, this.rightQ);
    const L = cp.left || (vmd.left === 'rest' ? 'rest' : vmd.left === 'pump' && this.pumpT < 0.65 ? 'pump' : 'fore');
    this.resolveLeft(L, this.leftPos, this.leftQ);
    if (!this.leftInit) { this.leftInit = true; this.leftS = this.leftPos.clone(); this.leftSQ = this.leftQ.clone(); }
    // the left hand moves with a little lag so reaches read as reaches
    this.leftS.lerp(this.leftPos, 1 - Math.exp(-dt * 26)); this.leftSQ.slerp(this.leftQ, 1 - Math.exp(-dt * 22));
    // --- IK
    const R = this.arms.right, LA = this.arms.left;
    _v.set(0.7, -1, 0.15); ik2(R.sh, R.el, R.L1, R.L2, this.rightPos, _v); ikHand(R.sh, R.el, R.hand, this.rightQ);
    _v.set(-0.7, -1, 0.15); ik2(LA.sh, LA.el, LA.L1, LA.L2, this.leftS, _v); ikHand(LA.sh, LA.el, LA.hand, this.leftSQ);
    R.hand.grip(0.9, p.lastFire || this.slideT < 0.12 ? 1 : 0.55);
    LA.hand.grip(cp.curlL ?? (L === 'rest' ? 0.35 : vmd.left === 'cup' ? 0.75 : 0.72));
    // --- grenade / shell in the left hand
    for (const [k, gm] of Object.entries(this.grenades)) {
      const on = cp.grenade === k;
      gm.visible = on;
      if (on) { LA.hand.getWorldPosition(_v); this.root.worldToLocal(_v); gm.position.copy(this.leftS); _v2.set(-0.05, -0.1, -0.02).applyQuaternion(this.leftSQ); gm.position.add(_v2); gm.quaternion.copy(this.leftSQ); gm.scale.setScalar(0.8); }
    }
    // --- live bits: AR counter, needler crystals, plasma glow
    if (g.counter && this.lastMag !== ws.mag) {
      this.lastMag = ws.mag;
      const c = g.counter.userData.ctx;
      c.fillStyle = '#031014'; c.fillRect(0, 0, 64, 32);
      c.fillStyle = ws.mag <= 8 ? '#ff5040' : '#4fe3ff'; c.font = 'bold 26px Oxanium, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(ws.mag).padStart(2, '0'), 32, 17);
      g.counter.needsUpdate = true;
    }
    if (g.crystals) g.crystals.forEach((c, i) => { c.visible = i < Math.ceil(ws.mag / 2); });
    if (g.glow && d.kind === 'plasma') g.glow.material = emissiveMat(ws.heat > 0.75 || ws.vent > 0 ? 0xff5030 : d.color, 1.5 + charge * 3);
    if (g.glow && ws.id === 'lance') g.glow.material.opacity = 0.7 + 0.3 * Math.sin(t * 6);
    // --- muzzle flash + brass
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0;
    this.flash.material.color.set(d.side === 'vyrr' ? d.color : 0xffd8a0);
    this.flash.material.rotation = Math.random() * 6.28;
    this.light.intensity = this.flashT > 0 ? 2.5 : 0;
    this.light.color.set(d.side === 'vyrr' ? d.color : 0xffc880);
    this.light.position.copy(g.muzzle.getWorldPosition(_v));
    if (this.brass && fx) {
      const port = this.brass === 'shell' ? (g.eject || g.port) : g.port;
      if (port) {
        port.getWorldPosition(_v); _v2.set(2.2 + Math.random(), 1.6, 0.4).applyQuaternion(cam.quaternion);
        fx.spawn({ p: [_v.x, _v.y, _v.z], v: [_v2.x, _v2.y, _v2.z], life: 0.8, size: this.brass === 'shell' ? 0.035 : 0.022, size1: this.brass === 'shell' ? 0.035 : 0.02, color: this.brass === 'shell' ? 0xd04030 : 0xe0b060, alpha: 1, grav: 12, tile: 0, spin: 12, additive: false });
      }
      this.brass = null;
    }
  }

  // Resolve a left-hand spec into a root-space position + quaternion.
  resolveLeft(L, outP, outQ) {
    const g = this.gun;
    if (L === 'fore' || L === 'pump') {
      childPose(g.group, g.fore, outP, outQ);
      if (L === 'pump' && g.parts.pump) { _v.set(0, 0, g.parts.pump.position.z - g.parts.pump.home).applyQuaternion(g.group.quaternion); outP.add(_v); }
      return;
    }
    if (L === 'rest') { outP.set(...REST_L); _e.set(0.3, 0.4, -0.5); outQ.setFromEuler(_e); return; }
    if (L.space === 'mix') {
      this.resolveLeft(L.a, outP, outQ);
      this.resolveLeft(L.b, _v2, _q2);
      const u = Math.max(0, Math.min(1, L.u)), uu = u * u * (3 - 2 * u);
      outP.lerp(_v2, uu); outQ.slerp(_q2, uu);
      // reaches arc up a little instead of cutting straight across
      outP.y += Math.sin(uu * Math.PI) * 0.03;
      return;
    }
    if (L.space === 'gun') {
      _v.set(L.p[0], L.p[1], L.p[2]).applyMatrix4(g.group.matrix); outP.copy(_v);
      outQ.copy(g.group.quaternion).multiply(g.fore.quaternion);
      return;
    }
    // root space
    outP.set(L.p[0], L.p[1], L.p[2]);
    if (L.q) { _e.set(L.q[0], L.q[1], L.q[2]); outQ.setFromEuler(_e); } else { _e.set(0.3, 0.4, -0.5); outQ.setFromEuler(_e); }
  }
}
