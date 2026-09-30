// Human heads: an egg-shaped loft with a painted face texture (eyes, brows,
// mouth, hair, stubble, veins, blood), a nose and ears in geometry, plus
// glasses and headgear. Built from the head joint (top of the neck); face +Z.
import * as THREE from 'three';
import { loftGeo, ellipsoidGeo, mesh, mat, glow, canvasTex, cyl, sph, rboxGeo, V3, clamp, lerp, hash, fbm } from './core.js';

// Head profile: [y, rx, rz, cz] relative to the head joint.
export const HEAD = [
  [-0.078, 0, 0, 0.05], [-0.074, 0.026, 0.022, 0.054], [-0.06, 0.05, 0.045, 0.048], [-0.035, 0.066, 0.07, 0.034],
  [0.0, 0.074, 0.09, 0.018], [0.035, 0.079, 0.098, 0.008], [0.07, 0.081, 0.1, 0.0], [0.105, 0.08, 0.098, -0.006],
  [0.14, 0.072, 0.088, -0.011], [0.163, 0.054, 0.068, -0.013], [0.178, 0.03, 0.04, -0.013], [0.183, 0, 0, -0.013],
];
const Y0 = HEAD[0][0], Y1 = HEAD[HEAD.length - 1][0];
function rxAt(y) {
  for (let i = 1; i < HEAD.length; i++) if (y <= HEAD[i][0]) { const a = HEAD[i - 1], b = HEAD[i], t = (y - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], t); }
  return 0.001;
}
// face point (x metres from the centre line, y metres) → canvas pixel
const toPx = (W, H, x, y) => {
  const a = Math.asin(clamp(x / Math.max(0.01, rxAt(y)), -1, 1));
  return [(0.5 + a / (2 * Math.PI)) * W, (1 - (y - Y0) / (Y1 - Y0)) * H];
};

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function shade(c, k) { const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return `rgb(${r | 0},${g | 0},${b | 0})`; }

