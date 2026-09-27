<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T21:50:00Z — 評価 Dimension（9 軸・全 Scenario 共通の固定評価モデル）と Learning Concept（Scenario ごとに変わる学習テーマ）を分離。Concept→Dimension mapping で異なる Scenario でも同一 9 Dimension で比較・振り返り可能にする。これが Functional Design の中核 source-of-truth。
- 2026-09-25T21:50:00Z — evaluation contribution は連続値でなく離散 5 段階（strong-negative..strong-positive）。非単調性は全 Dimension 強制ではなく Dimension ごとに評価特性を定義（Delegation/Approval/Risk は過少・過剰の双方を悪化=非単調、Requirement Clarity 等は単調でよい）。Rework と Remaining Risks を Dimension に残し「悪かった」で終わらせない。
- 2026-09-25T21:50:00Z — Scenario JSON schema は effectRules/provenanceEntries を scenario と同階層で一意所有し、参照（effectRuleRefs/provenanceRefs/learningPointRefs/transition nextRef）を同一 validated definition 内で解決。ScenarioLoader が schema/stable-ID uniqueness/dangling reference/cardinality/provenance invariant/transition/schemaVersion を検証。表示文言は locale key、JSON に生文言を持たない。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-25T22:10:00Z — Construction per-unit ディレクトリは DAG unit 名 `aidlc-learning-simulator-web` を使う（Units Generation の Directory 表記 `u1-aidlc-learning-simulator-web` ではない）。当初 `u1-` 付きに置いてしまい per-unit review guard が unit を解決できなかったため、`construction/aidlc-learning-simulator-web/functional-design/` へ移動し、summary confirmation を per-unit（--unit）で取り直した。artifact 内容は不変。
- 2026-09-25T22:30:00Z — advisory review iteration 1 = NOT-READY（Major 2 / Minor 3）。全件反映: R-01 DecisionRecord に note（採点非依存・永続・Result/Sheet 再表示）追加。R-02 memo 専用 rule BR2.5 追加し AC2.2.5 を再 mapping（BR3.4→BR2.5）。R-03 lifecycle errored を runtime DomainInvariantError に限定、ScenarioValidationError は §2.3 validation flow に閉じ error ownership を分離（ADR-011）。R-04 Domain Design canonical 名へ統一（ScenarioSession/sessionId/decisionRecordId/orderIndex/chosenDecisionOptionId/contributingDecisionRecordIds、DimensionOutcome/LearningResult も sessionId 基点）。R-05 EffectRule.condition に deterministic・side-effect free・time/random/locale/mode 非依存を entity_constraints で明示。entities 概要の旧称 ScenarioProgress も ScenarioSession へ統一。note は評価入力に含めない（BR2.5/BR3.1）。66 AC 全 coverage・全 BR target 実在・reverse orphan 妥当を再確認。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-25T22:45:00Z — Request-Changes（canonical naming consistency 是正、意味変更なし）: rules.md BR2.1 applies_to ScenarioProgress→ScenarioSession、BR2.3 chosenOptionId→chosenDecisionOptionId、BR3.7 と frontend-components.md の contributingRuleIds→contributingDecisionRecordIds。EffectRule 追跡経路（chosenDecisionOptionId→effectRuleRefs→EffectRule）は維持。source-of-truth 成果物に旧称残存なし（entities.md の R-04 旧称対応ノートのみ意図的に旧称を記載）。66 AC coverage 不変。R-06 解消。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
