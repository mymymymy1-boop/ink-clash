# finding_ledger — INK CLASH

| ID | 重大度 | 内容(要約) | 対処 | 反映先 | 状態 |
|---|---|---|---|---|---|
| REV-R1-001 | Blocker | SP発動の等号条件未定義 | SP>=150で発動と明記 | SRS FR-SP-001 / CONSTRAINTS C-006 | Closed |
| REV-R1-002 | Blocker | スイム中の射撃可否未定義 | スイム中は射撃・チャージ不可 | SRS FR-INK-002 / SDD§4 / C-007 | Closed |
| REV-R1-003 | Blocker | 弾×障害物の衝突未定義 | 障害物セル到達で消滅・塗りなし | SDD weapons.js / C-008 | Closed |
| REV-R1-102 | Blocker | ボット移動経路方式未定義 | ステアリング+レイキャスト回避+スタック検知 | SDD bots.js | Closed |
| REV-R1-004 | Major | ローラー塗り幅未数値 | 幅24px(3セル)・通常移動時のみ | SRS FR-WPN-002 | Closed |
| REV-R1-005 | Major | チャージ中挙動未定義 | 速度0.5x・スイムで破棄・射程式定義 | SRS FR-WPN-003 | Closed |
| REV-R1-006 | Major | ボット索敵・視線未定義 | 索敵=射程1.2倍・障害物遮蔽 | SRS FR-BOT-001 | Closed |
| REV-R1-007 | Major | PERF基準がスパイク非対応 | p95<50ms追加 | SRS NFR-PERF-001 / TEST_PLAN | Closed |
| REV-R1-008 | Major | HUDのMust要件が手動テスト依存 | hud.js純関数化で自動検証 | SDD / TEST_PLAN | Closed |
| REV-R1-101 | Major | 敵インク上で詰み懸念 | 移動常時可能で詰みなしと明確化 | SRS FR-INK-003 | Closed |
| REV-R1-103 | Major | ボット難易度のMVP境界曖昧 | デフォルトNORMAL固定・3段階は定数保持(Should) | SRS スコープ | Closed |
| REV-R1-105 | Major | スペシャル数値未定義 | 帯48x320px・敵40dmg | SRS FR-SP-001 / SDD | Closed |
| REV-R1-009 | Minor | リスポーン無敵未定義 | 復活後1.5s被弾無効 | SRS FR-DMG-001 | Closed |
| REV-R1-010 | Minor | E2E-N1閾値が弱い | 塗り率合計>40%に引上げ | E2E_SCENARIOS | Closed |
| REV-R1-104 | Minor | LAW-001のgrep範囲曖昧 | src/とindex.htmlに限定 | SRS LAW-001 | Closed |
| REV-R1-106 | Minor | デフォルト武器未定義 | シューター固定 | SRS スコープ | Closed |
| REV-R1-107 | Minor | DEFERとShould重複 | DEFERから難易度UI削除 | SRS スコープ | Closed |