// f: { skin, hair, hairStyle: 'short'|'receding'|'buzz'|'bald'|'none', brow, eyes: 'human'|'oil'|'black'|'closed',
//      veins, blood, stubble, mouth: 'line'|'open'|'grim', key }
export function faceTexture(f) {
  const key = 'face:' + JSON.stringify(f);
  return canvasTex(key, 256, 128, (g, W, H) => {
    // base skin, per-pixel: gentle shading and pores; hair where the hairline says
    const img = g.createImageData(W, H);
    const sk = [(f.skin >> 16) & 255, (f.skin >> 8) & 255, f.skin & 255];
    const hc = f.hair != null ? [(f.hair >> 16) & 255, (f.hair >> 8) & 255, f.hair & 255] : null;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = 1 - j / H, a = (u - 0.5) * 2 * Math.PI, y = Y0 + v * (Y1 - Y0);
      let k = 0.94 + 0.06 * fbm(u * 8, v * 4, 8, 3, 5);
      if (y < -0.03) k *= 0.93;
      let c = sk.map((x) => x * k);
      // stubble on the jaw and upper lip
      if (f.stubble && y < 0.0 && Math.abs(a) < 1.5 && !(y > -0.022 && y < -0.012 && Math.abs(a) < 0.3)) {
        const s = f.stubble * (0.6 + 0.4 * hash(i, j, 7));
        c = c.map((x) => x * (1 - 0.28 * s));
      }
      if (hc) {
        const aa = Math.abs(a);
        let line; // hair present above this height
        if (f.hairStyle === 'receding') line = aa < 0.75 ? 9 : aa < 1.2 ? lerp(0.16, 0.085, (aa - 0.75) / 0.45) : lerp(0.085, -0.02, Math.min(1, (aa - 1.2) / 1.6));
        else if (f.hairStyle === 'buzz') line = aa < 0.5 ? 0.13 : lerp(0.13, -0.03, Math.min(1, (aa - 0.5) / 2.2));
        else if (f.hairStyle === 'short') line = aa < 0.45 ? 0.118 + 0.006 * Math.cos(a * 9) : aa < 1.15 ? lerp(0.118, 0.05, (aa - 0.45) / 0.7) : lerp(0.05, -0.035, Math.min(1, (aa - 1.15) / 1.7));
        else line = 9;
        // ears stay skin
        const ear = aa > 1.35 && aa < 1.75 && y > 0.0 && y < 0.07;
        let top = 9; if (f.hairStyle === 'receding') top = aa < 1.6 ? 0.155 : 9; // bald crown
        if (y > line && y < top && !ear) {
          const n = 0.8 + 0.35 * fbm(u * 30, v * 6, 30, 3, 3) + (hash(i, j, 9) - 0.5) * 0.15;
          const edge = Math.min(1, (y - line) / 0.012);
          c = c.map((x, q) => lerp(x, hc[q] * n, 0.35 + 0.65 * edge));
        }
      }
      const o = (j * W + i) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (x, y) => toPx(W, H, x, y);
    const ell = (x, y, rxm, rym, fill, rot = 0) => {
      const [cx, cy] = P(x, y), [ex] = P(x + rxm, y), [, ey] = P(x, y + rym);
      g.beginPath(); g.ellipse(cx, cy, Math.abs(ex - cx), Math.abs(cy - ey), rot, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    };
    const line = (pts, w, style) => { g.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.lineWidth = w; g.strokeStyle = style; g.lineCap = 'round'; g.stroke(); };
    const ey = 0.058;
    // eye sockets (soft shadow), then the eyes
    for (const s of [-1, 1]) ell(s * 0.032, ey + 0.002, 0.02, 0.012, shade(f.skin, 0.78));
    for (const s of [-1, 1]) {
      const x = s * 0.032;
      if (f.eyes === 'oil' || f.eyes === 'black') {
        ell(x, ey, f.eyes === 'black' ? 0.02 : 0.016, f.eyes === 'black' ? 0.011 : 0.0085, '#050505');
        ell(x + s * 0.003, ey + 0.003, 0.003, 0.002, f.eyes === 'oil' ? '#3a3f48' : '#2a2d33');
      } else if (f.eyes === 'closed') {
        line([[x - 0.013, ey], [x, ey - 0.003], [x + 0.013, ey]], 2, '#3a2418');
      } else {
        ell(x, ey, 0.014, 0.0065, '#e9e4dc');
        ell(x + s * 0.002, ey, 0.0055, 0.0055, f.iris || '#3b2a1c');
        ell(x + s * 0.002, ey, 0.0028, 0.0028, '#0b0706');
        line([[x - 0.014, ey + 0.004], [x, ey + 0.008], [x + 0.014, ey + 0.004]], 1.6, shade(f.skin, 0.45));
      }
    }
    // oil veins: dark branching lines out of the eyes over cheeks and temples
    if (f.veins) {
      g.globalAlpha = 0.85;
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2 + 0.4, len = 0.025 + 0.02 * hash(k, s + 3, 11);
        const pts = [[s * 0.032 + Math.cos(ang) * 0.014, ey + Math.sin(ang) * 0.008]];
        for (let q = 1; q <= 4; q++) {
          const t = q / 4, wob = (hash(k, q, s + 17) - 0.5) * 0.012;
          pts.push([s * 0.032 + Math.cos(ang) * (0.014 + len * t) + wob, ey + Math.sin(ang) * (0.008 + len * t * 0.9) + wob * 0.6]);
        }
        line(pts, 2.2 - k * 0.12, '#1d1420');
      }
      // veins up the neck / jaw
      for (let k = 0; k < 5; k++) { const x = (k - 2) * 0.024; line([[x, -0.075], [x + 0.006, -0.05], [x - 0.004, -0.03]], 1.6, '#2a1c28'); }
      g.globalAlpha = 1;
      // black tear streaks
      for (const s of [-1, 1]) line([[s * 0.03, ey - 0.006], [s * 0.031, ey - 0.03], [s * 0.029, ey - 0.05]], 2.2, '#0a0708');
    }
    // brows
    if (f.brow != null) for (const s of [-1, 1]) line([[s * 0.017, ey + 0.013], [s * 0.032, ey + 0.017], [s * 0.047, ey + 0.013]], f.browW ?? 3.2, hex(f.brow));
    // mouth
    const mouthY = -0.03;
    if (f.mouth === 'open') ell(0, mouthY, 0.014, 0.008, '#3a1512');
    else if (f.mouth === 'grim') line([[-0.017, mouthY - 0.002], [0, mouthY], [0.017, mouthY - 0.002]], 2.4, '#5a2a24');
    else line([[-0.016, mouthY], [0, mouthY - 0.001], [0.016, mouthY]], 2.2, f.eyes === 'oil' ? '#2a1618' : '#7a3c34');
    if (f.eyes === 'oil') line([[-0.005, mouthY - 0.002], [-0.006, mouthY - 0.03], [-0.004, -0.07]], 2.6, '#0a0708'); // oil drooling from the mouth
    // blood
    if (f.blood) {
      g.fillStyle = '#6e0c0a';
      for (let k = 0; k < 6; k++) { const [x, y] = [0.03 + hash(k, 1, 5) * 0.03, 0.09 - hash(k, 2, 5) * 0.12]; ell(-x, y, 0.008 + 0.006 * hash(k, 3, 5), 0.01 + 0.02 * hash(k, 4, 5), '#7a0e0b'); }
      line([[-0.04, 0.12], [-0.045, 0.08], [-0.05, 0.03]], 3.5, '#8a100c');
    }
  });
}

