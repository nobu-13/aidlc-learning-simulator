<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T03:00:00Z — classic は rough-mockups を skip するため wireframes/user-flow 入力が無い。user-stories と requirements から直接 refined mockup を設計（欠落成果物の内容は捏造しない）。
- 2026-09-25T03:00:00Z — Scenario 進行は縦 1 カラム progressive disclosure に統一し、Focus 個別画面も同一 Shell を再利用。DOM order = reading order を responsive の基本契約に据え、boundary/gate を色以外（Label/Icon/Shape/Position）でも区別する設計にした。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-25T05:00:00Z — [Domain Design 申し送り] 崩さない意味論: Core/Focus は同一 Scenario Engine/Shell / Decision options は 7 種 enum から Scenario 依存 subset を data-driven / provenance 4 区分固定（harness-behavior は ai-dlc-spec と別区分）/ boundary=実行範囲・approval gate=Human 承認停止点は別概念 / AI-DLC Completion Approval と Release Approval は別概念 / 9 Dimension 評価は deterministic / UI に暗黙 evaluation logic を持たせない / same Scenario + same Decision sequence → same result / ja/en で結果を変えない / malformed は validation boundary で検出し silent fallback しない / Adoption Sheet 生成も deterministic。
- 2026-09-25T05:00:00Z — [Domain Design 申し送り] 保留していた sourceRefs / provenance schema の具体構造を Domain Design で確定（OQ1/OQ2）。UI 表現をそのまま domain model へコピーせず、UI から独立した semantic model として設計する。
