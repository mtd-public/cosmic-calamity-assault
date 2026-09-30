// Boot, screens, the fixed-step loop, and the glue between sim, view, HUD,
// audio and input. window.GAME exposes hooks for the headless checks.
import { createWorld, step, applyLook, restoreCheckpoint, aimInfo, DT, summary } from './sim.js';
import { View } from './render.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { MenuNav, PAD_PRESETS, padFamily, buttonName } from './pad.js';
import { LEVELS, CAMPAIGN, TEST_MAPS, PROLOGUE, SPEAKERS } from './levels.js';
import { DIFFICULTY, TUNING as T } from './tuning.js';
import { WEAPONS } from './weapons.js';
import { MOUNTED, VEHICLES } from './vehicles.js';
import { ENEMIES } from './enemies.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const NS = 'cca.';
const load = (k, d) => { try { const v = localStorage.getItem(NS + k); return v ? { ...d, ...JSON.parse(v) } : d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (_) { /* private mode */ } };

const coarse = matchMedia('(pointer: coarse)').matches;
const settings = load('settings', {
  quality: coarse ? 'med' : 'high', lookSens: 5, touchSens: 5, padSens: 5, invertY: false, assist: true,
  preset: 'classic', southpaw: false, rumble: true, sfx: 8, music: 6, difficulty: 'normal',
});
const progress = load('progress', { done: {} });
const qs = new URLSearchParams(location.search);
if (qs.get('quality')) settings.quality = qs.get('quality');

// ------------------------------------------------------------ systems
const canvas = $('game');
const view = new View(canvas, settings.quality);
const hud = new HUD($('hudc'), $('hud'));
const input = new Input(canvas, $('touch'));
const audio = new Audio();
const nav = new MenuNav();
Object.assign(input.settings, settings);
hud.onBlip = () => audio.fx('blip');

const S = { mode: 'menu', w: null, levelId: null, acc: 0, stack: [], wonT: 0, stepDist: 0, attract: null, pending: blankInput(), combat: 0 };
function blankInput() { return { mx: 0, my: 0, fire: false, crouch: false, action: false }; }

// ------------------------------------------------------------ layout
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  view.resize(w, h);
  hud.resize(w, h, dpr);
  const sc = $('stickc'); sc.width = w * dpr; sc.height = h * dpr; sc.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  // safe-area insets for the canvas HUD
  const cs = getComputedStyle(document.documentElement);
  hud.safeT = parseFloat(cs.getPropertyValue('--sat')) || 0; hud.safeB = parseFloat(cs.getPropertyValue('--sab')) || 0;
  hud.safeL = parseFloat(cs.getPropertyValue('--sal')) || 0; hud.safeR = parseFloat(cs.getPropertyValue('--sar')) || 0;
}
addEventListener('resize', resize);

// ------------------------------------------------------------ screens
const SCREENS = ['title', 'campaign', 'tests', 'settings', 'controls', 'brief', 'loading', 'pause', 'debrief'];
function show(id, push = true) {
  const cur = SCREENS.find((s) => !$(s).classList.contains('hidden'));
  if (push && cur && cur !== id && cur !== 'loading') S.stack.push(cur);
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  nav.setFocus(null);
  if (id === 'campaign') renderCampaign();
  if (id === 'tests') renderTests();
  if (id === 'settings') renderSettings();
  if (id === 'controls') renderControls();
}
function hideScreens() { for (const s of SCREENS) $(s).classList.add('hidden'); S.stack = []; }
function back() {
  audio.fx('ui');
  const prev = S.stack.pop();
  if (S.mode === 'paused' && (!prev || prev === 'pause')) { if (!prev) return resume(); return show('pause', false); }
  show(prev || 'title', false);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  audio.unlock(); audio.music(S.mode === 'menu' ? 'title' : 'level');
  const go = b.dataset.go;
  if (go === 'back') back();
  else if (go === 'resume') resume();
  else { audio.fx('ui'); show(go); }
});

