# HARNESS — INK CLASH

## 構成（Planner/Generator/Evaluator）
- Planner: TASKS.md のタスク順序（依存順: rng→grid→config→entities→weapons→special→bots→match→stage→game/render→html）
- Generator: 各タスク RED(落ちるテスト先行)→GREEN(最小実装)
- Evaluator: `node --test tests/` + 静的走査(TC-SEC-001/TC-LAW-001/TC-NFR-COST-001)

## 決定論センサー
- 全テストはシード固定rng注入。時間はdt手動進行（実時計不使用）。flaky禁止。

## 安全ハーネス
- 外部送信・破壊操作なし（CONSTRAINTS §4）。git未使用（ユーザー指示があれば init）。

## 失敗学習ループ
- テスト失敗3回連続→アプローチ転換し failure_patterns.md に FP-XXX 記録→CONSTRAINTS昇格判断
