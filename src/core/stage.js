// ステージ定義 v5: 複数ステージ対応（4ステージ × 異なるメタゲーム設計）
// 全構造物は「登れる台」。ジャンプで1段ずつ登る（壁=OBSTACLEは場内に置かない）
import { CONFIG } from './config.js';

const STAGES = {
  // ステージ1: 中央ピラミッド（対称・統一的）
  1: {
    name: 'Pyramid Arena',
    spawns: { 1: { x: 70, y: 360 }, 2: { x: CONFIG.WORLD.W - 70, y: 360 } },
    platforms: [
      [540, 260, 200, 200, 1], [572, 292, 136, 136, 2], [604, 324, 72, 72, 3],
      [170, 270, 120, 180, 1], [196, 308, 68, 104, 2],
      [990, 270, 120, 180, 1], [1016, 308, 68, 104, 2],
      [480, 560, 320, 100, 1],
      [380, 40, 52, 110, 1], [432, 40, 52, 110, 2], [484, 40, 52, 110, 3],
      [536, 40, 52, 110, 4], [588, 40, 52, 110, 5], [640, 40, 52, 110, 6],
      [692, 40, 52, 110, 7], [744, 40, 52, 110, 8], [796, 40, 52, 110, 9],
      [848, 40, 104, 110, 10],
    ],
    // ジャンプ台 [x, y]（v8）: 下の回廊から中央ピラミッド上段へ跳べる
    pads: [[420, 610], [860, 610]],
  },
  // ステージ2: 分散型（左右高台・中央広大・長距離有利）
  2: {
    name: 'Split Peaks',
    spawns: { 1: { x: 100, y: 300 }, 2: { x: CONFIG.WORLD.W - 100, y: 300 } },
    platforms: [
      // 左陣営の見張り塔（L1-L4）
      [80, 200, 60, 200, 1], [100, 240, 60, 120, 2], [120, 280, 50, 80, 3], [130, 310, 40, 60, 4],
      // 右陣営の見張り塔（同上）
      [CONFIG.WORLD.W - 140, 200, 60, 200, 1], [CONFIG.WORLD.W - 160, 240, 60, 120, 2],
      [CONFIG.WORLD.W - 170, 280, 50, 80, 3], [CONFIG.WORLD.W - 180, 310, 40, 60, 4],
      // 中央広大な床（L1）
      [280, 500, 440, 140, 1],
      // 中央奥の島（L2-L3・チャージャー射程に入る）
      [540, 350, 80, 150, 2], [555, 390, 50, 100, 3],
    ],
    pads: [[300, 200], [CONFIG.WORLD.W - 300, 200]], // 自陣から前線へ素早く展開
  },
  // ステージ3: U字形（両端高く・中央低い・近距離戦有利）
  3: {
    name: 'Canyon Cross',
    spawns: { 1: { x: 150, y: 320 }, 2: { x: CONFIG.WORLD.W - 150, y: 320 } },
    platforms: [
      // 左奥ジャングル（複雑・L1-L2）
      [50, 280, 100, 180, 1], [60, 340, 80, 100, 2],
      [140, 300, 70, 160, 1], [155, 360, 50, 80, 2],
      // 右奥ジャングル（同上）
      [CONFIG.WORLD.W - 150, 280, 100, 180, 1], [CONFIG.WORLD.W - 140, 340, 80, 100, 2],
      [CONFIG.WORLD.W - 210, 300, 70, 160, 1], [CONFIG.WORLD.W - 205, 360, 50, 80, 2],
      // 中央低地（戦場・L1）
      [300, 450, 400, 120, 1],
      // 中央奥の川（狭い・L1）
      [500, 520, 80, 100, 1],
    ],
    pads: [[640, 120], [640, 600]], // 中央を縦断する奇襲ルート
  },
  // ステージ4: 迷路型（複雑な構造・視認距離制限・ローラー有利）
  4: {
    name: 'Ink Maze',
    spawns: { 1: { x: 120, y: 450 }, 2: { x: CONFIG.WORLD.W - 120, y: 450 } },
    platforms: [
      // 左側迷路（L1-L3）
      [60, 350, 80, 150, 1], [80, 370, 50, 80, 2], [85, 390, 40, 50, 3],
      [150, 300, 70, 180, 1], [165, 340, 50, 100, 2],
      [220, 380, 80, 120, 1],
      // 右側迷路（対称）
      [CONFIG.WORLD.W - 140, 350, 80, 150, 1], [CONFIG.WORLD.W - 130, 370, 50, 80, 2],
      [CONFIG.WORLD.W - 125, 390, 40, 50, 3],
      [CONFIG.WORLD.W - 220, 300, 70, 180, 1], [CONFIG.WORLD.W - 215, 340, 50, 100, 2],
      [CONFIG.WORLD.W - 300, 380, 80, 120, 1],
      // 中央の柱（回避・リセット用・L1-L4）
      [520, 320, 40, 200, 1], [525, 340, 30, 160, 2], [530, 360, 20, 120, 3], [533, 380, 14, 80, 4],
    ],
  },
};

// 現在のステージを指定（CONFIG から読み込む想定）
export function getCurrentStageId() {
  return CONFIG.STAGE_ID || 1;
}

export function getSpawns() { return STAGES[getCurrentStageId()].spawns; }

export function applyStage(grid) {
  const platforms = STAGES[getCurrentStageId()].platforms;
  for (const [x, y, w, h, level] of platforms) grid.setPlatformRect(x, y, w, h, level);
}

export function obstacleRects() { return []; }
export function platformRects() {
  const platforms = STAGES[getCurrentStageId()].platforms;
  return platforms.map((r) => [...r]);
}

// v8: ジャンプ台。各ステージの pads（無ければ空）
export function jumpPads() {
  return (STAGES[getCurrentStageId()].pads || []).map((p) => [...p]);
}

export function getStageList() { return Object.entries(STAGES).map(([id, s]) => ({ id: parseInt(id), name: s.name })); }
export function setStageId(id) { CONFIG.STAGE_ID = id; }
