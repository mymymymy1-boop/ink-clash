// 描画層: グリッド差分→オフスクリーン→メイン（ADR-003 / EV-TECH-002/003）
import { CONFIG } from './core/config.js';
import { OBSTACLE } from './core/grid.js';
import { obstacleRects, platformRects } from './core/stage.js';

const COLORS = {
  floor: '#23232c',
  obstacle: '#474757',
  obstacleEdge: '#5d5d70',
  ink: { 1: CONFIG.BRANDING.TEAM_COLORS[1], 2: CONFIG.BRANDING.TEAM_COLORS[2] },
  inkDark: { 1: '#cc5212', 2: '#00937f' },
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  off.width = CONFIG.WORLD.W; off.height = CONFIG.WORLD.H;
  const offCtx = off.getContext('2d');

  function reset(state) {
    offCtx.fillStyle = COLORS.floor;
    offCtx.fillRect(0, 0, off.width, off.height);
    drawObstacles();
    // 既存塗りの全反映（リスタート時）
    const g = state.grid;
    for (let i = 0; i < g.cells.length; i++) {
      const v = g.cells[i];
      if (v === 1 || v === 2) paintCell(g, i, v);
    }
  }

  function drawObstacles() {
    // v3の台（2D版では明色の床として表示。塗りは上書きされる）
    for (const [x, y, w, h] of platformRects()) {
      offCtx.fillStyle = '#3f3f52';
      offCtx.fillRect(x, y, w, h);
      offCtx.strokeStyle = '#54546c';
      offCtx.lineWidth = 2;
      offCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
    for (const [x, y, w, h] of obstacleRects()) {
      offCtx.fillStyle = COLORS.obstacle;
      offCtx.fillRect(x, y, w, h);
      offCtx.strokeStyle = COLORS.obstacleEdge;
      offCtx.lineWidth = 3;
      offCtx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    }
  }

  function paintCell(g, idx, v) {
    const cx = idx % g.cols, cy = (idx / g.cols) | 0;
    // セル位置で色味を僅かに揺らす（決定論: 座標ハッシュ）
    const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
    offCtx.fillStyle = (h & 7) < 2 ? COLORS.inkDark[v] : COLORS.ink[v];
    offCtx.fillRect(cx * g.cell, cy * g.cell, g.cell, g.cell);
  }

  function applyDirty(state) {
    const g = state.grid;
    for (const idx of g.consumeDirty()) {
      const v = g.cells[idx];
      if (v === 1 || v === 2) paintCell(g, idx, v);
      else if (v === OBSTACLE) continue;
    }
  }

  function draw(state, playerId) {
    applyDirty(state);
    ctx.drawImage(off, 0, 0);
    // 弾
    for (const b of state.bullets) {
      ctx.fillStyle = COLORS.ink[b.team];
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(4, b.paintR * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    // キャラ（ペイントボット）
    for (const e of state.entities) {
      if (e.state === 'SPLATTED') { drawGhost(e); continue; }
      drawBot(e, e.id === playerId, state);
    }
  }

  function drawBot(e, isPlayer, state) {
    const r = CONFIG.PLAYER.RADIUS;
    const col = COLORS.ink[e.team];
    const onOwn = state.grid.valueAt(e.x, e.y) === e.team;
    const blink = e.invulnT > 0 && Math.floor(e.invulnT * 10) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.4;
    if (e.swimming && onOwn) {
      // 潜行形態: 波紋
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.15, 0, Math.PI * 2); ctx.globalAlpha *= 0.45; ctx.stroke();
    } else {
      // 本体
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
      // ノズル（エイム方向）
      ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x + e.aimX * r * 0.5, e.y + e.aimY * r * 0.5);
      ctx.lineTo(e.x + e.aimX * (r + 7), e.y + e.aimY * (r + 7));
      ctx.stroke();
      // 目
      ctx.fillStyle = '#101016';
      const px = -e.aimY, py = e.aimX;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + e.aimX * 4 + px * s * 5, e.y + e.aimY * 4 + py * s * 5, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // HPリング
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 4, -Math.PI / 2, -Math.PI / 2 + (e.hp / 100) * Math.PI * 2);
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawGhost(e) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#9aa';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('×', e.x, e.y + 6);
    ctx.restore();
  }

  return { reset, draw };
}
