// スマホタッチ操作（FR-TOUCH-001/002）+ PCフォールバック（FR-TOUCH-003）+ Gamepad API（v2）
// 左半面: 仮想スティック（移動）/ 右半面ドラッグ: カメラ旋回 / DOMボタン: 射撃・潜行・スペシャル
// Gamepad: LStick=移動 / RStick=カメラ / LT/RT=潜行/射撃 / A=ジャンプ / Y=SP
const STICK_MAX = 52;
const GAMEPAD_DEADZONE = 0.2;

export function createControls(area, els) {
  // els: { stick, stickKnob, btnFire, btnSwim, btnSp, btnJump }
  const state = {
    stickId: null, sx: 0, sy: 0, ox: 0, oy: 0,
    camId: null, lastX: 0, yawDelta: 0,
    fire: false, swim: false, special: false, jump: false,
    keys: new Set(), mouseDrag: false,
    gpLsx: 0, gpLsy: 0, gpRx: 0, // v2: Gamepad state
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
        state.yawDelta -= (t.clientX - state.lastX) * 0.0085; // スワイプ右=右を向く（v3.3）
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
  bindButton(els.btnJump, (v) => { state.jump = v; }); // v3

  // --- PCフォールバック（FR-TOUCH-003）: Space=ジャンプ / K=潜行 / J=射撃 / E=SP ---
  addEventListener('keydown', (ev) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyJ', 'KeyK'].includes(ev.code)) ev.preventDefault();
    state.keys.add(ev.code);
  });
  addEventListener('keyup', (ev) => state.keys.delete(ev.code));
  area.addEventListener('mousedown', (ev) => { if (ev.button === 0) { state.mouseDrag = true; state.lastX = ev.clientX; } });
  addEventListener('mouseup', () => { state.mouseDrag = false; });
  addEventListener('mousemove', (ev) => {
    if (state.mouseDrag) { state.yawDelta -= (ev.clientX - state.lastX) * 0.006; state.lastX = ev.clientX; }
  });

  // 消費型: カメラ旋回量を取り出す
  function consumeYawDelta() { const d = state.yawDelta; state.yawDelta = 0; return d; }

  // Gamepad ポーリング（v2）
  function updateGamepad() {
    const gp = navigator.getGamepads?.()?.[0];
    if (!gp) return;
    const pad = (v) => (Math.abs(v) > GAMEPAD_DEADZONE ? v : 0);
    state.gpLsx = pad(gp.axes[0]); // LStick X
    state.gpLsy = pad(gp.axes[1]); // LStick Y
    state.gpRx = pad(gp.axes[2]) * 0.007; // RStick X → yaw delta
    state.yawDelta += state.gpRx;
    // ボタン: LT=4, RT=5, A=0, Y=3
    state.swim = state.swim || (gp.buttons[4]?.pressed || false);
    state.fire = state.fire || (gp.buttons[5]?.pressed || false);
    state.jump = state.jump || (gp.buttons[0]?.pressed || false);
    state.special = state.special || (gp.buttons[3]?.pressed || false);
  }

  // カメラ相対の移動入力（logic 2D）。yaw前方=(sin,cos)
  function getInput(yaw) {
    updateGamepad(); // v2: Gamepad ポーリング
    let sx = state.sx + state.gpLsx, sy = state.sy + state.gpLsy;
    if (state.keys.size) {
      sx += (state.keys.has('KeyD') ? 1 : 0) - (state.keys.has('KeyA') ? 1 : 0);
      sy += (state.keys.has('KeyS') ? 1 : 0) - (state.keys.has('KeyW') ? 1 : 0);
    }
    // クランプ
    const len = Math.hypot(sx, sy);
    if (len > 1) { sx /= len; sy /= len; }
    const fx = Math.sin(yaw), fy = Math.cos(yaw);   // 前方
    const rx = -fy, ry = fx;                         // 右方 = forward×up（v3.3: 左右リバース修正）
    return {
      mx: fx * -sy + rx * sx,
      my: fy * -sy + ry * sx,
      aimX: fx, aimY: fy,
      fire: state.fire || state.keys.has('KeyJ'),
      swim: state.swim || state.keys.has('KeyK'),
      special: state.special || state.keys.has('KeyE'),
      jump: state.jump || state.keys.has('Space'), // v3
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
