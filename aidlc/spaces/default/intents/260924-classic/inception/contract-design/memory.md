<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T08:00:00Z — 本 system は formal contract を持たないと明示判断（explicit No Contract）。inter-unit contract なし（U1 単一・depends_on:[]）、public/external API contract なし（static SPA・backend/API/DB/外部 AI API なし）。単純に skip せず「なぜ skip できるか」と「唯一の境界候補 Scenario JSON を見落としていないこと」を成果物に記録する方針。
- 2026-09-25T08:00:00Z — Scenario JSON ↔ ScenarioLoader は重要な内部 data boundary だが inter-unit でも public API でもなく U1 内部の build-time asset boundary。formal contract 化すると Domain Design / Contract Design / Functional Design 間で source of truth が重複するため Contract Design では pin せず、所有先（Domain Design=entity shape / ScenarioLoader・ADR-003=validation boundary / Functional Design=concrete schema）を参照 trace する。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-25T08:00:00Z — Functional Design への申し送り（Scenario schema evolution）: additive/breaking change 方針、unknown field を reject するか ignore するか、schema versioning、および Scenario schema version と ProgressStore の persistence schemaVersion を別概念として扱うこと。validation 失敗時の presentation UX 詳細も Functional Design。
