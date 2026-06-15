// CPUボットAI: PAINT/FIGHT/RETREAT 3状態（FR-BOT-001/002, REV-R1-006/102）
import { CONFIG } from './config.js';
import { getSpawns } from './stage.js';
import { canSpecial } from './special.js';

const B = CONFIG.BOT;

export function createBotMemory() {
  return {
    mode: 'PAINT', tx: 0, ty: 0, hasTarget: false,
    reactT: 0, fireT: 0, repathT: 0,
    stuckX: 0, stuckY: 0, stuckT: 0,
  };
}

export function botThink(bot, mem, state, rng, dt) {
  if (bot.state !== 'ALIVE') return { mx: 0, my: 0, aimX: 1, aimY: 0, fire: false, swim: false, special: false };
  const diff = B.DIFFICULTIES[state.difficulty] || B.DIFFICULTIES[B.DEFAULT];
  const def = CONFIG.WEAPONS[bot.weaponKind];
  const weaponRange = def.range || def.maxRange || def.swingRange;

  // --- 状態遷移（FR-BOT-001） ---
  const enemy = nearestVisibleEnemy(bot, state, weaponRange * B.DETECT_MULT);
  let mode;
  if (bot.hp < 30 || bot.ink < 5) mode = 'RETREAT';
  else if (enemy) mode = 'FIGHT';
  else mode = 'PAINT';
  if (mode !== mem.mode) { mem.mode = mode; mem.reactT = 0; }
  mem.reactT += dt; mem.repathT += dt; mem.fireT += dt;

  const input = { mx: 0, my: 0, aimX: bot.aimX, aimY: bot.aimY, fire: false, swim: false, special: false, jump: false };

  if (mode === 'RETREAT') {
    const spawns = getSpawns();
    const s = spawns[bot.team];
    setMove(input, bot, s.x, s.y, state, mem, rng);
    input.swim = true; // 自インク上で高速回復（FR-INK-002）
  } else if (mode === 'FIGHT' && enemy) {
    // エイム誤差（FR-BOT-002）
    const ang = Math.atan2(enemy.y - bot.y, enemy.x - bot.x) + (rng() * 2 - 1) * diff.aimErr;
    input.aimX = Math.cos(ang); input.aimY = Math.sin(ang);
    // 距離調整: 射程の60%を維持
    const d = Math.hypot(enemy.x - bot.x, enemy.y - bot.y);
    const want = weaponRange * 0.6;
    if (d > want) setMove(input, bot, enemy.x, enemy.y, state, mem, rng);
    else if (d < want * 0.5) setMove(input, bot, bot.x * 2 - enemy.x, bot.y * 2 - enemy.y, state, mem, rng);
    // 反応遅延後に射撃（FR-BOT-002）
    if (mem.reactT >= diff.reactDelay) {
      if (def.kind === 'charger') {
        input.fire = bot.charge < 1; // フルチャージで離す
      } else if (def.kind === 'roller') {
        input.fire = d <= def.swingRange;
      } else {
        input.fire = true; // shooter/slosher/spinner/blaster は押しっぱなしでOK
      }
    }
    // 高所の敵へはジャンプで追従（v3）
    if (enemy.z > bot.z + 10 && bot.grounded && rng() < 0.1) input.jump = true;
    if (canSpecial(bot)) input.special = true;
  } else { // PAINT
    if (!mem.hasTarget || mem.repathT > B.REPATH_TIME || reached(bot, mem)) pickPaintTarget(bot, mem, state, rng);
    setMove(input, bot, mem.tx, mem.ty, state, mem, rng);
    input.aimX = input.mx || bot.aimX; input.aimY = input.my || bot.aimY;
    // 進行方向へ塗り射撃
    if (def.kind === 'shooter' || def.kind === 'slosher' || def.kind === 'blaster') input.fire = bot.ink > 15;
    else if (def.kind === 'spinner') input.fire = bot.ink > 25;
    else if (def.kind === 'charger') input.fire = mem.fireT % 1.0 < 0.55 && bot.ink > 25; // 部分チャージ連発
    // ローラーは移動轢き塗りのみ
    if (canSpecial(bot) && rng() < 0.02) input.special = true;
    // 目の前が高い台ならジャンプで登る（v3）
    if (bot.grounded && (input.mx !== 0 || input.my !== 0)) {
      const aheadH = state.grid.levelAt(bot.x + input.mx * 24, bot.y + input.my * 24) * CONFIG.TERRAIN.PLATFORM_H;
      if (aheadH > bot.z + CONFIG.TERRAIN.CLIMB_MARGIN) input.jump = true;
    }
  }

  // スタック時もジャンプを試す（v3）
  if (mem.stuckT > 0.8 && bot.grounded) input.jump = true;

  // スタック検知（REV-R1-102）
  if (Math.hypot(bot.x - mem.stuckX, bot.y - mem.stuckY) < 4) {
    mem.stuckT += dt;
    if (mem.stuckT > B.STUCK_TIME) { pickPaintTarget(bot, mem, state, rng); mem.stuckT = 0; }
  } else {
    mem.stuckX = bot.x; mem.stuckY = bot.y; mem.stuckT = 0;
  }
  return input;
}

function reached(bot, mem) { return Math.hypot(bot.x - mem.tx, bot.y - mem.ty) < 24; }

function pickPaintTarget(bot, mem, state, rng) {
  const g = state.grid;
  for (let i = 0; i < 12; i++) {
    const cx = Math.floor(rng() * g.cols), cy = Math.floor(rng() * g.rows);
    const v = g.cells[g.idx(cx, cy)];
    if (v === 255 || v === bot.team) continue; // 未塗or敵色を狙う
    mem.tx = cx * g.cell + g.cell / 2; mem.ty = cy * g.cell + g.cell / 2;
    mem.hasTarget = true; mem.repathT = 0;
    return;
  }
  mem.tx = CONFIG.WORLD.W / 2; mem.ty = CONFIG.WORLD.H / 2; mem.hasTarget = true; mem.repathT = 0;
}

// ステアリング: 目標へ直進＋前方レイで障害物回避（REV-R1-102）
function setMove(input, bot, tx, ty, state, mem, rng) {
  let dx = tx - bot.x, dy = ty - bot.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return;
  dx /= l; dy /= l;
  if (rayBlocked(bot, dx, dy, state.grid)) {
    for (const a of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const c = Math.cos(a), s = Math.sin(a);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      if (!rayBlocked(bot, rx, ry, state.grid)) { dx = rx; dy = ry; break; }
    }
  }
  input.mx = dx; input.my = dy;
}

function rayBlocked(bot, dx, dy, grid) {
  for (let d = 8; d <= B.RAY_AHEAD; d += 8) {
    if (grid.isObstacleAt(bot.x + dx * d, bot.y + dy * d)) return true;
  }
  return false;
}

// 視線遮蔽つき索敵（REV-R1-006）
function nearestVisibleEnemy(bot, state, detectR) {
  let best = null, bestD = detectR;
  for (const t of state.entities) {
    if (t.team === bot.team || t.state !== 'ALIVE') continue;
    const d = Math.hypot(t.x - bot.x, t.y - bot.y);
    if (d > bestD) continue;
    if (!lineOfSight(bot.x, bot.y, t.x, t.y, state.grid)) continue;
    best = t; bestD = d;
  }
  return best;
}

function lineOfSight(x1, y1, x2, y2, grid) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (grid.isObstacleAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}
