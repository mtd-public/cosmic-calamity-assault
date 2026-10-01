// Civilians and agents on buildHuman's skeleton: the Man in Black (MIBK) and the
// 1997 Chicago office workers (OFC1 man, OFC2 woman), plus their tailoring:
//
//   arcLoftGeo(rows, o)          loft whose rings each span their own arc (a0..a1): open-fronted
//                                jackets, lapels, hair that leaves the face free
//   jacket(R, m, o)              suit jacket shell over the torso: a V above the button, a cutaway
//                                below it, lapels; skirt panels hinged at the waist follow the thighs
//   necktie(R, m, o) / lanyard(R, o) / slacks(R, m, o)
//   hairShell(rows, color)       rows [y, rx, rz, cz, gap] in head space; headHair(spec) builds them
//                                from the head profile
//   sunglasses() / earpiece() / silencedPistol()
//   buildMIB() / buildOfficeMan() / buildOfficeWoman()
import * as THREE from 'three';
import { buildHuman, webBelt } from './human.js';
import { pistol } from './guns.js';
import { shoe } from './parts.js';
import { faceTexture, HEAD } from './head.js';
import { loftGeo, profileAt, ellipsoidGeo, mesh, mat, glow, canvasTex, pixTex, rboxGeo, cyl, sph, tubeGeo, camo, V3, lerp, clamp, fbm, hash } from './core.js';

const N_TORSO = 2.35, TAU = Math.PI * 2;

// ------------------------------------------------------------------ geometry
function se(a, n) {
  const c = Math.cos(a), s = Math.sin(a), p = 2 / n;
  return [Math.sign(s) * Math.pow(Math.abs(s), p), Math.sign(c) * Math.pow(Math.abs(c), p)];
}
// rows: [{ y, rx, rz, cz, cx, a0, a1, n, jag }] (jag: ragged edge amplitude). Angle 0 is the front (+Z), increasing toward +X
// (the character's left), π the back. A ring spanning the full turn welds its seam.
// UVs in metres (u round the ring, v down the rows).
export function arcLoftGeo(rows, o = {}) {
  const seg = o.seg ?? 24, n0 = o.n ?? 2;
  const pos = [], uv = [], idx = [], R = seg + 1;
  let vm = 0;
  rows.forEach((s, i) => {
    if (i) { const p = rows[i - 1]; vm += Math.hypot(s.y - p.y, (s.rx + s.rz - p.rx - p.rz) / 2, (s.cz ?? 0) - (p.cz ?? 0)); }
    const a0 = s.a0 ?? 0, a1 = s.a1 ?? TAU;
    for (let j = 0; j <= seg; j++) {
      const a = a0 + ((a1 - a0) * j) / seg;
      const [ex, ez] = se(a, s.n ?? n0);
      const jy = s.jag ? s.jag * (0.6 * Math.sin(a * 5 + 0.7) + 0.4 * Math.sin(a * 11 + 1.9)) : 0;
      pos.push((s.cx ?? 0) + s.rx * ex, s.y + jy, (s.cz ?? 0) + s.rz * ez);
      uv.push((a * (s.rx + s.rz)) / 2, vm);
    }
  });
  const up = rows[rows.length - 1].y >= rows[0].y;
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
    if (up) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal, t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  rows.forEach((s, i) => {
    if (s.rx < 1e-5 && s.rz < 1e-5) { const sg = i === 0 ? (up ? -1 : 1) : (up ? 1 : -1); for (let j = 0; j <= seg; j++) nrm.setXYZ(i * R + j, 0, sg, 0); return; }
    if ((s.a1 ?? TAU) - (s.a0 ?? 0) < TAU - 1e-3) return;
    t1.fromBufferAttribute(nrm, i * R).add(t2.fromBufferAttribute(nrm, i * R + seg)).normalize();
    nrm.setXYZ(i * R, t1.x, t1.y, t1.z); nrm.setXYZ(i * R + seg, t1.x, t1.y, t1.z);
  });
  g.computeBoundingSphere();
  return g;
}
// The front half-angle at which a superellipse ring (half-width rx, exponent n) is w wide.
export function gapAngle(w, rx, n = N_TORSO) {
  if (w <= 0) return 0;
  return Math.asin(Math.min(1, Math.pow(Math.min(1, w / Math.max(rx, 1e-4)), n / 2)));
}

// ------------------------------------------------------------------ tailoring
// Remove what buildHuman's BDU outfit adds that a suit or slacks must not have.
export function stripBDU(R) {
  for (const L of R.legs) for (const c of [...L.hip.children]) if (c.isMesh && c !== L.thigh.mesh) L.hip.remove(c);
  R.pieces = {
    pelvis: R.pelvis.children.find((c) => c.isMesh),
    spine: R.spine.children.find((c) => c.isMesh),
    chest: R.chest.children.find((c) => c.isMesh),
    collar: R.chest.children.filter((c) => c.isMesh)[1],
  };
  // trousers stop at the waistband (no z-fight with a tucked shirt), a hair proud of it
  R.pelvis.remove(R.pieces.pelvis);
  R.pieces.pelvis = R.piece(R.M.pants, 0.84, 1.075, R.jy.pelvis, R.pelvis, 0.004);
  return R;
}

