// ユニットテスト — TEST_PLAN.md のTC-FR-*に対応（node:test / 依存ゼロ）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/core/config.js';
import { PaintGrid, OBSTACLE } from '../../src/core/grid.js';
import { createEntity, updateEntity, damageEntity, NO_INPUT } from '../../src/core/entities.js';
import { updateWeapon, updateBullets } from '../../src/core/weapons.js';
import { addSP, trySpecial, canSpecial } from '../../src/core/special.js';
import { createBotMemory, botThink } from '../../src/core/bots.js';
import { createMatch, tick } from '../../src/core/match.js';
import { hudModel } from '../../src/core/hud.js';
import { mulberry32 } from '../../src/core/rng.js';

const DT = 1 / 60;
const input = (o = {}) => ({ ...NO_INPUT, ...o });

function bareState(grid, entities) { return { grid, entities, bullets: [], difficulty: 'NORMAL' }; }
function freshGrid() { return new PaintGrid(CONFIG.GRID.COLS, CONFIG.GRID.ROWS, CONFIG.GRID.CELL); }

// ---------- grid ----------
test('TC-FR-PAINT-001: 着弾半径内セルがチーム色になる', () => {
  const g = freshGrid();
  const n = g.paintCircle(400, 300, 18, 1);
  assert.ok(n > 0);
  assert.equal(g.valueAt(400, 300), 1);
  assert.equal(g.counts[1], n);
});

test('TC-FR-MATCH-002: 塗り返しでカウントが移動する', () => {
  const g = freshGrid();
  const nA = g.paintCircle(400, 300, 20, 1);
  assert.equal(g.counts[1], nA);
  g.paintCircle(400, 300, 20, 2); // Bが同地点を完全に塗り返す
  assert.equal(g.counts[1], 0);
  assert.equal(g.counts[2], nA);
});

test('TC-FR-MATCH-003: 障害物セルは塗れず母数からも除外', () => {
  const g = freshGrid();
  g.setObstacleRect(96, 96, 32, 32); // 4x4セル=16
  assert.equal(g.obstacleCount, 16);
  const before = g.paintableTotal();
  assert.equal(before, CONFIG.GRID.COLS * CONFIG.GRID.ROWS - 16);
  g.paintCircle(112, 112, 30, 1);
  assert.equal(g.valueAt(112, 112), OBSTACLE); // 障害物は塗られない
});

test('C-001: counts増分とrecountが常に一致（塗り合い後）', () => {
  const g = freshGrid();
  g.setObstacleRect(200, 200, 64, 64);
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    g.paintCircle(rng() * 1280, rng() * 720, 10 + rng() * 30, rng() < 0.5 ? 1 : 2);
  }
  const n = g.recount();
  assert.equal(n[1], g.counts[1]);
  assert.equal(n[2], g.counts[2]);
  assert.equal(n[1] + n[2] + n.empty + n.obstacle, g.cols * g.rows);
});

test('C-004: グリッド範囲外アクセスはOBSTACLE扱いで安全', () => {
  const g = freshGrid();
  assert.equal(g.valueAt(-10, -10), OBSTACLE);
  assert.equal(g.valueAt(99999, 99999), OBSTACLE);
  g.paintCircle(-5, -5, 20, 1); // 例外を出さない
});

// ---------- entities / ink ----------
test('TC-FR-INK-001: インク不足で発射されない', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 400, y: 300, weaponKind: 'shooter' });
  e.ink = 0.5; // 必要1.0
  const st = bareState(g, [e]);
  updateWeapon(e, input({ fire: true }), st, DT);
  assert.equal(st.bullets.length, 0);
  assert.equal(e.ink, 0.5);
});

