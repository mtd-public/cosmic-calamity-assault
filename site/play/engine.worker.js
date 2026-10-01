// engine.worker.js — GZDoom (WebAssembly) running in a Web Worker against an
// OffscreenCanvas, for COSMIC CALAMITY: ASSAULT's browser build (site/play/).
//
// Adapted from tomb-engine's demo/engine.worker.js
// (https://github.com/mungus43/tomb-engine, GPLv3; see engine/LICENSE). Changes:
//   - boot takes the engine's base URL, a pre-fetched gzdoom.js (blob URL) and
//     gzdoom.wasm bytes, so the page can show download progress
//   - savegames persist in IndexedDB (the wasm build has no IDBFS): restored
//     into MEMFS before main(), written back whenever they change
//   - posts {type:'capture', on} when the engine grabs / releases the mouse
//     (SDL relative mode: gameplay vs menus), so the page can manage pointer
//     lock and the gamepad bridge can switch between game and menu mappings
//   - log noise filtered (debug traces, terminal escape codes)
//
// Main-thread side: play.js. Engine build: GZDoom g4.11.3 + tomb-engine's
// WebAssembly patches (Emscripten, JSPI, WebGL2), vendored in web/engine/.

'use strict';

// ---------------------------------------------------------------------------
// 1. DOM SHIMS
//
// emscripten's SDL2 port reaches for `window`, `document`, `location`, and
// `navigator`. None exist in a DedicatedWorker. Provide just enough surface to
// avoid TypeErrors at engine boot. Anything not stubbed here will throw the
// first time the engine touches it — we'll patch as bugs surface.
// ---------------------------------------------------------------------------

// Instrumented EventTarget shim — logs when listeners are added so we can
// see exactly where emscripten/SDL2 attached its input handlers.
const _attachLog = [];
function makeEventTarget(label) {
  const map = new Map(); // type -> Set<listener>
  const target = {
    __label: label,
    __listenerCounts: () => Object.fromEntries([...map].map(([t, s]) => [t, s.size])),
    addEventListener(type, fn, opts) {
      if (!fn) return;
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      _attachLog.push({ on: label, type, capture: !!(opts && opts.capture || opts === true) });
    },
    removeEventListener(type, fn) {
      map.get(type)?.delete(fn);
    },
    dispatchEvent(evt) {
      const list = map.get(evt.type);
      if (!list || list.size === 0) return true;
      // Real EventTarget.dispatchEvent populates `target` and `currentTarget`
      // for the duration of dispatch. Our shim objects aren't real EventTargets,
      // so emscripten listeners reading `e.target.id` crashed (target was null).
      // Override the read-only properties for the duration of the dispatch.
      try {
        Object.defineProperty(evt, 'target',        { value: target, configurable: true });
        Object.defineProperty(evt, 'currentTarget', { value: target, configurable: true });
        Object.defineProperty(evt, 'srcElement',    { value: target, configurable: true });
      } catch (_) {}
      for (const fn of [...list]) {
        try { fn.call(target, evt); } catch (e) {
          self.postMessage({ type: 'log', stream: 'stderr',
            msg: '[worker] listener threw for ' + evt.type + ': ' + (e && e.message) });
        }
      }
      return !evt.defaultPrevented;
    },
  };
  return target;
}

// Pointer-lock state lives on `document`. Engine reads
// `document.pointerLockElement` to decide whether to consume mouse-look deltas.
const docTarget = makeEventTarget('document');
const winTarget = makeEventTarget('window');