// Profile rows [y, rx, rz, cz] for a garment: the torso reshaped by shape(yRel) → [kx, kz, dz] and grown.
function garmentProfile(R, grow, shape) {
  return R.T.map(([y, rx, rz, cz]) => { const [kx, kz, dz] = shape ? shape(y / R.H) : [1, 1, 0]; return [y, rx * kx + grow, rz * kz + grow, cz + (dz ?? 0)]; });
}
// Rows of one garment piece between y0 and y1 (absolute), with sliceGeo's rounded ends.
function garmentRows(prof, y0, y1, jointY, arc, o = {}) {
  const ys = new Set([y0, y1]);
  for (const p of prof) if (p[0] > y0 + 1e-4 && p[0] < y1 - 1e-4) ys.add(p[0]);
  for (let y = y0 + 0.02; y < y1 - 0.01; y += 0.02) ys.add(y);
  const rows = [...ys].sort((a, b) => a - b).map((y) => profileAt(prof, y));
  const round = (row, dir) => {
    const rr = Math.min(row[1], row[2]) * (o.roundK ?? 0.6);
    return [0.55, 0.85, 1].map((k) => { const a = (k * Math.PI) / 2; return [row[0] + dir * Math.sin(a) * rr, row[1] * Math.cos(a), row[2] * Math.cos(a), row[3]]; });
  };
  const all = [...(o.openBottom ? [] : round(rows[0], -1).reverse()), ...rows, ...(o.openTop ? [] : round(rows[rows.length - 1], 1))];
  return all.map(([y, rx, rz, cz]) => { const [a0, a1] = arc(y, rx); return { y: y - jointY, rx, rz, cz, a0, a1 }; });
}

// Suit jacket. o: { grow, button (rel. height of the top button), vTop (V half-width at the collar, m),
//   vPow, cut (opening half-width at the hem), hem (rel. height), flare, lapel (angle), lapelMat,
//   shape(yRel) → [kx, kz, dz], buttons: [relY...], buttonMat, pads }
export function jacket(R, m, o = {}) {
  const H = R.H, grow = o.grow ?? 0.016;
  const prof = garmentProfile(R, grow, o.shape);
  const yb = (o.button ?? 1.13) * H, yt = 1.5 * H, yh = (o.hem ?? 0.86) * H;
  const halfW = (y) => (y >= yb ? (o.vTop ?? 0.075) * Math.pow((y - yb) / (yt - yb), o.vPow ?? 0.9) : (o.cut ?? 0.02) * clamp((yb - y) / (yb - yh), 0, 1));
  const arc = (y, rx) => { const g = gapAngle(halfW(y), rx); return [g, TAU - g]; };
  const sideM = m.clone(); sideM.side = THREE.DoubleSide;
  const P = {};
  const add = (part, y0, y1, oo) => { const me = mesh(arcLoftGeo(garmentRows(prof, y0 * H, y1 * H, R.jy[part], arc, oo), { seg: 30, n: N_TORSO }), sideM); R[part].add(me); P[part] = me; return me; };
  add('spine', o.spineFrom ?? 1.0, 1.32);
  add('chest', 1.22, 1.515);
  // lapels: a raised band beside each edge of the V, widest at the notch
  if (o.lapel !== false) {
    const lm = o.lapelMat || m;
    const lw = (y) => (o.lapel ?? 0.42) * Math.min(1, (y - yb) / (0.29 * H)) * (y > 1.43 * H ? lerp(1, 0.45, (y - 1.43 * H) / (0.07 * H)) : 1);
    for (const side of [1, -1]) {
      const rows = [];
      for (let y = yb + 0.004; y <= yt; y += 0.018) {
        const [, rx, rz, cz] = profileAt(prof, y);
        const g = gapAngle(halfW(y), rx), w = Math.max(0.01, lw(y));
        rows.push({ y: y - R.jy.chest, rx: rx + 0.005, rz: rz + 0.005, cz, a0: side > 0 ? g : TAU - g - w, a1: side > 0 ? g + w : TAU - g });
      }
      const lmS = lm.clone(); lmS.side = THREE.DoubleSide;
      R.chest.add(mesh(arcLoftGeo(rows, { seg: 4, n: N_TORSO }), lmS));
    }
  }
  // buttons on the closure
  for (const by of o.buttons ?? [o.button ?? 1.13]) {
    const [, , rz, cz] = profileAt(prof, by * H);
    R.spine.add(mesh(sph(0.0095, 8, 6), o.buttonMat || mat(0x111111, { rough: 0.3 }), 0, by * H - R.jy.spine, cz + rz + 0.003));
  }
  // skirt: hinged panels from the waist to the hem (the front opening widens below the button)
  const top = o.skirtTop ?? 1.02;
  skirtPanels(R, m, { top, len: top - (o.hem ?? 0.86), grow: grow + 0.006, gap: gapAngle(o.cut ?? 0.02, 0.15), flareX: o.flare ?? 0.03, flareZ: (o.flare ?? 0.03) * 0.8, shape: o.shape });
  // cuffs: the shirt shows a finger's width below the sleeve
  if (o.cuffs) for (const A of R.arms) A.el.add(mesh(cyl(0.037, 0.037, 0.022, 10), o.cuffs, 0, -A.L2 + 0.022, 0));
  R.jacket = P;
  return P;
}

