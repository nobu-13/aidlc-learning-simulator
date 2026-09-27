<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T02:00:00Z — Story を UI 部品ではなく学習体験単位で縦切り。ジャーニー群（US1-US7）+ 学習モード群（US8）+ 横断関心群（US9-US12）+ 保守者群（US13）に整理。v2.10.0 の必須 Learning Topic（boundary/gate 分離・checkpoint review・recovery next-step）は Delivery 優先度と分離して Story 化した。
- 2026-09-25T02:00:00Z — 重要学習 Story の AC に「判断理由の説明」「spec/interpretation/assumption/harness の区別」「Decision→Dimension 寄与の追跡」を織り込み、FR6.7/FR6.8/FR5.4 を体験単位で検証可能にした。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-25T02:40:00Z — [downstream obligation R-02] 大型 Story（US2.2/US3.1 等）は User Stories 上は学習体験の縦切りとして維持。functional-design / Delivery Planning で testable Unit へ分解する対象: Decision 操作 / Explanation 描画 / provenance 表示 / Result の各構造スロット / accessibility・announce / deterministic evaluation との接続。Story を UI 部品単位へ分解し直さず Learning Outcome との対応を維持する。
- 2026-09-25T02:40:00Z — [downstream obligation R-03] Early User Test (a)-(f) は automated Verification と明確に分離。nfr-design / build-and-test で「automated test で検証できるもの / qualitative Early User Test で Validation するもの / 未実施の Validation」を区別。未実施段階で「pass」「validated」「学習効果確認済み」と報告しない。
- 2026-09-25T02:40:00Z — [Refined Mockups guidance] 初学者が 5〜10 分 Core へ迷わず入れる / Guided→Simulation→Adoption Review の Learn→Practice→Apply が自然に理解できる / Decision 前に正解を漏らしすぎず後に理由を理解 / boundary と approval gate を視覚的に混同しない / provenance は確認可能だが常時情報過多にしない / 9 Dimension を一度に押し付けず段階提示 / keyboard・focus・aria-live・empty/error state が主要 Flow で成立。Learning Outcome / Requirement Traceability / 4 区分 provenance taxonomy を維持。
