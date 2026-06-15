// v3テスト — ジャンプ/高低差/新武器3種/イベント（SRS_v3）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/core/config.js';
import { PaintGrid } from '../../src/core/grid.js';
import { createEntity, updateEntity, NO_INPUT } from '../../src/core/entities.js';
import { updateWeapon, updateBullets } from '../../src/core/weapons.js';

const DT = 1 / 60;
const PH = CONFIG.TERRAIN.PLATFORM_H;
const input = (o = {}) => ({ ...NO_INPUT, ...o });
const freshGrid = () => new PaintGrid(CONFIG.GRID.COLS, CONFIG.GRID.ROWS, CONFIG.GRID.CELL);
const st = (grid, entities) => ({ grid, entities, bullets: [], events: [], difficulty: 'NORMAL' });

test('TC-FR-JMP-001: ジャンプで上昇し着地で接地、空中で再ジャンプ不可', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 400, y: 300, weaponKind: 'shooter' });
  updateEntity(e, input({ jump: true }), g, DT);
  assert.ok(!e.grounded && e.vz > 0 && e.justJumped);
  const vz1 = e.vz;
  updateEntity(e, input({ jump: true }), g, DT); // 空中ジャンプは無効
  assert.ok(e.vz < vz1);
  let peaked = 0;
  for (let i = 0; i < 120 && !e.grounded; i++) { updateEntity(e, NO_INPUT, g, DT); peaked = Math.max(peaked, e.z); }
  assert.ok(e.grounded && e.z === 0);
  assert.ok(peaked > PH, `頂点${peaked.toFixed(1)} > 台${PH}`); // 台に登れる高さ
});

test('TC-FR-LVL-001: 台の側面は地上から侵入不可・ジャンプ中なら登れる・上から歩いて降りられる', () => {
  const g = freshGrid();
  g.setPlatformRect(400, 200, 160, 160, 1); // 台
  const e = createEntity({ id: 'A1', team: 1, x: 380, y: 280, weaponKind: 'shooter' });
  // 地上のまま右へ → 側面でブロック
  for (let i = 0; i < 30; i++) updateEntity(e, input({ mx: 1 }), g, DT);
  assert.ok(e.x < 400 + 2, `x=${e.x.toFixed(1)} は台手前で止まる`);
  // ジャンプしながら進む → 登れる
  for (let i = 0; i < 90 && !(e.grounded && e.z === PH); i++) {
    updateEntity(e, input({ mx: 1, jump: i === 0 }), g, DT);
  }
  assert.equal(e.z, PH);
  assert.ok(e.x > 400);
  // 歩いて端から出る → 落下して地面へ
  for (let i = 0; i < 200 && !(e.grounded && e.z === 0); i++) updateEntity(e, input({ mx: -1 }), g, DT);
  assert.equal(e.z, 0);
});

test('TC-FR-WPN-004: スロッシャーは山なりで壁(高さ44)を越えて向こう側を塗る', () => {
  const g = freshGrid();
  g.setObstacleRect(480, 280, 24, 60); // 壁
  const e = createEntity({ id: 'A1', team: 1, x: 380, y: 310, weaponKind: 'slosher' });
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e]);
  updateWeapon(e, input({ fire: true }), s, DT);
  assert.equal(s.bullets.length, 1);
  for (let i = 0; i < 120 && s.bullets.length; i++) updateBullets(s, DT);
  assert.equal(s.bullets.length, 0);
  // 壁の向こう（x>504）に塗りがある
  let beyond = false;
  for (let x = 510; x < 700; x += 8) if (g.valueAt(x, 310) === 1) { beyond = true; break; }
  assert.ok(beyond, '壁の向こうが塗れている');
  // シューター(低弾道)は同じ壁で止まる（新品グリッドで検証）
  const g2 = freshGrid();
  g2.setObstacleRect(480, 280, 24, 60);
  const e2 = createEntity({ id: 'A2', team: 1, x: 380, y: 310, weaponKind: 'shooter' });
  e2.aimX = 1; e2.aimY = 0;
  const s2 = st(g2, [e2]);
  updateWeapon(e2, input({ fire: true }), s2, DT);
  for (let i = 0; i < 60 && s2.bullets.length; i++) updateBullets(s2, DT);
  let pierced = false;
  for (let x = 510; x < 620; x += 8) if (g2.valueAt(x, 310) === 1) { pierced = true; break; }
  assert.ok(!pierced, 'シューターは壁を越えない');
});