// Hinged skirt panels (right front, left front, back) that follow the thighs, as the lab coat's.
export function skirtPanels(R, m, o) {
  const H = R.H;
  const top = o.top * H - R.jy.pelvis, len = o.len * H;
  const P = profileAt(R.T, o.top * H);
  const [kx, kz, dz] = o.shape ? o.shape(o.top) : [1, 1, 0];
  const secs = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, yr = o.top - t * o.len;
    const [kx2, kz2] = o.shape ? o.shape(yr) : [1, 1];
    const k = o.shape ? Math.max(kx, kx2) : 1, kk = o.shape ? Math.max(kz, kz2) : 1;
    secs.push({ y: top - t * len, rx: P[1] * k + o.grow + t * (o.flareX ?? 0.03), rz: P[2] * kk + o.grow + 0.003 + t * (o.flareZ ?? 0.025), cz: P[3] + (dz ?? 0) - t * 0.004 });
  }
  secs.reverse();
  const sideM = m.clone(); sideM.side = THREE.DoubleSide;
  const mk = (a0, a1) => {
    const piv = new THREE.Group(); piv.position.set(0, top, 0);
    piv.add(mesh(loftGeo(secs.map((s) => ({ ...s, y: s.y - top })), { seg: 10, a0, a1, n: N_TORSO, uv: 'metre' }), sideM));
    R.pelvis.add(piv); return piv;
  };
  const g = o.gap ?? 0.06;
  const rf = mk(-Math.PI * 0.56, -g), lf = mk(g, Math.PI * 0.56), bk = mk(Math.PI * 0.45, Math.PI * 1.55);
  R.coat = { rf, lf, bk };
  R.afterFns.push(() => {
    const sw = (i) => { const d = V3(0, -1, 0).applyQuaternion(R.legs[i].hip.quaternion); return Math.atan2(d.z, -d.y); };
    const a0 = sw(0), a1 = sw(1);
    const k = R.coatK ?? 0.85, cap = R.coatCap ?? 1.2;
    rf.rotation.set(-Math.min(cap, Math.max(-0.1, a0)) * k, 0, 0);
    lf.rotation.set(-Math.min(cap, Math.max(-0.1, a1)) * k, 0, 0);
    bk.rotation.set(-Math.min(0.05, a0, a1) * 0.85 + (R.coatFlare ?? 0), 0, 0);
    if (!R.noHemClamp) for (const [pv, dir] of [[bk, 1], [rf, -1], [lf, -1]]) {
      for (let i = 0; i < 30 && R.lowestOf(pv) < -0.002; i++) pv.rotation.x += dir * 0.05;
    }
  });
  return R.coat;
}

