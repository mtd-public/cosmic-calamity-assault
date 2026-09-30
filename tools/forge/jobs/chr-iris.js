// IRIS: the AI's avatar on Marsh's wrist unit, 64x64 frames in mod/graphics/iris/.
// A green-phosphor wireframe face on a small CRT: a low-poly egg of rings and
// meridians (back edges culled), almond eye outlines with square pupils, a mouth of
// lines, drawn at 4x, reduced, then bloomed, scanlined and flickered at 64 px.
//   IRISI0-3 idle, IRIST0-3 talk, IRISL0 / IRISR0 glance, IRISA0-1 alarm, IRISG0-2 glitch
import { mulberry32 } from '../lib/chr/core.js';

const S = 64, SS = 4, W = S * SS;

// head surface: width/depth profile over y in [-1, 1] (chin to crown)
const aY = (y) => 0.66 * Math.sqrt(Math.max(0, 1 - y * y)) * (y < 0 ? 1 + 0.3 * y : 1 - 0.05 * y);
const bY = (y) => 0.78 * Math.sqrt(Math.max(0, 1 - y * y)) * (y < 0 ? 1 + 0.12 * y : 1);
const surf = (th, y, out = 0) => [(aY(y) + out) * Math.sin(th), y, (bY(y) + out) * Math.cos(th)];

function frameState(name) {
  const st = { yaw: 0, pitch: 0, roll: 0, bob: 0, eyes: 1, pupil: 0, mouth: 0.08, mouthW: 1, brow: 0, bright: 1, color: [120, 255, 150], dim: [40, 150, 70], glitch: 0, seed: 1, roll2: 0 };
  const I = { IRISI0: {}, IRISI1: { bob: 0.5, bright: 1.08, pitch: 0.03 }, IRISI2: { eyes: 0.05, bright: 0.95 }, IRISI3: { bob: -0.5, bright: 0.9, roll2: 3, yaw: 0.04 } };
  const T = { IRIST0: { mouth: 0.1, eyes: 0.95 }, IRIST1: { mouth: 0.45, mouthW: 0.9, brow: 0.3, bright: 1.05 }, IRIST2: { mouth: 0.75, mouthW: 1.05, eyes: 0.85, brow: 0.5 }, IRIST3: { mouth: 0.3, mouthW: 0.6, eyes: 1, bright: 1.03, yaw: -0.03 } };
  const X = {
    IRISL0: { yaw: -0.42, pupil: -1, bright: 1 }, IRISR0: { yaw: 0.42, pupil: 1, bright: 1 },
    IRISA0: { color: [255, 96, 80], dim: [150, 40, 34], eyes: 1.35, mouth: 0.04, mouthW: 0.8, brow: -0.6, bright: 1.1 },
    IRISA1: { color: [255, 150, 120], dim: [190, 60, 50], eyes: 1.4, mouth: 0.25, mouthW: 0.7, brow: -0.7, bright: 1.35, bob: -0.4 },
    IRISG0: { glitch: 1, seed: 3, yaw: 0.08, bright: 1.1 }, IRISG1: { glitch: 2, seed: 7, roll: 0.06, eyes: 0.4, bright: 0.9 }, IRISG2: { glitch: 3, seed: 11, yaw: -0.12, mouth: 0.5, bright: 1.2 },
  };
  return { ...st, ...(I[name] || T[name] || X[name]) };
}

function project(p, st) {
  let [x, y, z] = p;
  // yaw, pitch, roll
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const cr = Math.cos(st.roll), sr = Math.sin(st.roll);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  const f = 5, k = f / (f - z);
  const sc = W * 0.36;
  return [W / 2 + x * k * sc, W * 0.47 - (y * k * sc) + st.bob * SS, z];
}
// facing test for an edge from its surface normal (approximated by the position's direction)
function facing(p, st) { const q = project([p[0] * 1.001, p[1] * 1.001, p[2] * 1.001], st); return q[2]; }

