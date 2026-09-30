// Game audio on top of the template's consolidated synth (js/sfx-synth.js,
// copied verbatim from mstr-gme-dsgn-tmpt/kits). Everything is synthesized.
//
//   audio.fx(name, vol = 1)      one-shot, vol already includes distance falloff
//   audio.music(mode)            'title' | 'level' | 'off'
//   audio.setCombat(k)           0..1 drives the percussion layer
import { Sfx } from './sfx-synth.js';

export class Audio extends Sfx {
  constructor() { super({ volume: 0.75 }); this.mus = null; this.combat = 0; this.stepT = 0; this.alarmT = 0; }

  unlock() {
    super.unlock();
    if (this.ctx && !this.musBus) {
      this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.42; this.musBus.connect(this.master);
      // a cheap hall: two feedback delays
      const c = this.ctx;
      this.verb = c.createGain(); this.verb.gain.value = 0.3;
      const d1 = c.createDelay(), d2 = c.createDelay(), f1 = c.createGain(), f2 = c.createGain(), lp = c.createBiquadFilter();
      d1.delayTime.value = 0.113; d2.delayTime.value = 0.171; f1.gain.value = 0.55; f2.gain.value = 0.5; lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.verb.connect(d1); this.verb.connect(d2); d1.connect(f1).connect(lp); d2.connect(f2).connect(lp); f1.connect(d2); f2.connect(d1);
      lp.connect(this.master);
    }
  }

  setVolumes(sfx, music) { this.volume = sfx; if (this.master && !this.muted) this.master.gain.value = sfx; if (this.musBus) this.musBus.gain.value = 0.42 * music; this.musicVol = music; }

  // ---- one-shots -------------------------------------------------------
  fx(name, vol = 1) {
    if (!this.ctx || this.muted || vol < 0.02) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    const f = FX[name];
    if (f) f(this, Math.min(1.5, vol));
  }
  // helpers with volume
  t(freq, dur, type, vol, slide = 0, delay = 0) { this.tone(freq, dur, type, vol, slide, delay); }
  n(dur, freq, o) { this.burst(dur, freq, o); }

