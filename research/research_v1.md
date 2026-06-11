# Research V1 — INK CLASH（インク塗り対戦シューター）

date: 2026-06-11 / 方式: research-system-free 相当（WebSearch+WebFetch・¥0・APIキー不要）
BUILD_TARGET: 2Dブラウザ・1人用 vs CPUボットのインク塗り対戦ゲーム（オリジナルIP・ランニングコスト¥0）

## 信頼度凡例
A=一次ソース(任天堂公式) / B=大手攻略Wiki・MDN等の準公式 / C=個人ブログ / D=推測

---

## 1. 参照ジャンルのコアルール（ナワバリバトル型）

| ID | 事実 | 信頼度 | ソース |
|---|---|---|---|
| EV-RULE-001 | 2チームに分かれ地面を塗り合い、**試合終了時点**で塗り面積が広いチームが勝ち。試合時間は**3分** | A/B | https://www.nintendo.com/jp/games/feature/splatoonqa/battle/nawabari/index.html / https://wikiwiki.jp/splatoon3mix/ナワバリバトル |
| EV-RULE-002 | 「試合中に塗った総面積」ではなく「終了時に塗れている面積」で判定。塗り返し可能 | B | https://game8.jp/splatoon3/485632 |
| EV-RULE-003 | 壁は塗れるが面積カウント対象外。キル数/デス数は勝敗に影響しない | B | https://wikiwiki.jp/splatoon3mix/ナワバリバトル |

## 2. インク機構

| ID | 事実 | 信頼度 | ソース |
|---|---|---|---|
| EV-INK-001 | インクタンクは攻撃停止でゆっくり回復、**自陣色インクの中をスイム（イカ移動）で高速回復** | B | https://splatoonwiki.org/wiki/Ink_tank |
| EV-INK-002 | 自陣色インク内のスイムは高速移動・静止でほぼ不可視 | A/B | https://splatoon.nintendo.com/en/gameplay/ |
| EV-INK-003 | **敵インクの上では移動が遅くなり、継続ダメージ（ただしそれ単独では倒れない）** | B | https://splatoonwiki.org/wiki/Ink |

## 3. 武器種

| ID | 事実 | 信頼度 | ソース |
|---|---|---|---|
| EV-WPN-001 | 主要武器種: シューター（連射・万能）/ ローラー（近接・一撃・轢き塗り）/ チャージャー（長射程・チャージ式）ほか | B | https://gamewith.jp/splatoon3/362924 / https://altema.jp/splatoon3/shooterlist |
| EV-WPN-002 | ローラーは1発キル可能だが攻撃モーションが遅い。チャージャーはチャージ時間と引き換えに長射程 | B | https://altema.jp/splatoon3/chargerlist |

## 4. スペシャル機構

| ID | 事実 | 信頼度 | ソース |
|---|---|---|---|
| EV-SP-001 | 塗りポイント（地面・敵ナワバリを塗る）でスペシャルゲージが溜まる。壁塗りは対象外 | B | https://game8.jp/splatoon3/480127 |
| EV-SP-002 | 必要ポイントは武器ごとに異なる（例: 180〜200pt）。**発動時インクタンク全回復** | B | https://wikiwiki.jp/splatoon3mix/ブキ/スペシャルウェポン |

## 5. 技術候補（実装スタック）

| ID | 事実 | 信頼度 | ソース |
|---|---|---|---|
| EV-TECH-001 | Canvas+ImageData(Uint8ClampedArray)でピクセル単位の塗り判定・カウントが可能 | B | https://www.thecodingcouple.com/counting-pixels-in-the-browser-with-the-html5-canvas-and-the-imagedata-object/ |
| EV-TECH-002 | 毎フレーム同じ描画はオフスクリーンcanvasに分離すると大幅に高速化 | B | https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas |
| EV-TECH-003 | 変化したピクセルのみ再描画する差分更新が定石 | B | https://web.dev/articles/canvas-performance |

## 6. 法務・規約

| ID | 事実 | 信頼度 | 備考 |
|---|---|---|---|
| EV-LAW-001 | 任天堂のキャラ・名称・ロゴ・BGM等の複製は著作権/商標権侵害リスク。**ゲームルール（メカニクス）自体は著作権保護の対象外**が原則 | B | 一般法理。本作は名称・キャラ・配色・UI全てオリジナルで構成（ユーザー承認済み） |

## 7. コスト構造（¥0方針の根拠）

- 実装: Vanilla JS + Canvas 2D（ライブラリ・ビルドツール不要）→ 依存¥0
- 実行: ブラウザでindex.htmlを開くだけ。サーバー不要 → ランニング¥0
- テスト: Node.js標準 `node:test`（外部パッケージ不要）→ ¥0
- 唯一のコスト: 本セッションのClaudeトークン（既存プラン内）

## 8. 未解決点（V2で確定させる）

1. 塗り面積判定の実装方式（フルピクセル走査 vs 低解像度グリッド）
2. 武器3種の具体パラメータ（射程・連射・ダメージ・インク消費）
3. CPUボットのAI方式
4. 1人用での「4v4感」の再現方法（ボット編成）