function drawFace(g, st) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
  const col = (a) => `rgba(${st.color[0]},${st.color[1]},${st.color[2]},${a})`;
  const dcol = (a) => `rgba(${st.dim[0]},${st.dim[1]},${st.dim[2]},${a})`;
  const line = (pts, width, style) => {
    g.beginPath();
    pts.forEach((p, i) => { const q = project(p, st); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    g.lineWidth = width; g.strokeStyle = style; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  };
  // wireframe shell: segments drawn only where they face the viewer, fading toward the silhouette
  const seg = (a, b, w, bright) => {
    const za = facing(a, st), zb = facing(b, st);
    const z = (za + zb) / 2;
    if (z < -0.05) return;
    const k = Math.min(1, 0.25 + z * 1.1);
    line([a, b], w, k > 0.7 ? col(k * bright) : dcol(Math.min(1, 0.4 + k) * bright));
  };
  const rings = [-0.82, -0.58, -0.3, -0.02, 0.28, 0.56, 0.8];
  const N = 20;
  for (const y of rings) for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
    seg(surf(t0, y), surf(t1, y), 2.2, 0.75);
  }
  for (let m = 0; m < 12; m++) {
    const th = (m / 12) * Math.PI * 2;
    for (let j = 0; j < 16; j++) { const y0 = -0.96 + j * 0.12, y1 = y0 + 0.12; if (y1 > 0.97) break; seg(surf(th, y0), surf(th, y1), 1.8, 0.55); }
  }
  // silhouette: the outline at the current yaw
  const sil = [];
  for (let j = 0; j <= 40; j++) { const y = -0.98 + j * 0.049; sil.push(surf(Math.PI / 2 - st.yaw, y, 0.005)); }
  line(sil, 3, col(0.9));
  const silL = sil.map(([x, y, z]) => [-x, y, z]);
  const sil2 = []; for (let j = 0; j <= 40; j++) { const y = -0.98 + j * 0.049; sil2.push(surf(-Math.PI / 2 - st.yaw, y, 0.005)); }
  line(sil2, 3, col(0.9)); void silL;
  // centre line down the face (uncanny, like a seam)
  const cl = []; for (let j = 0; j <= 18; j++) { const y = -0.8 + j * 0.09; cl.push(surf(0, y, 0.01)); }
  line(cl, 1.6, dcol(0.8));
  // eyes: almond outlines, square pupils; brows as flat bars
  const EY = 0.14, EO = 0.34, EW = 0.2, EH = 0.075 * st.eyes;
  for (const s of [-1, 1]) {
    const th = s * EO;
    const top = [], bot = [];
    for (let j = 0; j <= 10; j++) { const t = j / 10, dth = (t - 0.5) * 2 * EW, h = Math.sin(t * Math.PI) * EH; top.push(surf(th + dth, EY + h, 0.02)); bot.push(surf(th + dth, EY - h * 0.8, 0.02)); }
    line(top, 3.4, col(1)); line(bot, 3.4, col(1));
    if (st.eyes > 0.2) {
      const px = th + st.pupil * EW * 0.45, ps = 0.045 * Math.min(1, st.eyes);
      const q = [surf(px - ps, EY + ps, 0.03), surf(px + ps, EY + ps, 0.03), surf(px + ps, EY - ps, 0.03), surf(px - ps, EY - ps, 0.03), surf(px - ps, EY + ps, 0.03)];
      g.beginPath(); q.forEach((p, i) => { const r = project(p, st); i ? g.lineTo(r[0], r[1]) : g.moveTo(r[0], r[1]); }); g.fillStyle = col(1); g.fill();
    }
    const by = EY + 0.16 + st.brow * 0.03;
    line([surf(th - EW * 0.9, by - s * 0 + (st.brow < 0 ? -0.02 : 0), 0.02), surf(th + EW * 0.9, by + (st.brow < 0 ? s * -0.04 : 0), 0.02)], 3, col(0.85));
  }
  // nose: a thin wedge
  line([surf(0.0, 0.05, 0.03), surf(0.0, -0.2, 0.08), surf(0.07, -0.25, 0.04)], 2, dcol(0.95));
  line([surf(-0.07, -0.25, 0.04), surf(0.0, -0.2, 0.08)], 2, dcol(0.95));
  // mouth: upper and lower bars that part when she talks
  const MY = -0.46, MW = 0.26 * st.mouthW, open = st.mouth * 0.26;
  const up = [], lo = [];
  for (let j = 0; j <= 8; j++) { const t = j / 8, th = (t - 0.5) * 2 * MW, h = Math.sin(t * Math.PI); up.push(surf(th, MY + open * 0.35 * h, 0.03)); lo.push(surf(th, MY - open * h, 0.03)); }
  line(up, 3, col(1)); line(lo, 3, col(open > 0.02 ? 1 : 0.5));
  if (open > 0.05) for (let j = 1; j < 4; j++) { const th = (j / 4 - 0.5) * 2 * MW * 0.8; line([surf(th, MY + open * 0.3, 0.03), surf(th, MY - open * 0.85, 0.03)], 1.5, dcol(0.7)); }
  // neck and collar
  line([[-0.26, -0.78, 0.25], [-0.3, -1.3, 0.2]], 2.2, dcol(0.8));
  line([[0.26, -0.78, 0.25], [0.3, -1.3, 0.2]], 2.2, dcol(0.8));
  line([[-0.95, -1.35, 0.1], [-0.3, -1.22, 0.3], [0, -1.3, 0.35], [0.3, -1.22, 0.3], [0.95, -1.35, 0.1]], 2.4, col(0.7));
}

