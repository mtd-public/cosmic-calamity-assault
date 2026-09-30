// The renderer: owns every three.js object, owns NO game state.
//   const view = new View(canvas, quality)
//   view.load(w)                       build the level
//   view.update(w, alpha, dt, t)       sync entities, animate, consume FX events
//   view.render()
import * as THREE from 'three';
import { FX, LightPool } from './fx.js';
import { GB, MAT, buildStatic, makeEnemy, makeWeapon, makeArms, makePickup, makeGrenade, makeTarget, makePines, makeCondor, glowMat, basicGlow, emissiveMat, setQuality, rockGeo } from './models.js';
import { getTex, spriteTex, labelTex } from './textures.js';
import { WEAPONS } from './weapons.js';
import { ENEMIES } from './enemies.js';
import { TUNING as T } from './tuning.js';
import { eyePos, aimDir } from './sim.js';
import { mulberry32 } from './utils.js';

const BLOOD = 0x3affc8; // Vyrr blood: luminous teal
const TMP = new THREE.Vector3();

export class View {
  constructor(canvas, quality = 'high') {
    this.q = quality;
    setQuality(quality);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.dprCap = quality === 'low' ? 1 : quality === 'med' ? 1.5 : 2;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = quality === 'high';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 1400);
    this.baseFov = 70;
    // first-person weapon: its own scene + camera so it never clips into walls
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(66, 1, 0.01, 10);
    this.vmHemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.vmSun.position.set(0.5, 1, 0.3);
    this.vmScene.add(this.vmHemi, this.vmSun, this.vmCam);
    this.vmLight = new THREE.PointLight(0xffd8a0, 0, 3, 2);
    this.vmScene.add(this.vmLight);
    this.vm = { root: new THREE.Group(), id: null, gun: null, arms: makeArms(), t: 0, kick: 0, sway: new THREE.Vector2(), last: new THREE.Vector2(), bob: 0 };
    this.vmCam.add(this.vm.root);
    this.vm.root.add(this.vm.arms.right, this.vm.arms.left);
    this.shakeT = 0;
    this.scene = null;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vmCam.aspect = w / h;
    // Portrait tablets: widen the vertical FOV so the horizontal view stays usable.
    this.baseFov = w / h < 1 ? 82 : w / h < 1.4 ? 74 : 70;
    this.vmCam.fov = this.baseFov - 4;
    this.camera.updateProjectionMatrix(); this.vmCam.updateProjectionMatrix();
  }

  dispose() {
    if (!this.scene) return;
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.scene = null;
  }

  // ------------------------------------------------------------ load
  load(w) {
    this.dispose();
    const lv = w.level, sky = lv.sky;
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.FogExp2(sky.fog, sky.fogDensity);
    s.background = new THREE.Color(sky.fog);
    this.hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, lv.theme === 'night' ? 1.9 : lv.theme === 'dusk' ? 1.45 : 1.2);
    s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(sky.sunColor, sky.sunIntensity);
    this.sunDir = new THREE.Vector3(...sky.sun).normalize();
    sun.castShadow = this.q === 'high';
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 220 });
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
    }
    s.add(sun, sun.target);
    this.vmHemi.color.set(sky.hemiSky); this.vmHemi.groundColor.set(sky.hemiGround); this.vmHemi.intensity = lv.theme === 'night' ? 1.4 : 1.3; // the gun stays readable in the dark
    this.vmSun.color.set(sky.sunColor); this.vmSun.intensity = sky.sunIntensity * 0.7;
    this.fx = new FX(s, this.q);
    this.lights = new LightPool(s, this.q === 'low' ? 2 : 3, this.q === 'low' ? 2 : 3);
    this.buildSky(lv);
    this.buildTerrain(w);
    // static geometry, merged by material
    const gb = new GB();
    this.dyn = { doors: [], cores: [], fires: [], smokes: [], lamps: [], condors: [], labels: [], pads: [], windows: [], pines: null, spire: null, waterfall: null, rain: false, mountains: false };
    buildStatic(lv, gb, this.dyn);
    for (const m of gb.meshes()) { m.castShadow = this.q === 'high'; s.add(m); }
    for (const d of this.dyn.doors) { s.add(d.mesh); }
    for (const c of this.dyn.cores) s.add(c.grp);
    for (const c of this.dyn.condors) { c.group.position.set(...c.p); s.add(c.group); }
    if (this.dyn.pines) for (const m of makePines(this.dyn.pines)) s.add(m);
    if (this.dyn.spire) s.add(this.dyn.spire.grp);
    if (this.dyn.waterfall) this.buildWaterfall(w, this.dyn.waterfall);
    if (this.dyn.mountains) this.buildMountains(lv);
    for (const L of this.dyn.labels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ map: labelTex(L.text, { bg: '#1a1d1a', fg: '#e0a040' }) }));
      m.position.set(...L.p); m.rotation.y = Math.PI / 2; s.add(m);
    }
    for (const P of this.dyn.pads) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 24), basicGlow(0xe0a040, 0.8)); ring.rotation.x = -Math.PI / 2; ring.position.set(P.p[0], P.p[1] + 0.02, P.p[2]); s.add(ring);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: labelTex(P.label, { w: 512, h: 128, font: 'bold 44px Oxanium, sans-serif' }), transparent: true }));
      lab.position.set(P.p[0], 1.6, P.p[2]); s.add(lab); P.lab = lab;
    }
    for (const W of this.dyn.windows) this.addWindows(W);
    // static glows (lamps, fires) live in the FX layer
    const lampList = [];
    for (const L of this.dyn.lamps) {
      this.fx.spawn({ p: L.p, stat: true, size: L.big ? 6 : L.bare ? 2.2 : 1.6, color: L.color, alpha: 0.85, tile: 0 });
      if (!L.bare && !L.hang) this.fx.spawn({ p: [L.p[0], L.p[1] - 0.1, L.p[2]], stat: true, size: 0.35, color: 0xffffff, alpha: 1, tile: 0 });
      if (L.hang) { const lampM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.7, 0.4, 10, 1, true), MAT('metal')); lampM.position.set(...L.p); s.add(lampM); }
      lampList.push({ p: L.p, color: L.color, intensity: L.big ? 1.2 : L.hang ? 1.4 : 0.9, dist: L.big ? 30 : L.hang ? 30 : 18 });
    }
    for (const L of lv.lights) lampList.push(L);
    for (const F of this.dyn.fires) lampList.push({ p: [F.p[0], F.p[1] + 1, F.p[2]], color: 0xff8030, intensity: 1.3 * F.s, dist: 14, fire: true });
    this.lights.setLamps(lampList);
    // water
    for (const wt of lv.water) {
      const tex = getTex('water');
      const nm = tex.normalMap.clone(); nm.needsUpdate = true; nm.repeat.set((wt.x1 - wt.x0) / 8, (wt.z1 - wt.z0) / 8);
      const mat = new THREE.MeshPhongMaterial({ color: wt.river ? 0x2a6a70 : 0x1a2a38, specular: 0xffffff, shininess: 90, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: wt.river ? 0.78 : 0.88 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wt.x1 - wt.x0, wt.z1 - wt.z0), mat);
      m.rotation.x = -Math.PI / 2; m.position.set((wt.x0 + wt.x1) / 2, wt.y, (wt.z0 + wt.z1) / 2);
      m.renderOrder = 2;
      s.add(m);
      (this.waters ||= []).push({ m, nm, river: wt.river });
    }
    this.ents = new Map(); this.picks = new Map(); this.grens = new Map(); this.tgts = new Map();
    for (const tg of w.targets) {
      const t = makeTarget(tg.kind);
      t.grp.position.set(...tg.pos);
      s.add(t.grp);
      this.tgts.set(tg.id, t);
    }
    this.rainT = 0;
    this.vm.id = null;
    this.shakeT = 0;
  }

  addWindows(W) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#0a0c10'; g.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) if (Math.random() < 0.45) { g.fillStyle = Math.random() < 0.2 ? '#ff8a40' : '#ffd8a0'; g.fillRect(x, y, 6, 6); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: t, fog: true });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W.w * 0.9, W.h * 0.9), mat);
      const a = i * Math.PI / 2;
      m.position.set(W.p[0] + Math.sin(a) * (W.w / 2 + 0.05), W.h * 0.48, W.p[2] + Math.cos(a) * (W.w / 2 + 0.05));
      m.rotation.y = a;
      this.scene.add(m);
    }
  }

  // ------------------------------------------------------------ sky
  buildSky(lv) {
    const sky = lv.sky;
    const mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(sky.top) }, hor: { value: new THREE.Color(sky.horizon) }, bot: { value: new THREE.Color(sky.bottom) },
        sunDir: { value: this.sunDir }, sunCol: { value: new THREE.Color(sky.sunColor) }, stars: { value: sky.stars ? 1 : 0 } },
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars;
        varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          float y = vD.y;
          vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.55)) : mix(hor, bot, pow(-y, 0.4));
          float sd = max(dot(normalize(vD), normalize(sunDir)), 0.0);
          c += sunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 12.0) * 0.35 + pow(sd, 3.0) * 0.12);
          if (stars > 0.5 && y > 0.05) { vec3 q = floor(vD * 380.0); float s = step(0.9975, h(q)); c += vec3(s) * 0.9 * y; }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), mat);
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.scene.add(dome);
    this.dome = dome;
    const rng = mulberry32(3);
    const cx = (lv.bounds.x0 + lv.bounds.x1) / 2, cz = (lv.bounds.z0 + lv.bounds.z1) / 2;
    // distant skyline
    if (sky.skyline === 'city' || sky.skyline === 'port') {
      const gb = new GB();
      const n = sky.skyline === 'city' ? 70 : 40;
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, R = 300 + rng() * 160;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, w = 14 + rng() * 26, h = 20 + rng() * (sky.skyline === 'city' ? 110 : 40);
        gb.cbox('concrete', [x - w / 2, -5, z - w / 2], [x + w / 2, h, z + w / 2], 0.5);
        if (rng() < 0.3) this.fx.spawn({ p: [x, h * 0.4, z], stat: true, size: 30, color: 0xff6a20, alpha: 0.4, tile: 0 });
      }
      for (const m of gb.meshes()) { m.material = m.material.clone(); m.material.color.set(0x404650); m.castShadow = false; this.scene.add(m); }
    }
    if (sky.skyline === 'mesa') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + rng() * 0.2, R = 380 + rng() * 120;
        const m = new THREE.Mesh(rockGeo(rng() * 100, 1, 0.2), MAT('rock'));
        m.scale.set(60 + rng() * 60, 30 + rng() * 40, 60 + rng() * 60); m.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R);
        this.scene.add(m);
      }
    }
    // Vyrr capital ships hanging over the horizon: the invasion is everywhere
    if (sky.ships) {
      const shipMat = new THREE.MeshPhongMaterial({ color: 0x2a2238, specular: 0x886699, shininess: 40, emissive: 0x140a20 });
      for (let i = 0; i < 3; i++) {
        const a = (i === 0 ? -Math.PI / 2 : rng() * Math.PI * 2), R = 520 + rng() * 200;
        const g = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.LatheGeometry([[0, -30], [40, -24], [80, -6], [90, 0], [60, 12], [20, 22], [0, 24]].map(([x, y]) => new THREE.Vector2(x, y)), 12), shipMat);
        hull.scale.set(1, 0.6, 2.2); g.add(hull);
        for (let k = 0; k < 6; k++) { const L = new THREE.Sprite(glowMat(0x6effa0, 0.8)); L.scale.set(18, 18, 1); L.position.set(Math.cos(k) * 70, -12, Math.sin(k) * 150); g.add(L); }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 12, 260, 8, 1, true), basicGlow(0x9b6bff, 0.18));
        beam.position.y = -150; g.add(beam);
        g.position.set(cx + Math.cos(a) * R, 160 + rng() * 80, cz + Math.sin(a) * R);
        g.rotation.y = rng() * 6;
        const sc = 0.6 + rng() * 0.6; g.scale.setScalar(sc);
        this.scene.add(g);
      }
    }
    if (sky.clouds) {
      const cmat = new THREE.SpriteMaterial({ map: spriteTex('cloud'), color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
      for (let i = 0; i < 26; i++) {
        const sp = new THREE.Sprite(cmat);
        const a = rng() * Math.PI * 2, R = 200 + rng() * 500;
        sp.position.set(cx + Math.cos(a) * R, 90 + rng() * 70, cz + Math.sin(a) * R);
        sp.scale.set(220 + rng() * 200, 90 + rng() * 60, 1);
        this.scene.add(sp);
      }
    }
  }

  buildMountains(lv) {
    const rng = mulberry32(12);
    const cx = (lv.bounds.x0 + lv.bounds.x1) / 2, cz = (lv.bounds.z0 + lv.bounds.z1) / 2;
    const mat = MAT('cliff').clone(); mat.color.set(0xb8c0c8);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rng() * 0.2, R = 280 + rng() * 260;
      const m = new THREE.Mesh(rockGeo(rng() * 50, 2, 0.35), mat);
      const h = 90 + rng() * 140;
      m.scale.set(80 + rng() * 70, h, 80 + rng() * 70); m.position.set(cx + Math.cos(a) * R, -20, cz + Math.sin(a) * R);
      this.scene.add(m);
      const snow = new THREE.Mesh(rockGeo(rng() * 50, 1, 0.3), new THREE.MeshPhongMaterial({ color: 0xf4f8ff, shininess: 20 }));
      snow.scale.set(m.scale.x * 0.35, h * 0.3, m.scale.z * 0.35); snow.position.set(m.position.x, -20 + h * 0.62, m.position.z);
      this.scene.add(snow);
    }
  }

  // ------------------------------------------------------------ terrain
  buildTerrain(w) {
    const geo = w.geo, lv = w.level;
    const nx = geo.tnx, nz = geo.tnz, res = geo.tres, b = geo.bounds;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      pos[k * 3] = b.x0 + i * res; pos[k * 3 + 1] = geo.th[k]; pos[k * 3 + 2] = b.z0 + j * res;
      // cheap baked AO: darker in dips relative to neighbours
      const hC = geo.th[k];
      const nb = (geo.th[Math.max(0, k - 1)] + geo.th[Math.min(nx * nz - 1, k + 1)] + geo.th[Math.max(0, k - nx)] + geo.th[Math.min(nx * nz - 1, k + nx)]) / 4;
      const ao = Math.max(0.72, Math.min(1.08, 1 + (hC - nb) * 0.35));
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = ao;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, bb, bb, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const gname = lv.terrain.ground || 'scorched', rname = lv.id === 'gorge' ? 'cliff' : 'rock';
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, specular: 0x111111, shininess: 6 });
    const uni = { tGround: { value: getTex(gname).map }, tRock: { value: getTex(rname).map }, tSand: { value: getTex('sand').map },
      uGRep: { value: gname === 'grid' ? 8 : gname === 'plaza' ? 6 : 5 }, uRRep: { value: 9 }, uSand: { value: lv.terrain.river ? 1 : 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        uniform sampler2D tGround; uniform sampler2D tRock; uniform sampler2D tSand;
        uniform float uGRep; uniform float uRRep; uniform float uSand;`)
        .replace('#include <map_fragment>', `
        vec3 wn = normalize(vWN);
        float rk = smoothstep(0.5, 0.75, 1.0 - wn.y);
        vec3 bw = pow(abs(wn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 rock = texture2D(tRock, vWP.zy / uRRep).rgb * bw.x + texture2D(tRock, vWP.xz / uRRep).rgb * bw.y + texture2D(tRock, vWP.xy / uRRep).rgb * bw.z;
        vec3 g1 = texture2D(tGround, vWP.xz / uGRep).rgb;
        vec3 g2 = texture2D(tGround, vWP.xz / (uGRep * 6.3) + 0.37).rgb;
        vec3 ground = g1 * (0.55 + 0.9 * g2);
        if (uSand > 0.5) { float sd = 1.0 - smoothstep(0.35, 1.1, vWP.y); ground = mix(ground, texture2D(tSand, vWP.xz / 3.0).rgb, sd); }
        diffuseColor.rgb *= mix(ground, rock, rk);`);
    };
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    this.scene.add(m);
  }

  buildWaterfall(w, W) {
    const geo = w.geo;
    const cols = 10, rows = 24;
    const pos = [], uv = [], idx = [];
    const z0 = W.p[2] - 12, z1 = W.p[2] + 3;
    for (let j = 0; j <= rows; j++) {
      const z = z0 + ((z1 - z0) * j) / rows;
      for (let i = 0; i <= cols; i++) {
        const x = W.p[0] - W.w / 2 + (W.w * i) / cols;
        pos.push(x, geo.terrainH(x, z) + 0.35, z); uv.push(i / cols * 2, j / rows * 3);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const tex = spriteTex('waterfall').clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.scene.add(m);
    this.falls = { tex, p: [W.p[0], 0.6, z1 - 1], w: W.w };
  }

  // ------------------------------------------------------------ per-frame
  update(w, alpha, dt, t, events) {
    const p = w.player;
    const px = p.prev.x + (p.pos.x - p.prev.x) * alpha, py = p.prev.y + (p.pos.y - p.prev.y) * alpha, pz = p.prev.z + (p.pos.z - p.prev.z) * alpha;
    const eyeH = T.eye + (T.crouchEye - T.eye) * p.crouch;
    const cam = this.camera;
    // camera
    let shake = this.fx.shake * 0.12;
    if (w.mode === 'dead') {
      const k = Math.min(1, w.deadT / 0.8);
      cam.position.set(px, py + eyeH - k * 1.3, pz);
      cam.rotation.set(p.pitch * (1 - k) - k * 0.2, p.yaw, k * 0.9, 'YXZ');
    } else {
      cam.position.set(px + (Math.random() - 0.5) * shake, py + eyeH + (Math.random() - 0.5) * shake, pz + (Math.random() - 0.5) * shake);
      cam.rotation.set(p.pitch + p.kick, p.yaw, 0, 'YXZ');
    }
    const ws = p.weapons[p.cur], wd = ws && WEAPONS[ws.id];
    const zoom = p.zoom && wd?.zoom ? wd.zoom : 1;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) / zoom));
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 18); cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    this.vmCam.position.copy(cam.position); this.vmCam.quaternion.copy(cam.quaternion); this.vmCam.updateMatrixWorld();
    // sun + shadow follow
    this.sun.position.set(px + this.sunDir.x * 100, py + this.sunDir.y * 100, pz + this.sunDir.z * 100);
    this.sun.target.position.set(px, py, pz);
    this.dome.position.copy(cam.position);

    for (const e of events) this.onEvent(w, e);
    this.syncEnemies(w, dt, t);
    this.syncPickups(w, t);
    this.syncGrenades(w, t);
    this.syncShots(w);
    this.animateWorld(w, dt, t);
    this.updateViewmodel(w, dt, t);
    this.lights.update(dt, px, py, pz);
    this.fx.update(dt, cam);
  }

  onEvent(w, e) {
    const fx = this.fx, p = w.player;
    switch (e.type) {
      case 'tracer': {
        const dx = e.x - e.x0, dy = e.y - e.y0, dz = e.z - e.z0, L = Math.hypot(dx, dy, dz);
        if (L > 3 && Math.random() < 0.6) {
          const k = 0.35 + Math.random() * 0.3;
          fx.spawn({ p: [e.x0 + dx * k, e.y0 + dy * k - 0.05, e.z0 + dz * k], v: [dx / L * 300, dy / L * 300, dz / L * 300], life: 0.035, size: 0.05, color: 0xffe0a0, stretch: 30, alpha: 0.8 });
        }
        break;
      }
      case 'fire': {
        const d = WEAPONS[e.id];
        this.vm.kick = Math.min(1.4, this.vm.kick + (d.recoil * 18 + 0.25) * (e.charged ? 2 : 1));
        this.vmFlash = 0.05;
        const color = d.side === 'vyrr' ? d.color : 0xffd8a0;
        const eye = eyePos(p), ad = aimDir(p.yaw, p.pitch);
        this.lights.pulse([eye.x + ad.x * 1.2, eye.y + ad.y * 1.2, eye.z + ad.z * 1.2], color, d.side === 'vyrr' ? 2 : 3.5, 9, 0.06);
        if (this.vm.gun?.pump && e.id === 'shotgun') this.vm.pumpT = 0.5;
        break;
      }
      case 'impact': {
        const pp = [e.x, e.y, e.z];
        if (e.surface === 'flesh') { fx.blood(pp, BLOOD, 6); }
        else if (e.surface === 'shield') fx.shieldFlare(pp, 0x9b6bff);
        else if (e.surface === 'armor') fx.sparks(pp, 10, 0xffe0a0, 7);
        else {
          fx.sparks(pp, 5, 0xffd080, 5);
          fx.puff(pp, 1, e.surface === 'dirt' ? 0x8a7a60 : 0x9a9a9a, 0.25);
          if (e.decal && e.n) fx.decal('hole', pp, e.n, 0.13);
        }
        break;
      }
      case 'shotHit': {
        const pp = [e.x, e.y, e.z];
        fx.plasmaSplash(pp, e.color, !!e.charged);
        if (e.world && e.n) fx.decal('splat', pp, e.n, 0.35, 0x101010);
        if (e.surface === 'flesh') fx.blood(pp, BLOOD, 4);
        if (e.surface === 'shield') fx.shieldFlare(pp);
        this.lights.pulse(pp, e.color, 1.6, 6, 0.1);
        break;
      }
      case 'shieldPop': fx.shieldFlare([e.x, e.y, e.z], 0xb68cff, true); break;
      case 'explosion': {
        const pp = [e.x, e.y, e.z];
        fx.explosion(pp, e.radius, e.kind);
        const g = w.geo.groundAt(e.x, e.z, e.y + 0.5, 0.2, 0.8);
        if (e.y - g < 1.2) fx.decal('splat', [e.x, g, e.z], [0, 1, 0], e.radius * 0.8, 0x0a0806);
        this.lights.pulse(pp, e.kind === 'plasma' ? 0x6fc8ff : e.kind === 'lance' ? 0x9dff5f : 0xffa040, 8, e.radius * 4, 0.35);
        const d = Math.hypot(e.x - p.pos.x, e.z - p.pos.z);
        fx.shake = Math.max(fx.shake, Math.max(0, 1.2 - d / 14));
        break;
      }
      case 'enemyDie': {
        fx.blood([e.x, e.y + 1, e.z], BLOOD, 10);
        if (e.etype === 'drone') { fx.explosion([e.x, e.y, e.z], 1.6, 'frag'); }
        if (e.head) fx.blood([e.x, e.y + (ENEMIES[e.etype].head?.y || 1), e.z], BLOOD, 12);
        break;
      }
      case 'enemyFire': fx.muzzle([e.x, e.y, e.z], 0xc0a0ff, 0.8); break;
      case 'melee': if (e.hit && e.x !== undefined) { fx.blood([e.x, e.y, e.z], BLOOD, 8); fx.shake = Math.max(fx.shake, 0.35); } this.vm.meleeT = 0.4; break;
      case 'playerHit': fx.shake = Math.max(fx.shake, e.shield ? 0.12 : 0.3); break;
      case 'throw': this.vm.throwT = 0.5; break;
      case 'targetDestroyed': {
        const tg = this.tgts.get(e.id);
        if (tg) tg.grp.visible = false;
        if (e.kind === 'spirecore' && this.dyn.spire) { this.dyn.spire.beam.visible = false; this.dyn.spire.halo.visible = false; this.dyn.spire.dead = true; }
        fx.explosion([e.x, e.y, e.z], 7, 'big');
        break;
      }
      case 'splash': fx.puff([e.x, e.y, e.z], 2, 0xd8f0ff, 0.2); break;
      case 'restored': this.resetDynamic(w); break;
      case 'supercombine': fx.explosion([e.x, e.y, e.z], 2.6, 'needle'); break;
      default: break;
    }
  }

  resetDynamic(w) {
    for (const [, r] of this.ents) this.scene.remove(r.root);
    for (const [, m] of this.picks) this.scene.remove(m);
    for (const [, m] of this.grens) this.scene.remove(m);
    this.ents.clear(); this.picks.clear(); this.grens.clear();
    for (const tg of w.targets) { const v = this.tgts.get(tg.id); if (v) v.grp.visible = !tg.dead; }
    if (this.dyn.spire) { const core = w.targets.find((t) => t.kind === 'spirecore'); const alive = !core || !core.dead; this.dyn.spire.beam.visible = alive; this.dyn.spire.halo.visible = alive; }
  }

  syncEnemies(w, dt, t) {
    const seen = new Set();
    for (const e of w.enemies) {
      seen.add(e.id);
      let r = this.ents.get(e.id);
      if (!r) {
        r = makeEnemy(e.type);
        if (r.gunMount && e.weapon && WEAPONS[e.weapon]) { const gun = makeWeapon(e.weapon); gun.group.scale.setScalar(e.type === 'skitter' ? 1.2 : 1.5); r.gunMount.add(gun.group); r.gun = gun; }
        r.root.traverse((o) => { if (o.isMesh) o.castShadow = this.q === 'high'; });
        r.fall = 0; r.spin = 0;
        this.scene.add(r.root);
        this.ents.set(e.id, r);
      }
      this.animateEnemy(w, e, r, dt, t);
    }
    for (const [id, r] of this.ents) if (!seen.has(id)) { this.scene.remove(r.root); this.ents.delete(id); }
  }

  animateEnemy(w, e, r, dt, t) {
    const d = ENEMIES[e.type];
    r.root.position.set(e.x, e.y, e.z);
    if (e.type === 'drone') {
      r.root.position.y += Math.sin(t * 5 + e.id) * 0.05;
      r.root.rotation.set(e.dead ? r.spin : 0, e.yaw, e.dead ? r.spin * 0.7 : Math.sin(t * 3 + e.id) * 0.15);
      for (const f of r.fins) f.rotation.z += dt * (e.dead ? 1 : 12);
      if (e.dead) { r.spin += dt * 6; if (Math.random() < 0.3) this.fx.puff([e.x, e.y, e.z], 1, 0x333333, 0.3); if (e.deadT > 6) r.root.visible = false; }
      return;
    }
    if (e.dead) {
      r.fall = Math.min(1, r.fall + dt * 2.6);
      r.spin += e.spin * dt;
      r.root.rotation.set(0, e.yaw + r.spin, 0);
      r.root.rotateX(r.fall * Math.PI * 0.48 * (e.dvz * Math.cos(e.yaw) + e.dvx * Math.sin(e.yaw) > 0 ? -1 : 1));
      r.root.position.y += 0.15 * r.fall;
      if (r.shield) r.shield.visible = false;
      if (r.gun) r.gun.group.visible = false;
      return;
    }
    r.root.rotation.set(0, e.yaw, 0);
    // gait from distance walked
    const ph = e.walk * (e.type === 'heavy' ? 1.4 : e.type === 'skitter' ? 3.2 : 2.3);
    const moving = Math.hypot(e.vx, e.vz) > 0.3 ? 1 : 0;
    r.gait = (r.gait ?? 0) + (moving - (r.gait ?? 0)) * Math.min(1, dt * 8);
    const amp = (e.type === 'heavy' ? 0.4 : 0.65) * r.gait;
    r.legs.forEach((L, i) => {
      const s = Math.sin(ph + i * Math.PI);
      L.hip.rotation.x = s * amp;
      if (L.knee) L.knee.rotation.x = (e.type === 'trooper' ? 0.9 : e.type === 'heavy' ? 0.4 : 0.5) + Math.max(0, -s) * amp * 0.9;
    });
    r.body.position.y = (e.type === 'heavy' ? 1.5 : e.type === 'skitter' ? 0.55 : 1.12) + Math.abs(Math.sin(ph)) * 0.05 * r.gait;
    r.body.rotation.z = Math.sin(ph) * 0.04 * r.gait;
    // aim: the torso leans toward you when alert
    const p = w.player;
    const dy = p.pos.y + 1.2 - (e.y + d.height * 0.7), dh = Math.hypot(p.pos.x - e.x, p.pos.z - e.z);
    const aim = e.alert ? Math.atan2(dy, dh) : 0;
    r.body.rotation.x = aim * 0.4 + (e.type === 'skitter' ? 0.15 : 0);
    const flee = e.mode === 'flee' || e.mode === 'panic';
    r.arms.forEach((a, i) => {
      if (flee) { a.rotation.x = -2.6 + Math.sin(t * 16 + i * 2) * 0.4; a.rotation.z = (i ? -1 : 1) * 0.3; }
      else if (e.windup > 0) { a.rotation.x = -2.2; }
      else if (e.type === 'heavy') { a.rotation.x = i === 0 ? -0.6 - aim : -1.3 - aim; }
      else a.rotation.x = e.alert ? -1.2 - aim * 0.6 : -0.3 + Math.sin(ph) * 0.3 * r.gait;
    });
    if (r.gunMount) r.gunMount.visible = !flee;
    if (r.head) r.head.rotation.y = Math.sin(t * 0.7 + e.id) * (e.alert ? 0.05 : 0.4);
    if (r.shield) {
      const k = Math.max(0, 1 - e.shieldHitT * 2.5) * (e.shield > 0 ? 1 : 0) + (e.shield > 0 && e.shield < e.maxShield && e.shieldT > 3 ? 0.25 : 0);
      r.shield.material.uniforms.amount.value = k;
      r.shield.material.uniforms.time.value = t;
      r.shield.visible = k > 0.01;
    }
    if (r.holo) { const m = r.body.children[0].material; m.opacity = 0.2 + Math.max(0, 1 - e.hitT * 3) * 0.5; }
    if (e.stuck && Math.random() < 0.5) this.fx.spawn({ p: [e.x, e.y + d.height * 0.6, e.z], life: 0.1, size: 0.6, color: 0x6fc8ff });
  }

  syncPickups(w, t) {
    const seen = new Set();
    for (const pk of w.pickups) {
      seen.add(pk.id);
      let m = this.picks.get(pk.id);
      if (!m) {
        m = makePickup(pk);
        if (pk.type === 'weapon') { m.rotation.set(0, (pk.id * 1.7) % 6.28, Math.PI / 2); m.position.set(pk.pos.x, pk.pos.y + 0.05, pk.pos.z); }
        else m.position.set(pk.pos.x, pk.pos.y, pk.pos.z);
        if (w.level.test && pk.respawn) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 20), basicGlow(0x4fe3ff, 0.5)); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.03; m.add(ring); }
        this.scene.add(m);
        this.picks.set(pk.id, m);
      }
      if (pk.type === 'weapon' && pk.pos.y > 0.8 && w.level.test) { m.rotation.y = t * 0.8; m.rotation.z = 0; m.position.y = pk.pos.y + 0.25 + Math.sin(t * 2 + pk.id) * 0.05; }
    }
    for (const [id, m] of this.picks) if (!seen.has(id)) { this.scene.remove(m); this.picks.delete(id); }
  }

  syncGrenades(w, t) {
    const seen = new Set();
    for (const g of w.grenades) {
      seen.add(g.id);
      let m = this.grens.get(g.id);
      if (!m) { m = makeGrenade(g.g); this.scene.add(m); this.grens.set(g.id, m); }
      m.position.set(g.x, g.y, g.z);
      m.rotation.x += 0.2; m.rotation.z += 0.13;
      if (g.g === 'plasma' && Math.random() < 0.5) this.fx.spawn({ p: [g.x, g.y, g.z], life: 0.15, size: 0.35, size1: 0.1, color: 0x6fc8ff });
      if (g.g === 'frag' && Math.floor(t * 8) % 2 === 0) this.fx.spawn({ p: [g.x, g.y + 0.1, g.z], life: 0.05, size: 0.15, color: 0xff4020 });
    }
    for (const [id, m] of this.grens) if (!seen.has(id)) { this.scene.remove(m); this.grens.delete(id); }
  }

  syncShots(w) {
    // plasma bolts, needles and fuel-lance rounds: a glowing head + a short trail
    for (const s of w.shots) {
      const sz = s.size || 0.15;
      this.fx.spawn({ p: [s.x, s.y, s.z], life: 0.02, size: sz * 3.2, size1: sz * 3.2, color: s.color, alpha: 0.9 });
      this.fx.spawn({ p: [s.x, s.y, s.z], life: 0.02, size: sz * 1.1, color: 0xffffff, alpha: 1 });
      this.fx.spawn({ p: [s.x, s.y, s.z], life: 0.16, size: sz * 1.8, size1: sz * 0.3, color: s.color, alpha: 0.6 });
    }
  }

  animateWorld(w, dt, t) {
    const d = this.dyn;
    for (const door of d.doors) {
      const open = w.doorsOpen.includes(door.id);
      door.t = Math.max(0, Math.min(1, door.t + (open ? dt : -dt) * 1.5));
      const b = door.box, h = b.max[1] - b.min[1];
      door.mesh.position.y = door.t * (h - 0.25);
      door.mesh.visible = door.t < 0.999;
    }
    for (const c of d.cores) {
      const k = 0.7 + 0.3 * Math.sin(t * 3.2);
      c.rings.forEach((r, i) => { r.position.y = 1.6 + ((t * 0.8 + i * 0.2) % 1) * (c.grp.children[0].geometry.parameters.points.at(-1).y - 3.2); r.material.emissiveIntensity = 1.5 + k; });
      c.glow.material.opacity = 0.4 + 0.3 * k;
    }
    for (const F of d.fires) {
      if (Math.random() < 0.7 * this.fx.budget) this.fx.spawn({ p: [F.p[0] + (Math.random() - 0.5) * 0.8 * F.s, F.p[1] + 0.2, F.p[2] + (Math.random() - 0.5) * 0.8 * F.s], v: [0, 1.6 + Math.random(), 0], life: 0.6, size: 0.9 * F.s, size1: 0.2, color: Math.random() < 0.5 ? 0xff8030 : 0xffc050, alpha: 0.9 });
    }
    for (const S of d.smokes) {
      if (Math.random() < (S.big ? 0.35 : 0.2) * this.fx.budget) this.fx.spawn({ p: [S.p[0] + (Math.random() - 0.5), S.p[1], S.p[2] + (Math.random() - 0.5)], v: [0.6, S.big ? 3 : 1.4, 0.2], life: S.big ? 7 : 4, size: S.big ? 3 : 1.2, size1: S.big ? 14 : 5, color: 0x2a2624, alpha: 0.55, tile: 1, additive: false, spin: 0.2 });
    }
    for (const C of d.condors) {
      const show = !C.late || w.seq.i >= (w.level.sequence.length - 1) || w.mode === 'won';
      C.group.visible = show;
      C.group.position.y = C.p[1] + Math.sin(t * 1.2) * 0.4;
      C.group.rotation.z = Math.sin(t * 0.7) * 0.03;
    }
    if (d.spire && !d.spire.dead) { d.spire.halo.material.opacity = 0.6 + 0.3 * Math.sin(t * 4); }
    for (const [id, v] of this.tgts) {
      const tg = w.targets.find((q) => q.id === id);
      if (!tg || tg.dead) continue;
      const hurt = 1 - tg.hp / tg.maxHp;
      v.core.rotation.y += dt * (1 + hurt * 4);
      v.core.material.emissiveIntensity = 2 + Math.sin(t * (4 + hurt * 20)) * (0.5 + hurt);
      if (v.cage) { v.cage.visible = tg.locked; v.cage.rotation.y -= dt * 0.6; v.grp.position.y = tg.pos[1] + Math.sin(t) * 0.2; }
      if (hurt > 0.5 && Math.random() < 0.2) this.fx.sparks([tg.pos[0], tg.pos[1] + tg.h * 0.5, tg.pos[2]], 3, 0xd35bff, 4);
    }
    for (const W of this.waters || []) { W.nm.offset.x += dt * 0.01; W.nm.offset.y += dt * (W.river ? 0.06 : 0.015); }
    if (this.falls) {
      this.falls.tex.offset.y += dt * 1.4;
      if (Math.random() < 0.6 * this.fx.budget) this.fx.spawn({ p: [this.falls.p[0] + (Math.random() - 0.5) * this.falls.w, this.falls.p[1], this.falls.p[2]], v: [(Math.random() - 0.5), 1 + Math.random() * 2, 1], life: 2, size: 2, size1: 6, color: 0xffffff, alpha: 0.35, tile: 1, additive: false });
    }
    if (d.rain) {
      const c = this.camera.position;
      for (let i = 0; i < 14 * this.fx.budget; i++) {
        const x = c.x + (Math.random() - 0.5) * 30, z = c.z + (Math.random() - 0.5) * 30;
        const inside = x > -32 && x < 32 && z > -125 && z < -30; // under the warehouse roof
        if (inside) continue;
        this.fx.spawn({ p: [x, c.y + 8, z], v: [0.5, -22, 0], life: 0.6, size: 0.05, color: 0xa8c0e0, alpha: 0.5, stretch: 26, additive: false });
      }
    }
  }

  // ------------------------------------------------------------ viewmodel
  updateViewmodel(w, dt, t) {
    const p = w.player, vm = this.vm;
    const ws = p.weapons[p.cur];
    if (!ws) { vm.root.visible = false; return; }
    if (vm.id !== ws.id) {
      if (vm.gun) vm.root.remove(vm.gun.group);
      vm.gun = makeWeapon(ws.id);
      vm.gun.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      vm.root.add(vm.gun.group);
      vm.id = ws.id;
      vm.lastMag = -1;
    }
    const d = WEAPONS[ws.id];
    const scoped = p.zoom && d.zoom;
    vm.root.visible = !scoped && w.mode !== 'dead';
    // grip layout
    const pistol = ws.id === 'sidearm' || ws.id === 'caster' || ws.id === 'needler';
    const base = pistol ? [0.16, -0.17, -0.38] : [0.15, -0.165, -0.34];
    const K = 0.56; // held assembly scale: Halo-sized on screen
    vm.gun.group.scale.setScalar(K); vm.arms.right.scale.setScalar(K); vm.arms.left.scale.setScalar(K);
    // sway (lags the look), bob (walk), kick (recoil)
    const lx = p.yaw, ly = p.pitch;
    const dYaw = Math.atan2(Math.sin(lx - vm.last.x), Math.cos(lx - vm.last.x)), dPitch = ly - vm.last.y;
    vm.last.set(lx, ly);
    vm.sway.x += (-dYaw * 1.5 - vm.sway.x) * Math.min(1, dt * 10);
    vm.sway.y += (dPitch * 1.5 - vm.sway.y) * Math.min(1, dt * 10);
    vm.sway.x = Math.max(-0.06, Math.min(0.06, vm.sway.x)); vm.sway.y = Math.max(-0.05, Math.min(0.05, vm.sway.y));
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround) vm.bob += dt * speed * 1.9;
    const bobA = Math.min(1, speed / T.walkSpeed) * (p.onGround ? 1 : 0.2);
    vm.kick *= Math.exp(-dt * 14);
    let dip = 0, rotX = 0, rotZ = 0, fwd = 0;
    if (p.reloadT > 0 && d.kind !== 'plasma') {
      const k = d.shellReload ? 0.5 : Math.sin(Math.min(1, 1 - p.reloadT / d.reload) * Math.PI);
      dip = 0.09 * k; rotX = -0.5 * k; rotZ = 0.4 * k;
    }
    if (p.switchT > 0) { dip += p.switchT * 0.6; rotX -= p.switchT * 1.5; }
    if ((vm.meleeT = Math.max(0, (vm.meleeT || 0) - dt)) > 0) { const k = Math.sin((1 - vm.meleeT / 0.4) * Math.PI); fwd -= 0.18 * k; rotZ -= 0.6 * k; rotX += 0.2 * k; }
    if (ws.vent > 0) { rotZ += 0.5; dip += 0.04; }
    vm.gun.group.position.set(base[0] + vm.sway.x + Math.cos(vm.bob) * 0.012 * bobA, base[1] - dip + vm.sway.y - Math.abs(Math.sin(vm.bob)) * 0.012 * bobA + p.crouch * 0.01, base[2] + vm.kick * 0.05 + fwd);
    vm.gun.group.rotation.set(rotX + vm.kick * 0.12, vm.sway.x * 0.8, rotZ);
    // right hand on the grip, left hand forward (or throwing)
    const g = vm.gun.group;
    vm.arms.right.position.set(g.position.x + 0.01 * K, g.position.y - 0.06 * K, g.position.z + 0.08 * K);
    vm.arms.right.rotation.set(g.rotation.x - 0.25, g.rotation.y + 0.1, g.rotation.z);
    vm.throwT = Math.max(0, (vm.throwT || 0) - dt);
    if (vm.throwT > 0) {
      const k = Math.sin((1 - vm.throwT / 0.5) * Math.PI);
      vm.arms.left.position.set(-0.1 + k * 0.05, -0.15 + k * 0.08, -0.22 - k * 0.14);
      vm.arms.left.rotation.set(-0.4 - k * 0.6, 0.2, 0);
      vm.arms.left.visible = true;
    } else if (pistol) {
      vm.arms.left.visible = false;
    } else {
      vm.arms.left.visible = true;
      const lz = ws.id === 'shotgun' ? -0.36 + (vm.pumpT > 0 ? Math.sin((1 - vm.pumpT / 0.5) * Math.PI) * 0.08 : 0) : -0.3;
      vm.arms.left.position.set(g.position.x - 0.05 * K, g.position.y, g.position.z + (lz + 0.12) * K);
      vm.arms.left.rotation.set(g.rotation.x - 0.2, 0.45, g.rotation.z + 0.5);
    }
    if (vm.pumpT > 0) { vm.pumpT -= dt; if (vm.gun.pump) vm.gun.pump.position.z = -0.36 + Math.sin((1 - Math.max(0, vm.pumpT) / 0.5) * Math.PI) * 0.08; }
    // live bits: AR ammo counter, needler crystals, plasma heat glow
    if (vm.gun.counter && vm.lastMag !== ws.mag) {
      vm.lastMag = ws.mag;
      const c = vm.gun.counter.userData.ctx;
      c.fillStyle = '#031014'; c.fillRect(0, 0, 64, 32);
      c.fillStyle = ws.mag <= 8 ? '#ff5040' : '#4fe3ff'; c.font = 'bold 26px Oxanium, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(ws.mag).padStart(2, '0'), 32, 17);
      vm.gun.counter.needsUpdate = true;
    }
    if (vm.gun.crystals) vm.gun.crystals.forEach((c, i) => { c.visible = i < Math.ceil(ws.mag / 2); });
    if (vm.gun.glow && d.kind === 'plasma') {
      const hot = ws.heat;
      vm.gun.glow.material = emissiveMat(hot > 0.75 || ws.vent > 0 ? 0xff5030 : d.color, 1.5 + (p.charge > 0 ? Math.min(1, p.charge / (d.charge?.time || 1)) * 3 : 0));
    }
    // muzzle flash in the viewmodel scene
    this.vmFlash = Math.max(0, (this.vmFlash || 0) - dt);
    if (!vm.flash) {
      vm.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('flash'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      vm.flash.scale.set(0.22, 0.22, 1);
    }
    if (vm.flash.parent !== vm.gun.muzzle) vm.gun.muzzle.add(vm.flash);
    vm.flash.visible = this.vmFlash > 0;
    vm.flash.material.color.set(d.side === 'vyrr' ? d.color : 0xffd8a0);
    vm.flash.material.rotation = Math.random() * 6.28;
    this.vmLight.intensity = this.vmFlash > 0 ? 2.5 : 0;
    this.vmLight.color.set(d.side === 'vyrr' ? d.color : 0xffc880);
    this.vmLight.position.copy(vm.gun.muzzle.getWorldPosition(TMP));
  }

  // screen position of a world point (for the HUD waypoint / markers)
  project(x, y, z, out) {
    TMP.set(x, y, z).project(this.camera);
    out.x = TMP.x; out.y = TMP.y; out.behind = TMP.z > 1;
    return out;
  }

  render() {
    const r = this.renderer;
    r.clear();
    if (this.scene) r.render(this.scene, this.camera);
    r.clearDepth();
    r.render(this.vmScene, this.vmCam);
  }
}
