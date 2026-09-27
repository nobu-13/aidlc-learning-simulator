# Entities — U1: aidlc-learning-simulator-web

> 技術非依存の entity model（型は logical、実装言語非依存）。Domain Design の ownership/shape を Functional Design レベルで具体化（型・required/unique・cardinality・制約）。表示文言は entity に持たず locale key（`*Key`）で参照する。stable-ID は time/random 非依存。Learning Target = AI-DLC v2.10.0。
> 区分: **authoring semantic data**（ScenarioCatalog 所有: Scenario / Stage / DecisionPoint / DecisionOption / LearningPoint / ProvenanceEntry / EffectRule / Dimension）と **runtime/result data**（ScenarioSession / DecisionRecord / DimensionOutcome / LearningResult / AdoptionReviewMemo）を分離。Scenario JSON は authoring data の外部表現であり validated domain definition とは別物。

```yaml
entities:
  # ---------- authoring semantic data (ScenarioCatalog が所有) ----------
  - name: ScenarioSet
    description: build-time 同梱の Scenario JSON ファイル 1 つ分のルート。ScenarioLoader が検証し validated definition へ変換する外部表現。
    attributes:
      - { name: schemaVersion, type: integer, required: true, constraints: "supported version のみ。unknown は reject" }
      - { name: scenario, type: Scenario, required: true }
      - { name: effectRules, type: list<EffectRule>, required: true, min: 0, constraints: "同一 ScenarioSet 内で effectRuleId 一意所有" }
      - { name: provenanceEntries, type: list<ProvenanceEntry>, required: true, min: 0, constraints: "同一 ScenarioSet 内で provenanceId 一意所有" }
    entity_constraints:
      - "全 *Refs は同一 ScenarioSet 内の owner を指す（dangling reference は reject）"
      - "表示文言を直接持たない（locale key のみ）"

  - name: Scenario
    description: 1 つの学習シナリオ。core または focus。
    attributes:
      - { name: scenarioId, type: string, required: true, unique: true, constraints: "stable ID・time/random 非依存" }
      - { name: kind, type: enum, required: true, allowed: [core, focus] }
      - { name: learningObjectiveIds, type: list<string>, required: true, min: 1 }
      - { name: stageIds, type: list<string>, required: true, min: 1, references: "Stage.stageId（順序付き）" }
      - { name: learningPointIds, type: list<string>, required: true, min: 1, references: "LearningPoint.learningPointId" }
      - { name: tags, type: list<string>, required: false, min: 0 }
      - { name: provenanceRefs, type: list<string>, required: false, min: 0, references: "ProvenanceEntry.provenanceId" }
    relationships:
      - "Scenario 1 — 1..n Stage（順序付き、composition）"
      - "Scenario 1 — 1..n LearningPoint（composition）"

  - name: Stage
    description: Scenario 内の 1 段階。0..n の DecisionPoint を持つ。
    attributes:
      - { name: stageId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: titleKey, type: string, required: true, constraints: "locale key" }
      - { name: decisionPointIds, type: list<string>, required: true, min: 0, references: "DecisionPoint.decisionPointId（順序付き）" }
    relationships:
      - "Stage 1 — 0..n DecisionPoint（順序付き、composition）"

  - name: DecisionPoint
    description: ユーザーが選択を行う分岐点。Important Decision Point は provenance 必須。
    attributes:
      - { name: decisionPointId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: promptKey, type: string, required: true, constraints: "locale key" }
      - { name: optionIds, type: list<string>, required: true, min: 2, references: "DecisionOption.optionId" }
      - { name: learningPointRefs, type: list<string>, required: false, min: 0, references: "LearningPoint.learningPointId" }
      - { name: important, type: boolean, required: false, default: false }
      - { name: provenanceRefs, type: list<string>, required: false, min: 0, references: "ProvenanceEntry.provenanceId", constraints: "important=true なら min 1" }
    relationships:
      - "DecisionPoint 1 — 2..n DecisionOption"

  - name: DecisionOption
    description: DecisionPoint の選択肢。0..n の EffectRule を参照し、遷移先を示す。
    attributes:
      - { name: optionId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: labelKey, type: string, required: true, constraints: "locale key" }
      - { name: effectRuleRefs, type: list<string>, required: false, min: 0, references: "EffectRule.effectRuleId" }
      - { name: provenanceRefs, type: list<string>, required: false, min: 0, references: "ProvenanceEntry.provenanceId" }
      - { name: nextRef, type: string, required: false, references: "Stage.stageId | DecisionPoint.decisionPointId | terminal", constraints: "省略時は Stage の次順へ既定遷移。dangling は reject" }
    relationships:
      - "DecisionOption 0..n — EffectRule（参照）"

  - name: LearningPoint
    description: 学習ポイント。conceptId で Learning Concept を指す。provenance 必須。
    attributes:
      - { name: learningPointId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: conceptId, type: string, required: true, constraints: "Learning Concept 識別子（評価 Dimension とは別体系）" }
      - { name: titleKey, type: string, required: true, constraints: "locale key" }
      - { name: bodyKey, type: string, required: true, constraints: "locale key" }
      - { name: provenanceRefs, type: list<string>, required: true, min: 1, references: "ProvenanceEntry.provenanceId" }
      - { name: betterAlternativeRef, type: string, required: false, references: "DecisionOption.optionId | LearningPoint.learningPointId" }

  - name: ProvenanceEntry
    description: 教材出所の 4 区分メタデータ。教育的正確性の追跡単位。
    attributes:
      - { name: provenanceId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: category, type: enum, required: true, allowed: [ai-dlc-spec, harness-behavior, simulator-interpretation, simulation-assumption] }
      - { name: reference, type: string, required: false, constraints: "category=ai-dlc-spec の場合は AI-DLC v2.10.0 一次情報 reference 必須" }
      - { name: noteKey, type: string, required: true, constraints: "locale key" }
    entity_constraints:
      - "category=ai-dlc-spec → reference 必須（一次情報）"

  - name: EffectRule
    description: DecisionOption が特定 Dimension に与える寄与。data-driven 評価の単位。
    attributes:
      - { name: effectRuleId, type: string, required: true, unique: true, constraints: "stable ID" }
      - { name: dimensionId, type: string, required: true, references: "Dimension.dimensionId" }
      - { name: contribution, type: enum, required: true, allowed: [strong-negative, negative, neutral, positive, strong-positive] }
      - { name: condition, type: predicate, required: false, constraints: "Scenario context / DecisionRecord 列に対する述語。決定的に評価可能で time / random / locale / mode を参照しない（BR3.1/NFR2）。副作用なし" }
      - { name: rationaleKey, type: string, required: false, constraints: "評価理由の locale key（説明可能性）" }
      - { name: learningPointRef, type: string, required: false, references: "LearningPoint.learningPointId" }
    entity_constraints:
      - "condition は決定的（time/random/locale/mode 非参照）。評価の決定性・i18n/mode 不変を崩さない"

  - name: Dimension
    description: 評価軸（9 軸固定）。Learning Concept とは別体系。Dimension ごとに評価特性（単調/非単調）を持つ。
    attributes:
      - { name: dimensionId, type: enum, required: true, unique: true, allowed: [requirement-clarity, acceptance-criteria-coverage, evidence-quality, approval-boundary, delegation-quality, risk-handling, traceability, rework, remaining-risks] }
      - { name: labelKey, type: string, required: true, constraints: "locale key" }
      - { name: monotonicity, type: enum, required: true, allowed: [monotonic, non-monotonic], constraints: "delegation-quality/approval-boundary/risk-handling は non-monotonic" }
    entity_constraints:
      - "9 Dimension は固定集合（Scenario 横断で共通の評価モデル）"

  # ---------- runtime / result data (ScenarioProgression / ResultModel が所有) ----------
  # 注: 名称・属性は Domain Design（components.md）の canonical entity に整合させる。
  # lifecycle entity は ScenarioSession（sessionId 主キー）。DecisionRecord は sessionId/orderIndex/note を持つ。
  - name: ScenarioSession
    description: 進行の runtime lifecycle entity（Domain Design の canonical 名。旧称 ScenarioProgress は本 entity と同一物）。ProgressStore が stable-ID ベースで永続化する。
    attributes:
      - { name: sessionId, type: string, required: true, unique: true, constraints: "runtime lifecycle の主キー。semantic key 由来で決定的に導出（time/random 非依存、BR8.2）。localStorage 永続の識別子" }
      - { name: scenarioId, type: string, required: true, references: "Scenario.scenarioId" }
      - { name: status, type: enum, required: true, allowed: [not-started, in-progress, completed, errored] }
      - { name: currentStageId, type: string, required: false, references: "Stage.stageId", constraints: "status=in-progress のときのみ意味を持つ（status 自体ではなく state の data）" }
      - { name: decisionRecordIds, type: list<string>, required: true, min: 0, references: "DecisionRecord.decisionRecordId（順序付き）" }
    entity_constraints:
      - "Domain Design の ScenarioSession と同一 entity。runtime ID は sessionId を semantic key として決定的に導出する（time/random 非依存）"
    relationships:
      - "ScenarioSession 1 — 0..n DecisionRecord（順序付き）"

  - name: DecisionRecord
    description: ユーザーが記録した 1 決定。言語非依存 semantic data（表示文言を持たない）。Domain Design の canonical 属性に整合。
    attributes:
      - { name: decisionRecordId, type: string, required: true, unique: true, constraints: "stable ID・semantic key 由来で決定的（time/random 非依存）" }
      - { name: sessionId, type: string, required: true, references: "ScenarioSession.sessionId" }
      - { name: decisionPointId, type: string, required: true, references: "DecisionPoint.decisionPointId" }
      - { name: chosenDecisionOptionId, type: string, required: true, references: "DecisionOption.optionId" }
      - { name: note, type: string, required: false, constraints: "FR4.2 の任意判断メモ。ユーザー入力の生テキスト（locale key ではない）。採点に影響しない（評価入力に含めない、BR3.1）。結果/Adoption Sheet で再確認でき、ProgressStore で stable-ID とともに永続化（AC2.2.5/AC7.2.1）" }
      - { name: orderIndex, type: integer, required: true, constraints: "0 起点の順序（Domain Design 名 orderIndex）。決定的評価は集合＋順序を明示的に扱い、格納順そのものに依存しない" }

  - name: DimensionOutcome
    description: 1 Dimension の評価結果。DimensionEvaluator が決定的に算出。Domain Design の canonical 属性に整合。
    attributes:
      - { name: dimensionOutcomeId, type: string, required: true, unique: true, constraints: "stable ID・決定的" }
      - { name: dimensionId, type: string, required: true, references: "Dimension.dimensionId" }
      - { name: sessionId, type: string, required: true, references: "ScenarioSession.sessionId" }
      - { name: level, type: enum, required: true, allowed: [strong-negative, negative, neutral, positive, strong-positive], constraints: "非単調 Dimension では過少/過剰の双方が negative 側へ寄る" }
      - { name: contributingDecisionRecordIds, type: list<string>, required: true, min: 0, references: "DecisionRecord.decisionRecordId", constraints: "説明可能性: この Outcome に寄与した DecisionRecord 群（Domain Design 名）。寄与 EffectRule は各 DecisionRecord の chosenDecisionOptionId→effectRuleRefs から辿れる" }
      - { name: isEducationalSimulationValue, type: boolean, required: true, default: true, constraints: "評価値は Educational Simulation Value であり実測値ではない（FR5.3）" }

  - name: LearningResult
    description: 1 回の完了に対する結果集合（ResultModel 所有）。Domain Design の canonical 属性に整合。
    attributes:
      - { name: learningResultId, type: string, required: true, unique: true, constraints: "stable ID・決定的" }
      - { name: sessionId, type: string, required: true, references: "ScenarioSession.sessionId" }
      - { name: dimensionOutcomeIds, type: list<string>, required: true, min: 9, max: 9, references: "DimensionOutcome.dimensionOutcomeId", constraints: "固定 9 Dimension を必ず含む" }
      - { name: decisionRecordIds, type: list<string>, required: true, min: 0, references: "DecisionRecord.decisionRecordId" }
      - { name: remainingRiskIds, type: list<string>, required: false, min: 0, constraints: "remaining-risks Dimension に紐づく残存リスク（説明可能性）" }
      - { name: reworkIds, type: list<string>, required: false, min: 0, constraints: "rework Dimension に紐づくやり直し（説明可能性）" }
      - { name: reflectionRef, type: string, required: false, constraints: "Reflection への参照" }

  - name: AdoptionReviewMemo
    description: Adoption Review の任意メモ（議論材料、確定物ではない）。
    attributes:
      - { name: sessionId, type: string, required: true, references: "ScenarioSession.sessionId" }
      - { name: noteText, type: string, required: false, constraints: "ユーザー入力の生テキスト（locale key ではない）。runtime 生成 AI 採点はしない" }
```