test('TC-FR-WPN-005: スピナーはスピンアップ(0.8s)後に連射・移動0.6倍', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'spinner' });
  const s = st(g, [e]);
  // 0.4s保持 → まだ撃てない
  for (let i = 0; i < 24; i++) { updateEntity(e, input({ fire: true }), g, DT); updateWeapon(e, input({ fire: true }), s, DT); }
  assert.equal(s.bullets.length, 0);
  // スピン中の移動減速
  const x0 = e.x;
  updateEntity(e, input({ fire: true, mx: 1 }), g, DT);
  assert.ok(Math.abs((e.x - x0) - CONFIG.PLAYER.SPEED * CONFIG.WEAPONS.spinner.spinSpeedMult * DT) < 0.01);
  // 計1.0s保持 → 連射開始（0.2s で 3〜4発）
  for (let i = 0; i < 36; i++) { updateEntity(e, input({ fire: true }), g, DT); updateWeapon(e, input({ fire: true }), s, DT); }
  assert.ok(s.bullets.length >= 3, `bullets=${s.bullets.length}`);
});

test('TC-FR-WPN-006: ブラスターは着弾爆発で範囲ダメージ', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'blaster' });
  // 弾は銃口オフセット15px込みで x≈545 で爆発する。585 = 直撃(±16px)はしないが爆風(55px)圏内
  const near = createEntity({ id: 'B1', team: 2, x: 300 + CONFIG.WEAPONS.blaster.range + 55, y: 300, weaponKind: 'shooter' });
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e, near]);
  updateWeapon(e, input({ fire: true }), s, DT);
  for (let i = 0; i < 90 && s.bullets.length; i++) updateBullets(s, DT);
  // 直撃していないが、射程端の爆発範囲(55px)内なので50ダメージ
  assert.equal(near.hp, 100 - CONFIG.WEAPONS.blaster.splashDmg);
  assert.ok(s.events.some((ev) => ev.type === 'explode'));
});

test('v3イベント: 射撃/着弾/スプラット系イベントが発火する', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'shooter' });
  const foe = createEntity({ id: 'B1', team: 2, x: 350, y: 300, weaponKind: 'shooter' });
  foe.hp = 30;
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e, foe]);
  updateWeapon(e, input({ fire: true }), s, DT);
  assert.ok(s.events.some((ev) => ev.type === 'shoot'));
  for (let i = 0; i < 30 && s.bullets.length; i++) updateBullets(s, DT);
  assert.ok(s.events.some((ev) => ev.type === 'splat'), JSON.stringify(s.events));
});

test('後方互換: eventsなしのstateでも武器処理が壊れない', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'shooter' });
  const s = { grid: g, entities: [e], bullets: [] }; // events未定義
  updateWeapon(e, input({ fire: true }), s, DT);
  for (let i = 0; i < 60 && s.bullets.length; i++) updateBullets(s, DT);
  assert.ok(true);
});

// v7: デュアル(2発)・ストリンガー(3発チャージ)・ブラッシュ(高速)の弾道
test('TC-FR-WPN-008: デュアルは1回の発射で2弾を扇状に出す', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'dualies' });
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e]);
  updateWeapon(e, input({ fire: true }), s, DT);
  const mine = s.bullets.filter((b) => b.ownerId === 'A1');
  assert.equal(mine.length, 2);
  assert.notEqual(mine[0].vy, mine[1].vy); // 扇状＝進行方向が異なる
});

