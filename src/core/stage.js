// ステージ定義 v4: 左右対称・多層地形（FR-LVL-001 / 最大10段）
// 全構造物は「登れる台」。ジャンプで1段ずつ登る（壁=OBSTACLEは場内に置かない）
import { CONFIG } from './config.js';

export const SPAWNS = {
  1: { x: 70, y: 360 },
  2: { x: CONFIG.WORLD.W - 70, y: 360 },
};

// [x, y, w, h, level] — 後勝ちで上書き（高い段を後に書く）
const PLATFORM_RECTS = [
  // 中央ピラミッド（3段・頂上L3=60）
  [540, 260, 200, 200, 1],
  [572, 292, 136, 136, 2],
  [604, 324, 72, 72, 3],

  // 自陣前の見張り台（2段）
  [170, 270, 120, 180, 1], [196, 308, 68, 104, 2],
  [990, 270, 120, 180, 1], [1016, 308, 68, 104, 2],

  // 下の回廊（L1）と上り口
  [480, 560, 320, 100, 1],

  // ★大階段タワー（北側・L1→L10=200、頂上から全マップを見渡せる）
  [380, 40, 52, 110, 1], [432, 40, 52, 110, 2], [484, 40, 52, 110, 3],
  [536, 40, 52, 110, 4], [588, 40, 52, 110, 5], [640, 40, 52, 110, 6],
  [692, 40, 52, 110, 7], [744, 40, 52, 110, 8], [796, 40, 52, 110, 9],
  [848, 40, 104, 110, 10],
];

export function applyStage(grid) {
  for (const [x, y, w, h, level] of PLATFORM_RECTS) grid.setPlatformRect(x, y, w, h, level);
}

export function obstacleRects() { return []; } // v4: 場内に登れない壁は無し
export function platformRects() { return PLATFORM_RECTS.map((r) => [...r]); }