// Build the `document` shim. Some methods (createElement, getElementById)
// MUST return sensible objects — emscripten's SDL2 setup probes them.
// `id`/`nodeName` — emscripten focus/blur/etc. handlers read `e.target.id` and
// `e.target.nodeName` when reporting events. Provide them so handlers don't NPE.
const documentShim = Object.assign(docTarget, {
  id: '',
  nodeName: '#document',
  // emscripten calls getElementById('canvas') in autoResumeAudioContext (which
  // we don't care about) and in a couple of GL helpers. Return our canvas when
  // asked for 'canvas', null otherwise.
  getElementById(id) {
    if (id === 'canvas' && self.__moduleCanvas) return self.__moduleCanvas;
    return null;
  },
  querySelector(sel) {
    if (sel === '#canvas' || sel === 'canvas') return self.__moduleCanvas || null;
    return null;
  },
  createElement(tag) {
    const t = String(tag || '').toLowerCase();
    // SDL_CreateColorCursor (EM_ASM at gzdoom.js:1141602) does
    // `document.createElement('canvas')` then `getContext('2d')` to render a
    // pixel-data cursor. Returning a real OffscreenCanvas lets that path work.
    if (t === 'canvas') {
      const c = new OffscreenCanvas(1, 1);
      // Some emscripten paths assign `c.style`; give it a soft target.
      try { c.style = {}; } catch (_) {}
      // SDL_CreateColorCursor stores the result of `canvas.toDataURL('image/png')`.
      // OffscreenCanvas doesn't have toDataURL (only convertToBlob, which is async).
      // In our pointer-lock setup the cursor data URL is stored but never rendered
      // as a CSS cursor (no DOM cursor in the worker), so an empty data URL works.
      try { c.toDataURL = () => 'data:image/png;base64,'; } catch (_) {}
      return c;
    }
    // Anything else — inert stub.
    return { tagName: t.toUpperCase(), style: {}, addEventListener(){}, removeEventListener(){}, appendChild(){} };
  },
  // Pointer-lock surface. We mutate `pointerLockElement` from main-side input
  // forwarding when the canvas enters / exits pointer lock on the real DOM.
  pointerLockElement: null,
  // Visibility / focus. Engine pauses gametics on visibilitychange.
  visibilityState: 'visible',
  hidden: false,
  hasFocus() { return true; },
  // body — emscripten uses `document.body?.requestPointerLock` as a *feature
  // probe* to decide whether to register a pointerlockchange callback. If
  // it's falsy, the callback is never registered and the engine never learns
  // the pointer locked → SDL2 keeps mouse in absolute (cursor) mode and view
  // rotation never happens. Provide the same surface a real HTMLBodyElement
  // has so the probe passes.
  body: {
    appendChild() {}, removeChild() {}, style: {},
    requestPointerLock() {},
    requestFullscreen() { return Promise.reject(new Error('blocked')); },
    addEventListener() {}, removeEventListener() {},
  },
  documentElement: {
    style: {}, clientWidth: 320, clientHeight: 200,
    requestPointerLock() {},
    requestFullscreen() { return Promise.reject(new Error('blocked')); },
  },
  // SDL leaving relative mouse mode (menu / console up) calls this.
  exitPointerLock() { postCapture(false); },
});

const windowShim = Object.assign(winTarget, {
  id: '',
  nodeName: '#window',
  // emscripten's openal bridge does `var AudioContext = window.AudioContext || window.webkitAudioContext`
  // and the `_alcOpenDevice` check uses globalThis. Leave both undefined so the
  // null-device fallback kicks in (audio is silent — by design for MVP).
  AudioContext: undefined,
  webkitAudioContext: undefined,
  innerWidth: 320,
  innerHeight: 200,
  devicePixelRatio: 1,
  document: documentShim,
  // Some emscripten helpers reach for `performance` and `console` via window —
  // workers have both globally, but the lookup chain `window.performance` would
  // be undefined without forwarding.
  performance,
  console,
  navigator: self.navigator,
  location: { href: '/', search: '', protocol: 'https:' },
  // The single-threaded harness wrapped requestAnimationFrame. In a worker,
  // rAF doesn't exist by default. Provide a Promise-resolved-microtask fallback
  // so anything that calls rAF gets serviced — but it won't be vsync-paced.
  // The engine doesn't use rAF under asyncify/JSPI; this is just a safety net.
  requestAnimationFrame(cb) {
    const id = ++rafCounter;
    Promise.resolve().then(() => cb(performance.now()));
    return id;
  },
  cancelAnimationFrame() {},
});

// emscripten defers pointer-lock / fullscreen requests made outside an input
// handler unless navigator.userActivation says the page is active. Workers
// have no userActivation, so SDL's relative-mouse request (entering gameplay)
// would wait for the next key press; report the page as active instead.
try {
  Object.defineProperty(self.navigator, 'userActivation', {
    configurable: true, value: { isActive: true, hasBeenActive: true } });
} catch (_) {}

// Install on globalThis so unqualified `document.X` and `window.X` work.
// NOTE: `self.location` is read-only in a worker (WorkerLocation), so don't
// reassign it — emscripten reads location.href via the native one, which has
// the same shape. windowShim.location stays for window.location.X chains.
self.window = windowShim;
self.document = documentShim;