test('TC-FR-WPN-009: ストリンガーはフルチャージ後のリリースで3弾を出す', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'stringer' });
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e]);
  for (let i = 0; i < 60; i++) updateWeapon(e, input({ fire: true }), s, DT); // チャージ
  const before = s.bullets.filter((b) => b.ownerId === 'A1').length;
  updateWeapon(e, input({ fire: false }), s, DT); // リリース
  const after = s.bullets.filter((b) => b.ownerId === 'A1').length;
  assert.equal(after - before, 3);
});

test('TC-FR-WPN-007: ブラッシュは短射程・超高速で従来シューターより手数が多い', () => {
  const g = freshGrid();
  const e = createEntity({ id: 'A1', team: 1, x: 300, y: 300, weaponKind: 'brush' });
  e.aimX = 1; e.aimY = 0;
  const s = st(g, [e]);
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    const n = s.bullets.length;
    updateWeapon(e, input({ fire: true }), s, DT);
    if (s.bullets.length > n) shots++;
  }
  assert.ok(shots >= 12, `ブラッシュは高速連射のはず: ${shots}`);
  assert.ok(CONFIG.WEAPONS.brush.range < CONFIG.WEAPONS.shooter.range); // 短射程
});

// v8: ジャンプ台で通常ジャンプより高く打ち上がる
test('TC-FR-PAD-001: ジャンプ台に接地すると通常ジャンプより高く打ち上がる', async () => {
  const { createMatch, tick } = await import('../../src/core/match.js');
  const { jumpPads } = await import('../../src/core/stage.js');
  CONFIG.STAGE_ID = 1;
  const pads = jumpPads();
  assert.ok(pads.length > 0);
  const s = createMatch({ seed: 3, playerWeapon: 'shooter' });
  const p = s.entities.find((e) => e.id === 'A1');
  p.x = pads[0][0]; p.y = pads[0][1]; p.z = 0; p.vz = 0; p.grounded = true;
  tick(s, input(), DT);
  assert.equal(p.vz, CONFIG.JUMP.PAD_V0); // 打ち上げ初速
  assert.ok(CONFIG.JUMP.PAD_V0 > CONFIG.JUMP.V0); // 通常ジャンプより強い
});

// v12: ゲームパッドのボタンマッピング（Switch/Xboxの差を吸収）
test('TC-FR-PAD-002: Switchはボタン物理入替を吸収し、Xboxは標準どおり割り当てる', async () => {
  const { mapGamepad } = await import('../../src/touch.js');
  const mk = (id, pressed = [], axes = [0, 0, 0, 0]) => ({
    id, axes, buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: pressed.includes(i) })),
  });
  // Switch: 下(0)・右(1)どちらでもジャンプ、左(2)・上(3)どちらでもスペシャル
  assert.equal(mapGamepad(mk('Pro Controller', [1])).jump, true);
  assert.equal(mapGamepad(mk('Nintendo Switch Pro Controller', [0])).jump, true);
  assert.equal(mapGamepad(mk('Joy-Con (L/R)', [2])).special, true);
  assert.equal(mapGamepad(mk('Pro Controller', [3])).special, true);
  // Xbox: A(0)のみジャンプ・B(1)はジャンプにしない / Y(3)のみスペシャル
  assert.equal(mapGamepad(mk('Xbox Wireless Controller', [0])).jump, true);
  assert.equal(mapGamepad(mk('Xbox Wireless Controller', [1])).jump, false);
  // 共通: R/ZR(5,7)=射撃、L/ZL(4,6)=潜行、LStickはデッドゾーン適用
  assert.equal(mapGamepad(mk('x', [7])).fire, true);
  assert.equal(mapGamepad(mk('x', [6])).swim, true);
  assert.equal(mapGamepad(mk('x', [], [0.1, 0, 0, 0])).lx, 0); // デッドゾーン
});
