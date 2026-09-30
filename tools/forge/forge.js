// Forge: renders sprites and textures for the GZDoom mod in headless Chromium.
// Loaded as index.html?job=<name>; imports jobs/<name>.js and calls its default
// export with the API below. Each emitted image is sent to run.mjs, which
// writes it as a PNG (with a Doom grAb offset chunk) under mod/.
//
// Conventions (docs/ASSETS.md):
//   world:  1 m = 32 map units horizontally. GZDoom stretches the world
//           vertically by 1.2, so sprites are rendered 1/1.2 as tall per metre.
//   actors: rendered at 2 texels per map unit (pxPerM = 64) and given Scale 0.5.
//   HUD:    the 320x200 screen rendered at 3x (960x600 + margin below),
//           camera = GZDoom's 90° horizontal FOV at 4:3; build.mjs declares
//           each frame in TEXTURES with XScale/YScale 3.
//   rotations: Doom's 1..8 (1 = facing the viewer, 3 = facing screen-left,
//           5 = back, 7 = facing screen-right); model forward is +Z.
import * as THREE from 'three';
import * as RIG from './lib/rig.js';
import { GB, trs, lathe, rockGeo } from './lib/gb.js';
import * as NOISE from './lib/noise.js';
import { M, G, DETAIL, detailTex, fresh } from './lib/mats.js';

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();

// ------------------------------------------------------------------ lights
// Camera-fixed lighting: every rotation is lit from the viewer's side (as
// Doom's photographed models were), bright enough that sector light does the
// darkening in game.
function lightRig(scene, o = {}) {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0xdfe6ff, 0x4a4238, o.hemi ?? 1.6));
  const key = new THREE.DirectionalLight(0xfff4e6, o.key ?? 2.4); key.position.set(-2.5, 4, 5); g.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0ff, o.fill ?? 0.7); fill.position.set(4, 1, 3); g.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, o.rim ?? 1.1); rim.position.set(1, 3, -5); g.add(rim);
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ capture
// Render at ss× and box-downsample; alpha-weighted colour, hard alpha edges
// (GZDoom alpha-tests sprites), and colour bled into transparent texels so
// filtering never shows a dark fringe.
function shoot(scene, camera, W, H, { ss = 3, hardAlpha = true, bleed = 2 } = {}) {
  renderer.setSize(W * ss, H * ss, false);
  renderer.render(scene, camera);
  const SW = W * ss, SH = H * ss, raw = new Uint8Array(SW * SH * 4);
  gl.readPixels(0, 0, SW, SH, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  const out = new Uint8ClampedArray(W * H * 4), n = ss * ss;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g2 = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const sy = SH - 1 - (y * ss + j), o = (sy * SW + x * ss + i) * 4, al = raw[o + 3];
      r += raw[o] * al; g2 += raw[o + 1] * al; b += raw[o + 2] * al; a += al;
    }
    const o = (y * W + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g2 / a; out[o + 2] = b / a; }
    out[o + 3] = hardAlpha ? (a / n >= 110 ? 255 : 0) : a / n;
  }
  const img = { w: W, h: H, data: out };
  if (bleed) bleedColor(img, bleed);
  return img;
}
function bleedColor(img, passes) {
  const { w, h, data } = img;
  for (let p = 0; p < passes; p++) {
    const src = new Uint8ClampedArray(data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3] || (src[o] | src[o + 1] | src[o + 2])) continue;
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
function trim(img, pad = 1) {
  const { w, h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { img: { w: 1, h: 1, data: new Uint8ClampedArray(4) }, x0: 0, y0: 0, empty: true };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) d.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + W) * 4), y * W * 4);
  return { img: { w: W, h: H, data: d }, x0, y0 };
}

// ------------------------------------------------------------------ transport
let emitted = 0;
function b64(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
// path is relative to mod/ (e.g. 'sprites/grey/GREYA1.png'); grab = [left, top] or null
async function emit(path, img, grab = null) {
  emitted++;
  await window.__forgeEmit(JSON.stringify({ path, w: img.w, h: img.h, grab }), b64(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.length)));
}
async function emitText(path, text) { emitted++; await window.__forgeEmit(JSON.stringify({ path, text }), ''); }