// ---------------------------------------------------------------------------
// AUDIO SHIM
//
// Emscripten's OpenAL bridge (library_openal.js, baked into gzdoom.js) needs
// a working `AudioContext` constructor in worker scope or `alcOpenDevice`
// returns NULL and the engine falls back to nosound. AudioContext isn't
// available in DedicatedWorkerGlobalScope (main thread only per spec), so we
// shim it.
//
// Strategy: capture audio data at `source.start()` (the moment openal hands a
// filled AudioBuffer to Web Audio for playback) and post the int16-equivalent
// PCM to main, where a real AudioContext replays via a real BufferSourceNode
// chain. Main is the thing actually wired to speakers; worker just produces
// data.
//
// What this misses (acceptable trade for MVP audio):
// - 3D positional audio (panner nodes are stubbed; everything plays stereo)
// - Doppler / cone gain (skipped)
// - Param automation (setValueAtTime curves applied at value-set time only)
// - playbackRate scrubbing during playback (snapshot at start)
//
// What this gets right:
// - Music (long-running buffered stream from ZMusic ADL OPL3 synth)
// - SFX (one-shot buffer playback)
// - Gain control (master gain + per-source gain)
// - Looping (passes loop/loopStart/loopEnd through)
// - Timing alignment (start(when) honored via AudioContext-time arithmetic)
let _audioId = 1;
const _audioCtxStartWall = performance.now() / 1000;

class _FakeAudioParam {
  constructor(initial) { this.value = initial; }
  setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; }
  setValueCurveAtTime() { return this; }
  cancelScheduledValues() { return this; }
  cancelAndHoldAtTime() { return this; }
}

class _FakeAudioBuffer {
  constructor(channels, frames, sampleRate) {
    this._id = _audioId++;
    this.numberOfChannels = channels;
    this.length = frames;
    this.sampleRate = sampleRate;
    this.duration = frames / sampleRate;
    this._channels = [];
    for (let c = 0; c < channels; c++) this._channels.push(new Float32Array(frames));
    // openal sets these as custom props for loop point handling
    this._loopStart = 0;
    this._loopEnd = 0;
  }
  getChannelData(c) { return this._channels[c]; }
  copyToChannel(src, channel, offset) {
    this._channels[channel].set(src, offset || 0);
  }
  copyFromChannel(dst, channel, offset) {
    const c = this._channels[channel];
    for (let i = 0; i < dst.length; i++) dst[i] = c[(offset || 0) + i] || 0;
  }
}

class _FakeGainNode {
  constructor() {
    this._id = _audioId++;
    this.gain = new _FakeAudioParam(1);
    this._connectedTo = null;
  }
  connect(target) {
    this._connectedTo = target;
    self.postMessage({ audio: 'connect', src: this._id, dst: target ? target._id : -1, dstKind: target && target._kind });
    return target;
  }
  disconnect() {
    self.postMessage({ audio: 'disconnect', src: this._id });
    this._connectedTo = null;
  }
}

class _FakePannerNode {
  constructor() {
    this._id = _audioId++;
    this._connectedTo = null;
    this.positionX = new _FakeAudioParam(0);
    this.positionY = new _FakeAudioParam(0);
    this.positionZ = new _FakeAudioParam(0);
    this.orientationX = new _FakeAudioParam(1);
    this.orientationY = new _FakeAudioParam(0);
    this.orientationZ = new _FakeAudioParam(0);
    this.panningModel = 'HRTF';
    this.distanceModel = 'inverse';
    this.refDistance = 1; this.maxDistance = 10000; this.rolloffFactor = 1;
    this.coneInnerAngle = 360; this.coneOuterAngle = 360; this.coneOuterGain = 0;
  }
  setPosition() {} setOrientation() {} setVelocity() {}
  connect(target) { this._connectedTo = target; return target; }
  disconnect() { this._connectedTo = null; }
}

class _FakeBufferSource {
  constructor() {
    this._id = _audioId++;
    this._buffer = null;
    this._connectedTo = null;
    this.playbackRate = new _FakeAudioParam(1);
    this.detune = new _FakeAudioParam(0);
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this._duration = 0;
    this._startOffset = 0;
    this._skipCount = 0;
    this._started = false;
    this._stopped = false;
    this.onended = null;
  }
  get buffer() { return this._buffer; }
  set buffer(b) { this._buffer = b; }
  connect(target) {
    this._connectedTo = target;
    return target;
  }
  disconnect() { this._connectedTo = null; }
  start(when, offset, duration) {
    if (this._started) return;
    this._started = true;
    const buf = this._buffer;
    if (!buf) return;
    // Pack channels for transfer. We slice to detach our local copy (so engine
    // can reuse the buffer for the next playback without our pending message
    // seeing stale data).
    const ch0 = new Float32Array(buf._channels[0]);
    const ch1 = buf._channels[1] ? new Float32Array(buf._channels[1]) : null;
    // Resolve gain by walking the connect chain — typical openal pattern is
    // BufferSource -> GainNode -> destination (or BufferSource -> Panner -> GainNode -> destination).
    let gain = 1;
    let node = this._connectedTo;
    while (node) {
      if (node.gain && typeof node.gain.value === 'number') gain *= node.gain.value;
      node = node._connectedTo;
    }
    self.postMessage({
      audio: 'play',
      sourceId: this._id,
      sampleRate: buf.sampleRate,
      channels: buf.numberOfChannels,
      ch0, ch1,
      when: when || 0,
      now: performance.now() / 1000 - _audioCtxStartWall,   // = ctx.currentTime
      offset: offset || 0,
      duration: duration === undefined ? -1 : duration,
      loop: !!this.loop,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      playbackRate: this.playbackRate.value,
      gain,
    }, ch1 ? [ch0.buffer, ch1.buffer] : [ch0.buffer]);
  }
  stop(when) {
    if (this._stopped) return;
    this._stopped = true;
    self.postMessage({ audio: 'stop', sourceId: this._id, when: when || 0 });
  }
  addEventListener() {} removeEventListener() {}
}