function renderCampaign() {
  const d = $('diff');
  d.innerHTML = DIFFICULTY.map((x) => `<button class="${x.id === settings.difficulty ? 'on' : ''}" data-diff="${x.id}">${x.name}</button>`).join('');
  d.querySelectorAll('[data-diff]').forEach((b) => (b.onclick = () => { settings.difficulty = b.dataset.diff; save('settings', settings); audio.fx('ui'); renderCampaign(); }));
  const m = $('missions');
  m.innerHTML = CAMPAIGN.map((id, i) => {
    const lv = LEVELS.find((l) => l.id === id), done = progress.done[id];
    return `<button class="mission" data-lv="${id}" ${i === 0 ? 'data-pad-first' : ''}><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${lv.name}<small>${lv.loc}</small></span>${done ? `<span class="done">✓ ${done.diff.toUpperCase()}</span>` : ''}</button>`;
  }).join('');
  m.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => brief(b.dataset.lv)));
}
function renderTests() {
  const m = $('testlist');
  const notes = { proving: 'Every weapon on a rack, holo-targets at 10 / 25 / 50 m, a movement course, and pads that spawn each enemy type.', plaza: 'Endless waves in a small night plaza. Good for combat feel and frame rate.' };
  m.innerHTML = TEST_MAPS.map((id, i) => { const lv = LEVELS.find((l) => l.id === id); return `<button class="mission" data-lv="${id}" ${i === 0 ? 'data-pad-first' : ''}><span class="n">T${i + 1}</span><span class="t">${lv.name}<small>${notes[id]}</small></span></button>`; }).join('');
  m.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => startLevel(b.dataset.lv)));
}

