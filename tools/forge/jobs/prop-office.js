// MAP04 office-tower props (sprites/props, rotation 0): cubicles, burning desks
// and paper piles, the photocopier, water cooler, ficus and vending machine.
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash, mix } from '../lib/env/tex.js';
import { flame, ball, renderFrames } from '../lib/env/fire.js';
import { CH, fabricAt } from '../lib/env/chicago.js';

export default async function (F, params = {}) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const P = K.P;
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);
  const FL = (img, proj, x, y, z, w, h, o) => { const [cx, cy] = proj(x, y, z); flame(img, { x: cx, y: cy, w: w * 64, h: h * 64 / 1.2, ...o }); };
  const BL = (img, proj, x, y, z, r, o) => { const [cx, cy] = proj(x, y, z); ball(img, { cx, cy, rx: r * 64, ry: r * 64 / 1.2, ...o }); };

  // ------------------------------------------------------------ shared materials
  const surfMat = (paint, size = 128, o = {}) => { const s = new Surf(size, size); paint(s); return K.texMat(K.surfTex(s, { repeat: o.repeat || [1, 1] }), { rough: o.rough ?? 0.8, metal: o.metal ?? 0 }); };
  const fabricMat = (burn = 0) => surfMat((s) => s.each((u, v, x, y, i) => {
    let [c] = fabricAt(x, y, CH.fabric, 3101);
    if (burn) { const b = clamp((fbm(u, v, 2, 2, 4, 3102) - 0.5 + burn * 0.5) * 1.6); const k = 0.55 - b * 0.4; c = [c[0] * k + b * 16, c[1] * k + b * 10, c[2] * k + b * 6]; }
    s.setC(i, c);
  }), 128, { repeat: [3, 3], rough: 0.95 });
  const charMat = (base, seed, amount = 0.5) => surfMat((s) => s.each((u, v, x, y, i) => {
    const n = fbm(u, v, 6, 6, 4, seed), b = clamp((fbm(u, v, 3, 3, 4, seed + 1) - 0.5 + amount * 0.5) * 3);
    const k = (0.85 + n * 0.25) * (1 - b * 0.85);
    s.setC(i, [base[0] * k + b * 18, base[1] * k + b * 12, base[2] * k + b * 8]);
  }), 128, { rough: 0.85 });
  const beige = M(0xd2c8ae, { rough: 0.55 }), beigeDk = M(0xa89e86, { rough: 0.6 }), grey = M(0x8e9294, { rough: 0.5, metal: 0.3 });
  const paperTex = (seed, kind = 0) => canvasTex(64, 90, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = kind === 1 ? '#e8d6a0' : kind === 2 ? '#f4e45a' : '#f2efe6'; g.fillRect(0, 0, w, h);
    if (kind) return;
    g.fillStyle = '#222'; g.fillRect(6, 6, 30, 5);
    g.fillStyle = 'rgba(40,40,50,0.7)'; for (let y = 16; y < h - 8; y += 5) g.fillRect(6, y, 20 + r() * 32, 2);
  });
  const sheet = (seed, kind) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), K.texMat(paperTex(seed, kind), { rough: 0.9, side: THREE.DoubleSide })); return m; };
  const crtTex = (on = true) => canvasTex(96, 72, (g, w, h) => {
    g.fillStyle = on ? '#0a1a40' : '#101414'; g.fillRect(0, 0, w, h);
    if (on) {
      g.fillStyle = '#c0c0c0'; g.fillRect(0, h - 8, w, 8); g.fillStyle = '#208020'; g.fillRect(2, h - 7, 14, 6);   // a Windows-95-ish taskbar
      g.fillStyle = '#e8e8e8'; g.fillRect(14, 10, 60, 40); g.fillStyle = '#000080'; g.fillRect(14, 10, 60, 6);
      g.fillStyle = '#444'; for (let y = 22; y < 46; y += 4) g.fillRect(18, y, 40 + ((y * 7) % 14), 1.5);
    }
    for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, y, w, 1); }
  });
  // a 1997 CRT monitor: beige shell, deep back, glass screen facing +z
  const crt = (on = true) => {
    const g = new THREE.Group();
    add(g, boxUp(beige, 0.4, 0.36, 0.33, 0.03), 0, 0.03, 0);
    add(g, boxUp(beige, 0.3, 0.27, 0.16, 0.03), 0, 0.07, -0.22);
    add(g, boxUp(beigeDk, 0.22, 0.03, 0.22, 0.01), 0, 0, -0.02);
    add(g, boxUp(M(0x1a1c1e, { rough: 0.3 }), 0.33, 0.27, 0.01), 0, 0.075, 0.166);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.23), new THREE.MeshBasicMaterial({ map: crtTex(on) }));
    add(g, scr, 0, 0.21, 0.172);
    add(g, box(M(0x40c040, { emissive: on ? 0x40ff40 : 0x000000 }), 0.012, 0.012, 0.01), 0.16, 0.05, 0.168);
    return g;
  };
  const pcTower = () => {
    const g = new THREE.Group();
    add(g, boxUp(beige, 0.19, 0.42, 0.44, 0.012), 0, 0, 0);
    add(g, boxUp(beigeDk, 0.15, 0.045, 0.01), 0, 0.33, 0.221); add(g, boxUp(beigeDk, 0.15, 0.045, 0.01), 0, 0.27, 0.221);
    add(g, boxUp(M(0x2a2a2a), 0.1, 0.012, 0.01), 0, 0.21, 0.222);
    add(g, box(M(0x40ff40, { emissive: 0x40ff40 }), 0.012, 0.012, 0.01), 0.05, 0.12, 0.222);
    return g;
  };
  const chair = (fabMat) => {
    const root = new THREE.Group();
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5, leg = boxUp(P.black, 0.05, 0.035, 0.3, 0.01); const g = new THREE.Group(); g.add(leg); leg.position.z = 0.15; g.rotation.y = a; g.position.y = 0.06; root.add(g); add(root, sphere(P.rubber, 0.03, 10, 8), Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3); }
    add(root, cyl(P.chrome, 0.022, 0.32, 12), 0, 0.24, 0);
    add(root, boxUp(fabMat, 0.5, 0.09, 0.48, 0.035), 0, 0.43, 0.02);
    const back = new THREE.Group(); add(back, boxUp(fabMat, 0.46, 0.52, 0.08, 0.035), 0, 0.1, 0); add(root, back, 0, 0.5, -0.24, -0.12, 0, 0);
    for (const x of [-0.25, 0.25]) { add(root, boxUp(P.black, 0.03, 0.2, 0.03, 0.008), x, 0.48, -0.02); add(root, boxUp(P.black, 0.06, 0.03, 0.26, 0.012), x, 0.68, 0.01); }
    return root;
  };
  const chairFab = M(0x3a4660, { rough: 0.9, detail: 'weave' });

  // ------------------------------------------------------------ DCUB: cubicle section (A intact, B-E on fire)
  if (want('DCUB')) {
    const root = new THREE.Group();
    const fabA = fabricMat(0), fabB = fabricMat(0.6);
    const trimA = M(0x96989a, { rough: 0.5, metal: 0.2 }), trimB = M(0x4a4440, { rough: 0.7 });
    const deskA = M(0xc4bead, { rough: 0.6 }), deskB = charMat([196, 190, 178], 3103, 0.4);
    const panels = [], trims = [], desks = [];
    // L-shaped partitions: back wall along x, side wall along z (left)
    const panel = (w, x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); const p = add(g, boxUp(fabA, w, 1.56, 0.06, 0.01), 0, 0.04, 0); panels.push(p); trims.push(add(g, boxUp(trimA, w + 0.02, 0.04, 0.08, 0.015), 0, 1.6, 0)); trims.push(add(g, boxUp(trimA, w, 0.05, 0.065, 0.005), 0, 0, 0)); for (const ex of [-w / 2, w / 2]) trims.push(add(g, boxUp(trimA, 0.04, 1.62, 0.08, 0.01), ex, 0, 0)); return g; };
    const backP = panel(2.0, 0, -0.78, 0), sideP = panel(1.4, -1.0, -0.06, Math.PI / 2);
    // pinned papers and a calendar on the inner faces
    const pin = (parent, tex, w, h, x, y, rz) => add(parent, new THREE.Mesh(new THREE.PlaneGeometry(w, h), K.texMat(tex, { rough: 0.9, side: THREE.DoubleSide })), x, y, 0.035, 0, 0, rz);
    pin(backP, paperTex(3111), 0.21, 0.29, -0.5, 1.25, 0.05); pin(backP, paperTex(3112), 0.21, 0.29, -0.22, 1.28, -0.04); pin(backP, paperTex(0, 2), 0.08, 0.08, 0.05, 1.32, 0.1);
    pin(backP, canvasTex(64, 80, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a6ab0'; g.fillRect(0, 0, w, 26); g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.fillText('JUNE 97', 6, 17); g.fillStyle = '#333'; for (let r2 = 0; r2 < 5; r2++) for (let c2 = 0; c2 < 7; c2++) g.fillRect(4 + c2 * 8.4, 32 + r2 * 9, 5, 4); }), 0.24, 0.3, 0.55, 1.22, 0);
    pin(sideP, paperTex(3113), 0.21, 0.29, 0.2, 1.2, -0.06);
    // L worksurface, pedestal, monitor, keyboard, tower, phone, papers, mug
    desks.push(add(root, boxUp(deskA, 1.94, 0.03, 0.62, 0.008), 0.0, 0.71, -0.43));
    desks.push(add(root, boxUp(deskA, 0.62, 0.03, 0.8, 0.008), -0.66, 0.71, 0.27));
    add(root, boxUp(grey, 0.42, 0.66, 0.56, 0.01), 0.7, 0.02, -0.43);
    for (let k = 0; k < 3; k++) add(root, boxUp(M(0x9a9ea0, { rough: 0.5, metal: 0.3 }), 0.38, 0.19, 0.02, 0.005), 0.7, 0.06 + k * 0.21, -0.14);
    const mon = crt(true); add(root, mon, -0.55, 0.74, -0.42, 0, 0.55, 0);
    add(root, boxUp(beige, 0.44, 0.03, 0.16, 0.01), -0.28, 0.74, -0.08, 0.06, 0.55, 0);
    add(root, pcTower(), -0.66, 0, -0.35, 0, 0.3, 0);
    add(root, boxUp(M(0x2a2a2c, { rough: 0.5 }), 0.2, 0.06, 0.2, 0.02), 0.35, 0.74, -0.6, 0, -0.3, 0);
    const r = rng(3114);
    const papers = [];
    for (let k = 0; k < 6; k++) papers.push(add(root, sheet(3115 + k, k % 3 === 2 ? 1 : 0), 0.05 + r() * 0.5, 0.745 + k * 0.002, -0.45 + r() * 0.3, -Math.PI / 2, 0, (r() - 0.5) * 1.2));
    add(root, boxUp(M(0x30343a, { rough: 0.6 }), 0.3, 0.08, 0.36, 0.005), 0.5, 0.74, -0.55);
    add(root, lathe(M(0xe8e4dc, { rough: 0.4 }), [[0, 0], [0.042, 0], [0.045, 0.1], [0.04, 0.1], [0.037, 0.01], [0, 0.01]], 16), 0.15, 0.74, -0.25);
    const ch = chair(chairFab); add(root, ch, -0.05, 0, 0.35, 0, 2.6, 0);
    const pose = (f) => {
      const burn = f !== 'A';
      panels.forEach((p) => (p.material = burn ? fabB : fabA)); trims.forEach((p) => (p.material = burn ? trimB : trimA)); desks.forEach((p) => (p.material = burn ? deskB : deskA));
    };
    const post = (f, img, ox, oy, px, proj) => {
      if (f === 'A') return;
      const t = 'BCDE'.indexOf(f) / 4;
      FL(img, proj, 0.25, 0.75, -0.45, 0.42, 1.1, { t, seed: 3121 });              // the papers on the desk
      FL(img, proj, -0.3, 0.75, -0.6, 0.3, 1.4, { t: t + 0.35, seed: 3122 });      // climbing the back panel
      FL(img, proj, 0.7, 1.62, -0.78, 0.22, 0.7, { t: t + 0.6, seed: 3123 });      // along the top cap
      FL(img, proj, -1.0, 0.9, 0.2, 0.25, 1.0, { t: t + 0.2, seed: 3124 });       // side panel
      FL(img, proj, -0.05, 0.5, 0.35, 0.25, 0.65, { t: t + 0.8, seed: 3125 });     // the chair seat
      BL(img, proj, 0.0, 2.5 + t * 0.15, -0.4, 0.5, { seed: 3126 + 'BCDE'.indexOf(f), heat: 0.12, smoke: 1, turb: 0.9 });
    };
    await renderFrames(F, { prefix: 'DCUB', root, frames: [...'ABCDE'], pose, post, w: 3.0, top: 2.9, bottom: -0.1, yaw: -0.5, elev: 12 });
  }

  // ------------------------------------------------------------ DDBN: office desk on fire (A-D)
  if (want('DDBN')) {
    const root = new THREE.Group();
    const wood = charMat([132, 92, 58], 3131, 0.55), dark = M(0x1c1612, { rough: 0.9 });
    add(root, boxUp(wood, 1.6, 0.05, 0.8, 0.01), 0, 0.71, 0);
    for (const x of [-0.58, 0.58]) {
      add(root, boxUp(wood, 0.42, 0.7, 0.74, 0.01), x, 0.01, 0);
      for (let k = 0; k < 3; k++) add(root, boxUp(charMat([120, 84, 52], 3132 + k, 0.6), 0.38, 0.2, 0.02, 0.005), x, 0.05 + k * 0.22, 0.37 + (k === 1 && x > 0 ? 0.12 : 0));
    }
    add(root, boxUp(wood, 0.76, 0.5, 0.02, 0.005), 0, 0.2, -0.36);
    // what's left on top: a scorched CRT, a lamp, heaps of paper
    const mon = crt(false), burntBeige = charMat([170, 160, 136], 3133, 0.5); mon.traverse((o) => { if (o.material === beige || o.material === beigeDk) o.material = burntBeige; }); add(root, mon, -0.4, 0.76, -0.1, 0, 0.35, 0);
    const r = rng(3134);
    for (let k = 0; k < 9; k++) add(root, sheet(3135 + k, k % 4 === 3 ? 1 : 0), 0.05 + r() * 0.6, 0.765 + k * 0.003, -0.25 + r() * 0.45, -Math.PI / 2 + (r() - 0.5) * 0.2, 0, r() * 3);
    add(root, boxUp(dark, 0.5, 0.06, 0.4, 0.01), 0.35, 0.76, 0.05);
    const post = (f, img, ox, oy, px, proj) => {
      const t = 'ABCD'.indexOf(f) / 4;
      FL(img, proj, 0.3, 0.77, 0.0, 0.55, 1.35, { t, seed: 3141 });
      FL(img, proj, -0.15, 0.77, 0.15, 0.4, 1.05, { t: t + 0.3, seed: 3142 });
      FL(img, proj, -0.6, 1.1, -0.1, 0.24, 0.7, { t: t + 0.55, seed: 3143 });
      FL(img, proj, 0.6, 0.35, 0.4, 0.2, 0.55, { t: t + 0.75, seed: 3144 });        // an open drawer burning
      BL(img, proj, 0.0, 2.6 + t * 0.2, 0, 0.55, { seed: 3145 + 'ABCD'.indexOf(f), heat: 0.12, smoke: 1, turb: 0.9 });
    };
    await renderFrames(F, { prefix: 'DDBN', root, frames: [...'ABCD'], post, w: 2.4, top: 3.0, bottom: -0.1, yaw: 0.45, elev: 12 });
  }

  // ------------------------------------------------------------ DPBN: pile of burning papers and binders (A-D)
  if (want('DPBN')) {
    const root = new THREE.Group();
    const r = rng(3151);
    const binderCols = [0x1a1a1e, 0x1c3a8a, 0x8a1c1c, 0x2a5a2a, 0xd8d0b8];
    for (let k = 0; k < 9; k++) {
      const b = new THREE.Group(), col = binderCols[k % binderCols.length];
      add(b, boxUp(charMat([(col >> 16) & 255, (col >> 8) & 255, col & 255], 3152 + k, 0.45), 0.29, 0.05, 0.31, 0.008), 0, 0, 0);
      add(b, boxUp(M(0xf0ece0, { rough: 0.9 }), 0.27, 0.035, 0.28, 0.004), 0.008, 0.008, 0);
      const a = r() * 6.28, d = r() * 0.4;
      add(root, b, Math.cos(a) * d, 0.02 + (k > 5 ? 0.08 : 0) + r() * 0.05, Math.sin(a) * d * 0.7, (r() - 0.5) * 0.7, r() * 6, (r() - 0.5) * 0.6);
    }
    // a banker's box split open
    const bx = charMat([196, 176, 140], 3160, 0.55);
    add(root, boxUp(bx, 0.32, 0.26, 0.42, 0.01), -0.42, 0, -0.15, 0, 0.4, 0.2);
    for (let k = 0; k < 22; k++) { const s = sheet(3161 + k, k % 5 === 4 ? 1 : 0), a = r() * 6.28, d = 0.2 + r() * 0.55; add(root, s, Math.cos(a) * d, 0.012 + r() * 0.12, Math.sin(a) * d * 0.8, -Math.PI / 2 + (r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.5); }
    add(root, sphere(charMat([60, 46, 36], 3170, 0.9), 0.32, 14, 8), 0.05, 0.02, 0).scale.set(1.2, 0.35, 1.0);
    const post = (f, img, ox, oy, px, proj) => {
      const t = 'ABCD'.indexOf(f) / 4;
      FL(img, proj, 0.0, 0.1, 0.0, 0.5, 1.25, { t, seed: 3171 });
      FL(img, proj, -0.35, 0.15, -0.1, 0.25, 0.8, { t: t + 0.35, seed: 3172 });
      FL(img, proj, 0.35, 0.06, 0.15, 0.22, 0.62, { t: t + 0.65, seed: 3173 });
      BL(img, proj, 0.0, 1.9 + t * 0.2, 0, 0.42, { seed: 3174 + 'ABCD'.indexOf(f), heat: 0.12, smoke: 1, turb: 0.9 });
    };
    await renderFrames(F, { prefix: 'DPBN', root, frames: [...'ABCD'], post, w: 1.8, top: 2.4, bottom: -0.1, yaw: 0.2, elev: 16 });
  }

  // ------------------------------------------------------------ DCPY: photocopier
  if (want('DCPY')) {
    const root = new THREE.Group();
    const body = M(0xcfcbbd, { rough: 0.5 }), dark = M(0x3a3c40, { rough: 0.5 }), mid = M(0x9a9c98, { rough: 0.5 });
    add(root, boxUp(dark, 1.08, 0.08, 0.66, 0.01), 0, 0.03, 0);
    for (const x of [-0.48, 0.48]) for (const z of [-0.26, 0.26]) add(root, sphere(P.rubber, 0.035, 8, 6), x, 0.035, z);
    add(root, boxUp(body, 1.1, 0.88, 0.68, 0.02), 0, 0.1, 0);
    // paper drawers with handles and size windows
    for (let k = 0; k < 3; k++) {
      add(root, boxUp(M(0xc4c0b2, { rough: 0.5 }), 0.84, 0.17, 0.02, 0.006), -0.08, 0.14 + k * 0.19, 0.34);
      add(root, box(mid, 0.2, 0.025, 0.03, 0.006), -0.08, 0.27 + k * 0.19, 0.355);
      add(root, box(M(0x202020), 0.05, 0.03, 0.01, 0.003), 0.24, 0.24 + k * 0.19, 0.352);
    }
    add(root, boxUp(M(0xc8c4b6, { rough: 0.5 }), 0.22, 0.55, 0.02, 0.006), 0.42, 0.14, 0.34);       // front door
    // top: platen with the document feeder lid, control panel angled toward the user
    add(root, boxUp(M(0xbcb8aa, { rough: 0.5 }), 0.9, 0.1, 0.56, 0.03), -0.07, 0.98, -0.02);
    add(root, boxUp(M(0xa8a496, { rough: 0.5 }), 0.5, 0.05, 0.36, 0.02), -0.1, 1.08, -0.05);
    const pnl = canvasTex(128, 48, (g, w, h) => {
      g.fillStyle = '#5a5c5a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7aa070'; g.fillRect(6, 6, 46, 20); g.fillStyle = '#1a3a1a'; g.font = 'bold 9px monospace'; g.fillText('READY  1', 9, 19);
      for (let k = 0; k < 12; k++) { g.fillStyle = k === 11 ? '#20a040' : '#d8d8d0'; g.fillRect(60 + (k % 4) * 15, 6 + Math.floor(k / 4) * 12, 11, 8); }
      g.fillStyle = '#20a040'; g.beginPath(); g.arc(30, 38, 6, 0, 7); g.fill();
    });
    const cp = new THREE.Group(); add(root, cp, 0.33, 1.0, 0.2, -0.45, 0, 0);
    add(cp, boxUp(body, 0.42, 0.04, 0.2, 0.01), 0, 0, 0);
    add(cp, new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.18), new THREE.MeshBasicMaterial({ map: pnl })), 0, 0.042, 0, -Math.PI / 2, 0, 0);
    // side sorter bins and an output tray with copies
    for (let k = 0; k < 8; k++) add(root, boxUp(M(0xb8b4a6, { rough: 0.5 }), 0.3, 0.012, 0.4, 0.004), 0.68, 0.38 + k * 0.06, 0, 0, 0, -0.18);
    add(root, boxUp(mid, 0.06, 0.62, 0.44, 0.01), 0.58, 0.34, 0);
    for (let k = 0; k < 3; k++) add(root, boxUp(M(0xf2efe6, { rough: 0.9 }), 0.24, 0.006, 0.3, 0.002), 0.7, 0.4 + k * 0.12, 0, 0, 0, -0.18);
    add(root, boxUp(M(0xf2efe6, { rough: 0.9 }), 0.24, 0.05, 0.3, 0.003), -0.3, 1.03, 0.1, 0, 0.3, 0);
    const lbl = canvasTex(128, 24, (g) => { g.fillStyle = '#444'; g.font = 'bold 16px sans-serif'; g.fillText('COPYSTAR 5050', 4, 18); });
    add(root, decal(lbl, 0.36, 0.07), -0.25, 0.86, 0.342);
    await prop(F, { prefix: 'DCPY', root, w: 1.9, top: 1.5, bottom: -0.1, yaw: 0.45, elev: 12 });
  }

  // ------------------------------------------------------------ DWCL: water cooler (A upright, B knocked over and leaking)
  if (want('DWCL')) {
    const cab = M(0xe6e2d6, { rough: 0.45 }), blue = new THREE.MeshStandardMaterial({ color: 0x7ab0e0, roughness: 0.15, metalness: 0.1, emissive: 0x10203a });
    const cooler = () => {
      const g = new THREE.Group();
      add(g, boxUp(cab, 0.32, 0.95, 0.32, 0.02), 0, 0, 0);
      add(g, boxUp(M(0x9a968a, { rough: 0.6 }), 0.33, 0.05, 0.33, 0.01), 0, 0, 0);
      add(g, boxUp(M(0x5a5a58), 0.2, 0.08, 0.02, 0.005), 0, 0.68, 0.161);
      add(g, boxUp(M(0x3a3a3a), 0.2, 0.012, 0.1, 0.003), 0, 0.55, 0.18);   // drip tray
      for (const [x, c] of [[-0.05, 0x2050c0], [0.05, 0xc02020]]) add(g, boxUp(M(c, { rough: 0.4 }), 0.035, 0.05, 0.05, 0.008), x, 0.62, 0.17);
      add(g, cyl(M(0xd8d4c8, { rough: 0.5 }), 0.04, 0.3, 12), 0.2, 0.62, 0.05);   // cup dispenser
      return g;
    };
    const bottle = () => lathe(blue, [[0, 0], [0.04, 0], [0.04, 0.06], [0.13, 0.12], [0.135, 0.2], [0.13, 0.26], [0.135, 0.32], [0.13, 0.4], [0.1, 0.46], [0, 0.48]], 24);
    // A: upright, bottle on top
    {
      const root = new THREE.Group(); add(root, cooler(), 0, 0, 0); add(root, bottle(), 0, 0.95, 0);
      await prop(F, { prefix: 'DWCL', root, frames: [{ f: 'A' }], w: 0.9, top: 1.6, bottom: -0.1, yaw: 0.5, elev: 10 });
    }
    // B: on its side, the bottle rolled off, a puddle spreading
    {
      const root = new THREE.Group();
      const c = cooler(); add(root, c, 0, 0.16, 0, 0, 0.3, Math.PI / 2); c.position.x = 0.48;
      add(root, bottle(), -0.45, 0.135, 0.35, 0, 0.9, Math.PI / 2 - 0.1);
      const pud = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(150,180,200,0.85)'; g.beginPath(); const r = rng(3181); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = 40 + r() * 20; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr * 0.8); } g.fill(); });
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshStandardMaterial({ map: pud, transparent: true, alphaTest: 0.5, roughness: 0.05, metalness: 0.4, color: 0xb8d0e0 }));
      add(root, pm, 0.05, 0.004, 0.15, -Math.PI / 2, 0, 0);
      await prop(F, { prefix: 'DWCL', root, frames: [{ f: 'B' }], w: 1.9, top: 0.8, bottom: -0.3, yaw: 0, elev: 16 });
    }
  }

  // ------------------------------------------------------------ DPLT: potted ficus
  if (want('DPLT')) {
    const root = new THREE.Group();
    const pot = M(0xb0a890, { rough: 0.5 });
    add(root, lathe(pot, [[0, 0], [0.18, 0], [0.2, 0.02], [0.24, 0.42], [0.25, 0.46], [0.23, 0.46], [0.22, 0.42], [0, 0.42]], 24));
    add(root, cyl(M(0x3a2a1c, { rough: 1 }), 0.22, 0.02, 20), 0, 0.42, 0);
    const bark = M(0x6a5a46, { rough: 0.9 });
    for (let k = 0; k < 3; k++) { const a = k * 2.1; add(root, taper(bark, [[Math.cos(a) * 0.04, 0.42, Math.sin(a) * 0.04], [Math.cos(a + 1.5) * 0.04, 0.8, Math.sin(a + 1.5) * 0.04], [Math.cos(a + 3) * 0.05, 1.2, Math.sin(a + 3) * 0.05], [Math.cos(a) * 0.12, 1.55, Math.sin(a) * 0.12]], (t) => 0.022 * (1 - t * 0.5), 24, 6)); }
    const leafTex = canvasTex(96, 96, (g) => {
      const r = rng(3191);
      for (let k = 0; k < 70; k++) { const x = 10 + r() * 76, y = 10 + r() * 76, a = r() * 6.28, kk = 0.6 + r() * 0.6; g.fillStyle = `rgb(${46 * kk | 0},${92 * kk | 0},${44 * kk | 0})`; g.beginPath(); g.ellipse(x, y, 6.5, 3.2, a, 0, 7); g.fill(); g.strokeStyle = `rgba(20,40,20,0.5)`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); g.stroke(); }
    });
    const lm = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
    add(root, sphere(M(0x14240f, { rough: 1 }), 0.4, 12, 8), 0, 1.5, 0).scale.set(1.0, 0.85, 1.0);
    const r = rng(3192);
    for (let k = 0; k < 90; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), lm);
      const a = r() * 6.28, hy = r(), rr = (0.3 + r() * 0.25) * Math.sin(Math.PI * (0.15 + hy * 0.85));
      add(root, c, Math.cos(a) * rr, 1.0 + hy * 0.95, Math.sin(a) * rr, r() * 3, r() * 3, r() * 3);
    }
    for (let k = 0; k < 4; k++) { const lf = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), M(0x6a7a30, { rough: 0.8, side: THREE.DoubleSide })); lf.scale.x = 2; add(root, lf, 0.3 + r() * 0.2, 0.004, (r() - 0.5) * 0.5, -Math.PI / 2, 0, r() * 3); }
    await prop(F, { prefix: 'DPLT', root, w: 1.3, top: 2.2, bottom: -0.1, yaw: 0, elev: 8 });
  }

  // ------------------------------------------------------------ DVND: soda vending machine (A-B lit flicker)
  if (want('DVND')) {
    const root = new THREE.Group();
    const body = M(0x1e3a7a, { rough: 0.4, metal: 0.2 }), dark = M(0x18181a, { rough: 0.5 });
    add(root, boxUp(body, 0.98, 1.84, 0.82, 0.02), 0, 0, 0);
    add(root, boxUp(dark, 0.98, 0.06, 0.8, 0.01), 0, 0, 0.01);
    const front = (lit) => canvasTex(160, 256, (g, w, h) => {
      const k = lit;
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgb(${230 * k + 20},${60 * k + 10},${30 * k + 10})`); gr.addColorStop(1, `rgb(${170 * k + 20},${30 * k + 8},${20 * k + 8})`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (lit < 0.9) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, h * 0.42, w, h * 0.3); }
      // a big frosty can and the slogan
      g.save(); g.translate(w / 2, h * 0.55); g.rotate(-0.2);
      g.fillStyle = `rgba(240,240,250,${0.9 * k + 0.1})`; g.fillRect(-28, -70, 56, 140);
      g.fillStyle = `rgba(200,40,30,${0.95})`; g.fillRect(-28, -40, 56, 70);
      g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('FIZZ', 0, 2); g.font = 'bold 9px sans-serif'; g.fillText('COLA', 0, 16);
      g.fillStyle = 'rgba(180,180,190,0.9)'; g.fillRect(-26, -76, 52, 8); g.restore();
      g.fillStyle = '#fff'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.fillText('ICE', w / 2, 34); g.fillText('COLD', w / 2, 60);
      g.font = 'bold 12px sans-serif'; g.fillText('DRINKS 75¢', w / 2, h - 16);
      for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, w, 1); }
    });
    const texA = front(1), texB = front(0.55);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.5), new THREE.MeshBasicMaterial({ map: texA }));
    add(root, panel, -0.14, 1.0, 0.412);
    add(root, boxUp(M(0x2a2a2e, { rough: 0.4 }), 0.66, 0.04, 0.02), -0.14, 1.73, 0.41);
    // selection column: lit buttons, coin slot, bill acceptor, coin return
    const btn = (lit) => canvasTex(32, 256, (g, w, h) => { g.fillStyle = '#26262a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 8; k++) { g.fillStyle = lit ? ['#e03020', '#f0f0f0', '#20a040', '#f0c020'][k % 4] : '#5a4a40'; g.fillRect(5, 8 + k * 22, 22, 15); } g.fillStyle = '#888'; g.fillRect(8, 196, 16, 6); g.fillStyle = '#111'; g.fillRect(6, 214, 20, 10); g.fillStyle = '#aaa'; g.fillRect(8, 236, 16, 12); });
    const btnA = btn(true), btnB = btn(false);
    const col = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.3), new THREE.MeshBasicMaterial({ map: btnA }));
    add(root, col, 0.34, 1.05, 0.412);
    add(root, boxUp(dark, 0.5, 0.18, 0.06, 0.02), -0.14, 0.12, 0.4);          // delivery bin
    add(root, boxUp(M(0x101012), 0.42, 0.1, 0.02), -0.14, 0.16, 0.432);
    const pose = (f) => { panel.material.map = f === 'A' ? texA : texB; col.material.map = f === 'A' ? btnA : btnB; };
    await prop(F, { prefix: 'DVND', root, frames: 'AB', pose, w: 1.6, top: 2.1, bottom: -0.1, yaw: 0.45, elev: 8 });
  }
}
