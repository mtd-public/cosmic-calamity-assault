// Gamepad bridge: turns a Gamepad snapshot into the same keyboard / mouse
// events the page already forwards to the engine worker. GZDoom's own pad
// support can't see the controller (the engine runs in a Web Worker, and the
// Gamepad API exists only on the main thread), so the pad is translated to the
// keyboard + mouse layout from mod/KEYCONF.txt (alias cca_kbmlayout).
//
// Pure and DOM-free so it can be unit-tested in Node (tools/web-pad-test.mjs).
// Exposes self.CCAPad.
(function (root) {
  'use strict';

  const K = (key, code, keyCode) => ({ kind: 'key', key, code, keyCode });
  const KEYS = {
    W: K('w', 'KeyW', 87), A: K('a', 'KeyA', 65), S: K('s', 'KeyS', 83), D: K('d', 'KeyD', 68),
    Space: K(' ', 'Space', 32), C: K('c', 'KeyC', 67), E: K('e', 'KeyE', 69),
    G: K('g', 'KeyG', 71), Q: K('q', 'KeyQ', 81), F: K('f', 'KeyF', 70), T: K('t', 'KeyT', 84),
    H: K('h', 'KeyH', 72), V: K('v', 'KeyV', 86), Shift: K('Shift', 'ShiftLeft', 16),
    Tab: K('Tab', 'Tab', 9), Escape: K('Escape', 'Escape', 27), Enter: K('Enter', 'Enter', 13),
    Up: K('ArrowUp', 'ArrowUp', 38), Down: K('ArrowDown', 'ArrowDown', 40),
    Left: K('ArrowLeft', 'ArrowLeft', 37), Right: K('ArrowRight', 'ArrowRight', 39),
  };
  // Mouse wheel = weapnext / weapprev (GZDoom default binds MWheelDown / MWheelUp).
  const WHEEL_NEXT = { kind: 'wheel', deltaY: 100 };
  const WHEEL_PREV = { kind: 'wheel', deltaY: -100 };
  const MOUSE1 = { kind: 'button', button: 0 };
  const MOUSE2 = { kind: 'button', button: 2 };

  // Standard-mapping button indices (https://w3c.github.io/gamepad/#remapping).
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9,
              L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

  // In game: the Xbox layout from MENUDEF "CCAControllerLayout", sent as the
  // keys cca_kbmlayout binds.
  const GAME = {
    [B.A]: KEYS.Space,       // jump (again in the air: clamber)
    [B.B]: KEYS.C,           // crouch (hold in the air: dolphin dive)
    [B.X]: KEYS.E,           // use / reload / revive / hack
    [B.Y]: WHEEL_NEXT,       // next weapon
    [B.LB]: KEYS.G,          // grenade (hold to cook)
    [B.RB]: KEYS.Q,          // quick melee
    [B.LT]: MOUSE2,          // aim down sights / left gun
    [B.RT]: MOUSE1,          // fire
    [B.VIEW]: KEYS.Tab,      // automap
    [B.START]: KEYS.Escape,  // menu
    [B.L3]: KEYS.Shift,      // run
    [B.R3]: KEYS.V,          // dual wield
    [B.UP]: KEYS.F,          // flashlight
    [B.RIGHT]: KEYS.T,       // grenade type
    [B.DOWN]: KEYS.H,        // IRIS: objective + waypoint
    [B.LEFT]: WHEEL_PREV,    // previous weapon
  };
  // In menus (the engine has released the mouse): navigate like GZDoom's own pad support.
  const MENU = {
    [B.A]: KEYS.Enter, [B.B]: KEYS.Escape, [B.START]: KEYS.Escape, [B.VIEW]: KEYS.Escape,
    [B.UP]: KEYS.Up, [B.DOWN]: KEYS.Down, [B.LEFT]: KEYS.Left, [B.RIGHT]: KEYS.Right,
  };
  const MENU_REPEAT = new Set([B.UP, B.DOWN, B.LEFT, B.RIGHT]);

  const DEFAULTS = {
    moveOn: 0.35, moveOff: 0.25,     // left stick -> WASD (press / release thresholds)
    lookDeadzone: 0.12,              // right stick
    lookSpeed: 900,                  // mouse px per second at full deflection (x sensitivity)
    sensitivity: 1,
    invertY: false,
    triggerOn: 0.35, triggerOff: 0.2,
    repeatDelay: 380, repeatEvery: 110,  // menu navigation auto-repeat (ms)
  };

  function createState() {
    return { held: new Map(), mode: 'game', lookAccX: 0, lookAccY: 0, repeatAt: new Map() };
  }

  // Triggers are read as analog values; other buttons by `pressed`.
  const btnValue = (pad, i, analog) => {
    const b = pad.buttons && pad.buttons[i];
    if (b == null) return 0;
    if (typeof b === 'number') return b;
    if (analog && typeof b.value === 'number') return b.value;
    return b.pressed ? 1 : (b.value || 0);
  };

  // Emit press/release for one logical input (id) mapped to action `act`.
  function setHeld(state, out, id, act, down, repeat) {
    const was = state.held.get(id);
    if (down && !was) {
      state.held.set(id, act);
      press(out, act, true, false);
    } else if (!down && was) {
      state.held.delete(id);
      press(out, was, false, false);
    } else if (down && was && repeat) {
      press(out, was, true, true);
    }
  }

  function press(out, act, down, repeat) {
    if (act.kind === 'key') {
      out.push({ type: down ? 'keydown' : 'keyup', key: act.key, code: act.code, keyCode: act.keyCode, repeat: !!repeat });
    } else if (act.kind === 'button') {
      out.push({ type: down ? 'mousedown' : 'mouseup', button: act.button });
    } else if (act.kind === 'wheel') {
      if (down && !repeat) out.push({ type: 'wheel', deltaY: act.deltaY });
    }
  }

  function releaseAll(state, out) {
    for (const [, act] of state.held) press(out, act, false, false);
    state.held.clear();
    state.repeatAt.clear();
    state.lookAccX = state.lookAccY = 0;
  }

  // One poll. pad: {buttons:[{pressed,value}|number], axes:[lx,ly,rx,ry]} or null.
  // mode: 'game' (engine has captured the mouse) or 'menu'. dt: ms since last poll.
  // Returns an array of events:
  //   {type:'keydown'|'keyup', key, code, keyCode, repeat}
  //   {type:'mousedown'|'mouseup', button}  {type:'wheel', deltaY}  {type:'mousemove', movementX, movementY}
  function step(state, pad, opts, mode, dt, now) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const out = [];
    if (!pad) { releaseAll(state, out); return out; }
    if (mode !== state.mode) { releaseAll(state, out); state.mode = mode; }
    now = now || 0;
    const ax = (i) => (pad.axes && typeof pad.axes[i] === 'number') ? pad.axes[i] : 0;
    const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
    const map = mode === 'menu' ? MENU : GAME;

    // Buttons (triggers are analog with hysteresis).
    for (const idx of Object.keys(map)) {
      const i = +idx, act = map[i], id = 'b' + i;
      const isTrig = i === B.LT || i === B.RT;
      const v = btnValue(pad, i, isTrig);
      const on = !isTrig ? v >= 0.5 : state.held.has(id) ? v > o.triggerOff : v >= o.triggerOn;
      let repeat = false;
      if (mode === 'menu' && MENU_REPEAT.has(i) && on && state.held.has(id)) repeat = due(state, id, now, o);
      if (on && !state.held.has(id) && mode === 'menu' && MENU_REPEAT.has(i)) state.repeatAt.set(id, now + o.repeatDelay);
      setHeld(state, out, id, act, on, repeat);
    }

    if (mode === 'game') {
      // Left stick -> W/A/S/D, each direction independent (8-way), with hysteresis.
      stickKey(state, out, 'lu', KEYS.W, -ly, o);
      stickKey(state, out, 'ld', KEYS.S, ly, o);
      stickKey(state, out, 'll', KEYS.A, -lx, o);
      stickKey(state, out, 'lr', KEYS.D, lx, o);
      // Right stick -> mouse-look deltas (quadratic response outside the deadzone).
      const mag = Math.hypot(rx, ry);
      if (mag > o.lookDeadzone) {
        const k = Math.min(1, (mag - o.lookDeadzone) / (1 - o.lookDeadzone));
        const scale = (k * k) / mag * o.lookSpeed * o.sensitivity * Math.min(dt, 100) / 1000;
        state.lookAccX += rx * scale;
        state.lookAccY += ry * scale * (o.invertY ? -1 : 1);
        const mx = Math.trunc(state.lookAccX), my = Math.trunc(state.lookAccY);
        state.lookAccX -= mx; state.lookAccY -= my;
        if (mx || my) out.push({ type: 'mousemove', movementX: mx, movementY: my });
      } else {
        state.lookAccX = state.lookAccY = 0;
      }
    } else {
      // Menus: left stick acts as the D-pad (auto-repeat while held).
      const dirs = [['mu', KEYS.Up, -ly], ['md', KEYS.Down, ly], ['ml', KEYS.Left, -lx], ['mr', KEYS.Right, lx]];
      for (const [id, key, v] of dirs) {
        const on = state.held.has(id) ? v > o.moveOff : v >= o.moveOn + 0.15;
        let repeat = false;
        if (on && state.held.has(id)) repeat = due(state, id, now, o);
        else if (on) state.repeatAt.set(id, now + o.repeatDelay);
        setHeld(state, out, id, key, on, repeat);
      }
    }
    return out;
  }

  function stickKey(state, out, id, key, v, o) {
    const on = state.held.has(id) ? v > o.moveOff : v >= o.moveOn;
    setHeld(state, out, id, key, on, false);
  }

  function due(state, id, now, o) {
    const at = state.repeatAt.get(id);
    if (at === undefined || now < at) return false;
    state.repeatAt.set(id, now + o.repeatEvery);
    return true;
  }

  // True when a pad shows any deliberate input (used to wake the bridge / show hints).
  function active(pad) {
    if (!pad) return false;
    if ((pad.axes || []).some((a) => Math.abs(a) > 0.4)) return true;
    return (pad.buttons || []).some((b) => (typeof b === 'number' ? b : b.value || (b.pressed ? 1 : 0)) > 0.5);
  }

  const api = { createState, step, releaseAll, active, DEFAULTS, BUTTONS: B, GAME, MENU };
  root.CCAPad = api;
})(typeof self !== 'undefined' ? self : globalThis);
