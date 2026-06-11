# PROGRESS — INK CLASH

date: 2026-06-11 / mode: full_auto / state: v2 VERIFY完了（公開承認待ち）

## v2（3D TPS + スマホ特化）実績 — 2026-06-11
- 承認: Three.jsローカル同梱 / GitHub Pages公開 / TPS視点（3択回答）
- 設計: ADR-006〜008（2Dコア温存・描画のみ3D・render-to-texture・単一HTML配布）
- 新規: src/render3d.js, src/touch.js, src/game3d.js, src/paintcanvas.js, dev3d.html, vendor/three.min.js
- 失敗学習: FP-001（バンドル名衝突）→ build.mjsに機械検知ガード + C-009
- DoD: テスト33/33 PASS / ブラウザ実機4画面確認（タイトル→TPS戦闘→移動→撃破/復活）/ index.html 634.8KB
- 残り: GitHub Pages公開（ユーザー明示承認後・NFR-PUB-001）

---
# 以下はv1の記録
date: 2026-06-11 / mode: full_auto / state: COMPLETE（v1）

## フェーズ実績
| Phase | 状態 | 備考 |
|---|---|---|
| 0 ヒアリング | 完了 | 4択回答（オリジナルIP/2D vsCPU/無料リサーチ/完全自動） |
| 1 リサーチ | 完了 | research_v1/v2（WebSearch・¥0・全Evidence ID付き） |
| 2 SRS | 完了 | Must 16 + Should 2 + Could 1、全Must接続済み |
| 3 SDD | 完了 | ADR-001〜005、依存ゼロ構成 |
| 4 テスト計画 | 完了 | TC 21系統・E2E 6シナリオ |
| 5 レビュー | 完了 | 指摘17件（B4/M8/m5）全Closed → **GO** |
| 6 実装 | 完了 | T-001〜T-010 全done |
| 7 検証 | 完了 | 下記DoD |
| 8 本番移行 | 該当なし | ローカル配布のみ（外部公開なし・承認対象操作なし） |

## DoD（Definition of Done）
- [x] テスト 32/32 PASS（unit 20 + 静的検査6 + E2Eシム6）
- [x] NFR-PERF-001: 180sシム avg/p95 ともに基準内（実測 avg<1ms）
- [x] 機械ゲート: slop_detector AST=CLEAN / preflight CRITICAL=0
- [x] LAW-001: src/index.htmlに任天堂固有名称0件（TC-LAW-001で機械検証）
- [x] ブラウザ実機確認: タイトル→開始→ボット8体塗り合い→タイマー/HUD進行をスクリーンショットで確認
- [x] file://直開き対応（単一ファイルビルド・36.9KB）
- [x] スペックドリフト: SRS数値=config.js=テスト期待値 一致（SD-01/02/03）

## タスク台帳最終状態
T-001〜T-010: すべて done（TASKS.md参照）

## 既知の残作業（任意・DEFER）
- 追加ステージ / 追加武器 / 難易度選択UI（FR-BOT-002のパラメータは実装済・UI未接続）
- 効果音（FR-SND-001 Could・未実装）
