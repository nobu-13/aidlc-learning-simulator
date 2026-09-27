**Reviewer:** aidlc-architecture-reviewer-agent

**Verdict:** READY
**Date:** 2026-09-25T13:29:55Z
**Iteration:** 2
**Class:** advisory
**Unit:** aidlc-learning-simulator-web
**Reviewed artifact:** construction/aidlc-learning-simulator-web/functional-design/functional-spec.md（併せて entities.md / rules.md / frontend-components.md / traceability.json の整合を確認）

**Findings**

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | entities.md DecisionRecord.note | DecisionRecord に optional note（生テキスト・locale key ではない・採点入力に含めない BR3.1・ProgressStore 永続・Result/Adoption Sheet 再確認 AC2.2.5/AC7.2.1）が追加され Domain Design canonical 属性列と一致 | 追加対応なし | Resolved |
| R-02 | Major | rules.md BR2.5 と traceability.json AC2.2.5 | memo 専用 rule BR2.5（note 永続・採点非依存・Result/Sheet 参照可能・source FR4.2）新設、AC2.2.5 を BR3.4 から BR2.5 へ再 mapping。AC7.2.1 は BR6.1 に対応し BR2.5 が補強 | 追加対応なし | Resolved |
| R-03 | Minor | functional-spec.md 2.1 状態機械 | errored 遷移を runtime DomainInvariantError に限定し ScenarioValidationError は 2.3 validation flow に閉じた。ADR-011 の boundary 別 error 区分と整合 | 追加対応なし | Resolved |
| R-04 | Minor | entities.md runtime/result data | 旧称 ScenarioProgress/sequenceIndex/contributingRuleIds を canonical 名 ScenarioSession/orderIndex/contributingDecisionRecordIds へ統一、sessionId 主キーで紐づく | 追加対応なし | Resolved |
| R-05 | Minor | entities.md EffectRule.condition | condition に決定的・副作用なし・time/random/locale/mode 非参照（BR3.1/NFR2）を明示 | 追加対応なし | Resolved |
| R-06 | Minor | rules.md BR2.1 applies_to | BR2.1 の applies_to が旧称 ScenarioProgress のまま残り canonical 名との表記が不一致。実装可能性は損なわない | applies_to を ScenarioSession（進行サービスは ScenarioProgression）へ揃える。advisory 非ブロッキング | New |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| JSON parse | PASS | 妥当な JSON。coverage 66 件 = upstream 66 件で id 集合一致 |
| upstream AC 実在性・全数カバー | PASS | 全 66 upstream AC が stories.md に実在し coverage で全数 OK |
| coverage target 解決 | PASS | 全 coverage target BRx.y が rules.md に実在。AC2.2.5→BR2.5 の再 mapping 含め未解決なし |
| reverse orphan 妥当性 | PASS | reverse の 7 件は technical validation rule として N/A 明示 |
| BR 網羅性 | PASS | 全 34 BR（BR2.5 追加後）が coverage か reverse に出現 |
| canonical entity drift | PASS | ScenarioSession/DecisionRecord/DimensionOutcome/LearningResult が components.md canonical と一致 |
| error ownership 分離 | PASS | Validation=ScenarioLoader / DomainInvariantError=ScenarioProgression(runtime) / PersistenceError=ProgressStore |
| note の評価入力除外 | PASS | BR3.1 の入力集合に note を含めず BR2.5・§4・entity constraint で採点非依存を明示 |

**Summary**: iteration 1 の R-01〜R-05 はすべて Resolved。FR4.2 判断メモが entity/rule/traceability に一貫して居場所を得た。errored 遷移の runtime 限定、canonical 名統一、condition 決定性明示も反映済み。66 AC 全数 coverage・全 coverage target BR 実在・reverse orphan 妥当・error ownership 分離・note の採点非依存を確認。新規 Major なし、残存は非ブロッキングの新規 Minor 1 件（R-06、BR2.1 applies_to の旧称表記）のみ。評定: READY（advisory）。
