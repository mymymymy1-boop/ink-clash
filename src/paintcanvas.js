// 床塗りテクスチャ: PaintGrid → 2D Canvas（ADR-007: THREE.CanvasTextureの元絵）
import { CONFIG } from './core/config.js';
import { getSpawns } from './core/stage.js';

// 参考画像分析(2026-06-12): 本物は「明るい無彩色の地面 × 超高彩度インク」。
// インクは縁が濃く・中央が明るい立体的なしぶき。
const COLORS = {
  floor: '#cdcac0',          // 明るいコンクリート
  floorLine: 'rgba(0,0,0,.07)',
  ink: { 1: CONFIG.BRANDING.TEAM_COLORS[1], 2: CONFIG.BRANDING.TEAM_COLORS[2] },
  inkDark: { 1: '#b34400', 2: '#007a6c' },   // 縁（濃）
  inkLight: { 1: '#ff852f', 2: '#1ed3bd' },  // ハイライト（彩度維持で少しだけ明）
};

const SCALE = 2; // v3.2: テクスチャ2倍解像度（しぶきの輪郭がくっきり）

export function createPaintCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.WORLD.W * SCALE; canvas.height = CONFIG.WORLD.H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE); // 以降の描画コードは論理座標のまま

  function reset(state) {
    const W = CONFIG.WORLD.W, H = CONFIG.WORLD.H;
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, W, H);
    // コンクリートのタイル目地
    ctx.strokeStyle = COLORS.floorLine; ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // コンクリートの粒（決定論ハッシュ）
    for (let i = 0; i < 900; i++) {
      const h = (i * 2654435761) >>> 0;
      ctx.fillStyle = (h & 1) ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)';
      ctx.fillRect((h % W), ((h >> 11) % H), 2.2, 2.2);
    }
    // スポーンエリアのチームカラーリング（v10: ステージごとのスポーン座標に追従）
    const spawns = getSpawns();
    for (const team of [1, 2]) {
      const sp = spawns[team];
      ctx.strokeStyle = COLORS.ink[team]; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = COLORS.inkDark[team]; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 70, 0, Math.PI * 2); ctx.stroke();
    }
    const g = state.grid;
    for (let i = 0; i < g.cells.length; i++) {
      const v = g.cells[i];
      if (v === 1 || v === 2) paintCell(g, i, v);
    }
    return true;
  }

  function paintCell(g, idx, v) {
    // v3.1: 縁が濃く中央が明るい立体的なしぶき（座標ハッシュで決定論）
    const cx = idx % g.cols, cy = (idx / g.cols) | 0;
    const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
    const px = cx * g.cell + g.cell / 2 + ((h & 3) - 1.5);
    const py = cy * g.cell + g.cell / 2 + (((h >> 2) & 3) - 1.5);
    const r = g.cell * (0.72 + ((h >> 4) & 3) * 0.06);
    // 縁（濃色をひと回り大きく）
    ctx.fillStyle = COLORS.inkDark[v];
    ctx.beginPath(); ctx.arc(px, py, r + 1.6, 0, Math.PI * 2); ctx.fill();
    // 本体
    ctx.fillStyle = COLORS.ink[v];
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    // ハイライト（控えめに・左上寄り）
    if ((h & 15) < 3) {
      ctx.fillStyle = COLORS.inkLight[v];
      ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
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
