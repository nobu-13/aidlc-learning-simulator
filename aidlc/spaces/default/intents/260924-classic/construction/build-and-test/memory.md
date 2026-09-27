<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-26 — 単一 unit のため cross-unit = アプリ内層境界（Orchestrator 結線）。integration test は UI 経由の User Flow が担う。
- 2026-09-26 — NFR9.1/9.2/9.3（runtime latency）と NFR4 color-contrast/手動 a11y は本ステージで実測不可 → performance-validation（Operation）/ 手動確認が owning stage。Unverified として承認 gate で明示（緩めない）。

## Deviations
- 2026-09-26 — advisory review で Build and Test へ deferred された R-04（Adoption Sheet download UI）を本ステージで実装・テスト（68 tests）。

## Tradeoffs
- 2026-09-26 — code-generation の traceability.json は BR + 主要 FR/NFR 粒度で、AC 単位の 1:1 明示エントリを持たない。振る舞いは 68 tests で被覆済みだが AC→実装/テストの明示トレースは不足。承認 gate で (a) 現状許容 / (b) AC 追記の loop-back を human に提示。
- 2026-09-26 — human は案C を選択。全 AC を 1:1 明示追記した結果 MISSING 4（AC5.2/5.3）+ PARTIAL 10 が判明。AC5.2/5.3（v2.10.0 必須 Topic）は Focus Scenario 2 本を追加して OK 化（76 tests）。PARTIAL 10 は MVP Known Gap として削除せず明示（product.md 学習価値優先・過剰演出回避）。AC 単位 traceability は「成果物自身が追跡可能であること」を学習テーマとして重視する判断。
- 2026-09-26 — Build and Test には reviewer が無い（advisory review は code-generation 固有）。追加 Focus Scenario の検証は build + 76 tests green の再実行 + finalized Target Verification Matrix が担う。

## Open questions
- 2026-09-26 — AC 単位 traceability を traceability.json に明示追記するか（human 判断）。
