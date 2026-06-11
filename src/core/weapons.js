// 武器3種＋弾（FR-WPN-001/002/003, FR-INK-001, C-007/C-008）
import { CONFIG } from './config.js';
import { damageEntity } from './entities.js';
import { addSP } from './special.js';

const W = CONFIG.WEAPONS;

// 毎tick呼び出し。e=自エンティティ, input, state={grid,bullets,entities}
export function updateWeapon(e, input, state, dt) {
  if (e.state !== 'ALIVE') return;
  if (e.cooldown > 0) e.cooldown -= dt;
  const def = W[e.weaponKind];

  if (def.kind === 'shooter') updateShooter(e, def, input, state);
  else if (def.kind === 'roller') updateRoller(e, def, input, state, dt);
  else if (def.kind === 'charger') updateCharger(e, def, input, state, dt);
}

function canAct(e) { return !e.swimming; } // C-007: スイム中は射撃・チャージ不可

function updateShooter(e, def, input, state) {
  if (!input.fire || !canAct(e) || e.cooldown > 0) return;
  if (e.ink < def.inkCost) return; // FR-INK-001
  e.ink -= def.inkCost;
  e.cooldown = def.interval;
  spawnBullet(state, e, def.bulletSpeed, def.dmg, def.range, def.paintR, def.dropletEvery);
}

function updateRoller(e, def, input, state, dt) {
  // 轢き塗り: 通常移動（非スイム）時のみ（FR-WPN-002 / C-007）
  if (e.moving && !e.swimming && e.ink > 0) {
    const newly = state.grid.paintCircle(e.x, e.y, def.trailW / 2, e.team);
    if (newly > 0) addSP(e, newly);
    e.ink = Math.max(0, e.ink - def.inkCostTrail * dt);
  }
  // 振り（近接100dmg + 前方飛沫塗り）
  if (!input.fire || !canAct(e) || e.cooldown > 0) return;
  if (e.ink < def.inkCostSwing) return; // FR-INK-001
  e.ink -= def.inkCostSwing;
  e.cooldown = def.swingInterval;
  const sx = e.x + e.aimX * 50, sy = e.y + e.aimY * 50;
  const newly = state.grid.paintCircle(sx, sy, def.swingPaintR, e.team);
  if (newly > 0) addSP(e, newly);
  for (const t of state.entities) {
    if (t.team === e.team || t.state !== 'ALIVE') continue;
    const dx = t.x - e.x, dy = t.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= def.swingRange && (dx * e.aimX + dy * e.aimY) / (d || 1) > 0.3) {
      damageEntity(t, def.swingDmg);
    }
  }
}

function updateCharger(e, def, input, state, dt) {
  if (e.swimming) { e.charge = 0; e.charging = false; return; } // REV-R1-005: スイムでチャージ破棄
  if (input.fire) {
    e.charging = true;
    e.charge = Math.min(1, e.charge + dt / def.chargeTime);
    if (e.charge > 0.9999) e.charge = 1; // 浮動小数点蓄積誤差の吸収
    return;
  }
  if (!e.charging) return;
  // リリース→発射
  const c = e.charge;
  e.charging = false; e.charge = 0;
  const cost = def.inkCostFull * Math.max(0.3, c);
  if (e.ink < cost) return; // FR-INK-001
  e.ink -= cost;
  const range = def.maxRange * (def.rangeBase + (1 - def.rangeBase) * c); // FR-WPN-003
  const dmg = c >= 1 ? def.fullDmg : def.partialDmg;
  spawnBullet(state, e, def.bulletSpeed, dmg, range, def.paintR, def.dropletEvery);
}

function spawnBullet(state, e, speed, dmg, range, paintR, dropletEvery) {
  state.bullets.push({
    team: e.team, ownerId: e.id,
    x: e.x + e.aimX * (CONFIG.PLAYER.RADIUS + 2),
    y: e.y + e.aimY * (CONFIG.PLAYER.RADIUS + 2),
    vx: e.aimX * speed, vy: e.aimY * speed,
    dmg, paintR, range, traveled: 0, dropletAcc: 0, dropletEvery,
  });
}

// 弾の前進・衝突・着弾。C-008: 障害物セル到達で消滅・塗りなし
export function updateBullets(state, dt) {
  const { grid, bullets, entities } = state;
  const SUB = 4; // 4px刻みで障害物・命中を検査
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let dist = Math.hypot(b.vx, b.vy) * dt;
    const ux = b.vx / (Math.hypot(b.vx, b.vy) || 1), uy = b.vy / (Math.hypot(b.vx, b.vy) || 1);
    let removed = false;
    while (dist > 0 && !removed) {
      const step = Math.min(SUB, dist);
      b.x += ux * step; b.y += uy * step;
      b.traveled += step; b.dropletAcc += step;
      dist -= step;
      if (grid.isObstacleAt(b.x, b.y)) { removed = true; break; } // C-008
      // 飛沫塗り
      if (b.dropletAcc >= b.dropletEvery) {
        b.dropletAcc = 0;
        creditPaint(state, b, grid.paintCircle(b.x, b.y, b.paintR * 0.55, b.team));
      }
      // 命中判定
      for (const t of entities) {
        if (t.team === b.team || t.state !== 'ALIVE') continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) <= CONFIG.PLAYER.RADIUS + 3) {
          damageEntity(t, b.dmg);
          creditPaint(state, b, grid.paintCircle(b.x, b.y, b.paintR * 0.8, b.team));
          removed = true; break;
        }
      }
      if (!removed && b.traveled >= b.range) { // 着弾塗り
        creditPaint(state, b, grid.paintCircle(b.x, b.y, b.paintR, b.team));
        removed = true;
      }
    }
    if (removed) bullets.splice(i, 1);
  }
}

function creditPaint(state, b, newly) {
  if (newly <= 0) return;
  const owner = state.entities.find((x) => x.id === b.ownerId);
  if (owner) addSP(owner, newly);
}
