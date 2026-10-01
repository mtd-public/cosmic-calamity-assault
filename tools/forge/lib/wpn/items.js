// Pickup models (docs/ASSETS.md §3): ammo, health, armour, keys, objectives.
// Each builder returns a Group lying on the floor (y = 0), front toward +Z,
// real scale in metres (the job scales them up, Doom-style).
import { THREE, mat, glow, lit, extrude, rbox, cylZ, latheZ, latheY, put, group, fillet, V3, torus, sphere, canvas, rrect } from './core.js';
import { loft } from './arm.js';

// ---------------------------------------------------------------- label textures
const texCache = new Map();
export function labelTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = canvas(w, h); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); return t;
}
const texMat = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive ? 0xffffff : 0x000000, emissiveMap: o.emissive ? t : null, emissiveIntensity: o.ei ?? 1 });
function grunge(g, w, h, n = 400, a = 0.08, seed = 1) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${a * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
}
// a box with a label texture on the front/top faces and a plain material elsewhere
function labelBox(w, h, d, side, front, top) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mats = [side, side, top || side, side, front || side, front || side];
  const m = new THREE.Mesh(geo, mats); m.position.y = h / 2; g.add(m);
  return g;
}

// ---------------------------------------------------------------- ammo
export function ammoBox9() {
  const t = labelTex('box9', 256, 128, (g, w, h) => {
    g.fillStyle = '#b8a070'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3a6a'; g.fillRect(0, 0, w, 34); g.fillRect(0, h - 18, w, 18);
    g.fillStyle = '#f2ead8'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('9mm LUGER', w / 2, 26);
    g.fillStyle = '#2a2014'; g.font = 'bold 44px sans-serif'; g.fillText('50', w / 2 - 50, 88); g.font = 'bold 18px sans-serif'; g.fillText('CARTRIDGES', w / 2 + 40, 72); g.fillText('115 GR FMJ', w / 2 + 40, 94);
    grunge(g, w, h, 500, 0.12, 3);
  });
  const tt = labelTex('box9t', 128, 128, (g, w, h) => { g.fillStyle = '#b8a070'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3a6a'; g.fillRect(0, 0, w, 20); g.fillStyle = '#2a2014'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.fillText('9mm', w / 2, 74); grunge(g, w, h, 300, 0.1, 4); });
  const side = mat('white', { c: 0xa89060, rough: 0.85 });
  const g = labelBox(0.14, 0.04, 0.08, side, texMat(t), texMat(tt));
  // a few loose rounds spilling out
  for (let i = 0; i < 3; i++) { const r = round9(); r.position.set(0.09 + i * 0.012, 0.005, 0.02 - i * 0.018); r.rotation.set(0, 0.4 + i * 0.7, Math.PI / 2); g.add(r); }
  return g;
}
export function round9() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(latheZ([[0.0001, -0.0145], [0.0025, -0.0135], [0.004, -0.0105], [0.0048, -0.006], [0.0048, 0.0]], 14), mat('copper')));
  put(g, new THREE.Mesh(cylZ(0.0049, 0.0049, 0.0, 0.015, 14), mat('brass')));
  return g;
}
export function shell(color = 0x9c1c18) {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(cylZ(0.0102, 0.0102, -0.048, 0.0, 20), mat('shellRed', { c: color })));
  put(g, new THREE.Mesh(latheZ([[0.0102, 0.0], [0.0106, 0.0], [0.0106, 0.016], [0.0114, 0.017], [0.0114, 0.019], [0.0001, 0.019]], 20), mat('brass')));
  put(g, new THREE.Mesh(new THREE.CircleGeometry(0.0095, 16), mat('shellRed', { c: 0x6a1210 })), [0, 0, -0.0481], [0, Math.PI, 0]);
  return g;
}
export function shellBox() {
  const t = labelTex('boxsh', 256, 128, (g, w, h) => {
    g.fillStyle = '#8a1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c860'; g.fillRect(0, 40, w, 46);
    g.fillStyle = '#2a0a06'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('12 GAUGE', w / 2, 76);
    g.fillStyle = '#f2e6c8'; g.font = 'bold 20px sans-serif'; g.fillText('00 BUCK  ·  25 SHELLS', w / 2, 30); g.fillText('2 3/4"  MAGNUM', w / 2, 112);
    grunge(g, w, h, 500, 0.12, 5);
  });
  const tt = labelTex('boxsht', 128, 128, (g, w, h) => { g.fillStyle = '#8a1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c860'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('12', w / 2, 60); g.fillText('GA', w / 2, 98); grunge(g, w, h, 300, 0.1, 6); });
  const g = labelBox(0.15, 0.065, 0.1, mat('shellRed', { c: 0x7a1612, rough: 0.8 }), texMat(t), texMat(tt));
  for (let i = 0; i < 2; i++) { const s = shell(); s.position.set(0.1 + i * 0.01, 0.011, 0.03 - i * 0.03); s.rotation.set(0, 1.2 + i * 0.6, 0); g.add(s); }
  return g;
}
export function ammoCan(text = '5.56MM') {
  const g = new THREE.Group();
  const od = mat('parkerized', { c: 0x4a5236, rough: 0.55, metal: 0.4 });
  put(g, new THREE.Mesh(rbox(0.28, 0.17, 0.095, 0.008), od), [0, 0.085, 0]);
  put(g, new THREE.Mesh(rbox(0.29, 0.02, 0.105, 0.006), od), [0, 0.172, 0]);
  // latch + handle
  put(g, new THREE.Mesh(rbox(0.03, 0.06, 0.012, 0.004), od), [-0.13, 0.15, 0.05], [0, 0, 0]);
  put(g, new THREE.Mesh(rbox(0.12, 0.008, 0.02, 0.004), mat('darksteel')), [0, 0.19, 0]);
  const t = labelTex('can' + text, 256, 128, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h); x.fillStyle = '#e8d890'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.fillText(`CTG ${text}`, w / 2, 50); x.font = 'bold 20px monospace'; x.fillText('840 BALL M855 · 10-RD CLIPS', w / 2, 86); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }));
  put(g, lab, [0, 0.09, 0.0482]);
  return g;
}