class _FakeAudioListener {
  constructor() {
    this.positionX = new _FakeAudioParam(0);
    this.positionY = new _FakeAudioParam(0);
    this.positionZ = new _FakeAudioParam(0);
    this.forwardX = new _FakeAudioParam(0);
    this.forwardY = new _FakeAudioParam(0);
    this.forwardZ = new _FakeAudioParam(-1);
    this.upX = new _FakeAudioParam(0);
    this.upY = new _FakeAudioParam(1);
    this.upZ = new _FakeAudioParam(0);
  }
  setPosition() {} setOrientation() {} setVelocity() {}
}

class _FakeAudioContext {
  constructor(opts) {
    this._id = _audioId++;
    this.sampleRate = (opts && opts.sampleRate) || 44100;
    this.state = 'running';
    this.destination = { _id: -1, _kind: 'destination', connect() {}, disconnect() {} };
    this.listener = new _FakeAudioListener();
    self.postMessage({ audio: 'ctx-new', id: this._id, sampleRate: this.sampleRate });
  }
  get currentTime() {
    return performance.now() / 1000 - _audioCtxStartWall;
  }
  createBuffer(channels, frames, sampleRate) { return new _FakeAudioBuffer(channels, frames, sampleRate); }
  createBufferSource() { return new _FakeBufferSource(); }
  createGain() { return new _FakeGainNode(); }
  createPanner() { return new _FakePannerNode(); }
  createStereoPanner() { return new _FakeGainNode(); /* close enough */ }
  createDelay() { return new _FakeGainNode(); }
  createBiquadFilter() { return new _FakeGainNode(); }
  createDynamicsCompressor() { return new _FakeGainNode(); }
  createAnalyser() { return new _FakeGainNode(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  addEventListener() {} removeEventListener() {}
  decodeAudioData(arrayBuf, success, fail) {
    // Best-effort stub — engine doesn't typically call this for music/SFX
    // (which come through openal buffer queue, not Web Audio decode).
    const reject = new Error('decodeAudioData stub — no decoder in worker');
    if (typeof fail === 'function') fail(reject);
    return Promise.reject(reject);
  }
}

self.AudioContext = _FakeAudioContext;
self.webkitAudioContext = _FakeAudioContext;
windowShim.AudioContext = _FakeAudioContext;
windowShim.webkitAudioContext = _FakeAudioContext;

// `screen` is a window-only global. emscripten_get_screen_size reads
// `screen.width` and `screen.height` during I_InitGraphics. Provide our own
// — the engine just needs SOMETHING here, the value is mostly used to clamp
// "fullscreen" video modes which we never enter.
self.screen = self.screen || {
  width: 1920, height: 1080,
  availWidth: 1920, availHeight: 1080,
  colorDepth: 24, pixelDepth: 24,
};
windowShim.screen = self.screen;

// `localStorage` is not available in DedicatedWorker. emscripten's
// SDL_GetPrefPath may probe for it. Provide an in-memory stub so nothing
// throws (savegames persist through IndexedDB, section 4).
const _lsStore = new Map();
self.localStorage = self.localStorage || {
  getItem(k) { return _lsStore.has(k) ? _lsStore.get(k) : null; },
  setItem(k, v) { _lsStore.set(String(k), String(v)); },
  removeItem(k) { _lsStore.delete(k); },
  clear() { _lsStore.clear(); },
  key(i) { return [..._lsStore.keys()][i] || null; },
  get length() { return _lsStore.size; },
};
windowShim.localStorage = self.localStorage;
// matchMedia is sometimes consulted for `prefers-color-scheme` etc. — never
// matches in our shim.
windowShim.matchMedia = (q) => ({ matches: false, media: q, addEventListener(){}, removeEventListener(){} });

let rafCounter = 0;

// Engine mouse-capture state, reported to the page on change.
let _captured = null;
function postCapture(on) {
  if (_captured === on) return;
  _captured = on;
  self.postMessage({ type: 'capture', on });
}

// ---------------------------------------------------------------------------
// 2. CANVAS WRAP
//
// OffscreenCanvas IS an EventTarget and supports getContext('webgl2'), but
// it's missing DOM-only properties the SDL2 port touches: `style`,
// `clientWidth`, `clientHeight`, `getBoundingClientRect`, `focus()`,
// `requestPointerLock()`, etc. We monkey-patch them onto the instance.
//
// We do NOT proxy the OffscreenCanvas — emscripten's `instanceof` checks and
// canvas-identity lookups (`Module.canvas === <result of registration>`) rely
// on real-identity, and proxies break those.
// ---------------------------------------------------------------------------

// Backbuffer pin: defaults to 320x200 (Doom's true native res). Configurable
// via boot message {pinW, pinH} so the smoke harness can sweep canvas sizes
// for perf testing. SBARINFO + menu coords were authored against 320x200;
// larger backbuffers render the world correctly but UI elements stay at
// their authored size unless uiscale/st_scale cvars are bumped.
let PIN_W = 320, PIN_H = 200;

function instrumentCanvasAddListener(canvas) {
  const origAdd = canvas.addEventListener.bind(canvas);
  canvas.addEventListener = function (type, fn, opts) {
    _attachLog.push({ on: 'canvas', type, capture: !!(opts && opts.capture || opts === true) });
    return origAdd(type, fn, opts);
  };
}

function augmentOffscreenCanvas(canvas) {
  const styleStub = new Proxy({}, {
    get(t, prop) { return t[prop] !== undefined ? t[prop] : ''; },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  // OffscreenCanvas in Chrome is fairly permissive about adding own properties.
  // Where direct assignment fails, fall back to defineProperty with configurable.
  function pin(name, getter, setter) {
    try {
      Object.defineProperty(canvas, name, {
        configurable: true,
        get: getter,
        set: setter || (() => {}),
      });
    } catch (_) {
      // best effort — if defineProperty refuses, the engine usually still works
    }
  }
  // Force backbuffer to the pinned size, then trap further writes.
  try { canvas.width = PIN_W; canvas.height = PIN_H; } catch (_) {}
  let _w = PIN_W, _h = PIN_H;
  const origDescW = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(canvas), 'width');
  const origDescH = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(canvas), 'height');
  if (origDescW && origDescH && origDescW.set && origDescH.set) {
    pin('width',
      () => origDescW.get.call(canvas),
      (v) => {
        if (v !== PIN_W) self.postMessage({ type: 'log', stream: 'stderr',
          msg: '[worker] canvas-pin: clamping width=' + v + ' -> ' + PIN_W });
        origDescW.set.call(canvas, PIN_W);
      });
    pin('height',
      () => origDescH.get.call(canvas),
      (v) => {
        if (v !== PIN_H) self.postMessage({ type: 'log', stream: 'stderr',
          msg: '[worker] canvas-pin: clamping height=' + v + ' -> ' + PIN_H });
        origDescH.set.call(canvas, PIN_H);
      });
  }
  try { canvas.style = styleStub; } catch (_) { pin('style', () => styleStub); }
  pin('clientWidth',  () => canvas.width);
  pin('clientHeight', () => canvas.height);
  pin('offsetWidth',  () => canvas.width);
  pin('offsetHeight', () => canvas.height);
  pin('scrollWidth',  () => canvas.width);
  pin('scrollHeight', () => canvas.height);
  pin('clientTop',    () => 0);
  pin('clientLeft',   () => 0);
  pin('offsetTop',    () => 0);
  pin('offsetLeft',   () => 0);
  pin('parentNode',   () => documentShim.body);
  pin('ownerDocument',() => documentShim);
  canvas.getBoundingClientRect = function () {
    return { x: 0, y: 0, left: 0, top: 0, right: canvas.width, bottom: canvas.height,
             width: canvas.width, height: canvas.height };
  };
  // Focus / pointer-lock are real-DOM-only — these noops just keep emscripten
  // happy. Real pointer-lock happens on the main-side canvas; we just route
  // mouse-delta events from main and rely on the engine's `m_use_mouse=1` path.
  canvas.focus = function () {};
  canvas.blur = function () {};
  // SDL entering relative mouse mode (gameplay) lands here.
  canvas.requestPointerLock = function () { postCapture(true); };
  canvas.requestFullscreen = function () { return Promise.reject(new Error('blocked')); };
  // tagName for `instanceof`-fallback checks in libraries that read it.
  if (!('tagName' in canvas)) {
    pin('tagName', () => 'CANVAS');
    pin('nodeName', () => 'CANVAS');
  }
}

// ---------------------------------------------------------------------------
// 3. FRAME COUNTER
//
// A frame ends when the engine binds the default framebuffer (the canvas)
// after drawing into its scene framebuffers. Frame intervals are posted to the
// page twice a second (FPS / frame time readout, ?dev=1 and the smoke test).
// ---------------------------------------------------------------------------

const fg = { last: 0, n: 0, sum: 0, max: 0, total: 0, wasOffscreen: false };

function installGLHook(canvas) {
  const orig = canvas.getContext.bind(canvas);
  canvas.getContext = function (type, attrs) {
    const ctx = orig(type, attrs);
    if (ctx && (type === 'webgl2' || type === 'webgl')) {
      const bind = ctx.bindFramebuffer.bind(ctx);
      const FB = ctx.FRAMEBUFFER;
      ctx.bindFramebuffer = function (target, fb) {
        const isDefault = !fb;
        if (isDefault && fg.wasOffscreen && target === FB) {
          const now = performance.now();
          if (fg.last) {
            const dt = now - fg.last;
            if (dt < 1000) { fg.n++; fg.sum += dt; if (dt > fg.max) fg.max = dt; }
          }
          fg.last = now;
          fg.total++;
        }
        fg.wasOffscreen = !isDefault;
        return bind(target, fb);
      };
    }
    return ctx;
  };
}

function startTelemetry() {
  setInterval(() => {
    self.postMessage({ type: 'frame-stats', frames: fg.n, meanMs: fg.n ? fg.sum / fg.n : 0,
                       maxMs: fg.max, total: fg.total });
    fg.n = 0; fg.sum = 0; fg.max = 0;
  }, 500);
}

// ---------------------------------------------------------------------------
// 4. SAVEGAME PERSISTENCE (IndexedDB)
//
// The engine writes saves (and nothing else we keep) under SAVE_ROOT in MEMFS.
// Before main() runs they are restored from IndexedDB; afterwards the tree is
// scanned every few seconds (and on 'flush', sent when the page is hidden) and
// changed or deleted files are mirrored to IndexedDB. The scan runs between
// engine frames (the wasm is suspended in emscripten_sleep), so files are
// never half-written.
// ---------------------------------------------------------------------------

const SAVE_ROOT = '/home/web_user/.config/gzdoom';
const SAVE_MATCH = /\/savegames?\/|\.zds$/i;   // only savegames, not the ini or caches
const DB_NAME = 'cca-gzdoom', DB_STORE = 'files';
let _db = null;
const _persisted = new Map();   // path -> "mtime:size" last written to IndexedDB

function openDB() {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function dbAll(db) {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const out = [];
    const tx = db.transaction(DB_STORE, 'readonly');
    const cur = tx.objectStore(DB_STORE).openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out);
    };
    cur.onerror = () => resolve(out);
  });
}

