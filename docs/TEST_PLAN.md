# TEST_PLAN — INK CLASH（IEEE 829準拠・簡約版）

実行: `node --test tests/`（Node18+標準のみ）。カバレッジ目標: core 80%以上（Must要件接続分は100%）。

## テストケース ↔ 要件トレーサビリティ（Must全件接続）

| TC | 対象 | 内容 | 種別 |
|---|---|---|---|
| TC-FR-MATCH-001 | FR-MATCH-001 | time=0で勝敗判定・%算出が正しい | unit |
| TC-FR-MATCH-002 | FR-MATCH-002 | 塗り返しでカウントが移動する | unit |
| TC-FR-MATCH-003 | FR-MATCH-003 | 障害物セルは塗れず母数除外 | unit |
| TC-FR-PAINT-001 | FR-PAINT-001 | 着弾半径内セルがチーム色になる | unit |
| TC-FR-INK-001 | FR-INK-001 | インク不足で発射されない | unit |
| TC-FR-INK-002 | FR-INK-002 | 自インクスイムで+12%/s・1.8x | unit |
| TC-FR-INK-003 | FR-INK-003 | 敵インクで0.4x・10/s（30下限） | unit |
| TC-FR-WPN-001 | FR-WPN-001 | シューター連射間隔/dmg/射程/消費 | unit |
| TC-FR-WPN-002 | FR-WPN-002 | ローラー轢き塗り・振り100dmg | unit |
| TC-FR-WPN-003 | FR-WPN-003 | フルチャージ射程520/100dmg・半チャージ40 | unit |
| TC-FR-DMG-001 | FR-DMG-001 | スプラット→3s後リスポーン(HP/インク全回復) | unit |
| TC-FR-SP-001 | FR-SP-001 | SP150で発動可・発動でインク100/SP0/範囲塗り | unit |
| TC-FR-BOT-001 | FR-BOT-001 | 3状態遷移（射程内→FIGHT、HP<30→RETREAT、他→PAINT） | unit |
| TC-FR-BOT-002 | FR-BOT-002 | 難易度でエイム誤差・遅延が変化 | unit |
| TC-FR-UI-001 | FR-UI-001 | hud.js純関数の出力（時間/インク/SP/塗り率バー）を自動検証（REV-R1-008） | unit |
| TC-FR-UI-002/003 | FR-UI-002/003 | キー操作・武器選択（ブラウザ手動確認＋入力マッピング構造検査） | E2E(手動)+unit |
| TC-NFR-PERF-001 | NFR-PERF-001 | 180sシミュレーションのtick平均<33ms かつ p95<50ms（REV-R1-007） | e2e(sim) |
| TC-NFR-PORT-001 | NFR-PORT-001 | index.htmlがfetch/CDN参照を含まない（静的検査） | unit |
| TC-NFR-COST-001 | NFR-COST-001 | 依存0（package.json/外部URL走査） | unit |
| TC-NFR-MAINT-001 | NFR-MAINT-001 | core全モジュールがNodeでimport可能 | unit |
| TC-SEC-001 | SEC-001 | eval/Function/外部送信コードなし（静的走査） | unit |
| TC-LAW-001 | LAW-001 | src/index.htmlに任天堂固有名称なし（静的走査） | unit |

## 境界値方針
インク0/100、HP30境界、グリッド端(0,159/0,89)、time=0、SP=149/150、チャージ0/半/フルを必ず含める。

## E2E（シミュレーション）
docs/E2E_SCENARIOS.md の6シナリオを `tests/e2e/e2e.test.mjs` がheadlessで実行（MatchStateを直接駆動・描画なし）。
