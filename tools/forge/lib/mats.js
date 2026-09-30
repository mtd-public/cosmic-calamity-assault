// Sprite-render materials. Sprites are lit by GZDoom's sector light and
// dynamic lights at runtime, so renders use bright, neutral lighting and
// MeshStandardMaterial with small procedural detail maps (weave, pores,
// scratches) so surfaces read as cloth / skin / metal at sprite resolution.
import * as THREE from 'three';
import { fbm, vnoise, hash } from './noise.js';

const texCache = new Map();
// A tileable detail texture painted by paint(u,v) → [r,g,b] 0..255 (grey multiplier by default).
export function detailTex(key, size, paint, repeat = 1) {
  const k = key + ':' + size + ':' + repeat;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const r = paint(i / size, j / size, i, j), o = (j * size + i) * 4;
    img.data[o] = r[0]; img.data[o + 1] = r[1]; img.data[o + 2] = r[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(k, t);
  return t;
}
const grey = (v) => { const x = Math.max(0, Math.min(255, v * 255)); return [x, x, x]; };
export const DETAIL = {
  weave: () => detailTex('weave', 64, (u, v, i, j) => grey(0.82 + 0.1 * ((i + j) % 4 < 2 ? 1 : -1) * 0.5 + 0.12 * fbm(u * 4, v * 4, 4, 3, 3)), 4),
  wool: () => detailTex('wool', 64, (u, v) => grey(0.8 + 0.2 * fbm(u * 8, v * 8, 8, 4, 5)), 3),
  skin: () => detailTex('skin', 64, (u, v) => grey(0.88 + 0.12 * fbm(u * 6, v * 6, 6, 4, 9)), 2),
  metal: () => detailTex('metal', 64, (u, v, i, j) => grey(0.78 + 0.14 * fbm(u * 3, v * 12, 3, 3, 11) + (hash(i, j, 3) < 0.02 ? 0.1 : 0)), 2),
  leather: () => detailTex('leather', 64, (u, v) => grey(0.75 + 0.25 * Math.pow(vnoise(u * 16, v * 16, 16, 21), 0.6)), 3),
  alien: () => detailTex('alien', 64, (u, v) => grey(0.7 + 0.3 * Math.abs(fbm(u * 5, v * 5, 5, 4, 31) * 2 - 1)), 2),
};

const matCache = new Map();
// M(color, opts) → MeshStandardMaterial. opts: rough, metal, detail ('weave'|'skin'|...), emissive, ei, flat
export function M(color, o = {}) {
  const key = JSON.stringify([color, o]);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0,
    map: o.detail ? DETAIL[o.detail]() : null,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    flatShading: !!o.flat, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
  });
  matCache.set(key, m);
  return m;
}
// Unlit glow (eyes, screens, muzzle cores): renders at full colour regardless of light.
export function G(color) { return M(color, { emissive: color, ei: 1.0, rough: 1 }); }
// Fresh (uncached) copy for per-frame changes.
export const fresh = (m) => m.clone();
