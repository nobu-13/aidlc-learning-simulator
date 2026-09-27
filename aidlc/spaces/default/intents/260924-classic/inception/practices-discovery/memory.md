<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
2026-09-24T04:43:34Z — test-after を選択（TDD/BDD ではなく）。quality rules は仕様先行を義務づけず、決定的 scoring と主要ロジックの unit test を求めるだけなので org 既定に沿った。
2026-09-24T04:43:34Z — Walking Skeleton の ceremony は省略。静的 SPA で backend も外部依存も無く先行 Bolt の価値が薄いため。代わりに JSON 分離の薄い縦切りを最初に通す実装順序を推奨。
2026-09-24T04:43:34Z — org の production 手動承認ゲートは採用せず。backend 配信前提の既定であり、GitHub Pages 単一環境の静的サイトには該当しないため。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
2026-09-24T04:43:34Z — Scenario JSON スキーマ（scoring の重み付け構造）は requirements-analysis／domain-design で確定でよいか。
2026-09-24T04:43:34Z — GitHub Pages の公開形態（org/user site vs repo サブパス）と Vite の `base` 値。
2026-09-24T04:43:34Z — accessibility の目標水準（WCAG のどのレベルを MVP で必須とするか）。
2026-09-24T04:43:34Z — UI コンポーネントテストをどこまで unit test 範囲に含めるか。Vitest 以外の選好の有無。
