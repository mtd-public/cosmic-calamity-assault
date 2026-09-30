// A heavy steel D-cell Maglite. Frame: axis along -Z (head forward), origin at
// the hand's grip point on the barrel, +Y the switch side.
import { THREE, mat, glow, latheZ, cylZ, rbox, put, group, V3, torus } from './core.js';
import { basisQ } from './vm.js';

export function makeMaglite(o = {}) {
  const root = new THREE.Group(); root.name = 'maglite';
  const body = mat('alu', { c: 0x4a4d52, metal: 0.9, rough: 0.32 });
  const knurl = mat('aluKnurl', { c: 0x45484d, metal: 0.9, rough: 0.45, rep: [14, 5], ns: 0.5 });
  const dark = mat('alu', { c: 0x2a2c30, metal: 0.8, rough: 0.35 });
  // head: bezel ring, flared head, neck
  put(root, new THREE.Mesh(latheZ([[0.0282, -0.212], [0.0296, -0.209], [0.0298, -0.2], [0.0292, -0.196], [0.0285, -0.19], [0.0282, -0.176], [0.0268, -0.168], [0.025, -0.155], [0.0232, -0.142], [0.0224, -0.13]], 48), body));
  // knurled bezel band
  put(root, new THREE.Mesh(cylZ(0.0299, 0.0299, -0.207, -0.197, 48), knurl));
  // head grip rings
  for (let i = 0; i < 3; i++) put(root, new THREE.Mesh(torus(0.0265 - i * 0.0012, 0.0011, Math.PI * 2, 48, 6), dark), [0, 0, -0.17 + i * 0.008]);
  // lens + reflector + bulb (lit when on)
  const lensOn = glow(0xfff1d8, 1.25), lensOff = mat('glass', { c: 0x0c0e10 });
  const refl = new THREE.Mesh(latheZ([[0.0255, -0.2055], [0.02, -0.197], [0.012, -0.188], [0.004, -0.183], [0.0001, -0.182]], 40), mat('chrome'));
  root.add(refl);
  const lens = put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0258, 48), lensOff), [0, 0, -0.2075], [0, Math.PI, 0]);
  const hot = put(root, new THREE.Mesh(new THREE.CircleGeometry(0.009, 32), glow(0xffffff, 1.4)), [0, 0, -0.2085], [0, Math.PI, 0]);
  // lit lens edge: seen from behind/side the glowing glass rims the bezel
  const rim = put(root, new THREE.Mesh(torus(0.0288, 0.0028, Math.PI * 2, 64, 8), glow(0xfff4dc, 1.35)), [0, 0, -0.2135]);
  const spill = new THREE.PointLight(0xffe2b8, 0, 0.6, 1.2); spill.position.set(0, 0.04, -0.2); root.add(spill);
  // neck to the barrel
  put(root, new THREE.Mesh(latheZ([[0.0224, -0.13], [0.0205, -0.124], [0.0198, -0.118]], 40), body));
  // barrel: knurled grip sections with smooth rings between
  put(root, new THREE.Mesh(cylZ(0.0197, 0.0197, -0.118, 0.17, 40), body));
  for (const [a, b] of [[-0.105, -0.045], [-0.03, 0.05], [0.065, 0.145]]) put(root, new THREE.Mesh(cylZ(0.0201, 0.0201, a, b, 40), knurl));
  // switch in a rubber boot (top, near the head)
  put(root, new THREE.Mesh(rbox(0.012, 0.006, 0.018, 0.003), mat('rubber')), [0, 0.0205, -0.112]);
  // tail cap with a lanyard slot
  put(root, new THREE.Mesh(latheZ([[0.0203, 0.17], [0.021, 0.172], [0.021, 0.19], [0.0195, 0.197], [0.012, 0.2], [0.0001, 0.2]], 40), body));
  put(root, new THREE.Mesh(cylZ(0.0212, 0.0212, 0.174, 0.186, 40), knurl));
  put(root, new THREE.Mesh(rbox(0.004, 0.012, 0.01, 0.0015), dark), [0, 0, 0.2]);
  // left fist around the barrel: the barrel runs through the curled fingers
  // along the hand's X (head toward the thumb side); knuckles face down-left.
  const X = V3(0, 0, -1), Y = V3(0.707, -0.707, 0).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  const R = new THREE.Matrix4().makeBasis(X, Y, Z);
  const c = V3(0, -0.021, -0.066).applyMatrix4(R); // tunnel centre in hand space → light space
  const anchors = { L: group(root, [-c.x - 0.012, -c.y - 0.024, -c.z + (o.gripZ ?? 0.1)]), lens: group(root, [0, 0, -0.21]) };
  anchors.L.quaternion.setFromRotationMatrix(R);
  const light = { root, anchors, name: 'FLHL' };
  light.set = (s = {}) => { const on = s.on ?? true; lens.material = on ? lensOn : lensOff; hot.visible = on; rim.visible = on; spill.intensity = on ? 2.5 : 0; refl.material = on ? glow(0xffe8c8, 1.0) : mat('chrome'); };
  light.set();
  return light;
}
