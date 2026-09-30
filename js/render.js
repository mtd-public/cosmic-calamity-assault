// The renderer: owns every three.js object, owns NO game state.
//   const view = new View(canvas, quality)
//   view.load(w)                       build the level
//   view.update(w, alpha, dt, t)       sync entities, animate, consume FX events
//   view.render()
import * as THREE from 'three';
import { FX, LightPool } from './fx.js';
import { GB, MAT, buildStatic, makeTarget, makePines, makeCondor, makeMountains, glowMat, basicGlow, emissiveMat, setQuality, rockGeo, trs } from './models.js';
import { makeWeapon, makePickup, makeGrenade } from './gunmodels.js';
import { makeEnemy, makePlayerBody, animatePlayerBody } from './rigs.js';
import { ViewModel } from './viewmodel.js';
import { makeVehicle } from './vehiclemodels.js';
import { VEHICLES } from './vehicles.js';
import { vehicleLocal } from './sim.js';
import { getTex, spriteTex, labelTex } from './textures.js';
import { WEAPONS } from './weapons.js';
import { ENEMIES } from './enemies.js';
import { TUNING as T } from './tuning.js';
import { eyePos, aimDir } from './sim.js';
import { mulberry32 } from './utils.js';
import { mergeGeometries } from './vendor/addons/BufferGeometryUtils.js';

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
    this.vm = new ViewModel(this.vmScene, this.vmCam);
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
    this.dyn = { doors: [], cores: [], fires: [], smokes: [], lamps: [], condors: [], labels: [], pads: [], windows: [], pines: null, spire: null, waterfall: null, rain: false, mountains: false, flags: [], grass: [], birds: [], shafts: [], puddles: [], mists: [], dust: null };
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
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ map: labelTex(L.text, { bg: L.bg || '#1a1d1a', fg: L.fg || '#e0a040' }), side: THREE.DoubleSide }));
      m.position.set(...L.p); m.rotation.y = L.rotY ?? Math.PI / 2; s.add(m);
    }
    this.buildDressing(w);
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
      if (!L.bare && !L.hang && !L.small) this.fx.spawn({ p: [L.p[0], L.p[1] - 0.1, L.p[2]], stat: true, size: 0.35, color: 0xffffff, alpha: 1, tile: 0 });
      if (L.small) continue;
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
    this.ents = new Map(); this.picks = new Map(); this.grens = new Map(); this.tgts = new Map(); this.vehs = new Map();
    this.lampList = lampList; this.camDist = 0;
    for (const tg of w.targets) {
      const t = makeTarget(tg.kind);
      t.grp.position.set(...tg.pos);
      s.add(t.grp);
      this.tgts.set(tg.id, t);
    }
    this.rainT = 0;
    this.vm.clip = null;
    this.shakeT = 0;
    // the player's own body: legs + torso when you look down, the whole figure in a vehicle
    this.body = makePlayerBody();
    this.body.root.traverse((o) => { if (o.isMesh) o.castShadow = this.q === 'high'; });
    s.add(this.body.root);
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
    // the sun itself: a disc and a wide glow on the dome, riding with the camera
    if (sky.sunIntensity > 1.2) {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('glow'), color: sky.sunColor, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
      sun.scale.set(140, 140, 1); sun.position.copy(this.sunDir).multiplyScalar(1000); sun.renderOrder = -9; dome.add(sun);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('soft'), color: sky.sunColor, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
      halo.scale.set(520, 520, 1); halo.position.copy(sun.position); halo.renderOrder = -9; dome.add(halo);
    }
    const rng = mulberry32(3);
    const cx = (lv.bounds.x0 + lv.bounds.x1) / 2, cz = (lv.bounds.z0 + lv.bounds.z1) / 2;
    // distant skyline
    if (sky.skyline === 'city' || sky.skyline === 'port') {
      // towers with lit windows, set-back upper floors, rooftop tanks and masts; a few on fire
      const gb = new GB();
      const n = sky.skyline === 'city' ? 80 : 44;
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, R = 280 + rng() * 180;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, w = 14 + rng() * 24, dd = 14 + rng() * 24, h = 18 + rng() * (sky.skyline === 'city' ? 120 : 36);
        const mat = rng() < 0.85 ? 'windows' : 'concrete';
        gb.cbox(mat, [x - w / 2, -5, z - dd / 2], [x + w / 2, h, z + dd / 2], 0.3);
        if (h > 50 && rng() < 0.6) { const w2 = w * (0.5 + rng() * 0.3), d2 = dd * (0.5 + rng() * 0.3), h2 = h + 10 + rng() * 30; gb.cbox(mat, [x - w2 / 2, h - 1, z - d2 / 2], [x + w2 / 2, h2, z + d2 / 2], 0.3); if (rng() < 0.5) gb.addGeo('metal', new THREE.CylinderGeometry(0.4, 0.6, 18 + rng() * 14, 5), trs(x, h2 + 9, z)); }
        if (rng() < 0.5) gb.addGeo('concrete', new THREE.CylinderGeometry(2.5, 2.5, 4, 8), trs(x + (rng() - 0.5) * w * 0.5, h + 2, z + (rng() - 0.5) * dd * 0.5), { su: 2, sv: 1 });
        if (rng() < 0.25) { this.fx.spawn({ p: [x, h * 0.5, z], stat: true, size: 34, color: 0xff6a20, alpha: 0.35, tile: 0 }); }
      }
      for (const m of gb.meshes()) { m.material = m.material.clone(); if (m.material.map === getTex('windows').map) { m.material.color.set(0x8a8e94); m.material.emissiveIntensity = lv.theme === 'day' ? 0.25 : 1.1; } else m.material.color.set(0x50565e); m.castShadow = false; this.scene.add(m); }
    }
    if (sky.skyline === 'mesa') {
      const mesa = makeMountains(cx, cz, 300, 780, 7); mesa.material.color.set(0xd8c8a8); this.scene.add(mesa);
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

  // Grass, flags, birds, sun shafts, puddles, mist: the living parts of a level's dressing.
  buildDressing(w) {
    const d = this.dyn, s = this.scene, geo = w.geo, rng = mulberry32(31);
    // grass: crossed quads, instanced, swaying in a shader
    for (const G of d.grass) {
      const n = Math.round(G.n * (this.q === 'low' ? 0.4 : 1));
      const q1 = new THREE.PlaneGeometry(1, 1), q2 = q1.clone(); q2.rotateY(Math.PI / 2);
      const gg = mergeGeometries([q1.translate(0, 0.5, 0), q2.translate(0, 0.5, 0)]);
      const mat = new THREE.MeshLambertMaterial({ map: spriteTex('grass'), alphaTest: 0.45, side: THREE.DoubleSide, color: 0xffffff });
      const uni = { uTime: { value: 0 } };
      mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, uni); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0);\ntransformed.x += sin(uTime * 1.7 + wp0.x * 0.8 + wp0.z * 0.6) * 0.12 * uv.y;\ntransformed.z += cos(uTime * 1.3 + wp0.x * 0.5) * 0.08 * uv.y;'); };
      const im = new THREE.InstancedMesh(gg, mat, n);
      const m = new THREE.Matrix4(), col = new THREE.Color(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
      let k = 0;
      for (let i = 0; i < n * 3 && k < n; i++) {
        const x = G.x0 + rng() * (G.x1 - G.x0), z = G.z0 + rng() * (G.z1 - G.z0);
        if (G.ok && !G.ok(x, z)) continue;
        const y = geo.terrainH(x, z);
        if (geo.groundAt(x, z, y + 0.3, 0.2, 0.05) > y + 0.02) continue; // not on a box
        const sz = 0.5 + rng() * 0.7;
        m.compose(pos.set(x, y - 0.03, z), quat.setFromEuler(new THREE.Euler(0, rng() * 6.28, 0)), sc.set(sz * (0.8 + rng() * 0.5), sz, sz * (0.8 + rng() * 0.5)));
        im.setMatrixAt(k, m); im.setColorAt(k, col.setHSL(0.24 + rng() * 0.07, 0.45, 0.42 + rng() * 0.25)); k++;
      }
      im.count = k; im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
      s.add(im); (this.grassMeshes ||= []).push({ im, uni });
    }
    // flags
    this.flags = [];
    for (const F of d.flags) {
      const g = new THREE.PlaneGeometry(F.w, F.h, 8, 4); g.translate(F.w / 2, 0, 0);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: spriteTex('flag'), side: THREE.DoubleSide }));
      m.position.set(...F.p); m.rotation.y = rng() * 6.28; m.castShadow = this.q === 'high'; s.add(m);
      this.flags.push({ m, base: g.attributes.position.array.slice(), phase: rng() * 6 });
    }
    // birds: a flock of dark chevrons circling
    this.birds = [];
    for (const B of d.birds) {
      const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.strokeStyle = '#10141a'; g.lineWidth = 3; g.beginPath(); g.moveTo(3, 20); g.quadraticCurveTo(10, 8, 16, 16); g.quadraticCurveTo(22, 8, 29, 20); g.stroke(); const t = new THREE.CanvasTexture(c); return t; })();
      for (let i = 0; i < B.n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(1.4, 1.0, 1); s.add(sp); this.birds.push({ sp, c: B.p, r: B.r * (0.6 + rng() * 0.6), ph: rng() * 6.28, spd: 0.25 + rng() * 0.15, h: rng() * 8 }); }
    }
    // sun shafts: tall additive slabs leaning with the sun
    for (const S of d.shafts) {
      const mat = new THREE.MeshBasicMaterial({ map: spriteTex('soft'), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xfff0c0 });
      for (let i = 0; i < S.n; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + rng() * 3, S.h), mat);
        const dir = new THREE.Vector3(...S.dir).normalize();
        m.position.set(S.p[0] + (rng() - 0.5) * S.w, S.p[1] + S.h * 0.4, S.p[2] + (rng() - 0.5) * S.w);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate()); m.rotateY(rng() * 6.28);
        m.renderOrder = 6; s.add(m);
      }
    }
    // puddles: dark, shiny, rippled
    for (const P of d.puddles) {
      const nm = getTex('water').normalMap.clone(); nm.needsUpdate = true; nm.repeat.set(2, 2);
      const mat = new THREE.MeshPhongMaterial({ color: 0x0c1218, specular: 0xffffff, shininess: 140, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.75 });
      for (let i = 0; i < P.n; i++) {
        const x = P.x0 + rng() * (P.x1 - P.x0), z = P.z0 + rng() * (P.z1 - P.z0), y = geo.terrainH(x, z);
        if (geo.groundAt(x, z, y + 0.3, 1.5, 0.05) > y + 0.02) continue;
        const m = new THREE.Mesh(new THREE.CircleGeometry(1.5 + rng() * 3, 10), mat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.015, z); m.scale.set(1 + rng(), 0.6 + rng() * 0.5, 1); m.renderOrder = 3; s.add(m);
      }
      (this.puddleMats ||= []).push(nm);
    }
    // mist: slow sprites low over water
    this.mists = [];
    for (const M of d.mists) {
      const mat = new THREE.SpriteMaterial({ map: spriteTex('cloud'), color: 0xdfeeff, transparent: true, opacity: 0.16, depthWrite: false });
      for (let i = 0; i < M.n; i++) { const sp = new THREE.Sprite(mat); const x = M.x0 + rng() * (M.x1 - M.x0), z = M.z0 + rng() * (M.z1 - M.z0); sp.position.set(x, M.y + rng() * 1.5, z); sp.scale.set(12 + rng() * 10, 4 + rng() * 3, 1); s.add(sp); this.mists.push({ sp, x, z, ph: rng() * 6.28 }); }
    }
  }

  buildMountains(lv) {
    const cx = (lv.bounds.x0 + lv.bounds.x1) / 2, cz = (lv.bounds.z0 + lv.bounds.z1) / 2;
    this.scene.add(makeMountains(cx, cz, 240, 760, 12));
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
    const ride = p.vehicle ? w.vehicles.find((v) => v.id === p.vehicle) : null;
    if (w.mode === 'dead') {
      const k = Math.min(1, w.deadT / 0.8);
      cam.position.set(px, py + eyeH - k * 1.3, pz);
      cam.rotation.set(p.pitch * (1 - k) - k * 0.2, p.yaw, k * 0.9, 'YXZ');
    } else if (ride) {
      // third person: orbit behind the vehicle on the look direction, pulled in by walls
      const vd = VEHICLES[ride.type];
      const tx = ride.x, ty = ride.y + vd.height * 0.7, tz = ride.z;
      const ad = aimDir(p.yaw, p.pitch);
      let dist = vd.cam.back;
      const rx = -ad.x, ry = -ad.y * 0.6 + 0.3, rz = -ad.z, rl = Math.hypot(rx, ry, rz) || 1;
      const wh = w.geo.raycast(tx, ty + 0.5, tz, rx / rl, ry / rl, rz / rl, dist + 0.5);
      if (wh) dist = Math.max(2.2, wh.t - 0.5);
      this.camDist += (dist - this.camDist) * Math.min(1, dt * (dist < this.camDist ? 20 : 4));
      const cx = tx - ad.x * this.camDist, cy = ty + vd.cam.up * (this.camDist / vd.cam.back) - ad.y * this.camDist * 0.6, cz = tz - ad.z * this.camDist;
      const gy = w.geo.groundAt(cx, cz, cy, 0.3, 2) + 0.4;
      cam.position.set(cx + (Math.random() - 0.5) * shake, Math.max(gy, cy) + (Math.random() - 0.5) * shake, cz + (Math.random() - 0.5) * shake);
      cam.lookAt(tx + ad.x * 6, ty + ad.y * 6 + 0.4, tz + ad.z * 6);
      cam.rotation.z += ride.roll * 0.15;
    } else {
      this.camDist = 0;
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
    this.syncVehicles(w, dt, t);
    this.animateWorld(w, dt, t);
    this.vm.update(w, dt, t, this.fx, cam);
    this.updateBody(w, px, py, pz, dt, t);
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
        this.vm.onEvent(e, w);
        const color = d.side === 'vyrr' ? d.color : 0xffd8a0;
        const eye = eyePos(p), ad = aimDir(p.yaw, p.pitch);
        this.lights.pulse([eye.x + ad.x * 1.2, eye.y + ad.y * 1.2, eye.z + ad.z * 1.2], color, d.side === 'vyrr' ? 2 : 3.5, 9, 0.06);
        break;
      }
      case 'reload': case 'shell': case 'reloadCancel': case 'overheat': case 'land': case 'switch': this.vm.onEvent(e, w); break;
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
      case 'melee': if (e.hit && e.x !== undefined) { fx.blood([e.x, e.y, e.z], BLOOD, 8); fx.shake = Math.max(fx.shake, 0.35); } this.vm.onEvent(e, w); break;
      case 'playerHit': fx.shake = Math.max(fx.shake, e.shield ? 0.12 : 0.3); break;
      case 'throw': this.vm.onEvent(e, w); break;
      case 'targetDestroyed': {
        const tg = this.tgts.get(e.id);
        if (tg) tg.grp.visible = false;
        if (e.kind === 'spirecore' && this.dyn.spire) { this.dyn.spire.beam.visible = false; this.dyn.spire.halo.visible = false; this.dyn.spire.dead = true; }
        fx.explosion([e.x, e.y, e.z], 7, 'big');
        break;
      }
      case 'splash': fx.puff([e.x, e.y, e.z], 2, 0xd8f0ff, 0.2); break;
      case 'splatter': fx.blood([e.x, e.y, e.z], BLOOD, e.killed ? 16 : 6); if (e.player) fx.shake = Math.max(fx.shake, 0.3); break;
      case 'vehicleBump': fx.sparks([e.x, e.y + 0.6, e.z], 8, 0xffd080, 6); fx.puff([e.x, e.y + 0.3, e.z], 2, 0x8a7a60, 0.5); break;
      case 'vehicleLand': fx.puff([e.x, e.y + 0.2, e.z], 4, 0x8a7a60, 0.8); break;
      case 'vehicleDie': fx.explosion([e.x, e.y + 1, e.z], 7, e.vtype === 'sliver' ? 'plasma' : 'big'); this.lights.pulse([e.x, e.y + 1.5, e.z], 0xffa040, 10, 30, 0.4); break;
      case 'restored': this.resetDynamic(w); break;
      case 'supercombine': fx.explosion([e.x, e.y, e.z], 2.6, 'needle'); break;
      default: break;
    }
  }

  resetDynamic(w) {
    for (const [, r] of this.ents) this.scene.remove(r.root);
    for (const [, r] of this.vehs) { this.scene.remove(r.group); const i = this.lampList.indexOf(r.lamp); if (i >= 0) this.lampList.splice(i, 1); }
    this.vehs.clear();
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
        if (r.type !== 'heavy' && r.type !== 'drone' && e.weapon && WEAPONS[e.weapon]) { const gun = makeWeapon(e.weapon); r.chest.add(gun.group); r.gun = gun; }
        r.root.traverse((o) => { if (o.isMesh) o.castShadow = this.q === 'high'; });
        this.scene.add(r.root);
        this.ents.set(e.id, r);
      }
      const p = w.player;
      r.animate(e, { dt, t, px: p.pos.x, py: p.pos.y, pz: p.pos.z, fx: this.fx });
      if (e.dead && r.gun) r.gun.group.visible = false;
    }
    for (const [id, r] of this.ents) if (!seen.has(id)) { this.scene.remove(r.root); this.ents.delete(id); }
  }

  syncVehicles(w, dt, t) {
    const seen = new Set();
    for (const v of w.vehicles) {
      seen.add(v.id);
      let r = this.vehs.get(v.id);
      if (!r) {
        r = makeVehicle(v.type);
        r.group.traverse((o) => { if (o.isMesh) o.castShadow = this.q === 'high'; });
        this.scene.add(r.group);
        this.vehs.set(v.id, r);
        if (r.lamps.length) { r.lamp = { p: [v.x, v.y + 1.2, v.z], color: 0xfff0c0, intensity: 1.2, dist: 22 }; this.lampList.push(r.lamp); }
      }
      const d = VEHICLES[v.type];
      r.group.position.set(v.x, v.y, v.z);
      r.group.rotation.set(0, v.yaw, 0);
      r.body.rotation.set(-v.pitch, 0, v.roll);
      const spd = Math.abs(v.speed);
      if (v.type === 'mule') {
        for (const W of r.wheels) {
          W.spin.rotation.x = -v.wheel;
          W.hub.rotation.y = W.front ? -v.steer * 0.5 : 0;
          const comp = v.onGround ? 0.06 * Math.sin(v.wheel * 0.7 + W.side) * Math.min(1, spd / 8) : -0.12;
          W.hub.position.y = d.wheelR - comp;
        }
        r.parts.steering.rotation.y = -v.steer * 1.2;
        r.parts.turretYaw.rotation.y = v.turretYaw;
        r.parts.turretPitch.rotation.x = -v.turretPitch;
        if (r.gun?.parts.barrels) r.gun.parts.barrels.rotation.z += dt * (v.occupant === 'player' && v.seat === 'gunner' && w.player.firedT < 0.15 ? 40 : 0);
        if (r.lamp) { const o = vehicleLocal(v, 0, 1.2, -3.2); r.lamp.p[0] = o.x; r.lamp.p[1] = o.y; r.lamp.p[2] = o.z; r.lamp.intensity = v.dead ? 0 : 1.2; }
        // dust from the wheels, exhaust
        if (v.onGround && spd > 3 && Math.random() < 0.5 * this.fx.budget) { const o = vehicleLocal(v, (Math.random() - 0.5) * 2, 0.2, 1.4); this.fx.spawn({ p: [o.x, o.y, o.z], v: [-v.vx * 0.1, 0.8, -v.vz * 0.1], life: 1.2, size: 0.6, size1: 2.2, color: 0x9a8a70, alpha: 0.3, tile: 1, additive: false, spin: 0.5 }); }
        if (!v.dead && Math.random() < 0.25 * this.fx.budget) { const o = vehicleLocal(v, r.exhaust.x, r.exhaust.y, r.exhaust.z); this.fx.spawn({ p: [o.x, o.y, o.z], v: [0, 0.6, 0.5], life: 0.6, size: 0.15, size1: 0.6, color: 0x555555, alpha: 0.25 * (0.4 + Math.abs(v.throttle)), tile: 1, additive: false }); }
      } else {
        r.body.position.y = 0.06 * Math.sin(t * 3 + v.id);
        r.parts.glowRing.material.opacity = 0.35 + 0.25 * Math.sin(t * 8) + (v.boosting ? 0.3 : 0);
        r.parts.jet.material.opacity = 0.4 + Math.min(1, spd / d.maxSpeed) * 0.5 + (v.boosting ? 0.3 : 0);
        r.parts.jet.scale.setScalar(1 + Math.min(1.2, spd / 12) + (v.boosting ? 0.8 : 0));
        r.parts.bars.rotation.y = -v.steer * 0.35;
        if (!v.dead && Math.random() < 0.4 * this.fx.budget) { const o = vehicleLocal(v, (Math.random() - 0.5) * 1.6, 0.05, (Math.random() - 0.5) * 1.6); this.fx.spawn({ p: [o.x, o.y, o.z], v: [(Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2], life: 0.5, size: 0.3, size1: 0.9, color: v.boosting ? 0xd0b0ff : 0x9b6bff, alpha: 0.35, tile: 0 }); }
        if (v.boosting && Math.random() < 0.8 * this.fx.budget) { const o = vehicleLocal(v, r.exhaust.x, r.exhaust.y, r.exhaust.z); this.fx.spawn({ p: [o.x, o.y, o.z], v: [-v.vx * 0.3, 0.2, -v.vz * 0.3], life: 0.4, size: 0.6, size1: 0.1, color: 0xb68cff, alpha: 0.8, tile: 0 }); }
      }
      if (v.hitT < 0.15 && Math.random() < 0.6) this.fx.sparks([v.x + (Math.random() - 0.5) * 2, v.y + 1 + Math.random(), v.z + (Math.random() - 0.5) * 2], 3, 0xffd080, 4);
      if (v.dead) {
        if (!r.wrecked) { r.wrecked = true; r.group.traverse((o) => { if (o.isMesh && o.material && !o.material.uniforms) { o.material = o.material.clone(); if (o.material.color) o.material.color.multiplyScalar(0.25); if (o.material.emissive) o.material.emissiveIntensity = 0; if (o.material.opacity !== undefined && o.material.transparent && o.isSprite) o.material.opacity = 0; } }); }
        r.body.rotation.z += 0.12 * Math.min(1, v.deadT);
        if (Math.random() < 0.35 * this.fx.budget) this.fx.spawn({ p: [v.x + (Math.random() - 0.5) * 1.5, v.y + 1, v.z + (Math.random() - 0.5) * 1.5], v: [0.3, 1.6 + Math.random(), 0.2], life: 3, size: 0.8, size1: 3.5, color: 0x2a2624, alpha: 0.5, tile: 1, additive: false, spin: 0.3 });
        if (v.deadT < 4 && Math.random() < 0.5 * this.fx.budget) this.fx.spawn({ p: [v.x + (Math.random() - 0.5), v.y + 0.8, v.z + (Math.random() - 0.5)], v: [0, 1.5 + Math.random(), 0], life: 0.5, size: 0.9, size1: 0.2, color: Math.random() < 0.5 ? 0xff8030 : 0xffc050, alpha: 0.9 });
      }
    }
    for (const [id, r] of this.vehs) if (!seen.has(id)) { this.scene.remove(r.group); this.vehs.delete(id); }
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
    for (const G of this.grassMeshes || []) G.uni.uTime.value = t;
    for (const P of this.puddleMats || []) { P.offset.x += dt * 0.05; P.offset.y += dt * 0.03; }
    for (const F of this.flags || []) {
      const a = F.m.geometry.attributes.position, b = F.base;
      for (let i = 0; i < a.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; const k = x / 1.8; a.setZ(i, Math.sin(t * 5 + k * 5 + F.phase) * 0.12 * k + Math.sin(t * 3 + y * 3) * 0.04 * k); }
      a.needsUpdate = true; F.m.geometry.computeVertexNormals();
    }
    for (const B of this.birds || []) { const a = t * B.spd + B.ph; B.sp.position.set(B.c[0] + Math.cos(a) * B.r, B.c[1] + B.h + Math.sin(a * 2.3) * 2, B.c[2] + Math.sin(a) * B.r * 0.7); B.sp.scale.y = 0.5 + Math.abs(Math.sin(t * 9 + B.ph)) * 0.7; }
    for (const M of this.mists || []) { M.sp.position.x = M.x + Math.sin(t * 0.15 + M.ph) * 3; M.sp.position.z = M.z + Math.cos(t * 0.11 + M.ph) * 2; }
    if (d.dust) {
      const c = this.camera.position;
      for (let i = 0; i < 2 * this.fx.budget; i++) this.fx.spawn({ p: [c.x + (Math.random() - 0.5) * 14, c.y + (Math.random() - 0.5) * 6, c.z + (Math.random() - 0.5) * 14], v: [(Math.random() - 0.5) * 0.3, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3], life: 3, size: 0.03, size1: 0.045, color: d.dust, alpha: 0.35, alpha1: 0, tile: 0 });
    }
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

  // ------------------------------------------------------------ the player's body
  updateBody(w, px, py, pz, dt, t) {
    const b = this.body, p = w.player;
    if (!b) return;
    b.root.visible = w.mode !== 'attract';
    if (!b.root.visible) return;
    const ride = p.vehicle ? w.vehicles.find((v) => v.id === p.vehicle) : null;
    if (ride) {
      // third person: the whole figure in the seat, hands on the controls, head turned to the look
      const vd = VEHICLES[ride.type], seat = vd.seats[p.seat];
      const gunner = p.seat === 'gunner';
      const yaw = ride.yaw + (gunner ? ride.turretYaw : 0);
      const o = vehicleLocal(ride, seat.pos[0], seat.pos[1], seat.pos[2]);
      b.root.position.set(o.x, o.y - (gunner ? 0.25 : 0), o.z);
      b.root.rotation.set(0, yaw, 0);
      b.helmet.visible = true; b.neck.visible = true; b.chest.visible = true;
      // hands relative to the seat, in the seat's frame
      const hands = seat.hands.map((h) => [h[0] - seat.pos[0], h[1] - seat.pos[1] + (gunner ? 0.25 : 0), h[2] - seat.pos[2]]);
      const headYaw = Math.max(-1, Math.min(1, Math.atan2(Math.sin(p.yaw - yaw), Math.cos(p.yaw - yaw))));
      animatePlayerBody(b, p, { dt, t }, gunner ? 'stand' : 'seat', { hands, headYaw, headPitch: -p.pitch * 0.6, legY: vd.kind === 'hover' ? -0.5 : -0.55, lean: vd.kind === 'hover' ? 0.5 : 0.2, handRot: vd.kind === 'hover' ? [-0.9, 0, 0.3] : gunner ? [-0.3, 0, 0.5] : [-0.6, 0, 0.4] });
      return;
    }
    // the torso sits a little behind the eye line, as it does on a person
    b.root.position.set(px + Math.sin(p.yaw) * 0.14, py, pz + Math.cos(p.yaw) * 0.14);
    b.root.rotation.set(0, p.yaw, 0);
    // first person: hide the head, arms and chest (the camera sits inside them); keep the belt down
    b.helmet.visible = false; b.neck.visible = false; b.chest.visible = false;
    animatePlayerBody(b, p, { dt, t }, 'walk');
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
