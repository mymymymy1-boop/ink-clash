// Entity: プレイヤー/ボット共通の状態と更新（DATA-002）
// FR-INK-001/002/003, FR-DMG-001, C-002/C-003/C-007
import { CONFIG } from './config.js';

const P = CONFIG.PLAYER;

export function createEntity({ id, team, x, y, weaponKind, isPlayer = false }) {
  return {
    id, team, x, y, spawnX: x, spawnY: y, isPlayer,
    hp: P.HP, ink: P.INK, sp: 0, weaponKind,
    state: 'ALIVE', respawnT: 0, invulnT: 0,
    swimming: false, aimX: 1, aimY: 0,
    cooldown: 0, charge: 0, charging: false,
    moving: false,
    z: 0, vz: 0, grounded: true, spin: 0, // v3: 高さ・ジャンプ・スピナー回転
  };
}

export const NO_INPUT = Object.freeze({ mx: 0, my: 0, aimX: 1, aimY: 0, fire: false, swim: false, special: false, jump: false });

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// 地形種別: 'own' | 'enemy' | 'none' | 'obstacle'
export function terrainFor(e, grid) {
  const v = grid.valueAt(e.x, e.y);
  if (v === 255) return 'obstacle';
  if (v === e.team) return 'own';
  if (v === 1 || v === 2) return 'enemy';
  return 'none';
}

export function updateEntity(e, input, grid, dt) {
  // FR-DMG-001 / E2E-A2: ダウン中は全入力無効
  if (e.state === 'SPLATTED') {
    e.respawnT -= dt;
    if (e.respawnT <= 0) {
      e.state = 'ALIVE'; e.x = e.spawnX; e.y = e.spawnY;
      e.hp = P.HP; e.ink = P.INK; e.invulnT = P.INVULN_TIME;
      e.charge = 0; e.charging = false; e.swimming = false;
      e.z = grid.levelAt(e.x, e.y) * CONFIG.TERRAIN.PLATFORM_H; e.vz = 0; e.grounded = true;
    }
    return;
  }
  if (e.invulnT > 0) e.invulnT = Math.max(0, e.invulnT - dt);

  const terrain = terrainFor(e, grid);
  const onOwn = terrain === 'own' && e.grounded;
  const onEnemy = terrain === 'enemy' && e.grounded; // 空中は地形効果なし（v3）

  // スイム形態（効果は自インク上のみ）。C-007: スイム中は射撃不可（weapons.jsで参照）
  e.swimming = !!input.swim;

  // エイム（単位ベクトル化）
  const al = Math.hypot(input.aimX, input.aimY);
  if (al > 1e-6) { e.aimX = input.aimX / al; e.aimY = input.aimY / al; }

  // インク回復: スイム+自インク=12%/s、非射撃時=3%/s（FR-INK-001/002）
  if (e.swimming && onOwn) e.ink += P.SWIM_RECOVER * dt;
  else if (!input.fire) e.ink += P.NATURAL_RECOVER * dt;
  e.ink = clamp(e.ink, 0, P.INK);

  // 敵インクダメージ（FR-INK-003 / C-003: この要因単独ではHP30未満にしない）
  if (onEnemy && e.invulnT <= 0 && e.hp > P.ENEMY_INK_HP_FLOOR) {
    e.hp = Math.max(P.ENEMY_INK_HP_FLOOR, e.hp - P.ENEMY_INK_DPS * dt);
  }

  // 移動速度（FR-INK-002/003, FR-WPN-003チャージ中0.5x）
  let mult = 1.0;
  if (e.swimming && onOwn) mult = P.SWIM_MULT;
  else if (onEnemy) mult = P.ENEMY_INK_MULT;
  if (e.charging) mult *= CONFIG.WEAPONS.charger.chargeSpeedMult;
  if (e.spin > 0 && e.weaponKind === 'spinner') mult *= CONFIG.WEAPONS.spinner.spinSpeedMult;

  let mx = input.mx, my = input.my;
  const ml = Math.hypot(mx, my);
  e.moving = ml > 1e-6;
  if (e.moving) {
    mx /= ml; my /= ml;
    const sp = P.SPEED * mult * dt;
    moveWithCollision(e, mx * sp, my * sp, grid);
  }

  // ジャンプ＆重力（v3 FR-JMP-001）
  if (input.jump && e.grounded && !e.swimming) {
    e.vz = CONFIG.JUMP.V0; e.grounded = false; e.justJumped = true;
  } else { e.justJumped = false; }
  const groundH = grid.levelAt(e.x, e.y) * CONFIG.TERRAIN.PLATFORM_H;
  if (!e.grounded || e.z !== groundH) {
    e.vz -= CONFIG.JUMP.GRAVITY * dt;
    e.z += e.vz * dt;
    e.grounded = false;
    if (e.z <= groundH && e.vz <= 0) { e.z = groundH; e.vz = 0; e.grounded = true; }
  }
  if (e.grounded && e.z < groundH) e.z = groundH; // 段差登り補助（CLIMB_MARGIN内）
}

// 軸別衝突（C-004: 境界はgrid側でobstacle扱い）
function moveWithCollision(e, dx, dy, grid) {
  const r = P.RADIUS;
  const W = CONFIG.WORLD.W, H = CONFIG.WORLD.H;
  const nx = clamp(e.x + dx, r, W - r);
  if (!blocked(nx, e.y, r, grid, Math.sign(dx), 0, e.z)) e.x = nx;
  const ny = clamp(e.y + dy, r, H - r);
  if (!blocked(e.x, ny, r, grid, 0, Math.sign(dy), e.z)) e.y = ny;
}

function blocked(x, y, r, grid, sx, sy, z) {
  // 進行方向の縁3点をチェック（壁 or 自分の高さより高い台の側面 = v3）
  const pts = sx !== 0
    ? [[x + sx * r, y], [x + sx * r, y - r * 0.7], [x + sx * r, y + r * 0.7]]
    : [[x, y + sy * r], [x - r * 0.7, y + sy * r], [x + r * 0.7, y + sy * r]];
  for (const [px, py] of pts) {
    if (grid.isObstacleAt(px, py)) return true;
    const h = grid.levelAt(px, py) * CONFIG.TERRAIN.PLATFORM_H;
    if (h > z + CONFIG.TERRAIN.CLIMB_MARGIN) return true; // 高い台の側面
  }
  return false;
}

// 武器・スペシャルによるダメージ（敵インクダメージとは別経路: HP0まで到達可能）
// 戻り値: ダウンさせたら true（FR-DMG-001）
export function damageEntity(e, dmg) {
  if (e.state !== 'ALIVE' || e.invulnT > 0) return false;
  if (e.barrierEnd) dmg *= 0.5; // バリア中は半減
  e.hp -= dmg;
  if (e.hp <= 0) {
    e.hp = 0; e.state = 'SPLATTED'; e.respawnT = P.RESPAWN_TIME;
    e.charge = 0; e.charging = false;
    return true;
  }
  return false;
}