test('TC-FR-INK-002: 自インクスイムで+12%/s・速度1.8倍・スイム中射撃不可', () => {
  const g = freshGrid();
  g.paintCircle(400, 300, 200, 1); // 自インクの床
  const e = createEntity({ id: 'A1', team: 1, x: 400, y: 300, weaponKind: 'shooter' });
  e.ink = 50;
  const st = bareState(g, [e]);
  // 1秒スイム（移動なし）
  for (let i = 0; i < 60; i++) updateEntity(e, input({ swim: true }), g, DT);
  assert.ok(Math.abs(e.ink - 62) < 0.5, `ink=${e.ink}`);
  // 速度: スイム1tick移動距離 = SPEED*1.8*dt
  const x0 = e.x;
  updateEntity(e, input({ swim: true, mx: 1 }), g, DT);
  assert.ok(Math.abs((e.x - x0) - CONFIG.PLAYER.SPEED * 1.8 * DT) < 0.01);
  // スイム中は射撃不可（C-007）
  e.swimming = true; e.ink = 100; e.cooldown = 0;
  updateWeapon(e, input({ fire: true, swim: true }), st, DT);
  assert.equal(st.bullets.length, 0);
});

test('TC-FR-INK-003: 敵インクで速度0.4倍・10/s継続ダメージ（敵インク起因は下限30）', () => {
  const g = freshGrid();
  g.paintCircle(400, 300, 200, 2); // 敵インク
  const e = createEntity({ id: 'A1', team: 1, x: 400, y: 300, weaponKind: 'shooter' });
  for (let i = 0; i < 60; i++) updateEntity(e, NO_INPUT, g, DT); // 1秒
  assert.ok(Math.abs(e.hp - 90) < 0.5, `hp=${e.hp}`);
  const x0 = e.x;
  updateEntity(e, input({ mx: 1 }), g, DT);
  assert.ok(Math.abs((e.x - x0) - CONFIG.PLAYER.SPEED * 0.4 * DT) < 0.01);
  // 下限30: 長時間でも30未満にならない（移動は可能＝詰みなし REV-R1-101）
  for (let i = 0; i < 60 * 30; i++) updateEntity(e, NO_INPUT, g, DT);
  assert.equal(e.hp, 30);
  const x1 = e.x;
  updateEntity(e, input({ mx: 1 }), g, DT);
  assert.ok(e.x > x1); // 移動できる
});

// ---------- weapons ----------
test('TC-FR-WPN-001: シューター 100ms間隔・36dmg・1%消費・射程260', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 100, y: 300, weaponKind: 'shooter' });
  const st = bareState(g, [e]);
  // 0.25秒射撃保持 → 3発（t=0, 0.1, 0.2）
  for (let i = 0; i < 15; i++) {
    updateEntity(e, input({ fire: true }), g, DT);
    updateWeapon(e, input({ fire: true }), st, DT);
  }
  assert.equal(st.bullets.length, 3);
  assert.ok(Math.abs(e.ink - 97) < 0.01);
  assert.equal(st.bullets[0].dmg, 36);
  assert.equal(st.bullets[0].range, 260);
});

test('TC-FR-WPN-002: ローラー轢き塗り（通常移動のみ）と振り100dmg', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 200, y: 300, weaponKind: 'roller' });
  const foe = createEntity({ id: 'B1', team: 2, x: 270, y: 300, weaponKind: 'shooter' });
  const st = bareState(g, [e, foe]);
  // 80px直進 → 軌跡が塗られる
  for (let i = 0; i < 32; i++) { // 32tick*150px/s*(1/60)=80px
    updateEntity(e, input({ mx: 1 }), g, DT);
    updateWeapon(e, input({ mx: 1 }), st, DT);
  }
  assert.equal(g.valueAt(220, 300), 1); // 軌跡上
  assert.equal(g.valueAt(220, 300 - 8), 1); // 幅24px(3セル)内
  // スイム中は轢き塗りなし（C-007）
  g.paintCircle(e.x, e.y, 60, 1);
  const cntBefore = g.counts[1];
  for (let i = 0; i < 10; i++) {
    updateEntity(e, input({ mx: 0, my: 1, swim: true }), g, DT);
    updateWeapon(e, input({ mx: 0, my: 1, swim: true }), st, DT);
  }
  assert.equal(g.counts[1], cntBefore);
  // 振り: 前方の敵に100dmg→即ダウン
  e.swimming = false; e.cooldown = 0; e.ink = 100; e.aimX = 1; e.aimY = 0;
  foe.x = e.x + 70; foe.y = e.y;
  updateWeapon(e, input({ fire: true }), st, DT);
  assert.equal(foe.state, 'SPLATTED');
});