function walkFiles(FS, dir, out) {
  let names;
  try { names = FS.readdir(dir); } catch (_) { return out; }
  for (const n of names) {
    if (n === '.' || n === '..') continue;
    const p = dir + '/' + n;
    let st;
    try { st = FS.stat(p); } catch (_) { continue; }
    if (FS.isDir(st.mode)) walkFiles(FS, p, out);
    else if (SAVE_MATCH.test(p)) out.set(p, st);
  }
  return out;
}

function stamp(st) { return (+st.mtime) + ':' + st.size; }

function syncSaves() {
  const FS = self.Module && self.Module.FS;
  if (!_db || !FS) return;
  const now = walkFiles(FS, SAVE_ROOT, new Map());
  const puts = [], dels = [];
  for (const [p, st] of now) if (_persisted.get(p) !== stamp(st)) puts.push([p, st]);
  for (const p of _persisted.keys()) if (!now.has(p)) dels.push(p);
  if (!puts.length && !dels.length) return;
  try {
    const tx = _db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    for (const [p, st] of puts) {
      store.put({ data: FS.readFile(p), mtime: +st.mtime }, p);
      _persisted.set(p, stamp(st));
    }
    for (const p of dels) { store.delete(p); _persisted.delete(p); }
    tx.oncomplete = () => self.postMessage({ type: 'saves', stored: puts.map((x) => x[0]), deleted: dels });
  } catch (e) {
    self.postMessage({ type: 'log', stream: 'stderr', msg: '[worker] save sync failed: ' + (e && e.message) });
  }
}

