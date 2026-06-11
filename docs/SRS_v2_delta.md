# SRS v2 差分 — INK CLASH v2（3D TPS + スマホ特化）

date: 2026-06-11 / 親文書: SRS.md（v1の全Must要件はゲームルールとして維持）

## v2で変わること（ユーザー指示 + 3択承認済み）
- 描画を3D（TPS視点・本物同様の後方視点）に変更
- スマホ特化: 画面上に仮想スティック・ショット/潜行/スペシャルボタン
- GitHub Pagesで無料公開（公開実行は別途明示承認）

## 新規/変更要件

| ID | 要件 | MoSCoW | ACC | TC |
|---|---|---|---|---|
| FR-3D-001 | TPS視点（プレイヤー背後カメラ）で3D描画され、右側ドラッグでカメラ旋回できる | Must | Given 右半面ドラッグ When 横スワイプ Then カメラyawが変化しエイム方向が追従 | TC-FR-3D-001(実機) |
| FR-3D-002 | 塗り・武器・ボット等のゲームロジックはv1の2Dコア（src/core/）を変更せず再利用する | Must | core/のテスト32件が全PASSのまま | TC-NFR-MAINT-001 |
| FR-TOUCH-001 | 左半面タッチで仮想移動スティックが出現し、カメラ相対で移動できる | Must | Given 左半面タッチ＋ドラッグ Then スティックUI表示・移動入力生成 | TC-FR-TOUCH-001(実機+構造検査) |
| FR-TOUCH-002 | ショット・潜行・スペシャルの押下可能ボタンが画面上に常時表示される | Must | 3ボタンがDOMに存在しpointer操作で対応入力が発火 | TC-FR-TOUCH-002(構造検査) |
| FR-TOUCH-003 | PCでも動作する（WASD+マウスドラッグ旋回+クリック射撃） | Should | PC実機確認 | 手動 |
| NFR-DEP-001 | 外部依存はThree.js（MIT・ローカル同梱）のみ。CDN参照・外部API呼び出しなし | Must | vendor/three.min.jsをビルドでインライン化。自作srcにfetch等なし | TC-SEC-001/TC-NFR-COST-001改 |
| NFR-PUB-001 | GitHub Pages公開はユーザーの個別明示承認後のみ実行 | Must | 承認前にpush/公開操作をしない | 運用 |

## NFR-COST-001 の改定
- 旧「依存ゼロ」→ 新「**ランニングコスト¥0**（サーバー・API・課金なし）。依存はローカル同梱のThree.jsのみ許容」
- TC-NFR-COST-001: 外部URL走査の対象は**自作src**とdev*.html（ビルド生成物はvendorコード内のコメントURLを含むため除外）

## アーキテクチャ決定（ADR-006〜008 → SDD反映）
- ADR-006: シミュレーションは2D平面のまま（logic x,y → 3D x,z）。描画層のみThree.js。テスト資産32件を全面温存
- ADR-007: 床の塗り表現は「ペイントグリッド→2D Canvas→THREE.CanvasTexture」のrender-to-texture方式（差分時のみneedsUpdate）
- ADR-008: 配布は単一HTML（three.min.js＋全srcをインライン化）。v1は classic.html として温存
