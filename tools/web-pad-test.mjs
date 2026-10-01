// Unit test for the browser build's gamepad bridge (site/play/gamepad.js):
// every Xbox button, stick and trigger must produce the key / mouse events
// that mod/KEYCONF.txt's cca_kbmlayout binds.   node tools/web-pad-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { self: {} };
vm.runInNewContext(readFileSync(new URL('../site/play/gamepad.js', import.meta.url), 'utf8'), ctx);
const P = ctx.self.CCAPad;

// cca_kbmlayout's binds, parsed from KEYCONF (key -> command).
const keyconf = readFileSync(new URL('../mod/KEYCONF.txt', import.meta.url), 'utf8');
const kbm = Object.fromEntries([...keyconf.match(/alias cca_kbmlayout "([^"]+)"/)[1].matchAll(/bind (\S+) ([^;]+)/g)]
  .map((m) => [m[1].toLowerCase(), m[2].trim()]));

const pad = (buttons = {}, axes = [0, 0, 0, 0]) => ({
  axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (buttons[i] || 0) > 0.5, value: buttons[i] || 0 })),
});
const run = (mode, frames) => {
  const st = P.createState();
  const out = [];
  let t = 0;
  for (const f of frames) { t += 16; out.push(...P.step(st, f, {}, mode, 16, t)); }
  return out;
};
const domToBind = { ' ': 'space', Tab: 'tab', Escape: 'escape', Shift: 'shift' };

// Each gameplay button: press -> down event, release -> up event, mapped to the KBM bind.
const expectGame = {
  0: ['key', 'space', '+jump'], 1: ['key', 'c', '+crouch'], 2: ['key', 'e', '+use'], 4: ['key', 'g', '+user1'],
  5: ['key', 'q', '+user2'], 8: ['key', 'tab', 'togglemap'], 9: ['key', 'escape', null], 10: ['key', 'shift', null],
  11: ['key', 'v', 'cca_dual'], 12: ['key', 'f', 'cca_flashlight'], 13: ['key', 'h', 'cca_iris'], 15: ['key', 't', 'cca_gtype'],
  6: ['mouse', 2, null], 7: ['mouse', 0, null], 3: ['wheel', 100, null], 14: ['wheel', -100, null],
};
for (const [i, [kind, what, bind]] of Object.entries(expectGame)) {
  const ev = run('game', [pad({ [i]: 1 }), pad({ [i]: 1 }), pad()]);
  if (kind === 'key') {
    assert.deepEqual(ev.map((e) => e.type), ['keydown', 'keyup'], `button ${i}`);
    const k = domToBind[ev[0].key] || ev[0].key;
    assert.equal(k, what, `button ${i} key`);
    if (bind) assert.equal(kbm[k], bind, `button ${i}: KEYCONF binds ${k} to ${kbm[k]}, pad layout expects ${bind}`);
  } else if (kind === 'mouse') {
    assert.deepEqual(ev.map((e) => [e.type, e.button]), [['mousedown', what], ['mouseup', what]], `button ${i}`);
  } else {
    assert.deepEqual(ev.map((e) => [e.type, e.deltaY]), [['wheel', what]], `button ${i} (one wheel step per press)`);
  }
}
// Mouse binds the triggers rely on.
assert.equal(kbm.mouse1, '+attack');
assert.equal(kbm.mouse2, '+altattack');

// Triggers are analog with hysteresis: 0.3 does not fire, 0.5 does, 0.25 holds, 0.1 releases.
assert.deepEqual(run('game', [pad({ 7: 0.3 })]), []);
assert.deepEqual(run('game', [pad({ 7: 0.5 }), pad({ 7: 0.25 }), pad({ 7: 0.1 })]).map((e) => e.type), ['mousedown', 'mouseup']);

// Left stick -> WASD with a deadzone (8-way).
assert.deepEqual(run('game', [pad({}, [0.2, -0.2, 0, 0])]), [], 'deadzone');
const diag = run('game', [pad({}, [0.8, -0.8, 0, 0]), pad()]);
assert.deepEqual(diag.map((e) => e.type + ':' + e.key).sort(), ['keydown:d', 'keydown:w', 'keyup:d', 'keyup:w']);
assert.deepEqual(run('game', [pad({}, [-1, 1, 0, 0])]).map((e) => e.key).sort(), ['a', 's']);

// Right stick -> relative mouse motion, none inside the deadzone, y follows the stick (or inverted).
assert.deepEqual(run('game', [pad({}, [0, 0, 0.1, 0.05])]), []);
let mv = run('game', Array(30).fill(pad({}, [0, 0, 1, -0.5])));
const sx = mv.reduce((s, e) => s + e.movementX, 0), sy = mv.reduce((s, e) => s + e.movementY, 0);
assert.ok(mv.every((e) => e.type === 'mousemove') && sx > 200 && sy < -50, `look ${sx},${sy}`);
const st = P.createState();
const inv = P.step(st, pad({}, [0, 0, 0, 1]), { invertY: true }, 'game', 100, 1);
assert.ok(inv[0].movementY < 0, 'invert Y');

// Menus: D-pad / left stick -> arrows (auto-repeat), A -> Enter, B / Start -> Escape.
assert.deepEqual(run('menu', [pad({ 0: 1 }), pad()]).map((e) => e.type + ':' + e.key), ['keydown:Enter', 'keyup:Enter']);
assert.deepEqual(run('menu', [pad({ 1: 1 }), pad()]).map((e) => e.key), ['Escape', 'Escape']);
const held = run('menu', Array(60).fill(pad({ 13: 1 })));
assert.ok(held[0].type === 'keydown' && held[0].key === 'ArrowDown' && !held[0].repeat);
assert.ok(held.filter((e) => e.repeat).length >= 3, 'menu auto-repeat');
assert.deepEqual(run('menu', [pad({}, [0, -1, 0, 0]), pad()]).map((e) => e.type + ':' + e.key), ['keydown:ArrowUp', 'keyup:ArrowUp']);

// Switching game -> menu releases everything held (no stuck keys).
const sw = P.createState();
P.step(sw, pad({ 7: 1 }, [0, -1, 0, 0]), {}, 'game', 16, 16);
const rel = P.step(sw, pad({ 7: 1 }, [0, -1, 0, 0]), {}, 'menu', 16, 32);
assert.ok(rel.some((e) => e.type === 'mouseup') && rel.some((e) => e.type === 'keyup' && e.key === 'w'), 'release on mode switch');
// Disconnect releases too.
const dc = P.createState();
P.step(dc, pad({ 0: 1 }), {}, 'game', 16, 16);
assert.deepEqual([...P.step(dc, null, {}, 'game', 16, 32)].map((e) => e.type + ':' + e.key), ['keyup: ']);

console.log('web-pad-test: gamepad mapping OK (all buttons match cca_kbmlayout)');
