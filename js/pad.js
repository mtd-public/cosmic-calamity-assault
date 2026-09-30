// Gamepad support beyond the raw poll (input.js): FPS bindings for an Xbox
// controller (Halo 2 layout by default), button names per controller family,
// and D-pad / stick navigation of the HTML menus (A presses, B goes back).
// Adapted from mtd-public/dr-mow js/pad.js (MenuNav, padFamily, button names).
// Standard mapping indices: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Menu
// · 10/11 stick clicks · 12–15 d-pad up/down/left/right · 16 home.

export const PAD_ACTIONS = [
  ['fire', 'Fire'], ['grenade', 'Throw grenade'], ['jump', 'Jump'], ['melee', 'Melee'], ['action', 'Reload / hold: pick up, use'],
  ['swap', 'Switch weapon'], ['gswitch', 'Switch grenade type'], ['crouch', 'Crouch'], ['zoom', 'Zoom'], ['pause', 'Pause'], ['objective', 'Show objective'],
];
// Halo 2 on an Xbox Series pad: RT fire, LT grenade, A jump, B melee, X reload/action, Y swap,
// LB grenade type, RB reload/action too, L3 crouch, R3 zoom, Menu pause, View objective.
export const PAD_PRESETS = {
  classic: { fire: [7], grenade: [6], jump: [0], melee: [1], action: [2, 5], swap: [3], gswitch: [4], crouch: [10], zoom: [11], pause: [9], objective: [8] },
  // Halo 3 layout: RB reload / pick up, X free, everything else the same
  recon: { fire: [7], grenade: [6], jump: [0], melee: [1], action: [5], swap: [3], gswitch: [4], crouch: [10], zoom: [11], pause: [9], objective: [8] },
};

const NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L-stick', 'R-stick', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Xbox'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L-stick', 'R-stick', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'],
};
// Xbox Series X|S is the primary layout: its names are the default unless a PlayStation / Switch pad is seen.
export function padFamily(id = '') {
  if (/dualsense|dualshock|playstation|054c/i.test(id)) return 'ps';
  if (/pro controller|joy-con|nintendo|057e/i.test(id)) return 'nintendo';
  return 'xbox';
}
export const padFamilyName = (f) => ({ ps: 'PlayStation', nintendo: 'Switch', xbox: 'Xbox Series X|S' })[f];
export const buttonName = (i, fam = 'xbox') => NAMES[fam][i] ?? `Button ${i}`;

// ---- menus: spatial focus over the visible buttons of the top-most layer
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [data-go]:not(button)';
// The icon a button starts with (js/icons.js marks each <svg> with data-i), e.g. a ‹ Back or × close.
const leadIcon = (e) => { const n = [...e.childNodes].find((c) => c.nodeType !== 3 || c.textContent.trim()); return n?.getAttribute?.('data-i') || ''; };
const BACK_GO = ['back', 'resume'];

export class MenuNav {
  constructor() { this.cur = null; this.hold = 0; this.stickDir = null; this.sink = null; }

  root() {
    const s = [...document.querySelectorAll('.screen:not(.hidden)')];
    return s.length ? s[s.length - 1] : null;
  }

  items(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
  }