  // Vehicle engines: one continuous voice per ride, pitched by speed.
  //   engine(kind, k, boost)   kind 'mule' | 'sliver' | null (off); k = speed / max
  engine(kind, k = 0, boost = false) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, now = c.currentTime;
    if (!this.eng) {
      const g = c.createGain(); g.gain.value = 0; g.connect(this.master);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(g);
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; o1.connect(lp); o1.start();
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 120; const g2 = c.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(lp); o2.start();
      const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8; const ng = c.createGain(); ng.gain.value = 0; n.connect(nf).connect(ng).connect(g); n.start();
      this.eng = { g, lp, o1, o2, ng, nf };
    }
    const e = this.eng, tc = 0.08;
    if (!kind) { e.g.gain.setTargetAtTime(0, now, 0.15); e.ng.gain.setTargetAtTime(0, now, 0.15); return; }
    const kk = Math.min(1.3, Math.max(0, k));
    if (kind === 'mule') {
      e.o1.type = 'sawtooth'; e.o2.type = 'square';
      e.o1.frequency.setTargetAtTime(48 + kk * 110, now, tc); e.o2.frequency.setTargetAtTime(96 + kk * 220, now, tc);
      e.lp.frequency.setTargetAtTime(400 + kk * 1400, now, tc);
      e.g.gain.setTargetAtTime((0.05 + kk * 0.08) * this.volume, now, tc); e.ng.gain.setTargetAtTime(kk * 0.06 * this.volume, now, tc); e.nf.frequency.setTargetAtTime(600 + kk * 800, now, tc);
    } else {
      e.o1.type = 'triangle'; e.o2.type = 'sine';
      e.o1.frequency.setTargetAtTime(160 + kk * 260 + (boost ? 120 : 0), now, tc); e.o2.frequency.setTargetAtTime(322 + kk * 520 + (boost ? 240 : 0), now, tc);
      e.lp.frequency.setTargetAtTime(1200 + kk * 2400, now, tc);
      e.g.gain.setTargetAtTime((0.04 + kk * 0.07 + (boost ? 0.04 : 0)) * this.volume, now, tc); e.ng.gain.setTargetAtTime((0.02 + kk * 0.05) * this.volume, now, tc); e.nf.frequency.setTargetAtTime(2200 + kk * 1500, now, tc);
    }
  }

  // Halo's signature bits
  lowShieldTick(dt) { this.alarmT -= dt; if (this.alarmT <= 0) { this.alarmT = 0.32; this.fx('alarm'); } }
  step(surface, vol = 0.5) { this.fx(surface === 'metal' ? 'stepMetal' : surface === 'water' ? 'stepWater' : 'step', vol); }

  // ---- music -------------------------------------------------------------
  music(mode) {
    if (!this.ctx) return;
    this.musMode = mode;
    if (!this.mus) { this.mus = { next: this.ctx.currentTime + 0.1, bar: 0, beat: 0, chord: 0 }; }
  }
  setCombat(k) { this.combat += (k - this.combat) * 0.05; }

  // Called every frame: schedules ~0.3 s ahead on the audio clock.
  tick() {
    if (!this.ctx || !this.mus || this.musMode === 'off' || this.muted) return;
    const c = this.ctx, m = this.mus;
    const bpm = 76, beat = 60 / bpm;
    while (m.next < c.currentTime + 0.3) {
      const t = m.next;
      const b = m.beat % 16;
      if (b === 0) this.choirChord(t, m.bar);
      if (this.musMode === 'title' && (b === 0 || b === 8)) this.chant(t, m.bar, b);
      if (this.musMode === 'level') {
        const k = this.combat;
        if (k > 0.15) {
          if (b % 4 === 0) this.drum(t, 'kick', 0.5 * k);
          if (b % 8 === 4) this.drum(t, 'snare', 0.35 * k);
          if (k > 0.5 && b % 2 === 1) this.drum(t, 'hat', 0.12 * k);
          if (k > 0.45 && b % 4 === 2) this.string(t, [73.4, 87.3, 65.4, 55][m.bar % 4] * 2, beat * 1.8, 0.05 * k);
        }
      }
      m.next += beat / 2;
      m.beat++;
      if (m.beat % 16 === 0) m.bar++;
    }
  }

  // Monk-choir pad: sawtooth voices through "OO"/"AH" formants, slow swell.
  choirChord(t, bar) {
    const prog = [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [130.8, 164.8, 196], [110, 130.8, 164.8]]; // Dm Bb C Am
    const ch = prog[bar % 4], dur = (60 / 76) * 8 + 0.8;
    for (const f of ch) this.voice(t, f, dur, this.musMode === 'title' ? 0.06 : 0.035, bar % 2 ? 'oo' : 'ah');
    this.voice(t, ch[0] / 2, dur, 0.05, 'oo');
  }
  // An original modal line, sung in unison (title screen only).
  chant(t, bar, b) {
    const lines = [[293.7, 329.6, 349.2, 329.6], [293.7, 261.6, 293.7, 220], [349.2, 392, 440, 392], [349.2, 329.6, 293.7, 293.7]];
    const line = lines[bar % 4], half = b === 8 ? 2 : 0;
    const beat = 60 / 76;
    for (let i = 0; i < 2; i++) this.voice(t + i * beat * 2, line[half + i], beat * 2.1, 0.055, 'ah', true);
  }
  voice(t, f, dur, vol, vowel = 'ah', vib = false) {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.3));
    out.gain.setValueAtTime(vol, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const forms = vowel === 'oo' ? [[300, 1], [870, 0.4], [2240, 0.12]] : [[730, 1], [1090, 0.5], [2440, 0.18]];
    for (const det of [-4, 5]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.006; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
      for (const [ff, gg] of forms) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 8;
        const g = c.createGain(); g.gain.value = gg;
        o.connect(bp).connect(g).connect(out);
      }
      o.start(t); o.stop(t + dur + 0.05);
    }
    out.connect(this.musBus); out.connect(this.verb);
  }
  string(t, f, dur, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.musBus); o.start(t); o.stop(t + dur + 0.05);
  }
  drum(t, kind, vol) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.musBus); o.start(t); o.stop(t + 0.4);
      return;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const dur = kind === 'hat' ? 0.05 : 0.18;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.musBus); s.start(t); s.stop(t + dur + 0.02);
  }

  // Short vowel yelps for the Vyrr (alerts, panic, deaths)
  yelp(base, dur, vol, vowel = [800, 1150, 2900]) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.4, t + dur * 0.3); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(vol, t + 0.02); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    vowel.forEach((fr, i) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 7; const g = c.createGain(); g.gain.value = [1.3, 0.7, 0.3][i]; o.connect(bp).connect(g).connect(out); });
    out.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
}

