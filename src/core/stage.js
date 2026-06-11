// ステージ定義 v3: 左右対称・壁＋高低差（FR-LVL-001）
import { CONFIG } from './config.js';

export const SPAWNS = {
  1: { x: 70, y: 360 },
  2: { x: CONFIG.WORLD.W - 70, y: 360 },
};

// 壁（OBSTACLE: 通行・弾とも遮断）
const WALL_RECTS = [
  [600, 250, 80, 60], [600, 410, 80, 60],          // 中央の2枚壁
  [330, 90, 70, 70], [880, 90, 70, 70],            // 上ルートの遮蔽
  [330, 560, 70, 70], [880, 560, 70, 70],          // 下ルートの遮蔽
];

// 台（PLATFORM: 塗れる・ジャンプで登れる高所）
const PLATFORM_RECTS = [
  [560, 280, 160, 160],                            // 中央タワー（壁2枚の間）
  [180, 280, 110, 160], [990, 280, 110, 160],      // 自陣前の見張り台
  [500, 60, 280, 90], [500, 570, 280, 90],         // 上下の回廊
];

export function applyStage(grid) {
  for (const [x, y, w, h] of WALL_RECTS) grid.setObstacleRect(x, y, w, h);
  for (const [x, y, w, h] of PLATFORM_RECTS) grid.setPlatformRect(x, y, w, h, 1);
}

export function obstacleRects() { return WALL_RECTS.map((r) => [...r]); }
export function platformRects() { return PLATFORM_RECTS.map((r) => [...r]); }
