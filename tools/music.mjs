// Generates the score as General MIDI files in mod/music/ (GZDoom plays MIDI
// through its built-in synth). Original motifs: minor key, a whistled lead
// over analog pads and a delayed arpeggio, drum machine on the combat maps.
//   node tools/music.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'mod/music');
mkdirSync(OUT, { recursive: true });
const TPQ = 96;   // ticks per quarter

// ------------------------------------------------------------------ MIDI writer
const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
function trackBytes(events) {
  events.sort((a, b) => a.t - b.t || a.o - b.o);
  const out = []; let last = 0;
  for (const e of events) { out.push(...vlq(e.t - last), ...e.d); last = e.t; }
  out.push(0, 0xff, 0x2f, 0);
  return out;
}
function midi(tracks, bpm) {
  const us = Math.round(60000000 / bpm);
  const tempo = [{ t: 0, o: 0, d: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }];
  const all = [tempo, ...tracks].map(trackBytes);
  const chunks = [Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, all.length, 0, TPQ])];
  for (const tb of all) { const h = Buffer.from([0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 0]); h.writeUInt32BE(tb.length, 4); chunks.push(h, Buffer.from(tb)); }
  return Buffer.concat(chunks);
}
class Track {
  constructor(ch, program, vol = 100, pan = 64, rev = 60) {
    this.ch = ch; this.ev = [];
    if (program != null) this.ev.push({ t: 0, o: 0, d: [0xc0 | ch, program] });
    this.ev.push({ t: 0, o: 0, d: [0xb0 | ch, 7, vol] }, { t: 0, o: 0, d: [0xb0 | ch, 10, pan] }, { t: 0, o: 0, d: [0xb0 | ch, 91, rev] });
  }
  note(t, pitch, dur, vel = 90) {
    if (pitch < 0 || pitch > 127) return;
    this.ev.push({ t: Math.round(t), o: 2, d: [0x90 | this.ch, pitch, vel] }, { t: Math.round(t + dur - 2), o: 1, d: [0x80 | this.ch, pitch, 0] });
  }
  bend(t, v) { const x = 8192 + Math.round(v * 8191); this.ev.push({ t: Math.round(t), o: 0, d: [0xe0 | this.ch, x & 0x7f, (x >> 7) & 0x7f] }); }
}

