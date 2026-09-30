// Calibration job: a 1.8 m capsule man (TSTM, 8 rotations) and a HUD box-gun (TSTG).
export default async function (F) {
  const { THREE, M } = F;
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 12), M(0x3355aa, { detail: 'weave' }));
  body.position.y = 0.9; root.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), M(0xdd3322)); nose.position.set(0, 1.55, 0.3); root.add(nose);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6), M(0x22aa44)); arm.position.set(0.3, 1.2, 0.3); root.add(arm);
  await F.spriteSet({ prefix: 'TSTM', dir: 'sprites/test', model: { root, pose() {} }, frames: 'A', bounds: { w: 1.6, top: 2.0, bottom: -0.1 } });
  const gun = new THREE.Group();
  const recv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.4), M(0x555a60, { metal: 0.6, rough: 0.4, detail: 'metal' }));
  gun.add(recv);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), M(0x222222)); grip.position.set(0, -0.09, 0.12); gun.add(grip);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), M(0xd8a080, { detail: 'skin' })); hand.position.set(0, -0.1, 0.14); gun.add(hand);
  const pivot = new THREE.Group(); pivot.add(gun);
  await F.hudFrames({ model: { root: pivot, pose(k) { gun.position.set(k === 'ads' ? 0 : 0.16, k === 'ads' ? -0.06 : -0.15, -0.42); gun.rotation.set(0, k === 'ads' ? 0 : 0.06, 0); } }, frames: [{ name: 'TSTGA0', key: 'hip' }, { name: 'TSTGB0', key: 'ads' }] });
}
