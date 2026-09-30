// Shared bits for the HUD weapon jobs: viewmodel FOV, brass, muzzle-flash frames.
import { THREE, mat, latheZ, toScreen, worldPos, paintFlash, V3 } from './core.js';

// Viewmodel vertical FOV in degrees (≈58° horizontal). Narrower than the
// world's 90° so the guns render with a flatter, CoD-like perspective; the
// screen placement is still exact (hud() writes offsets from the render).
export const FOV = 44;

// A cartridge case (open mouth toward -Z, rim at +Z): d = diameter, len = length.
export function makeCasing(d = 0.0098, len = 0.019, kind = 'brass') {
  const r = d / 2, g = new THREE.Group();
  const m = kind === 'shell' ? mat('shellRed') : mat('brass');
  if (kind === 'shell') {
    g.add(new THREE.Mesh(latheZ([[0.0001, -len * 0.72], [r * 0.95, -len * 0.72], [r, -len * 0.7], [r, len * 0.2], [r * 0.9, len * 0.2]], 20), m));
    g.add(new THREE.Mesh(latheZ([[r * 0.9, len * 0.2], [r, len * 0.2], [r * 1.02, len * 0.28], [r * 1.12, len * 0.29], [r * 1.12, len * 0.31], [0.0001, len * 0.31]], 20), mat('brass')));
    return g;
  }
  g.add(new THREE.Mesh(latheZ([[r * 0.8, -len / 2], [r * 0.97, -len / 2], [r, -len / 2 + 0.001], [r * 1.02, len / 2 - 0.004], [r * 0.85, len / 2 - 0.003], [r * 0.85, len / 2 - 0.0015], [r * 1.02, len / 2 - 0.001], [r * 1.02, len / 2], [0.0001, len / 2]], 18), m));
  return g;
}

// A muzzle-flash frame for hud(): poses the gun with poseFn, then paints a
// flash at the muzzle's screen position, elongated along the bore's screen
// direction. o: paintFlash options (len/width in frame px at distance 0.4 m).
export function flashFrame(name, poseFn, gun, o = {}) {
  return {
    name,
    pose: () => poseFn(),
    paint: (cam) => {
      const mz = worldPos(gun.anchors.muzzle);
      const q = new THREE.Quaternion(); gun.anchors.muzzle.getWorldQuaternion(q);
      const ahead = mz.clone().add(V3(0, 0, -0.1).applyQuaternion(q));
      const a = toScreen(cam, mz), b = toScreen(cam, ahead);
      let dx = b[0] - a[0], dy = (b[1] - a[1]) * 1.2; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const k = 0.4 / Math.max(0.1, -mz.z); // scale with distance
      return paintFlash({ at: [a[0], a[1]], dir: [dx, dy], len: (o.len ?? 120) * k, width: (o.width ?? 60) * k, endOn: o.endOn ?? 0, seed: o.seed ?? 1, color: o.color, core: o.core, prongs: o.prongs });
    },
  };
}
