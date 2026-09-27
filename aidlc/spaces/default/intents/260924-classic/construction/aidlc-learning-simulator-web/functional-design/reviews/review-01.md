**Reviewer:** aidlc-architecture-reviewer-agent

**Verdict:** NOT-READY
**Date:** 2026-09-25T13:20:02Z
**Iteration:** 1
**Class:** advisory
**Unit:** aidlc-learning-simulator-web
**Reviewed artifact:** construction/aidlc-learning-simulator-web/functional-design/functional-spec.md（併せて entities.md / rules.md / frontend-components.md / traceability.json の整合を確認）

**Findings**

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | entities.md DecisionRecord | 上流 AC2.2.5 と AC7.2.1 が要求する FR4.2 の任意判断メモを保持する属性が DecisionRecord に無い。Domain Design の DecisionRecord は note を持つが本 entity で欠落し、結果 / Adoption Sheet で当該メモを再確認できる根拠が entity model に無い | DecisionRecord に採点非依存の memo 属性（locale key ではない生テキスト）を追加し、結果 / Adoption Sheet 表示と localStorage 永続の対象に含める | New |
| R-02 | Major | traceability.json AC2.2.5 | AC2.2.5（判断メモは保存され採点に影響せず結果 / Adoption Sheet で再確認可能）が BR3.4（非単調評価）へ対応づけられ対象 rule が意味的に不一致 | 判断メモの永続と採点非依存を明文化する rule へ AC2.2.5 を対応づけ、対応する business rule を rules.md に用意する | New |
| R-03 | Minor | functional-spec.md 2.1 ScenarioProgress state machine | not_started から errored への遷移ラベルが ScenarioValidationError だが、当該 error は ScenarioLoader が load 境界で所有し lifecycle の errored は DomainInvariantError に紐づく。ADR-011 の boundary 別 error 区分と混線 | 2.1 の errored 遷移は runtime の DomainInvariantError に限定し、load 時の ScenarioValidationError は 2.3 validation flow 側に閉じる | New |
| R-04 | Minor | entities.md ScenarioProgress と Domain Design ScenarioSession | Domain Design は lifecycle entity を ScenarioSession（sessionId 主キー）で所有し DecisionRecord も sessionId / decisionRecordId / orderIndex を持つ。本 entities は ScenarioProgress（scenarioId 基点）と sequenceIndex へ改名しており runtime ID 決定性契約との対応が不明瞭 | ScenarioProgress と ScenarioSession の同一性および session semantic key の所在を entities.md に明記して Domain Design と接続する | New |
| R-05 | Minor | entities.md EffectRule.condition | condition は predicate と記されるが決定性を満たすため許容される述語の範囲（time / random / locale 非依存）が entity 制約として明示されていない | condition に決定的に評価可能で time / random / locale / mode を参照しない制約を entity_constraints として明記する | New |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| JSON parse | PASS | 妥当な JSON。coverage 66 件 = upstream 66 件で id 集合一致 |
| coverage target 解決 | PASS | 全 coverage target BRx.y が rules.md に実在 |
| reverse orphan 妥当性 | PASS | reverse の 7 件は technical validation rule として N/A 明示 |
| upstream AC 実在性 | PASS | 全 66 upstream AC が stories.md に実在・全数カバー |
| BR 網羅性 | PASS | 全 33 BR が coverage か reverse に出現 |

**Summary**: 決定的評価・検証境界・provenance 4 区分・error taxonomy・i18n/mode 不変・永続化・承認境界分離・UI 非所有・a11y は要件と概ね整合し traceability も構造的に健全。ただし FR4.2 由来の判断メモ（AC2.2.5 / AC7.2.1）が entity model に居場所を持たず対応づけも意味不一致（R-01 / R-02）で承認前是正が望ましい。advisory のためゲートは止めないが Request Changes での反映を推奨。評定: NOT-READY。
