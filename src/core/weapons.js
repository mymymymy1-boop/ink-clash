// 武器6種＋高さ対応弾道（FR-WPN-001〜006, FR-INK-001, C-007/C-008, v3）
import { CONFIG } from './config.js';
import { damageEntity } from './entities.js';
import { addSP } from './special.js';

const W = CONFIG.WEAPONS;
const T = CONFIG.TERRAIN;
const MUZZLE_H = 14;          // 銃口高さ（足元からのオフセット）
const BULLET_GRAVITY = 210;   // 通常弾のゆるい落下（チャージャーは無重力）

// 毎tick呼び出し。e=自エンティティ, input, state={grid,bullets,entities,events?}
export function updateWeapon(e, input, state, dt) {
  if (e.state !== 'ALIVE') return;
  if (e.cooldown > 0) e.cooldown -= dt;
  const def = W[e.weaponKind];

  if (def.kind === 'shooter') fireSimple(e, def, input, state, 0);
  else if (def.kind === 'slosher') fireSimple(e, def, input, state, def.lobV0); // v3: 山なり
  else if (def.kind === 'blaster') fireSimple(e, def, input, state, 0);
  else if (def.kind === 'spinner') updateSpinner(e, def, input, state, dt);
  else if (def.kind === 'roller') updateRoller(e, def, input, state, dt);
  else if (def.kind === 'charger') updateCharger(e, def, input, state, dt);
}

function canAct(e) { return !e.swimming; } // C-007: スイム中は射撃・チャージ不可

function fireSimple(e, def, input, state, vz0) {
  if (!input.fire || !canAct(e) || e.cooldown > 0) return;
  if (e.ink < def.inkCost) return; // FR-INK-001
  e.ink -= def.inkCost;
  e.cooldown = def.interval;
  // ブラスターは直進して射程端で爆発（重力なし）。シューター/スロッシャーは自然落下
  spawnBullet(state, e, def, vz0, def.kind !== 'blaster');
  emit(state, def.kind === 'blaster' ? 'shoot_heavy' : 'shoot', e.x, e.y, e.team);
}

function updateSpinner(e, def, input, state, dt) { // v3 FR-WPN-005
  if (input.fire && canAct(e)) {
    e.spin = Math.min(def.spinupTime, e.spin + dt);
    if (e.spin >= def.spinupTime && e.cooldown <= 0 && e.ink >= def.inkCost) {
      e.ink -= def.inkCost;
      e.cooldown = def.interval;
      spawnBullet(state, e, def, 0, true);
      emit(state, 'shoot', e.x, e.y, e.team);
    }
  } else {
    e.spin = Math.max(0, e.spin - dt * 2);
  }
}

function updateRoller(e, def, input, state, dt) {
  // 轢き塗り: 通常移動（非スイム・接地時のみ v3）（FR-WPN-002 / C-007）
  if (e.moving && !e.swimming && e.grounded && e.ink > 0) {
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
  emit(state, 'swing', e.x, e.y, e.team);
  for (const t of state.entities) {
    if (t.team === e.team || t.state !== 'ALIVE') continue;
    const dx = t.x - e.x, dy = t.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= def.swingRange && (dx * e.aimX + dy * e.aimY) / (d || 1) > 0.3 && Math.abs(t.z - e.z) < T.PLATFORM_H) {
      if (damageEntity(t, def.swingDmg)) emit(state, 'splat', t.x, t.y, t.team);
    }
  }
}

function updateCharger(e, def, input, state, dt) {
  if (e.swimming) { e.charge = 0; e.charging = false; return; } // REV-R1-005
  if (input.fire) {
    e.charging = true;
    e.charge = Math.min(1, e.charge + dt / def.chargeTime);
    if (e.charge > 0.9999) e.charge = 1; // 浮動小数点蓄積誤差の吸収
    return;
  }
  if (!e.charging) return;
  const c = e.charge;
  e.charging = false; e.charge = 0;
  const cost = def.inkCostFull * Math.max(0.3, c);
  if (e.ink < cost) return; // FR-INK-001
  e.ink -= cost;
  const range = def.maxRange * (def.rangeBase + (1 - def.rangeBase) * c); // FR-WPN-003
  const dmg = c >= 1 ? def.fullDmg : def.partialDmg;
  spawnBullet(state, e, { ...def, dmg, range }, 0, false); // 無重力レーザー
  emit(state, 'laser', e.x, e.y, e.team);
}