test('TC-FR-WPN-003: チャージャー フル100dmg/520px・半チャージ40dmg・チャージ中0.5倍速', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 100, y: 300, weaponKind: 'charger' });
  const st = bareState(g, [e]);
  // フルチャージ(1.2s=72tick)→離す
  for (let i = 0; i < 72; i++) {
    updateEntity(e, input({ fire: true }), g, DT);
    updateWeapon(e, input({ fire: true }), st, DT);
  }
  assert.ok(e.charge >= 1);
  // チャージ中の移動速度0.5x
  const x0 = e.x;
  updateEntity(e, input({ fire: true, mx: 1 }), g, DT);
  assert.ok(Math.abs((e.x - x0) - CONFIG.PLAYER.SPEED * 0.5 * DT) < 0.01);
  updateWeapon(e, input({ fire: true }), st, DT);
  updateEntity(e, NO_INPUT, g, DT);
  updateWeapon(e, NO_INPUT, st, DT); // リリース
  assert.equal(st.bullets.length, 1);
  assert.equal(st.bullets[0].dmg, 100);
  assert.equal(st.bullets[0].range, 520);
  // 半チャージ(0.6s)→40dmg・射程≈338
  st.bullets.length = 0; e.ink = 100;
  for (let i = 0; i < 36; i++) {
    updateEntity(e, input({ fire: true }), g, DT);
    updateWeapon(e, input({ fire: true }), st, DT);
  }
  updateEntity(e, NO_INPUT, g, DT);
  updateWeapon(e, NO_INPUT, st, DT);
  assert.equal(st.bullets.length, 1);
  assert.equal(st.bullets[0].dmg, 40);
  assert.ok(Math.abs(st.bullets[0].range - 520 * (0.35 + 0.65 * 0.5)) < 10);
  // スイム入力でチャージ破棄（REV-R1-005）
  st.bullets.length = 0; e.charge = 0.8; e.charging = true;
  updateEntity(e, input({ swim: true }), g, DT);
  updateWeapon(e, input({ swim: true }), st, DT);
  assert.equal(e.charge, 0);
  assert.equal(st.bullets.length, 0);
});

test('C-008: 弾は障害物セル到達で消滅し塗りなし', () => {
  const g = freshGrid();
  g.setObstacleRect(300, 280, 40, 40);
  const e = createEntity({ id: 'A1', team: 1, x: 200, y: 300, weaponKind: 'shooter' });
  const st = bareState(g, [e]);
  e.aimX = 1; e.aimY = 0;
  updateWeapon(e, input({ fire: true }), st, DT);
  assert.equal(st.bullets.length, 1);
  for (let i = 0; i < 60; i++) updateBullets(st, DT);
  assert.equal(st.bullets.length, 0);
  assert.equal(g.valueAt(360, 300), 0); // 障害物の先は塗られていない
});

// ---------- damage / respawn ----------
test('TC-FR-DMG-001: ダウン→3s後リスポーン全回復→1.5s無敵', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 500, y: 400, weaponKind: 'shooter' });
  e.hp = 36; e.ink = 10;
  assert.equal(damageEntity(e, 36), true);
  assert.equal(e.state, 'SPLATTED');
  for (let i = 0; i < Math.ceil(3 / DT) + 1; i++) updateEntity(e, NO_INPUT, g, DT); // +1=float蓄積誤差余裕
  assert.equal(e.state, 'ALIVE');
  assert.equal(e.hp, 100);
  assert.equal(e.ink, 100);
  assert.equal(e.x, e.spawnX);
  // 復活直後1.0s時点は被弾無効（REV-R1-009）
  assert.equal(damageEntity(e, 50), false);
  assert.equal(e.hp, 100);
});

