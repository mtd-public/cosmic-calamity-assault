// MAP01 lab props (sprites/props, rotation 0): office and lab furniture,
// specimen tanks, alien growth, the curtain.
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash, textMask } from '../lib/env/tex.js';
import { crateFace, STENCILS } from '../lib/env/crate.js';
import { A, hullPlates, boneRibs, veins } from '../lib/env/alien.js';
import { P as LP, labWall } from '../lib/env/lab.js';
import { ball, flame, renderFrames } from '../lib/env/fire.js';

export default async function (F) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M, G } = K;
  const P = K.P;
  const only = null; // e.g. ['DDSK'] while iterating
  const want = (n) => !only || only.includes(n);

  // ------------------------------------------------------------ shared bits
  const paperTex = (seed, kind = 0) => canvasTex(64, 90, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = kind === 1 ? '#e8d6a0' : '#f2efe6'; g.fillRect(0, 0, w, h);
    if (kind === 1) return;
    g.fillStyle = '#222'; g.fillRect(6, 6, 30, 5);
    g.fillStyle = 'rgba(40,40,50,0.7)';
    for (let y = 16; y < h - 8; y += 5) g.fillRect(6, y, 20 + r() * 32, 2);
    if (r() < 0.5) { g.fillStyle = 'rgba(180,20,20,0.8)'; g.fillRect(34, 4, 24, 8); }
  });
  const sheet = (seed, kind) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), K.texMat(paperTex(seed, kind), { rough: 0.9, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; return m; };
  const crtTex = (seed, flick) => canvasTex(96, 72, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#041208'; g.fillRect(0, 0, w, h);
    g.fillStyle = flick ? '#9dffb8' : '#45e070';
    g.font = 'bold 7px "DejaVu Sans Mono", monospace';
    const lines = ['> SPECIMEN LOG 51-C', '> EBE-3 VITALS ...', '  HR 212  T 31.2C', '> CONTAINMENT: ERR', '> ERR ERR ERR', '> ' + (flick ? '_' : '')];
    lines.forEach((l, k) => g.fillText(l, 5, 12 + k * 10));
    for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, w, 1); }
    if (flick) { const gr = g.createLinearGradient(0, 20, 0, 44); gr.addColorStop(0, 'rgba(180,255,200,0)'); gr.addColorStop(0.5, 'rgba(180,255,200,0.35)'); gr.addColorStop(1, 'rgba(180,255,200,0)'); g.fillStyle = gr; g.fillRect(0, 20, w, 24); }
  });

  // ------------------------------------------------------------ DDSK: desk with papers
  if (want('DDSK')) {
    const root = new THREE.Group();
    const top = M(0xc6b996, { rough: 0.55 }), frame = M(0x70767c, { metal: 0.5, rough: 0.5, detail: 'metal' });
    add(root, boxUp(top, 1.5, 0.04, 0.75, 0.01), 0, 0.72, 0);
    add(root, boxUp(P.black, 1.51, 0.015, 0.76, 0.004), 0, 0.715, 0);
    for (const x of [-0.72]) for (const z of [-0.33, 0.33]) add(root, boxUp(frame, 0.045, 0.715, 0.045, 0.008), x, 0, z);
    add(root, boxUp(frame, 0.02, 0.45, 0.66, 0.005), -0.72, 0.22, 0);            // side stretcher panel
    add(root, boxUp(frame, 1.4, 0.4, 0.02, 0.005), -0.02, 0.3, -0.34);             // modesty panel
    // drawer pedestal
    add(root, boxUp(frame, 0.42, 0.7, 0.7, 0.012), 0.52, 0.01, 0);
    for (let k = 0; k < 3; k++) {
      add(root, boxUp(M(0x7c8288, { metal: 0.45, rough: 0.5 }), 0.38, 0.2, 0.02, 0.006), 0.52, 0.05 + k * 0.215, 0.35);
      add(root, box(P.chrome, 0.12, 0.018, 0.02, 0.004), 0.52, 0.2 + k * 0.215, 0.365);
    }
    // papers, folder, mug, phone
    const r = rng(11);
    for (let k = 0; k < 6; k++) { const s = sheet(20 + k, k === 4 ? 1 : 0); add(root, s, -0.5 + r() * 0.7, 0.762 + k * 0.002, -0.15 + r() * 0.4, -Math.PI / 2, 0, (r() - 0.5) * 1.2); }
    add(root, boxUp(M(0x3a5078, { rough: 0.7 }), 0.24, 0.03, 0.32, 0.005), 0.45, 0.76, -0.1, 0, 0.3, 0);
    const mug = lathe(M(0xe8e4dc, { rough: 0.4 }), [[0, 0], [0.042, 0], [0.045, 0.1], [0.04, 0.1], [0.037, 0.01], [0, 0.01]], 20);
    add(root, mug, 0.12, 0.76, 0.2); add(root, torus(M(0xe8e4dc, { rough: 0.4 }), 0.028, 0.008, 6, 12), 0.165, 0.81, 0.2, 0, 0, Math.PI / 2);
    add(root, sphere(basic(0x2a1a10), 0.036, 12, 4), 0.12, 0.855, 0.2, 0, 0, 0).scale.set(1, 0.05, 1);
    const phone = group(boxUp(M(0xcfc6ae, { rough: 0.5 }), 0.2, 0.06, 0.22, 0.02), add(new THREE.Group(), boxUp(M(0xcfc6ae, { rough: 0.5 }), 0.22, 0.04, 0.06, 0.02), 0, 0.06, 0));
    add(root, phone, -0.52, 0.76, 0.18, 0, 0.5, 0);
    await prop(F, { prefix: 'DDSK', root, w: 1.9, top: 1.2, yaw: 0.5, elev: 14 });
  }

  // ------------------------------------------------------------ DCHR: office chair
  if (want('DCHR')) {
    const root = new THREE.Group();
    const fab = M(0x33405a, { rough: 0.9, detail: 'weave' });
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5, leg = boxUp(P.black, 0.05, 0.035, 0.3, 0.01);
      const g = new THREE.Group(); g.add(leg); leg.position.z = 0.15; g.rotation.y = a; g.position.y = 0.06; root.add(g);
      add(root, sphere(P.rubber, 0.03, 10, 8), Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3);
    }
    add(root, cyl(P.chrome, 0.022, 0.32, 12), 0, 0.24, 0);
    add(root, boxUp(P.black, 0.3, 0.04, 0.3, 0.01), 0, 0.4, 0);
    add(root, boxUp(fab, 0.5, 0.09, 0.48, 0.035), 0, 0.43, 0.02);
    const back = new THREE.Group(); add(back, boxUp(fab, 0.46, 0.52, 0.08, 0.035), 0, 0.1, 0); add(back, boxUp(P.black, 0.06, 0.2, 0.03, 0.01), 0, -0.08, -0.03);
    add(root, back, 0, 0.5, -0.24, -0.12, 0, 0);
    for (const x of [-0.25, 0.25]) { add(root, boxUp(P.black, 0.03, 0.2, 0.03, 0.008), x, 0.48, -0.02); add(root, boxUp(P.black, 0.06, 0.03, 0.26, 0.012), x, 0.68, 0.01); }
    await prop(F, { prefix: 'DCHR', root, w: 1.0, top: 1.3, yaw: 2.4, elev: 12 });
  }

  // ------------------------------------------------------------ DCAB: filing cabinet
  if (want('DCAB')) {
    const root = new THREE.Group();
    const body = M(0x9c9e94, { metal: 0.35, rough: 0.55, detail: 'metal' });
    add(root, boxUp(body, 0.47, 1.32, 0.62, 0.012), 0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const open = k === 1 ? 0.18 : 0;
      const y = 0.05 + k * 0.315;
      if (open) {
        add(root, boxUp(M(0x2a2a2a), 0.41, 0.26, 0.02), 0, y + 0.01, 0.305);
        add(root, boxUp(body, 0.42, 0.25, open + 0.02, 0.006), 0, y + 0.01, 0.31 + open / 2);
        for (let f = 0; f < 6; f++) add(root, boxUp(M(f % 2 ? 0xd9c28a : 0xc8b27a, { rough: 0.9 }), 0.36, 0.25 + (f % 3) * 0.02, 0.012), 0, y + 0.03, 0.34 + f * 0.025, -0.1 + f * 0.03, 0, 0);
      }
      add(root, boxUp(M(0xa6a89e, { metal: 0.35, rough: 0.5 }), 0.43, 0.29, 0.02, 0.006), 0, y, 0.31 + open);
      add(root, box(P.chrome, 0.16, 0.025, 0.03, 0.006), 0, y + 0.19, 0.335 + open);
      add(root, box(M(0xe8e0c8), 0.08, 0.035, 0.005), 0, y + 0.24, 0.322 + open);
    }
    await prop(F, { prefix: 'DCAB', root, w: 1.1, top: 1.6, yaw: 0.55, elev: 10 });
  }

  // ------------------------------------------------------------ DCRT: wooden crate (same painter as CRATEWAL)
  if (want('DCRT')) {
    const root = new THREE.Group();
    const face = (seed, stencil, brace) => { const sf = new Surf(128, 128); sf.fill([30, 26, 22]); crateFace(sf, 0, 0, 128, 128, { seed, stencil, brace, plank: 21, batten: 12 }); return K.texMat(K.surfTex(sf, { lit: true, bake: { amb: 0.6, shadow: 6, shadowK: 0.4 } }), { rough: 0.85 }); };
    const mats = [face(501, STENCILS[2]), face(502, [], 'z'), face(503, [['→ 51-0347 ←', 0.5, 11]]), face(504, []), face(505, STENCILS[0]), face(506, [], 'x')];
    const cr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mats);
    add(root, cr, 0, 0.45, 0);
    await prop(F, { prefix: 'DCRT', root, w: 1.5, top: 1.35, yaw: 0.62, elev: 14 });
  }

  // ------------------------------------------------------------ DMON: CRT monitor on a desk (A-B flicker)
  if (want('DMON')) {
    const root = new THREE.Group();
    const top = M(0xb8ad90, { rough: 0.6 }), frame = M(0x60666c, { metal: 0.5, rough: 0.5 });
    add(root, boxUp(top, 0.9, 0.035, 0.62, 0.01), 0, 0.7, 0);
    for (const x of [-0.42, 0.42]) for (const z of [-0.27, 0.27]) add(root, boxUp(frame, 0.04, 0.7, 0.04, 0.008), x, 0, z);
    add(root, boxUp(frame, 0.84, 0.03, 0.03), 0, 0.15, -0.27);
    const shell = M(0xcfc6ac, { rough: 0.55 });
    const mon = new THREE.Group();
    add(mon, boxUp(shell, 0.4, 0.36, 0.34, 0.03), 0, 0.03, -0.02);
    add(mon, boxUp(shell, 0.3, 0.26, 0.14, 0.03), 0, 0.08, -0.25);
    add(mon, boxUp(shell, 0.2, 0.03, 0.2, 0.01), 0, 0, -0.02);
    add(mon, boxUp(M(0x1a1c1e, { rough: 0.3 }), 0.33, 0.27, 0.01), 0, 0.075, 0.151);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.23), new THREE.MeshBasicMaterial({ map: crtTex(3, false) }));
    add(mon, scr, 0, 0.21, 0.158);
    add(mon, box(M(0x40c040, { emissive: 0x40ff40 }), 0.012, 0.012, 0.01), 0.16, 0.05, 0.16);
    add(root, mon, 0.05, 0.735, -0.05, 0, -0.15, 0);
    add(root, boxUp(M(0xcfc6ac, { rough: 0.6 }), 0.42, 0.03, 0.15, 0.01), 0.02, 0.735, 0.2, 0.08, 0.1, 0);
    add(root, boxUp(M(0x3a3a3a), 0.38, 0.012, 0.11, 0.004), 0.02, 0.765, 0.2, 0.08, 0.1, 0);
    const texA = crtTex(3, false), texB = crtTex(3, true);
    const r = rng(5);
    for (let k = 0; k < 3; k++) add(root, sheet(40 + k, 0), -0.3 + r() * 0.1, 0.738 + k * 0.002, 0.1 + r() * 0.1, -Math.PI / 2, 0, r() - 0.5);
    await prop(F, { prefix: 'DMON', root, frames: 'AB', w: 1.3, top: 1.3, yaw: 0.35, elev: 12, pose: (f) => { scr.material.map = f === 'A' ? texA : texB; } });
  }

  // ------------------------------------------------------------ DTRM: freestanding computer console (A-B)
  if (want('DTRM')) {
    const root = new THREE.Group();
    const shell = M(0xbdb49a, { rough: 0.6 }), dark = M(0x3a3d42, { rough: 0.5, metal: 0.3 });
    add(root, boxUp(dark, 0.84, 0.08, 0.62, 0.01), 0, 0, 0);
    add(root, boxUp(shell, 0.8, 0.86, 0.58, 0.02), 0, 0.08, 0);
    // sloped control desk
    const desk = new THREE.Group(); add(root, desk, 0, 0.98, 0.06, 0.5, 0, 0);
    const panelTex = (on) => canvasTex(160, 96, (g, w, h) => {
      const r = rng(on ? 7 : 8);
      g.fillStyle = '#2a2d31'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0a1a10'; g.fillRect(10, 8, 70, 46);
      g.fillStyle = on ? '#6cff96' : '#3ab060'; g.font = 'bold 7px "DejaVu Sans Mono", monospace';
      ['CH-A  ' + (on ? '88.2' : '87.9'), 'CH-B  41.0', 'FLOW  ' + (on ? 'HIGH' : 'NOM'), 'PRES  2.4'].forEach((l, k) => g.fillText(l, 14, 18 + k * 10));
      for (let y = 8; y < 54; y += 2) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(10, y, 70, 1); }
      for (let k = 0; k < 24; k++) { const x = 92 + (k % 6) * 11, y = 10 + Math.floor(k / 6) * 11; const lit = r() < 0.5; g.fillStyle = lit ? r.pick(['#ff4030', '#40ff60', '#ffc040', '#fff8d0']) : '#40423f'; g.fillRect(x, y, 8, 7); }
      for (let k = 0; k < 8; k++) { g.fillStyle = '#9a9a96'; g.beginPath(); g.arc(16 + k * 18, 74, 5, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(15 + k * 18, 66 + (r() < 0.5 ? 0 : 5), 2, 6); }
    });
    const pA = panelTex(false), pB = panelTex(true);
    add(desk, boxUp(shell, 0.8, 0.05, 0.42, 0.015), 0, 0, 0);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), new THREE.MeshStandardMaterial({ map: pA, emissiveMap: pA, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5 }));
    add(desk, pm, 0, 0.052, 0, -Math.PI / 2, 0, 0);
    add(root, boxUp(shell, 0.8, 0.5, 0.2, 0.02), 0, 0.92, -0.2);          // rear hood
    add(root, boxUp(dark, 0.7, 0.34, 0.01), 0, 1.0, -0.095);
    for (let k = 0; k < 4; k++) add(root, boxUp(dark, 0.56, 0.018, 0.01), 0, 0.2 + k * 0.05, 0.292);   // vent slots
    add(root, box(M(0xd0301c, { emissive: 0xff2010, ei: 0.8 }), 0.05, 0.03, 0.03), 0.32, 1.38, -0.2);
    await prop(F, { prefix: 'DTRM', root, frames: 'AB', w: 1.3, top: 1.7, yaw: 0.45, elev: 12, pose: (f) => { pm.material.map = pm.material.emissiveMap = f === 'A' ? pA : pB; } });
  }

  // ------------------------------------------------------------ DHCK: hackable alien-tech terminal (A idle, B-C active, D done)
  if (want('DHCK')) {
    const root = new THREE.Group();
    // lab console body with teal veins crawling over it
    const bodyTex = (() => { const sf = new Surf(128, 128); sf.fill([92, 98, 104], 0.4); for (let y = 0; y < 128; y += 32) sf.rect(-2, y + 1, 130, y + 31, { h: 2, bevel: 1.5, op: 'set' }); veins(sf, { count: 4, seed: 613, r0: 5 }); return K.surfTex(sf, { lit: true, bake: { amb: 0.6 } }); })();
    const body = K.texMat(bodyTex, { rough: 0.5, metal: 0.3 });
    const shellTex = (() => { const sf = new Surf(128, 128); sf.fill(A.violet); hullPlates(sf, { fx: 2, fy: 2, seed: 611, glow: 0.35 }); return K.surfTex(sf, { lit: true, bake: { amb: 0.65 }, repeat: [2, 1] }); })();
    const shell = K.texMat(shellTex, { rough: 0.3, metal: 0.25 });
    const bone = M(0xc8bc9e, { rough: 0.5, detail: 'alien' });
    add(root, boxUp(M(0x2c2e32, { metal: 0.4, rough: 0.5 }), 0.7, 0.08, 0.56, 0.01), 0, 0, 0);
    add(root, boxUp(body, 0.64, 0.86, 0.5, 0.02), 0, 0.08, 0);
    add(root, boxUp(M(0x1c1e22), 0.5, 0.04, 0.16, 0.01), 0, 0.72, 0.3, 0.25, 0, 0);            // keyboard shelf
    for (let k = 0; k < 3; k++) add(root, boxUp(M(0x3a3c40), 0.44, 0.012, 0.03, 0.003), 0, 0.745, 0.26 + k * 0.035, 0.25, 0, 0);
    // the alien growth that swallowed its top: fused lumps
    for (const [x, y, z, sx, sy, sz] of [[0, 1.02, -0.16, 0.44, 0.28, 0.26], [-0.26, 0.92, 0.0, 0.16, 0.2, 0.2], [0.27, 0.95, -0.02, 0.16, 0.22, 0.2], [0, 1.24, -0.2, 0.26, 0.2, 0.2]]) {
      const b2 = sphere(shell, 1, 24, 16); b2.renderOrder = 0; b2.scale.set(sx, sy, sz); add(root, b2, x, y, z);
    }
    // bone claws gripping the sides
    for (const x of [-1, 1]) for (const z of [-0.12, 0.14]) add(root, taper(bone, [[x * 0.18, 1.02, z], [x * 0.34, 0.9, z], [x * 0.35, 0.6, z + 0.02], [x * 0.33, 0.35, z]], (t) => 0.035 * (1 - t * 0.7), 24, 8));
    add(root, taper(bone, [[0, 1.2, -0.3], [0.02, 1.5, -0.28], [-0.04, 1.72, -0.12]], (t) => 0.05 * (1 - t * 0.75), 24, 8));
    // glyph screen, angled toward the viewer
    const glyphTex = (col, phase, done) => canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = '#04060a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 8;
      g.beginPath(); g.arc(64, 48, 32, phase, phase + (done ? 6.29 : 4.3)); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(64, 48, 20, -phase, -phase + (done ? 6.29 : 3.2)); g.stroke();
      const r = rng(9 + Math.round(phase * 10));
      for (let k = 0; k < 12; k++) { const a = k * 0.5236 + phase, x = 64 + Math.cos(a) * 42, y = 48 + Math.sin(a) * 40; g.fillRect(x - 2, y - 2, 3 + r() * 4, 3 + r() * 6); }
      if (done) { g.lineWidth = 5; g.beginPath(); g.moveTo(50, 48); g.lineTo(60, 58); g.lineTo(80, 36); g.stroke(); }
      else { g.beginPath(); g.arc(64, 48, 6, 0, 7); g.fill(); }
    });
    const tex = { A: glyphTex('#1f9a84', 0.3), B: glyphTex('#6affe8', 1.2), C: glyphTex('#b0ffff', 2.6), D: glyphTex('#6aff7a', 0.3, true) };
    const bezel = boxUp(M(0x2a1e36, { rough: 0.35, metal: 0.3 }), 0.52, 0.38, 0.05, 0.02); add(root, bezel, 0, 0.9, 0.16, -0.45, 0, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.33), new THREE.MeshBasicMaterial({ map: tex.A }));
    add(root, scr, 0, 1.075, 0.235, -0.45, 0, 0);
    // holographic rings and shards floating above
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1f9a84 });
    const ring1 = torus(ringMat, 0.26, 0.016, 6, 48), ring2 = torus(ringMat, 0.17, 0.012, 6, 40);
    add(root, ring1, 0, 1.6, 0.02, Math.PI / 2 - 0.95, 0, 0); add(root, ring2, 0, 1.6, 0.02, Math.PI / 2 - 0.75, 0, 0.3);
    const core = sphere(ringMat, 0.05, 12, 8); add(root, core, 0, 1.6, 0.02);
    const shards = [];
    for (let k = 0; k < 6; k++) { const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), ringMat); sh.scale.set(0.6, 1.4, 0.6); shards.push(sh); root.add(sh); }
    const nodes = [];
    for (const [x, y, z] of [[-0.3, 1.05, 0.12], [0.3, 1.08, 0.1], [0, 1.3, 0.05], [-0.16, 1.2, 0.12]]) { const n = sphere(ringMat, 0.028, 10, 8); add(root, n, x, y, z); nodes.push(n); }
    const pose = (f) => {
      ringMat.color.setHex({ A: 0x1f9a84, B: 0x5affe0, C: 0xa8ffff, D: 0x5aff70 }[f]);
      scr.material.map = tex[f];
      const ph = { A: 0, B: 0.5, C: 1.1, D: 0 }[f], sc = { A: 0.85, B: 1.05, C: 1.2, D: 1 }[f];
      ring1.scale.setScalar(sc); ring2.scale.setScalar(sc * (f === 'C' ? 1.2 : 1));
      ring1.rotation.z = ph; ring2.rotation.z = 0.3 - ph * 1.5;
      core.scale.setScalar(f === 'A' ? 0.7 : f === 'C' ? 1.4 : 1.1);
      shards.forEach((sh, k) => { const a = k * 1.047 + ph; const rr = 0.36 * sc; sh.position.set(Math.cos(a) * rr, 1.6 + Math.sin(a) * rr * 0.55, 0.02 + Math.sin(a) * rr * 0.4); sh.rotation.set(0, a, 0.3); sh.visible = f !== 'A' || k % 2 === 0; });
    };
    await prop(F, { prefix: 'DHCK', root, frames: 'ABCD', w: 1.4, top: 2.0, yaw: 0.35, elev: 12, pose });
  }

  // ------------------------------------------------------------ a small Grey (for the tank)
  const greySkin = M(0x8a96a0, { rough: 0.55, detail: 'skin' });
  const makeGrey = () => {
    const g = new THREE.Group();
    const head = sphere(greySkin, 0.14, 24, 18); head.scale.set(1, 1.15, 1.05); add(g, head, 0, 0.88, 0);
    const chin = sphere(greySkin, 0.07, 16, 12); chin.scale.set(1, 1.1, 0.9); add(g, chin, 0, 0.76, 0.05);
    for (const s2 of [-1, 1]) { const eye = sphere(M(0x050506, { rough: 0.15, metal: 0.3 }), 0.05, 16, 12); eye.scale.set(1.35, 0.7, 0.5); add(g, eye, s2 * 0.06, 0.86, 0.12, 0, 0, s2 * -0.45); }
    add(g, cyl(greySkin, 0.025, 0.1, 10), 0, 0.68, 0);
    const torso = sphere(greySkin, 0.1, 16, 12); torso.scale.set(0.9, 1.3, 0.8); add(g, torso, 0, 0.52, 0);
    const belly = sphere(greySkin, 0.09, 16, 12); add(g, belly, 0, 0.44, 0.03);
    for (const s2 of [-1, 1]) {
      add(g, taper(greySkin, [[s2 * 0.08, 0.62, 0], [s2 * 0.16, 0.48, 0.04], [s2 * 0.17, 0.32, 0.1]], (t) => 0.022 - t * 0.008, 16, 6));
      for (let f = -1; f <= 1; f++) add(g, taper(greySkin, [[s2 * 0.17, 0.32, 0.1], [s2 * (0.17 + f * 0.015), 0.24, 0.12 + f * 0.01]], (t) => 0.008 - t * 0.004, 6, 5));
      add(g, taper(greySkin, [[s2 * 0.05, 0.38, 0], [s2 * 0.07, 0.2, 0.06], [s2 * 0.06, 0.02, 0.02]], (t) => 0.03 - t * 0.012, 16, 6));
    }
    return g;
  };

  // ------------------------------------------------------------ DTNK: specimen tank (A-B bubbles)
  const tankBase = (root, broken = false) => {
    const steel = M(0x707880, { metal: 0.6, rough: 0.4, detail: 'metal' }), dark = M(0x34383e, { metal: 0.4, rough: 0.5 });
    add(root, cyl(dark, 0.62, 0.12, 32), 0, 0.06, 0);
    add(root, cyl(steel, 0.56, 0.3, 32), 0, 0.27, 0);
    add(root, torus(steel, 0.56, 0.03, 8, 40), 0, 0.42, 0, Math.PI / 2, 0, 0);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(root, sphere(P.chrome, 0.018, 8, 6), Math.sin(a) * 0.57, 0.36, Math.cos(a) * 0.57); }
    // hazard band + label
    const band = canvasTex(256, 16, (g, w, h) => { for (let x = -16; x < w; x += 16) { g.fillStyle = '#d8a826'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, h); g.fill(); } });
    band.wrapS = THREE.RepeatWrapping; band.repeat.set(3, 1);
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.563, 0.563, 0.06, 32, 1, true), new THREE.MeshStandardMaterial({ map: band, color: 0x333333, roughness: 0.6 })), 0, 0.18, 0);
    const lab = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#e8e2cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = 'bold 18px "DejaVu Sans", sans-serif'; g.fillText('EBE-' + (broken ? '2' : '3'), 8, 22); g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillText('SPECIMEN  S-4 / C', 8, 38); });
    add(root, decal(lab, 0.24, 0.09), 0, 0.3, 0.566);
    return { steel, dark };
  };
  if (want('DTNK')) {
    const root = new THREE.Group();
    const { steel, dark } = tankBase(root);
    const H0 = 0.42, GH = 1.55, R = 0.5;
    // fluid: dark backdrop (back faces), then a translucent front
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, GH, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x0c3a1c, side: THREE.BackSide })), 0, H0 + GH / 2, 0);
    const grey = makeGrey(); grey.scale.setScalar(0.95); add(root, grey, 0, H0 + 0.35, -0.02, 0.12, 0.2, 0.05);
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(R - 0.01, R - 0.01, GH, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x3aff7a, transparent: true, opacity: 0.32, depthWrite: false })), 0, H0 + GH / 2, 0);
    // glass + highlights
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(R, R, GH, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfeeea, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false })), 0, H0 + GH / 2, 0);
    for (const [x, wd] of [[-0.3, 0.05], [-0.2, 0.015], [0.32, 0.02]]) add(root, new THREE.Mesh(new THREE.PlaneGeometry(wd, GH * 0.9), new THREE.MeshBasicMaterial({ color: 0xe8fff4, transparent: true, opacity: 0.35, depthWrite: false })), x, H0 + GH / 2, Math.sqrt(R * R - x * x) + 0.005);
    // struts and cap with pipes
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; add(root, boxUp(steel, 0.05, GH, 0.05, 0.01), Math.sin(a) * (R + 0.03), H0, Math.cos(a) * (R + 0.03)); }
    add(root, cyl(steel, 0.56, 0.22, 32, 0.5), 0, H0 + GH + 0.11, 0);
    add(root, cyl(dark, 0.4, 0.08, 32), 0, H0 + GH + 0.26, 0);
    for (const x of [-0.18, 0.05, 0.22]) add(root, cyl(M(0x8a6a40, { metal: 0.6, rough: 0.4 }), 0.035, 0.4, 10), x, H0 + GH + 0.45, (x * 3) % 0.2);
    add(root, sphere(M(0xff3020, { emissive: 0xff2010 }), 0.025, 8, 6), 0.3, H0 + GH + 0.18, 0.42);
    // bubbles
    const bubMat = new THREE.MeshBasicMaterial({ color: 0xc8ffd8 });
    const bubbles = []; const r = rng(77);
    for (let k = 0; k < 18; k++) { const b = sphere(bubMat, 0.012 + r() * 0.018, 8, 6); bubbles.push([b, (r() - 0.5) * 0.6, r(), (r() - 0.5) * 0.3 + 0.25]); root.add(b); }
    const pose = (f) => { const o = f === 'A' ? 0 : 0.5; bubbles.forEach(([b, x, y, z]) => { const yy = ((y + o) % 1) * (GH - 0.1) + H0 + 0.05; b.position.set(x * (1 - 0.3 * Math.abs(z)), yy, z); }); };
    await prop(F, { prefix: 'DTNK', root, frames: 'AB', w: 1.5, top: 2.7, yaw: 0.2, elev: 8, pose });
  }

  // ------------------------------------------------------------ DTNB: smashed tank
  if (want('DTNB')) {
    const root = new THREE.Group();
    const { steel, dark } = tankBase(root, true);
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8e0, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const r = rng(81), R = 0.5;
    const pts = [];
    for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([a, 0.05 + (r() < 0.25 ? 0.3 + r() * 0.6 : r() * 0.25)]); }
    const pos = [];
    for (let k = 0; k < 24; k++) {
      const [a0, h0] = pts[k], [a1, h1] = pts[k + 1];
      const x0 = Math.sin(a0) * R, z0 = Math.cos(a0) * R, x1 = Math.sin(a1) * R, z1 = Math.cos(a1) * R, am = (a0 + a1) / 2, hm = Math.max(h0, h1) * (0.6 + r() * 0.6);
      const xm = Math.sin(am) * R, zm = Math.cos(am) * R, y = 0.42;
      pos.push(x0, y, z0, x1, y, z1, x1, y + h1, z1, x0, y, z0, x1, y + h1, z1, xm, y + hm, zm, x0, y, z0, xm, y + hm, zm, x0, y + h0, z0);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals();
    root.add(new THREE.Mesh(gg, glass));
    // puddle and floor shards
    const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 24), M(0x2a8a3a, { rough: 0.1, metal: 0.2, emissive: 0x0a3010 }));
    const pp = pud.geometry.attributes.position; for (let i = 1; i < pp.count; i++) { const k = 0.75 + r() * 0.4; pp.setXY(i, pp.getX(i) * k, pp.getY(i) * k); }
    add(root, pud, 0.15, 0.005, 0.25, -Math.PI / 2, 0, 0);
    for (let k = 0; k < 14; k++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + r() * 0.05), glass); add(root, sh, (r() - 0.5) * 1.6, 0.02, 0.2 + r() * 0.6, r() * 3, r() * 3, r() * 3).scale.y = 0.3; }
    add(root, cyl(dark, 0.4, 0.05, 32), 0, 0.44, 0);
    add(root, tube(M(0x2a2a2a, { rough: 0.6 }), [[0.2, 2.2, -0.1], [0.25, 1.6, 0.05], [0.1, 1.0, 0.2], [0.35, 0.7, 0.3]], 0.03, 24, 6));
    await prop(F, { prefix: 'DTNB', root, w: 2.0, top: 2.3, yaw: 0.2, elev: 20 });
  }

  // ------------------------------------------------------------ DAUT: autopsy table with an alien under a sheet
  if (want('DAUT')) {
    const root = new THREE.Group();
    const steel = M(0xb0b6ba, { metal: 0.7, rough: 0.3, detail: 'metal' });
    add(root, boxUp(steel, 2.0, 0.05, 0.8, 0.02), 0, 0.84, 0);
    for (const z of [-0.39, 0.39]) add(root, boxUp(steel, 2.0, 0.05, 0.03, 0.01), 0, 0.87, z);
    add(root, cyl(steel, 0.12, 0.72, 16), 0, 0.46, 0);
    add(root, cyl(steel, 0.35, 0.06, 24), 0, 0.03, 0);
    add(root, cyl(M(0x333333), 0.05, 0.1, 10), -0.9, 0.8, 0);
    // sheet over the body: a height field
    const body = (x, z) => {
      let h = 0;
      const e = (cx, cz, rx, rz, hh) => { const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; if (d < 1) h = Math.max(h, hh * Math.sqrt(1 - d)); };
      e(-0.66, 0, 0.2, 0.22, 0.3);    // big head
      e(-0.28, 0, 0.26, 0.17, 0.14);  // chest
      e(0.0, 0, 0.17, 0.17, 0.2);     // pot belly
      e(0.45, -0.08, 0.35, 0.06, 0.07); e(0.45, 0.08, 0.35, 0.06, 0.07); // legs
      e(0.82, -0.09, 0.05, 0.05, 0.12); e(0.82, 0.09, 0.05, 0.05, 0.12); // feet
      return h;
    };
    const SG = new THREE.PlaneGeometry(2.1, 1.3, 84, 52); SG.rotateX(-Math.PI / 2);
    const sp = SG.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), z = sp.getZ(i);
      let y = 0.9 + body(x, z) + 0.01;
      const over = Math.max(0, Math.abs(z) - 0.4);
      if (over > 0) y = Math.min(y, 0.9 - over * 1.6 + 0.02);
      const overX = Math.max(0, Math.abs(x) - 1.0);
      if (overX > 0) y -= overX * 1.4;
      y += Math.sin(x * 9 + z * 5) * 0.006;
      sp.setY(i, y);
    }
    SG.computeVertexNormals();
    const sheetTex = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#e6e8e4'; g.fillRect(0, 0, w, h);
      const blot = (x, y, r2, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r2); gr.addColorStop(0, `rgba(70,170,60,${a})`); gr.addColorStop(1, 'rgba(70,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r2, 0, 7); g.fill(); };
      blot(100, 80, 26, 0.75); blot(118, 90, 12, 0.8); blot(60, 70, 10, 0.6); blot(140, 110, 8, 0.6);
    });
    root.add(new THREE.Mesh(SG, new THREE.MeshStandardMaterial({ map: sheetTex, color: 0xb4c4bc, roughness: 0.9, side: THREE.DoubleSide })));
    // a three-fingered hand slipping out
    const hand = new THREE.Group();
    add(hand, taper(greySkin, [[0, 0, 0], [0, -0.12, 0.02], [0, -0.22, 0.03]], (t) => 0.018 - t * 0.006, 10, 6));
    for (let f = -1; f <= 1; f++) add(hand, taper(greySkin, [[0, -0.22, 0.03], [f * 0.02, -0.3, 0.05], [f * 0.03, -0.36, 0.06]], (t) => 0.007 - t * 0.003, 8, 5));
    add(root, hand, -0.18, 0.9, 0.44, 0.1, 0, 0);
    // instrument tray on a stand
    add(root, cyl(steel, 0.015, 0.95, 8), 1.2, 0.47, 0.35);
    add(root, boxUp(steel, 0.45, 0.02, 0.3, 0.005), 1.2, 0.95, 0.35);
    for (let k = 0; k < 4; k++) add(root, boxUp(P.chrome, 0.2, 0.008, 0.012, 0.002), 1.15 + (k % 2) * 0.05, 0.97, 0.26 + k * 0.05, 0, 0.2 * k, 0);
    await prop(F, { prefix: 'DAUT', root, w: 3.0, top: 1.6, yaw: 0.55, elev: 14, lights: { key: 1.9, hemi: 1.3 } });
  }

  // ------------------------------------------------------------ DSRV: server rack (A-B blink)
  if (want('DSRV')) {
    const root = new THREE.Group();
    const cab = M(0x222428, { rough: 0.5, metal: 0.4 });
    add(root, boxUp(cab, 0.62, 2.0, 0.8, 0.015), 0, 0, 0);
    const faceTex = (ph) => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 320;
      const e = document.createElement('canvas'); e.width = 96; e.height = 320;
      const g = c.getContext('2d'), ge = e.getContext('2d'), r = rng(31);
      g.fillStyle = '#18191b'; g.fillRect(0, 0, 96, 320); ge.fillStyle = '#000'; ge.fillRect(0, 0, 96, 320);
      let y = 8;
      while (y < 300) {
        const u = r() < 0.3 ? 2 : 1, hh = u * 12;
        g.fillStyle = r() < 0.5 ? '#3a3d42' : '#4a4d52'; g.fillRect(6, y, 84, hh - 1);
        g.fillStyle = '#2a2c30'; for (let x = 30; x < 84; x += 4) g.fillRect(x, y + 2, 2, hh - 5);
        for (let k = 0; k < 4; k++) {
          const on = r() < 0.5 ? (ph ? r() < 0.6 : r() < 0.4) : ph === 0;
          const col = r.pick(['#40ff60', '#40ff60', '#ffb030', '#40a0ff']);
          if (on) { ge.fillStyle = col; ge.fillRect(9 + k * 5, y + 3, 3, 3); }
          g.fillStyle = on ? col : '#303030'; g.fillRect(9 + k * 5, y + 3, 3, 3);
        }
        y += hh;
      }
      const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e); t.colorSpace = te.colorSpace = THREE.SRGBColorSpace;
      return [t, te];
    };
    const [tA, eA] = faceTex(0), [tB, eB] = faceTex(1);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.86), new THREE.MeshStandardMaterial({ map: tA, emissiveMap: eA, emissive: 0xffffff, roughness: 0.5, metalness: 0.3 }));
    add(root, face, 0, 1.0, 0.402);
    // door frame + handle + vents on top
    for (const x of [-0.29, 0.29]) add(root, boxUp(M(0x3a3c40, { metal: 0.5, rough: 0.4 }), 0.04, 1.96, 0.02, 0.005), x, 0.02, 0.41);
    add(root, boxUp(P.chrome, 0.02, 0.18, 0.03, 0.005), 0.25, 0.95, 0.43);
    const lab = canvasTex(64, 24, (g) => { g.fillStyle = '#ddd6c0'; g.fillRect(0, 0, 64, 24); g.fillStyle = '#222'; g.font = 'bold 10px "DejaVu Sans Mono", monospace'; g.fillText('RACK 04', 6, 16); });
    add(root, decal(lab, 0.16, 0.06), 0, 1.93, 0.405);
    await prop(F, { prefix: 'DSRV', root, frames: 'AB', w: 1.3, top: 2.3, yaw: 0.45, elev: 8, pose: (f) => { face.material.map = f === 'A' ? tA : tB; face.material.emissiveMap = f === 'A' ? eA : eB; } });
  }

  // ------------------------------------------------------------ DLMP: lab floor lamp (examination light)
  if (want('DLMP')) {
    const root = new THREE.Group();
    const white = M(0xd8d8d2, { rough: 0.45 }), steel = M(0x9aa0a4, { metal: 0.7, rough: 0.3 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; const leg = boxUp(white, 0.04, 0.03, 0.3, 0.01); leg.position.z = 0.15; const g2 = new THREE.Group(); g2.add(leg); g2.rotation.y = a; g2.position.y = 0.05; root.add(g2); add(root, sphere(P.rubber, 0.025, 8, 6), Math.sin(a) * 0.3, 0.025, Math.cos(a) * 0.3); }
    add(root, cyl(steel, 0.02, 1.5, 10), 0, 0.8, 0);
    add(root, cyl(white, 0.035, 0.08, 10), 0, 1.5, 0);
    add(root, tube(steel, [[0, 1.54, 0], [0.12, 1.66, 0.08], [0.28, 1.66, 0.18], [0.36, 1.58, 0.24]], 0.014, 16, 6));
    const head = new THREE.Group(); add(root, head, 0.38, 1.54, 0.26, 0.9, 0.3, 0);
    add(head, lathe(white, [[0, 0.1], [0.08, 0.1], [0.18, 0.02], [0.19, 0], [0.17, 0]], 28));
    add(head, new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), new THREE.MeshBasicMaterial({ color: 0xfff6dc, side: THREE.DoubleSide })), 0, 0.002, 0, Math.PI / 2, 0, 0);
    add(head, torus(steel, 0.18, 0.012, 6, 28), 0, 0.005, 0, Math.PI / 2, 0, 0);
    await prop(F, { prefix: 'DLMP', root, w: 1.2, top: 2.0, yaw: 0.3, elev: 8 });
  }

  // ------------------------------------------------------------ DCYL: gas cylinders on a stand
  if (want('DCYL')) {
    const root = new THREE.Group();
    const frame = M(0x4a5058, { metal: 0.5, rough: 0.5 });
    add(root, boxUp(frame, 0.8, 0.04, 0.34, 0.01), 0, 0, 0);
    add(root, boxUp(frame, 0.8, 0.05, 0.02, 0.01), 0, 0.9, -0.16);
    for (const x of [-0.39, 0.39]) add(root, boxUp(frame, 0.03, 1.0, 0.03, 0.008), x, 0, -0.16);
    const cols = [[0x2e6a3a, 'OXYGEN'], [0x6a6e72, 'NITROGEN'], [0x2a4a86, 'ARGON']];
    cols.forEach(([c, name], k) => {
      const x = -0.25 + k * 0.25, mat = M(c, { rough: 0.35, metal: 0.3 });
      const body = lathe(mat, [[0, 0.04], [0.105, 0.04], [0.11, 0.08], [0.11, 1.2], [0.09, 1.3], [0.05, 1.34], [0.03, 1.36], [0, 1.36]], 24);
      add(root, body, x, 0, 0);
      add(root, cyl(P.chrome, 0.02, 0.08, 10), x, 1.4, 0); add(root, cyl(M(0x6a5a30, { metal: 0.7, rough: 0.3 }), 0.035, 0.03, 12), x, 1.42, 0);
      add(root, box(P.chrome, 0.08, 0.02, 0.02), x + 0.03, 1.42, 0);
      const lab = canvasTex(128, 32, (g) => { g.fillStyle = '#ece6d4'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#222'; g.font = 'bold 15px "DejaVu Sans", sans-serif'; g.fillText(name, 6, 22); });
      add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.1125, 0.1125, 0.12, 24, 1, true, -0.8, 1.6), K.texMat(lab, { rough: 0.7 })), x, 0.9, 0);
      add(root, torus(M(0x606468, { metal: 0.8, rough: 0.3 }), 0.12, 0.006, 4, 24), x, 0.75, 0, Math.PI / 2, 0, 0);
    });
    await prop(F, { prefix: 'DCYL', root, w: 1.2, top: 1.7, yaw: 0.25, elev: 10 });
  }

  // ------------------------------------------------------------ DGEN: generator
  if (want('DGEN')) {
    const root = new THREE.Group();
    const yel = M(0xc89a2c, { rough: 0.55, metal: 0.2, detail: 'metal' }), dark = M(0x2a2c2e, { rough: 0.6, metal: 0.3 });
    add(root, boxUp(dark, 1.5, 0.1, 0.84, 0.01), 0, 0, 0);
    for (const z of [-0.36, 0.36]) add(root, boxUp(dark, 1.5, 0.08, 0.08, 0.01), 0, 0, z);
    add(root, boxUp(yel, 1.4, 0.82, 0.78, 0.04), 0, 0.1, 0);
    add(root, boxUp(yel, 1.36, 0.06, 0.74, 0.03), 0, 0.92, 0);
    // louvres on the side
    for (let k = 0; k < 7; k++) add(root, box(dark, 0.44, 0.025, 0.02, 0.004), -0.36, 0.3 + k * 0.07, 0.395, -0.4, 0, 0);
    for (let k = 0; k < 7; k++) add(root, box(dark, 0.02, 0.025, 0.44, 0.004), -0.705, 0.3 + k * 0.07, 0, 0, 0, 0.4);
    // control panel
    const pan = canvasTex(128, 96, (g) => {
      g.fillStyle = '#2c2e30'; g.fillRect(0, 0, 128, 96);
      for (const [x, y] of [[26, 30], [66, 30], [104, 30]]) { g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y - 6); g.stroke(); }
      g.fillStyle = '#c02010'; g.fillRect(12, 60, 22, 22); g.fillStyle = '#20c040'; g.fillRect(44, 64, 12, 12);
      g.fillStyle = '#ddd'; g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillText('STOP', 12, 92); g.fillText('RUN', 42, 92);
    });
    add(root, decal(pan, 0.4, 0.3), 0.4, 0.6, 0.392);
    add(root, cyl(dark, 0.045, 0.5, 12), 0.5, 1.2, -0.2);
    add(root, cyl(dark, 0.06, 0.08, 12), 0.5, 1.46, -0.2);
    add(root, cyl(M(0x1a1a1a), 0.08, 0.04, 16), -0.4, 0.97, 0.15);
    const warn = canvasTex(128, 40, (g) => { g.fillStyle = '#e0b020'; g.fillRect(0, 0, 128, 40); g.fillStyle = '#111'; g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillText('DANGER', 34, 16); g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillText('HIGH VOLTAGE', 30, 32); });
    add(root, decal(warn, 0.3, 0.1), -0.25, 0.75, 0.392);
    add(root, tube(M(0x151515, { rough: 0.8 }), [[0.7, 0.3, 0.2], [0.85, 0.15, 0.35], [0.95, 0.03, 0.6], [1.2, 0.02, 0.7]], 0.025, 20, 6));
    await prop(F, { prefix: 'DGEN', root, w: 2.1, top: 1.7, yaw: 0.5, elev: 12 });
  }

  // ------------------------------------------------------------ DBAR: explosive fuel drum (A-B idle, C-G burst)
  if (want('DBAR')) {
    const root = new THREE.Group();
    const red = M(0xb0261a, { rough: 0.45, metal: 0.35 }), redDk = M(0x6a160e, { rough: 0.6, metal: 0.3 });
    const drum = new THREE.Group(); root.add(drum);
    add(drum, cyl(red, 0.29, 0.88, 28), 0, 0.44, 0);
    for (const y of [0.02, 0.3, 0.58, 0.86]) add(drum, torus(redDk, 0.292, 0.014, 6, 32), 0, y, 0, Math.PI / 2, 0, 0);
    add(drum, cyl(redDk, 0.27, 0.01, 28), 0, 0.885, 0);
    add(drum, cyl(M(0x333333, { metal: 0.6 }), 0.035, 0.02, 10), 0.14, 0.895, 0.05);
    const lab = canvasTex(160, 96, (g) => {
      g.fillStyle = '#e8b422'; g.fillRect(0, 0, 160, 96);
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(80, 8); g.lineTo(112, 60); g.lineTo(48, 60); g.closePath(); g.lineWidth = 5; g.strokeStyle = '#111'; g.stroke();
      g.beginPath(); g.moveTo(80, 24); g.quadraticCurveTo(92, 40, 82, 54); g.quadraticCurveTo(70, 44, 80, 24); g.fill();
      g.font = 'bold 20px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('FLAMMABLE', 80, 86);
    });
    add(drum, new THREE.Mesh(new THREE.CylinderGeometry(0.2915, 0.2915, 0.24, 28, 1, true, -0.55, 1.1), K.texMat(lab, { rough: 0.6 })), 0, 0.44, 0);
    // leaking fuel dribble (moves between A and B)
    const drip = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0x9a8a2a, roughness: 0.1, metalness: 0.4 }));
    add(drum, drip, 0.12, 0.3, 0.27, 0, 0.42, 0);
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshStandardMaterial({ color: 0x6a5a1a, roughness: 0.05, metalness: 0.5 }));
    add(drum, pud, 0.15, 0.004, 0.36, -Math.PI / 2, 0, 0);
    // wreck: torn, charred drum shell
    const wreck = new THREE.Group(); root.add(wreck);
    const charred = M(0x241c18, { rough: 0.9, metal: 0.2 }), charRed = M(0x5a1c12, { rough: 0.8, metal: 0.2 });
    { const g = new THREE.CylinderGeometry(0.31, 0.29, 0.5, 28, 6, true), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.1) { const a = Math.atan2(p.getX(i), p.getZ(i)); const s2 = 1 + (y + 0.25) * (0.6 + Math.sin(a * 5) * 0.4); p.setX(i, p.getX(i) * s2); p.setZ(i, p.getZ(i) * s2); p.setY(i, y - Math.abs(Math.sin(a * 3)) * 0.2); } }
      g.computeVertexNormals(); add(wreck, new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a1a12, roughness: 0.9, side: THREE.DoubleSide })), 0, 0.25, 0); }
    add(wreck, cyl(charred, 0.3, 0.03, 24), 0, 0.015, 0);
    for (let k = 0; k < 4; k++) add(wreck, boxUp(charRed, 0.12, 0.01, 0.08, 0.003), Math.cos(k * 1.7) * 0.6, 0.005, Math.sin(k * 1.7) * 0.5 + 0.2, 0, k, 0.3);
    const debris = [];
    for (let k = 0; k < 10; k++) { const d = boxUp(charRed, 0.08, 0.02, 0.06, 0.004); debris.push(d); root.add(d); }
    const pose = (f) => {
      drum.visible = f === 'A' || f === 'B' || f === 'C';
      wreck.visible = f === 'F' || f === 'G';
      drum.scale.set(f === 'C' ? 1.12 : 1, f === 'C' ? 1.05 : 1, f === 'C' ? 1.12 : 1);
      drip.position.y = f === 'B' ? 0.22 : 0.3; drip.scale.y = f === 'B' ? 1.3 : 1;
      pud.scale.setScalar(f === 'B' ? 1.1 : 1);
      const rr = rng(21); const spread = { D: 0.9, E: 1.5, F: 2.0 }[f] || 0;
      debris.forEach((d) => { d.visible = spread > 0; d.position.set((rr() - 0.5) * 2 * spread, 0.5 + rr() * spread * 1.2, (rr() - 0.5) * spread); d.rotation.set(rr() * 6, rr() * 6, rr() * 6); });
    };
    const B = (img, px, x, y, R, o) => { const [cx, cy] = px(x, y); ball(img, { cx, cy, rx: R * 64, ry: R * 64 / 1.2, ...o }); };
    const Fl = (img, px, x, y, w2, h2, o) => { const [cx, cy] = px(x, y); flame(img, { x: cx, y: cy, w: w2 * 64, h: h2 * 64 / 1.2, ...o }); };
    const post = (f, img, ox, oy, px) => {
      if (f === 'C') { Fl(img, px, 0, 0.88, 0.3, 0.8, { seed: 3, t: 0.2 }); Fl(img, px, -0.3, 0.55, 0.12, 0.35, { seed: 4 }); Fl(img, px, 0.3, 0.3, 0.1, 0.3, { seed: 5 }); B(img, px, 0, 1.2, 0.32, { seed: 6, heat: 1 }); }
      if (f === 'D') { B(img, px, 0, 0.75, 0.82, { seed: 7, heat: 0.88, turb: 0.8 }); B(img, px, 0.45, 1.15, 0.38, { seed: 8, heat: 0.9 }); B(img, px, -0.5, 0.95, 0.32, { seed: 9, heat: 0.9 }); }
      if (f === 'E') { B(img, px, 0, 1.1, 1.2, { seed: 10, heat: 0.95, smoke: 0.55, turb: 0.85 }); B(img, px, 0.75, 0.7, 0.4, { seed: 11, heat: 0.8 }); B(img, px, -0.7, 1.5, 0.35, { seed: 12, heat: 0.7, smoke: 0.5 }); }
      if (f === 'F') { B(img, px, 0.05, 1.55, 1.1, { seed: 13, heat: 0.22, smoke: 1, turb: 0.9 }); B(img, px, 0.1, 0.8, 0.5, { seed: 14, heat: 0.75, turb: 0.9 }); B(img, px, 0.6, 1.9, 0.5, { seed: 15, heat: 0.12, smoke: 1 }); }
      if (f === 'G') { Fl(img, px, 0.02, 0.05, 0.2, 0.55, { seed: 16, t: 0.5 }); B(img, px, 0.1, 1.0, 0.28, { seed: 17, heat: 0.12, smoke: 1 }); B(img, px, 0.0, 0.72, 0.18, { seed: 18, heat: 0.1, smoke: 1 }); }
    };
    await renderFrames(F, { prefix: 'DBAR', root, frames: [...'ABCDEFG'], w: 3.4, top: 3.2, yaw: 0.3, elev: 8, pose, post });
  }

  // ------------------------------------------------------------ floor decals: DPAP papers, DBLD blood pool, DGLS broken glass
  if (want('DPAP')) {
    const root = new THREE.Group(), r = rng(91);
    for (let k = 0; k < 9; k++) add(root, sheet(60 + k, k === 3 ? 1 : 0), (r() - 0.5) * 1.1, 0.004 + k * 0.002, (r() - 0.5) * 0.7, -Math.PI / 2, 0, r() * 6.28);
    const folder = boxUp(M(0xd6be86, { rough: 0.8 }), 0.25, 0.012, 0.33, 0.003); add(root, folder, 0.15, 0.002, 0.05, 0, 0.7, 0);
    const photo = canvasTex(48, 36, (g) => { g.fillStyle = '#eee'; g.fillRect(0, 0, 48, 36); g.fillStyle = '#1a2230'; g.fillRect(3, 3, 42, 26); g.fillStyle = '#9aa4b0'; g.beginPath(); g.ellipse(24, 14, 10, 3, 0, 0, 7); g.fill(); });
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), K.texMat(photo)); add(root, ph, -0.25, 0.03, 0.2, -Math.PI / 2, 0, 0.4);
    root.scale.z = 1.2; await prop(F, { prefix: 'DPAP', root, w: 1.6, top: 0.75, bottom: -0.75, yaw: 0, elev: 89.9 });
  }
  if (want('DBLD')) {
    const root = new THREE.Group(), r = rng(93);
    const bm = new THREE.MeshStandardMaterial({ color: 0x5a0806, roughness: 0.12, metalness: 0.15 });
    const shape = (R, n, j) => { const s2 = new THREE.Shape(); for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rr = R * (1 + (r() - 0.5) * j); k ? s2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s2.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ShapeGeometry(s2); };
    add(root, new THREE.Mesh(shape(0.5, 28, 0.35), bm), 0, 0.003, 0, -Math.PI / 2, 0, 0).scale.set(1.2, 0.8, 1);
    for (let k = 0; k < 10; k++) { const rr = 0.03 + r() * 0.08; add(root, new THREE.Mesh(shape(rr, 10, 0.4), bm), (r() - 0.5) * 1.6, 0.003, (r() - 0.5) * 1.0, -Math.PI / 2, 0, 0); }
    add(root, new THREE.Mesh(shape(0.25, 16, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a0202, roughness: 0.35 })), 0.1, 0.005, -0.05, -Math.PI / 2, 0, 0);
    root.scale.z = 1.2; await prop(F, { prefix: 'DBLD', root, w: 1.9, top: 0.8, bottom: -0.8, yaw: 0, elev: 89.9 });
  }
  if (want('DGLS')) {
    const root = new THREE.Group(), r = rng(95);
    const gms = [0xb8e2dc, 0xe8fffa, 0x6a9a96, 0xa0d0cc].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.05, metalness: 0.4, emissive: 0x10302c }));
    for (let k = 0; k < 26; k++) {
      const gm = gms[k % 4];
      const s2 = new THREE.Shape(), n = 3 + (k % 2), R = 0.02 + r() * 0.07;
      for (let j = 0; j < n; j++) { const a = j / n * 6.28 + r() * 0.8, rr = R * (0.5 + r()); j ? s2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s2.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s2), gm);
      const d = Math.sqrt(r()) * 0.6, a = r() * 6.28;
      add(root, m, Math.cos(a) * d * 1.3, 0.004, Math.sin(a) * d * 0.8, -Math.PI / 2 + (r() - 0.5) * 0.5, 0, r() * 6);
    }
    root.scale.z = 1.2; await prop(F, { prefix: 'DGLS', root, w: 1.8, top: 0.75, bottom: -0.75, yaw: 0, elev: 89.9, lights: { key: 3.2, rim: 1.6 } });
  }

  // ------------------------------------------------------------ DALN: alien conduit growth (A-B pulse)
  if (want('DALN')) {
    const root = new THREE.Group();
    const shellTex = (() => { const sf = new Surf(128, 128); sf.fill(A.violet); hullPlates(sf, { fx: 2, fy: 3, seed: 711, glow: 0.2 }); return K.surfTex(sf, { lit: true, bake: { amb: 0.6 }, repeat: [2, 2] }); })();
    const flesh = K.texMat(shellTex, { rough: 0.35, metal: 0.15 });
    const bone = M(0xc2b494, { rough: 0.5, detail: 'alien' });
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), flesh); base.scale.set(1.2, 0.35, 0.9); root.add(base);
    const glowMats = [];
    const r = rng(99);
    const stalks = [[[-0.2, 0, 0], [-0.3, 0.5, 0.05], [-0.15, 1.0, 0.1], [-0.3, 1.35, 0.0]], [[0.15, 0, 0.05], [0.25, 0.4, 0.1], [0.35, 0.8, 0.05], [0.25, 1.1, -0.05]], [[0, 0, -0.1], [0.05, 0.6, -0.15], [-0.05, 1.3, -0.1], [0.1, 1.6, 0]]];
    stalks.forEach((pts, k) => {
      add(root, taper(flesh, pts, (t) => 0.1 * (1 - t * 0.75), 40, 10));
      add(root, taper(bone, pts.map(([x, y, z]) => [x + 0.06, y, z + 0.06]), (t) => 0.03 * (1 - t * 0.8), 40, 6));
      const gm = new THREE.MeshBasicMaterial({ color: 0x40f0d0 }); glowMats.push(gm);
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      for (let j = 1; j < 5; j++) { const p = curve.getPointAt(j / 5.5); add(root, sphere(gm, 0.045 * (1 - j * 0.12), 10, 8), p.x + 0.05, p.y, p.z + 0.08); }
      const tip = curve.getPointAt(1); add(root, sphere(gm, 0.05, 12, 8), tip.x, tip.y, tip.z);
    });
    for (let k = 0; k < 6; k++) { const a = r() * 6.28; add(root, taper(flesh, [[0, 0.05, 0], [Math.cos(a) * 0.4, 0.08, Math.sin(a) * 0.3], [Math.cos(a) * 0.8, 0.02, Math.sin(a) * 0.55]], (t) => 0.06 * (1 - t * 0.8), 20, 8)); }
    const pose = (f) => glowMats.forEach((m, k) => m.color.setHex(f === 'A' ? 0x2ab8a0 : 0x8affec));
    await prop(F, { prefix: 'DALN', root, frames: 'AB', w: 2.0, top: 1.9, yaw: 0.3, elev: 10, pose });
  }

  // ------------------------------------------------------------ CURT: curtain billowing in a broken window (A-F)
  if (want('CURT')) {
    const root = new THREE.Group();
    const Wd = 1.5, Ht = 2.0;
    const cloth = canvasTex(128, 128, (g) => {
      g.fillStyle = '#cabd9a'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(90,80,60,${0.05 + (y % 4 ? 0.03 : 0)})`; g.fillRect(0, y, 128, 1); }
      for (let x = 0; x < 128; x += 2) { g.fillStyle = 'rgba(255,250,235,0.05)'; g.fillRect(x, 0, 1, 128); }
      g.fillStyle = 'rgba(120,100,70,0.25)'; g.fillRect(0, 120, 128, 8);
    });
    cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping; cloth.repeat.set(4, 1);
    const geo = new THREE.PlaneGeometry(Wd, Ht, 36, 48); geo.translate(0, Ht / 2, 0);
    const rest = Float32Array.from(geo.attributes.position.array);
    const mat = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.95, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); root.add(mesh);
    // rod + rings
    add(root, cyl(M(0x8a8a86, { metal: 0.7, rough: 0.3 }), 0.012, Wd + 0.2, 8), 0, Ht + 0.02, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k <= 8; k++) add(root, torus(M(0x8a8a86, { metal: 0.7, rough: 0.3 }), 0.02, 0.005, 4, 10), -Wd / 2 + k * Wd / 8, Ht + 0.01, 0);
    // billow cycle: t in [0,1): blown in toward the viewer, falls back, sucked out through the window
    const pose = (f) => {
      // frames run monotonically for the ZScript's ping-pong (CURT ABCDEFEDCB):
      // A sucked out through the frame, B hanging, C-F billowing into the room
      const k = 'ABCDEF'.indexOf(f), t = k / 6, p = geo.attributes.position;
      const out = [-0.95, -0.15, 0.3, 0.6, 0.85, 1.0][k];
      const inn = Math.max(0, out), suck = Math.max(0, -out);
      for (let i = 0; i < p.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        const d = 1 - y / Ht, xs = x / Wd;                 // d: 0 at the rod, 1 at the hem
        const pleat = (Math.sin(xs * Math.PI * 7 + 0.9 * Math.sin(xs * 11)) * 0.032 + Math.sin(xs * Math.PI * 17 + 1) * 0.01) * (1 - 0.6 * inn * d);
        const wave = Math.sin(d * 8 - t * Math.PI * 4 + xs * 3) * 0.06 * d * (0.3 + inn);
        // blown in: the belly swells toward the viewer, the hem lifts in a curve and gathers
        const belly = Math.sin(Math.min(1, d * 1.15) * Math.PI * 0.6) * inn * 0.75 * (0.8 + 0.2 * Math.cos(xs * 5 + t * 6));
        const lift = inn * 0.62 * d * d * (0.75 + 0.35 * Math.sin(xs * 3.2 + 1.2 + t * 4));
        const gather = 1 - 0.18 * inn * d * d - 0.22 * suck * d;
        // sucked back: pressed out through the frame, hem swings aside
        const back = -suck * 0.35 * d;
        const sway = (Math.sin(t * Math.PI * 2 + 1.4) * 0.16 + suck * 0.12) * d * d;
        p.setXYZ(i, x * gather + sway, y + lift, pleat + wave + belly + back);
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    };
    await prop(F, { prefix: 'CURT', root, frames: 'ABCDEF', w: 2.2, top: 2.2, bottom: -0.1, yaw: 0.3, elev: 12, pose, lights: { key: 2.8, fill: 0.5, hemi: 1.3 } });
  }
}
