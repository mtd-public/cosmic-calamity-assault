// Halo 1/2-style HUD on one overlay canvas + a few DOM text lines.
//   top-right : segmented shield bar, health segments under it (Halo 1)
//   top-left  : ammo readout (rounds as ticks + reserve, or battery % + heat), grenades
//   bottom-left: motion tracker (25 m, moving or firing hostiles only)
//   centre    : per-weapon reticle, red over a hostile; damage arcs; nav points
// The HUD never takes input (pointer-events: none), per the house rules.
import { WEAPONS } from './weapons.js';
import { TUNING as T } from './tuning.js';
import { ENEMIES } from './enemies.js';
import { SPEAKERS } from './levels.js';

const BLUE = 'rgba(110,195,255,', RED = 'rgba(255,70,60,', AMBER = 'rgba(255,190,90,';

export class HUD {
  constructor(canvas, root) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.root = root;
    this.el = {
      sub: root.querySelector('#subs'), prompt: root.querySelector('#prompt'), obj: root.querySelector('#objective'),
      cp: root.querySelector('#checkpoint'), toasts: root.querySelector('#toasts'), score: root.querySelector('#score'),
    };
    this.dmg = []; // {ang, t}
    this.subQ = []; this.subT = 0;
    this.objT = 0; this.cpT = 0; this.sweep = 0;
    this.flash = { shield: 0, health: 0, pick: 0 };
    this.lastObj = '';
    this.glyphs = { action: 'E', reload: 'R' };
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.s = Math.max(0.7, Math.min(1.25, Math.min(w, h) / 700)); // HUD scale
  }

  setGlyphs(g) { this.glyphs = g; }

  say(lines) { for (const l of lines) this.subQ.push(l); if (!this.subT) this.nextSub(); }
  nextSub() {
    const l = this.subQ.shift();
    if (!l) { this.el.sub.classList.remove('on'); this.subT = 0; return; }
    const sp = SPEAKERS[l[0]] || { name: l[0].toUpperCase(), color: '#fff' };
    this.el.sub.innerHTML = `<b style="color:${sp.color}">${sp.name}:</b> ${l[1]}`;
    this.el.sub.classList.add('on');
    this.subT = 2.2 + l[1].length * 0.045;
    this.onBlip?.(l[0]);
  }
  clearSubs() { this.subQ = []; this.subT = 0; this.el.sub.classList.remove('on'); }

  toast(text, cls = '') {
    const d = document.createElement('div');
    d.className = `toast ${cls}`; d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2200);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  event(w, e, view) {
    const p = w.player;
    if (e.type === 'playerHit') {
      if (e.from) {
        const ang = Math.atan2(-(e.from.x - p.pos.x), -(e.from.z - p.pos.z)) - p.yaw;
        this.dmg.push({ ang, t: 1 });
        if (this.dmg.length > 6) this.dmg.shift();
      }
      if (e.shield) this.flash.shield = 1; else this.flash.health = 1;
    }
    if (e.type === 'objective' && e.text) { this.el.obj.textContent = e.text; this.el.obj.classList.add('on'); this.objT = 5; }
    if (e.type === 'checkpoint') { this.cpPending = 0.6; }
    if (e.type === 'say') this.say(e.lines);
    if (e.type === 'pickup') { this.toast(e.ammo ? `+ ${e.what}` : `PICKED UP ${e.what.toUpperCase()}`, e.weapon ? 'wpn' : ''); this.flash.pick = 0.4; }
    if (e.type === 'wave') this.toast(`WAVE ${e.wave}`, 'big');
    if (e.type === 'waveClear') this.toast('WAVE CLEARED', 'good');
    if (e.type === 'enemyDie' && w.ff && e.pts) this.toast(`+${e.pts}${e.head ? '  HEADSHOT' : ''}`, 'pts');
    if (e.type === 'targetUnlocked') this.toast('CORE SHIELD DOWN', 'good');
    if (e.type === 'deepWater') this.toast('DEEP WATER: GET OUT', 'bad');
    void view;
  }

  update(w, view, dt, t, aim) {
    const g = this.g, W = this.w, H = this.h, s = this.s, p = w.player;
    g.clearRect(0, 0, W, H);
    this.sweep += dt;
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.nextSub(); }
    if (this.objT > 0) { this.objT -= dt; if (this.objT <= 0) this.el.obj.classList.remove('on'); }
    if (this.cpPending > 0) { this.cpPending -= dt; if (this.cpPending <= 0) { this.el.cp.textContent = 'CHECKPOINT... DONE'; this.el.cp.classList.add('on'); this.cpT = 2.5; } }
    if (this.cpT > 0) { this.cpT -= dt; if (this.cpT <= 0) this.el.cp.classList.remove('on'); }
    for (const k in this.flash) this.flash[k] = Math.max(0, this.flash[k] - dt * 2.2);
    this.el.score.textContent = w.ff ? `WAVE ${w.ff.wave}  ·  ${w.stats.score}` : '';
    const ws = p.weapons[p.cur], d = ws && WEAPONS[ws.id];
    const scoped = p.zoom && d?.zoom;

    // ---- screen effects
    if (scoped) this.drawScope(W, H);
    if (this.flash.shield > 0) this.vignette(`${BLUE}${0.35 * this.flash.shield})`, 0.55);
    if (this.flash.health > 0) this.vignette(`${RED}${0.5 * this.flash.health})`, 0.45);
    if (p.shield <= 0 && w.mode === 'play') this.vignette(`${RED}${0.12 + 0.1 * Math.sin(t * 9)})`, 0.7);
    if (p.deepT > 0.3) { g.fillStyle = 'rgba(20,60,90,0.35)'; g.fillRect(0, 0, W, H); }
    if (w.mode !== 'play') return;

    // ---- shield + health (top right)
    const bw = 250 * s, bh = 16 * s, bx = W - bw - 20 * s - (this.safeR || 0), by = 18 * s + (this.safeT || 0);
    this.frame(bx - 6 * s, by - 6 * s, bw + 12 * s, bh + 30 * s);
    const sk = p.shield / T.shieldMax;
    const low = sk <= 0.25;
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      const on = (i + 1) / segs <= sk + 0.001 || (i / segs < sk);
      const x = bx + (i * bw) / segs;
      g.fillStyle = on ? (low ? `${RED}${0.75 + 0.25 * Math.sin(t * 14)})` : `${BLUE}0.85)`) : `${BLUE}0.12)`;
      g.fillRect(x + 1, by, bw / segs - 2, bh);
    }
    if (p.recharging && sk < 1) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx, by, bw * sk, bh); }
    // health: three segments (Halo 1 health bar)
    const hk = p.health / T.healthMax;
    for (let i = 0; i < 3; i++) {
      const x = bx + bw - (3 - i) * 36 * s, y = by + bh + 6 * s;
      const fill = Math.max(0, Math.min(1, hk * 3 - i));
      g.fillStyle = `${BLUE}0.15)`; g.fillRect(x, y, 32 * s, 8 * s);
      g.fillStyle = hk < 0.34 ? `${RED}0.9)` : `${BLUE}0.8)`; g.fillRect(x, y, 32 * s * fill, 8 * s);
    }
    g.fillStyle = `${BLUE}0.7)`; g.font = `${10 * s}px Oxanium, sans-serif`; g.textAlign = 'left';
    g.fillText('SHIELD', bx, by + bh + 13 * s);

    // ---- weapon panel (top left)
    const ax = 20 * s + (this.safeL || 0), ay = 18 * s + (this.safeT || 0);
    this.frame(ax - 6 * s, ay - 6 * s, 250 * s, 64 * s);
    if (ws) {
      g.textAlign = 'left';
      if (d.kind === 'plasma') {
        g.fillStyle = ws.battery < 15 ? `${RED}0.95)` : `${BLUE}0.95)`;
        g.font = `bold ${26 * s}px Oxanium, sans-serif`;
        g.fillText(`${Math.ceil(ws.battery)}%`, ax, ay + 24 * s);
        const hx = ax + 78 * s, hw = 150 * s;
        g.fillStyle = `${BLUE}0.15)`; g.fillRect(hx, ay + 8 * s, hw, 10 * s);
        g.fillStyle = ws.vent > 0 ? `${RED}${0.6 + 0.4 * Math.sin(t * 20)})` : ws.heat > 0.75 ? `${AMBER}0.9)` : `${BLUE}0.8)`;
        g.fillRect(hx, ay + 8 * s, hw * (ws.vent > 0 ? 1 : ws.heat), 10 * s);
        g.fillStyle = `${BLUE}0.6)`; g.font = `${9 * s}px Oxanium, sans-serif`; g.fillText(ws.vent > 0 ? 'OVERHEATED' : 'HEAT', hx, ay + 30 * s);
        if (p.charge > 0 && d.charge) { g.fillStyle = `${AMBER}0.9)`; g.fillRect(hx, ay + 20 * s, hw * Math.min(1, p.charge / d.charge.time), 3 * s); }
      } else {
        g.fillStyle = ws.mag === 0 ? `${RED}0.95)` : `${BLUE}0.95)`;
        g.font = `bold ${26 * s}px Oxanium, sans-serif`;
        g.fillText(String(ws.mag).padStart(2, '0'), ax, ay + 24 * s);
        // rounds as ticks, Halo 1 style
        const n = d.mag, per = n > 20 ? Math.ceil(n / 2) : n, tw = Math.min(8 * s, (150 * s) / per);
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / per), col = i % per;
          g.fillStyle = i < ws.mag ? `${BLUE}0.85)` : `${BLUE}0.12)`;
          g.fillRect(ax + 50 * s + col * tw, ay + 4 * s + row * 12 * s, tw - 2 * s, 9 * s);
        }
        g.fillStyle = `${BLUE}0.7)`; g.font = `${12 * s}px Oxanium, sans-serif`;
        g.fillText(w.level.infiniteReserve ? '∞' : String(ws.reserve), ax + 206 * s, ay + 13 * s);
        if (p.reloadT > 0) { g.fillStyle = `${AMBER}0.9)`; g.fillText('RELOADING', ax + 50 * s, ay + 44 * s); }
        else if (ws.mag === 0 && ws.reserve === 0) { g.fillStyle = `${RED}0.9)`; g.fillText('NO AMMO', ax + 50 * s, ay + 44 * s); }
        else if (ws.mag <= Math.ceil(d.mag * 0.25)) { g.fillStyle = `${AMBER}${0.6 + 0.4 * Math.sin(t * 8)})`; g.fillText('RELOAD', ax + 50 * s, ay + 44 * s); }
      }
      g.fillStyle = `${BLUE}0.55)`; g.font = `${9 * s}px Oxanium, sans-serif`;
      g.fillText(d.short, ax, ay + 44 * s);
    }
    // grenades
    for (const [i, k] of ['frag', 'plasma'].entries()) {
      const x = ax + 150 * s + i * 44 * s, y = ay + 38 * s, sel = p.gType === k;
      g.strokeStyle = sel ? `${AMBER}0.9)` : `${BLUE}0.35)`; g.lineWidth = 1.5 * s;
      g.strokeRect(x, y, 38 * s, 16 * s);
      g.fillStyle = k === 'frag' ? `${BLUE}0.9)` : 'rgba(111,200,255,0.95)';
      g.beginPath(); g.arc(x + 9 * s, y + 8 * s, 4.5 * s, 0, 6.28); g.fill();
      g.font = `bold ${11 * s}px Oxanium, sans-serif`; g.fillText(String(p.grens[k]), x + 20 * s, y + 12 * s);
    }

    // ---- motion tracker (bottom left)
    this.drawTracker(w, s, t);
    // ---- nav points
    this.drawMarkers(w, view, s, t);
    // ---- reticle + damage arcs
    if (!scoped) this.drawReticle(d, aim, p, s);
    else this.drawScopeReticle(aim, s);
    this.drawDamage(s, dt);
    // ---- context prompt
    const pr = p.prompt;
    const txt = pr ? `HOLD ${this.glyphs.action} TO ${pr.label}` : '';
    if (this.el.prompt.textContent !== txt) this.el.prompt.textContent = txt;
    this.el.prompt.classList.toggle('on', !!pr);
  }

  frame(x, y, w, h) {
    const g = this.g, c = 8 * this.s;
    g.strokeStyle = `${BLUE}0.35)`; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h);
    g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
    g.fillStyle = 'rgba(8,24,40,0.28)'; g.fill(); g.stroke();
  }

  vignette(color, inner) {
    const g = this.g, W = this.w, H = this.h;
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner * 0.5, W / 2, H / 2, Math.max(W, H) * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, color);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  drawTracker(w, s, t) {
    const g = this.g, p = w.player;
    const R = (this.touchMode ? 52 : 62) * s, cx = R + 22 * s + (this.safeL || 0);
    const cy = this.touchMode ? (this.safeT || 0) + 96 * s + R : this.h - R - 22 * s - (this.safeB || 0);
    const range = 25;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, 6.28); g.fillStyle = 'rgba(8,24,40,0.45)'; g.fill();
    g.strokeStyle = `${BLUE}0.5)`; g.lineWidth = 1.5 * s; g.stroke();
    g.beginPath(); g.arc(cx, cy, R * 0.5, 0, 6.28); g.strokeStyle = `${BLUE}0.2)`; g.stroke();
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    // sweep
    const sw = (this.sweep % 2) / 2;
    g.beginPath(); g.arc(cx, cy, R * sw, 0, 6.28); g.strokeStyle = `${BLUE}${0.35 * (1 - sw)})`; g.lineWidth = 2 * s; g.stroke();
    g.clip();
    const cy_ = Math.cos(p.yaw), sy_ = Math.sin(p.yaw);
    for (const e of w.enemies) {
      if (e.dead || ENEMIES[e.type].dummy) continue;
      if (e.trackT > 0.6) continue; // stationary, silent hostiles do not show (Halo rule)
      const dx = e.x - p.pos.x, dz = e.z - p.pos.z;
      if (Math.hypot(dx, dz) > range * 1.05) continue;
      // rotate into view space: forward = up on the tracker
      const rx = dx * cy_ - dz * sy_, rz = dx * sy_ + dz * cy_;
      const x = cx + (rx / range) * R, y = cy + (rz / range) * R;
      const big = e.type === 'heavy';
      const hi = Math.abs(e.y - p.pos.y) > 2.5 ? 0.55 : 1; // above/below: dimmer
      g.beginPath(); g.arc(x, y, (big ? 6 : 4.2) * s, 0, 6.28); g.fillStyle = `${RED}${0.95 * hi})`; g.fill();
      g.beginPath(); g.arc(x, y, (big ? 11 : 8) * s, 0, 6.28); g.fillStyle = `${RED}${0.2 * hi})`; g.fill();
    }
    g.restore();
    // you: a small wedge
    g.fillStyle = `${AMBER}0.9)`;
    g.beginPath(); g.moveTo(cx, cy - 6 * s); g.lineTo(cx + 4.5 * s, cy + 5 * s); g.lineTo(cx - 4.5 * s, cy + 5 * s); g.closePath(); g.fill();
    g.fillStyle = `${BLUE}0.6)`; g.font = `${9 * s}px Oxanium, sans-serif`; g.textAlign = 'center';
    g.fillText(`${range}m`, cx + R * 0.72, cy + R * 0.95);
    this.trackerR = { cx, cy, R };
  }

  drawMarkers(w, view, s, t) {
    const g = this.g, W = this.w, H = this.h, p = w.player;
    const pts = [];
    if (w.waypoint) pts.push({ p: w.waypoint, kind: 'nav' });
    const st = w.level.sequence?.[w.seq.i];
    if (st?.until?.type === 'destroy') for (const tg of w.targets) if (st.until.targets.includes(tg.id) && !tg.dead && !tg.locked) pts.push({ p: [tg.pos[0], tg.pos[1] + tg.h + 0.6, tg.pos[2]], kind: 'target' });
    const o = {};
    for (const m of pts) {
      view.project(m.p[0], m.p[1], m.p[2], o);
      let x = (o.x * 0.5 + 0.5) * W, y = (-o.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(m.p[0] - p.pos.x, m.p[2] - p.pos.z);
      const off = o.behind || x < 30 || x > W - 30 || y < 30 || y > H - 30;
      if (o.behind) { x = W - x; y = H - 40 * s; }
      x = Math.max(34 * s, Math.min(W - 34 * s, x)); y = Math.max(80 * s, Math.min(H - 60 * s, y));
      const col = m.kind === 'nav' ? AMBER : RED;
      g.save(); g.translate(x, y);
      const k = 1 + Math.sin(t * 4) * 0.06;
      g.scale(k, k);
      g.strokeStyle = `${col}0.95)`; g.lineWidth = 2 * s;
      g.beginPath(); g.moveTo(0, -10 * s); g.lineTo(8 * s, 0); g.lineTo(0, 10 * s); g.lineTo(-8 * s, 0); g.closePath(); g.stroke();
      g.fillStyle = `${col}0.35)`; g.fill();
      g.restore();
      g.fillStyle = `${col}0.95)`; g.font = `bold ${11 * s}px Oxanium, sans-serif`; g.textAlign = 'center';
      g.fillText(`${Math.round(dist)}m${off ? ' ▸' : ''}`, x, y + 24 * s);
    }
  }

  drawReticle(d, aim, p, s) {
    if (!d) return;
    const g = this.g, x = this.w / 2, y = this.h / 2;
    const red = aim?.enemy && aim.dist < d.range;
    const col = red ? `${RED}0.95)` : `${BLUE}0.9)`;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2 * s;
    const bloom = (p.bloom || 0) * 400 * s;
    g.beginPath();
    switch (d.reticle) {
      case 'circle': { // AR: circle with four ticks, blooms
        const r = 22 * s + bloom;
        g.arc(x, y, r, 0, 6.28);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(x + Math.cos(a) * (r - 5 * s), y + Math.sin(a) * (r - 5 * s)); g.lineTo(x + Math.cos(a) * (r + 5 * s), y + Math.sin(a) * (r + 5 * s)); }
        g.stroke(); g.beginPath(); g.arc(x, y, 1.6 * s, 0, 6.28); g.fill();
        break;
      }
      case 'cross': { const r = 10 * s; g.moveTo(x - r, y); g.lineTo(x - 3 * s, y); g.moveTo(x + 3 * s, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y - 3 * s); g.moveTo(x, y + 3 * s); g.lineTo(x, y + r); g.stroke(); break; }
      case 'burst': { g.arc(x, y, 14 * s, 0, 6.28); g.stroke(); g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.moveTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); g.lineTo(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s); } g.stroke(); break; }
      case 'wide': { g.arc(x, y, 44 * s, 0, 6.28); g.stroke(); g.beginPath(); g.arc(x, y, 2 * s, 0, 6.28); g.fill(); break; }
      case 'arc': { g.arc(x, y, 18 * s, Math.PI * 0.15, Math.PI * 0.85); g.moveTo(x + 18 * s * Math.cos(Math.PI * 1.15), y + 18 * s * Math.sin(Math.PI * 1.15)); g.arc(x, y, 18 * s, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.arc(x, y, 2 * s, 0, 6.28); g.fill(); break; }
      case 'needle': { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094; g.moveTo(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s); g.lineTo(x + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s); } g.stroke(); break; }
      case 'lance': { g.arc(x, y, 26 * s, 0, 6.28); g.moveTo(x, y - 34 * s); g.lineTo(x, y + 34 * s); g.stroke(); break; }
      default: g.arc(x, y, 3 * s, 0, 6.28); g.fill();
    }
  }

  drawScope(W, H) {
    const g = this.g, r = Math.min(W, H) * 0.46;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.92)';
    g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, 6.28, true); g.fill('evenodd');
    g.strokeStyle = `${BLUE}0.5)`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, r, 0, 6.28); g.stroke();
    g.restore();
  }
  drawScopeReticle(aim, s) {
    const g = this.g, x = this.w / 2, y = this.h / 2;
    g.strokeStyle = aim?.enemy ? `${RED}0.95)` : `${BLUE}0.8)`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - 60 * s, y); g.lineTo(x - 8 * s, y); g.moveTo(x + 8 * s, y); g.lineTo(x + 60 * s, y); g.moveTo(x, y + 8 * s); g.lineTo(x, y + 60 * s); g.stroke();
    g.fillStyle = `${BLUE}0.8)`; g.font = `${10 * s}px Oxanium, sans-serif`; g.textAlign = 'left';
    g.fillText(`${aim ? Math.round(aim.dist) : '--'}m`, x + 14 * s, y - 10 * s);
  }

  drawDamage(s, dt) {
    const g = this.g, x = this.w / 2, y = this.h / 2, r = 70 * s;
    for (const d of this.dmg) {
      d.t -= dt * 0.9;
      if (d.t <= 0) continue;
      const a = -d.ang - Math.PI / 2;
      g.strokeStyle = `${RED}${0.8 * d.t})`; g.lineWidth = 5 * s;
      g.beginPath(); g.arc(x, y, r, a - 0.35, a + 0.35); g.stroke();
    }
    this.dmg = this.dmg.filter((d) => d.t > 0);
  }
}
