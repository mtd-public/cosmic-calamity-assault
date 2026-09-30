// Hand grenades: an M67-style frag (olive sphere, fuze, spoon, pin + ring) and
// the alien detonator (a palm-sized bone-and-chrome lens with red glyphs).
// Frame: centre at the origin, fuze / top along +Y.
import { THREE, mat, glow, latheZ, latheY, rbox, put, group, V3, torus, sphere, canvas } from './core.js';

export function makeFrag() {
  const g = new THREE.Group(); g.name = 'frag';
  const od = mat('parkerized', { c: 0x4a5236, rough: 0.6, metal: 0.3 });
  const body = put(g, new THREE.Mesh(sphere(0.032, 32, 24), od));
  body.scale.set(1, 1.04, 1);
  // yellow band (HE marking) + seam
  put(g, new THREE.Mesh(torus(0.0322, 0.0012, Math.PI * 2, 48, 6), mat('white', { c: 0xc8a832, rough: 0.5 })), [0, 0.008, 0], [Math.PI / 2, 0, 0]);
  // fuze body + spoon + pin + ring
  const steel = mat('darksteel', { c: 0x5a5e62, rough: 0.35 });
  put(g, new THREE.Mesh(latheY([[0.0001, 0.046], [0.008, 0.046], [0.0105, 0.042], [0.0105, 0.03], [0.013, 0.028], [0.013, 0.024]], 24), steel));
  const spoon = group(g); spoon.name = 'spoon';
  put(spoon, new THREE.Mesh(rbox(0.012, 0.004, 0.022, 0.0012), steel), [0, 0.046, 0.006]);
  put(spoon, new THREE.Mesh(rbox(0.012, 0.055, 0.0035, 0.0012), steel), [0, 0.02, 0.0345], [-0.12, 0, 0]);
  const pin = group(g); pin.name = 'pin';
  put(pin, new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.026, 8), steel), [0, 0.038, 0], [0, 0, Math.PI / 2]);
  put(pin, new THREE.Mesh(torus(0.0105, 0.0013, Math.PI * 2, 28, 6), steel), [-0.022, 0.038, 0.0], [0, Math.PI / 2, 0]);
  g.userData.parts = { spoon, pin };
  return g;
}

function glyphTexture(lit) {
  const [c, x] = canvas(256, 256);
  x.fillStyle = lit ? '#1a0304' : '#07090b'; x.fillRect(0, 0, 256, 256);
  x.translate(128, 128);
  const col = lit ? '#ff3020' : '#3a1212';
  x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 7; x.lineCap = 'round';
  // six alien glyphs around a ring + a central eye
  for (let i = 0; i < 6; i++) {
    x.save(); x.rotate(i * Math.PI / 3); x.translate(0, -82);
    x.beginPath();
    const k = i % 3;
    if (k === 0) { x.moveTo(-14, -10); x.lineTo(0, 12); x.lineTo(14, -10); x.moveTo(0, 12); x.lineTo(0, -16); }
    else if (k === 1) { x.moveTo(-14, 10); x.lineTo(-14, -10); x.lineTo(14, -10); x.moveTo(-4, 0); x.lineTo(14, 12); }
    else { x.arc(0, 0, 11, 0.4, Math.PI * 1.7); x.moveTo(0, -16); x.lineTo(0, 16); }
    x.stroke(); x.restore();
  }
  x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 50, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.ellipse(0, 0, 26, 11, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let GT = null;
export function makeDetonator() {
  const g = new THREE.Group(); g.name = 'det';
  GT ||= { on: glyphTexture(true), off: glyphTexture(false) };
  // a flattened bone ovoid with a chrome rim and a dark glass face
  const shell = put(g, new THREE.Mesh(sphere(0.036, 36, 24), mat('bone')));
  shell.scale.set(1, 0.55, 1);
  put(g, new THREE.Mesh(torus(0.0355, 0.0042, Math.PI * 2, 56, 10), mat('chromeViolet')), [0, 0.004, 0], [Math.PI / 2, 0, 0]);
  // three bone claws gripping the rim
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.4;
    const claw = put(g, new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.03, 10), mat('boneDark')), [Math.cos(a) * 0.036, 0.004, Math.sin(a) * 0.036], [0, -a, 0]);
    claw.rotateZ(Math.PI / 2 + 0.5); claw.rotateX(0.2);
  }
  const faceOn = new THREE.MeshBasicMaterial({ map: GT.on, toneMapped: false });
  const faceOff = new THREE.MeshStandardMaterial({ map: GT.off, roughness: 0.1, metalness: 0.2 });
  const face = put(g, new THREE.Mesh(new THREE.CircleGeometry(0.03, 48), faceOff), [0, 0.0205, 0], [-Math.PI / 2, 0, 0]);
  const dome = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 8, 0, Math.PI * 2, 0, 0.5), mat('glass', { opacity: 0.25 })), [0, 0.0205 - 0.0263, 0]);
  void dome;
  g.userData.set = (lit) => { face.material = lit ? faceOn : faceOff; };
  return g;
}
