// スペシャル: SPゲージ＋スペシャルコマンド（v2: 2種類） — FR-SP-001, C-006
import { CONFIG } from './config.js';
import { damageEntity } from './entities.js';

const S = CONFIG.SP;

export const SPECIALS = {
  STORM: 'storm',   // インクストーム
  BARRIER: 'barrier', // インクバリア
};

export function addSP(e, newlyPaintedCells) {
  if (e.state !== 'ALIVE') return;
  e.sp = Math.min(S.MAX, e.sp + newlyPaintedCells * S.PER_CELL);
}

export function canSpecial(e) { return e.state === 'ALIVE' && e.sp >= S.MAX; } // C-006: >=150

export function trySpecial(e, state) {
  if (!canSpecial(e)) return false;
  const specialType = e.specialType || SPECIALS.STORM;
  if (specialType === SPECIALS.BARRIER) return tryBarrier(e, state);
  return tryStorm(e, state);
}

// インクストーム: 前方帯（幅48×長さ320px）即時塗り＋帯内の敵に40dmg。発動でインク全回復・SP=0
function tryStorm(e, state) {
  const { grid, entities } = state;
  const r = S.STORM_W / 2;
  for (let d = 0; d <= S.STORM_LEN; d += r) {
    grid.paintCircle(e.x + e.aimX * d, e.y + e.aimY * d, r, e.team);
  }
  for (const t of entities) {
    if (t.team === e.team || t.state !== 'ALIVE') continue;
    if (distToSegment(t.x, t.y, e.x, e.y, e.x + e.aimX * S.STORM_LEN, e.y + e.aimY * S.STORM_LEN) <= r + CONFIG.PLAYER.RADIUS) {
      damageEntity(t, S.STORM_DMG);
    }
  }
  e.ink = CONFIG.PLAYER.INK;
  e.sp = 0;
  return true;
}

// インクバリア: 一時的にダメージ半減＆インク消費率2倍（8秒間）
function tryBarrier(e, state) {
  e.barrierEnd = state.time + 8;
  e.ink = CONFIG.PLAYER.INK;
  e.sp = 0;
  return true;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