function postFX(src, st, name) {
  // reduce 4x → 64 with box filter
  const out = new Float32Array(S * S * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const o = ((y * SS + j) * W + x * SS + i) * 4; r += src[o]; g += src[o + 1]; b += src[o + 2]; }
    const o = (y * S + x) * 3, n = SS * SS;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  // phosphor curve: lift faint lines so they read at this size
  for (let i = 0; i < out.length; i++) out[i] = 255 * Math.pow(out[i] / 255, 0.7);
  // bloom: blurred copy added back
  const blur = (a, rad) => {
    const t = new Float32Array(a.length), u = new Float32Array(a.length);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) { let s = 0, n = 0; for (let k = -rad; k <= rad; k++) { const X = x + k; if (X < 0 || X >= S) continue; s += a[(y * S + X) * 3 + c]; n++; } t[(y * S + x) * 3 + c] = s / n; }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) { let s = 0, n = 0; for (let k = -rad; k <= rad; k++) { const Y = y + k; if (Y < 0 || Y >= S) continue; s += t[(Y * S + x) * 3 + c]; n++; } u[(y * S + x) * 3 + c] = s / n; }
    return u;
  };
  const b1 = blur(out, 2), b2 = blur(out, 5);
  const rnd = mulberry32(st.seed * 97 + name.length);
  const img = new Uint8ClampedArray(S * S * 4);
  // glitch: torn row bands shifted sideways, a colour-split band, a dropout band
  const shift = new Int32Array(S);
  if (st.glitch) {
    for (let k = 0; k < 2 + st.glitch * 2; k++) { const y0 = Math.floor(rnd() * S), h = 2 + Math.floor(rnd() * (4 + st.glitch * 3)), dx = Math.round((rnd() - 0.5) * (8 + st.glitch * 8)); for (let y = y0; y < Math.min(S, y0 + h); y++) shift[y] = dx; }
  }
  const splitY0 = st.glitch ? Math.floor(rnd() * 40) : -1, splitH = 6 + st.glitch * 5;
  const dropY = st.glitch >= 2 ? Math.floor(rnd() * 50) : -1;
  const bg = st.color[0] > 200 ? [12, 3, 2] : [2, 10, 5];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = Math.min(S - 1, Math.max(0, x - shift[y]));
    const o = (y * S + sx) * 3;
    let r = out[o] + b1[o] * 0.55 + b2[o] * 0.35, g = out[o + 1] + b1[o + 1] * 0.55 + b2[o + 1] * 0.35, b = out[o + 2] + b1[o + 2] * 0.55 + b2[o + 2] * 0.35;
    if (y >= splitY0 && y < splitY0 + splitH) { // chroma split: red channel from 3 px left
      const o2 = (y * S + Math.max(0, sx - 3)) * 3; r = out[o2 + 1] * 0.9 + b1[o2 + 1] * 0.4; b = out[o + 1] * 0.8; g *= 0.6;
    }
    // faint grid on the glass
    if ((x % 8 === 0 || y % 8 === 0) && !st.glitch) { r += bg[0] * 1.5; g += bg[1] * 2 + 4; b += bg[2] * 1.5; }
    r += bg[0]; g += bg[1]; b += bg[2];
    // scanlines, rolling band, flicker
    const scan = (y + (st.roll2 || 0)) % 2 === 0 ? 1 : 0.55;
    const band = 1 + 0.12 * Math.exp(-(((y - (st.roll2 * 7 + 20) % S) / 5) ** 2));
    let k = scan * band * st.bright;
    if (y >= dropY && y < dropY + 3) k *= 0.15;
    if (st.glitch) k *= 0.9 + rnd() * 0.25;
    // screen vignette with rounded corners
    const dx = (x - 31.5) / 32, dy = (y - 31.5) / 32, d = Math.pow(Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dy), 4), 0.25);
    const vig = d > 0.99 ? 0 : 1 - 0.35 * Math.pow(d, 3);
    k *= vig;
    const q = (y * S + x) * 4;
    img[q] = r * k; img[q + 1] = g * k; img[q + 2] = b * k; img[q + 3] = 255;
    if (st.glitch && rnd() < 0.004 * st.glitch) { img[q] = 180; img[q + 1] = 255; img[q + 2] = 200; } // static
  }
  return { w: S, h: S, data: img };
}

export default async function (F, params = {}) {
  if (params.only && !params.only.split(',').includes('IRIS')) return;
  const names = ['IRISI0', 'IRISI1', 'IRISI2', 'IRISI3', 'IRIST0', 'IRIST1', 'IRIST2', 'IRIST3', 'IRISL0', 'IRISR0', 'IRISA0', 'IRISA1', 'IRISG0', 'IRISG1', 'IRISG2'];
  const c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d', { willReadFrequently: true });
  for (const name of names) {
    const st = frameState(name);
    drawFace(g, st);
    const src = g.getImageData(0, 0, W, W).data;
    await F.emit(`graphics/iris/${name}.png`, postFX(src, st, name), null);
  }
}
