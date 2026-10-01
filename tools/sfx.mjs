// Synthesises every sound effect into mod/sounds/*.wav and writes mod/SNDINFO.txt.
// Procedural like the rest of the project: layered noise bursts, pitch-swept
// oscillators, FM, formant "voices" for creatures and people, and a small
// room reverb. 22050 Hz mono 16-bit (GZDoom plays WAV natively).
//   node tools/sfx.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'mod/sounds');
mkdirSync(OUT, { recursive: true });
const SR = 22050;

// ------------------------------------------------------------------ rng + dsp
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const env = (t, a, d, s = 0, r = 0, dur = 0) => {   // ADSR-ish; t seconds
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * (t - a) / d;
  if (!r) return s;
  return t < dur - r ? s : Math.max(0, s * (dur - t) / r);
};
const expDecay = (t, k) => Math.exp(-t * k);
// one-pole filters (state in closure)
function lp(cut) { let y = 0; const a = Math.exp(-2 * Math.PI * cut / SR); return (x, c) => { const aa = c ? Math.exp(-2 * Math.PI * c / SR) : a; y = x * (1 - aa) + y * aa; return y; }; }
function hp(cut) { const l = lp(cut); return (x, c) => x - l(x, c); }
function bp(f, q) { // biquad band-pass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, ff = f) => {
    const w = 2 * Math.PI * ff / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
    const y = (al * x - al * x2 + 2 * c * y1 - (1 - al) * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}
const osc = { sin: (p) => Math.sin(p * 2 * Math.PI), saw: (p) => 2 * (p - Math.floor(p + 0.5)), sq: (p) => (p % 1 < 0.5 ? 1 : -1), tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5) };

// layers write into a buffer
function noise(b, { t0 = 0, dur, amp = 1, a = 0.001, k = 20, lpf = 8000, hpf = 20, lpEnd, sustain = 0 }) {
  const L = lp(lpf), H = hp(hpf), n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && n0 + i < b.length; i++) {
    const t = i / SR, e = (t < a ? t / a : Math.max(sustain, expDecay(t - a, k))) * amp;
    const c = lpEnd ? lpf * Math.pow(lpEnd / lpf, t / dur) : 0;
    b[n0 + i] += H(L(rnd() * 2 - 1, c)) * e;
  }
}
function tone(b, { t0 = 0, dur, f0, f1 = f0, amp = 1, wave = 'sin', a = 0.002, k = 8, curve = 1, vib = 0, vibf = 6, sustain = 0 }) {
  const n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR); let ph = 0;
  for (let i = 0; i < n && n0 + i < b.length; i++) {
    const t = i / SR, u = Math.pow(t / dur, curve), f = f0 + (f1 - f0) * u + vib * Math.sin(2 * Math.PI * vibf * t);
    ph += f / SR;
    const e = (t < a ? t / a : Math.max(sustain, expDecay(t - a, k))) * amp;
    b[n0 + i] += osc[wave](ph) * e;
  }
}
function fm(b, { t0 = 0, dur, fc, fm: fmod, idx, idx1 = idx, amp = 1, a = 0.002, k = 6, fc1 = fc }) {
  const n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR); let pc = 0, pm = 0;
  for (let i = 0; i < n && n0 + i < b.length; i++) {
    const t = i / SR, u = t / dur, c = fc + (fc1 - fc) * u;
    pm += fmod / SR; pc += c / SR;
    const e = (t < a ? t / a : expDecay(t - a, k)) * amp;
    b[n0 + i] += Math.sin(2 * Math.PI * pc + (idx + (idx1 - idx) * u) * Math.sin(2 * Math.PI * pm)) * e;
  }
}
// formant voice: saw source through 3 band-passes (vowel), pitch contour, breath
const VOWEL = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010], o: [570, 840, 2410], u: [300, 870, 2240], er: [490, 1350, 1690], ah: [640, 1190, 2390] };
function voice(b, { t0 = 0, dur, f0, f1 = f0, vowel = 'a', vowel1, amp = 1, breath = 0.15, a = 0.02, rel = 0.1, growl = 0, q = 7 }) {
  const n0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const v0 = VOWEL[vowel], v1 = VOWEL[vowel1 || vowel];
  const B = [bp(v0[0], q), bp(v0[1], q), bp(v0[2], q)];
  let ph = 0;
  for (let i = 0; i < n && n0 + i < b.length; i++) {
    const t = i / SR, u = t / dur;
    const f = (f0 + (f1 - f0) * u) * (1 + growl * (rnd() - 0.5));
    ph += f / SR;
    const src = osc.saw(ph) * (1 - breath) + (rnd() * 2 - 1) * breath;
    const fr = v0.map((x, j) => x + (v1[j] - x) * u);
    const y = B[0](src, fr[0]) * 1.0 + B[1](src, fr[1]) * 0.6 + B[2](src, fr[2]) * 0.3;
    const e = Math.min(1, t / a) * Math.min(1, (dur - t) / rel) * amp;
    b[n0 + i] += y * e * 3;
  }
}
function reverb(b, mix = 0.25, size = 1) {
  const taps = [0.029, 0.037, 0.041, 0.053].map((x) => Math.floor(x * size * SR));
  const out = new Float32Array(b.length + Math.floor(0.6 * size * SR));
  out.set(b);
  const fb = 0.55;
  for (const d of taps) {
    const L = lp(3500);
    for (let i = d; i < out.length; i++) out[i] += L(out[i - d] * fb) * mix * 0.5;
  }
  return out;
}
function finish(b, gain = 0.9) {
  let peak = 1e-6; for (const x of b) peak = Math.max(peak, Math.abs(x));
  let end = b.length; while (end > 1 && Math.abs(b[end - 1]) < 0.0015 * peak) end--;
  const o = new Float32Array(end);
  for (let i = 0; i < end; i++) o[i] = Math.tanh((b[i] / peak) * gain * 1.2) * 0.95;   // soft clip
  // 3 ms fades at both ends to avoid clicks
  const f = Math.min(66, end >> 2); for (let i = 0; i < f; i++) { o[i] *= i / f; o[end - 1 - i] *= i / f; }
  return o;
}
function wav(samples) {
  const n = samples.length, h = Buffer.alloc(44 + n * 2);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 2, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) h.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return h;
}

