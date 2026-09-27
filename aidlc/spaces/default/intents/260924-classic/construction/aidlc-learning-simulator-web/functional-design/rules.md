# Business Rules — U1: aidlc-learning-simulator-web

> 技術非依存の business rule（IF…THEN を平文で）。ID は `BR{group}.{seq}` 形式（traceability sensor が認識）。source は FR-n/NFR-n/ADR/C-n。決定性・データ/ロジック分離・provenance 追跡・UI 非所有を rule として明文化する。

```yaml
rules:
  # --- BR1: Scenario 検証境界（ScenarioLoader / ADR-003 / C5 / FR12） ---
  - id: BR1.1
    statement: raw Scenario JSON は起動時に schema validation を通す
    category: validation
    applies_to: ScenarioSet
    trigger: アプリ起動時の Scenario ロード
    logic: "IF raw JSON が schema に適合しない THEN ScenarioValidationError を発行し、その Scenario を validated definition に変換しない"
    violation_behavior: "該当 Scenario を開始しない・readable error・silent fallback しない"
    source: [FR12, C5, ADR-003]
  - id: BR1.2
    statement: unknown フィールドは reject する
    category: validation
    applies_to: ScenarioSet
    trigger: schema validation
    logic: "IF 未知キーが存在 THEN reject（silent ignore しない）"
    violation_behavior: ScenarioValidationError
    source: [C5, FR12]
  - id: BR1.3
    statement: stable-ID は同一 ScenarioSet 内で一意
    category: constraint
    applies_to: [Scenario, Stage, DecisionPoint, DecisionOption, LearningPoint, ProvenanceEntry, EffectRule]
    trigger: validation
    logic: "IF 同種 ID が重複 THEN reject"
    violation_behavior: ScenarioValidationError
    source: [ADR-003]
  - id: BR1.4
    statement: 全参照（*Refs / nextRef / dimensionId）は同一 ScenarioSet 内の owner を指す
    category: validation
    applies_to: [DecisionPoint, DecisionOption, LearningPoint, EffectRule, Scenario]
    trigger: cross-reference validation
    logic: "IF 参照先 ID が存在しない THEN dangling reference として reject"
    violation_behavior: ScenarioValidationError
    source: [ADR-003]
  - id: BR1.5
    statement: cardinality 制約を検証する
    category: validation
    applies_to: [Scenario, DecisionPoint, LearningPoint]
    trigger: validation
    logic: "IF stages<1 / learningObjectiveIds<1 / DecisionPoint.options<2 / LearningPoint.provenanceRefs<1 THEN reject"
    violation_behavior: ScenarioValidationError
    source: [FR12]
  - id: BR1.6
    statement: provenance invariant を検証する
    category: validation
    applies_to: [DecisionPoint, LearningPoint, ProvenanceEntry]
    trigger: validation
    logic: "IF important な DecisionPoint に provenanceRefs が無い、または category=ai-dlc-spec の ProvenanceEntry に reference が無い THEN reject"
    violation_behavior: ScenarioValidationError
    source: [FR6, FR6.8, NFR3]
  - id: BR1.7
    statement: supported schemaVersion のみ受け入れる
    category: validation
    applies_to: ScenarioSet
    trigger: validation
    logic: "IF schemaVersion が supported 集合に無い THEN reject（unknown Scenario schemaVersion は reject）"
    violation_behavior: ScenarioValidationError
    source: [FR12]
  - id: BR1.8
    statement: 一部 Scenario のみ invalid のとき valid を全滅させない
    category: policy
    applies_to: ScenarioCatalog
    trigger: ロード集計
    logic: "IF 一部 Scenario が invalid THEN それを利用可能一覧から除外し、どれを読めなかったか明示。valid Scenario は利用可能に保つ。IF 全 Scenario invalid THEN Application shell は起動し Scenario unavailable state を表示"
    violation_behavior: 明示エラー表示（無言停止しない）
    source: [FR12]

  # --- BR2: 進行（ScenarioProgression / ADR-011） ---
  - id: BR2.1
    statement: 進行状態は not-started/in-progress/completed/errored の lifecycle に従う
    category: constraint
    applies_to: ScenarioSession
    trigger: 進行操作
    logic: "IF 未開始 THEN not-started。開始後 completed 前は in-progress（currentStageId を保持）。全 Stage 完了で completed。runtime 不整合で errored"
    violation_behavior: DomainInvariantError
    source: [FR4]
  - id: BR2.2
    statement: runtime invariant 違反は DomainInvariantError（ScenarioProgression 所有）
    category: constraint
    applies_to: ScenarioProgression
    trigger: 進行中の不整合検出
    logic: "IF 存在しない DecisionPoint への進行や矛盾した状態遷移 THEN DomainInvariantError（silent に部分状態を進めない）"
    violation_behavior: errored state・DomainInvariantError
    source: [ADR-011, NFR2]
  - id: BR2.3
    statement: DecisionRecord は選択された DecisionOption を stable ID で参照する
    category: constraint
    applies_to: DecisionRecord
    trigger: decision 記録
    logic: "IF option 選択 THEN chosenDecisionOptionId を stable ID で記録（表示文言を保存しない）"
    violation_behavior: DomainInvariantError
    source: [FR4, ADR-006]
  - id: BR2.4
    statement: Decision workflow は awaiting-decision→decision-recorded→feedback-available→(next-decision|completed)
    category: policy
    applies_to: ScenarioProgression
    trigger: decision 操作
    logic: "IF awaiting-decision で option 選択 THEN decision-recorded→feedback-available。以降 next-decision か completed へ"
    violation_behavior: DomainInvariantError
    source: [FR4]
  - id: BR2.5
    statement: 各 Decision の任意判断メモ（DecisionRecord.note）は保存され、採点に影響せず、結果/Adoption Sheet で再確認できる
    category: policy
    applies_to: [DecisionRecord, ProgressStore, ResultModel, AdoptionSheetComposer]
    trigger: decision 記録・保存・結果表示・Sheet 生成
    logic: "IF ユーザーがメモを入力 THEN DecisionRecord.note に生テキストで保持。評価入力には含めない（採点非依存、BR3.1）。ProgressStore が stable-ID とともに永続化し、Result/Reflection と Adoption Discussion Sheet で再確認できる"
    violation_behavior: メモ喪失・採点への混入は不可
    source: [FR4.2]

  # --- BR3: 決定的評価（DimensionEvaluator / ADR-005 / NFR2） ---
  - id: BR3.1
    statement: 評価入力は DecisionRecord 列・immutable Scenario context・DecisionEffectRules・ApprovalSemantics のみ
    category: calculation
    applies_to: DimensionEvaluator
    trigger: 評価実行
    logic: "IF 評価 THEN 上記のみを入力とし、UI/locale/mode/current time/random を入力にしない"
    violation_behavior: 非決定的評価は不可（禁止）
    source: [NFR2, FR5, ADR-005]
  - id: BR3.2
    statement: 同一 semantic input + 同一 decision sequence は同一結果（決定性）
    category: calculation
    applies_to: DimensionEvaluator
    trigger: 評価実行
    logic: "IF 入力が同一 THEN DimensionOutcome も同一（反復・順序入替に対し安定。集合＋順序を明示的に扱う）"
    violation_behavior: テストで検出（golden・順序不変性）
    source: [NFR2, team:Testing Posture]
  - id: BR3.3
    statement: contribution は離散 5 段階で表現する
    category: calculation
    applies_to: EffectRule
    trigger: 評価畳み込み
    logic: "IF contribution THEN {strong-negative,negative,neutral,positive,strong-positive} のいずれか（authoring は意味名、実装内部で数値 map 可）"
    violation_behavior: ScenarioValidationError（範囲外）
    source: [FR5.4.2]
  - id: BR3.4
    statement: 非単調性は Dimension ごとに定義する
    category: calculation
    applies_to: [Dimension, DimensionEvaluator]
    trigger: 評価畳み込み
    logic: "IF dimension が non-monotonic（delegation-quality/approval-boundary/risk-handling）THEN 過少介入も過剰介入も negative 側へ寄せる。IF monotonic THEN 単調に扱う"
    violation_behavior: 設計・テストで担保
    source: [FR5.2, FR5.4]
  - id: BR3.5
    statement: 評価は 9 Dimension を必ず出力し、UI に評価ロジックを置かない
    category: constraint
    applies_to: [LearningResult, DimensionEvaluator]
    trigger: 評価実行
    logic: "IF 評価完了 THEN 固定 9 Dimension の DimensionOutcome を出力。UI は結果を表示するのみ"
    violation_behavior: DomainInvariantError（Dimension 欠落）
    source: [FR5.4.1, FR5.4.2, ADR-009]
  - id: BR3.6
    statement: 評価 invariant 違反は DomainInvariantError（silent partial score を返さない）
    category: constraint
    applies_to: DimensionEvaluator
    trigger: 評価中の不整合
    logic: "IF 評価に必要な context/rule が不整合 THEN DomainInvariantError（部分スコアを黙って返さない）"
    violation_behavior: errored・DomainInvariantError
    source: [NFR2, ADR-011]
  - id: BR3.7
    statement: DimensionOutcome は寄与した EffectRule を保持する（説明可能性）
    category: calculation
    applies_to: DimensionOutcome
    trigger: 評価
    logic: "IF Outcome 算出 THEN contributingDecisionRecordIds を保持し、判断理由を追跡可能にする（chosenDecisionOptionId→effectRuleRefs→EffectRule で provenance/rationale を辿る）"
    violation_behavior: 説明不能な結果は不可
    source: [FR5, NFR3]

  # --- BR4: provenance / 教育的正確性（FR6 / FR6.8 / NFR3） ---
  - id: BR4.1
    statement: provenance は 4 区分で識別する
    category: policy
    applies_to: ProvenanceEntry
    trigger: 表示・検証
    logic: "IF provenance THEN {ai-dlc-spec, harness-behavior, simulator-interpretation, simulation-assumption} のいずれかで区別"
    violation_behavior: ScenarioValidationError（不正 category）
    source: [FR6.8, NFR3]
  - id: BR4.2
    statement: 4 区分は色のみに依存せず label+icon+text で区別表示する
    category: policy
    applies_to: UI(provenance 表示)
    trigger: 表示
    logic: "IF provenance 表示 THEN label + icon + 明示テキスト（色だけに依存しない、accessibility）"
    violation_behavior: a11y 違反
    source: [FR6.8, NFR4]
  - id: BR4.3
    statement: 重要 Decision/主要 LearningPoint は provenance を必須参照する
    category: constraint
    applies_to: [DecisionPoint, LearningPoint]
    trigger: validation
    logic: "IF important DecisionPoint / LearningPoint THEN provenanceRefs>=1"
    violation_behavior: ScenarioValidationError
    source: [FR6, NFR3]

  # --- BR5: i18n / mode 不変（ADR-006 / FR10） ---
  - id: BR5.1
    statement: 表示言語は semantic result を変えない
    category: constraint
    applies_to: [DimensionEvaluator, ScenarioProgression, LearningResult]
    trigger: 言語切替
    logic: "IF locale 変更 THEN identity/evaluation/traceability/persisted progress は不変（locale key 解決のみが変わる）"
    violation_behavior: テストで検出（i18n 不変性）
    source: [FR10, ADR-006, NFR2]
  - id: BR5.2
    statement: experience mode は評価を変えない
    category: constraint
    applies_to: [ExperiencePolicy, DimensionEvaluator]
    trigger: mode 切替
    logic: "IF mode（Guided/Simulation/Adoption Review）変更 THEN 同一 engine・同一評価。提示ポリシーのみ変わる"
    violation_behavior: テストで検出（mode 不変性）
    source: [FR2, ADR-006]
  - id: BR5.3
    statement: 翻訳欠落を可視化する
    category: validation
    applies_to: LocaleResources
    trigger: locale key 解決
    logic: "IF key 未定義 THEN blank/undefined を表示せず、dev/test で検出・production でも欠落を明示"
    violation_behavior: missing key 明示
    source: [FR10, NFR1]

  # --- BR6: 永続化（ProgressStore / ADR-008 / FR11） ---
  - id: BR6.1
    statement: 永続化は stable-ID ベースで表示文言に依存しない
    category: constraint
    applies_to: ProgressStore
    trigger: 保存/復元
    logic: "IF 保存 THEN stable ID で保存（表示文言を保存しない）。domain object と localStorage 表現を同一視しない"
    violation_behavior: PersistenceError
    source: [FR11, ADR-008]
  - id: BR6.2
    statement: persistenceSchemaVersion を検証し非互換は safe reset/明示 migration
    category: policy
    applies_to: ProgressStore
    trigger: 復元
    logic: "IF persistenceSchemaVersion 非互換 THEN safe reset または明示 migration（silent coercion 禁止）。Scenario schemaVersion とは独立"
    violation_behavior: safe reset・ユーザー通知
    source: [FR11]
  - id: BR6.3
    statement: 破損した永続データは domain へ渡さず safe reset する
    category: constraint
    applies_to: ProgressStore
    trigger: 復元時の破損検出
    logic: "IF localStorage が破損 THEN PersistenceError→破損 object を domain へ渡さない→safe reset→ユーザー通知"
    violation_behavior: PersistenceError・safe reset
    source: [FR11, ADR-011]

  # --- BR7: Adoption / 承認境界（FR7 / FR8 / C6 / OOS3） ---
  - id: BR7.1
    statement: Adoption Discussion Sheet は決定的に生成する
    category: calculation
    applies_to: AdoptionSheetComposer
    trigger: Sheet 生成
    logic: "IF 同一入力 THEN 同一 Markdown（決定的）。Composer は LocaleResources に直接依存せず locale bundle を受け取る"
    violation_behavior: テストで検出（golden）
    source: [FR8, ADR-006]
  - id: BR7.2
    statement: Adoption Sheet は議論材料であり確定物ではない
    category: policy
    applies_to: AdoptionReviewMemo
    trigger: Sheet 提示
    logic: "IF Sheet 提示 THEN 導入設計の自動確定物として扱わない（議論材料）"
    violation_behavior: —
    source: [OOS3, FR8.3]
  - id: BR7.3
    statement: AI-DLC 工程完了承認と AWS Release Approval を同一視しない
    category: policy
    applies_to: ApprovalSemantics
    trigger: 承認関連の学習・表示
    logic: "IF 承認概念を扱う THEN Completion Approval と Release Approval を別概念として区別（混同を誤りとして学べる）"
    violation_behavior: 教材上の誤り
    source: [C6, FR2.2]

  # --- BR8: UI 責務境界（ADR-009） ---
  - id: BR8.1
    statement: UI は domain logic を所有しない
    category: constraint
    applies_to: UI(/ui)
    trigger: 実装
    logic: "IF UI THEN render/user intent/accessibility/presentation state のみ。evaluation/progression rule/ApprovalSemantics/effect rule interpretation/ID 生成/persistence serialization semantics を持たない"
    violation_behavior: 設計違反（レビュー/テストで検出）
    source: [ADR-009, NFR5]
  - id: BR8.2
    statement: runtime semantic ID は time/random 非依存で導出する
    category: calculation
    applies_to: [ScenarioProgression, ResultModel]
    trigger: runtime ID 生成
    logic: "IF runtime ID 生成 THEN semantic key 由来で決定的に導出（Date/Math.random/performance.now 非依存）"
    violation_behavior: ESLint 静的排除・テストで検出
    source: [NFR2, team:Testing Posture]
```

## Rules 概要（human-readable）

| Group | 主題 | 主要 source |
|---|---|---|
| BR1 | Scenario 検証境界（schema/unknown reject/uniqueness/dangling/cardinality/provenance invariant/schemaVersion/部分 invalid） | FR12, C5, ADR-003 |
| BR2 | 進行 lifecycle・DomainInvariantError・判断メモ（採点非依存の永続/再表示） | FR4, FR4.2, ADR-011 |
| BR3 | 決定的・非単調（Dimension 別）評価、説明可能性、UI 非評価 | NFR2, FR5, ADR-005/009 |
| BR4 | provenance 4 区分・必須参照・色非依存表示 | FR6, FR6.8, NFR3, NFR4 |
| BR5 | i18n/mode 不変・翻訳欠落可視化 | FR10, ADR-006 |
| BR6 | 永続化 stable-ID・persistenceSchemaVersion・safe reset | FR11, ADR-008 |
| BR7 | Adoption Sheet 決定性・議論材料・承認境界分離 | FR7/FR8, C6, OOS3 |
| BR8 | UI 責務境界・runtime ID 決定性 | ADR-009, NFR2 |

Traceability != Verification: 本 rules は設計上の契約であり、充足は Build & Test で検証する。
