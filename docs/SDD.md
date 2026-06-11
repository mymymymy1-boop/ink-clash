# SDD — INK CLASH v1.0（IEEE 1016準拠・簡約版）

date: 2026-06-11

## 1. 設計方針（ADR）
- ADR-001: **Vanilla JS + Canvas 2D、依存ゼロ**。理由: NFR-COST-001（¥0）・NFR-PORT-001（file://直開き）。Phaser等は不採用（CDN依存=オフライン不可・依存増）。
- ADR-002: **ロジックと描画の完全分離**。`src/core/`はDOM非依存の純粋ESモジュール（node:testで検証可能=NFR-MAINT-001）。`src/game.js`のみがcanvas/DOMを触る。
- ADR-003: **塗りの正はPaintGrid（Uint8Array, セル8px, 160x90）**。描画はdirtyセルのみオフスクリーンcanvasへ差分反映（D-001, RISK-001）。
- ADR-004: 乱数は全てシード可能な`mulberry32`を注入（テスト決定論性確保）。
- ADR-005: ゲームループは固定タイムステップ（dt=1/60s）の`update(state, input, dt)`純関数群＋requestAnimationFrame描画。

## 2. 論理ビュー（モジュール構成）

```
index.html            … エントリ（canvas+HUD DOM、ESM読み込み）
src/
  core/
    rng.js            … mulberry32シード乱数
    grid.js           … PaintGrid: paint(x,y,r,team), counts(), 障害物, 差分リスト  → FR-PAINT-001/MATCH-002/003
    config.js         … 全バランス定数（D-002/D-005の数値の単一の正）
    entities.js       … Player/Bot共通: 移動・HP・インク・スイム・被弾・リスポーン → FR-INK-*/DMG-001
    weapons.js        … 3武器の発射・弾(2D直進・**障害物セル到達で消滅し塗りなし**=REV-R1-003)・轢き塗り → FR-WPN-001/002/003
    special.js        … SPゲージ加算(塗りセル数連動)・インクストーム(帯48x320px・敵40dmg)発動 → FR-SP-001
    bots.js           … 3状態AI(PAINT/FIGHT/RETREAT)+難易度。**移動=ステアリング方式: 目標セルへ直進＋前方レイキャストで障害物検知→接線方向回避＋2s位置不変のスタック検知→目標再抽選**（REV-R1-102） → FR-BOT-001/002
    hud.js            … HUD表示文字列/バー値の純関数生成（DOM非依存・構造検査可能=REV-R1-008） → FR-UI-001
    match.js          … MatchState: timer180s・update統括・勝敗判定               → FR-MATCH-001
    stage.js          … ステージ定義（障害物配置・リスポーン地点・対称マップ）
  game.js             … ブラウザ統括: 入力・ループ・HUD・タイトル/リザルト画面     → FR-UI-001/002/003
  render.js           … 描画: グリッド差分→offscreen→main、キャラ・弾・エフェクト
tests/
  unit/ *.test.mjs    … core各モジュール（node:test）
  e2e/ e2e.test.mjs   … MatchStateを180s分headless実行するシミュレーションE2E
```

## 3. データモデル
- DATA-001 `PaintGrid`: `cells: Uint8Array(160*90)` 値: 0=未塗 1=チームA 2=チームB 255=障害物。`countA/countB`は増分維持（O(1)参照）。
- DATA-002 `Entity`: `{id, team, x, y, hp(0-100), ink(0-100), sp(0-150), weapon, state: ALIVE|SPLATTED, respawnTimer, swimming, aim}`
- DATA-003 `Bullet`: `{team, x, y, vx, vy, dmg, paintR, range, traveled, type}`
- DATA-004 `MatchState`: `{time(180→0), grid, entities[8], bullets[], phase: TITLE|PLAY|RESULT, result}`

## 4. プロセスビュー（1tick）
```
input → entities更新(移動/スイム/地形効果FR-INK-002/003。スイム中は射撃・チャージ不可=REV-R1-002)
      → 武器発射(インク消費チェックFR-INK-001) → bullets前進(障害物セルで消滅)・着弾→grid.paint→SP加算
      → ローラー轢き塗り → 被弾判定→スプラット/リスポーンFR-DMG-001
      → ボットAI(bots.js) → timer減算 → time<=0で勝敗集計FR-MATCH-001
```

## 5. 外部IF
なし（外部API・送信ゼロ＝SEC-001/NFR-COST-001。アダプタ/DRY_RUN設計は対象外＝該当なしを明記）。

## 6. セキュリティ/法務設計
- eval/Function/innerHTML(ユーザー入力)不使用（SEC-001）。
- 全名称・色はconfig.jsの`BRANDING`に集約しオリジナル値のみ（LAW-001, RISK-004）: タイトル"INK CLASH"、チーム色 #FF6B1A/#00B8A9、キャラ="ペイントボット"（円形+目の無機質デザイン）。

## 7. トレーサビリティ
全FR→モジュール→TC: §2の対応コメント参照。TEST_PLAN.mdのマトリクスが正。