const SETTINGS_UI = [
  ['quality', 'GRAPHICS', ['low', 'med', 'high'], (v) => ({ low: 'LOW (older tablets)', med: 'MEDIUM', high: 'HIGH (shadows)' })[v]],
  ['lookSens', 'MOUSE SENSITIVITY', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ['touchSens', 'TOUCH LOOK SENSITIVITY', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ['padSens', 'CONTROLLER LOOK SENSITIVITY', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ['invertY', 'INVERT LOOK', [false, true], (v) => (v ? 'ON' : 'OFF')],
  ['assist', 'AIM ASSIST (touch + controller)', [true, false], (v) => (v ? 'ON' : 'OFF')],
  ['preset', 'CONTROLLER LAYOUT', ['classic', 'recon'], (v) => ({ classic: 'CLASSIC (Halo 2: X reload)', recon: 'RECON (RB reload)' })[v]],
  ['southpaw', 'SOUTHPAW (swap sticks)', [false, true], (v) => (v ? 'ON' : 'OFF')],
  ['rumble', 'CONTROLLER RUMBLE', [true, false], (v) => (v ? 'ON' : 'OFF')],
  ['sfx', 'EFFECTS VOLUME', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ['music', 'MUSIC VOLUME', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
];
function renderSettings() {
  const el = $('setlist');
  el.innerHTML = SETTINGS_UI.map(([k, label, vals, fmt], i) => `<button class="setrow" data-set="${k}" ${i === 0 ? 'data-pad-first' : ''}><span>${label}</span><b>${fmt ? fmt(settings[k]) : settings[k]}</b></button>`).join('')
    + '<p class="note">Graphics changes reload the page.</p>';
  el.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => {
    const [k, , vals] = SETTINGS_UI.find((r) => r[0] === b.dataset.set);
    const i = vals.indexOf(settings[k]);
    settings[k] = vals[(i + 1) % vals.length];
    save('settings', settings);
    Object.assign(input.settings, settings);
    applyVolumes();
    audio.fx('ui');
    if (k === 'quality') { location.reload(); return; }
    if (S.w) S.w.assist = settings.assist;
    const key = b.dataset.set;
    renderSettings();
    nav.setFocus(document.querySelector(`[data-set="${key}"]`));
  }));
}
function applyVolumes() { audio.setVolumes(settings.sfx / 10 * 0.9, settings.music / 10); }

function renderControls() {
  const fam = padFamily(input.padId), map = PAD_PRESETS[settings.preset];
  const pb = (a) => map[a].map((i) => buttonName(i, fam)).join(' / ');
  const rows = [
    ['Move', 'W A S D', 'Left stick', 'Left thumb (floating stick)'],
    ['Look', 'Mouse', 'Right stick', 'Drag on the right (or on FIRE)'],
    ['Fire', 'Left click', pb('fire'), 'FIRE'],
    ['Grenade', 'G / middle click', pb('grenade'), 'NADE'],
    ['Jump', 'Space', pb('jump'), 'JUMP'],
    ['Melee', 'Q / V', pb('melee'), 'MELEE'],
    ['Reload', 'R', `${pb('action')} (tap)`, 'ACTION (tap)'],
    ['Pick up / use', 'Hold E', `${pb('action')} (hold)`, 'ACTION (hold)'],
    ['Switch weapon', 'Tab / 1 / wheel', pb('swap'), 'SWAP'],
    ['Grenade type', 'T', pb('gswitch'), 'G-TYPE'],
    ['Crouch', 'Hold C / Ctrl', `${pb('crouch')} (toggle)`, 'CROUCH (toggle)'],
    ['Zoom', 'Right click / Shift', pb('zoom'), 'ZOOM'],
    ['Pause', 'Esc / P', pb('pause'), '❚❚'],
    ['Vehicle: enter / exit', 'Hold E', `${pb('action')} (hold)`, 'ACTION (hold)'],
    ['Vehicle: drive', 'W S (steers where you look)', 'Left stick + right stick', 'Stick + drag'],
    ['Vehicle: turret seat', 'Tab', pb('swap'), 'SWAP'],
    ['Sliver: boost', 'Hold C', pb('crouch'), 'CROUCH'],
    ['Objective', 'O', pb('objective'), 'pause menu'],
  ];
  $('ctltable').innerHTML = `<table><tr><th></th><th>KEYBOARD + MOUSE</th><th>${fam === 'xbox' ? 'XBOX CONTROLLER' : fam === 'ps' ? 'PLAYSTATION PAD' : 'SWITCH PAD'}</th><th>TOUCH</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table>
  <p class="note">Your shield recharges when you stop taking damage. Your health does not: find medical packs. Plasma strips shields; bullets finish the job. Hit a Bulwark in the back.</p>`;
}

function brief(id) {
  audio.fx('uiOk');
  const lv = LEVELS.find((l) => l.id === id);
  $('bLoc').textContent = lv.loc;
  $('bName').textContent = lv.name;
  const first = CAMPAIGN.indexOf(id) === 0;
  const intro = lv.sequence[0].start?.say?.slice(0, 2) || [];
  $('bText').innerHTML = (first ? PROLOGUE.map((p) => `<p>${p}</p>`).join('') : '') + intro.map(([s, t]) => `<p><b style="color:${SPEAKERS[s].color}">${SPEAKERS[s].name}:</b> ${t}</p>`).join('');
  $('bGo').onclick = () => startLevel(id);
  show('brief');
}

// ------------------------------------------------------------ level flow
function startLevel(id) {
  audio.unlock(); applyVolumes();
  if (!coarse && input.device === 'kbm') input.requestLock(); // inside the click: browsers require a gesture
  show('loading', false);
  S.mode = 'loading';
  setTimeout(() => {
    const lv = LEVELS.find((l) => l.id === id);
    const w = createWorld(lv, { difficulty: settings.difficulty, assist: settings.assist });
    S.w = w; S.levelId = id; S.acc = 0; S.wonT = 0; S.attract = null; S.pending = blankInput();
    view.load(w);
    view.attract = false;
    hud.clearSubs(); hud.dmg = [];
    hideScreens();
    $('hud').classList.remove('hidden');
    $('pausebtn').classList.remove('hidden');
    S.mode = 'play';
    input.enabled = true; input.reset();
    audio.music('level');
    drainEvents(); // the level's opening objective + comms
    updateTouchUI();
    if (window.TouchZoomGuard && coarse) window.TouchZoomGuard.enterFullscreen?.('landscape');
  }, 40);
}

function pause() {
  if (S.mode !== 'play') return;
  S.mode = 'paused'; S.pausedAt = performance.now(); audio.engine(null);
  input.enabled = false; input.reset(); input.exitLock();
  $('pObj').textContent = S.w?.objective ? `OBJECTIVE: ${S.w.objective}` : '';
  show('pause', false);
  S.stack = [];
  updateTouchUI();
}
function resume() {
  if (S.mode !== 'paused') return;
  hideScreens();
  S.mode = 'play';
  input.enabled = true; input.reset();
  if (input.device === 'kbm') input.requestLock();
  updateTouchUI();
}
function quitToMenu() {
  S.mode = 'menu'; S.w = null; input.enabled = false; input.exitLock(); audio.engine(null);
  $('hud').classList.add('hidden'); $('pausebtn').classList.add('hidden');
  hud.clearSubs();
  startAttract();
  show('title', false); S.stack = [];
  audio.music('title');
  updateTouchUI();
}
$('pRevert').onclick = () => { if (S.w) { restoreCheckpoint(S.w); drainEvents(); resume(); } };
$('pRestart').onclick = () => startLevel(S.levelId);
$('pQuit').onclick = quitToMenu;
$('pausebtn').onclick = () => (S.mode === 'play' ? pause() : resume());
$('dMenu').onclick = quitToMenu;

function complete() {
  const w = S.w, lv = w.level;
  S.mode = 'debrief'; input.enabled = false; input.exitLock();
  const st = w.stats;
  const mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
  const acc = st.shots ? Math.round((100 * st.hits) / st.shots) : 0;
  $('dTitle').textContent = lv.test ? 'SESSION ENDED' : 'MISSION COMPLETE';
  $('dStats').innerHTML = [['TIME', `${mm}:${String(ss).padStart(2, '0')}`], ['KILLS', st.kills], ['HEADSHOTS', st.heads], ['ACCURACY', `${acc}%`], ['DEATHS', st.deaths], ['DIFFICULTY', w.diff.name]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('dText').innerHTML = (lv.debrief || []).map(([s, t]) => `<p><b style="color:${SPEAKERS[s].color}">${SPEAKERS[s].name}:</b> ${t}</p>`).join('');
  const i = CAMPAIGN.indexOf(lv.id);
  if (i >= 0) { progress.done[lv.id] = { diff: w.diff.id, time: Math.round(st.time) }; save('progress', progress); }
  const next = CAMPAIGN[i + 1];
  $('dNext').style.display = next ? '' : 'none';
  $('dNext').onclick = () => brief(next);
  $('hud').classList.add('hidden'); $('pausebtn').classList.add('hidden');
  show('debrief', false); S.stack = [];
  updateTouchUI();
}

function updateTouchUI() {
  const on = S.mode === 'play' && input.device === 'touch';
  $('touch').classList.toggle('hidden', !on);
  document.body.classList.toggle('touchui', on);
  hud.touchMode = on;
  hud.setGlyphs(input.glyphs());
}
input.onDevice = () => updateTouchUI();
input.onKey = (k) => {
  if (S.mode === 'paused' && (k === 'Escape' || k === 'KeyP') && performance.now() - S.pausedAt > 350) resume();
  else if (S.mode !== 'play' && S.mode !== 'loading' && k === 'Escape') back();
};
input.onUnlock = () => { if (S.mode === 'play' && input.device === 'kbm') pause(); };
input.onPadConnect = () => { $('padnote').textContent = `Controller connected: ${padFamily(input.padId) === 'xbox' ? 'Xbox' : padFamily(input.padId)} layout`; updateTouchUI(); };

// pause on anything that steals focus (template rule: auto-pause on blur, visibility, zoom)
addEventListener('blur', () => pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.TouchZoomGuard?.init({ onZoomChange: (z) => { if (z) pause(); } });

// ------------------------------------------------------------ events → audio, HUD, rumble
function dist(w, x, z) { return Math.hypot(x - w.player.pos.x, z - w.player.pos.z); }
const fall = (d, r = 60) => Math.max(0, 1 - d / r);
function drainEvents() {
  const w = S.w;
  if (!w) return [];
  const evs = w.events.splice(0);
  for (const e of evs) {
    hud.event(w, e, view);
    switch (e.type) {
      case 'fire': {
        const d = WEAPONS[e.id] || MOUNTED[e.id];
        audio.fx(e.charged ? 'chargedShot' : d.sound, 1);
        input.rumble(e.id === 'shotgun' || e.id === 'lance' ? 0.6 : 0.15, 0.3, e.id === 'rifle' ? 40 : 70);
        break;
      }
      case 'vehicleEnter': audio.fx('vehicleEnter'); hud.toast(`${VEHICLES[e.vtype].short}: ${e.seat === 'gunner' ? 'TURRET' : 'DRIVER'}`, 'wpn'); break;
      case 'vehicleExit': audio.fx('vehicleExit'); break;
      case 'seat': audio.fx('seat'); hud.toast(e.seat === 'gunner' ? 'TURRET SEAT' : 'DRIVER SEAT', 'wpn'); break;
      case 'splatter': audio.fx('splatter', fall(dist(w, e.x, e.z), 40) + 0.2); if (e.player) input.rumble(0.8, 0.5, 200); break;
      case 'vehicleBump': audio.fx('vehicleBump', Math.min(1, e.v / 12) * (fall(dist(w, e.x, e.z), 50) + 0.2)); if (w.player.vehicle) input.rumble(0.7, 0.3, 150); break;
      case 'vehicleLand': audio.fx('vehicleLand', Math.min(1, e.v / 10)); if (w.player.vehicle) input.rumble(0.4, 0.4, 120); break;
      case 'vehicleHit': if (e.player) { audio.fx('vehicleHit', 0.7); input.rumble(0.3, 0.3, 80); } break;
      case 'vehicleDie': audio.fx('bigBoom', fall(dist(w, e.x, e.z), 140) + 0.1); input.rumble(1, 1, 500); break;
      case 'boost': audio.fx('boost', 0.8); break;
      case 'enemyFire': audio.fx(e.weapon === 'caster' ? 'plasma' : e.weapon || 'plasma', 0.55 * fall(dist(w, e.x, e.z))); break;
      case 'impact': audio.fx(e.surface === 'flesh' ? 'hitFlesh' : e.surface === 'shield' ? 'hitShield' : e.surface === 'armor' ? 'armor' : Math.random() < 0.25 ? 'ricochet' : 'hitFlesh', e.surface === 'flesh' || e.surface === 'shield' || e.surface === 'armor' ? 0.8 : 0.3); break;
      case 'shieldHit': audio.fx('hitShield', 0.6); break;
      case 'shieldPop': audio.fx('shieldPop', fall(dist(w, e.x, e.z), 50)); break;
      case 'explosion': {
        const d = dist(w, e.x, e.z);
        audio.fx(e.kind === 'plasma' ? 'plasmaBoom' : e.kind === 'big' ? 'bigBoom' : 'frag', fall(d, 140) + 0.1);
        input.rumble(Math.max(0, 1 - d / 20), Math.max(0, 1 - d / 30), 300);
        break;
      }
      case 'enemyDie': {
        const v = fall(dist(w, e.x, e.z), 50);
        if (e.etype === 'skitter') audio.yelp(700, 0.35, 0.12 * v, [700, 1800, 2600]);
        else if (e.etype === 'trooper') audio.yelp(180, 0.6, 0.16 * v);
        else if (e.etype === 'heavy') audio.yelp(90, 1.0, 0.2 * v, [400, 900, 2400]);
        else if (e.etype === 'drone') audio.fx('frag', v * 0.5);
        break;
      }
      case 'alert': {
        const v = fall(dist(w, e.x, e.z), 45);
        if (e.etype === 'skitter') audio.yelp(620, 0.22, 0.09 * v, [700, 1800, 2600]);
        if (e.etype === 'trooper') audio.yelp(150, 0.45, 0.14 * v);
        if (e.etype === 'heavy') audio.yelp(70, 0.8, 0.18 * v, [400, 900, 2400]);
        break;
      }
      case 'panic': if (audio.ctx) audio.scream(0.35 * fall(dist(w, e.x, e.z), 40)); break;
      case 'enrage': case 'berserk': audio.yelp(110, 0.9, 0.2 * fall(dist(w, e.x, e.z), 50), [500, 1000, 2400]); break;
      case 'enemyWindup': if (e.etype === 'heavy') audio.yelp(60, 0.6, 0.15); break;
      case 'enemyMelee': if (e.hit) { audio.fx('meleeHit'); input.rumble(0.9, 0.6, 250); } break;
      case 'playerHit': audio.fx(e.shield ? 'hurtShield' : 'hurt'); input.rumble(e.shield ? 0.2 : 0.6, 0.5, 120); break;
      case 'shieldDown': audio.fx('shieldDown'); break;
      case 'shieldRecharge': audio.fx('recharge'); break;
      case 'reload': audio.fx('reload'); break;
      case 'shell': audio.fx('shell'); break;
      case 'switch': audio.fx('switch'); break;
      case 'dry': audio.fx('dry'); break;
      case 'overheat': audio.fx('overheat'); break;
      case 'charged': audio.fx('charged'); break;
      case 'zoom': audio.fx('ui', 0.6); break;
      case 'melee': audio.fx(e.hit ? 'meleeHit' : 'melee'); if (e.hit) input.rumble(0.5, 0.5, 120); break;
      case 'throw': audio.fx('throw'); break;
      case 'grenadeBounce': audio.fx(e.g === 'frag' ? 'bounce' : 'stick', 0.6); break;
      case 'stuck': case 'stuckPlayer': audio.fx('stick'); break;
      case 'pickup': audio.fx(e.what === 'health' ? 'health' : 'pickup'); break;
      case 'checkpoint': audio.fx('checkpoint'); break;
      case 'objective': if (e.index > 0) audio.fx('objective'); break;
      case 'door': audio.fx('door'); break;
      case 'targetDestroyed': audio.fx('targetDown'); input.rumble(1, 1, 500); break;
      case 'levelComplete': audio.fx('win'); break;
      case 'playerDie': audio.fx('die'); input.rumble(1, 1, 600); hud.clearSubs(); break;
      case 'jump': audio.fx('jump', 0.6); break;
      case 'land': audio.fx('land', Math.min(1, e.v / 10)); break;
      case 'splash': break;
      case 'use': audio.fx('uiOk'); break;
      case 'wave': audio.fx('objective'); break;
      case 'supercombine': audio.fx('plasmaBoom', 0.8); break;
      default: break;
    }
  }
  return evs;
}

// ------------------------------------------------------------ attract (title backdrop)
function startAttract() {
  const lv = LEVELS.find((l) => l.id === 'gorge');
  const w = createWorld(lv, { difficulty: 'normal' });
  w.mode = 'attract';
  S.attract = w;
  view.load(w);
  view.attract = true;
  w.events.length = 0;
}

// ------------------------------------------------------------ loop
let last = performance.now();
const metrics = { fps: 60, frames: 0, t0: performance.now() };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 20));
  last = now;
  const t = now / 1000;
  metrics.frames++;
  if (now - metrics.t0 > 1000) { metrics.fps = metrics.frames * 1000 / (now - metrics.t0); metrics.frames = 0; metrics.t0 = now; }
  const edges = input.pollPad();
  const wasPlay = S.mode === 'play';
  audio.tick();

  if (S.mode === 'play' && S.w) {
    const w = S.w;
    const inp = input.frame(dt);
    if (inp.pause) { pause(); }
    if (inp.objective) hud.toast(`OBJECTIVE: ${w.objective}`, 'obj');
    // look is applied per render frame (smooth on 120 Hz iPads); aim assist lives in the sim
    applyLook(w, inp.lookX, inp.lookY, inp.assisted, dt);
    // edges wait for the next fixed step
    const P = S.pending;
    for (const k of ['fireEdge', 'jump', 'reload', 'swap', 'grenade', 'melee', 'gswitch', 'zoom']) P[k] = P[k] || inp[k];
    Object.assign(P, { mx: inp.mx, my: inp.my, fire: inp.fire, crouch: inp.crouch, action: inp.action });
    w.player.assisted = inp.assisted;
    S.acc += dt;
    let n = 0;
    while (S.acc >= DT && n < 4) {
      step(w, DT, P);
      for (const k of ['fireEdge', 'jump', 'reload', 'swap', 'grenade', 'melee', 'gswitch', 'zoom']) P[k] = false;
      S.acc -= DT; n++;
    }
    if (n === 4) S.acc = 0;
    const evs = drainEvents();
    const p = w.player;
    // footsteps
    if (p.onGround && w.mode === 'play') {
      S.stepDist += Math.hypot(p.pos.x - p.prev.x, p.pos.z - p.prev.z) * n;
      if (S.stepDist > (p.crouch > 0.5 ? 1.4 : 2.1)) {
        S.stepDist = 0;
        const box = w.geo.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.05) > w.geo.terrainH(p.pos.x, p.pos.z) + 0.05;
        const wet = (w.level.water || []).some((q) => q.y > p.pos.y && p.pos.x > q.x0 && p.pos.x < q.x1);
        audio.step(wet ? 'water' : box ? 'metal' : 'dirt', p.crouch > 0.5 ? 0.3 : 0.6);
      }
    }
    if (p.shield <= 0 && w.mode === 'play') audio.lowShieldTick(dt);
    // engine
    const ride = p.vehicle ? w.vehicles.find((v) => v.id === p.vehicle) : null;
    if (ride && !ride.dead) audio.engine(ride.type, Math.abs(ride.speed) / VEHICLES[ride.type].maxSpeed + Math.abs(ride.throttle) * 0.12, ride.boosting);
    else audio.engine(null);
    // music intensity: alerted hostiles nearby
    let k = 0;
    for (const e of w.enemies) if (!e.dead && e.alert && !ENEMIES[e.type].dummy && Math.hypot(e.x - p.pos.x, e.z - p.pos.z) < 40) k += e.type === 'heavy' ? 0.5 : 0.25;
    audio.setCombat(Math.min(1, k));
    view.update(w, Math.min(1, S.acc / DT), dt, t, evs);
    hud.update(w, view, dt, t, aimInfo(w));
    $('revert').classList.toggle('on', w.mode === 'dead' && w.deadT > 1.2);
    if (w.mode === 'dead' && w.deadT > 3.2) { restoreCheckpoint(w); drainEvents(); hud.dmg = []; }
    if (w.mode === 'won') { S.wonT += dt; if (S.wonT > 2.5) complete(); }
    drawStick();
  } else if (S.attract) {
    // title backdrop: glide up the gorge
    const w = S.attract;
    for (let i = 0; i < 2; i++) step(w, DT / 2, {});
    w.events.length = 0;
    const p = w.player;
    const z = 10 - ((t * 3) % 220);
    p.prev = { ...p.pos };
    p.pos.x = 10 * Math.sin(z * 0.018) + 4 * Math.sin(z * 0.047 + 1) + Math.sin(t * 0.2) * 6;
    p.pos.z = z; p.pos.y = w.geo.terrainH(p.pos.x, z) + 6;
    p.yaw = Math.sin(t * 0.15) * 0.3; p.pitch = -0.12;
    view.update(w, 1, dt, t, []);
    view.vm.root.visible = false;
    hud.g.clearRect(0, 0, hud.w, hud.h);
  } else if (S.w && S.mode !== 'loading') {
    view.update(S.w, 1, 0, t, []);
    if (S.mode === 'paused') hud.update(S.w, view, 0, t, null);
  }
  if (!wasPlay && S.mode !== 'play' && S.mode !== 'loading') {
    nav.update(edges, input.pad, dt, back);
    if (edges.pause && S.mode === 'paused') resume();
  }
  view.render();
}

function drawStick() {
  const c = $('stickc').getContext('2d');
  c.clearRect(0, 0, innerWidth, innerHeight);
  if (input.device !== 'touch' || S.mode !== 'play') return;
  const s = input.stick;
  if (s.active) {
    c.beginPath(); c.arc(s.bx, s.by, s.R, 0, 6.28); c.fillStyle = 'rgba(110,195,255,0.12)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(110,195,255,0.5)'; c.stroke();
    c.beginPath(); c.arc(s.tx, s.ty, 26, 0, 6.28); c.fillStyle = 'rgba(110,195,255,0.45)'; c.fill();
  } else {
    c.beginPath(); c.arc(110, innerHeight - 230, 50, 0, 6.28); c.lineWidth = 2; c.strokeStyle = 'rgba(110,195,255,0.22)'; c.stroke();
  }
}

// ------------------------------------------------------------ boot
resize();
applyVolumes();
startAttract();
show('title', false);
requestAnimationFrame(frame);
addEventListener('pointerdown', () => { audio.unlock(); if (S.mode === 'menu') audio.music('title'); }, { once: true });
addEventListener('keydown', () => { audio.unlock(); if (S.mode === 'menu') audio.music('title'); }, { once: true });
if (qs.get('level')) { settings.difficulty = qs.get('diff') || settings.difficulty; startLevel(qs.get('level')); }
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Test hooks (tools/smoke.mjs, tools/sim-check.mjs, the console).
window.GAME = {
  THREE,
  get w() { return S.w; }, get mode() { return S.mode; }, S, view, input, audio, settings, metrics,
  start: startLevel, pause, resume, summary: () => (S.w ? summary(S.w) : null),
  ff(sec) { const w = S.w; for (let i = 0; i < sec * 60; i++) step(w, DT, S.pending); drainEvents(); },
  teleport(x, z, y) { const p = S.w.player, g = S.w.geo; p.pos.x = x; p.pos.z = z; p.pos.y = y ?? g.groundAt(x, z, g.terrainH(x, z) + 1.3, T.radius, 0); p.vel = { x: 0, y: 0, z: 0 }; },
};