// ------------------------------------------------------------------ recipes
// Each returns a Float32Array. Lump names are ≤ 8 chars.
const gun = (body, crack, tail, rev = 0.18) => () => {
  const b = buf(tail + 0.1);
  noise(b, { dur: 0.012, amp: 1.2, k: 400, lpf: 12000, hpf: 2000 });                 // crack
  noise(b, { dur: tail, amp: 1, k: body, lpf: crack, lpEnd: 400, hpf: 60 });         // body
  tone(b, { dur: 0.08, f0: 120, f1: 45, amp: 0.8, k: 30 });                           // thump
  return reverb(b, rev, 1.2);
};
const R = {
  // ---- human weapons
  'weapons/pistol': ['WPPISTOL', gun(28, 5000, 0.35)],
  'weapons/shotgun': ['WPSHOTGN', () => { const b = buf(0.8); noise(b, { dur: 0.02, amp: 1.3, k: 200, lpf: 12000, hpf: 1500 }); noise(b, { dur: 0.7, amp: 1.2, k: 7, lpf: 3200, lpEnd: 200, hpf: 40 }); tone(b, { dur: 0.25, f0: 90, f1: 35, amp: 1, k: 10 }); return reverb(b, 0.22, 1.4); }],
  'weapons/smg': ['WPSMG', gun(45, 4200, 0.22, 0.12)],
  'weapons/rifle': ['WPRIFLE', () => { const b = buf(0.45); noise(b, { dur: 0.01, amp: 1.3, k: 500, lpf: 14000, hpf: 2500 }); noise(b, { dur: 0.4, amp: 1, k: 22, lpf: 4500, lpEnd: 350, hpf: 80 }); tone(b, { dur: 0.06, f0: 180, f1: 60, amp: 0.7, k: 40 }); return reverb(b, 0.16, 1.3); }],
  'weapons/battlerifle': ['WPBATTLE', () => { const b = buf(0.5); noise(b, { dur: 0.012, amp: 1.4, k: 500, lpf: 15000, hpf: 3000 }); noise(b, { dur: 0.45, amp: 1.1, k: 16, lpf: 3800, lpEnd: 300, hpf: 70 }); tone(b, { dur: 0.1, f0: 140, f1: 45, amp: 0.9, k: 25 }); return reverb(b, 0.2, 1.4); }],
  'weapons/dryfire': ['WPDRY', () => { const b = buf(0.08); noise(b, { dur: 0.02, amp: 1, k: 300, lpf: 6000, hpf: 2500 }); tone(b, { dur: 0.03, f0: 2400, amp: 0.3, k: 200, wave: 'sq' }); return b; }],
  'weapons/magout': ['WPMAGOUT', () => { const b = buf(0.25); noise(b, { dur: 0.03, amp: 1, k: 120, lpf: 5000, hpf: 1200 }); noise(b, { t0: 0.08, dur: 0.1, amp: 0.6, k: 40, lpf: 2500, hpf: 300 }); return b; }],
  'weapons/magin': ['WPMAGIN', () => { const b = buf(0.2); noise(b, { dur: 0.015, amp: 1.2, k: 250, lpf: 7000, hpf: 1500 }); tone(b, { dur: 0.05, f0: 900, f1: 600, amp: 0.4, k: 60, wave: 'tri' }); noise(b, { t0: 0.05, dur: 0.02, amp: 0.8, k: 250, lpf: 6000, hpf: 2000 }); return b; }],
  'weapons/rack': ['WPRACK', () => { const b = buf(0.3); noise(b, { dur: 0.05, amp: 1, k: 60, lpf: 5000, hpf: 800 }); noise(b, { t0: 0.12, dur: 0.03, amp: 1.2, k: 150, lpf: 8000, hpf: 1500 }); tone(b, { t0: 0.12, dur: 0.06, f0: 1400, f1: 900, amp: 0.3, k: 50, wave: 'tri' }); return b; }],
  'weapons/pump': ['WPPUMP', () => { const b = buf(0.4); noise(b, { dur: 0.08, amp: 1, k: 30, lpf: 3000, hpf: 300 }); noise(b, { t0: 0.18, dur: 0.06, amp: 1.2, k: 60, lpf: 4000, hpf: 400 }); tone(b, { t0: 0.18, dur: 0.05, f0: 500, f1: 300, amp: 0.4, k: 50 }); return b; }],
  'weapons/shellin': ['WPSHELL', () => { const b = buf(0.15); noise(b, { dur: 0.02, amp: 1, k: 150, lpf: 4000, hpf: 600 }); tone(b, { dur: 0.04, f0: 700, f1: 500, amp: 0.3, k: 80 }); return b; }],
  'weapons/raise': ['WPRAISE', () => { const b = buf(0.25); noise(b, { dur: 0.2, amp: 0.7, k: 12, lpf: 2500, hpf: 400 }); noise(b, { t0: 0.15, dur: 0.02, amp: 0.8, k: 200, lpf: 6000, hpf: 1500 }); return b; }],
  'weapons/adsin': ['WPADSIN', () => { const b = buf(0.18); noise(b, { dur: 0.15, amp: 0.6, k: 20, lpf: 1800, hpf: 300 }); return b; }],
  'weapons/adsout': ['WPADSOUT', () => { const b = buf(0.15); noise(b, { dur: 0.12, amp: 0.5, k: 25, lpf: 1500, hpf: 300 }); return b; }],
  'weapons/casing': ['WPCASE', () => { const b = buf(0.2); for (const [t, f] of [[0, 4200], [0.07, 3900], [0.12, 4400]]) tone(b, { t0: t, dur: 0.06, f0: f, amp: 0.35, k: 70, wave: 'sin' }); return b; }],
  'weapons/shellcasing': ['WPSHCASE', () => { const b = buf(0.25); for (const [t, f] of [[0, 1400], [0.09, 1250]]) { tone(b, { t0: t, dur: 0.07, f0: f, amp: 0.3, k: 60 }); noise(b, { t0: t, dur: 0.02, amp: 0.3, k: 200, lpf: 3000, hpf: 800 }); } return b; }],
  'weapons/knifeswing': ['WPKNIFSW', () => { const b = buf(0.25); noise(b, { dur: 0.22, amp: 1, a: 0.06, k: 18, lpf: 5000, lpEnd: 1800, hpf: 900 }); return b; }],
  'weapons/knifehit': ['WPKNIFHT', () => { const b = buf(0.25); noise(b, { dur: 0.15, amp: 1, k: 25, lpf: 1500, hpf: 80 }); tone(b, { dur: 0.08, f0: 200, f1: 80, amp: 0.8, k: 30 }); return b; }],
  'weapons/knifewall': ['WPKNIFWL', () => { const b = buf(0.3); tone(b, { dur: 0.25, f0: 3100, amp: 0.35, k: 18 }); tone(b, { dur: 0.25, f0: 4700, amp: 0.2, k: 22 }); noise(b, { dur: 0.02, amp: 0.8, k: 200, lpf: 9000, hpf: 2000 }); return b; }],
  'weapons/bladeswing': ['WPBLDSW', () => { const b = buf(0.35); noise(b, { dur: 0.3, amp: 0.9, a: 0.08, k: 12, lpf: 3000, hpf: 500 }); fm(b, { dur: 0.3, fc: 300, fc1: 700, fm: 90, idx: 4, amp: 0.4, a: 0.05, k: 8 }); return b; }],
  'weapons/bladehit': ['WPBLDHT', () => { const b = buf(0.35); noise(b, { dur: 0.2, amp: 1, k: 18, lpf: 2000, hpf: 60 }); fm(b, { dur: 0.3, fc: 180, fm: 55, idx: 6, amp: 0.6, k: 10 }); return b; }],
  // ---- alien weapons
  'weapons/stinger': ['WPSTING', () => { const b = buf(0.35); fm(b, { dur: 0.3, fc: 1600, fc1: 500, fm: 330, idx: 5, idx1: 1, amp: 0.8, k: 10 }); noise(b, { dur: 0.05, amp: 0.4, k: 80, lpf: 9000, hpf: 3000 }); return reverb(b, 0.2); }],
  'weapons/scatter': ['WPSCATTR', () => { const b = buf(0.6); for (let i = 0; i < 5; i++) fm(b, { t0: i * 0.012, dur: 0.4, fc: 900 - i * 90, fc1: 150, fm: 210 + i * 30, idx: 7, idx1: 1, amp: 0.4, k: 7 }); noise(b, { dur: 0.3, amp: 0.7, k: 12, lpf: 2500, hpf: 200 }); return reverb(b, 0.22, 1.2); }],
  'weapons/plasmasmg': ['WPPLSMG', () => { const b = buf(0.18); fm(b, { dur: 0.15, fc: 1100, fc1: 600, fm: 700, idx: 3, amp: 0.8, k: 22 }); tone(b, { dur: 0.1, f0: 2200, f1: 1600, amp: 0.2, k: 30, wave: 'sq' }); return b; }],
  'weapons/singcharge': ['WPSNGCHG', () => { const b = buf(1.3); fm(b, { dur: 1.25, fc: 60, fc1: 900, fm: 30, idx: 8, idx1: 2, amp: 0.8, a: 0.9, k: 0.5 }); noise(b, { dur: 1.2, amp: 0.3, a: 1.0, k: 0.5, lpf: 1200, lpEnd: 6000, hpf: 200 }); return b; }],
  'weapons/singfire': ['WPSNGFIR', () => { const b = buf(1.2); fm(b, { dur: 1.1, fc: 220, fc1: 40, fm: 37, idx: 12, idx1: 2, amp: 1, k: 3 }); noise(b, { dur: 0.9, amp: 0.9, k: 5, lpf: 3000, lpEnd: 200, hpf: 30 }); return reverb(b, 0.35, 2); }],
  'weapons/singboom': ['WPSNGBOM', () => { const b = buf(2.0); tone(b, { dur: 1.8, f0: 70, f1: 25, amp: 1, k: 1.8 }); noise(b, { dur: 1.8, amp: 1, k: 2.5, lpf: 1500, lpEnd: 120, hpf: 20 }); fm(b, { dur: 1.5, fc: 400, fc1: 60, fm: 13, idx: 20, amp: 0.4, k: 2 }); return reverb(b, 0.35, 2.5); }],
  'weapons/vent': ['WPVENT', () => { const b = buf(1.4); noise(b, { dur: 1.3, amp: 0.9, a: 0.03, k: 1.5, lpf: 7000, lpEnd: 2000, hpf: 1200 }); tone(b, { dur: 0.3, f0: 1200, f1: 300, amp: 0.3, k: 6 }); return b; }],
  'weapons/boltimpact': ['WPBOLTHT', () => { const b = buf(0.3); fm(b, { dur: 0.25, fc: 700, fc1: 200, fm: 170, idx: 6, amp: 0.7, k: 14 }); noise(b, { dur: 0.1, amp: 0.5, k: 40, lpf: 5000, hpf: 800 }); return b; }],
  'weapons/plasmahit': ['WPPLSHIT', () => { const b = buf(0.3); fm(b, { dur: 0.25, fc: 500, fc1: 150, fm: 90, idx: 5, amp: 0.6, k: 12 }); noise(b, { dur: 0.15, amp: 0.6, k: 25, lpf: 3000, hpf: 300 }); return b; }],
  // ---- grenades / explosions
  'weapons/grenpin': ['WPGRNPIN', () => { const b = buf(0.25); tone(b, { dur: 0.08, f0: 3800, amp: 0.3, k: 40 }); noise(b, { t0: 0.1, dur: 0.05, amp: 0.7, k: 80, lpf: 5000, hpf: 1500 }); return b; }],
  'weapons/detarm': ['WPDETARM', () => { const b = buf(0.5); for (let i = 0; i < 3; i++) fm(b, { t0: i * 0.12, dur: 0.1, fc: 900 + i * 300, fm: 50, idx: 3, amp: 0.5, k: 20 }); return b; }],
  'weapons/grenthrow': ['WPGRNTHR', () => { const b = buf(0.3); noise(b, { dur: 0.25, amp: 0.8, a: 0.05, k: 14, lpf: 2500, hpf: 400 }); return b; }],
  'weapons/grenbounce': ['WPGRNBNC', () => { const b = buf(0.15); tone(b, { dur: 0.1, f0: 1100, f1: 900, amp: 0.4, k: 40, wave: 'tri' }); noise(b, { dur: 0.03, amp: 0.6, k: 120, lpf: 4000, hpf: 800 }); return b; }],
  'weapons/explode': ['WPEXPLOD', () => { const b = buf(1.8); tone(b, { dur: 1.2, f0: 80, f1: 30, amp: 1, k: 3.5 }); noise(b, { dur: 1.6, amp: 1.2, k: 3, lpf: 4000, lpEnd: 150, hpf: 25 }); noise(b, { dur: 0.05, amp: 1, k: 90, lpf: 12000, hpf: 2000 }); return reverb(b, 0.3, 2); }],
  'weapons/detstick': ['WPDETSTK', () => { const b = buf(0.2); noise(b, { dur: 0.06, amp: 0.8, k: 60, lpf: 1500, hpf: 100 }); fm(b, { dur: 0.15, fc: 600, fm: 40, idx: 5, amp: 0.4, k: 20 }); return b; }],
  'weapons/detbeep': ['WPDETBEP', () => { const b = buf(0.12); fm(b, { dur: 0.1, fc: 1900, fm: 95, idx: 2, amp: 0.6, k: 20 }); return b; }],
  'weapons/detboom': ['WPDETBOM', () => { const b = buf(2.2); tone(b, { dur: 1.6, f0: 65, f1: 22, amp: 1, k: 2.5 }); noise(b, { dur: 2.0, amp: 1.3, k: 2.2, lpf: 5000, lpEnd: 120, hpf: 20 }); fm(b, { dur: 1.0, fc: 800, fc1: 90, fm: 23, idx: 15, amp: 0.4, k: 3 }); return reverb(b, 0.35, 2.4); }],
  // ---- items
  'items/weapon': ['ITWEAPON', () => { const b = buf(0.4); noise(b, { dur: 0.05, amp: 1, k: 60, lpf: 4000, hpf: 600 }); noise(b, { t0: 0.1, dur: 0.03, amp: 1.2, k: 150, lpf: 8000, hpf: 1500 }); tone(b, { t0: 0.1, dur: 0.1, f0: 1200, f1: 800, amp: 0.3, k: 30, wave: 'tri' }); return b; }],
  'items/ammo': ['ITAMMO', () => { const b = buf(0.2); noise(b, { dur: 0.04, amp: 1, k: 90, lpf: 5000, hpf: 1000 }); tone(b, { t0: 0.02, dur: 0.08, f0: 1500, amp: 0.25, k: 40, wave: 'tri' }); return b; }],
  'items/energy': ['ITENERGY', () => { const b = buf(0.4); fm(b, { dur: 0.35, fc: 500, fc1: 1300, fm: 70, idx: 4, amp: 0.6, k: 7 }); return b; }],
  'items/health': ['ITHEALTH', () => { const b = buf(0.3); tone(b, { dur: 0.1, f0: 660, amp: 0.5, k: 20, wave: 'tri' }); tone(b, { t0: 0.09, dur: 0.18, f0: 990, amp: 0.5, k: 12, wave: 'tri' }); return b; }],
  'items/implant': ['ITIMPLNT', () => { const b = buf(1.2); fm(b, { dur: 1.1, fc: 220, fc1: 880, fm: 110, idx: 5, idx1: 1, amp: 0.7, a: 0.2, k: 2 }); voice(b, { dur: 1.0, f0: 220, f1: 330, vowel: 'o', vowel1: 'a', amp: 0.3, breath: 0.4 }); return reverb(b, 0.3, 1.5); }],
  'items/armor': ['ITARMOR', () => { const b = buf(0.4); noise(b, { dur: 0.3, amp: 0.8, a: 0.02, k: 10, lpf: 1500, hpf: 100 }); noise(b, { t0: 0.2, dur: 0.05, amp: 0.8, k: 60, lpf: 3000, hpf: 400 }); return b; }],
  'items/key': ['ITKEY', () => { const b = buf(0.35); tone(b, { dur: 0.08, f0: 1320, amp: 0.4, k: 25, wave: 'sq' }); tone(b, { t0: 0.1, dur: 0.18, f0: 1760, amp: 0.4, k: 14, wave: 'sq' }); return b; }],
  'items/objective': ['ITOBJECT', () => { const b = buf(0.9); [523, 659, 784, 1047].forEach((f, i) => tone(b, { t0: i * 0.1, dur: 0.4, f0: f, amp: 0.35, k: 6, wave: 'tri' })); return reverb(b, 0.25); }],
  'items/flashclick': ['ITFLCLIK', () => { const b = buf(0.08); noise(b, { dur: 0.015, amp: 1, k: 300, lpf: 7000, hpf: 2000 }); noise(b, { t0: 0.03, dur: 0.01, amp: 0.6, k: 300, lpf: 5000, hpf: 1500 }); return b; }],
  'items/flashempty': ['ITFLEMPT', () => { const b = buf(0.3); tone(b, { dur: 0.25, f0: 300, f1: 120, amp: 0.4, k: 6, wave: 'sq' }); return b; }],
  'items/switchgren': ['ITSWGREN', () => { const b = buf(0.15); tone(b, { dur: 0.05, f0: 900, amp: 0.4, k: 40, wave: 'sq' }); tone(b, { t0: 0.06, dur: 0.05, f0: 1200, amp: 0.4, k: 40, wave: 'sq' }); return b; }],
  // ---- player
  'player/dive': ['PLDIVE', () => { const b = buf(0.35); noise(b, { dur: 0.3, amp: 0.7, a: 0.05, k: 8, lpf: 2000, hpf: 300 }); voice(b, { dur: 0.2, f0: 150, f1: 120, vowel: 'ah', amp: 0.5, breath: 0.5 }); return b; }],
  'player/diveland': ['PLDIVLND', () => { const b = buf(0.5); tone(b, { dur: 0.2, f0: 90, f1: 40, amp: 1, k: 15 }); noise(b, { dur: 0.4, amp: 0.9, k: 9, lpf: 1200, hpf: 50 }); voice(b, { t0: 0.02, dur: 0.18, f0: 130, f1: 100, vowel: 'u', amp: 0.4, breath: 0.4 }); return b; }],
  'player/clamber': ['PLCLAMB', () => { const b = buf(0.45); noise(b, { dur: 0.1, amp: 0.8, k: 30, lpf: 2500, hpf: 200 }); noise(b, { t0: 0.18, dur: 0.1, amp: 0.7, k: 30, lpf: 2000, hpf: 200 }); voice(b, { t0: 0.05, dur: 0.3, f0: 140, f1: 170, vowel: 'u', vowel1: 'ah', amp: 0.45, breath: 0.45 }); return b; }],
  'marsh/pain': ['PLPAIN', () => { const b = buf(0.4); voice(b, { dur: 0.35, f0: 170, f1: 120, vowel: 'ah', vowel1: 'u', amp: 1, growl: 0.1, breath: 0.25 }); return b; }],
  'marsh/death': ['PLDEATH', () => { const b = buf(1.1); voice(b, { dur: 1.0, f0: 180, f1: 80, vowel: 'ah', vowel1: 'o', amp: 1, growl: 0.15, breath: 0.3, rel: 0.4 }); return reverb(b, 0.2); }],
  'marsh/xdeath': ['PLXDEATH', () => { const b = buf(1.0); voice(b, { dur: 0.6, f0: 220, f1: 90, vowel: 'a', vowel1: 'er', amp: 1, growl: 0.3, breath: 0.3 }); noise(b, { dur: 0.6, amp: 0.8, k: 5, lpf: 1500, hpf: 100 }); return b; }],
  'marsh/grunt': ['PLGRUNT', () => { const b = buf(0.3); voice(b, { dur: 0.22, f0: 140, f1: 110, vowel: 'u', amp: 0.8, breath: 0.35 }); return b; }],
  'marsh/land': ['PLLAND', () => { const b = buf(0.2); tone(b, { dur: 0.12, f0: 80, f1: 40, amp: 1, k: 20 }); noise(b, { dur: 0.1, amp: 0.6, k: 30, lpf: 900, hpf: 40 }); return b; }],
  'marsh/usefail': ['PLUSEFL', () => { const b = buf(0.3); voice(b, { dur: 0.25, f0: 130, f1: 150, vowel: 'u', vowel1: 'ah', amp: 0.7, breath: 0.4 }); return b; }],
};