// A ribbon lying on the torso's front (angle a) from rel. height yTop down to yBot:
// widths [top, bottom], a pointed tip, an optional sideways drift (loosened ties hang askew).
function ribbonGeo(R, part, yTop, yBot, w0, w1, o = {}) {
  const pos = [], idx = [];
  const N = 14, lift = o.lift ?? 0.004;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = lerp(yTop, yBot, t);
    const s = R.surf(y, (o.a ?? 0) + (o.drift ?? 0) * t * t, part, o.grow ?? 0);
    const w = lerp(w0, w1, t) / 2;
    const tan = V3(s.n.z, 0, -s.n.x).normalize();
    const c = s.p.clone().addScaledVector(s.n, lift + (o.bulge ?? 0) * Math.sin(t * Math.PI));
    for (const k of [-1, 1]) { const p = c.clone().addScaledVector(tan, k * w); pos.push(p.x, p.y, p.z); }
  }
  // tip
  const last = R.surf(lerp(yTop, yBot, 1) - (o.tip ?? 0.035) / R.H, (o.a ?? 0) + (o.drift ?? 0), part, o.grow ?? 0);
  const tp = last.p.clone().addScaledVector(last.n, lift);
  pos.push(tp.x, tp.y, tp.z);
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  idx.push(N * 2, N * 2 + 2, N * 2 + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Necktie: knot under the collar (knotY rel.), the blade down the shirt front to tipY.
// o: { w0, w1, drift (radians round the torso at the tip), knotTilt, grow, pattern }
export function necktie(R, m, o = {}) {
  const H = R.H, ky = o.knotY ?? 1.5, ty = o.tipY ?? 1.06;
  const sideM = m.clone(); sideM.side = THREE.DoubleSide;
  const blade = mesh(ribbonGeo(R, 'chest', ky - 0.012, ty, o.w0 ?? 0.026, o.w1 ?? 0.034, { drift: o.drift ?? 0, grow: o.grow ?? 0, lift: 0.006, bulge: o.bulge ?? 0.004, tip: o.tip }), sideM);
  R.chest.add(blade);
  const s = R.surf(ky, 0, 'chest', o.grow ?? 0);
  const knot = mesh(rboxGeo(o.knotW ?? 0.03, 0.026, 0.02, 0.006), m, s.p.x, s.p.y, s.p.z + 0.006, -0.25, 0, o.knotTilt ?? 0);
  R.chest.add(knot);
  return { blade, knot };
}

// Lanyard round the neck with an ID card on the chest.
export function lanyard(R, o = {}) {
  const H = R.H;
  const strap = mat(o.color ?? 0x1f4fb8, { rough: 0.7 });
  const cy = o.cardY ?? 1.27, ca = o.cardA ?? 0.18;
  const card = R.surf(cy, ca, 'chest', o.grow ?? 0);
  for (const sd of [-1, 1]) {
    const nk = R.surf(1.5, sd * 1.15, 'chest', 0.01);
    const mid = R.surf(lerp(1.5, cy, 0.5), ca * 0.5 + sd * 0.42, 'chest', (o.grow ?? 0) + 0.006);
    const end = card.p.clone().add(V3(sd * 0.012, 0.045, 0)).addScaledVector(card.n, 0.008);
    R.chest.add(mesh(tubeGeo([nk.p.clone().add(V3(0, 0.01, -0.02)), nk.p.clone().addScaledVector(nk.n, 0.006), mid.p.clone().addScaledVector(mid.n, 0.008), end], 0.0045, 14, 4), strap));
  }
  // the card: white with a blue band and a photo square, on a clear sleeve
  const tex = canvasTex('idcard:' + (o.band ?? '#1f4fb8'), 32, 48, (g, w, h) => {
    g.fillStyle = '#9fb4cc'; g.fillRect(0, 0, w, h);
    g.fillStyle = o.band ?? '#1f4fb8'; g.fillRect(0, 0, w, 16);
    g.fillStyle = '#f4f0e6'; g.fillRect(3, 19, 14, 17);
    g.fillStyle = '#8a6a58'; g.fillRect(6, 22, 8, 12);
    g.fillStyle = '#20242a'; for (let i = 0; i < 3; i++) g.fillRect(19, 20 + i * 5, 10, 2);
    g.fillRect(3, 39, 26, 3); g.fillRect(3, 44, 18, 2);
  });
  const c = new THREE.Group();
  c.add(mesh(rboxGeo(0.064, 0.09, 0.004, 0.0015), mat(0x2a2e34, { rough: 0.4 })));
  c.add(mesh(new THREE.PlaneGeometry(0.056, 0.08), mat(0xffffff, { rough: 0.35, map: tex }), 0, 0, 0.0022));
  c.add(mesh(rboxGeo(0.016, 0.012, 0.006, 0.002), mat(0x1a1a1c, { rough: 0.4 }), 0, 0.048, 0.001));
  c.position.copy(card.p).addScaledVector(card.n, 0.009);
  c.rotation.set(0.06, card.ry, o.tilt ?? 0.05, 'YXZ');
  R.chest.add(c);
  R.badge = c;
  return c;
}

// Trouser hems that break over the shoes (and flare for the woman's wide-leg trousers).
export function slacks(R, m, o = {}) {
  const sideM = m.clone(); sideM.side = THREE.DoubleSide;
  for (const L of R.legs) {
    const y0 = -L.L2 + (o.from ?? 0.2), y1 = -L.L2 + (o.to ?? 0.0);
    const r0 = (o.r0 ?? 0.05), r1 = o.r1 ?? 0.058;
    L.knee.add(mesh(loftGeo([{ y: y1, rx: r1, rz: r1 * 1.06, cz: 0.012 }, { y: lerp(y0, y1, 0.5), rx: lerp(r0, r1, 0.45), rz: lerp(r0, r1, 0.45), cz: 0.005 }, { y: y0, rx: r0, rz: r0, cz: 0 }], { seg: 14 }), sideM));
  }
}

// ------------------------------------------------------------------ heads: hair, glasses, earpiece
// Head profile radii at height y (head space).
function headAt(y) {
  const P = HEAD;
  if (y <= P[0][0]) return [0, 0, P[0][3]];
  for (let i = 1; i < P.length; i++) if (y <= P[i][0]) { const a = P[i - 1], b = P[i], t = (y - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
  return [0, 0, P[P.length - 1][3]];
}
const hexRGB = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export function hairTex(color, seed = 1) {
  const c = hexRGB(color);
  return pixTex('hair:' + color + ':' + seed, 64, (u, v, i, j) => {
    const k = 0.72 + 0.42 * fbm(u * 24, v * 2, 24, 3, seed) + 0.08 * (hash(i, j, seed) - 0.5);
    return c.map((x) => Math.min(255, x * k));
  }, [14, 14]);
}
// rows [y, rx, rz, cz, gap, jag?] in head space → a double-sided hair shell
export function hairShell(rows, color, o = {}) {
  const m = mat(0xffffff, { rough: o.rough ?? 0.8, map: hairTex(color, o.seed ?? 3), side: THREE.DoubleSide });
  return mesh(arcLoftGeo(rows.map(([y, rx, rz, cz, g, jag]) => ({ y, rx, rz, cz, a0: g, a1: TAU - g, jag })), { seg: 36, n: 2.15 }), m);
}
// spec rows [y, grow, gap] following the head's own profile (top pole added)
export function headHair(spec, color, o = {}) {
  const rows = [];
  const top = spec[0];
  rows.push([HEAD[HEAD.length - 1][0] + top[1], 0, 0, -0.013, 0]);
  for (const [y, gr, gap] of spec) { const [rx, rz, cz] = headAt(y); rows.push([y, rx + gr, rz + gr, cz - gr * 0.25, gap]); }
  rows.reverse();
  return hairShell(rows, color, o);
}

// Wraparound sunglasses with glossy dark lenses and a glint on the right lens.
export function sunglasses() {
  const g = new THREE.Group();
  const frame = mat(0x0c0c0e, { rough: 0.3, metal: 0.5 });
  const lens = mat(0x06070a, { rough: 0.06, metal: 0.7, env: true, envI: 1.4 });
  for (const sd of [-1, 1]) {
    g.add(mesh(ellipsoidGeo(0.024, 0.017, 0.007, 16, 8), lens, sd * 0.035, 0.058, 0.104, 0.05, sd * 0.24, sd * -0.05));
    g.add(mesh(new THREE.BoxGeometry(0.005, 0.006, 0.105), frame, sd * 0.083, 0.064, 0.05, 0, sd * 0.05, 0));
  }
  g.add(mesh(new THREE.BoxGeometry(0.104, 0.007, 0.008), frame, 0, 0.074, 0.103));
  g.add(mesh(new THREE.BoxGeometry(0.014, 0.006, 0.008), frame, 0, 0.062, 0.112));
  // the glint: a hot spot on the right lens with a short diagonal flare (a pixel or two at sprite scale)
  const glint = new THREE.Group();
  glint.add(mesh(sph(0.0105, 8, 6), glow(0xffffff, 1.4)));
  glint.add(mesh(new THREE.BoxGeometry(0.036, 0.0075, 0.002), glow(0xf4f8ff, 1.2), 0, 0, 0.003, 0, 0, 0.6));
  glint.position.set(-0.041, 0.064, 0.112);
  g.add(glint); g.glint = glint;
  return g;
}
// Earpiece in the left ear, its coiled lead running down behind the jaw into the collar.
export function earpiece() {
  const g = new THREE.Group();
  const m = mat(0xcfc8b8, { rough: 0.35 });
  g.add(mesh(sph(0.0095, 8, 6), m, 0.087, 0.034, 0.006));
  g.add(mesh(tubeGeo([[0.089, 0.03, -0.002], [0.09, 0.0, -0.02], [0.082, -0.045, -0.038], [0.07, -0.095, -0.05], [0.064, -0.135, -0.05]], 0.004, 18, 5), m));
  return g;
}

// The agent's suppressed pistol: the guard pistol in black with a can; a small flash.
export function silencedPistol() {
  const g = pistol({ color: 0x18191c });
  const can = mat(0x2a2b2f, { rough: 0.4, metal: 0.6, env: true, envI: 0.5 });
  g.add(mesh(cyl(0.0175, 0.0175, 0.16, 14), can, 0, 0.028, 0.255, Math.PI / 2, 0, 0));
  g.add(mesh(cyl(0.015, 0.015, 0.006, 14), mat(0x0a0a0a, { rough: 0.6 }), 0, 0.028, 0.336, Math.PI / 2, 0, 0));
  g.nodes.muzzle.position.set(0, 0.028, 0.34);
  g.flash.position.copy(g.nodes.muzzle.position);
  g.flash.scale.setScalar(0.5);
  return g;
}

// ------------------------------------------------------------------ faces
const toPxF = (W, Hh, x, y) => {
  const Y0 = HEAD[0][0], Y1 = HEAD[HEAD.length - 1][0];
  const rx = Math.max(0.01, headAt(y)[0]);
  const a = Math.asin(clamp(x / rx, -1, 1));
  return [(0.5 + a / TAU) * W, (1 - (y - Y0) / (Y1 - Y0)) * Hh];
};
// faceTexture plus make-up (lipstick, liner, blush) or a smile.
export function faceTex2(f) {
  const base = faceTexture(f);
  if (!f.lips && !f.liner && !f.smile) return base;
  return canvasTex('face2:' + JSON.stringify(f), 256, 128, (g, W, Hh) => {
    g.drawImage(base.image, 0, 0);
    const P = (x, y) => toPxF(W, Hh, x, y);
    const ell = (x, y, rxm, rym, style, fill = true, lw = 2) => {
      const [cx, cy] = P(x, y), [ex] = P(x + rxm, y), [, ey] = P(x, y + rym);
      g.beginPath(); g.ellipse(cx, cy, Math.abs(ex - cx), Math.abs(cy - ey), 0, 0, TAU);
      if (fill) { g.fillStyle = style; g.fill(); } else { g.lineWidth = lw; g.strokeStyle = style; g.stroke(); }
    };
    const mouthY = -0.03;
    if (f.blush) for (const s of [-1, 1]) { g.globalAlpha = 0.18; ell(s * 0.045, 0.02, 0.02, 0.014, f.blush); g.globalAlpha = 1; }
    if (f.lips) {
      if (f.mouth === 'open') ell(0, mouthY, 0.0165, 0.0105, f.lips, false, 3);
      else { ell(0, mouthY + 0.002, 0.016, 0.0045, f.lips); ell(0, mouthY - 0.004, 0.014, 0.004, f.lips); }
    }
    if (f.liner && f.eyes !== 'closed') for (const s of [-1, 1]) {
      const x = s * 0.032, ey = 0.058;
      g.beginPath(); [[x - 0.015, ey + 0.003], [x, ey + 0.008], [x + 0.015, ey + 0.004]].forEach(([px, py], i) => { const [X, Y] = P(px, py); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.lineWidth = 2.4; g.strokeStyle = f.liner; g.stroke();
    }
    if (f.smile) {
      g.beginPath(); [[-0.018, mouthY + 0.004], [0, mouthY - 0.004], [0.018, mouthY + 0.004]].forEach(([px, py], i) => { const [X, Y] = P(px, py); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.lineWidth = 2.4; g.strokeStyle = f.lips || '#7a3c34'; g.stroke();
    }
  });
}
// Re-route a head's setFace through faceTex2 (keeps make-up on every expression).
function makeupFace(R, skin, face) {
  const sk = R.headMesh.skull;
  const baseM = mat(0xffffff, { rough: 0.7, map: faceTex2({ skin, ...face }) });
  sk.material = baseM;
  R.headMesh.setFace = (patch) => { sk.material = patch ? mat(0xffffff, { rough: 0.7, map: faceTex2({ skin, ...face, ...patch }) }) : baseM; };
}

// ------------------------------------------------------------------ the cast
// MIBK: black suit, white shirt, thin black tie, sunglasses, earpiece.
export function buildMIB() {
  const suit = mat(0x1b1c21, { rough: 0.74, map: camo('weave', 0.18) });
  const shirt = mat(0xf6f6f2, { rough: 0.65, map: camo('weave', 0.25) });
  const skin = 0xd2a283;
  const face = { eyes: 'human', iris: '#2a2018', hair: 0x15110e, hairStyle: 'short', brow: 0x15110e, browW: 3.6, stubble: 0.12, mouth: 'grim' };
  const R = buildHuman({
    outfit: 'bdu-black', noChestPockets: true, belt: false, boots: false, girth: 1.0, wide: 1.05, skin,
    mats: { shirt, pants: suit, sleeve: suit, fore: suit, collar: shirt, boot: mat(0x09090b, { rough: 0.2 }), sole: mat(0x050505, { rough: 0.9 }) },
    face,
  });
  stripBDU(R);
  R.M.suit = suit; R.M.shirtW = shirt;
  necktie(R, mat(0x0b0b0d, { rough: 0.45 }), { knotY: 1.5, tipY: 1.07, w0: 0.024, w1: 0.03, knotW: 0.024 });
  jacket(R, suit, { button: 1.13, vTop: 0.072, hem: 0.83, cut: 0.03, flare: 0.025, lapel: 0.4, lapelMat: mat(0x2a2b31, { rough: 0.45 }), cuffs: shirt });
  slacks(R, suit, { r0: 0.05, r1: 0.056, from: 0.18 });
  // neat short hair, a side part
  R.headMesh.add(headHair([[0.176, 0.011, 0], [0.16, 0.011, 0], [0.14, 0.01, 0.0], [0.125, 0.008, 0.38], [0.108, 0.006, 0.92], [0.085, 0.005, 1.22], [0.05, 0.004, 1.78], [0.012, 0.004, 2.0], [-0.03, 0.002, 2.2]], 0x15110e, { rough: 0.55, seed: 5 }));
  R.glasses = sunglasses(); R.headMesh.add(R.glasses);
  R.headMesh.add(earpiece());
  return R;
}

// OFC1: white shirt, rolled sleeves, loosened tie, grey slacks, lanyard badge, curtains.
export function buildOfficeMan() {
  const shirt = mat(0xf0efe8, { rough: 0.8, map: camo('weave', 0.22) });
  const slack = mat(0x707378, { rough: 0.8, map: camo('weave', 0.2) });
  const skin = 0xd9a98a;
  const hair = 0x4a3020;
  const R = buildHuman({
    outfit: 'bdu-black', noChestPockets: true, belt: false, boots: false, girth: 1.06, sleeves: 'rolled', skin,
    mats: { shirt, pants: slack, sleeve: shirt, fore: shirt, collar: shirt, boot: mat(0x3a2416, { rough: 0.35 }), sole: mat(0x1a120c, { rough: 0.9 }) },
    face: { eyes: 'human', iris: '#4a3a28', hair, hairStyle: 'short', brow: 0x3a2618, stubble: 0.3, mouth: 'line' },
  });
  stripBDU(R);
  // open collar: the default collar turned so its gap is at the throat, a skin V below it
  R.pieces.collar.rotation.y = Math.PI;
  R.pieces.collar.scale.set(1.08, 1, 1.1);
  const v = R.surf(1.47, 0, 'chest');
  const vn = mesh(new THREE.ConeGeometry(0.03, 0.075, 3), R.M.skin, 0, v.p.y + 0.01, v.p.z - 0.004, 0, 0, Math.PI);
  vn.scale.set(1, 1, 0.35); R.chest.add(vn);
  // collar points spread over the shoulders of the V
  for (const s of [-1, 1]) R.chest.add(mesh(rboxGeo(0.04, 0.05, 0.006, 0.002), shirt, s * 0.04, v.p.y + 0.04, v.p.z - 0.01, -0.5, s * 0.5, s * 0.6));
  // a loud 90s tie, the knot pulled down and skewed
  const tieTex = canvasTex('tie90s', 16, 64, (g, w, h) => {
    g.fillStyle = '#21408c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2c58b8'; g.lineWidth = 3;
    for (let i = -4; i < 12; i++) { g.beginPath(); g.moveTo(0, i * 8); g.lineTo(w, i * 8 + 10); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#d8b040' : '#b02a30'; g.fillRect((i * 5) % 12, i * 8 + 3, 2, 2); }
  }, [12, 6]);
  necktie(R, mat(0xffffff, { rough: 0.55, map: tieTex }), { knotY: 1.43, tipY: 1.07, w0: 0.04, w1: 0.072, knotW: 0.04, drift: 0.12, knotTilt: 0.2, bulge: 0.012, tip: 0.05 });
  // rolled sleeves: a fat cuff below the elbow
  for (const A of R.arms) A.el.add(mesh(cyl(0.056, 0.058, 0.055, 12), shirt, 0, -0.035, 0));
  // breast pocket with a pen, the belt, the lanyard
  R.stick(1.33, 0.6, [0.085, 0.09, 0.008], shirt, 'chest', { r: 0.003 });
  const pp = R.surf(1.375, 0.6, 'chest');
  R.chest.add(mesh(cyl(0.005, 0.005, 0.05, 6), mat(0x1a1a1a, { rough: 0.4 }), pp.p.x - 0.015, pp.p.y, pp.p.z + 0.012));
  webBelt(R, 0x24180f, 0xc8c4b4, 1.035, 1.072);
  lanyard(R, { color: 0xb8242a, band: '#b8242a', cardY: 1.26, cardA: -0.34, tilt: -0.1 });
  slacks(R, slack, { r0: 0.052, r1: 0.058, from: 0.18 });
  // curtains: parted in the middle, falling either side of the forehead
  R.headMesh.add(headHair([[0.176, 0.026, 0], [0.165, 0.025, 0.05], [0.148, 0.023, 0.09], [0.13, 0.02, 0.16], [0.112, 0.016, 0.28], [0.097, 0.012, 0.55], [0.083, 0.01, 1.0], [0.062, 0.008, 1.32], [0.03, 0.006, 1.78], [-0.005, 0.005, 2.0], [-0.04, 0.003, 2.2]], hair, { seed: 7 }));
  return R;
}

// OFC2: navy pantsuit with shoulder pads, ivory blouse, low heels, shoulder-length 90s hair.
export function buildOfficeWoman() {
  const navy = mat(0x243256, { rough: 0.7, map: camo('weave', 0.18) });
  const blouse = mat(0xf3ead6, { rough: 0.5, map: camo('weave', 0.3) });
  const skin = 0xeec6ab;
  const hair = 0xa8834e;
  const face = { eyes: 'human', iris: '#3d5a3a', hair, hairStyle: 'short', brow: 0x6a4a2c, browW: 2.4, mouth: 'line', lips: '#a8282e', liner: '#2a1a14', blush: '#d05050' };
  const R = buildHuman({
    outfit: 'bdu-black', noChestPockets: true, belt: false, boots: false, h: 0.94, girth: 0.88, wide: 0.9, skin, handS: 0.88, headS: 0.95,
    mats: { shirt: blouse, pants: navy, sleeve: navy, fore: navy, collar: blouse, boot: mat(0x14182a, { rough: 0.3 }), sole: mat(0x0a0a0a, { rough: 0.9 }) },
    face,
  });
  stripBDU(R);
  makeupFace(R, skin, face);
  // wider hips
  for (const L of R.legs) { L.hip.position.x *= 1.14; L.hx *= 1.14; }
  // jacket: nipped waist, flared at the hips, one gold button low on the waist
  const shape = (y) => {
    const hip = Math.exp(-Math.pow((y - 0.95) / 0.08, 2)), waist = Math.exp(-Math.pow((y - 1.09) / 0.06, 2)), bust = Math.exp(-Math.pow((y - 1.33) / 0.07, 2));
    return [1 + 0.2 * hip - 0.04 * waist, 1 + 0.12 * hip - 0.03 * waist + 0.12 * bust, 0.01 * bust];
  };
  jacket(R, navy, { grow: 0.017, button: 1.06, vTop: 0.068, vPow: 0.8, hem: 0.8, cut: 0.035, flare: 0.04, lapel: 0.46, shape, skirtTop: 1.03, buttons: [1.06], buttonMat: mat(0xd0a840, { rough: 0.25, metal: 0.9, env: true }), lapelMat: mat(0x2a3961, { rough: 0.55 }) });
  // shoulder pads: squared shoulders sitting on the jacket
  for (const A of R.arms) {
    const p = A.sh.position;
    R.chest.add(mesh(ellipsoidGeo(0.072, 0.032, 0.075, 12, 6), navy, p.x * 1.02, p.y + 0.04, p.z - 0.004, 0, 0, A.side * 0.12));
  }
  // the blouse collar out over the lapels
  const v = R.surf(1.47, 0, 'chest');
  for (const s of [-1, 1]) R.chest.add(mesh(rboxGeo(0.05, 0.055, 0.006, 0.002), blouse, s * 0.05, v.p.y - 0.0, v.p.z + 0.012, -0.45, s * 0.55, s * 0.75));
  slacks(R, navy, { r0: 0.052, r1: 0.066, from: 0.24 });
  // low pumps: the shoe tipped toe-down on a short heel
  for (const L of R.legs) {
    for (const c of [...L.ankle.children]) L.ankle.remove(c);
    const g = new THREE.Group();
    const sh = shoe(mat(0x14182a, { rough: 0.25 }), { h: 0.055, heel: 0.05, toe: 0.17, w: 0.042, sole: mat(0x0a0a0a, { rough: 0.9 }) });
    sh.rotation.x = 0.2; sh.position.set(0, -0.019, 0.008); g.add(sh);
    g.add(mesh(rboxGeo(0.024, 0.04, 0.024, 0.004), mat(0x0e0e10, { rough: 0.4 }), 0, -0.06, -0.035));
    L.ankle.add(g);
  }
  // shoulder-length 90s hair: volume on top, swept bangs, flipped ends
  R.headMesh.add(hairShell([
    [0.208, 0, 0, -0.016, 0], [0.202, 0.04, 0.05, -0.016, 0], [0.19, 0.066, 0.084, -0.014, 0], [0.17, 0.083, 0.104, -0.01, 0],
    [0.145, 0.091, 0.113, -0.006, 0.1], [0.12, 0.093, 0.115, -0.004, 0.3], [0.098, 0.092, 0.111, -0.006, 0.72], [0.07, 0.089, 0.105, -0.01, 1.05],
    [0.035, 0.088, 0.099, -0.016, 1.15], [0.0, 0.091, 0.094, -0.022, 1.2], [-0.035, 0.098, 0.09, -0.028, 1.24], [-0.07, 0.11, 0.089, -0.034, 1.28],
    [-0.098, 0.124, 0.093, -0.038, 1.32], [-0.112, 0.134, 0.097, -0.036, 1.38, 0.006], [-0.106, 0.129, 0.092, -0.03, 1.43, 0.012],
  ], hair, { seed: 9 }));
  // earrings
  for (const s of [-1, 1]) R.headMesh.add(mesh(sph(0.0075, 8, 6), mat(0xd8b048, { rough: 0.2, metal: 0.9, env: true }), s * 0.078, 0.0, 0.004));
  return R;
}
