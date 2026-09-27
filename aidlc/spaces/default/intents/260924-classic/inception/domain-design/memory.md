<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T06:00:00Z — 論理コンポーネントは UI 非依存の semantic model として設計。データ所有（ScenarioCatalog/ResultModel）と評価ロジック（DimensionEvaluator + data-driven DecisionEffectRules）を分離し、ProvenanceEntry を shared value object 化。hexagonal な依存方向（UI/App → domain ports → semantic model、adapter が境界変換）で /domain の純粋性と決定性を担保。
- 2026-09-25T06:00:00Z — failure を boundary 別に型区別（ScenarioValidationError=Loader / DomainInvariantError=Progression / PersistenceError=ProgressStore）。stable ID を domain contract 化し、ja/en 表示変更で identity/evaluation/traceability/persisted progress が不変であることを architecture で保証。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-25T06:20:00Z — [Units Generation 申し送り] 12 logical components をそのまま 12 deployable units にしない。static React+TS+Vite SPA なので deployable/runtime unit は原則 1 つの frontend application bundle を基本とし、Domain Design の component 境界は主に code/module boundary として維持。維持: /domain の pure semantic logic、/data の ScenarioLoader・ProgressStore adapter、/app の orchestration、/ui の presentation、/scenarios・locale resources の data separation、domain から React/localStorage/raw JSON/locale text を直接参照しない、Evaluation/Progression/Composer の determinism、canonical ownership、Traceability != Verification。deployable unit を増やすこと自体を目的にせず最小で自然な Unit 構成にする。
