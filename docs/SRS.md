# SRS — INK CLASH v1.0（IEEE 29148準拠・簡約版）

date: 2026-06-11 / 状態: Approved（Phase 5 GO後に実装）

## 1. 目的・スコープ
- OBJ-001: ナワバリバトル型の「塗り合い対戦」の遊びをPCブラウザで¥0再現する（根拠: EV-RULE-001〜003）
- USR-001: 本人（PCでカジュアルに遊ぶ・Splatoon経験者）
- IN: 2D見下ろし・1人用4v4（味方3/敵4ボット）・武器3種・スペシャル1種・1ステージ。**デフォルト武器=シューター型（武器選択画面が無くても遊べる）**（REV-R1-106）。**ボット難易度はデフォルトNORMAL固定（パラメータは3段階定義）**（REV-R1-103）
- OUT(Won't): オンライン対戦（コスト方針違反）/ 3D描画 / 任天堂IPアセット（法的リスク・EV-LAW-001）/ 音楽(著作権安全な自作SE最小限のみCould)
- DEFER: 追加ステージ・追加武器（REV-R1-107: 難易度選択UIはFR-BOT-002に統合済み）

## 2. 機能要件（FR）— 全Must要件に Evidence/ACC/TC 接続済み

| ID | 要件（1要件1文） | MoSCoW | 根拠 | ACC（Given-When-Then） | TC |
|---|---|---|---|---|---|
| FR-MATCH-001 | 試合は180秒で終了し、終了時に塗り面積率の大きいチームが勝利と表示される | Must | EV-RULE-001/002 | Given 試合中 When 残り時間0 Then 両チームの塗りセル数を集計し勝敗とパーセントを表示 | TC-FR-MATCH-001 |
| FR-MATCH-002 | 塗り面積は「終了時点の塗り状態」のみで判定し、塗り返しが反映される | Must | EV-RULE-002 | Given AがセルXを塗済 When BがセルXを塗り返す Then セルXはBの面積に計上 | TC-FR-MATCH-002 |
| FR-MATCH-003 | 障害物セルは塗れず面積カウント対象外である | Must | EV-RULE-003 | Given 障害物セル When 弾が当たる Then 塗りは発生せず総面積母数にも含まれない | TC-FR-MATCH-003 |
| FR-PAINT-001 | 弾・轢き・スペシャルの着弾点周辺セルが自チーム色に塗られる | Must | EV-RULE-001 | Given 弾着弾 When 半径r内のセル Then チーム色IDに更新 | TC-FR-PAINT-001 |
| FR-INK-001 | 各キャラはインクタンク(100%)を持ち、射撃で消費し、消費し切ると射撃不能になる | Must | EV-INK-001 | Given インク0.5% When シューター射撃(1.0%) Then 発射されない | TC-FR-INK-001 |
| FR-INK-002 | 自陣色インク上のスイムでインクが12%/s回復し移動速度1.8倍になる。**スイム中は射撃・チャージ不可**（REV-R1-002） | Must | EV-INK-001/002 | Given 自インク上+スイム When 1s経過 Then インク+12/速度1.8x; Given スイム中 When 射撃入力 Then 弾が生成されない | TC-FR-INK-002 |
| FR-INK-003 | 敵インク上では移動速度40%になり10/sの継続ダメージ（このダメージ単独ではHP30未満にしない）を受ける。**移動は常に可能で詰みは発生しない**（REV-R1-101） | Must | EV-INK-003 | Given 敵インク上 When 1s経過 Then HP-10(敵インク起因は下限30)/速度0.4x | TC-FR-INK-003 |
| FR-WPN-001 | シューター型は100ms間隔・36ダメージ・射程260px・1.0%消費で連射できる | Must | EV-WPN-001, D-002 | Given 射撃保持 When 300ms Then 3発生成・各パラメータ一致 | TC-FR-WPN-001 |
| FR-WPN-002 | ローラー型は**通常移動（非スイム）時に幅24px（3セル幅）の轢き塗り**をし、振り(600ms)で近接100ダメージを与える（REV-R1-004） | Must | EV-WPN-002, D-002 | Given 通常移動で80px直進 Then 軌跡上3セル幅が塗られる; Given スイム中 Then 轢き塗りなし; Given 振り命中 Then 即スプラット | TC-FR-WPN-002 |
| FR-WPN-003 | チャージャー型はチャージ率c∈[0,1]で 射程=520×(0.35+0.65c)px・ダメージ=c≥1なら100/未満40 の直線弾を撃ち、**チャージ中は移動速度0.5倍・スイム入力でチャージ破棄**（REV-R1-005） | Must | EV-WPN-002, D-002 | Given 1.2s保持→離す Then 射程520px/100dmg; Given 0.6s保持→離す Then 射程≈338px/40dmg; Given チャージ中 Then 速度0.5x | TC-FR-WPN-003 |
| FR-DMG-001 | HP100が0になるとスプラット（撃破）され、3秒後に自陣リスポーン地点で復活し**復活後1.5秒は被弾無効（行動は可能）**（REV-R1-009） | Must | EV-RULE-001(ジャンル標準) | Given HP36以下 When 36dmg被弾 Then スプラット→3s後復活/HP100/インク100; Given 復活後1.0s When 被弾 Then ダメージ0 | TC-FR-DMG-001 |
| FR-SP-001 | 塗りポイント**150以上**で発動可能になり、発動でインク全回復＋**前方帯状領域（幅48px×長さ320px）を即時塗り・帯内の敵に40ダメージ**、SPは0に戻る（REV-R1-001/105） | Must | EV-SP-001/002 | Given SP=149 When E押下 Then 不発; Given SP=150 When E押下 Then インク100%/帯塗り/帯内敵-40/SP0 | TC-FR-SP-001 |
| FR-BOT-001 | CPUボットはPAINT/FIGHT/RETREATの3状態で自律行動する。**索敵半径=武器射程×1.2・障害物セルで視線遮蔽（レイキャスト）**（REV-R1-006） | Must | D-003 | Given 視線が通る敵が索敵半径内 Then FIGHT遷移; Given HP<30 Then RETREAT遷移; Given 障害物越しの敵 Then FIGHTに遷移しない; その他 PAINT | TC-FR-BOT-001 |
| FR-UI-001 | 画面に残り時間・インク残量・SPゲージ・両チーム塗り率バーが常時表示される | Must | EV-RULE-001 | Given 試合中 Then 4要素が毎フレーム更新表示 | TC-FR-UI-001 |
| FR-UI-002 | WASD移動・マウスエイム・左クリック射撃・Spaceスイム・Eスペシャルで操作できる | Must | R-001 | Given 各入力 Then 対応アクション発火 | TC-FR-UI-002 |
| FR-BOT-002 | ボットに3段階難易度（エイム誤差・反応遅延）がある | Should | D-003 | 難易度値で誤差/遅延が変わる | TC-FR-BOT-002 |
| FR-UI-003 | タイトル画面で武器を選択して試合開始できる | Should | D-002 | 3武器から選択→開始 | TC-FR-UI-003 |
| FR-SND-001 | 射撃・スプラット時に自作効果音が鳴る | Could | — | WebAudio生成音 | N/A |

## 3. 非機能要件（ISO 25010）

| ID | 特性 | 要件 | MoSCoW | ACC | TC |
|---|---|---|---|---|---|
| NFR-PERF-001 | 性能 | 1280x720・8キャラ・通常弾幕で30fps以上（目標60） | Must | 180sシミュレーションでtick平均<33ms **かつ p95<50ms**（REV-R1-007） | TC-NFR-PERF-001 |
| NFR-PORT-001 | 移植性 | Chrome/Edge最新でindex.htmlを開くだけで起動（ビルド・サーバー不要） | Must | file://直開きで動作 | TC-NFR-PORT-001 |
| NFR-COST-001 | コスト | 外部API・有料サービス・npm依存ゼロ | Must | package.json依存0件/外部fetch 0件 | TC-NFR-COST-001 |
| NFR-MAINT-001 | 保守性 | ゲームロジックはDOM/canvas非依存の純粋モジュールでnode:testでテスト可能 | Must | src/core/*がNodeで実行可 | TC-NFR-MAINT-001 |
| SEC-001 | セキュリティ | 外部送信・eval・動的script注入なし | Must | コード走査で該当0 | TC-SEC-001 |
| LAW-001 | 法務 | 任天堂の名称・キャラ・ロゴ・音源を一切含まない | Must | **grep対象は src/ と index.html のみ**（docs/research/は参照文書として除外・REV-R1-104）で「スプラ/Splatoon/イカ/インクリング/ナワバリ」0件 | TC-LAW-001 |

## 4. リスク台帳
| ID | リスク | 影響 | 対策 |
|---|---|---|---|
| RISK-001 | 塗り判定の負荷で60fps割れ | 中 | D-001グリッド方式+差分描画。劣化時セル12px化 |
| RISK-002 | ボットが弱すぎ/強すぎで遊びにならない | 中 | FR-BOT-002の難易度パラメータ化+E2Eで勝率確認 |
| RISK-003 | 「本物に近い」期待値とのギャップ(2D/オフライン) | 中 | Phase0でユーザー承認済。READMEに再現範囲を明記 |
| RISK-004 | IP類似（意匠の寄せすぎ） | 高 | W-001準拠: 名称/キャラ/配色オリジナル。LAW-001で機械チェック |

## 5. トレーサビリティ
全Must FR/NFR → Evidence(research_v1/v2) → ACC → TC 接続済み（上表）。孤立IDなし。
