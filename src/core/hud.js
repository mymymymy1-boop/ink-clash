// HUDモデル: DOM非依存の純関数（FR-UI-001, REV-R1-008）
import { CONFIG } from './config.js';

export function hudModel(state, playerId = 'A1') {
  const p = state.entities.find((e) => e.id === playerId) || state.entities[0];
  const r = state.grid.ratios();
  const t = Math.max(0, Math.ceil(state.time));
  const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  return {
    timeText: `${mm}:${ss}`,
    inkPct: Math.round(p.ink),
    hpPct: Math.round(p.hp),
    spPct: Math.round((p.sp / CONFIG.SP.MAX) * 100),
    spReady: p.sp >= CONFIG.SP.MAX,
    ratioA: r[1], ratioB: r[2],
    ratioAText: `${(r[1] * 100).toFixed(1)}%`,
    ratioBText: `${(r[2] * 100).toFixed(1)}%`,
    phase: state.phase,
    splatted: p.state === 'SPLATTED',
    respawnIn: p.state === 'SPLATTED' ? Math.ceil(p.respawnT) : 0,
    result: state.result,
  };
}
