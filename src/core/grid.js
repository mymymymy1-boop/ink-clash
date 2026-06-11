// PaintGrid — 塗り状態の単一の正（ADR-003 / DATA-001）
// 値: 0=未塗 1=チームA 2=チームB 255=障害物
export const EMPTY = 0;
export const OBSTACLE = 255;

export class PaintGrid {
  constructor(cols, rows, cell) {
    this.cols = cols; this.rows = rows; this.cell = cell;
    this.cells = new Uint8Array(cols * rows);
    this.levels = new Uint8Array(cols * rows); // v3: 高さレベル(0=地面,1=台)
    this.counts = { 1: 0, 2: 0 };
    this.obstacleCount = 0;
    this.dirty = []; // 差分セルindex（renderer向け）
  }

  idx(cx, cy) { return cy * this.cols + cx; }
  inBounds(cx, cy) { return cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows; }

  // ピクセル座標→セル値。範囲外はOBSTACLE扱い（C-004: 範囲外アクセス防止）
  valueAt(px, py) {
    const cx = Math.floor(px / this.cell), cy = Math.floor(py / this.cell);
    if (!this.inBounds(cx, cy)) return OBSTACLE;
    return this.cells[this.idx(cx, cy)];
  }

  isObstacleAt(px, py) { return this.valueAt(px, py) === OBSTACLE; }

  // v3: セルの高さレベル（範囲外=0）
  levelAt(px, py) {
    const cx = Math.floor(px / this.cell), cy = Math.floor(py / this.cell);
    if (!this.inBounds(cx, cy)) return 0;
    return this.levels[this.idx(cx, cy)];
  }

  setPlatformRect(px, py, w, h, level = 1) { // 台（塗れる・登れる高所）
    const c0 = Math.floor(px / this.cell), r0 = Math.floor(py / this.cell);
    const c1 = Math.ceil((px + w) / this.cell), r1 = Math.ceil((py + h) / this.cell);
    for (let cy = r0; cy < r1; cy++) for (let cx = c0; cx < c1; cx++) {
      if (this.inBounds(cx, cy)) this.levels[this.idx(cx, cy)] = level;
    }
  }

  setObstacleRect(px, py, w, h) { // ステージ構築用（ピクセル矩形）
    const c0 = Math.floor(px / this.cell), r0 = Math.floor(py / this.cell);
    const c1 = Math.ceil((px + w) / this.cell), r1 = Math.ceil((py + h) / this.cell);
    for (let cy = r0; cy < r1; cy++) for (let cx = c0; cx < c1; cx++) {
      if (!this.inBounds(cx, cy)) continue;
      const i = this.idx(cx, cy);
      if (this.cells[i] !== OBSTACLE) {
        if (this.cells[i] === 1) this.counts[1]--;
        if (this.cells[i] === 2) this.counts[2]--;
        this.cells[i] = OBSTACLE; this.obstacleCount++;
      }
    }
  }

  // 円形塗り。新規に自チーム色になったセル数を返す（SP加算用）。
  // 障害物は塗らない（FR-MATCH-003）。塗り返しはカウント移動（FR-MATCH-002）。
  paintCircle(px, py, r, team) {
    let newly = 0;
    const c = this.cell;
    const c0 = Math.max(0, Math.floor((px - r) / c)), c1 = Math.min(this.cols - 1, Math.floor((px + r) / c));
    const r0 = Math.max(0, Math.floor((py - r) / c)), r1 = Math.min(this.rows - 1, Math.floor((py + r) / c));
    const r2 = r * r;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const dx = cx * c + c / 2 - px, dy = cy * c + c / 2 - py;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.idx(cx, cy);
        const v = this.cells[i];
        if (v === OBSTACLE || v === team) continue;
        if (v === 1 || v === 2) this.counts[v]--;
        this.cells[i] = team; this.counts[team]++;
        this.dirty.push(i);
        newly++;
      }
    }
    return newly;
  }

  paintableTotal() { return this.cols * this.rows - this.obstacleCount; }

  ratios() { // 塗り率（母数=塗り可能セル FR-MATCH-003）
    const t = this.paintableTotal();
    return { 1: this.counts[1] / t, 2: this.counts[2] / t };
  }

  // C-001検証用: counts整合
  recount() {
    const n = { 1: 0, 2: 0, obstacle: 0, empty: 0 };
    for (const v of this.cells) {
      if (v === 1) n[1]++; else if (v === 2) n[2]++;
      else if (v === OBSTACLE) n.obstacle++; else n.empty++;
    }
    return n;
  }

  consumeDirty() { const d = this.dirty; this.dirty = []; return d; }
}