// ---------- special ----------
test('TC-FR-SP-001: SP149不発/150発動・インク全回復・帯塗り・帯内敵40dmg', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'shooter' });
  const foe = createEntity({ id: 'B1', team: 2, x: 450, y: 300, weaponKind: 'shooter' });
  const st = bareState(g, [e, foe]);
  e.aimX = 1; e.aimY = 0; e.ink = 20;
  e.sp = 149;
  assert.equal(canSpecial(e), false);
  assert.equal(trySpecial(e, st), false); // C-006
  e.sp = 150;
  assert.equal(trySpecial(e, st), true);
  assert.equal(e.ink, 100);
  assert.equal(e.sp, 0);
  assert.equal(g.valueAt(450, 300), 1); // 帯内が塗られた
  assert.equal(foe.hp, 60); // 40dmg
});

test('addSP: 上限150でクランプ（C-002）', () => {
  const e = createEntity({ id: 'A1', team: 1, x: 0, y: 0, weaponKind: 'shooter' });
  addSP(e, 10000);
  assert.equal(e.sp, 150);
});

// ---------- bots ----------
test('TC-FR-BOT-001: 索敵内→FIGHT / HP<30→RETREAT / 障害物遮蔽→FIGHTしない', () => {
  const g = freshGrid();
  const bot = createEntity({ id: 'B1', team: 2, x: 600, y: 300, weaponKind: 'shooter' });
  const foe = createEntity({ id: 'A1', team: 1, x: 700, y: 300, weaponKind: 'shooter' });
  const st = { grid: g, entities: [bot, foe], bullets: [], difficulty: 'NORMAL' };
  const rng = mulberry32(1);
  const mem = createBotMemory();
  botThink(bot, mem, st, rng, DT);
  assert.equal(mem.mode, 'FIGHT');
  // HP<30 → RETREAT
  bot.hp = 29;
  botThink(bot, mem, st, rng, DT);
  assert.equal(mem.mode, 'RETREAT');
  // 障害物で視線遮蔽 → FIGHTに入らない（REV-R1-006）
  bot.hp = 100;
  g.setObstacleRect(640, 280, 24, 40);
  botThink(bot, mem, st, rng, DT);
  assert.equal(mem.mode, 'PAINT');
});

test('TC-FR-BOT-002: 難易度3段階でエイム誤差・反応遅延が異なる', () => {
  const d = CONFIG.BOT.DIFFICULTIES;
  assert.ok(d.EASY.aimErr > d.NORMAL.aimErr && d.NORMAL.aimErr > d.HARD.aimErr);
  assert.ok(d.EASY.reactDelay > d.NORMAL.reactDelay && d.NORMAL.reactDelay > d.HARD.reactDelay);
  assert.equal(CONFIG.BOT.DEFAULT, 'NORMAL');
});

// ---------- match / hud ----------
test('TC-FR-MATCH-001: time=0で勝敗判定・%が塗りカウントと一致', () => {
  const m = createMatch({ seed: 42, playerAuto: true });
  m.grid.paintCircle(300, 300, 60, 1);
  m.grid.paintCircle(900, 300, 30, 2);
  m.time = 0.001;
  tick(m, NO_INPUT, DT);
  assert.equal(m.phase, 'RESULT');
  assert.ok(m.result.countA > m.result.countB);
  assert.equal(m.result.winner, 1);
  assert.ok(Math.abs(m.result.pctA - m.result.countA / m.grid.paintableTotal()) < 1e-9);
});

test('C-005: RESULT後はtickしても状態不変', () => {
  const m = createMatch({ seed: 42, playerAuto: true });
  m.time = 0.001;
  tick(m, NO_INPUT, DT);
  const a = m.result.countA, t = m.time;
  for (let i = 0; i < 30; i++) tick(m, NO_INPUT, DT);
  assert.equal(m.result.countA, a);
  assert.equal(m.time, t);
});

test('TC-FR-UI-001: hudModelが時間/インク/SP/塗り率を返す', () => {
  const m = createMatch({ seed: 1 });
  const h = hudModel(m, 'A1');
  assert.equal(h.timeText, '3:00');
  assert.equal(h.inkPct, 100);
  assert.equal(h.spPct, 0);
  assert.equal(typeof h.ratioAText, 'string');
  assert.equal(h.phase, 'PLAY');
  m.time = 65;
  assert.equal(hudModel(m, 'A1').timeText, '1:05');
});
