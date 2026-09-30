// Stand-in pickups and FX for any contract name that has no art yet (never
// overwrites an existing file; the real jobs replace these). Not in the
// default job list: run explicitly with `node tools/forge/run.mjs _placeholders`.
export default async function (F) {
  const { THREE, M, G } = F;
  const exists = async (p) => (await fetch('/mod/' + p, { method: 'HEAD' })).ok;
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); return m; };
  const cyl = (r, h, mat, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y + h / 2, z); return m; };
  const sph = (r, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y + r, z); return m; };
  const label = (text, w, h, bg, fg) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 * h / w);
    const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg; g.font = `bold ${Math.round(c.height * 0.42)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  };
  const items = {
    A9MM: () => [box(0.03, 0.14, 0.05, M(0x222326, { metal: 0.5, rough: 0.4 })), box(0.02, 0.012, 0.04, M(0xc9a043, { metal: 0.8, rough: 0.3 }), 0, 0.14, 0)],
    A9BX: () => [box(0.22, 0.1, 0.14, label('9MM', 0.22, 0.1, '#6b5b3a', '#f1e3b0'))],
    ASHL: () => [0, 1, 2, 3].map((i) => { const m = cyl(0.012, 0.07, M(0xb3261e, { rough: 0.5 }), -0.04 + i * 0.027, 0, 0); m.rotation.z = Math.PI / 2; m.position.y = 0.012; return m; }),
    ASHB: () => [box(0.2, 0.08, 0.12, label('12 GA', 0.2, 0.08, '#8a1d17', '#ffe1c9'))],
    A556: () => [box(0.03, 0.18, 0.07, M(0x2a2c2f, { metal: 0.4, rough: 0.45 }))],
    A55B: () => [box(0.24, 0.12, 0.14, label('5.56', 0.24, 0.12, '#3a4a2e', '#e8f0c8'))],
    A762: () => [box(0.035, 0.16, 0.08, M(0x1f2124, { metal: 0.4, rough: 0.45 }))],
    AENC: (f) => [cyl(0.035, 0.12, M(0x223038, { metal: 0.6, rough: 0.3 })), cyl(0.028, 0.1, G(f === 'B' ? 0x90fff0 : 0x40e0c8), 0, 0.01, 0)],
    AENP: (f) => [cyl(0.07, 0.18, M(0x2a2238, { metal: 0.5, rough: 0.35 })), cyl(0.055, 0.15, G(f === 'B' ? 0xb0fff4 : 0x50f0d0), 0, 0.015, 0)],
    GFRG: () => [sph(0.045, M(0x3d4a2a, { rough: 0.6 })), cyl(0.012, 0.03, M(0x888888, { metal: 0.8 }), 0, 0.085, 0)],
    GDET: () => [cyl(0.06, 0.03, M(0x3a2a4a, { metal: 0.5, rough: 0.3 })), cyl(0.03, 0.035, G(0xff3030), 0, 0.0, 0)],
    HSTM: () => { const m = cyl(0.012, 0.14, M(0xe8f4ff, { rough: 0.2, opacity: 0.8 })); m.rotation.z = Math.PI / 2; m.position.y = 0.015; return [m]; },
    HMED: () => [box(0.2, 0.08, 0.14, label('+', 0.2, 0.08, '#eeeeee', '#d01818'))],
    HIMP: (f) => [sph(0.06, G({ A: 0x60ffc0, B: 0x80ffd0, C: 0xa0ffe0, D: 0x80ffd0 }[f])), sph(0.035, M(0x2a2238), 0, 0.03, 0)],
    AKEV: () => [box(0.32, 0.38, 0.08, M(0x2f3a2c, { detail: 'weave', rough: 0.9 }))],
    ATAC: () => [box(0.34, 0.4, 0.1, M(0x1c2126, { detail: 'weave', rough: 0.8 })), box(0.22, 0.2, 0.02, M(0x3a4048, { metal: 0.4 }), 0, 0.1, 0.06)],
    BATT: () => [cyl(0.02, 0.07, M(0x303030, { metal: 0.3 })), cyl(0.021, 0.02, M(0xd0a020, { metal: 0.6 }), 0, 0.05, 0)],
    KBLU: (f) => [box(0.09, 0.005, 0.055, f === 'B' ? G(0x6ab0ff) : M(0x2060d0, { rough: 0.4 }))],
    KRED: (f) => [box(0.09, 0.005, 0.055, f === 'B' ? G(0xff7060) : M(0xc02020, { rough: 0.4 }))],
    KYEL: (f) => [box(0.09, 0.005, 0.055, f === 'B' ? G(0xfff080) : M(0xd0b020, { rough: 0.4 }))],
    ODOS: () => [box(0.24, 0.015, 0.3, label('TOP SECRET', 0.24, 0.3, '#d9c28a', '#b01e18'))],
    OHDD: () => [box(0.16, 0.04, 0.22, M(0x3a3e44, { metal: 0.6, rough: 0.35 })), box(0.05, 0.005, 0.05, G(0x9b6bff), 0, 0.04, 0)],
    OCSF: () => [box(0.22, 0.02, 0.3, label('X-51', 0.22, 0.3, '#c9ab70', '#402a10'))],
    OSHD: (f) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), G(f === 'B' ? 0xd0a0ff : 0x9b6bff)); m.position.y = 0.09; m.scale.y = 1.8; return [m]; },
  };
  let made = 0;
  const lights = { hemi: 1.6, key: 2.2, fill: 0.7, rim: 0.8 };
  for (const [spr, build] of Object.entries(items)) {
    const frames = ['HIMP'].includes(spr) ? 'ABCD' : ['AENC', 'AENP', 'KBLU', 'KRED', 'KYEL', 'OSHD'].includes(spr) ? 'AB' : 'A';
    for (const f of frames) {
      if (await exists(`sprites/items/${spr}${f}0.png`)) continue;
      const root = new THREE.Group();
      build(f).forEach((m) => root.add(m));
      root.scale.setScalar(2.2);   // pickups read larger than life, as in Doom
      await F.spriteSet({ prefix: spr, dir: 'sprites/items', model: { root, pose() {} }, frames: [{ f, rot: 0, yaw: 0.6 }], bounds: { w: 1.4, top: 1.2, bottom: -0.05 }, elev: 25, lights });
      made++;
    }
  }
  // ---- FX painted on a canvas
  const fx = async (spr, frames, size, paint, anchor = 'center') => {
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (await exists(`sprites/fx/${spr}${f}0.png`)) continue;
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'); paint(g, size, i / Math.max(1, frames.length - 1), i);
      const data = new Uint8ClampedArray(g.getImageData(0, 0, size, size).data);
      await F.emit(`sprites/fx/${spr}${f}0.png`, { w: size, h: size, data }, [size / 2, anchor === 'bottom' ? size - 2 : size / 2]);
      made++;
    }
  };
  const blob = (g, s, r, cIn, cOut, a = 1) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, r); gr.addColorStop(0, cIn); gr.addColorStop(1, cOut); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; };
  const puffs = (g, s, k, n, col, spread) => { for (let j = 0; j < n; j++) { const a = j * 2.4, r = spread * k * s; const x = s / 2 + Math.cos(a) * r * (0.5 + (j % 3) * 0.25), y = s / 2 + Math.sin(a) * r * 0.8; const gr = g.createRadialGradient(x, y, 0, x, y, s * 0.18 * (0.6 + k)); gr.addColorStop(0, col(1)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.2 * (0.6 + k), 0, Math.PI * 2); g.fill(); } };
  await fx('PUFF', 'ABCD', 32, (g, s, k) => blob(g, s, s * (0.2 + 0.25 * k), `rgba(255,240,200,${1 - k * 0.8})`, 'rgba(120,110,100,0)'));
  await fx('SPRK', 'ABCD', 32, (g, s, k) => { g.strokeStyle = `rgba(255,${230 - k * 80},120,${1 - k * 0.7})`; g.lineWidth = 2; for (let j = 0; j < 6; j++) { const a = j * 1.05 + k; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * (0.2 + k * 0.25), s / 2 + Math.sin(a) * s * (0.2 + k * 0.25)); g.stroke(); } });
  await fx('EXPL', 'ABCDEFGH', 128, (g, s, k) => { puffs(g, s, k, 9, (a) => `rgba(${255},${Math.round(200 - k * 150)},${Math.round(80 - k * 60)},${a * (1 - k * 0.6)})`, 0.35); blob(g, s, s * 0.25 * (1 - k), `rgba(255,255,220,${1 - k})`, 'rgba(255,160,40,0)'); });
  await fx('FIRE', 'ABCDEFGH', 64, (g, s, k, i) => { for (let j = 0; j < 7; j++) { const x = s / 2 + Math.sin(j * 1.7 + i) * s * 0.15, h = s * (0.45 + 0.35 * Math.abs(Math.sin(j + i * 0.9))); const gr = g.createLinearGradient(x, s, x, s - h); gr.addColorStop(0, 'rgba(255,90,20,0.9)'); gr.addColorStop(0.5, 'rgba(255,180,50,0.7)'); gr.addColorStop(1, 'rgba(255,240,160,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, s - h / 2, s * 0.09, h / 2, 0, 0, Math.PI * 2); g.fill(); } }, 'bottom');
  await fx('SMOK', 'ABCDE', 64, (g, s, k) => puffs(g, s, k, 6, (a) => `rgba(90,90,95,${a * 0.6 * (1 - k * 0.5)})`, 0.25));
  const blood = (col) => (g, s, k) => { for (let j = 0; j < 8; j++) { const a = j * 0.8, r = s * (0.08 + k * 0.3); g.fillStyle = col; g.beginPath(); g.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, s * 0.07 * (1 - k * 0.5), 0, Math.PI * 2); g.fill(); } };
  await fx('BLDG', 'ABC', 32, blood('rgba(80,255,190,0.95)'));
  await fx('BLDR', 'ABC', 32, blood('rgba(170,10,10,0.95)'));
  await fx('OILB', 'ABC', 32, blood('rgba(12,12,14,0.95)'));
  await fx('CASE', 'ABCD', 16, (g, s, k, i) => { g.translate(s / 2, s / 2); g.rotate(i * 0.8); g.fillStyle = '#d4a93c'; g.fillRect(-2, -5, 4, 10); });
  await fx('SHEL', 'ABCD', 16, (g, s, k, i) => { g.translate(s / 2, s / 2); g.rotate(i * 0.8); g.fillStyle = '#b01e18'; g.fillRect(-2.5, -6, 5, 9); g.fillStyle = '#c9a043'; g.fillRect(-2.5, 3, 5, 3); });
  await fx('GLAS', 'ABCD', 32, (g, s, k, i) => { g.fillStyle = 'rgba(190,230,255,0.8)'; for (let j = 0; j < 5; j++) { g.beginPath(); const x = 6 + ((j * 7 + i * 3) % 20), y = 6 + ((j * 11 + i * 5) % 20); g.moveTo(x, y); g.lineTo(x + 4, y + 1); g.lineTo(x + 1, y + 5); g.fill(); } });
  await fx('TELF', 'ABCDEF', 96, (g, s, k) => { blob(g, s, s * (0.15 + 0.3 * Math.sin(k * Math.PI)), `rgba(200,255,230,${1 - k * 0.6})`, 'rgba(90,255,180,0)'); });
  const ball = (spr, inner, outer) => fx(spr, 'ABCDE', 48, (g, s, k, i) => i < 2 ? blob(g, s, s * (0.3 + 0.05 * i), inner, outer) : blob(g, s, s * (0.3 + 0.2 * (i - 1) / 3), inner.replace(/[\d.]+\)$/, `${1 - (i - 2) / 3})`), outer));
  await ball('PBLT', 'rgba(230,240,255,1)', 'rgba(140,180,255,0)');
  await ball('HPLS', 'rgba(200,255,240,1)', 'rgba(60,230,200,0)');
  await ball('PPLS', 'rgba(255,200,255,1)', 'rgba(180,80,255,0)');
  await ball('APLS', 'rgba(200,255,250,1)', 'rgba(80,255,220,0)');
  await ball('ASTB', 'rgba(255,230,255,1)', 'rgba(200,120,255,0)');
  await fx('ASCP', 'ABC', 24, (g, s, k, i) => blob(g, s, s * (0.35 + i * 0.1), 'rgba(220,180,255,1)', 'rgba(150,80,255,0)'));
  await fx('SNGB', 'ABCDEFGH', 96, (g, s, k, i) => { blob(g, s, s * (0.3 + (i > 1 ? (i - 1) * 0.04 : 0)), 'rgba(20,0,40,1)', 'rgba(160,80,255,0)'); g.strokeStyle = 'rgba(210,160,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2); g.stroke(); });
  await fx('FRAG', 'ABCD', 16, (g, s, k, i) => { g.fillStyle = '#3d4a2a'; g.beginPath(); g.arc(s / 2, s / 2, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#999'; g.fillRect(s / 2 - 1 + (i % 2), 2, 2, 4); });
  await fx('DETN', 'ABCD', 16, (g, s, k, i) => { g.fillStyle = '#3a2a4a'; g.beginPath(); g.arc(s / 2, s / 2, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = i % 2 ? '#ff3030' : '#801010'; g.beginPath(); g.arc(s / 2, s / 2, 3, 0, Math.PI * 2); g.fill(); });
  console.log('placeholders made', made);
}
