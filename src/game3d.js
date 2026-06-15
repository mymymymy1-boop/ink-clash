// v2統括: 3D TPS + タッチ操作（FR-3D-001, FR-TOUCH-001/002/003）
import { CONFIG } from './core/config.js';
import { createMatch, tick } from './core/match.js';
import { hudModel } from './core/hud.js';
import { createRenderer3D } from './render3d.js';
import { createControls } from './touch.js';
import { createSound } from './sound.js';

const DT = 1 / 60;
const $ = (id) => document.getElementById(id);

let state = null;
let renderer = null;
let controls = null;
let sound = null;
let yaw = Math.PI / 2; // 初期: フィールド中央（+x方向）を向く
let selectedWeapon = 'shooter';
let selectedSpecial = 'storm'; // v2: スペシャル選択
let selectedDifficulty = 'NORMAL'; // v6: 難易度選択

function setup() {
  const canvas = $('game');
  renderer = createRenderer3D(canvas);
  sound = createSound();
  controls = createControls($('touch-layer'), {
    stick: $('stick'), stickKnob: $('stick-knob'),
    btnFire: $('btn-fire'), btnSwim: $('btn-swim'), btnSp: $('btn-sp'), btnJump: $('btn-jump'),
  });
  $('btn-mute').addEventListener('click', () => {
    $('btn-mute').textContent = sound.toggleMute() ? '🔇' : '🔊';
  });

  document.title = CONFIG.BRANDING.TITLE;
  $('title-name').textContent = CONFIG.BRANDING.TITLE;
  for (const btn of document.querySelectorAll('[data-weapon]')) {
    btn.querySelector('.wname').textContent = CONFIG.WEAPONS[btn.dataset.weapon].name;
    btn.addEventListener('click', () => {
      selectedWeapon = btn.dataset.weapon;
      for (const b of document.querySelectorAll('[data-weapon]')) b.classList.toggle('sel', b === btn);
    });
  }
  document.querySelector('[data-weapon="shooter"]').classList.add('sel');
  for (const btn of document.querySelectorAll('[data-stage]')) {
    btn.addEventListener('click', () => {
      CONFIG.STAGE_ID = parseInt(btn.dataset.stage);
      for (const b of document.querySelectorAll('[data-stage]')) b.style.borderColor = '#444';
      btn.style.borderColor = '#ff6b1a';
    });
  }
  document.querySelector('[data-stage="1"]').click();
  for (const btn of document.querySelectorAll('[data-special]')) {
    btn.addEventListener('click', () => {
      selectedSpecial = btn.dataset.special;
      for (const b of document.querySelectorAll('[data-special]')) b.style.borderColor = '#444';
      btn.style.borderColor = '#ffd23e';
    });
  }
  document.querySelector('[data-special="storm"]').click();
  for (const btn of document.querySelectorAll('[data-diff]')) {
    btn.addEventListener('click', () => {
      selectedDifficulty = btn.dataset.diff;
      for (const b of document.querySelectorAll('[data-diff]')) b.style.borderColor = '#444';
      btn.style.borderColor = '#ff6b1a';
    });
  }
  document.querySelector('[data-diff="NORMAL"]').click();
  $('start').addEventListener('click', startMatch);
  $('rematch').addEventListener('click', () => show('title'));

  const onResize = () => renderer.resize(innerWidth, innerHeight);
  addEventListener('resize', onResize);
  onResize();

  show('title');
  requestAnimationFrame(loop);
}