  // Keep the browser's own keyboard focus on a neutral, non-interactive element. On iPad, Safari gives the
  // controller to the page only while the page holds focus; a focused <button> or the address bar lets
  // iPadOS turn controller buttons into its own shortcuts (tab switching, etc.).
  holdFocus() {
    if (!this.sink) { this.sink = document.getElementById('game'); this.sink?.setAttribute('tabindex', '-1'); }
    const a = document.activeElement;
    if (this.sink && a !== this.sink && (!a || a === document.body || a.tagName === 'BUTTON' || a.tagName === 'A')) {
      try { this.sink.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }
  }

  setFocus(e) { // purely visual: the ring, never the browser's focus (see holdFocus)
    if (this.cur === e) return;
    this.cur?.classList.remove('pad-focus');
    this.cur = e;
    this.curKey = e ? keyOf(e) : null;
    if (!e) return;
    e.classList.add('pad-focus');
    e.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  // The next item in a direction, like a console menu: prefer items that line up with this one (their
  // rows / columns overlap), then the nearest, then the best-centred. Up / down off the end wraps around.
  move(list, dir) {
    const f = this.cur.getBoundingClientRect(), fx = f.left + f.width / 2, fy = f.top + f.height / 2;
    const horiz = dir === 'left' || dir === 'right', sign = dir === 'right' || dir === 'down' ? 1 : -1;
    const rank = (e, wrap) => {
      const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = (horiz ? cx - fx : cy - fy) * sign;
      if (!wrap && d <= 4) return null;
      // edge-to-edge gap along the direction, and the gap (0 if they overlap) across it
      const along = wrap ? -d : Math.max(0, horiz ? (sign > 0 ? r.left - f.right : f.left - r.right) : (sign > 0 ? r.top - f.bottom : f.top - r.bottom));
      const across = horiz ? Math.max(0, r.top - f.bottom, f.top - r.bottom) : Math.max(0, r.left - f.right, f.left - r.right);
      if (horiz && across > 0) return null; // left / right stay in this row (a segmented control, a card row)
      const off = Math.abs(horiz ? cy - fy : cx - fx);
      return (across > 0 ? 1e4 + across * 4 : 0) + along + off * 0.25;
    };
    const pick = (wrap) => { let best = null, bs = Infinity; for (const e of list) { if (e === this.cur) continue; const sc = rank(e, wrap); if (sc !== null && sc < bs) { bs = sc; best = e; } } return best; };
    let best = pick(false);
    if (!best && !horiz) { // off the end of a list: wrap to the item in line at the other end
      const inLine = list.filter((e) => { const r = e.getBoundingClientRect(); return e !== this.cur && r.left < f.right && r.right > f.left; });
      best = inLine.length ? inLine.reduce((a, e) => ((e.getBoundingClientRect().top - a.getBoundingClientRect().top) * sign < 0 ? e : a)) : null;
    }
    if (best) this.setFocus(best);
    return !!best;
  }

  // The stick as a d-pad: engage past 0.5, release under 0.3 (no jitter at the edge), lock the direction
  // until release so a wobbly diagonal can't double-step, and repeat when held (faster the further it's pushed).
  stick(pad, dt) {
    const m = pad.lm;
    if (!this.stickDir) {
      if (m < 0.5) return null;
      this.stickDir = Math.abs(pad.lx) > Math.abs(pad.ly) ? (pad.lx > 0 ? 'right' : 'left') : (pad.ly > 0 ? 'down' : 'up');
      this.hold = 0.34;
      return this.stickDir;
    }
    if (m < 0.3) { this.stickDir = null; return null; }
    const sd = Math.abs(pad.lx) > Math.abs(pad.ly) ? (pad.lx > 0 ? 'right' : 'left') : (pad.ly > 0 ? 'down' : 'up');
    if (sd !== this.stickDir && Math.max(Math.abs(pad.lx), Math.abs(pad.ly)) > 0.85 * m && m > 0.7) { this.stickDir = sd; this.hold = 0.34; return sd; } // a clear new direction
    if ((this.hold -= dt) <= 0) { this.hold = m > 0.9 ? 0.11 : 0.17; return this.stickDir; }
    return null;
  }

  // Called every frame outside gameplay. edges/pad come from InputManager.pollPad(). Returns true if it acted.
  update(edges, pad, dt, onBack) {
    if (!pad) return false;
    this.holdFocus();
    const root = this.root();
    if (!root) { this.setFocus(null); return false; }
    const list = this.items(root);
    if (!list.length) return false;
    let dir = edges.up ? 'up' : edges.down ? 'down' : edges.left ? 'left' : edges.right ? 'right' : null;
    const sdir = this.stick(pad, dt);
    dir = dir || sdir;
    if (this.cur && !document.contains(this.cur) && this.curKey) { // the menu re-rendered under us: find the same button again
      const again = list.find((e) => keyOf(e) === this.curKey);
      if (again) { this.cur = null; this.setFocus(again); }
    }
    if (!this.cur || !document.contains(this.cur) || !list.includes(this.cur)) {
      if (!dir && !edges.a && !edges.b) return false; // the ring appears on first use of the pad
      this.setFocus(list.find((e) => e.hasAttribute('data-pad-first')) || list.find((e) => e.classList.contains('on')) || list.find((e) => /\bbtn\b/.test(e.className) && !/\balt\b/.test(e.className)) || list[0]);
      if (!edges.a && !edges.b) return true; // the first press just shows where you are
    }
    if (dir) { this.move(list, dir); return true; }
    if (edges.a) { this.cur.click(); return true; }
    if (edges.b) {
      const back = root.querySelector('[data-close]') || list.find((e) => BACK_GO.includes(e.dataset?.go) || /^\s*(◀|✕|×)/.test(e.textContent) || ['caret-left', 'x'].includes(leadIcon(e)));
      if (back) back.click(); else onBack?.();
      return true;
    }
    return false;
  }
}

// A button's identity across re-renders: its data attributes (else its label) and where it sits in its parent.
function keyOf(e) {
  const ds = JSON.stringify({ ...e.dataset });
  return `${e.tagName}|${ds === '{}' ? e.textContent.trim() : ds}`;
}