// ---- creatures: formant voices with character
const creature = (name, f0, f1, v0, v1, dur, growl, breath, extra) => () => { const b = buf(dur + 0.3); voice(b, { dur, f0, f1, vowel: v0, vowel1: v1, amp: 1, growl, breath }); if (extra) extra(b); return reverb(b, 0.22, 1.3); };
const clicks = (b, n, t0 = 0, sp = 0.035, f = 2600) => { for (let i = 0; i < n; i++) { tone(b, { t0: t0 + i * sp * (0.7 + rnd() * 0.6), dur: 0.02, f0: f * (0.8 + rnd() * 0.4), amp: 0.5, k: 200, wave: 'sq' }); } };
Object.assign(R, {
  'thrall/sight': ['THSIGHT', creature('', 110, 70, 'o', 'u', 0.9, 0.35, 0.35, (b) => noise(b, { dur: 0.9, amp: 0.4, k: 2, lpf: 600, hpf: 80 }))],
  'thrall/pain': ['THPAIN', creature('', 140, 90, 'ah', 'u', 0.35, 0.4, 0.4)],
  'thrall/death': ['THDEATH', creature('', 120, 50, 'o', 'u', 1.0, 0.45, 0.4, (b) => noise(b, { t0: 0.3, dur: 0.8, amp: 0.5, k: 3, lpf: 700, hpf: 60 }))],
  'thrall/active': ['THACTIVE', creature('', 90, 85, 'u', 'o', 0.8, 0.5, 0.5)],
  'grey/sight': ['GRSIGHT', () => { const b = buf(0.8); clicks(b, 14, 0, 0.035, 2600); fm(b, { t0: 0.2, dur: 0.5, fc: 700, fc1: 1400, fm: 17, idx: 6, amp: 0.4, k: 4 }); return reverb(b, 0.2); }],
  'grey/pain': ['GRPAIN', () => { const b = buf(0.4); fm(b, { dur: 0.35, fc: 1300, fc1: 800, fm: 45, idx: 7, amp: 0.8, k: 8 }); clicks(b, 4, 0.05); return b; }],
  'grey/death': ['GRDEATH', () => { const b = buf(1.2); fm(b, { dur: 1.1, fc: 1400, fc1: 250, fm: 23, idx: 9, idx1: 2, amp: 0.8, k: 2.5 }); clicks(b, 10, 0.3, 0.06, 1800); return reverb(b, 0.25); }],
  'grey/active': ['GRACTIVE', () => { const b = buf(0.7); clicks(b, 12, 0, 0.05, 3000); return b; }],
  'grey/claw': ['GRCLAW', () => { const b = buf(0.25); noise(b, { dur: 0.2, amp: 1, a: 0.02, k: 20, lpf: 4000, hpf: 800 }); return b; }],
  'grey/boltfire': ['GRBOLTF', () => { const b = buf(0.6); fm(b, { dur: 0.5, fc: 400, fc1: 900, fm: 120, idx: 5, amp: 0.7, a: 0.05, k: 5 }); voice(b, { dur: 0.4, f0: 600, f1: 700, vowel: 'i', amp: 0.3, breath: 0.2 }); return reverb(b, 0.25); }],
  'grey/bolthit': ['GRBOLTH', () => { const b = buf(0.4); fm(b, { dur: 0.35, fc: 800, fc1: 200, fm: 60, idx: 8, amp: 0.7, k: 9 }); return b; }],
  'hybrid/sight': ['HYSIGHT', creature('', 95, 80, 'er', 'o', 0.7, 0.2, 0.55, (b) => noise(b, { dur: 0.7, amp: 0.5, k: 2, lpf: 2500, hpf: 900 }))],
  'hybrid/pain': ['HYPAIN', creature('', 120, 90, 'ah', 'er', 0.3, 0.25, 0.5)],
  'hybrid/death': ['HYDEATH', creature('', 110, 45, 'er', 'u', 1.0, 0.3, 0.55)],
  'hybrid/active': ['HYACTIVE', () => { const b = buf(1.0); noise(b, { dur: 0.45, amp: 0.7, a: 0.2, k: 3, lpf: 2200, hpf: 900 }); noise(b, { t0: 0.5, dur: 0.45, amp: 0.5, a: 0.2, k: 3, lpf: 1800, hpf: 700 }); return b; }],
  'hybrid/fire': ['HYFIRE', () => { const b = buf(0.25); fm(b, { dur: 0.2, fc: 900, fc1: 400, fm: 330, idx: 4, amp: 0.7, k: 14 }); return b; }],
  'stalker/sight': ['STSIGHT', creature('', 75, 55, 'a', 'o', 1.1, 0.6, 0.35, (b) => noise(b, { dur: 1.0, amp: 0.5, k: 1.5, lpf: 500, hpf: 40 }))],
  'stalker/pain': ['STPAIN', creature('', 110, 70, 'a', 'er', 0.4, 0.6, 0.4)],
  'stalker/death': ['STDEATH', creature('', 90, 35, 'a', 'u', 1.3, 0.6, 0.4)],
  'stalker/active': ['STACTIVE', creature('', 60, 58, 'o', 'u', 1.0, 0.7, 0.5)],
  'stalker/claw': ['STCLAW', () => { const b = buf(0.3); noise(b, { dur: 0.25, amp: 1, a: 0.01, k: 14, lpf: 3000, hpf: 300 }); tone(b, { dur: 0.1, f0: 150, f1: 60, amp: 0.6, k: 25 }); return b; }],
  'probe/sight': ['PRSIGHT', () => { const b = buf(1.0); fm(b, { dur: 0.9, fc: 330, fc1: 660, fm: 6, idx: 20, amp: 0.6, k: 2 }); tone(b, { dur: 0.9, f0: 1760, f1: 1320, amp: 0.2, k: 3, wave: 'sq' }); return b; }],
  'probe/pain': ['PRPAIN', () => { const b = buf(0.4); fm(b, { dur: 0.35, fc: 600, fm: 97, idx: 10, amp: 0.7, k: 8 }); noise(b, { dur: 0.1, amp: 0.4, k: 40, lpf: 6000, hpf: 1500 }); return b; }],
  'probe/death': ['PRDEATH', () => { const b = buf(1.5); fm(b, { dur: 0.8, fc: 800, fc1: 60, fm: 31, idx: 12, amp: 0.7, k: 3 }); noise(b, { t0: 0.3, dur: 1.1, amp: 1, k: 3, lpf: 4000, lpEnd: 200, hpf: 30 }); return reverb(b, 0.3, 1.8); }],
  'probe/active': ['PRACTIVE', () => { const b = buf(1.5); fm(b, { dur: 1.4, fc: 180, fm: 3, idx: 25, amp: 0.4, a: 0.3, k: 0.6 }); return b; }],
  'probe/fire': ['PRFIRE', () => { const b = buf(0.5); fm(b, { dur: 0.45, fc: 200, fc1: 800, fm: 50, idx: 9, amp: 0.8, k: 5 }); return b; }],
  'probe/pulsehit': ['PRPULSEH', () => { const b = buf(0.5); fm(b, { dur: 0.45, fc: 500, fc1: 90, fm: 40, idx: 10, amp: 0.8, k: 6 }); noise(b, { dur: 0.3, amp: 0.5, k: 10, lpf: 2500, hpf: 100 }); return b; }],
  'overseer/sight': ['OVSIGHT', () => { const b = buf(2.0); [110, 165, 220, 277].forEach((f, i) => voice(b, { t0: i * 0.08, dur: 1.7, f0: f, f1: f * 1.06, vowel: 'o', vowel1: 'a', amp: 0.4, breath: 0.25, a: 0.4, rel: 0.6 })); return reverb(b, 0.45, 2.5); }],
  'overseer/pain': ['OVPAIN', () => { const b = buf(0.6); [220, 330].forEach((f) => voice(b, { dur: 0.5, f0: f, f1: f * 0.8, vowel: 'a', vowel1: 'e', amp: 0.5, breath: 0.2 })); return reverb(b, 0.3); }],
  'overseer/death': ['OVDEATH', () => { const b = buf(2.5); [110, 146, 196, 262].forEach((f) => voice(b, { dur: 2.2, f0: f, f1: f * 0.5, vowel: 'a', vowel1: 'u', amp: 0.4, breath: 0.3, rel: 1.0 })); return reverb(b, 0.45, 2.5); }],
  'overseer/active': ['OVACTIVE', () => { const b = buf(1.6); [147, 220].forEach((f) => voice(b, { dur: 1.4, f0: f, f1: f, vowel: 'u', vowel1: 'o', amp: 0.35, breath: 0.3, a: 0.4, rel: 0.5 })); return reverb(b, 0.4, 2); }],
  'overseer/lancehit': ['OVLANCE', () => { const b = buf(1.5); noise(b, { dur: 1.3, amp: 1.2, k: 3, lpf: 5000, lpEnd: 200, hpf: 40 }); fm(b, { dur: 1.0, fc: 1200, fc1: 100, fm: 19, idx: 14, amp: 0.6, k: 3 }); return reverb(b, 0.35, 2); }],
  'hive/sight': ['HVSIGHT', () => { const b = buf(3.0); [55, 82, 110].forEach((f) => voice(b, { dur: 2.6, f0: f, f1: f * 0.9, vowel: 'o', vowel1: 'u', amp: 0.5, breath: 0.35, growl: 0.2, a: 0.5, rel: 0.8 })); noise(b, { dur: 2.8, amp: 0.4, a: 0.5, k: 0.8, lpf: 300, hpf: 20 }); return reverb(b, 0.5, 3); }],
  'hive/pain': ['HVPAIN', () => { const b = buf(1.0); voice(b, { dur: 0.8, f0: 70, f1: 50, vowel: 'a', vowel1: 'o', amp: 0.8, growl: 0.4, breath: 0.3 }); return reverb(b, 0.4, 2.5); }],
  'hive/death': ['HVDEATH', () => { const b = buf(4.0); [45, 67, 90, 135].forEach((f) => voice(b, { dur: 3.6, f0: f, f1: f * 0.4, vowel: 'a', vowel1: 'u', amp: 0.45, growl: 0.35, breath: 0.35, rel: 1.5 })); noise(b, { dur: 3.8, amp: 0.8, k: 0.8, lpf: 800, lpEnd: 80, hpf: 20 }); return reverb(b, 0.5, 3); }],
  'hive/active': ['HVACTIVE', () => { const b = buf(2.5); fm(b, { dur: 2.4, fc: 55, fm: 0.8, idx: 30, amp: 0.6, a: 0.6, k: 0.7 }); return reverb(b, 0.4, 3); }],
  'hive/rumble': ['HVRUMBLE', () => { const b = buf(4.0); noise(b, { dur: 3.9, amp: 1.2, a: 0.4, k: 0.6, lpf: 180, hpf: 15 }); tone(b, { dur: 3.9, f0: 38, f1: 30, amp: 0.8, a: 0.4, k: 0.6 }); return b; }],
  'hive/shielddown': ['HVSHIELD', () => { const b = buf(2.0); fm(b, { dur: 1.8, fc: 900, fc1: 60, fm: 7, idx: 18, amp: 0.8, k: 1.6 }); noise(b, { dur: 1.5, amp: 0.6, k: 2, lpf: 6000, lpEnd: 300, hpf: 200 }); return reverb(b, 0.45, 3); }],
  'hive/conduit': ['HVCONDT', () => { const b = buf(1.5); noise(b, { dur: 1.3, amp: 1, k: 3, lpf: 6000, lpEnd: 300, hpf: 100 }); fm(b, { dur: 1.2, fc: 600, fc1: 80, fm: 110, idx: 9, amp: 0.6, k: 3 }); return reverb(b, 0.3, 2); }],
  // ---- people
  'npc/scream': ['NPSCREAM', () => { const b = buf(1.0); voice(b, { dur: 0.9, f0: 330, f1: 440, vowel: 'a', vowel1: 'e', amp: 1, breath: 0.2, growl: 0.05, a: 0.05, rel: 0.3 }); return reverb(b, 0.2); }],
  'npc/pain': ['NPPAIN', () => { const b = buf(0.4); voice(b, { dur: 0.35, f0: 240, f1: 180, vowel: 'ah', vowel1: 'u', amp: 1, breath: 0.25 }); return b; }],
  'npc/death': ['NPDEATH', () => { const b = buf(1.1); voice(b, { dur: 1.0, f0: 260, f1: 110, vowel: 'a', vowel1: 'o', amp: 1, breath: 0.3, rel: 0.5 }); return reverb(b, 0.2); }],
  'npc/whimper': ['NPWHIMP', () => { const b = buf(1.3); for (let i = 0; i < 3; i++) voice(b, { t0: i * 0.4, dur: 0.3, f0: 380, f1: 300, vowel: 'i', vowel1: 'u', amp: 0.6, breath: 0.5 }); return b; }],
  'npc/scientist': ['NPSCI', () => { const b = buf(0.9); [['a', 'e', 0], ['o', 'i', 0.25], ['e', 'a', 0.5]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.22, f0: 190 + rnd() * 40, f1: 170, vowel: v0, vowel1: v1, amp: 0.7, breath: 0.2 })); return b; }],
  'npc/guardhelp': ['NPGRDHLP', () => { const b = buf(1.0); [['o', 'e', 0], ['ah', 'u', 0.3]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.3, f0: 140, f1: 120, vowel: v0, vowel1: v1, amp: 0.7, breath: 0.45 })); return b; }],
  'npc/guardup': ['NPGRDUP', () => { const b = buf(0.8); [['a', 'i', 0], ['o', 'e', 0.22]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.22, f0: 150, f1: 165, vowel: v0, vowel1: v1, amp: 0.7, breath: 0.25 })); return b; }],
  'npc/guarddeath': ['NPGRDDTH', () => { const b = buf(1.0); voice(b, { dur: 0.9, f0: 170, f1: 70, vowel: 'ah', vowel1: 'o', amp: 1, breath: 0.35, rel: 0.4 }); return b; }],
  'npc/guardpain': ['NPGRDPN', () => { const b = buf(0.4); voice(b, { dur: 0.3, f0: 180, f1: 130, vowel: 'ah', vowel1: 'er', amp: 1, breath: 0.3 }); return b; }],
  'npc/guardsight': ['NPGRDSGT', () => { const b = buf(0.6); [['o', 'e', 0], ['a', 'o', 0.18]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.18, f0: 160, f1: 150, vowel: v0, vowel1: v1, amp: 0.7, breath: 0.2 })); return b; }],
  'npc/revivestart': ['NPREVIVE', () => { const b = buf(0.4); noise(b, { dur: 0.3, amp: 0.5, a: 0.05, k: 8, lpf: 1500, hpf: 200 }); tone(b, { dur: 0.15, f0: 880, amp: 0.2, k: 15, wave: 'tri' }); return b; }],
  // ---- IRIS / radio
  'iris/chirp': ['IRCHIRP', () => { const b = buf(0.25); tone(b, { dur: 0.06, f0: 1800, f1: 2400, amp: 0.4, k: 30, wave: 'sq' }); tone(b, { t0: 0.07, dur: 0.08, f0: 2400, f1: 3000, amp: 0.3, k: 30, wave: 'sq' }); return b; }],
  'iris/radio': ['IRRADIO', () => { const b = buf(0.35); noise(b, { dur: 0.3, amp: 0.6, k: 10, lpf: 3500, hpf: 900 }); tone(b, { dur: 0.05, f0: 1000, amp: 0.3, k: 40, wave: 'sq' }); return b; }],
  'iris/objective': ['IROBJ', () => { const b = buf(0.8); [659, 880, 1319].forEach((f, i) => tone(b, { t0: i * 0.09, dur: 0.35, f0: f, amp: 0.35, k: 6, wave: 'sq' })); return reverb(b, 0.2); }],
  // ---- world
  'world/warpin': ['WOWARPIN', () => { const b = buf(0.9); fm(b, { dur: 0.8, fc: 120, fc1: 1200, fm: 30, idx: 10, amp: 0.7, a: 0.3, k: 3 }); noise(b, { dur: 0.7, amp: 0.4, a: 0.3, k: 3, lpf: 1000, lpEnd: 6000, hpf: 300 }); return reverb(b, 0.3); }],
  'world/hackstart': ['WOHACKST', () => { const b = buf(0.8); [440, 660, 880, 1320].forEach((f, i) => tone(b, { t0: i * 0.07, dur: 0.12, f0: f, amp: 0.3, k: 20, wave: 'sq' })); noise(b, { t0: 0.3, dur: 0.4, amp: 0.3, k: 6, lpf: 5000, hpf: 2000 }); return b; }],
  'world/hackloop': ['WOHACKLP', () => { const b = buf(2.0); for (let i = 0; i < 24; i++) tone(b, { t0: i * 0.0833, dur: 0.05, f0: [1200, 1600, 900, 2000][i % 4] * (1 + (rnd() - 0.5) * 0.1), amp: 0.15, k: 40, wave: 'sq' }); fm(b, { dur: 2.0, fc: 60, fm: 2, idx: 3, amp: 0.3, a: 0.001, k: 0, sustain: 1 }); return b; }],
  'world/hackdone': ['WOHACKDN', () => { const b = buf(1.0); [523, 784, 1047, 1568].forEach((f, i) => tone(b, { t0: i * 0.08, dur: 0.5, f0: f, amp: 0.35, k: 5, wave: 'tri' })); return reverb(b, 0.3); }],
  'world/wavealarm': ['WOALARM', () => { const b = buf(1.4); for (let i = 0; i < 3; i++) tone(b, { t0: i * 0.45, dur: 0.35, f0: 700, f1: 950, amp: 0.5, k: 1, wave: 'saw' }); return reverb(b, 0.3, 1.5); }],
  'world/exitopen': ['WOEXITOP', () => { const b = buf(1.5); noise(b, { dur: 1.4, amp: 0.8, a: 0.2, k: 1.5, lpf: 800, hpf: 60 }); tone(b, { dur: 1.3, f0: 55, f1: 70, amp: 0.6, a: 0.2, k: 1.5 }); return reverb(b, 0.3, 2); }],
  'world/fire': ['WOFIRE', () => { const b = buf(3.0); noise(b, { dur: 3.0, amp: 0.6, a: 0.001, k: 0, sustain: 1, lpf: 900, hpf: 60 }); for (let i = 0; i < 30; i++) noise(b, { t0: rnd() * 2.9, dur: 0.02, amp: 0.5 * rnd(), k: 150, lpf: 6000, hpf: 1500 }); return b; }],
  'world/spark': ['WOSPARK', () => { const b = buf(0.4); for (let i = 0; i < 6; i++) noise(b, { t0: rnd() * 0.25, dur: 0.02, amp: 0.8, k: 200, lpf: 12000, hpf: 3000 }); tone(b, { dur: 0.3, f0: 120, amp: 0.2, k: 8, wave: 'saw' }); return b; }],
  'world/neonbuzz': ['WONEON', () => { const b = buf(2.0); tone(b, { dur: 2.0, f0: 120, amp: 0.3, a: 0.001, k: 0, sustain: 1, wave: 'saw' }); tone(b, { dur: 2.0, f0: 240, amp: 0.15, a: 0.001, k: 0, sustain: 1, wave: 'sq' }); return b; }],
  'world/drumboom': ['WODRUM', () => { const b = buf(1.6); tone(b, { dur: 1.0, f0: 90, f1: 35, amp: 1, k: 4 }); noise(b, { dur: 1.4, amp: 1.1, k: 3.2, lpf: 3500, lpEnd: 150, hpf: 25 }); return reverb(b, 0.3, 2); }],
});