// ------------------------------------------------------------------ actors (8 rotations)
// model: { root: Object3D (feet at origin, forward +Z), pose(frame, rot) }
// frames: string of letters, or [{ f: 'A', rot: 8|0, pose?: fn }]
// bounds (metres): { w, top, bottom } frustum around the origin.
export async function spriteSet({ prefix, dir, model, frames, rotations = 8, bounds = { w: 2.4, top: 2.4, bottom: -0.2 }, pxPerM = 64, ss = 3, elev = 0, sink = 1, lights, scene: extScene }) {
  if (prefix.length !== 4) throw new Error('sprite prefix must be 4 chars: ' + prefix);
  const scene = extScene || new THREE.Scene();
  if (!extScene) { lightRig(scene, lights); scene.add(model.root); }
  const W = Math.round(bounds.w * pxPerM), H = Math.round((bounds.top - bounds.bottom) * pxPerM / 1.2);
  const cam = new THREE.OrthographicCamera(-bounds.w / 2, bounds.w / 2, bounds.top, bounds.bottom, -50, 50);
  // elev: degrees looking down (pickups on the floor read better from above)
  const el = elev * Math.PI / 180;
  cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const list = typeof frames === 'string' ? [...frames].map((f) => ({ f, rot: rotations })) : frames;
  const out = [];
  for (const fr of list) {
    const rots = fr.rot === 0 ? [0] : Array.from({ length: fr.rot ?? rotations }, (_, i) => i + 1);
    for (const r of rots) {
      model.root.rotation.y = r === 0 ? (fr.yaw ?? 0) : -(r - 1) * Math.PI / 4;
      (fr.pose || model.pose)(fr.f, r);
      model.root.updateMatrixWorld(true);
      const full = shoot(scene, cam, W, H, { ss });
      const o = new THREE.Vector3(0, 0, 0).project(cam);
      const ox = (o.x * 0.5 + 0.5) * W, oy = (1 - (o.y * 0.5 + 0.5)) * H;
      const t = trim(full);
      const name = `${prefix}${fr.f}${r}`;
      await emit(`${dir}/${name}.png`, t.img, [Math.round(ox - t.x0), Math.round(oy - t.y0) - sink]);
      out.push(name);
    }
  }
  return out;
}

// ------------------------------------------------------------------ HUD weapons
// The 320x200 view at `scale`x, plus `below` virtual px under the screen so
// bob and raise never show a cut edge. build → { root, pose(key) } in camera
// space (camera at origin looking -Z, +X right, +Y up, metres).
// frames: [{ name: 'SIGHA0', pose?: fn, key }] ; offsets follow GZDoom's
// hw_weapon.cpp: screen left = x - leftoffset, top = 32 + y - topoffset.
export const HUD_VFOV = 2 * Math.atan(Math.tan(Math.PI / 4) * 3 / 4) * 180 / Math.PI; // 73.74°
export async function hudFrames({ dir = 'graphics/hud', model, frames, scale = 3, below = 40, fov = HUD_VFOV, ss = 2, lights }) {
  const scene = new THREE.Scene();
  lightRig(scene, lights ?? { hemi: 1.3, key: 2.6, fill: 0.8, rim: 0.6 });
  const cam = new THREE.PerspectiveCamera(fov, 4 / 3, 0.01, 50);
  const FW = 320 * scale, FH = 200 * scale, W = FW, H = (200 + below) * scale;
  cam.setViewOffset(FW, FH, 0, 0, W, H);
  cam.updateProjectionMatrix();
  scene.add(cam); cam.add(model.root);
  const out = [];
  for (const fr of frames) {
    (fr.pose || model.pose)(fr.key ?? fr.name, fr);
    model.root.updateMatrixWorld(true);
    const t = trim(shoot(scene, cam, W, H, { ss }));
    if (t.empty) { console.warn('empty HUD frame', fr.name); continue; }
    await emit(`${dir}/${fr.name}.png`, t.img, [-t.x0, 32 * scale - t.y0]);
    out.push(fr.name);
  }
  return out;
}

// ------------------------------------------------------------------ textures
// paint(u, v, x, y) → [r, g, b] or [r, g, b, a]; emits mod/<dir>/<NAME>.png
export async function texture({ name, dir = 'textures', w, h = w, paint, alpha = false }) {
  if (name.length > 8) throw new Error('texture name > 8 chars: ' + name);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = paint(x / w, y / h, x, y), o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = alpha ? (c[3] ?? 255) : 255;
  }
  await emit(`${dir}/${name}.png`, { w, h, data });
}
// Canvas-2D painter variant: draw(ctx, w, h) for shapes/text (neon signs, posters, screens).
export async function canvasTexture({ name, dir = 'textures', w, h = w, draw, alpha = false }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (!alpha) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  await draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  await emit(`${dir}/${name}.png`, { w, h, data: new Uint8ClampedArray(d) });
}
// Render a 3D scene into a texture (e.g. a machine front, a sky with a ship silhouette).
export async function renderTexture({ name, dir = 'textures', w, h, scene, camera, ss = 2 }) {
  const img = shoot(scene, camera, w, h, { ss, hardAlpha: false, bleed: 0 });
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  await emit(`${dir}/${name}.png`, img);
}

const API = { THREE, RIG, GB, trs, lathe, rockGeo, NOISE, M, G, DETAIL, detailTex, fresh, lightRig, shoot, trim, emit, emitText, spriteSet, hudFrames, texture, canvasTexture, renderTexture, HUD_VFOV, renderer };
window.FORGE = API;

(async () => {
  const job = params.get('job');
  try {
    const mod = await import(`./jobs/${job}.js`);
    await mod.default(API, Object.fromEntries(params));
    await window.__forgeDone(JSON.stringify({ ok: true, emitted }));
  } catch (e) {
    await window.__forgeDone(JSON.stringify({ ok: false, error: String(e && e.stack || e) }));
  }
})();
