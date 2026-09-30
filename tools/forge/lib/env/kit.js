// Prop-building kit for world sprites: chamfered boxes, cylinders, lathes,
// tubes along curves, canvas decals (labels, screens) and textures painted
// with the Surf painter so props share the wall textures' look.
import { Surf } from './tex.js';

export function kit(F) {
  const { THREE, GB, M, G } = F;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const place = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
  const add = (parent, o, x, y, z, rx, ry, rz) => { place(o, x, y, z, rx, ry, rz); parent.add(o); return o; };

  // chamfered box centred at the origin
  const box = (mat, w, h, d, c = 0.015) => {
    const gb = new GB({ m: mat });
    gb.cbox('m', [-w / 2, -h / 2, -d / 2], [w / 2, h / 2, d / 2], c);
    return new THREE.Mesh(gb.meshes()[0].geometry, mat);
  };
  // box resting on y = 0 (feet at the origin)
  const boxUp = (mat, w, h, d, c) => { const m = box(mat, w, h, d, c); m.geometry.translate(0, h / 2, 0); return m; };
  const cyl = (mat, r, h, seg = 20, rTop = r, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg, 1, open), mat);
  const sphere = (mat, r, ws = 16, hs = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  const lathe = (mat, pts, seg = 24) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
  const torus = (mat, R, r, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(R, r, rs, ts, arc), mat);
  // tube through points [[x,y,z],...]
  const tube = (mat, pts, r, seg = 32, rs = 8, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), closed);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, rs, closed), mat);
  };
  // tapered tube: radius function r(t)
  const taper = (mat, pts, rf, seg = 40, rs = 10) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, rs, false);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, c = curve.getPointAt(t), r = rf(t);
      for (let j = 0; j <= rs; j++) {
        const k = i * (rs + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  // extruded 2D profile (x,y) with depth along z, centred on z
  const extrude = (mat, pts, depth, bevel = 0.004) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2);
    return new THREE.Mesh(g, mat);
  };
  // canvas texture
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  // texture from a Surf (albedo only: C * O, or the full bake when lit = true)
  const surfTex = (s, { lit = false, repeat = [1, 1], bake = {} } = {}) => {
    const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const g = c.getContext('2d'), img = g.createImageData(s.w, s.h);
    if (lit) img.data.set(s.bake(bake).data);
    else for (let i = 0; i < s.n; i++) { img.data[i * 4] = s.C[i * 3] * s.O[i] + s.E[i * 3]; img.data[i * 4 + 1] = s.C[i * 3 + 1] * s.O[i] + s.E[i * 3 + 1]; img.data[i * 4 + 2] = s.C[i * 3 + 2] * s.O[i] + s.E[i * 3 + 2]; img.data[i * 4 + 3] = 255 * s.A[i]; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
    return t;
  };
  const texMat = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, transparent: !!o.transparent, alphaTest: o.alphaTest ?? 0, side: o.side ?? THREE.FrontSide, emissive: o.emissive ?? 0x000000, emissiveMap: o.emissiveMap ?? null, emissiveIntensity: o.ei ?? 1, color: o.color ?? 0xffffff });
  // flat decal plane (+z facing) with a canvas texture
  const decal = (tex, w, h, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.glow ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : texMat(tex, { transparent: true, rough: o.rough ?? 0.8, ...o }));
  const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true });
  const group = (...ch) => { const g = new THREE.Group(); ch.forEach((c) => g.add(c)); return g; };
  // standard palette (sprite materials)
  const P = {
    steel: M(0x8a9096, { metal: 0.55, rough: 0.45, detail: 'metal' }),
    steelDk: M(0x4a4f55, { metal: 0.5, rough: 0.5, detail: 'metal' }),
    chrome: M(0xc8ccd0, { metal: 0.8, rough: 0.25 }),
    alu: M(0xb4b8bc, { metal: 0.6, rough: 0.4, detail: 'metal' }),
    beige: M(0xc8bc9c, { rough: 0.7 }),
    beigeDk: M(0x9a8c6c, { rough: 0.75 }),
    black: M(0x1e1f22, { rough: 0.6 }),
    plastic: M(0x2c2e32, { rough: 0.5 }),
    rubber: M(0x18181a, { rough: 0.9 }),
    white: M(0xe8e6e0, { rough: 0.8, detail: 'weave' }),
    paper: M(0xf0ece0, { rough: 0.9 }),
    wood: M(0x8a6040, { rough: 0.8, detail: 'wool' }),
    red: M(0xa8261c, { rough: 0.5, metal: 0.2 }),
    yellow: M(0xd8a828, { rough: 0.6, metal: 0.1 }),
    olive: M(0x5a5e3c, { rough: 0.75, detail: 'metal' }),
  };
  return { THREE, V3, place, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, surfTex, texMat, decal, basic, group, P, M, G, Surf };
}

// Render one rotation-0 prop: frames [{f, pose?}], yaw (radians) for a 3/4 view.
export async function prop(F, { prefix, root, frames = 'A', pose = () => {}, w = 2, top = 2, bottom = -0.05, yaw = 0, elev = 8, lights, ss = 3 }) {
  const list = typeof frames === 'string' ? [...frames].map((f) => ({ f, rot: 0, yaw })) : frames.map((fr) => ({ rot: 0, yaw, ...fr }));
  return F.spriteSet({ prefix, dir: 'sprites/props', model: { root, pose }, frames: list, bounds: { w, top, bottom }, elev, lights, ss });
}