// ------------------------------------------------------------------ write
const lines = ['// GENERATED by tools/sfx.mjs. Logical name → lump (sounds/*.wav).'];
let total = 0;
// ---- MAP02 / MAP04: Men in Black, office workers, the helicopter
Object.assign(R, {
  'weapons/silenced': ['WPSILENC', () => { const b = buf(0.35); noise(b, { dur: 0.01, amp: 0.6, k: 400, lpf: 6000, hpf: 1500 }); noise(b, { dur: 0.18, amp: 0.7, k: 30, lpf: 1800, lpEnd: 300, hpf: 120 }); tone(b, { dur: 0.05, f0: 90, f1: 50, amp: 0.4, k: 40 }); clicks(b, 2, 0.05, 0.03, 3200); return reverb(b, 0.12); }],
  'mib/sight': ['MIBSIGHT', () => { const b = buf(0.9); [['o', 'e', 0], ['a', 'i', 0.2], ['u', 'o', 0.42]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.19, f0: 105, f1: 95, vowel: v0, vowel1: v1, amp: 0.8, breath: 0.15 })); noise(b, { dur: 0.6, amp: 0.12, k: 2, lpf: 3000, hpf: 1200 }); return b; }],
  'mib/active': ['MIBACT', () => { const b = buf(0.6); noise(b, { dur: 0.5, amp: 0.25, k: 3, lpf: 3500, hpf: 1500 }); voice(b, { t0: 0.1, dur: 0.25, f0: 100, f1: 96, vowel: 'e', vowel1: 'o', amp: 0.5, breath: 0.2 }); return b; }],
  'mib/pain': ['MIBPAIN', () => { const b = buf(0.4); voice(b, { dur: 0.28, f0: 150, f1: 115, vowel: 'u', vowel1: 'ah', amp: 1, breath: 0.25 }); return b; }],
  'mib/death': ['MIBDEATH', () => { const b = buf(1.0); voice(b, { dur: 0.8, f0: 160, f1: 70, vowel: 'ah', vowel1: 'o', amp: 1, breath: 0.3, rel: 0.4 }); return reverb(b, 0.2); }],
  'npc/thanks': ['NPTHANKS', () => { const b = buf(0.9); [['a', 'e', 0], ['o', 'u', 0.2], ['ah', 'i', 0.4]].forEach(([v0, v1, t]) => voice(b, { t0: t, dur: 0.2, f0: 200 + rnd() * 40, f1: 230, vowel: v0, vowel1: v1, amp: 0.7, breath: 0.35 })); return b; }],
  'npc/screamf': ['NPSCRMF', () => { const b = buf(1.0); voice(b, { dur: 0.9, f0: 520, f1: 680, vowel: 'a', vowel1: 'e', amp: 1, breath: 0.2, a: 0.05, rel: 0.3 }); return reverb(b, 0.2); }],
  'npc/painf': ['NPPAINF', () => { const b = buf(0.4); voice(b, { dur: 0.32, f0: 400, f1: 300, vowel: 'ah', vowel1: 'u', amp: 1, breath: 0.25 }); return b; }],
  'npc/deathf': ['NPDEATHF', () => { const b = buf(1.1); voice(b, { dur: 1.0, f0: 440, f1: 200, vowel: 'a', vowel1: 'o', amp: 1, breath: 0.3, rel: 0.5 }); return reverb(b, 0.2); }],
  'world/helirotor': ['WOHELI', () => { const b = buf(2.0); for (let i = 0; i < 10; i++) { noise(b, { t0: i * 0.2, dur: 0.16, amp: 0.9, a: 0.01, k: 14, lpf: 420, hpf: 30 }); tone(b, { t0: i * 0.2, dur: 0.12, f0: 52, f1: 40, amp: 0.6, k: 18 }); } noise(b, { dur: 2.0, amp: 0.25, k: 0, sustain: 1, lpf: 2400, hpf: 600 }); return b; }],
  'world/heliboard': ['WOHELIBD', () => { const b = buf(2.2); for (let i = 0; i < 16; i++) noise(b, { t0: i * 0.13, dur: 0.11, amp: 0.6 + i * 0.03, a: 0.01, k: 16, lpf: 500 + i * 30, hpf: 30 }); tone(b, { dur: 2.1, f0: 300, f1: 900, amp: 0.25, a: 0.3, k: 1.2 }); return reverb(b, 0.25, 1.5); }],
});

