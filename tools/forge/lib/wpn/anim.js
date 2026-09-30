// Pose helpers: interpolation between pose objects, and the standard frame
// list per HUD weapon (docs/ASSETS.md §2).
import { THREE } from './core.js';

const isNum = (v) => typeof v === 'number';
// Deep lerp of pose objects: numbers and number arrays interpolate; other
// values switch at t = 0.5.
export function lerpPose(a, b, t) {
  if (a === undefined) return b; if (b === undefined) return a;
  if (isNum(a) && isNum(b)) return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(isNum)) return a.map((x, i) => x + (b[i] - x) * t);
  if (a && b && typeof a === 'object' && typeof b === 'object' && !a.isObject3D && !b.isObject3D && !Array.isArray(a) && !a.isQuaternion) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = lerpPose(a[k], b[k], t);
    return out;
  }
  return t < 0.5 ? a : b;
}
export const ease = (t) => t * t * (3 - 2 * t);
// Merge b onto a (shallow per top-level key, deep for gun/state/R/L)
export function over(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && !v.isObject3D) out[k] = { ...a[k], ...v };
    else out[k] = v;
  }
  return out;
}
// Add offsets to a gun transform
export function nudge(g, dp = [0, 0, 0], dr = [0, 0, 0]) {
  return { ...g, p: g.p.map((x, i) => x + dp[i]), r: g.r.map((x, i) => x + dr[i]) };
}
export const GUN_FRAMES = 'ABCDEFGHIJKLMNOP';
