// ブラウザ統括: 入力・ループ・画面遷移・HUD（FR-UI-001/002/003）
import { CONFIG } from './core/config.js';
import { createMatch, tick } from './core/match.js';
import { hudModel } from './core/hud.js';
import { createRenderer } from './render.js';

const DT = 1 / 60;
const $ = (id) => document.getElementById(id);

let state = null;
let renderer = null;
let selectedWeapon = 'shooter'; // デフォルト武器=シューター（REV-R1-106）
const keys = new Set();
const mouse = { x: 640, y: 360, down: false };

function setup() {
  const canvas = $('game');
  renderer = createRenderer(canvas);

  document.title = CONFIG.BRANDING.TITLE;
  $('title-name').textContent = CONFIG.BRANDING.TITLE;

  // 武器選択（FR-UI-003）
  for (const btn of document.querySelectorAll('[data-weapon]')) {
    btn.querySelector('.wname').textContent = CONFIG.WEAPONS[btn.dataset.weapon].name;
    btn.addEventListener('click', () => {
      selectedWeapon = btn.dataset.weapon;
      for (const b of document.querySelectorAll('[data-weapon]')) b.classList.toggle('sel', b === btn);
    });
  }
  document.querySelector('[data-weapon="shooter"]').classList.add('sel');
  $('start').addEventListener('click', startMatch);
  $('rematch').addEventListener('click', () => { show('title'); });

  // 入力（FR-UI-002: WASD/マウス/Space/E）
  addEventListener('keydown', (ev) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE'].includes(ev.code)) ev.preventDefault();
    keys.add(ev.code);
  });
  addEventListener('keyup', (ev) => keys.delete(ev.code));
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (ev.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (ev.clientY - r.top) * (canvas.height / r.height);
  });
  addEventListener('mousedown', (ev) => { if (ev.button === 0) mouse.down = true; });
  addEventListener('mouseup', (ev) => { if (ev.button === 0) mouse.down = false; });

  show('title');
  requestAnimationFrame(loop);
}

function startMatch() {
  state = createMatch({
    seed: (Date.now() % 2147483647) | 1,
    playerWeapon: selectedWeapon,
    difficulty: CONFIG.BOT.DEFAULT,
  });
  renderer.reset(state);
  show('play');
}

function playerInput() {
  const p = state.entities.find((e) => e.isPlayer);
  const mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const my = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
  return {
    mx, my,
    aimX: mouse.x - p.x, aimY: mouse.y - p.y,
    fire: mouse.down,
    swim: keys.has('Space'),
    special: keys.has('KeyE'),
  };
}

let last = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const elapsed = Math.min(0.1, (t - last) / 1000); last = t;
  if (!state || state.phase === 'TITLE') return;

  if (state.phase === 'PLAY') {
    acc += elapsed;
    while (acc >= DT) { tick(state, playerInput(), DT); acc -= DT; }
  }
  renderer.draw(state, 'A1');
  updateHUD();
  if (state.phase === 'RESULT' && !$('result').classList.contains('on')) showResult();
}

// HUD（FR-UI-001: 残り時間・インク・SP・塗り率バー）
function updateHUD() {
  const h = hudModel(state, 'A1');
  $('time').textContent = h.timeText;
  $('ink-bar').style.width = `${h.inkPct}%`;
  $('hp-bar').style.width = `${h.hpPct}%`;
  $('sp-bar').style.width = `${h.spPct}%`;
  $('sp-wrap').classList.toggle('ready', h.spReady);
  const total = Math.max(0.0001, h.ratioA + h.ratioB);
  $('ratio-a').style.width = `${(h.ratioA / total) * 100}%`;
  $('ratio-b').style.width = `${(h.ratioB / total) * 100}%`;
  $('ratio-a-pct').textContent = h.ratioAText;
  $('ratio-b-pct').textContent = h.ratioBText;
  $('respawn').classList.toggle('on', h.splatted);
  if (h.splatted) $('respawn-n').textContent = h.respawnIn;
}

function showResult() {
  const r = state.result;
  const youWin = r.winner === 1;
  $('result-title').textContent = r.winner === 0 ? '引き分け！' : youWin ? 'WIN！' : 'LOSE…';
  $('result-title').style.color = r.winner === 0 ? '#fff' : CONFIG.BRANDING.TEAM_COLORS[r.winner];
  $('result-a').textContent = `${CONFIG.BRANDING.TEAM_NAMES[1]} ${(r.pctA * 100).toFixed(1)}%`;
  $('result-b').textContent = `${CONFIG.BRANDING.TEAM_NAMES[2]} ${(r.pctB * 100).toFixed(1)}%`;
  $('result-bar-a').style.width = `${(r.pctA / (r.pctA + r.pctB || 1)) * 100}%`;
  show('result');
}

function show(screen) {
  $('title').classList.toggle('on', screen === 'title');
  $('result').classList.toggle('on', screen === 'result');
  if (screen === 'title' && state) state = null;
}

setup();