function startMatch() {
  // v3.2: 横画面基本 — 全画面化＋横向きロックを試行（非対応端末は#rotateオーバーレイが誘導）
  try {
    const el = document.documentElement;
    const fs = el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
    Promise.resolve(fs).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch { /* iOS Safari等は#rotateで誘導 */ }
  state = createMatch({
    seed: (Date.now() % 2147483647) | 1,
    playerWeapon: selectedWeapon,
    difficulty: selectedDifficulty,
  });
  // v2: プレイヤー (A1) のスペシャルタイプを設定
  const player = state.entities.find(e => e.id === 'A1');
  if (player) player.specialType = selectedSpecial;
  yaw = Math.PI / 2;
  renderer.reset(state);
  sound.play('start');
  sound.startBGM();
  show('play');
}

// 音は「自分の近く + 自分自身」だけ鳴らす（遠くの乱戦で音まみれにしない）
function playEvents(events) {
  const p = state.entities.find((e) => e.isPlayer) || state.entities[0];
  const seen = new Set();
  for (const ev of events) {
    if (seen.has(ev.type)) continue; // 同tick同種は1回
    if (Math.hypot(ev.x - p.x, ev.y - p.y) > 420) continue;
    seen.add(ev.type);
    sound.play(ev.type);
  }
}

// v9: 緩やかなエイムアシスト（タッチ操作補助）。照準コーン内の最寄り敵へ最大~0.12rad寄せる。
// 移動入力(mx/my)は変えず、照準(aimX/aimY)のみ補正。人間プレイヤー専用。
function applyAimAssist(input, state) {
  const p = state.entities.find((e) => e.id === 'A1');
  if (!p || p.state !== 'ALIVE') return input;
  let best = null, bestDot = Math.cos(0.26); // 約15°のコーン
  for (const e of state.entities) {
    if (e.team === p.team || e.state !== 'ALIVE') continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 1 || d > 320) continue;
    const dot = (input.aimX * dx + input.aimY * dy) / d;
    if (dot > bestDot) { bestDot = dot; best = [dx / d, dy / d]; }
  }
  if (best) {
    const cur = Math.atan2(input.aimY, input.aimX);
    let diff = Math.atan2(best[1], best[0]) - cur;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const a = cur + Math.max(-0.12, Math.min(0.12, diff)) * 0.5; // 半分だけ寄せる
    input.aimX = Math.cos(a); input.aimY = Math.sin(a);
  }
  return input;
}

let last = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const elapsed = Math.min(0.1, (t - last) / 1000); last = t;
  if (!state) return;

  yaw += controls.consumeYawDelta();
  if (state.phase === 'PLAY') {
    acc += elapsed;
    while (acc >= DT) {
      tick(state, applyAimAssist(controls.getInput(yaw), state), DT);
      acc -= DT;
      if (state.events?.length) { renderer.addFx(state.events); playEvents(state.events); }
    }
  }
  renderer.draw(state, 'A1', yaw);
  updateHUD();
  if (state.phase === 'RESULT' && !$('result').classList.contains('on')) showResult();
}

function updateHUD() {
  const h = hudModel(state, 'A1');
  $('time').textContent = h.timeText;
  $('ink-bar').style.width = `${h.inkPct}%`;
  $('hp-bar').style.width = `${h.hpPct}%`;
  $('sp-ring').style.setProperty('--p', `${h.spPct}`);
  $('btn-sp').classList.toggle('ready', h.spReady);
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
  sound.stopBGM();
  sound.play(r.winner === 1 ? 'win' : 'lose');
  $('result-title').textContent = r.winner === 0 ? '引き分け！' : r.winner === 1 ? 'WIN！' : 'LOSE…';
  $('result-title').style.color = r.winner === 0 ? '#fff' : CONFIG.BRANDING.TEAM_COLORS[r.winner];
  $('result-a').textContent = `${CONFIG.BRANDING.TEAM_NAMES[1]} ${(r.pctA * 100).toFixed(1)}%`;
  $('result-b').textContent = `${CONFIG.BRANDING.TEAM_NAMES[2]} ${(r.pctB * 100).toFixed(1)}%`;
  $('result-bar-a').style.width = `${(r.pctA / (r.pctA + r.pctB || 1)) * 100}%`;
  show('result');
}

function show(screen) {
  $('title').classList.toggle('on', screen === 'title');
  $('result').classList.toggle('on', screen === 'result');
  $('hud').classList.toggle('hidden', screen !== 'play');
  for (const id of ['btn-fire', 'btn-swim', 'btn-sp', 'btn-jump']) $(id).classList.toggle('hidden', screen !== 'play');
  if (screen === 'title') state = null;
}

setup();
