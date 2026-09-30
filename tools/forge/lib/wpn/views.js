// Debug turntable: orthographic views of an object composited into one PNG
// (used while modelling; run with OUT=<scratch> so nothing lands in mod/).
import { THREE, studioEnv, canvas, imgOf } from './core.js';

const VIEWS = {
  left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], front: [0, 0, -1], back: [0, 0, 1],
  q1: [-1, 0.6, 1], q2: [1, 0.6, 1], q3: [-1, 0.5, -1], q4: [1, -0.5, 1],
};
export async function views(F, obj, { name = 'debug', list = ['left', 'right', 'top', 'front', 'q1', 'q2'], size = 420, pad = 1.15, bg = '#50555c' } = {}) {
  const scene = new THREE.Scene();
  scene.environment = studioEnv(F.renderer);
  F.lightRig(scene, { hemi: 0.9, key: 2.0, fill: 0.6, rim: 0.7 });
  const parent = obj.parent; scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverseVisible((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const R = Math.max(s.x, s.y, s.z) * 0.5 * pad;
  const cols = Math.min(3, list.length), rows = Math.ceil(list.length / cols);
  const [cv, g] = canvas(cols * size, rows * size);
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < list.length; i++) {
    const d = new THREE.Vector3(...(VIEWS[list[i]] || list[i])).normalize();
    const cam = new THREE.OrthographicCamera(-R, R, R, -R, -50, 50);
    cam.position.copy(c).addScaledVector(d, 5); cam.up.set(0, 1, 0);
    if (Math.abs(d.y) > 0.99) cam.up.set(0, 0, -1);
    cam.lookAt(c); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const img = F.shoot(scene, cam, size, size, { ss: 2, hardAlpha: false, bleed: 0 });
    const [c2, g2] = canvas(size, size); const id = g2.createImageData(size, size); id.data.set(img.data); g2.putImageData(id, 0, 0);
    g.drawImage(c2, (i % cols) * size, Math.floor(i / cols) * size);
    g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText(String(list[i]), (i % cols) * size + 6, Math.floor(i / cols) * size + 16);
  }
  await F.emit(`debug/${name}.png`, imgOf(g, cv.width, cv.height));
  scene.remove(obj); if (parent) parent.add(obj);
}