function restoreSaves(FS, entries) {
  let n = 0;
  for (const [p, v] of entries) {
    if (!v || !v.data || !SAVE_MATCH.test(p)) continue;
    try {
      FS.mkdirTree(p.slice(0, p.lastIndexOf('/')));
      FS.writeFile(p, v.data);
      if (v.mtime) FS.utime(p, v.mtime, v.mtime);
      _persisted.set(p, stamp(FS.stat(p)));
      n++;
    } catch (e) {
      self.postMessage({ type: 'log', stream: 'stderr', msg: '[worker] restore ' + p + ' failed: ' + (e && e.message) });
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// 5. MESSAGE PROTOCOL
//
// From main:
//   { type: 'boot', canvas, pinW, pinH, args, files: {path: Uint8Array},
//     engineBase, scriptUrl, wasm: ArrayBuffer }
//   { type: 'input', target, evType, init }
//   { type: 'pointerlock', locked }   { type: 'visibility', state }   { type: 'flush' }
//
// To main:
//   { type: 'ready' }  { type: 'log', stream, msg }  { type: 'abort', reason }
//   { type: 'error', message, stack }  { type: 'frame-stats', ... }
//   { type: 'capture', on }  { type: 'saves', stored, deleted, restored }
//   { audio: ... }  (see the AudioContext shim)
// ---------------------------------------------------------------------------

let booted = false;

self.onerror = (e) => {
  self.postMessage({ type: 'error', message: String(e && e.message || e), stack: e && e.error && e.error.stack });
};
self.onunhandledrejection = (e) => {
  self.postMessage({ type: 'error', message: 'unhandledrejection: ' + (e && e.reason && (e.reason.message || e.reason)), stack: e && e.reason && e.reason.stack });
};

self.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case 'boot':        return handleBoot(m);
    case 'input':       return handleInput(m);
    case 'pointerlock': return handlePointerLock(m);
    case 'visibility':  return handleVisibility(m);
    case 'flush':       return syncSaves();
  }
};

// Engine output: drop debug traces and terminal control sequences.
const NOISE = /^\s*$|\[trace\]|\[creg-walk\]|^\[worker\] canvas-pin|emscripten_set_main_loop_timing/;
function cleanLine(t) {
  return String(t)
    .replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b[78]/g, '')
    .replace(/\[[.=]{20,}\]\s*/g, '');
}
function out(stream) {
  return (...a) => {
    const msg = cleanLine(a.join(' '));
    if (NOISE.test(msg)) return;
    self.postMessage({ type: 'log', stream, msg });
  };
}