// Build a head. o: { skin, face (faceTexture args), glasses, hat, ears, nose, s, hairVolume }
export function makeHead(o) {
  const g = new THREE.Group();
  const s = o.s ?? 1;
  const skinM = mat(o.skin, { rough: 0.7 });
  const faceM = mat(0xffffff, { rough: 0.7, map: faceTexture({ skin: o.skin, ...o.face }) });
  const skull = mesh(loftGeo(HEAD, { seg: 24, n: 2.15 }), faceM);
  skull.scale.setScalar(s);
  g.add(skull);
  g.skull = skull;
  // swap the painted face (e.g. an open, screaming mouth) for one frame
  g.setFace = (patch) => { skull.material = patch ? mat(0xffffff, { rough: 0.7, map: faceTexture({ skin: o.skin, ...o.face, ...patch }) }) : faceM; };
  // nose: a wedge from the brow down
  const nose = mesh(ellipsoidGeo(0.011, 0.027, 0.016, 8, 6), skinM, 0, 0.022 * s, 0.104 * s, -0.25, 0, 0);
  nose.scale.setScalar(s); g.add(nose);
  // brow ridge + cheekbones for relief
  g.add(mesh(ellipsoidGeo(0.05, 0.012, 0.02, 12, 6), faceM, 0, 0.075 * s, 0.088 * s).rotateX(0.2));
  if (o.ears !== false) for (const sd of [-1, 1]) g.add(mesh(ellipsoidGeo(0.011, 0.028, 0.019, 8, 6), skinM, sd * 0.079 * s, 0.035 * s, -0.004 * s, 0, sd * 0.3, sd * 0.1));
  if (o.hairVolume) {
    // a thin shell over the painted hair so it reads in silhouette
    const hm = mat(o.face.hair, { rough: 0.95 });
    const v = o.hairVolume;
    const [hy0, hy1] = o.hairY ?? [0.04, 1];
    const shell = mesh(loftGeo(HEAD.filter((r) => r[0] > hy0 && r[0] < hy1).map(([y, rx, rz, cz]) => [y, rx + v, rz + v, cz - v * 0.6]), { seg: 20, n: 2.15, a0: o.hairA0 ?? -Math.PI, a1: o.hairA1 ?? Math.PI }), hm);
    shell.material = shell.material.clone(); shell.material.side = THREE.DoubleSide;
    g.add(shell);
  }
  if (o.glasses) g.add(glasses(s));
  if (o.hat) { g.hat = hat(o.hat, s, o.hatOpts); g.add(g.hat); }
  if (o.mask) g.add(o.mask);
  return g;
}

