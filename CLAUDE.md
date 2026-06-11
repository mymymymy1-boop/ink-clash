# INK CLASH — プロジェクトCLAUDE.md

## 概要
2Dブラウザ・インク塗り対戦シューター（1人用 vs CPUボット・4v4）。ランニングコスト¥0・依存ゼロ・file://直開きで動作。spec-driven-autobuild v2.2 で構築。

## 絶対ルール
1. 任天堂の名称・キャラ・ロゴ・音源を一切含めない（LAW-001）。タイトルは INK CLASH、キャラは「ペイントボット」。
2. npm依存・外部API・外部送信を追加しない（NFR-COST-001 / SEC-001）。
3. ゲームロジックは `src/core/` の純粋モジュールに置き、DOM/canvasは `src/game.js` / `src/render.js` のみ（ADR-002）。
4. バランス定数は `src/core/config.js` が単一の正。マジックナンバー散在禁止。
5. 乱数は `rng.js` のシード可能乱数のみ使用（Math.random直呼び禁止・ADR-004）。

## コマンド
- テスト: `node --test tests/` （Node 18+、外部パッケージ不要）
- 起動: `index.html` をブラウザで開く（Chrome/Edge推奨）

## 文書の正
- 要件: docs/SRS.md / 設計: docs/SDD.md / テスト: docs/TEST_PLAN.md / 制約: CONSTRAINTS.md
- 仕様変更時は SRS/SDD/TEST_PLAN も同時更新（黄金ルール#6）

## 主要数値（config.jsと一致させる）
- 試合180s / グリッド160x90セル(8px) / HP100 / インク100% / SP150pt
- シューター: 100ms/36dmg/260px/1%消費。ローラー: 600ms振り/100dmg/轢き塗り/8%。チャージャー: 1.2s/100dmg/520px/18%
- 敵インク上: 速度40%・10dmg/s(HP30下限) / 自インクスイム: 速度1.8x・回復12%/s
