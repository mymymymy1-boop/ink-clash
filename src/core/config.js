// バランス定数の単一の正（CLAUDE.md / SRS D-002・D-005 と一致させる）
export const CONFIG = {
  WORLD: { W: 1280, H: 720 },
  GRID: { CELL: 8, COLS: 160, ROWS: 90 },
  MATCH: { DURATION: 180, TEAM_A: 1, TEAM_B: 2, TEAM_SIZE: 4 },
  PLAYER: {
    HP: 100, INK: 100, SPEED: 150, RADIUS: 13,
    SWIM_MULT: 1.8,            // FR-INK-002
    ENEMY_INK_MULT: 0.4,       // FR-INK-003
    ENEMY_INK_DPS: 10,         // FR-INK-003
    ENEMY_INK_HP_FLOOR: 30,    // C-003
    SWIM_RECOVER: 12,          // %/s FR-INK-002
    NATURAL_RECOVER: 3,        // %/s（非射撃時）
    RESPAWN_TIME: 3,           // FR-DMG-001
    INVULN_TIME: 1.5,          // FR-DMG-001 (REV-R1-009)
  },
  SP: {
    MAX: 150,                  // FR-SP-001 (C-006: >=150で発動)
    PER_CELL: 0.5,             // 新規塗りセル1つ=0.5pt
    STORM_W: 48, STORM_LEN: 320, STORM_DMG: 40, // REV-R1-105
  },
  WEAPONS: {
    shooter: { // FR-WPN-001
      kind: 'shooter', name: 'ラピッドシューター',
      interval: 0.1, dmg: 36, range: 260, inkCost: 1.0,
      bulletSpeed: 600, paintR: 18, dropletEvery: 48,
    },
    roller: { // FR-WPN-002
      kind: 'roller', name: 'ペイントローラー',
      swingInterval: 0.6, swingDmg: 100, swingRange: 90,
      inkCostSwing: 8, trailW: 24, inkCostTrail: 1.2, // %/s 轢き塗り中
      swingPaintR: 44,
    },
    charger: { // FR-WPN-003 (REV-R1-005)
      kind: 'charger', name: 'レーザーチャージャー',
      chargeTime: 1.2, fullDmg: 100, partialDmg: 40,
      maxRange: 520, rangeBase: 0.35, // 射程=maxRange*(0.35+0.65c)
      inkCostFull: 18, chargeSpeedMult: 0.5,
      bulletSpeed: 1400, paintR: 12, dropletEvery: 40,
    },
  },
  BOT: { // FR-BOT-001/002 (REV-R1-006/102)
    DIFFICULTIES: {
      EASY: { aimErr: 0.35, reactDelay: 0.8 },
      NORMAL: { aimErr: 0.18, reactDelay: 0.4 },
      HARD: { aimErr: 0.06, reactDelay: 0.15 },
    },
    DEFAULT: 'NORMAL',
    DETECT_MULT: 1.2, STUCK_TIME: 2, RAY_AHEAD: 40, REPATH_TIME: 4,
  },
  BRANDING: { // LAW-001 / W-001: 全てオリジナル
    TITLE: 'INK CLASH',
    TEAM_COLORS: { 1: '#FF6B1A', 2: '#00B8A9' },
    TEAM_NAMES: { 1: 'オレンジ', 2: 'ティール' },
    CHAR_NAME: 'ペイントボット',
  },
};
