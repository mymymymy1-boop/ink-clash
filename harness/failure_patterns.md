# failure_patterns — INK CLASH

| ID | 失敗内容 | 根本原因 | 変換先 |
|---|---|---|---|
| FP-001 | v2ビルドで画面が無反応（SyntaxError: Identifier 'W' has already been declared） | ESMモジュールを単一スコープに結合するビルド方式で、render3d.jsとweapons.jsのトップレベル `const W` が衝突 | build.mjsに衝突検知ガードを実装（ビルド失敗で即検知）+ CONSTRAINTS C-009 追加 |