> **旧称の対応（R-04）**: 本ファイル初版の `ScenarioProgress` / `sequenceIndex` / `contributingRuleIds` は、Domain Design（components.md）の canonical 名 `ScenarioSession` / `orderIndex` / `contributingDecisionRecordIds` に統一した。lifecycle と runtime ID の主キーは `sessionId`（semantic key 由来・決定的）。

## Entity 概要（human-readable）

authoring 側（ScenarioCatalog 所有）は Scenario → Stage → DecisionPoint → DecisionOption の階層と、横断参照される LearningPoint / ProvenanceEntry / EffectRule / Dimension で構成される。ScenarioSet がファイルルートで `effectRules[]` と `provenanceEntries[]` を一意所有し、各所からは ID 参照する（dangling は ScenarioLoader が reject）。runtime 側は **ScenarioSession**（lifecycle・sessionId 主キー）と DecisionRecord（言語非依存の選択記録。`note` に FR4.2 の任意判断メモを保持し採点非依存）、result 側は DimensionOutcome / LearningResult / AdoptionReviewMemo（いずれも sessionId で紐づく。Domain Design の canonical 名・属性に整合）。評価 Dimension は固定 9 軸で、Scenario ごとに変わる Learning Concept（`conceptId`）とは別体系。表示文言はすべて locale key 経由で、entity/semantic data は表示言語に依存しない（identity・evaluation・traceability・persisted progress は ja/en で不変）。型・制約の実装（具体的な validator）は code-generation で行う。