// (s, v) → void. v = volume scale (distance, etc).
const FX = {
  rifle: (s, v) => { s.n(0.09, 1800, { q: 0.9, vol: 0.32 * v, f1: 500 }); s.t(140, 0.08, 'square', 0.1 * v, -80); },
  pistol: (s, v) => { s.n(0.14, 2400, { q: 0.7, vol: 0.4 * v, type: 'highpass', f1: 900 }); s.t(190, 0.12, 'square', 0.12 * v, -130); },
  burst: (s, v) => { s.n(0.1, 1500, { q: 0.9, vol: 0.34 * v, f1: 420 }); s.t(120, 0.1, 'square', 0.12 * v, -70); },
  shotgun: (s, v) => { s.n(0.42, 1400, { type: 'lowpass', vol: 0.6 * v, f1: 120 }); s.t(80, 0.3, 'sine', 0.35 * v, -40); s.n(0.08, 3000, { type: 'highpass', vol: 0.2 * v, delay: 0.45 }); s.n(0.06, 2500, { type: 'highpass', vol: 0.2 * v, delay: 0.6 }); },
  plasma: (s, v) => { s.t(1100, 0.16, 'sine', 0.13 * v, -750); s.n(0.06, 3000, { q: 3, vol: 0.06 * v }); },
  carbine: (s, v) => { s.t(760, 0.1, 'triangle', 0.13 * v, -480); s.n(0.05, 2200, { q: 2, vol: 0.05 * v }); },
  needler: (s, v) => { s.t(2500, 0.07, 'triangle', 0.08 * v, -600); s.t(3400, 0.05, 'sine', 0.04 * v, 0, 0.02); },
  lance: (s, v) => { s.t(220, 0.45, 'sawtooth', 0.12 * v, -170); s.n(0.4, 900, { type: 'lowpass', vol: 0.25 * v, f1: 200 }); },
  drone: (s, v) => { s.t(1500, 0.06, 'square', 0.05 * v, -800); },
  chaingun: (s, v) => { s.n(0.06, 2200, { q: 0.8, vol: 0.26 * v, f1: 600 }); s.t(160, 0.05, 'square', 0.08 * v, -60); },
  vehicleEnter: (s, v) => { s.n(0.08, 700, { type: 'lowpass', vol: 0.3 * v }); s.t(220, 0.12, 'square', 0.05 * v, -120, 0.05); },
  vehicleExit: (s, v) => { s.n(0.06, 900, { type: 'lowpass', vol: 0.22 * v }); },
  seat: (s, v) => { s.n(0.05, 1200, { q: 2, vol: 0.18 * v }); s.t(500, 0.05, 'square', 0.04 * v, 0, 0.06); },
  splatter: (s, v) => { s.n(0.16, 500, { type: 'lowpass', vol: 0.5 * v }); s.t(70, 0.2, 'sine', 0.3 * v, -30); s.n(0.1, 3000, { type: 'highpass', vol: 0.12 * v, delay: 0.03 }); },
  vehicleBump: (s, v) => { s.n(0.18, 400, { type: 'lowpass', vol: 0.45 * v }); s.t(90, 0.15, 'square', 0.12 * v, -40); s.n(0.08, 2600, { q: 2, vol: 0.14 * v, delay: 0.02 }); },
  vehicleLand: (s, v) => { s.n(0.14, 300, { type: 'lowpass', vol: 0.4 * v }); s.t(60, 0.12, 'sine', 0.2 * v); },
  vehicleHit: (s, v) => { s.t(1800, 0.06, 'triangle', 0.07 * v, -600); s.n(0.05, 3000, { q: 2, vol: 0.08 * v }); },
  boost: (s, v) => { s.t(300, 0.5, 'sawtooth', 0.08 * v, 900); s.n(0.4, 3000, { type: 'highpass', vol: 0.08 * v }); },
  chargedShot: (s, v) => { s.t(420, 0.5, 'sawtooth', 0.14 * v, 900); s.n(0.3, 2000, { q: 2, vol: 0.12 * v }); },
  charged: (s, v) => { s.t(1400, 0.08, 'sine', 0.06 * v); s.t(1900, 0.1, 'sine', 0.05 * v, 0, 0.06); },
  dry: (s, v) => s.t(1800, 0.02, 'square', 0.06 * v),
  reload: (s, v) => { s.n(0.04, 2600, { q: 3, vol: 0.18 * v }); s.n(0.05, 1800, { q: 3, vol: 0.2 * v, delay: 0.45 }); s.t(900, 0.04, 'square', 0.05 * v, 0, 0.5); s.n(0.05, 3000, { q: 3, vol: 0.2 * v, delay: 1.1 }); },
  shell: (s, v) => { s.n(0.05, 2200, { q: 3, vol: 0.2 * v }); s.t(600, 0.04, 'square', 0.05 * v); },
  switch: (s, v) => { s.n(0.05, 1600, { q: 2, vol: 0.18 * v }); s.n(0.04, 2600, { q: 3, vol: 0.14 * v, delay: 0.18 }); },
  overheat: (s, v) => { s.n(0.8, 5000, { type: 'highpass', vol: 0.12 * v, f1: 1500 }); s.t(600, 0.6, 'sawtooth', 0.04 * v, -400); },
  melee: (s, v) => { s.n(0.18, 800, { q: 0.8, vol: 0.25 * v, f1: 2400 }); },
  meleeHit: (s, v) => { s.t(90, 0.18, 'square', 0.25 * v, -40); s.n(0.12, 500, { type: 'lowpass', vol: 0.45 * v }); },
  throw: (s, v) => s.n(0.22, 600, { q: 0.8, vol: 0.2 * v, f1: 1800 }),
  bounce: (s, v) => { s.t(2200, 0.05, 'triangle', 0.08 * v); s.t(1600, 0.06, 'triangle', 0.05 * v, 0, 0.02); },
  stick: (s, v) => { s.n(0.4, 4000, { type: 'highpass', vol: 0.12 * v }); s.t(1200, 0.3, 'sine', 0.05 * v, 400); },
  frag: (s, v) => { s.n(1.1, 900, { type: 'lowpass', vol: 0.65 * v, f1: 40 }); s.t(60, 0.9, 'sine', 0.5 * v, -30); s.n(0.2, 3000, { type: 'highpass', vol: 0.2 * v }); },
  plasmaBoom: (s, v) => { s.n(0.9, 1600, { type: 'lowpass', vol: 0.5 * v, f1: 60 }); s.t(400, 0.5, 'sawtooth', 0.12 * v, -350); },
  bigBoom: (s, v) => { s.n(1.8, 700, { type: 'lowpass', vol: 0.7 * v, f1: 30 }); s.t(50, 1.6, 'sine', 0.55 * v, -25); },
  hitFlesh: (s, v) => s.n(0.06, 700, { type: 'lowpass', vol: 0.18 * v }),
  hitShield: (s, v) => { s.t(1300, 0.06, 'sawtooth', 0.05 * v, -500); s.n(0.05, 4000, { q: 2, vol: 0.06 * v }); },
  shieldPop: (s, v) => { s.t(1800, 0.3, 'sawtooth', 0.09 * v, -1500); s.n(0.3, 3000, { q: 1, vol: 0.12 * v, f1: 600 }); },
  armor: (s, v) => { s.t(2600, 0.08, 'triangle', 0.07 * v); s.t(1900, 0.1, 'square', 0.03 * v); },
  ricochet: (s, v) => s.t(2800 + Math.random() * 1500, 0.12, 'sine', 0.03 * v, -1400),
  hurtShield: (s, v) => { s.t(900, 0.1, 'sawtooth', 0.07 * v, -500); s.n(0.1, 5000, { type: 'highpass', vol: 0.08 * v }); },
  hurt: (s, v) => { s.t(110, 0.2, 'square', 0.16 * v, -50); s.n(0.18, 400, { type: 'lowpass', vol: 0.35 * v }); },
  shieldDown: (s, v) => { s.t(700, 0.25, 'square', 0.07 * v, -300); },
  alarm: (s, v) => s.t(1560, 0.07, 'square', 0.045 * v),
  recharge: (s, v) => { s.t(260, 1.3, 'sine', 0.09 * v, 1100); s.n(1.2, 800, { q: 4, vol: 0.05 * v, f1: 4000 }); },
  jump: (s, v) => s.n(0.1, 400, { type: 'lowpass', vol: 0.12 * v }),
  land: (s, v) => { s.n(0.12, 300, { type: 'lowpass', vol: 0.35 * v }); s.t(70, 0.1, 'sine', 0.2 * v); },
  step: (s, v) => s.n(0.07, 380 + Math.random() * 200, { type: 'lowpass', vol: 0.16 * v }),
  stepMetal: (s, v) => { s.n(0.06, 900, { q: 2, vol: 0.12 * v }); s.t(320 + Math.random() * 60, 0.05, 'triangle', 0.035 * v); },
  stepWater: (s, v) => s.n(0.18, 2500, { type: 'highpass', vol: 0.12 * v, f1: 700 }),
  pickup: (s, v) => { s.n(0.04, 2400, { q: 3, vol: 0.2 * v }); s.t(700, 0.05, 'square', 0.05 * v, 0, 0.05); },
  health: (s, v) => s.arp([523, 659, 784], 0.06, 0.12, 'sine', 0.08 * v),
  checkpoint: (s, v) => s.arp([392, 523], 0.12, 0.3, 'sine', 0.06 * v),
  objective: (s, v) => s.arp([440, 587, 659], 0.1, 0.3, 'triangle', 0.05 * v),
  blip: (s, v) => { s.n(0.06, 2000, { q: 1, vol: 0.06 * v }); s.t(1250, 0.06, 'sine', 0.05 * v, 0, 0.05); },
  door: (s, v) => { s.n(1.2, 300, { type: 'lowpass', vol: 0.35 * v, f1: 900 }); s.t(80, 1.0, 'sawtooth', 0.05 * v, 40); },
  targetDown: (s, v) => { s.n(2, 600, { type: 'lowpass', vol: 0.7 * v, f1: 30 }); s.t(600, 1.2, 'sawtooth', 0.1 * v, -560); },
  ui: (s, v) => s.t(900, 0.04, 'square', 0.04 * v),
  uiOk: (s, v) => s.arp([660, 880], 0.05, 0.08, 'square', 0.05 * v),
  deny: (s, v) => s.t(200, 0.12, 'square', 0.06 * v),
  win: (s, v) => s.arp([392, 523, 659, 784, 1046], 0.14, 0.4, 'triangle', 0.06 * v),
  die: (s, v) => { s.n(0.8, 300, { type: 'lowpass', vol: 0.5 * v }); [330, 262, 196].forEach((f, i) => s.t(f, 0.3, 'sawtooth', 0.06 * v, 0, i * 0.2)); },
};