for (const [logical, [lump, fn]] of Object.entries(R)) {
  if (lump.length > 8) throw new Error('lump > 8 chars: ' + lump);
  seed = [...logical].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const data = finish(fn());
  const w = wav(data);
  writeFileSync(join(OUT, lump + '.wav'), w);
  total += w.length;
  if (!logical.startsWith('marsh/')) lines.push(`${logical.padEnd(22)} ${lump}`);
}
// random variation / limits
lines.push('', '$limit weapons/smg 2', '$limit weapons/plasmasmg 2', '$limit weapons/casing 4', '$limit grey/active 2', '$limit world/fire 3');
lines.push('$random npc/any { npc/scream npc/pain }');
// loops
lines.push('$attenuation world/fire 2', '$attenuation world/neonbuzz 3');
// the player's sound class (Player.SoundClass "marsh")
lines.push('', '$playersound marsh male *pain100 PLPAIN', '$playersound marsh male *pain75 PLPAIN', '$playersound marsh male *pain50 PLPAIN', '$playersound marsh male *pain25 PLPAIN',
  '$playersound marsh male *death PLDEATH', '$playersound marsh male *xdeath PLXDEATH', '$playersound marsh male *gibbed PLXDEATH', '$playersound marsh male *grunt PLGRUNT',
  '$playersound marsh male *land PLLAND', '$playersound marsh male *usefail PLUSEFL', '$playersound marsh male *jump PLGRUNT');
writeFileSync(join(ROOT, 'mod/SNDINFO.txt'), lines.join('\n') + '\n');
console.log(`sfx: ${Object.keys(R).length} sounds, ${(total / 1048576).toFixed(1)} MB → mod/sounds, SNDINFO written`);
