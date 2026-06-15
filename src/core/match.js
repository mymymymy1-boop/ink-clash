// MatchState統括（FR-MATCH-001/002/003, DATA-004, C-005）
import { CONFIG } from './config.js';
import { PaintGrid } from './grid.js';
import { createEntity, updateEntity, NO_INPUT } from './entities.js';
import { updateWeapon, updateBullets } from './weapons.js';
import { trySpecial } from './special.js';
import { applyStage, getSpawns } from './stage.js';
import { createBotMemory, botThink } from './bots.js';
import { mulberry32 } from './rng.js';

const BOT_WEAPONS = ['shooter', 'roller', 'charger', 'slosher', 'spinner', 'blaster']; // v3: 6種

export function createMatch({ seed = 1, playerWeapon = 'shooter', difficulty = CONFIG.BOT.DEFAULT, playerAuto = false } = {}) {
  const g = CONFIG.GRID;
  const grid = new PaintGrid(g.COLS, g.ROWS, g.CELL);
  applyStage(grid);

  const entities = [];
  const botMems = new Map();
  const spawns = getSpawns();
  for (const team of [1, 2]) {
    const s = spawns[team];
    for (let i = 0; i < CONFIG.MATCH.TEAM_SIZE; i++) {
      const isPlayer = team === 1 && i === 0 && !playerAuto;
      const id = `${team === 1 ? 'A' : 'B'}${i + 1}`;
      const weaponKind = i === 0 ? (team === 1 ? playerWeapon : 'shooter') : BOT_WEAPONS[(i - 1) % BOT_WEAPONS.length];
      const e = createEntity({
        id, team,
        x: s.x, y: s.y - 90 + i * 60,
        weaponKind, isPlayer,
      });
      e.spawnY = e.y;
      e.aimX = team === 1 ? 1 : -1; e.aimY = 0;
      entities.push(e);
      if (!isPlayer) botMems.set(id, createBotMemory());
    }
  }

  return {
    time: CONFIG.MATCH.DURATION, phase: 'PLAY',
    grid, entities, bullets: [], botMems,
    rng: mulberry32(seed), difficulty, playerAuto,
    result: null,
    events: [], // v3: 1tick分の効果音/エフェクト用イベント
  };
}

export function tick(state, playerInput = NO_INPUT, dt = 1 / 60) {
  if (state.phase !== 'PLAY') return; // C-005: RESULT後は状態不変
  if (state.events) state.events.length = 0; // v3: イベントは1tickで消費

  for (const e of state.entities) {
    const input = e.isPlayer ? playerInput : botThink(e, botMem(state, e), state, state.rng, dt);
    updateEntity(e, input, state.grid, dt);
    if (e.justJumped) state.events?.push({ type: 'jump', x: e.x, y: e.y, team: e.team });
    if (e.state === 'ALIVE') {
      if (input.special && trySpecial(e, state)) state.events?.push({ type: 'special', x: e.x, y: e.y, team: e.team });
      updateWeapon(e, input, state, dt);
    }
  }
  updateBullets(state, dt);

  state.time -= dt;
  if (state.time <= 0) finalize(state);
}

function botMem(state, e) {
  let m = state.botMems?.get?.(e.id);
  if (!m) {
    if (!state.botMems) state.botMems = new Map();
    m = createBotMemory(); state.botMems.set(e.id, m);
  }
  return m;
}

// 終了時点の塗り状態のみで判定（FR-MATCH-001/002）
function finalize(state) {
  state.time = 0;
  state.bullets.length = 0;
  const r = state.grid.ratios();
  const a = r[1], b = r[2];
  state.result = {
    winner: a > b ? 1 : b > a ? 2 : 0, // 0=引き分け
    pctA: a, pctB: b,
    countA: state.grid.counts[1], countB: state.grid.counts[2],
  };
  state.phase = 'RESULT';
}
