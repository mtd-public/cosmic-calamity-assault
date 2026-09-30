// 2D fire, fireballs and smoke painted over a rendered prop frame (hard alpha,
// Doom-style), plus renderFrames(): spriteSet's camera and trim with a
// post-process hook so frames can be painted on before they are emitted.
import { clamp, mix, fbm, vn } from './tex.js';

const RAMP = [
  [0.0, [34, 30, 28]], [0.12, [58, 46, 40]], [0.22, [120, 28, 8]], [0.38, [214, 70, 12]],
  [0.56, [255, 138, 24]], [0.74, [255, 206, 70]], [0.9, [255, 244, 190]], [1.0, [255, 255, 240]],
];
export function fireColor(T) {
  T = clamp(T);
  for (let k = 1; k < RAMP.length; k++) if (T <= RAMP[k][0]) {
    const [t0, c0] = RAMP[k - 1], [t1, c1] = RAMP[k], f = (T - t0) / (t1 - t0);
    return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
  }
  return RAMP[RAMP.length - 1][1];
}
const nz = (x, y, sc, s, oct = 4) => fbm(x / 2048, y / 2048, Math.round(2048 / sc), Math.round(2048 / sc), oct, s);

function put(img, x, y, c) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const o = (y * img.w + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
}

// Fireball / smoke ball. cx, cy: centre (px); rx, ry: radii (px); heat 0..1; smoke 0..1 (share of the top turning to smoke)
export function ball(img, { cx, cy, rx, ry, heat = 1, smoke = 0, seed = 1, turb = 0.7, scale = 14 }) {
  const x0 = Math.floor(cx - rx * 1.6), x1 = Math.ceil(cx + rx * 1.6), y0 = Math.floor(cy - ry * 1.6), y1 = Math.ceil(cy + ry * 1.6);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, r = Math.hypot(dx, dy);
    const n = nz(x, y, scale, seed), n2 = nz(x, y, scale * 0.4, seed + 5, 2);
    const d = 1 - r + (n - 0.5) * turb + (n2 - 0.5) * turb * 0.35;
    if (d <= 0) continue;
    const top = clamp(0.5 - dy * 0.5);                 // 1 at the top, 0 at the bottom
    let T = clamp(d * 2.4) * heat * (1 - smoke * top * 0.9) + (n2 - 0.5) * 0.12;
    if (smoke > 0 && top * smoke > 0.35 && d < 0.5) T *= 0.4;
    put(img, x, y, fireColor(T));
  }
}
// Rising flame tongue(s) from a base line: x (centre px), y (base px), w (half-width px), h (height px), t (phase 0..1)
export function flame(img, { x: cx, y: by, w, h, t = 0, seed = 1, heat = 1, scale = 9, smokeTop = 0 }) {
  const x0 = Math.floor(cx - w * 1.5), x1 = Math.ceil(cx + w * 1.5), y0 = Math.floor(by - h * 1.3), y1 = Math.ceil(by + 3);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const up = (by - y) / h; if (up < -0.05) continue;
    const s = clamp(up);
    const n = nz(x, y + t * h * 1.2, scale, seed), n2 = nz(x * 1.7, y + t * h * 2.1, scale * 0.5, seed + 3, 2);
    const wob = Math.sin(up * 6 - t * 6.283 * 2 + seed) * w * 0.18 * up;
    const width = w * Math.pow(1 - s, 0.65) + 0.5;
    const d = (1 - Math.abs(x - cx - wob) / width) * Math.pow(1 - s, 0.4) + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.35 - up * 0.1;
    if (d <= 0.02) continue;
    let T = clamp(d * 1.9 + 0.05) * heat;
    if (d > 0.14) T = Math.max(T, 0.3 + (d - 0.14));   // no sooty holes inside the flame body
    if (smokeTop && up > 0.75) T = Math.min(T, 0.16);
    put(img, x, y, fireColor(T));
  }
}

// Render a prop's frames with spriteSet's camera, run post(f, img, ox, oy, px) on the full frame, then trim + emit.
export async function renderFrames(F, { prefix, dir = 'sprites/props', root, frames, pose = () => {}, post, w, top, bottom = -0.05, yaw = 0, elev = 8, lights, ss = 3, pxPerM = 64, sink = 1 }) {
  const { THREE } = F;
  const scene = new THREE.Scene(); F.lightRig(scene, lights); scene.add(root);
  const W = Math.round(w * pxPerM), H = Math.round((top - bottom) * pxPerM / 1.2);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, top, bottom, -50, 50);
  const el = elev * Math.PI / 180; cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const out = [];
  for (const f of frames) {
    root.rotation.y = yaw; pose(f); root.updateMatrixWorld(true);
    const full = F.shoot(scene, cam, W, H, { ss, bleed: 0 });
    const o = new THREE.Vector3(0, 0, 0).project(cam);
    const ox = (o.x * 0.5 + 0.5) * W, oy = (1 - (o.y * 0.5 + 0.5)) * H;
    // world → pixel helper for painting: (x metres right, y metres up)
    const px = (x, y) => [ox + x * pxPerM, oy - y * pxPerM / 1.2 * Math.cos(el)];
    // model-space point → pixel (follows the prop's yaw)
    const proj = (x, y, z) => { const v = new THREE.Vector3(x, y, z); root.localToWorld(v); v.project(cam); return [(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H]; };
    if (post) post(f, full, ox, oy, px, proj);
    bleed(full, 2);
    const t = F.trim(full);
    const name = `${prefix}${f}0`;
    await F.emit(`${dir}/${name}.png`, t.img, [Math.round(ox - t.x0), Math.round(oy - t.y0) - sink]);
    out.push(name);
  }
  scene.remove(root);
  return out;
}

// bleed colour into fully transparent texels (so filtering never shows dark fringes)
export function bleed(img, passes = 2) {
  const { w, h, data } = img;
  for (let p = 0; p < passes; p++) {
    const src = new Uint8ClampedArray(data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4; if (src[o + 3]) continue;
      let r = 0, g = 0, b = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = (Y * w + X) * 4; if (!src[q + 3] && !(src[q] | src[q + 1] | src[q + 2])) continue;
        r += src[q]; g += src[q + 1]; b += src[q + 2]; c++;
      }
      if (c) { data[o] = r / c; data[o + 1] = g / c; data[o + 2] = b / c; }
    }
  }
}
