// COSMIC CALAMITY: ASSAULT in the browser: main-thread harness.
//
// Downloads the engine (GZDoom 4.11.3 WebAssembly, web/engine/ in the repo),
// freedoom2.wad and the mod pk3 with a progress bar, then boots GZDoom in a
// Web Worker (engine.worker.js) on an OffscreenCanvas. This thread owns the
// page: input forwarding (keyboard, mouse, gamepad via gamepad.js), pointer
// lock and fullscreen, and audio playback (the worker's AudioContext shim
// posts PCM here). Input forwarding and audio replay follow tomb-engine's
// demo/index.html (GPLv3).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const DEV = params.has('dev');
  const canvas = $('canvas');
  const stage = $('stage');

  // Test / debug hook (read by tools/web-smoke.mjs).
  const S = window.__cca = {
    phase: 'init', captured: false, locked: false, workerLocked: false, pad: null, padMode: 'game',
    fps: 0, frameMs: 0, frameMax: 0, frames: 0, log: [], saves: { restored: 0, stored: [] },
    audio: 0, errors: [],
  };
  const log = (msg, cls) => {
    S.log.push(msg);
    if (S.log.length > 2000) S.log.splice(0, 500);
    if (DEV) {
      const el = $('log');
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = msg;
      el.appendChild(line);
      while (el.childElementCount > 400) el.removeChild(el.firstChild);
      el.scrollTop = el.scrollHeight;
    }
    if (cls === 'err') console.warn(msg); else if (DEV) console.log(msg);
  };
  if (DEV) document.body.classList.add('dev');

  const show = (id) => {
    for (const el of stage.querySelectorAll('.overlay')) el.hidden = el.id !== id;
  };
  const MB = (n) => (n / 1048576).toFixed(1);

  // ------------------------------------------------------------------ support
  function missingFeatures() {
    const miss = [];
    const jspi = typeof WebAssembly === 'object' && typeof WebAssembly.Suspending === 'function' &&
      typeof WebAssembly.promising === 'function';
    if (!jspi) miss.push('WebAssembly JSPI');
    let gl2 = false;
    try { gl2 = !!document.createElement('canvas').getContext('webgl2'); } catch (_) {}
    if (!gl2) miss.push('WebGL2');
    if (typeof OffscreenCanvas === 'undefined' || !HTMLCanvasElement.prototype.transferControlToOffscreen) miss.push('OffscreenCanvas');
    if (typeof Worker === 'undefined') miss.push('Web Workers');
    return miss;
  }

  // ------------------------------------------------------------------ download
  let manifest = null;
  const files = {};   // url -> Uint8Array

  async function fetchWithProgress(f, onBytes) {
    const res = await fetch(f.url + (f.url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(manifest.version));
    if (!res.ok) throw new Error(f.url + ': HTTP ' + res.status);
    // f.size is the real file size; Content-Length may be the compressed size.
    let buf = new Uint8Array(f.size || 1 << 20), n = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (n + value.length > buf.length) {
        const bigger = new Uint8Array(Math.max(buf.length * 2, n + value.length));
        bigger.set(buf.subarray(0, n));
        buf = bigger;
      }
      buf.set(value, n);
      n += value.length;
      onBytes(value.length);
    }
    return n === buf.length ? buf : buf.slice(0, n);
  }

  async function download() {
    S.phase = 'download';
    show('loading');
    const r = await fetch('manifest.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('manifest.json: HTTP ' + r.status);
    manifest = await r.json();
    const total = manifest.files.reduce((s, f) => s + f.size, 0);
    let got = 0;
    const bar = $('bar'), txt = $('progress-text');
    const paint = () => {
      const p = total ? Math.min(1, got / total) : 0;
      bar.style.width = (p * 100).toFixed(1) + '%';
      txt.textContent = `Downloading ${MB(got)} / ${MB(total)} MB`;
    };
    paint();
    const t0 = performance.now();
    await Promise.all(manifest.files.map(async (f) => {
      files[f.url] = await fetchWithProgress(f, (k) => { got += k; paint(); });
    }));
    log(`[page] downloaded ${MB(got)} MB in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    S.phase = 'ready';
    $('start-size').textContent = MB(total) + ' MB';
    show('start');
    $('play-btn').focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ boot
  let worker = null;
  let W = 1280, H = 720;

  function chosenResolution() {
    const v = params.get('res') || readPref('res') || '1280x720';
    const m = /^(\d+)x(\d+)$/.exec(v);
    return m ? [+m[1], +m[2]] : [1280, 720];
  }

  function boot() {
    if (worker) return;
    S.phase = 'booting';
    [W, H] = chosenResolution();
    show('booting');
    canvas.width = W;
    canvas.height = H;
    stage.style.setProperty('--aspect', `${W} / ${H}`);
    const offscreen = canvas.transferControlToOffscreen();

    const memfs = {};
    let script = null, wasm = null;
    for (const f of manifest.files) {
      if (f.role === 'script') script = files[f.url];
      else if (f.role === 'wasm') wasm = files[f.url];
      else memfs[f.path] = files[f.url];
    }
    const scriptUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
    const args = [
      '-iwad', manifest.iwad, '-file', manifest.pwad,
      '+vid_rendermode', '4',
      '+vid_preferbackend', '1',          // GLES backend: fastest on WebGL2 (tomb-engine)
      '+vid_fullscreen', '0',
      '+vid_defwidth', String(W), '+vid_defheight', String(H),
      '+win_w', String(W), '+win_h', String(H),
      '+vid_scalemode', '0', '+vid_vsync', '0',
      '+vid_maxfps', '120', '+cl_capfps', '0',
      '+set', 'snd_mididevice', '0',
      // The mod's keyboard + mouse binds (KEYCONF alias). Deferred a tic: the
      // command line runs before KEYCONF's aliases exist.
      '+wait 1; cca_kbmlayout',
      '+lockcvar', 'vid_rendermode', 'vid_preferbackend', 'vid_fullscreen',
      'vid_defwidth', 'vid_defheight', 'win_w', 'win_h', 'vid_scalemode', 'vid_vsync',
    ];
    worker = new Worker('engine.worker.js?v=' + encodeURIComponent(manifest.version));
    S.worker = worker;
    worker.onerror = (e) => fail('Engine worker error: ' + e.message);
    worker.onmessage = (e) => onWorker(e.data);
    const transfer = [offscreen, wasm.buffer, ...Object.values(memfs).map((u) => u.buffer)];
    worker.postMessage({
      type: 'boot', canvas: offscreen, pinW: W, pinH: H, args, files: memfs,
      engineBase: new URL(manifest.engineBase, location.href).href, scriptUrl, wasm: wasm.buffer,
    }, transfer);
    for (const k of Object.keys(files)) delete files[k];
    attachInput();
    startPadLoop();
    canvas.focus({ preventScroll: true });
  }

  function fail(msg) {
    S.errors.push(msg);
    log('[error] ' + msg, 'err');
    if (S.phase === 'running') {
      // Fatal only if the engine stopped drawing.
      const f0 = S.frames;
      setTimeout(() => { if (S.frames === f0 && S.phase === 'running') fatal(msg); }, 2500);
      return;
    }
    fatal(msg);
  }
  function fatal(msg) {
    S.phase = 'failed';
    $('error-text').textContent = msg;
    show('error');
    try { document.exitPointerLock(); } catch (_) {}
  }

  function onWorker(m) {
    if (m.audio) return onAudio(m);
    switch (m.type) {
      case 'ready':
        S.phase = 'running';
        show(null);
        log('[page] engine running');
        // The title screen and menus use the cursor: give back the lock taken
        // by the start click (a lock released by the page can be re-taken
        // without another click once gameplay starts).
        setTimeout(() => { if (!S.captured && isLocked()) { selfExit = true; document.exitPointerLock(); } }, 1500);
        break;
      case 'log':
        log(m.msg, m.stream === 'stderr' ? 'err' : '');
        if (/^Script error|Execution could not continue|^Could not find/.test(m.msg)) S.errors.push(m.msg);
        break;
      case 'abort':
        fail('The engine stopped: ' + m.reason);
        break;
      case 'error':
        // A C++ exception escaping main() surfaces as "trying to suspend JS frames".
        fail('The engine crashed: ' + m.message);
        break;
      case 'frame-stats':
        S.frames = m.total;
        if (m.frames) { S.frameMs = m.meanMs; S.fps = 1000 / m.meanMs; S.frameMax = m.maxMs; }
        if (DEV) $('fps').textContent = m.frames ? `${S.fps.toFixed(0)} fps · ${m.meanMs.toFixed(1)} ms (max ${m.maxMs.toFixed(0)})` : '--';
        break;
      case 'capture':
        onCapture(m.on);
        break;
      case 'saves':
        if (m.restored) { S.saves.restored = m.restored; log(`[page] restored ${m.restored} savegame file(s)`); }
        if (m.stored.length || m.deleted.length) {
          S.saves.stored.push(...m.stored);
          log(`[page] saves synced: +${m.stored.length} -${m.deleted.length}`);
        }
        break;
    }
  }

  // ------------------------------------------------------------------ audio
  // The worker captures each OpenAL buffer at BufferSource.start() and posts
  // it here; a real AudioContext replays it (positional audio is flattened).
  let actx = null;
  const sources = new Map();
  let audioQueue = [];
  function ensureAudio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const q = audioQueue; audioQueue = [];
        for (const m of q) onAudio(m);
      } catch (e) { log('[audio] ' + e.message, 'err'); }
    }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  }
  function onAudio(m) {
    if (!actx) { if (m.audio === 'play' && audioQueue.length < 64) audioQueue.push(m); return; }
    if (m.audio === 'play') {
      S.audio++;
      const frames = m.ch0.length;
      if (!frames) return;
      const ch = m.ch1 && m.channels > 1 ? 2 : 1;
      const buf = actx.createBuffer(ch, frames, m.sampleRate);
      buf.copyToChannel(m.ch0, 0);
      if (ch > 1) buf.copyToChannel(m.ch1, 1);
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = m.playbackRate || 1;
      src.loop = !!m.loop;
      if (m.loopStart) src.loopStart = m.loopStart;
      if (m.loopEnd) src.loopEnd = m.loopEnd;
      const gain = actx.createGain();
      gain.gain.value = Number.isFinite(m.gain) ? m.gain : 1;
      src.connect(gain).connect(actx.destination);
      // `when` is on the worker's audio clock, `now` is that clock at posting:
      // keep the same lead on this context (OpenAL schedules streamed music
      // buffers back to back).
      const lead = (m.when || 0) - (m.now || 0);
      try { src.start(lead > 0 && lead < 2 ? actx.currentTime + lead : 0, m.offset || 0); }
      catch (_) { try { src.start(0); } catch (__) {} }
      sources.set(m.sourceId, src);
      src.onended = () => sources.delete(m.sourceId);
    } else if (m.audio === 'stop') {
      const src = sources.get(m.sourceId);
      if (src) { try { src.stop(0); } catch (_) {} sources.delete(m.sourceId); }
    }
  }

  // ------------------------------------------------------------------ pointer lock
  // The engine reports when it grabs the mouse (gameplay) or releases it
  // (menus, console). Pointer lock follows it, like the desktop game.
  let selfExit = false;        // we released the lock ourselves (menu opened)
  let lockChangedAt = 0;       // time of the last pointer-lock change (see fwdMouse)
  let lastEscDown = 0, lastSyntheticEsc = 0;

  const isLocked = () => document.pointerLockElement === canvas;
  const isFullscreen = () => document.fullscreenElement === stage;

  function lock(force) {
    if (isLocked() || (S.phase !== 'running' && !force)) return;
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => {
        // unadjustedMovement is unsupported on some platforms: retry without.
        try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (_) {}
      });
    } catch (_) {}
  }

  function syncWorkerLock() {
    // The engine reads mouse-look deltas only while it believes the pointer is
    // locked. A gamepad in play counts as locked so the right stick can look.
    const want = isLocked() || (S.captured && padIndex !== null);
    if (want !== S.workerLocked && worker) {
      S.workerLocked = want;
      worker.postMessage({ type: 'pointerlock', locked: want });
    }
    $('resume').hidden = !(S.phase === 'running' && S.captured && !isLocked() && padIndex === null);
  }

  function onCapture(on) {
    log('[page] engine ' + (on ? 'captured' : 'released') + ' the mouse');
    S.captured = on;
    S.padMode = on ? 'game' : 'menu';
    if (on) lock();
    else if (isLocked()) { selfExit = true; document.exitPointerLock(); }
    syncWorkerLock();
  }

  document.addEventListener('pointerlockchange', () => {
    lockChangedAt = performance.now();
    const locked = isLocked();
    S.locked = locked;
    if (!locked && !selfExit && S.captured && S.phase === 'running') {
      // The player pressed Esc (the browser kept the key to itself): open the
      // game menu, as Esc does in GZDoom.
      if (performance.now() - lastEscDown > 400) tapKey(PAD_KEYS.Escape, true);
    }
    selfExit = false;
    syncWorkerLock();
  });
  document.addEventListener('pointerlockerror', () => syncWorkerLock());

  async function goFullscreen() {
    if (isFullscreen() || !stage.requestFullscreen) return;
    try {
      await stage.requestFullscreen({ navigationUI: 'hide' });
      // Keep Esc for the game menu while fullscreen (hold Esc to leave).
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    } catch (_) {}
  }
  document.addEventListener('fullscreenchange', () => {
    if (!isFullscreen() && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
  });

  // ------------------------------------------------------------------ input
  const post = (msg) => { if (worker) worker.postMessage(msg); };
  // Browser keys we never take: devtools, browser fullscreen.
  const BROWSER_KEYS = new Set(['F11', 'F12']);
  const engaged = () => S.phase === 'running' &&
    (isLocked() || isFullscreen() || document.activeElement === canvas);

  function keyInit(e) {
    return {
      code: e.code, key: e.key, keyCode: e.keyCode, which: e.which || e.keyCode, charCode: e.charCode || 0,
      repeat: !!e.repeat, shiftKey: !!e.shiftKey, ctrlKey: !!e.ctrlKey, altKey: !!e.altKey,
      metaKey: !!e.metaKey, location: e.location || 0, bubbles: true, cancelable: true,
    };
  }
  let engineFocused = true;
  function setEngineFocus(on) {
    if (engineFocused === on) return;
    engineFocused = on;
    post({ type: 'input', target: 'window', evType: on ? 'focus' : 'blur', init: {} });
  }
  function onKey(e) {
    if (!engaged() || BROWSER_KEYS.has(e.code)) return;
    setEngineFocus(true);
    if (e.code === 'Escape' && e.type === 'keydown') {
      // Swallow a real Esc that follows our synthetic one (lock loss).
      if (performance.now() - lastSyntheticEsc < 400) { e.preventDefault(); return; }
      lastEscDown = performance.now();
    }
    post({ type: 'input', target: 'window', evType: e.type, init: keyInit(e) });
    // Text input (console, savegame names) comes from keypress, which the
    // browser drops once keydown is default-prevented: synthesize it.
    if (e.type === 'keydown' && e.key && [...e.key].length === 1 && !e.ctrlKey && !e.metaKey) {
      const init = keyInit(e);
      init.charCode = init.which = e.key.codePointAt(0);
      post({ type: 'input', target: 'window', evType: 'keypress', init });
    }
    e.preventDefault();
    e.stopPropagation();
  }

  function mouseInit(e, extra) {
    const r = canvas.getBoundingClientRect();
    // Client coordinates in backbuffer pixels (the worker's canvas rect).
    const sx = W / (r.width || W), sy = H / (r.height || H);
    return Object.assign({
      clientX: (e.clientX - r.left) * sx, clientY: (e.clientY - r.top) * sy,
      screenX: (e.clientX - r.left) * sx, screenY: (e.clientY - r.top) * sy,
      offsetX: (e.clientX - r.left) * sx, offsetY: (e.clientY - r.top) * sy,
      movementX: e.movementX || 0, movementY: e.movementY || 0,
      button: e.button || 0, buttons: e.buttons || 0,
      deltaX: e.deltaX || 0, deltaY: e.deltaY || 0, deltaZ: e.deltaZ || 0, deltaMode: e.deltaMode || 0,
      shiftKey: !!e.shiftKey, ctrlKey: !!e.ctrlKey, altKey: !!e.altKey, metaKey: !!e.metaKey,
      bubbles: true, cancelable: true,
    }, extra || {});
  }
  // Mouse-look deltas only while the pointer is locked, and never the spike
  // browsers report on the first move after a lock change (Chromium sends
  // one; it snapped the view to the ceiling when gameplay grabbed the mouse).
  const MAX_DELTA = 300;
  const fwdMouse = (evType) => (e) => {
    if (S.phase !== 'running') return;
    const init = mouseInit(e);
    if (evType === 'mousemove' && (!isLocked() || performance.now() - lockChangedAt < 120 ||
        Math.abs(init.movementX) > MAX_DELTA || Math.abs(init.movementY) > MAX_DELTA)) {
      init.movementX = 0; init.movementY = 0;
    }
    post({ type: 'input', target: evType === 'mouseup' ? 'document' : 'canvas', evType, init });
    if (evType === 'wheel' || evType === 'mousedown') e.preventDefault();
  };

  let inputAttached = false;
  function attachInput() {
    if (inputAttached) return;
    inputAttached = true;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    canvas.addEventListener('mousedown', (e) => {
      ensureAudio();
      setEngineFocus(true);
      if (S.captured && !isLocked()) lock();
      fwdMouse('mousedown')(e);
    });
    document.addEventListener('mouseup', fwdMouse('mouseup'));
    canvas.addEventListener('mousemove', fwdMouse('mousemove'));
    canvas.addEventListener('wheel', fwdMouse('wheel'), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('keydown', ensureAudio);
    $('resume').addEventListener('click', () => { ensureAudio(); lock(); canvas.focus(); });
    document.addEventListener('visibilitychange', () => {
      post({ type: 'visibility', state: document.visibilityState });
      if (document.visibilityState === 'hidden') { post({ type: 'flush' }); setEngineFocus(false); }
      else setEngineFocus(true);
    });
    window.addEventListener('pagehide', () => post({ type: 'flush' }));
    // SDL ignores the mouse for look while its window is unfocused, and page
    // blurs are frequent (fullscreen changes, clicking page controls): the
    // engine is told it lost focus only when the page is hidden.
    window.addEventListener('blur', () => { if (document.visibilityState === 'hidden') setEngineFocus(false); });
    window.addEventListener('focus', () => setEngineFocus(true));
  }

  // ------------------------------------------------------------------ gamepad
  // navigator.getGamepads() is main-thread only; poll it and forward the pad
  // as the keyboard / mouse events above (mapping in gamepad.js).
  const PAD_KEYS = {
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  };
  const padState = CCAPad.createState();
  let padIndex = null, padLast = 0, padLoop = false;
  const padOpts = () => ({ sensitivity: +(readPref('padSens') || 1), invertY: readPref('padInvert') === '1' });

  // Synthetic pointer events sit at the canvas centre (backbuffer pixels).
  function padMouse(extra) {
    return Object.assign({ clientX: W / 2, clientY: H / 2, screenX: W / 2, screenY: H / 2, offsetX: W / 2, offsetY: H / 2,
      movementX: 0, movementY: 0, button: 0, buttons: 0, deltaX: 0, deltaY: 0, deltaZ: 0, deltaMode: 0,
      shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, bubbles: true, cancelable: true }, extra);
  }
  function sendPadEvent(ev) {
    if (ev.type === 'keydown' || ev.type === 'keyup') {
      post({ type: 'input', target: 'window', evType: ev.type, init: {
        key: ev.key, code: ev.code, keyCode: ev.keyCode, which: ev.keyCode, charCode: 0, repeat: !!ev.repeat,
        shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, location: 0, bubbles: true, cancelable: true } });
    } else if (ev.type === 'mousedown' || ev.type === 'mouseup') {
      post({ type: 'input', target: ev.type === 'mouseup' ? 'document' : 'canvas', evType: ev.type,
        init: padMouse({ button: ev.button, buttons: ev.type === 'mousedown' ? (ev.button === 2 ? 2 : 1) : 0 }) });
    } else if (ev.type === 'wheel') {
      post({ type: 'input', target: 'canvas', evType: 'wheel', init: padMouse({ deltaY: ev.deltaY }) });
    } else if (ev.type === 'mousemove') {
      post({ type: 'input', target: 'canvas', evType: 'mousemove',
        init: padMouse({ movementX: ev.movementX, movementY: ev.movementY }) });
    }
  }
  // Generic input entry point (gamepad today; a touch-control overlay can
  // reuse it): window.CCAInput.send({type:'keydown'|'keyup', key, code, keyCode}),
  // ({type:'mousedown'|'mouseup', button}), ({type:'mousemove', movementX, movementY}),
  // ({type:'wheel', deltaY}). CCAInput.mode() is 'game' (mouse captured) or 'menu'.
  window.CCAInput = { send: sendPadEvent, mode: () => S.padMode };

  function tapKey(k, synthetic) {
    if (synthetic) lastSyntheticEsc = performance.now();
    for (const type of ['keydown', 'keyup']) sendPadEvent(Object.assign({ type, repeat: false }, k));
  }

  function pickPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let best = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (best === null || (p.mapping === 'standard' && best.mapping !== 'standard')) best = p;
    }
    return best;
  }

  function padTick(now) {
    const pad = pickPad();
    const idx = pad ? pad.index : null;
    if (idx !== padIndex) {
      padIndex = idx;
      S.pad = pad ? pad.id : null;
      $('pad-status').textContent = pad ? `Controller: ${pad.id.replace(/\s*\(.*$/, '') || 'connected'}` : '';
      if (pad) log('[page] gamepad: ' + pad.id + ' (' + (pad.mapping || 'no standard mapping') + ')');
      syncWorkerLock();
    }
    // No pad-button start: a gamepad press is not a user gesture (iOS), so
    // fullscreen / audio need the click or tap on the start button.
    if (S.phase === 'running') {
      const dt = padLast ? now - padLast : 16;
      const evs = CCAPad.step(padState, pad, padOpts(), S.padMode, dt, now);
      for (const ev of evs) sendPadEvent(ev);
      if (evs.length && pad) ensureAudio();
    }
    padLast = now;
    requestAnimationFrame(padTick);
  }
  function startPadLoop() {
    if (padLoop) return;
    padLoop = true;
    requestAnimationFrame(padTick);
  }
  window.addEventListener('gamepadconnected', () => startPadLoop());

  // ------------------------------------------------------------------ prefs
  function readPref(k) { try { return localStorage.getItem('cca.' + k); } catch (_) { return null; } }
  function writePref(k, v) { try { localStorage.setItem('cca.' + k, v); } catch (_) {} }

  // ------------------------------------------------------------------ start
  function start() {
    if (S.phase !== 'ready') return;
    ensureAudio();
    goFullscreen();
    lock(true);
    boot();
  }

  function init() {
    const res = $('res');
    res.value = readPref('res') || '1280x720';
    res.addEventListener('change', () => writePref('res', res.value));
    const sens = $('pad-sens');
    sens.value = readPref('padSens') || '1';
    sens.addEventListener('input', () => writePref('padSens', sens.value));
    const inv = $('pad-invert');
    inv.checked = readPref('padInvert') === '1';
    inv.addEventListener('change', () => writePref('padInvert', inv.checked ? '1' : '0'));
    $('play-btn').addEventListener('click', start);
    $('fs-btn').addEventListener('click', () => { goFullscreen(); if (S.captured) lock(); canvas.focus(); });
    $('reload-btn').addEventListener('click', () => location.reload());

    const miss = missingFeatures();
    if (miss.length && !params.has('force')) {
      S.phase = 'unsupported';
      $('missing').textContent = miss.join(', ');
      show('unsupported');
      return;
    }
    startPadLoop();
    download().catch((e) => fail('Download failed: ' + e.message));
  }

  init();
})();
