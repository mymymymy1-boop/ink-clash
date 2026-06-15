// スマホタッチ操作（FR-TOUCH-001/002）+ PCマウス操作（v11）+ Gamepad API（v2）
// 【スマホ】左半面: 仮想スティック（移動）/ 右半面ドラッグ: カメラ旋回 / DOMボタン: 射撃・潜行・SP
// 【PC】マウス移動=旋回 / 左クリック=前進 / 右クリック=潜行 / ホイールクリック=SP / Space=ショット / Enter=ジャンプ
// 【Gamepad】LStick=移動 / RStick=カメラ / L/ZL=潜行 / R/ZR=射撃 / 下右=ジャンプ / 左上=SP
//   Xbox/PS/Switch Pro・Joy-Con対応（Switchはボタン物理配置の入替を自動吸収）
const STICK_MAX = 52;
const GAMEPAD_DEADZONE = 0.2;
const MOUSE_TURN_DEAD = 0.10; // 画面中央付近は旋回しない不感帯（割合）
const MOUSE_TURN_SPEED = 2.6;  // rad/s（端まで倒したときの旋回速度）

export function createControls(area, els) {
  // els: { stick, stickKnob, btnFire, btnSwim, btnSp, btnJump }
  const state = {
    stickId: null, sx: 0, sy: 0, ox: 0, oy: 0,
    camId: null, lastX: 0, yawDelta: 0,
    fire: false, swim: false, special: false, jump: false,
    keys: new Set(),
    gpLsx: 0, gpLsy: 0, gpRx: 0, // v2: Gamepad state
    cursorX: innerWidth / 2, lmb: false, rmb: false, mmb: false, usedTouch: false, // v11: PCマウス
  };

  // --- タッチ ---
  area.addEventListener('touchstart', (ev) => {
    state.usedTouch = true; // タッチ端末ではPCマウス旋回を無効化
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

  // --- PC操作（v11）: Space=ショット / Enter=ジャンプ（WASD移動も併用可） ---
  addEventListener('keydown', (ev) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter'].includes(ev.code)) ev.preventDefault();
    state.keys.add(ev.code);
  });
  addEventListener('keyup', (ev) => state.keys.delete(ev.code));
  // マウス: 移動=旋回 / 左=前進 / 右=潜行 / 中=SP
  addEventListener('mousemove', (ev) => { state.cursorX = ev.clientX; });
  area.addEventListener('mousedown', (ev) => {
    state.cursorX = ev.clientX;
    if (ev.button === 0) state.lmb = true;
    else if (ev.button === 2) state.rmb = true;
    else if (ev.button === 1) { state.mmb = true; ev.preventDefault(); }
  });
  addEventListener('mouseup', (ev) => {
    if (ev.button === 0) state.lmb = false;
    else if (ev.button === 2) state.rmb = false;
    else if (ev.button === 1) state.mmb = false;
  });
  area.addEventListener('contextmenu', (ev) => ev.preventDefault()); // 右クリック=潜行のためメニュー抑制

  // 消費型: カメラ旋回量を取り出す。dt付き呼び出しでPCマウスの連続旋回を加算
  function consumeYawDelta(dt = 0) {
    let d = state.yawDelta; state.yawDelta = 0;
    if (!state.usedTouch && dt > 0) {
      const off = (state.cursorX - innerWidth / 2) / (innerWidth / 2); // -1(左)..+1(右)
      const m = Math.abs(off);
      if (m > MOUSE_TURN_DEAD) {
        const mag = (m - MOUSE_TURN_DEAD) / (1 - MOUSE_TURN_DEAD); // 不感帯外を0..1へ
        d -= Math.sign(off) * mag * MOUSE_TURN_SPEED * dt; // カーソルが右なら右へ旋回（右=yaw減・タッチと統一）
      }
    }
    return d;
  }

  // Gamepad ポーリング（v2 / v12: Switch Pro・Joy-Con対応）
  function firstGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const g of pads) if (g) return g;
    return null;
  }
  function updateGamepad() {
    const gp = firstGamepad();
    if (!gp) return;
    const g = mapGamepad(gp);
    state.gpLsx = g.lx; state.gpLsy = g.ly;
    state.gpRx = g.rx * 0.007;
    state.yawDelta -= state.gpRx; // スティック右=右を向く（右=yaw減・タッチと統一）
    state.swim = state.swim || g.swim;
    state.fire = state.fire || g.fire;
    state.jump = state.jump || g.jump;
    state.special = state.special || g.special;
  }

  // カメラ相対の移動入力（logic 2D）。yaw前方=(sin,cos)
  function getInput(yaw) {
    updateGamepad(); // v2: Gamepad ポーリング
    let sx = state.sx + state.gpLsx, sy = state.sy + state.gpLsy;
    if (state.keys.size) {
      sx += (state.keys.has('KeyD') ? 1 : 0) - (state.keys.has('KeyA') ? 1 : 0);
      sy += (state.keys.has('KeyS') ? 1 : 0) - (state.keys.has('KeyW') ? 1 : 0);
    }
    if (state.lmb) sy -= 1; // v11: 左クリック長押し=前進（-y=前方）
    // クランプ
    const len = Math.hypot(sx, sy);
    if (len > 1) { sx /= len; sy /= len; }
    const fx = Math.sin(yaw), fy = Math.cos(yaw);   // 前方
    const rx = -fy, ry = fx;                         // 右方 = forward×up（v3.3: 左右リバース修正）
    return {
      mx: fx * -sy + rx * sx,
      my: fy * -sy + ry * sx,
      aimX: fx, aimY: fy,
      fire: state.fire || state.keys.has('Space'),       // v11: Space=ショット
      swim: state.swim || state.rmb,                     // v11: 右クリック=潜行
      special: state.special || state.mmb,               // v11: ホイールクリック=SP
      jump: state.jump || state.keys.has('Enter'),       // v11: Enter=ジャンプ
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

// 純粋関数（DOM非依存・テスト可能）: ゲームパッド状態 → 入力。
// Switchはフェイスボタンの物理配置がXboxと入れ替わる（A/B・X/Yが逆）ため、
// 下/右ボタンをジャンプ、左/上ボタンをスペシャルにORして取りこぼしを防ぐ。
// トリガー/バンパー(4/5/6/7)はいずれでも潜行(L系)・射撃(R系)に反応する。
export function mapGamepad(gp) {
  const pad = (v) => (Math.abs(v) > GAMEPAD_DEADZONE ? v : 0);
  const ax = (i) => pad(gp.axes[i] ?? 0);
  const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  // カメラ旋回: 標準マッピングはRStick X=axes[2]。一部Switch非標準は[3]に出るため両対応
  const rx = ax(2) || (Math.abs(gp.axes[3] ?? 0) > 0.5 ? ax(3) : 0);
  const isSwitch = /nintendo|pro controller|joy-?con|057e/i.test(gp.id || '');
  return {
    lx: ax(0), ly: ax(1), rx,
    swim: btn(4) || btn(6),   // L / ZL
    fire: btn(5) || btn(7),   // R / ZR
    jump: isSwitch ? (btn(0) || btn(1)) : btn(0),       // 下/右 ジャンプ
    special: isSwitch ? (btn(2) || btn(3)) : btn(3),    // 左/上 スペシャル
  };
}
