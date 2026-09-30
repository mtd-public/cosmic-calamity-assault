// Combat knife (KA-BAR-style): clip-point blade with a black coating and a
// bright ground edge, oval steel guard, stacked leather-washer handle, steel
// pommel. Frame: blade toward -Z, spine +Y, edge -Y, origin at the grip centre.
import { THREE, mat, extrude, latheZ, rbox, put, group, fillet, V3, cylZ } from './core.js';
import { loft } from './arm.js';
import { fistAnchor } from './vm.js';

export function makeKnife() {
  const root = new THREE.Group(); root.name = 'KNIF';
  const coat = mat('parkerized', { c: 0x2a2c2f, rough: 0.5, metal: 0.6 });
  const edge = mat('steel', { c: 0xb4b8be, rough: 0.2 });
  // blade profile (u forward, v up) from the guard (u=0.052) to the tip (u=0.225)
  const u0 = 0.05;
  const prof = fillet([[u0, -0.0135], [u0 + 0.14, -0.012], [u0 + 0.162, -0.006], [u0 + 0.176, 0.004], [u0 + 0.152, 0.008], [u0 + 0.12, 0.0135], [u0, 0.0135]], [0, 0.02, 0.01, 0, 0.003, 0.004, 0], 4);
  put(root, new THREE.Mesh(extrude(prof, 0.0055, { bevel: 0.0012 }), coat));
  // ground edge: a thin bright bevel strip along the belly
  const edgeProf = fillet([[u0 + 0.01, -0.0138], [u0 + 0.14, -0.0123], [u0 + 0.162, -0.0063], [u0 + 0.1765, 0.0035], [u0 + 0.16, -0.001], [u0 + 0.14, -0.0065], [u0 + 0.01, -0.0078]], [0, 0.02, 0.01, 0, 0.004, 0.02, 0], 4);
  put(root, new THREE.Mesh(extrude(edgeProf, 0.0035, { bevel: 0.0008 }), edge));
  // clip bevel (top of the tip) and fuller
  put(root, new THREE.Mesh(extrude([[u0 + 0.122, 0.0132], [u0 + 0.152, 0.0079], [u0 + 0.171, 0.0038], [u0 + 0.148, 0.0068]], 0.0059, { bevel: 0.0005 }), edge));
  for (const s of [-1, 1]) put(root, new THREE.Mesh(rbox(0.0008, 0.0035, 0.09, 0.0004), mat('black')), [s * 0.0029, 0.004, -(u0 + 0.06)]);
  // guard
  put(root, new THREE.Mesh(extrude(fillet([[0.046, -0.026], [0.052, -0.026], [0.052, 0.022], [0.046, 0.022]], 0.002, 2), 0.013, { bevel: 0.002 }), mat('darksteel')));
  // handle: stacked leather washers (ridged loft), a spacer and a pommel
  const sec = [];
  const N = 26;
  for (let i = 0; i <= N; i++) { const t = i / N, z = -0.046 + t * 0.108; const ring = 0.0012 * Math.cos(i * Math.PI); const bulge = 0.003 * Math.sin(t * Math.PI); sec.push({ p: [0, -0.001, z], w: 0.024 + bulge + ring, h: 0.03 + bulge + ring, e: 2.2 }); }
  put(root, new THREE.Mesh(loft(sec, { radial: 28 }), mat('leatherBrown', { c: 0x4a3020 })));
  put(root, new THREE.Mesh(extrude(fillet([[-0.062, -0.018], [-0.056, -0.018], [-0.056, 0.016], [-0.062, 0.016]], 0.003, 2), 0.022, { bevel: 0.002 }), mat('darksteel')));
  put(root, new THREE.Mesh(latheZ([[0.0001, 0.078], [0.009, 0.077], [0.012, 0.07], [0.0125, 0.062]], 24), mat('darksteel')), [0, -0.001, 0]);
  const anchors = {};
  // right fist: blade out of the thumb side, knuckles facing down-left, forearm down-right
  anchors.R = fistAnchor(root, { at: [0, -0.001, 0.008], axis: [0, 0, -1], back: [-0.707, -0.707, 0], side: 1, tunnel: [0, -0.026, -0.089] });
  anchors.L = fistAnchor(root, { at: [0, -0.001, 0.008], axis: [0, 0, -1], back: [0.707, -0.707, 0], side: -1, tunnel: [0, -0.026, -0.089] });
  anchors.tip = group(root, [0, 0.004, -(u0 + 0.176)]);
  return { root, anchors, name: 'KNIF', set() {} };
}