async function handleBoot(m) {
  if (booted) return;
  booted = true;

  if (m.pinW && m.pinH) { PIN_W = m.pinW | 0; PIN_H = m.pinH | 0; }
  windowShim.innerWidth = PIN_W;
  windowShim.innerHeight = PIN_H;
  documentShim.documentElement.clientWidth = PIN_W;
  documentShim.documentElement.clientHeight = PIN_H;

  const canvas = m.canvas;
  instrumentCanvasAddListener(canvas);   // must wrap BEFORE the engine attaches
  augmentOffscreenCanvas(canvas);
  installGLHook(canvas);
  self.__moduleCanvas = canvas;
  // emscripten's EMSCRIPTEN_EVENT_TARGET_DOCUMENT / _WINDOW / _SCREEN = 1 / 2 / 3.
  self.specialHTMLTargets = [0, documentShim, windowShim, self.screen];

  _db = await openDB();
  const saved = await dbAll(_db);
  const base = m.engineBase || '';

  self.Module = {
    canvas,
    arguments: m.args || [],
    noInitialRun: false,
    wasmBinary: m.wasm || undefined,
    preRun: [() => {
      const FS = self.Module.FS;
      for (const [path, bytes] of Object.entries(m.files || {})) FS.writeFile(path, bytes);
      FS.chdir('/');
      const restored = restoreSaves(FS, saved);
      self.postMessage({ type: 'saves', stored: [], deleted: [], restored });
    }],
    onRuntimeInitialized() {
      self.postMessage({ type: 'ready' });
      startTelemetry();
      setInterval(syncSaves, 3000);
      // No native focus in a worker: tell SDL its window is focused, or it
      // filters input events.
      setTimeout(() => {
        windowShim.dispatchEvent(makeEvent('focus', {}));
        documentShim.dispatchEvent(makeEvent('focus', {}));
      }, 0);
    },
    print: out('stdout'),
    printErr: out('stderr'),
    onAbort(reason) { self.postMessage({ type: 'abort', reason: String(reason) }); },
    setStatus() {},
    locateFile(f) { return base + f; },
  };

  try {
    importScripts(m.scriptUrl || (base + 'gzdoom.js'));
  } catch (err) {
    self.postMessage({ type: 'error', message: 'loading gzdoom.js failed: ' + (err && err.message), stack: err && err.stack });
  }
}

