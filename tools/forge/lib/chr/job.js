// Render helper for character jobs: one call per sprite prefix.
//   renderChar(F, params, {
//     prefix, dir, root, poses: { A(rot) {...}, ... },
//     rot8: 'ABCDEFGH', rot0: 'IJKLM',
//     bounds, bounds0?, elev0?, lights?, before?(letter)
//   })
// params.frames (from the page URL, e.g. ?frames=AE) limits what is rendered while iterating;
// params.only=<PREFIX> skips other prefixes in multi-prefix jobs.
export async function renderChar(F, params, o) {
  if (params?.only && !params.only.split(',').includes(o.prefix)) return [];
  const want = params?.frames;
  const pick = (s) => [...(s || '')].filter((f) => !want || want.includes(f));
  const out = [];
  const t0 = performance.now();
  const model = {
    root: o.root,
    pose(f, rot) { o.reset?.(); o.poses[f](rot); o.after?.(f, rot); },
  };
  const f8 = pick(o.rot8), f0 = pick(o.rot0);
  // one scene: spriteSet adds root to a fresh scene per call, so re-parent is automatic
  if (f8.length) out.push(...await F.spriteSet({ prefix: o.prefix, dir: o.dir, model, frames: f8.map((f) => ({ f, rot: 8 })), bounds: o.bounds, pxPerM: params?.px ? +params.px : 64, lights: o.lights, ss: o.ss ?? 3, elev: o.elev ?? 0 }));
  if (f0.length) out.push(...await F.spriteSet({ prefix: o.prefix, dir: o.dir, model, frames: f0.map((f) => ({ f, rot: 0 })), bounds: o.bounds0 || o.bounds, pxPerM: params?.px ? +params.px : 64, lights: o.lights, ss: o.ss ?? 3, elev: o.elev0 ?? 0 }));
  console.warn(`[chr] ${o.prefix}: ${out.length} images in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return out;
}