// ---------------------------------------------------------------- alien energy
export function energyCell(pulse = 0, big = false) {
  const g = new THREE.Group(); const s = big ? 1.7 : 1;
  const e = glow(pulse ? 0xb8fff0 : 0x4ee8cc, pulse ? 1.25 : 0.95);
  // a teal glowing core held in a bone cage with chrome caps, lying on its side
  const r = group(g, [0, 0.03 * s, 0], [0, 0.3, Math.PI / 2]);
  put(r, new THREE.Mesh(latheY([[0.0001, -0.06], [0.014, -0.058], [0.02, -0.05], [0.021, 0.05], [0.014, 0.058], [0.0001, 0.06]].map(([a, b]) => [a * s, b * s]), 24), e));
  for (const sy of [-1, 1]) put(r, new THREE.Mesh(latheY([[0.0001, 0.055], [0.024, 0.055], [0.026, 0.065], [0.02, 0.078], [0.0001, 0.08]].map(([a, b]) => [a * s, b * s * sy]), 24), mat('chromeViolet')));
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const rib = put(r, new THREE.Mesh(loft([0, 1, 2, 3, 4].map((k) => { const t = k / 4, y = (-0.055 + 0.11 * t) * s, rr = (0.024 + 0.006 * Math.sin(t * Math.PI)) * s; return { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], w: 0.006 * s, h: 0.005 * s }; }), { radial: 8 }), mat('bone'))); void rib; }
  if (big) for (let i = 0; i < 3; i++) put(g, new THREE.Mesh(sphere(0.012, 12, 8), e), [-0.06 + i * 0.06, 0.012, 0.07]);
  return g;
}
// ---------------------------------------------------------------- health / armour
export function stim() {
  const g = new THREE.Group();
  const r = group(g, [0, 0.016, 0], [0, 0.4, Math.PI / 2]);
  put(r, new THREE.Mesh(latheY([[0.0001, -0.07], [0.012, -0.07], [0.014, -0.066], [0.014, 0.05], [0.012, 0.054], [0.0001, 0.054]], 24), mat('white', { c: 0xe2e4e0, rough: 0.35 })));
  put(r, new THREE.Mesh(latheY([[0.0115, -0.04], [0.0115, 0.03]], 24, true), glow(0x6aff9a, 0.9)));
  put(r, new THREE.Mesh(latheY([[0.0145, -0.045], [0.0145, 0.04]], 24), mat('glass', { opacity: 0.35 })));
  put(r, new THREE.Mesh(latheY([[0.0001, 0.054], [0.009, 0.054], [0.009, 0.075], [0.0001, 0.078]], 20), mat('shellRed', { c: 0xd0a020 })));
  put(r, new THREE.Mesh(latheY([[0.0001, -0.07], [0.007, -0.07], [0.006, -0.08], [0.0001, -0.083]], 16), mat('darksteel')));
  const t = labelTex('stim', 128, 64, (x, w, h) => { x.fillStyle = '#f2f0e8'; x.fillRect(0, 0, w, h); x.fillStyle = '#c01818'; x.fillRect(8, 16, 32, 32); x.fillStyle = '#fff'; x.fillRect(20, 20, 8, 24); x.fillRect(12, 28, 24, 8); x.fillStyle = '#222'; x.font = 'bold 16px sans-serif'; x.fillText('EPINEPHRINE', 46, 30); x.font = '12px sans-serif'; x.fillText('AUTO-INJECTOR', 46, 48); });
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0142, 0.0142, 0.04, 24, 1, true), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  put(r, lab, [0, -0.055 + 0.0, 0]); lab.position.y = 0.045 - 0.06; lab.scale.set(1.01, 1, 1.01);
  return g;
}
export function medkit() {
  const g = new THREE.Group();
  const body = mat('white', { c: 0xd8d6cc, rough: 0.55 });
  put(g, new THREE.Mesh(rbox(0.26, 0.09, 0.17, 0.018), body), [0, 0.045, 0]);
  put(g, new THREE.Mesh(rbox(0.265, 0.012, 0.175, 0.005), mat('polymer', { c: 0x8a8a84 })), [0, 0.06, 0]);
  // red cross on the lid + handle + latches
  const red = mat('shellRed', { c: 0xc01818, rough: 0.5 });
  put(g, new THREE.Mesh(rbox(0.09, 0.004, 0.028, 0.002), red), [0, 0.0915, 0]);
  put(g, new THREE.Mesh(rbox(0.028, 0.004, 0.09, 0.002), red), [0, 0.0915, 0]);
  put(g, new THREE.Mesh(rbox(0.1, 0.014, 0.018, 0.006), mat('polymer')), [0, 0.04, 0.092]);
  for (const sx of [-1, 1]) put(g, new THREE.Mesh(rbox(0.02, 0.025, 0.008, 0.003), mat('steel')), [sx * 0.08, 0.06, 0.088]);
  const t = labelTex('medk', 256, 64, (x, w, h) => { x.fillStyle = '#d8d6cc'; x.fillRect(0, 0, w, h); x.fillStyle = '#c01818'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('FIRST AID', w / 2, 44); });
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })), [0, 0.03, 0.0855]);
  return g;
}
export function implant(k = 0) {
  // alien implant: a glowing teal-violet nucleus in a ribbed bone cradle with tendrils
  const g = new THREE.Group();
  const pulse = [0.85, 1.0, 1.2, 1.0][k];
  const core = put(g, new THREE.Mesh(sphere(0.07 * (0.95 + 0.06 * k), 32, 24), glow(0x7affd8, pulse)), [0, 0.12, 0]);
  void core;
  put(g, new THREE.Mesh(sphere(0.085 + 0.004 * k, 32, 24), mat('glass', { c: 0x40ffd0, opacity: 0.18 })), [0, 0.12, 0]);
  put(g, new THREE.Mesh(sphere(0.03, 20, 14), glow(0xd0a0ff, pulse)), [0.0, 0.12, 0.05]);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const pts = [0, 1, 2, 3, 4, 5].map((t) => { const u = t / 5, r = 0.05 + 0.06 * Math.sin(u * Math.PI); return { p: [Math.cos(a) * r, 0.02 + u * 0.2, Math.sin(a) * r], w: 0.012 * (1 - u * 0.5), h: 0.012 * (1 - u * 0.5) }; });
    put(g, new THREE.Mesh(loft(pts, { radial: 8 }), mat('bone')));
  }
  put(g, new THREE.Mesh(latheY([[0.0001, 0], [0.08, 0], [0.09, 0.015], [0.06, 0.03], [0.0001, 0.035]], 32), mat('boneDark')));
  return g;
}
export function vest(tac = false) {
  const g = new THREE.Group();
  const cloth = tac ? mat('suit', { c: 0x22262a, rough: 0.9 }) : mat('suit', { c: 0x4a5236, rough: 0.92 });
  // a vest lying flat: front panel outline with arm holes and neck cut, padded
  const P = fillet([[-0.17, -0.2], [0.17, -0.2], [0.18, 0.08], [0.13, 0.12], [0.12, 0.22], [0.06, 0.22], [0.04, 0.12], [-0.04, 0.12], [-0.06, 0.22], [-0.12, 0.22], [-0.13, 0.12], [-0.18, 0.08]], [0.03, 0.03, 0.02, 0.02, 0.01, 0.01, 0.03, 0.03, 0.01, 0.01, 0.02, 0.02], 3);
  put(g, new THREE.Mesh(extrude(P, [0, 0.045], { axis: 'z', bevel: 0.012, seg: 3 }), cloth), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  // quilting seams / straps
  const strap = tac ? mat('polymer', { c: 0x111214 }) : mat('suit', { c: 0x3a4028 });
  for (const x of [-0.11, 0.11]) put(g, new THREE.Mesh(rbox(0.04, 0.008, 0.36, 0.003), strap), [x, 0.048, 0.02]);
  if (!tac) {
    for (let i = 0; i < 4; i++) put(g, new THREE.Mesh(rbox(0.3, 0.004, 0.004, 0.0015), mat('black', { c: 0x2a3020 })), [0, 0.047, -0.12 + i * 0.07]);
    const t = labelTex('vestp', 128, 64, (x, w, h) => { x.fillStyle = '#2a3020'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8d0a0'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('FBI', w / 2, 46); });
    put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })), [0, 0.0505, 0.06], [-Math.PI / 2, 0, 0]);
  } else {
    // armour plate + magazine pouches
    put(g, new THREE.Mesh(rbox(0.25, 0.03, 0.3, 0.02), mat('polymer', { c: 0x2e3338, rough: 0.6 })), [0, 0.06, 0.0]);
    for (let i = 0; i < 3; i++) put(g, new THREE.Mesh(rbox(0.07, 0.04, 0.1, 0.01), mat('suit', { c: 0x1d2024 })), [-0.08 + i * 0.08, 0.09, 0.08]);
    put(g, new THREE.Mesh(rbox(0.12, 0.005, 0.04, 0.002), mat('watchSteel')), [0, 0.0775, -0.1]);
  }
  return g;
}
export function battery() {
  const g = new THREE.Group();
  const t = labelTex('batt', 256, 128, (x, w, h) => { x.fillStyle = '#141414'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8901a'; x.fillRect(0, 0, w * 0.32, h); x.fillStyle = '#e8e0c8'; x.font = 'bold 30px sans-serif'; x.fillText('ALKALINE', w * 0.38, 56); x.font = 'bold 40px sans-serif'; x.fillText('D  1.5V', w * 0.4, 104); });
  for (let i = 0; i < 2; i++) {
    const r = group(g, [0, 0.017, -0.02 + i * 0.04], [0, 0.2 * i, Math.PI / 2]);
    put(r, new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.058, 32, 1, true), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.2 })));
    put(r, new THREE.Mesh(latheY([[0.0001, 0.029], [0.0165, 0.029], [0.0165, 0.03], [0.005, 0.031], [0.005, 0.0325], [0.0001, 0.0325]], 24), mat('steel')));
    put(r, new THREE.Mesh(latheY([[0.0001, -0.03], [0.0165, -0.03], [0.0165, -0.029]], 24), mat('steel')));
  }
  return g;
}
// ---------------------------------------------------------------- keys / objectives
export function keycard(color, lit = false) {
  const g = new THREE.Group();
  const C = { blue: ['#1f5bd8', 0x5aa8ff], red: ['#c41f1f', 0xff6a50], yellow: ['#d8b018', 0xfff080] }[color];
  const t = labelTex('card' + color, 256, 160, (x, w, h) => {
    x.fillStyle = '#e8e8e2'; x.fillRect(0, 0, w, h); x.fillStyle = C[0]; x.fillRect(0, 0, w, 44); x.fillRect(0, h - 18, w, 18);
    x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('S-4 ACCESS', 12, 32);
    x.fillStyle = '#8a8a90'; x.fillRect(14, 58, 62, 72); x.fillStyle = '#5a5a60'; x.beginPath(); x.arc(45, 84, 16, 0, 7); x.fill(); x.fillRect(25, 104, 40, 26);
    x.fillStyle = '#c8a840'; x.fillRect(96, 62, 34, 26); x.strokeStyle = '#8a6a20'; x.strokeRect(96, 62, 34, 26);
    x.fillStyle = '#222'; x.font = 'bold 15px monospace'; x.fillText('CLEARANCE', 96, 110); x.fillText(color.toUpperCase(), 96, 128);
    for (let i = 0; i < 26; i++) { x.fillStyle = i % 3 ? '#222' : '#fff'; x.fillRect(150 + i * 3.6, 64, 2, 30); }
  });
  const r = group(g, [0, 0, 0], [0, 0.35, 0]);
  put(r, new THREE.Mesh(rbox(0.086, 0.0012, 0.054, 0.0005), mat('white', { c: 0xe8e8e2, rough: 0.35 })), [0, 0.0006, 0]);
  put(r, new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.054), texMat(t, { rough: 0.35 })), [0, 0.0013, 0], [-Math.PI / 2, 0, 0]);
  // LED strip along the top edge (lit on the blink frame)
  put(r, new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.014), lit ? glow(C[1], 1.25) : mat('white', { c: new THREE.Color(C[0]).getHex(), rough: 0.4 })), [0, 0.0016, -0.02], [-Math.PI / 2, 0, 0]);
  // a lanyard clip hole
  put(r, new THREE.Mesh(new THREE.CircleGeometry(0.003, 12), mat('black')), [0.036, 0.0017, -0.019], [-Math.PI / 2, 0, 0]);
  return g;
}
export function dossier() {
  const g = new THREE.Group();
  const t = labelTex('dossier', 256, 320, (x, w, h) => {
    x.fillStyle = '#d6bb7c'; x.fillRect(0, 0, w, h); grunge(x, w, h, 900, 0.1, 9);
    x.fillStyle = '#8a7040'; x.fillRect(0, 0, w, 6);
    x.fillStyle = '#3a2a14'; x.font = 'bold 18px monospace'; x.fillText('CASE: MJ-12 / S-4', 20, 50); x.fillText('FILE  0451-A', 20, 74);
    x.save(); x.translate(w / 2, 170); x.rotate(-0.22);
    x.strokeStyle = '#b81c16'; x.lineWidth = 6; x.strokeRect(-104, -30, 208, 60);
    x.fillStyle = '#b81c16'; x.font = 'bold 36px sans-serif'; x.textAlign = 'center'; x.fillText('TOP SECRET', 0, 13); x.restore();
    x.fillStyle = 'rgba(184,28,22,0.75)'; x.font = 'bold 16px monospace'; x.fillText('EYES ONLY', 140, 270);
  });
  const folder = mat('white', { c: 0xd6bb7c, rough: 0.85 });
  put(g, new THREE.Mesh(rbox(0.23, 0.006, 0.3, 0.002), folder), [0, 0.003, 0]);
  // papers peeking out
  for (let i = 0; i < 2; i++) put(g, new THREE.Mesh(rbox(0.215, 0.002, 0.29, 0.0008), mat('white', { c: 0xf0ece0 })), [0.01 + i * 0.006, 0.0055 + i * 0.001, -0.004 - i * 0.004], [0, 0.03 * (i + 1), 0]);
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.3), texMat(t)), [0, 0.0085, 0], [-Math.PI / 2, 0, 0]);
  // tab
  put(g, new THREE.Mesh(rbox(0.08, 0.006, 0.02, 0.002), folder), [-0.05, 0.003, -0.158]);
  // paper clip
  const clip = group(g, [0.07, 0.01, -0.14], [Math.PI / 2, 0, 0]);
  for (const [R, y] of [[0.007, 0], [0.0045, 0.006]]) put(clip, new THREE.Mesh(new THREE.TorusGeometry(R, 0.0008, 6, 20, Math.PI), mat('steel')), [0, y + 0.02, 0], [0, 0, 0]);
  put(clip, new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.03, 6), mat('steel')), [0.007, 0.005, 0]);
  put(clip, new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.03, 6), mat('steel')), [-0.007, 0.005, 0]);
  return g;
}
export function caseFile() {
  const g = new THREE.Group();
  const t = labelTex('casefile', 256, 320, (x, w, h) => {
    x.fillStyle = '#7a5530'; x.fillRect(0, 0, w, h); grunge(x, w, h, 900, 0.12, 13);
    x.fillStyle = '#efe6cc'; x.fillRect(30, 40, w - 60, 90); x.fillStyle = '#2a1a0a'; x.font = 'bold 22px monospace';
    x.fillText('F.B.I.', 44, 72); x.font = 'bold 17px monospace'; x.fillText('X-FILE 51-0997', 44, 98); x.fillText('AGENT E. MARSH', 44, 120);
    x.save(); x.translate(w / 2, 220); x.rotate(0.15); x.fillStyle = 'rgba(160,20,16,0.85)'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('CLASSIFIED', 0, 0); x.restore();
  });
  put(g, new THREE.Mesh(rbox(0.24, 0.035, 0.31, 0.006), mat('leatherBrown', { c: 0x6a4a2a })), [0, 0.0175, 0]);
  for (let i = 0; i < 3; i++) put(g, new THREE.Mesh(rbox(0.22, 0.003, 0.3, 0.001), mat('white', { c: [0xf0ece0, 0xe8e0c8, 0xf6f2e6][i] })), [0.012 - i * 0.008, 0.008 + i * 0.008, 0.008 + i * 0.006], [0, -0.05 + i * 0.05, 0]);
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.31), texMat(t)), [0, 0.0352, 0], [-Math.PI / 2, 0, 0]);
  // elastic band
  put(g, new THREE.Mesh(rbox(0.244, 0.037, 0.008, 0.003), mat('rubber', { c: 0x3a1a10 })), [0, 0.0175, 0.08]);
  return g;
}
export function hddCase() {
  const g = new THREE.Group();
  // rugged grey case (open lid shell), a 90s 3.5" drive inside, an alien glyph glowing on the drive
  const caseM = mat('polymer', { c: 0x4a4e52, rough: 0.5 });
  put(g, new THREE.Mesh(rbox(0.22, 0.05, 0.17, 0.012), caseM), [0, 0.025, 0]);
  put(g, new THREE.Mesh(rbox(0.205, 0.01, 0.155, 0.004), mat('rubber')), [0, 0.048, 0]);
  for (const sx of [-1, 1]) put(g, new THREE.Mesh(rbox(0.03, 0.018, 0.012, 0.004), mat('darksteel')), [sx * 0.07, 0.03, 0.088]);
  const drive = group(g, [0, 0.053, 0], [0, 0.12, 0]);
  put(drive, new THREE.Mesh(rbox(0.146, 0.026, 0.102, 0.003), mat('alu', { c: 0x8a8e94, metal: 0.8, rough: 0.35 })));
  put(drive, new THREE.Mesh(rbox(0.11, 0.002, 0.07, 0.001), mat('alu', { c: 0x9ea2a8, metal: 0.9, rough: 0.25 })), [0, 0.013, -0.005]);
  const t = labelTex('hddlab', 128, 64, (x, w, h) => { x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, w, h); x.fillStyle = '#222'; x.font = 'bold 12px sans-serif'; x.fillText('QUANTUM FIREBALL', 6, 16); x.font = '11px monospace'; x.fillText('1.2GB  S-4/ARCH', 6, 34); x.fillText('PROPERTY OF USAF', 6, 52); });
  put(drive, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })), [-0.03, 0.0141, 0.02], [-Math.PI / 2, 0, 0]);
  const gt = labelTex('hddglyph', 128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#c8a0ff'; x.lineWidth = 8; x.lineCap = 'round'; x.translate(64, 64); x.beginPath(); x.arc(0, 0, 40, 0.3, Math.PI * 1.6); x.moveTo(0, -46); x.lineTo(0, 46); x.moveTo(-24, 10); x.lineTo(24, -16); x.stroke(); x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fillStyle = '#e8d0ff'; x.fill(); });
  put(drive, new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), new THREE.MeshBasicMaterial({ map: gt, transparent: true, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })), [0.035, 0.0145, -0.01], [-Math.PI / 2, 0, 0]);
  // ribbon cable stub + violet growth creeping over the drive
  put(drive, new THREE.Mesh(rbox(0.05, 0.004, 0.012, 0.001), mat('polymer', { c: 0x8a8a8a })), [0, 0.0, 0.056]);
  for (let i = 0; i < 4; i++) put(drive, new THREE.Mesh(sphere(0.006 - i * 0.001, 10, 8), mat('alienShell', { c: 0x5a3a7a })), [0.06 - i * 0.012, 0.012, -0.04 + i * 0.006]);
  return g;
}
export function shard(on = false) {
  const g = new THREE.Group();
  const c = on ? glow(0xd8a8ff, 1.15) : lit(0x8a5ad8, 0x6a30c0, 0.8, { rough: 0.1 });
  const crystal = (h, r, x, z, rx, rz) => { const geo = new THREE.ConeGeometry(r, h, 6, 1); geo.translate(0, h / 2, 0); const m = new THREE.Mesh(geo, c); m.position.set(x, 0, z); m.rotation.set(rx, 0, rz); g.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h * 0.25, 6), c); b.position.set(x, 0, z); b.rotation.set(rx, 0, rz); g.add(b); };
  crystal(0.24, 0.035, 0, 0, 0.05, 0.08);
  crystal(0.14, 0.025, 0.04, 0.02, 0.3, -0.45);
  crystal(0.11, 0.02, -0.04, -0.01, -0.2, 0.55);
  put(g, new THREE.Mesh(latheY([[0.0001, 0], [0.06, 0], [0.05, 0.02], [0.0001, 0.025]], 8), mat('alienShell', { c: 0x3a2a4a })));
  return g;
}
