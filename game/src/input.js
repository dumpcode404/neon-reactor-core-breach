// Unified keyboard + mouse + touch input with virtual sticks.
// Exposes a per-frame snapshot the world consumes; render reads the same for touch UI.

export function createInput(canvas) {
  const keys = Object.create(null);
  const state = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: -1,
    firing: false,
    dashPressed: false,
    mouseX: 0,
    mouseY: 0,
    usingTouch: false,
    touchMove: { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 },
    touchAim: { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 },
    dashQueued: false,
    cardChoice: -1,
    pausePressed: false,
    mutePressed: false,
    restartPressed: false,
    confirmPressed: false,
    leftId: -1,
    rightId: -1,
  };

  function canvasPos(t) {
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') state.dashQueued = true;
    if (e.code === 'KeyP' || e.code === 'Escape') state.pausePressed = true;
    if (e.code === 'KeyM') state.mutePressed = true;
    if (e.code === 'KeyR' || e.code === 'Enter') {
      state.restartPressed = true;
      state.confirmPressed = true;
    }
    if (e.code === 'Digit1') state.cardChoice = 0;
    if (e.code === 'Digit2') state.cardChoice = 1;
    if (e.code === 'Digit3') state.cardChoice = 2;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    state.firing = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    const p = canvasPos(e);
    state.mouseX = p.x;
    state.mouseY = p.y;
    if (e.button === 0) state.firing = true;
  });
  window.addEventListener('mouseup', () => {
    state.firing = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = canvasPos(e);
    state.mouseX = p.x;
    state.mouseY = p.y;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function touchStart(e) {
    state.usingTouch = true;
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;
      if (x < r.width * 0.45 && state.leftId === -1) {
        state.leftId = t.identifier;
        state.touchMove = { active: true, id: t.identifier, sx: x, sy: y, dx: 0, dy: 0 };
      } else if (state.rightId === -1) {
        state.rightId = t.identifier;
        state.touchAim = { active: true, id: t.identifier, sx: x, sy: y, dx: 0, dy: 0 };
      }
    }
    if (e.cancelable) e.preventDefault();
  }

  function touchMove(e) {
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;
      if (t.identifier === state.leftId) {
        state.touchMove.dx = x - state.touchMove.sx;
        state.touchMove.dy = y - state.touchMove.sy;
      } else if (t.identifier === state.rightId) {
        state.touchAim.dx = x - state.touchAim.sx;
        state.touchAim.dy = y - state.touchAim.sy;
        state.mouseX = x;
        state.mouseY = y;
      }
    }
    if (e.cancelable) e.preventDefault();
  }

  function touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === state.leftId) {
        state.leftId = -1;
        state.touchMove = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
      }
      if (t.identifier === state.rightId) {
        state.rightId = -1;
        state.touchAim = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
      }
    }
  }

  canvas.addEventListener('touchstart', touchStart, { passive: false });
  canvas.addEventListener('touchmove', touchMove, { passive: false });
  canvas.addEventListener('touchend', touchEnd);
  canvas.addEventListener('touchcancel', touchEnd);

  // Called by render when a touch tap lands on a clickable rect (buttons, cards).
  state.tapAt = function tapAt(x, y) {
    state.mouseX = x;
    state.mouseY = y;
    state.confirmPressed = true;
  };

  state.poll = function poll() {
    let mx = 0;
    let my = 0;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    const tm = state.touchMove;
    if (tm.active) {
      const len = Math.hypot(tm.dx, tm.dy);
      if (len > 12) {
        mx = tm.dx / len * Math.min(1, len / 60);
        my = tm.dy / len * Math.min(1, len / 60);
      }
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    state.moveX = mx;
    state.moveY = my;
    const ta = state.touchAim;
    if (ta.active && Math.hypot(ta.dx, ta.dy) > 14) {
      const l = Math.hypot(ta.dx, ta.dy);
      state.aimX = ta.dx / l;
      state.aimY = ta.dy / l;
      state.firing = true;
    } else if (!state.usingTouch) {
      state.firing = state.firing || !!keys.Space;
    }
  };

  state.endFrame = function endFrame() {
    state.dashPressed = state.dashQueued;
    state.dashQueued = false;
    state.pausePressed = false;
    state.mutePressed = false;
    state.restartPressed = false;
    state.confirmPressed = false;
    state.cardChoice = -1;
  };

  state.consumeDash = function consumeDash() {
    const d = state.dashPressed;
    state.dashPressed = false;
    return d;
  };

  return state;
}