// --- Input dispatch -------------------------------------------------------
//
// Main forwards events as plain objects. We synthesize real event instances
// (MouseEvent / KeyboardEvent / WheelEvent are available in DedicatedWorker
// scope in modern browsers) and dispatch them on the correct target. If a
// constructor is unavailable, fall back to a plain object with the same shape
// — emscripten's SDL2 reads properties off the event, not its prototype.

function makeEvent(evType, init) {
  // For Mouse/Wheel events we deliberately use a plain `Event` (not
  // MouseEvent/WheelEvent), then attach properties as own-properties. Reason:
  // `MouseEvent`/`WheelEvent` define `clientX/Y`, `movementX/Y`, `deltaX/Y`,
  // `button`, `buttons` as accessor properties on the prototype, sourced from
  // the C++ event's internal slots. The init-dict path that should populate
  // those slots from constructor options is unreliable in Chrome's worker
  // realm — `new MouseEvent('mousemove', {movementX: 5}).movementX` returns 0.
  // Plain own-properties resolve before prototype lookup, so emscripten's
  // `e.movementX` reads our value as intended.
  if (evType === 'keydown' || evType === 'keyup' || evType === 'keypress') {
    try { return new KeyboardEvent(evType, init); } catch (_) {}
  }
  // Plain Event + own-property assignment for everything else.
  const base = (typeof Event !== 'undefined') ? new Event(evType, { bubbles: true, cancelable: true }) : null;
  const evt = base || { type: evType };
  for (const k in init) {
    try {
      Object.defineProperty(evt, k, { value: init[k], writable: true, configurable: true, enumerable: true });
    } catch (_) {
      try { evt[k] = init[k]; } catch (__) {}
    }
  }
  return evt;
}

function handleInput(m) {
  const evt = makeEvent(m.evType, m.init || {});
  // Always provide preventDefault / stopPropagation no-ops in case the real
  // event lacks them (plain-object fallback path).
  if (typeof evt.preventDefault !== 'function') evt.preventDefault = () => { evt.defaultPrevented = true; };
  if (typeof evt.stopPropagation !== 'function') evt.stopPropagation = () => {};
  if (typeof evt.stopImmediatePropagation !== 'function') evt.stopImmediatePropagation = () => {};

  // Route precisely based on where SDL2 actually attaches each event type
  // (confirmed via the attach-log diagnostic). Wrong target = listener never
  // fires; previously we fanned out to all three to avoid guessing, but that
  // tripled per-event dispatch cost.
  //
  //   canvas: mousedown/mousemove/mouseenter/mouseleave/wheel/touch*
  //   document: mouseup/pointerlockchange/visibilitychange
  //   window: keydown/keyup/keypress/focus/blur/resize
  switch (m.evType) {
    case 'mousedown': case 'mousemove': case 'mouseenter': case 'mouseleave':
    case 'wheel': case 'mousewheel': case 'click': case 'contextmenu':
    case 'touchstart': case 'touchmove': case 'touchend': case 'touchcancel':
      return self.__moduleCanvas ? self.__moduleCanvas.dispatchEvent(evt) : null;
    case 'mouseup':
      return documentShim.dispatchEvent(evt);
    case 'keydown': case 'keyup': case 'keypress':
    case 'focus': case 'blur':
      return windowShim.dispatchEvent(evt);
    default:
      // Fall back to the caller's requested target for anything not classified.
      switch (m.target) {
        case 'window':   return windowShim.dispatchEvent(evt);
        case 'document': return documentShim.dispatchEvent(evt);
        case 'canvas':
        default:
          return self.__moduleCanvas ? self.__moduleCanvas.dispatchEvent(evt) : null;
      }
  }
}

function handlePointerLock(m) {
  documentShim.pointerLockElement = m.locked ? self.__moduleCanvas : null;
  documentShim.dispatchEvent(makeEvent('pointerlockchange', {}));
}

function handleVisibility(m) {
  documentShim.visibilityState = m.state;
  documentShim.hidden = (m.state === 'hidden');
  documentShim.dispatchEvent(makeEvent('visibilitychange', {}));
}

self.postMessage({ type: 'log', stream: 'stdout', msg: '[worker] waiting for boot' });