function spawnBullet(state, e, def, vz0, gravity) {
  state.bullets.push({
    team: e.team, ownerId: e.id, kind: def.kind,
    x: e.x + e.aimX * (CONFIG.PLAYER.RADIUS + 2),
    y: e.y + e.aimY * (CONFIG.PLAYER.RADIUS + 2),
    vx: e.aimX * def.bulletSpeed, vy: e.aimY * def.bulletSpeed,
    h: e.z + MUZZLE_H, vz: vz0, gravity,
    dmg: def.dmg, paintR: def.paintR, range: def.range,
    splashDmg: def.splashDmg || 0, splashR: def.splashR || 0,
    traveled: 0, dropletAcc: 0, dropletEvery: def.dropletEvery,
  });
}

// 弾の前進・衝突・着弾（v3: 高さ対応）。C-008: 遮蔽物で消滅・塗りなし
export function updateBullets(state, dt) {
  const { grid, bullets, entities } = state;
  const SUB = 4;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const speed = Math.hypot(b.vx, b.vy);
    const ux = b.vx / (speed || 1), uy = b.vy / (speed || 1);
    let dist = speed * dt;
    let removed = false;
    while (dist > 0 && !removed) {
      const step = Math.min(SUB, dist);
      const stepT = step / speed;
      b.x += ux * step; b.y += uy * step;
      if (b.gravity || b.vz !== 0) { b.h += b.vz * stepT; b.vz -= (b.gravity ? BULLET_GRAVITY : 0) * stepT; }
      b.traveled += step; b.dropletAcc += step;
      dist -= step;

      // 壁: 弾の高さが壁より低ければ遮断（v3）
      if (grid.isObstacleAt(b.x, b.y) && b.h < T.WALL_H) { removed = explodeOrDie(state, b, false); break; }
      // 台の側面: 台より低い弾は遮断
      const groundH = grid.levelAt(b.x, b.y) * T.PLATFORM_H;
      if (b.h < groundH) { removed = explodeOrDie(state, b, false); break; }
      // 接地（山なり弾・落下弾）
      if ((b.gravity || b.vz !== 0) && b.h <= groundH + 1 && b.vz < 0) { removed = land(state, b); break; }

      if (b.dropletAcc >= b.dropletEvery) {
        b.dropletAcc = 0;
        creditPaint(state, b, grid.paintCircle(b.x, b.y, b.paintR * 0.55, b.team));
      }
      for (const t of entities) {
        if (t.team === b.team || t.state !== 'ALIVE') continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) <= CONFIG.PLAYER.RADIUS + 3 && Math.abs(t.z + MUZZLE_H - b.h) < 30) {
          if (damageEntity(t, b.dmg)) emit(state, 'splat', t.x, t.y, t.team);
          creditPaint(state, b, grid.paintCircle(b.x, b.y, b.paintR * 0.8, b.team));
          removed = explodeOrDie(state, b, true);
          break;
        }
      }
      if (!removed && b.traveled >= b.range) { removed = land(state, b); }
    }
    if (removed) bullets.splice(i, 1);
  }
}

function land(state, b) {
  creditPaint(state, b, state.grid.paintCircle(b.x, b.y, b.paintR, b.team));
  emit(state, 'land', b.x, b.y, b.team);
  if (b.splashR > 0) return explodeOrDie(state, b, false);
  return true;
}

// ブラスター爆発（v3 FR-WPN-006）。directHit=trueなら直撃者以外に飛沫ダメージ
function explodeOrDie(state, b, directHit) {
  if (b.splashR > 0) {
    creditPaint(state, b, state.grid.paintCircle(b.x, b.y, b.paintR, b.team));
    emit(state, 'explode', b.x, b.y, b.team);
    for (const t of state.entities) {
      if (t.team === b.team || t.state !== 'ALIVE') continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d <= b.splashR && Math.abs(t.z + MUZZLE_H - b.h) < 40) {
        if (damageEntity(t, b.splashDmg)) emit(state, 'splat', t.x, t.y, t.team);
      }
    }
  }
  return true;
}

function emit(state, type, x, y, team) { state.events?.push({ type, x, y, team }); }

function creditPaint(state, b, newly) {
  if (newly <= 0) return;
  const owner = state.entities.find((x) => x.id === b.ownerId);
  if (owner) addSP(owner, newly);
}