export function glasses(s = 1) {
  const g = new THREE.Group();
  const frame = mat(0x1b1714, { rough: 0.4, metal: 0.3 });
  const lens = mat(0xcfe4f0, { rough: 0.05, metal: 0.2, emissive: 0x2a3a44, ei: 1 });
  for (const sd of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.0145, 0.0022, 5, 14), frame, sd * 0.032 * s, 0.056 * s, 0.1 * s, 0, sd * -0.2, 0);
    rim.scale.set(1.15, 0.85, 1); g.add(rim);
    const l = mesh(new THREE.CircleGeometry(0.0142, 12), lens, sd * 0.032 * s, 0.056 * s, 0.0995 * s, 0, sd * -0.2, 0);
    l.scale.set(1.15, 0.85, 1); g.add(l);
    g.add(mesh(new THREE.BoxGeometry(0.003, 0.003, 0.09), frame, sd * 0.079 * s, 0.058 * s, 0.055 * s, 0, sd * 0.05, 0));
  }
  g.add(mesh(new THREE.BoxGeometry(0.018, 0.003, 0.004), frame, 0, 0.06 * s, 0.103 * s));
  return g;
}

// Headgear. kind: 'beret' | 'helmet' (Barney-style) | 'pasgt' (woodland) | 'scrubcap'
export function hat(kind, s = 1, o = {}) {
  const g = new THREE.Group();
  if (kind === 'beret') {
    const wool = mat(0x17171a, { rough: 1 });
    // headband hugging the skull, the crown flopped over the right side
    const band = mesh(loftGeo([[0.1, 0.084, 0.102, -0.006], [0.125, 0.081, 0.097, -0.008]], { seg: 22, n: 2.15 }), wool);
    band.material = band.material.clone(); band.material.side = THREE.DoubleSide; g.add(band);
    const crown = mesh(ellipsoidGeo(0.1, 0.038, 0.112, 18, 8), wool, -0.018, 0.148, -0.012, 0.08, 0, 0.3);
    g.add(crown);
    // badge over the left eye
    g.add(mesh(ellipsoidGeo(0.011, 0.013, 0.004, 8, 6), mat(0xb89a3c, { rough: 0.35, metal: 0.7 }), 0.03, 0.125, 0.093, -0.3, 0.25, 0));
  } else if (kind === 'helmet' || kind === 'pasgt') {
    const hm = kind === 'pasgt' ? mat(0xffffff, { rough: 0.9, map: o.camo }) : mat(o.color ?? 0x243452, { rough: 0.55 });
    // PASGT "Fritz" dome with the flared skirt at the sides and back
    const secs = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = t * Math.PI / 2;
      secs.push({ y: 0.06 + Math.sin(a) * 0.14, rx: Math.cos(a) * 0.106, rz: Math.cos(a) * 0.122, cz: -0.012 });
    }
    const dome = mesh(loftGeo(secs, { seg: 24 }), hm);
    g.add(dome);
    // brim: a short flared lip, deeper at the back
    const brim = mesh(loftGeo([{ y: 0.035, rx: 0.118, rz: 0.134, cz: -0.022 }, { y: 0.064, rx: 0.106, rz: 0.122, cz: -0.012 }], { seg: 24 }), hm);
    brim.material = brim.material.clone(); brim.material.side = THREE.DoubleSide; g.add(brim);
    if (kind === 'pasgt') {
      g.add(mesh(loftGeo([{ y: 0.085, rx: 0.109, rz: 0.125, cz: -0.012 }, { y: 0.105, rx: 0.106, rz: 0.121, cz: -0.012 }], { seg: 24 }), mat(0x3f4a2a, { rough: 1 }))); // band
    }
    // chin strap
    const strap = mat(0x1a1a1a, { rough: 0.9 });
    for (const sd of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.006, 0.1, 0.012), strap, sd * 0.08, 0.0, 0.03, 0.25, 0, sd * 0.05));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.008, 0.014), strap, 0, -0.07, 0.05, 0.4, 0, 0));
  } else if (kind === 'scrubcap') {
    const cm = mat(o.color ?? 0x3f78a8, { rough: 0.9 });
    const secs = [];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; secs.push({ y: 0.09 + Math.sin(a) * 0.1, rx: Math.cos(a) * 0.088, rz: Math.cos(a) * 0.104, cz: -0.014 }); }
    g.add(mesh(loftGeo(secs, { seg: 22 }), cm));
    // tie at the back
    g.add(mesh(ellipsoidGeo(0.014, 0.01, 0.01), cm, 0, 0.1, -0.1));
  }
  g.scale.setScalar(s);
  return g;
}
