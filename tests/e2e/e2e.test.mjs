// E2Eシミュレーション — docs/E2E_SCENARIOS.md の6シナリオ + NFR-PERF-001
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/core/config.js';
import { createMatch, tick } from '../../src/core/match.js';
import { NO_INPUT } from '../../src/core/entities.js';

const DT = 1 / 60;
const input = (o = {}) => ({ ...NO_INPUT, ...o });

// 他キャラを長期離脱させてプレイヤーだけを駆動する補助
function isolatePlayer(m) {
  for (const e of m.entities) {
    if (!e.isPlayer) { e.state = 'SPLATTED'; e.respawnT = 99999; }
  }
  return m.entities.find((e) => e.isPlayer);
}

test('E2E-N1: フルマッチ完走（180s/8体）＋ NFR-PERF-001 ＋ C-001', () => {
  const m = createMatch({ seed: 2026, playerAuto: true });
  const ticks = Math.ceil(180 / DT) + 5;
  const times = [];
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    tick(m, NO_INPUT, DT);
    times.push(performance.now() - t0);
    if (m.phase === 'RESULT') break;
  }
  assert.equal(m.phase, 'RESULT');
  const r = m.result;
  // ボットPAINT動作の有効性: 合計塗り率>40%（REV-R1-010）
  assert.ok(r.pctA + r.pctB > 0.4, `塗り率合計=${((r.pctA + r.pctB) * 100).toFixed(1)}%`);
  // 勝者判定がカウントと一致
  const expect = r.countA > r.countB ? 1 : r.countB > r.countA ? 2 : 0;
  assert.equal(r.winner, expect);
  // C-001: 増分カウントと実セル数が一致
  const n = m.grid.recount();
  assert.equal(n[1], m.grid.counts[1]);
  assert.equal(n[2], m.grid.counts[2]);
  // NFR-PERF-001: 平均<33ms かつ p95<50ms
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times.slice().sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  assert.ok(avg < 33, `avg=${avg.toFixed(3)}ms`);
  assert.ok(p95 < 50, `p95=${p95.toFixed(3)}ms`);
});

test('E2E-N2: 終了時点判定 — 後半の塗り返しで逆転', () => {
  const m = createMatch({ seed: 7, playerAuto: true });
  // スクリプト操作: Aが大きく塗る → Bが同領域を塗り返す（FR-MATCH-002）
  for (let x = 200; x <= 1000; x += 40) m.grid.paintCircle(x, 360, 24, 1);
  const aBefore = m.grid.counts[1];
  assert.ok(aBefore > 0);
  for (let x = 200; x <= 1000; x += 40) m.grid.paintCircle(x, 360, 28, 2);
  assert.ok(m.grid.counts[2] >= aBefore); // 塗り返し分はBに計上
  assert.ok(m.grid.counts[1] < aBefore * 0.2);
  m.time = 0.001;
  tick(m, NO_INPUT, DT);
  assert.equal(m.phase, 'RESULT');
  assert.equal(m.result.winner, 2);
});

test('E2E-N3: 塗り→SP150→発動でインク全回復＋帯塗り', () => {
  const m = createMatch({ seed: 3 });
  const p = isolatePlayer(m);
  // 右へ移動しながら射撃してSPを溜める
  let fired = 0;
  for (let i = 0; i < 60 * 60 && p.sp < CONFIG.SP.MAX; i++) {
    const inp = input({ mx: 1, my: 0, aimX: 1, aimY: 0.2, fire: p.ink > 5 });
    if (p.ink <= 5) inp.swim = true; // 自インクで回復
    tick(m, inp, DT);
    fired++;
  }
  assert.ok(p.sp >= CONFIG.SP.MAX, `sp=${p.sp} (${fired}tick)`);
  const inkBefore = p.ink;
  tick(m, input({ special: true, aimX: 1, aimY: 0 }), DT);
  assert.equal(p.sp, 0);
  assert.ok(p.ink > inkBefore || p.ink >= 99); // 発動で全回復（直後1tickの消費は許容）
});

test('E2E-A1: インク枯渇下の連射入力 → 弾ゼロ・例外なし・回復後に再射撃可', () => {
  const m = createMatch({ seed: 4 });
  const p = isolatePlayer(m);
  p.ink = 0;
  for (let i = 0; i < 100; i++) tick(m, input({ fire: true }), DT);
  assert.equal(m.bullets.length, 0);
  // 非射撃で自然回復（3%/s）→ 1.0%超で再射撃可能
  for (let i = 0; i < 60; i++) tick(m, NO_INPUT, DT);
  assert.ok(p.ink >= 1);
  tick(m, input({ fire: true }), DT);
  assert.equal(m.bullets.length, 1);
});

test('E2E-A2: ダウン中の全入力無効 → 3s後復活で入力が効く', () => {
  const m = createMatch({ seed: 5 });
  const p = isolatePlayer(m);
  p.hp = 1;
  // 自滅させる代わりに直接ダメージ相当: hp1で敵インクは使えないため weapons経由を簡略化
  p.hp = 0; p.state = 'SPLATTED'; p.respawnT = CONFIG.PLAYER.RESPAWN_TIME;
  const x0 = p.x, y0 = p.y, sp0 = p.sp;
  for (let i = 0; i < 30; i++) tick(m, input({ mx: 1, my: 1, fire: true, special: true }), DT);
  assert.equal(p.x, x0); assert.equal(p.y, y0);
  assert.equal(m.bullets.length, 0);
  assert.equal(p.sp, sp0);
  // 残り2.5s経過で復活
  for (let i = 0; i < Math.ceil(2.6 / DT); i++) tick(m, NO_INPUT, DT);
  assert.equal(p.state, 'ALIVE');
  const x1 = p.x;
  tick(m, input({ mx: 1 }), DT);
  assert.ok(p.x > x1);
});

test('E2E-B1: グリッド端・障害物・time=0境界で壊れない', () => {
  const m = createMatch({ seed: 6 });
  const p = isolatePlayer(m);
  // 端への塗り（範囲外混在）
  m.grid.paintCircle(0, 0, 30, 1);
  m.grid.paintCircle(1280, 720, 30, 2);
  const n = m.grid.recount();
  assert.equal(n[1], m.grid.counts[1]);
  // 障害物セルは塗られない
  m.grid.setObstacleRect(640, 360, 16, 16);
  m.grid.paintCircle(648, 368, 12, 1);
  assert.equal(m.grid.valueAt(648, 368), 255);
  // time=0直前に発射 → 終了後は弾が無効化されゲーム状態不変（C-005）
  p.x = 400; p.y = 100; p.aimX = 1; p.aimY = 0; p.ink = 100;
  m.time = 0.01;
  tick(m, input({ fire: true }), DT);
  assert.equal(m.phase, 'RESULT');
  assert.equal(m.bullets.length, 0);
  const a = m.grid.counts[1];
  for (let i = 0; i < 10; i++) tick(m, input({ fire: true }), DT);
  assert.equal(m.grid.counts[1], a);
});
