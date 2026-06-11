// スマホタッチ操作（FR-TOUCH-001/002）+ PCフォールバック（FR-TOUCH-003）
// 左半面: 仮想スティック（移動）/ 右半面ドラッグ: カメラ旋回 / DOMボタン: 射撃・潜行・スペシャル
const STICK_MAX = 52;

export function createControls(area, els) {
  // els: { stick, stickKnob, btnFire, btnSwim, btnSp }
  const state = {
    stickId: null, sx: 0, sy: 0, ox: 0, oy: 0,
    camId: null, lastX: 0, yawDelta: 0,
    fire: false, swim: false, special: false,
    keys: new Set(), mouseDrag: false,
  };

  // --- タッチ ---
  area.addEventListener('touchstart', (ev) => {
    for (const t of ev.changedTouches) {
      if (t.clientX < innerWidth / 2 && state.stickId === null) {
        state.stickId = t.identifier;
        state.ox = t.clientX; state.oy = t.clientY;
        els.stick.style.left = `${t.clientX}px`; els.stick.style.top = `${t.clientY}px`;
        els.stick.classList.add('on');
      } else if (state.camId === null) {
        state.camId = t.identifier; state.lastX = t.clientX;
      }
    }
    ev.preventDefault();
  }, { passive: false });

  area.addEventListener('touchmove', (ev) => {
    for (const t of ev.changedTouches) {
      if (t.identifier === state.stickId) {
        let dx = t.clientX - state.ox, dy = t.clientY - state.oy;
        const l = Math.hypot(dx, dy);
        if (l > STICK_MAX) { dx = dx / l * STICK_MAX; dy = dy / l * STICK_MAX; }
        state.sx = dx / STICK_MAX; state.sy = dy / STICK_MAX;
        els.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === state.camId) {
        state.yawDelta += (t.clientX - state.lastX) * 0.0085;
        state.lastX = t.clientX;
      }
    }
    ev.preventDefault();
  }, { passive: false });

  const endTouch = (ev) => {
    for (const t of ev.changedTouches) {
      if (t.identifier === state.stickId) {
        state.stickId = null; state.sx = 0; state.sy = 0;
        els.stickKnob.style.transform = 'translate(0,0)';
        els.stick.classList.remove('on');
      }
      if (t.identifier === state.camId) state.camId = null;
    }
  };
  area.addEventListener('touchend', endTouch);
  area.addEventListener('touchcancel', endTouch);

  // --- ボタン（pointerでタッチ/マウス両対応・FR-TOUCH-002） ---
  bindButton(els.btnFire, (v) => { state.fire = v; });
  bindButton(els.btnSwim, (v) => { state.swim = v; });
  bindButton(els.btnSp, (v) => { state.special = v; });

  // --- PCフォールバック（FR-TOUCH-003） ---
  addEventListener('keydown', (ev) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyJ'].includes(ev.code)) ev.preventDefault();
    state.keys.add(ev.code);
  });
  addEventListener('keyup', (ev) => state.keys.delete(ev.code));
  area.addEventListener('mousedown', (ev) => { if (ev.button === 0) { state.mouseDrag = true; state.lastX = ev.clientX; } });
  addEventListener('mouseup', () => { state.mouseDrag = false; });
  addEventListener('mousemove', (ev) => {
    if (state.mouseDrag) { state.yawDelta += (ev.clientX - state.lastX) * 0.006; state.lastX = ev.clientX; }
  });

  // 消費型: カメラ旋回量を取り出す
  function consumeYawDelta() { const d = state.yawDelta; state.yawDelta = 0; return d; }

  // カメラ相対の移動入力（logic 2D）。yaw前方=(sin,cos)
  function getInput(yaw) {
    let sx = state.sx, sy = state.sy;
    if (state.keys.size) {
      sx += (state.keys.has('KeyD') ? 1 : 0) - (state.keys.has('KeyA') ? 1 : 0);
      sy += (state.keys.has('KeyS') ? 1 : 0) - (state.keys.has('KeyW') ? 1 : 0);
    }
    const fx = Math.sin(yaw), fy = Math.cos(yaw);   // 前方
    const rx = fy, ry = -fx;                         // 右方
    return {
      mx: fx * -sy + rx * sx,
      my: fy * -sy + ry * sx,
      aimX: fx, aimY: fy,
      fire: state.fire || state.keys.has('KeyJ'),
      swim: state.swim || state.keys.has('Space'),
      special: state.special || state.keys.has('KeyE'),
    };
  }

  return { getInput, consumeYawDelta };
}

function bindButton(el, set) {
  el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); el.setPointerCapture(ev.pointerId); set(true); el.classList.add('pressed'); });
  const off = () => { set(false); el.classList.remove('pressed'); };
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
