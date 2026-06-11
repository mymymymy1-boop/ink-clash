// 床塗りテクスチャ: PaintGrid → 2D Canvas（ADR-007: THREE.CanvasTextureの元絵）
import { CONFIG } from './core/config.js';

const COLORS = {
  floor: '#3a3a46',
  ink: { 1: CONFIG.BRANDING.TEAM_COLORS[1], 2: CONFIG.BRANDING.TEAM_COLORS[2] },
  inkDark: { 1: '#cc5212', 2: '#00937f' },
};

export function createPaintCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.WORLD.W; canvas.height = CONFIG.WORLD.H;
  const ctx = canvas.getContext('2d');

  function reset(state) {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 床のうっすらグリッド模様（視認性向上）
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    const g = state.grid;
    for (let i = 0; i < g.cells.length; i++) {
      const v = g.cells[i];
      if (v === 1 || v === 2) paintCell(g, i, v);
    }
    return true;
  }

  function paintCell(g, idx, v) {
    const cx = idx % g.cols, cy = (idx / g.cols) | 0;
    const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
    ctx.fillStyle = (h & 7) < 2 ? COLORS.inkDark[v] : COLORS.ink[v];
    ctx.fillRect(cx * g.cell, cy * g.cell, g.cell, g.cell);
  }

  // 差分反映。塗り更新があれば true（→ texture.needsUpdate）
  function applyDirty(state) {
    const g = state.grid;
    const dirty = g.consumeDirty();
    for (const idx of dirty) {
      const v = g.cells[idx];
      if (v === 1 || v === 2) paintCell(g, idx, v);
    }
    return dirty.length > 0;
  }

  return { canvas, reset, applyDirty };
}
