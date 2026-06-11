// ステージ定義: 左右対称マップ（SDD stage.js）
import { CONFIG } from './config.js';

export const SPAWNS = {
  1: { x: 70, y: 360 },
  2: { x: CONFIG.WORLD.W - 70, y: 360 },
};

// 障害物矩形（px）。中央ブロック+対称4ブロック
const RECTS = [
  [590, 300, 100, 120],
  [380, 140, 96, 72], [804, 140, 96, 72],
  [380, 508, 96, 72], [804, 508, 96, 72],
  [240, 320, 64, 80], [976, 320, 64, 80],
];

export function applyStage(grid) {
  for (const [x, y, w, h] of RECTS) grid.setObstacleRect(x, y, w, h);
}

export function obstacleRects() { return RECTS.map((r) => [...r]); }