// ------------------------------------------------------------------ theory
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const deg = (root, d, oct = 0) => root + MINOR[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
const Q = TPQ, E = TPQ / 2, S = TPQ / 4, BAR = TPQ * 4;

// GM programs
const P = { pad: 89, polysynth: 90, choir: 91, halo: 94, sweep: 95, whistle: 78, ocarina: 79, bass: 38, fretless: 35, strings: 49, bell: 14, piano: 0, crystal: 98, atmos: 99, brass: 61, organ: 19 };

// A piece: chord progression (scale degrees), sections, instrumentation.
function compose({ name, root, bpm, bars, prog, drums = 0, lead = true, arp = true, choir = false, bassStyle = 'pulse', leadProg = P.whistle, padProg = P.pad, s = 1 }) {
  seed = s;
  const pad = new Track(0, padProg, 78, 50, 100), arpT = new Track(1, P.crystal, 62, 88, 110), leadT = new Track(2, leadProg, 96, 64, 90);
  const bassT = new Track(3, P.bass, 96, 64, 30), strT = new Track(4, choir ? P.choir : P.strings, 70, 40, 110), dr = new Track(9, null, 100, 64, 40);
  // a 2-bar motif reused with variation (the hook)
  const motif = [];
  { let t = 0, d = 4; while (t < BAR * 2) { const len = pick([Q, Q, E, Q * 1.5, Q * 2]); motif.push({ t, d, len }); t += len; d += pick([-2, -1, 1, 2, 0, 3, -3]); d = Math.max(0, Math.min(9, d)); } }
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, ch = prog[b % prog.length], sect = Math.floor(b / 8) % 4;
    // pad: 3-note voicing, whole bar
    for (const k of [0, 2, 4]) pad.note(t0, deg(root, ch + k, 0), BAR, 64);
    if (sect >= 1 || choir) for (const k of [0, 4]) strT.note(t0, deg(root, ch + k, 1), BAR, 50 + sect * 8);
    // delayed arpeggio (the paranoid shimmer): 16ths with an echo a dotted-8th later
    if (arp) for (let i = 0; i < 16; i++) {
      const k = [0, 2, 4, 7, 4, 2, 0, 4][i % 8];
      const p = deg(root, ch + k, 1);
      arpT.note(t0 + i * S, p, S, 70 - (i % 4) * 6);
      arpT.note(t0 + i * S + E * 1.5, p + 12, S, 28);
    }
    // bass
    if (bassStyle === 'pulse') for (let i = 0; i < 8; i++) bassT.note(t0 + i * E, deg(root, ch, -1), E * 0.9, i % 2 ? 72 : 96);
    else if (bassStyle === 'drone') bassT.note(t0, deg(root, ch, -1), BAR, 80);
    else for (const [t, o] of [[0, 0], [Q * 1.5, 0], [Q * 2.5, 7], [Q * 3, 0]]) bassT.note(t0 + t, deg(root, ch, -1) + (o === 7 ? 7 : 0), E, 96);
    // lead: the motif on odd 2-bar phrases after the intro, transposed to the chord
    if (lead && b >= 4 && (b % 4) < 2) {
      for (const m of motif) if (m.t >= (b % 2) * BAR && m.t < (b % 2 + 1) * BAR) {
        const t = t0 + m.t - (b % 2) * BAR, p = deg(root, m.d + (sect === 2 ? 2 : 0), 1);
        leadT.bend(t, -0.08); leadT.bend(t + 12, 0);   // the whistle scoop
        leadT.note(t, p, m.len * 0.95, 88);
      }
    }
    // drums (combat tracks): kick 36, snare 38, closed hat 42, open 46, toms 45/48
    if (drums && b >= 2) {
      for (let i = 0; i < 16; i++) {
        const t = t0 + i * S;
        if (i % 8 === 0 || (drums > 1 && i === 10)) dr.note(t, 36, S, 110);
        if (i % 8 === 4) dr.note(t, 38, S, 100);
        if (i % 2 === 0) dr.note(t, 42, S, i % 4 ? 55 : 75);
        if (drums > 1 && i === 14 && b % 4 === 3) dr.note(t, 46, S, 80);
      }
      if (b % 8 === 7) for (let i = 12; i < 16; i++) dr.note(t0 + i * S, [48, 47, 45, 43][i - 12], S, 90);
    }
  }
  const tracks = [pad.ev, arpT.ev, leadT.ev, bassT.ev, strT.ev];
  if (drums) tracks.push(dr.ev);
  writeFileSync(join(OUT, name + '.mid'), midi(tracks, bpm));
  return name;
}

const made = [
  compose({ name: 'title', root: 57, bpm: 72, bars: 32, prog: [0, 5, 3, 4], drums: 0, bassStyle: 'drone', s: 11 }),                            // A minor, slow
  compose({ name: 'story', root: 52, bpm: 66, bars: 16, prog: [0, 3, 5, 4], drums: 0, lead: false, bassStyle: 'drone', choir: true, s: 22 }),   // E minor, intermission
  compose({ name: 'map01', root: 50, bpm: 96, bars: 48, prog: [0, 0, 5, 6, 3, 4], drums: 1, bassStyle: 'pulse', s: 33 }),                     // D minor, tension → pulse
  compose({ name: 'map02', root: 45, bpm: 100, bars: 48, prog: [0, 0, 6, 5, 0, 0, 3, 4], drums: 1, bassStyle: 'pulse', leadProg: P.brass, padProg: P.strings, s: 77 }), // A minor, Dulce: the raid (march)
  compose({ name: 'map03', root: 55, bpm: 112, bars: 48, prog: [0, 6, 5, 4], drums: 2, bassStyle: 'funk', leadProg: P.brass, padProg: P.polysynth, s: 44 }), // G minor, seedy D.C.
  compose({ name: 'map04', root: 52, bpm: 128, bars: 56, prog: [0, 3, 6, 5, 0, 3, 4, 4], drums: 2, bassStyle: 'pulse', leadProg: P.organ, padProg: P.polysynth, s: 88 }), // E minor, Chicago burning
  compose({ name: 'map05', root: 53, bpm: 84, bars: 48, prog: [0, 5, 2, 4], drums: 1, bassStyle: 'drone', leadProg: P.ocarina, padProg: P.atmos, s: 55 }), // F minor, forest
  compose({ name: 'map06', root: 49, bpm: 120, bars: 64, prog: [0, 1, 5, 4, 0, 6, 3, 4], drums: 2, choir: true, bassStyle: 'pulse', padProg: P.sweep, s: 66 }), // C# minor, mothership
];
console.log('music:', made.join(', '), '→ mod/music');
