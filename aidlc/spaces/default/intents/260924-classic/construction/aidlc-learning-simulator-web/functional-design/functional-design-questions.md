# Functional Design — 計画質問（U1: aidlc-learning-simulator-web）

> Construction / Functional Design（3.1）。U1（唯一の AI-DLC Unit・UI kind）の機能設計を、Domain Design（entity shape / ADR）・Requirements（FR/NFR）・Contract Design（No Contract、Scenario JSON は internal boundary で schema 詳細は本ステージへ委譲）を踏まえて確定します。**技術非依存の設計**（コード・SQL・framework 参照なし、短い擬似コードのみ）。ここで決めるのは Domain Design が ownership/shape レベルに留めた項目の**具体化**（型・制約・cardinality）と、workflow / state machine / evaluation rule 構造 / Scenario JSON schema / frontend components です。
>
> 実装は skeleton-first（B1: 1 Scenario を検証→進行→決定的評価→結果表示）で始めますが、Functional Design は U1 全体の機能仕様を対象とします（各 slice の実装順は Delivery Planning）。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。推奨案を各質問に付けています。

---

## Q1. Scenario JSON schema のトップレベル構造（Contract Design から委譲）

Scenario JSON（build-time asset、ScenarioLoader が検証）のトップレベル構造をどう固定しますか。Domain Design の entity（Scenario / Stage / DecisionPoint / DecisionOption / LearningPoint / ProvenanceEntry）を反映します。

- A. **entity 階層をそのまま反映（推奨）**: `scenario`（scenarioId, kind, learningObjectiveIds[], stages[], tags[], provenanceRefs[]）→ `stage`（stageId, decisionPoints[]）→ `decisionPoint`（decisionPointId, prompt-key, options[]）→ `decisionOption`（optionId, effectRuleRefs[], provenanceRefs[]）→ `learningPoint`（learningPointId, conceptId, provenanceRefs[], betterAlternativeRef?）。表示文言は locale key で持ち JSON に生文言を埋めない。
- B. 別構造（補足してください）
- X. Other (please specify)

[Answer]: B（推奨案ベースに調整）。トップレベルで schema 管理と参照 owner を明確化する。概念構造: `schemaVersion:1` / `scenario{ scenarioId(stable), kind, learningObjectiveIds[1..n], stages[1..n], learningPoints[1..n], tags[0..n], provenanceRefs[0..n] }` / `effectRules[0..n]`（scenario と同階層で一意所有）/ `provenanceEntries[0..n]`（同階層で一意所有）。stage{ stageId, decisionPoints[0..n] }。decisionPoint{ decisionPointId, promptKey, options[2..n 基本], learningPointRefs[0..n], provenanceRefs[1..n for Important Decision Point] }。decisionOption{ optionId, labelKey, effectRuleRefs[0..n], provenanceRefs[0..n], nextRef/transition semantic }。learningPoint{ learningPointId, conceptId, titleKey, bodyKey, provenanceRefs[1..n], betterAlternativeRef? }。effectRule{ effectRuleId, dimensionId, contribution, condition? }。provenanceEntry{ provenanceId, category, reference?, noteKey }。表示文言は JSON に直接持たず locale key を使う。effectRuleRefs[]/provenanceRefs[] の参照先は同一 validated Scenario definition 内で一意所有。ScenarioLoader は schema / stable-ID uniqueness / dangling reference なし / cardinality / provenance invariant / transition reference / supported schemaVersion を検証し、raw JSON を Catalog へ直接渡さず validated immutable definition へ変換する。

---

## Q2. unknown field / 厳格 validation の方針（Contract Design open question）

ScenarioLoader の schema validation で、未知フィールドをどう扱いますか。

- A. **未知フィールドは reject（推奨・fail-fast 一貫）**: 厳格 schema で未知キーをエラーにする（silent ignore しない）。additive な拡張は schema 側を明示的に更新して受け入れる。C5/FR12 の fail-fast と整合。
- B. 未知フィールドは ignore（前方互換を優先）
- X. Other (please specify)

[Answer]: A（未知フィールドは reject）。build-time asset で外部互換 API ではなく fail-fast 方針。typo を silent ignore すると教材内容の誤りを見逃すため。additive extension は schema を明示更新して受け入れる。

---

## Q3. Scenario schema version と persistence schemaVersion（別概念として確定）

2 つの version をどう扱いますか（Delivery Planning で「別概念」と確定済み）。

- A. **完全分離（推奨）**: Scenario JSON に `schemaVersion`（Scenario データ構造の版）を持ち、ScenarioLoader が対応版か検証。ProgressStore の localStorage には別の `persistenceSchemaVersion`（保存形式の版）を持ち、互換でなければ safe reset。両者は互いに独立に上げられる。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（完全分離）。Scenario 側 `schemaVersion`（Scenario データ構造の版、ScenarioLoader が対応版を検証）と Persistence 側 `persistenceSchemaVersion`（localStorage 保存形式の版、ProgressStore が検証、非互換時は safe reset または明示 migration）を別概念として固定。両 version は独立に version up 可能。**Scenario schema 変更を理由に自動的に persistenceSchemaVersion を上げない**。

---

## Functional Design の source-of-truth 原則（確定）

- Evaluation Dimension と Learning Concept を分離。
- Scenario JSON は authoring data、validated domain definition とは別物。
- semantic data と display string を分離。
- UI は domain logic を所有しない。
- Experience mode は evaluation を変更しない。
- Locale は evaluation を変更しない。
- stable-ID は time/random 非依存。
- Traceability != Verification。
- Completion Approval != Release Approval。

---

## Q4. 9 Dimension 評価モデルの rule 構造（FR5.4 / OQ4）

DimensionEvaluator の非単調・決定的評価を data-driven（DecisionEffectRules）でどう表現しますか。

- A. **effect-rule テーブル方式（推奨）**: 各 DecisionOption が 0..n の `effectRule` を参照。effectRule は `{ dimensionId, contribution, condition? }`（contribution は方向と度合いを持つ離散値、condition は Scenario context 依存の任意述語）。DimensionEvaluator は選択された DecisionRecord 列 × effectRule を決定的に畳み込み各 DimensionOutcome を算出。非単調性は「介入過多」「過剰委任」双方に負方向 contribution を置くことで表現。UI に評価ロジックを置かない。
- B. 別方式（補足してください）
- X. Other (please specify)

[Answer]: A（effect-rule テーブル方式）＋明確化。effectRule = { effectRuleId, dimensionId, contribution, condition?, **rationale / learningPointRef?**（評価理由を説明可能にする） }。contribution は連続値ではなく**有限の離散 5 段階**（strong-negative / negative / neutral / positive / strong-positive、意味的に同等な 5 段階でよい。実装時に内部数値へ mapping 可だが authoring 側は意味名）。**非単調は全 Dimension に強制しない**——Delegation Quality / Approval Boundary / Risk Handling は過少・過剰の双方を悪化させる非単調性が重要、Requirement Clarity 等は「高すぎると悪い」にしなくてよい。**Dimension ごとに評価特性を定義**する。DimensionEvaluator = selected DecisionRecord sequence + immutable Scenario context + DecisionEffectRules + ApprovalSemantics → deterministic DimensionOutcome。UI / locale / mode / current time / random 値は評価入力にしない。

---

## Q5. 9 Dimension の具体セット（FR2/FR5）

評価する 9 Concept/Decision Dimension を確定します。要件の学習コンセプト（Change Control / delegation boundary / evidence & traceability / testing contract / approval 後の変更 / risk-based intervention / 工程完了承認 vs Release Approval 等）に対応させます。

- A. **推奨 9 Dimension**: (1) Requirement Clarity, (2) Acceptance Criteria Coverage, (3) Human/Agent Delegation Appropriateness, (4) Approval Boundary Handling, (5) Evidence & Traceability, (6) Testing Contract & 「実行済み」区別, (7) Change After Approval Handling, (8) Risk/Reversibility-aware Intervention, (9) Completion-vs-Release Distinction。各 Dimension は非単調（過剰・過少の双方が悪い側）。
- B. セットを調整（追加・削除・改名を補足してください）
- X. Other (please specify)

[Answer]: B（評価 Dimension と Learning Concept を分離）。**評価 Dimension（9 軸・全 Scenario 共通の評価モデル）**: 1. Requirement Clarity, 2. Acceptance Criteria Coverage, 3. Evidence Quality, 4. Approval Boundary, 5. Delegation Quality, 6. Risk Handling, 7. Traceability, 8. Rework, 9. Remaining Risks。以前の項目（Human/Agent Delegation Boundary / Testing Contract・executed vs planned / Change After Approval / Risk-Reversibility-aware Intervention / Completion Approval vs Release Approval / Evidence & Traceability / Change Control）は Dimension ではなく **Learning Concept / Decision Concept** として扱う。Concept→Dimension mapping 例: Human/Agent Delegation→Delegation Quality/Approval Boundary/Risk Handling ; Testing Contract・未実行 test を passed 扱い→Evidence Quality/Acceptance Criteria Coverage/Traceability/Remaining Risks ; Change After Approval→Approval Boundary/Traceability/Rework/Risk Handling ; Evidence 不足→Evidence Quality/Traceability/Remaining Risks ; Risk/Reversibility-aware Intervention→Risk Handling/Delegation Quality ; Completion vs Release Approval→Approval Boundary/Remaining Risks/Traceability。**Rework と Remaining Risks を残す**ことで「悪かった」で終わらず、どれだけやり直しを生んだか・最後に何のリスクが残ったかを学べる。Scenario ごとに Concept は異なっても Result は常に同一 9 Dimension で比較・振り返り可能。

---

## Q6. 主要 workflow / state machine（functional-spec の source of truth）

U1 の主要 workflow と状態遷移をどう定義しますか。

- A. **推奨**: (a) Core Guided flow の state machine（Home → ModeSelect → ScenarioIntro → (DecisionPoint ↔ Feedback)* → Result → Reflection → AdoptionReview?）、(b) Scenario progression の状態（not-started / in-progress(stageIndex) / completed / errored）、(c) ScenarioLoader の起動時 validation flow（load → validate → (ok→Catalog 構築 | fail→ValidationError→error state)）、(d) Focus/Simulation は同一 Scenario Shell を再利用。lifecycle entity（ScenarioProgress）の遷移を functional-spec に明記。
- B. 別定義（補足してください）
- X. Other (please specify)

[Answer]: A（採用）＋ presentation と domain の状態分離。UI/View flow: Home → ModeSelect → ScenarioIntro → Decision → Feedback → Decision… → Result → Reflection → AdoptionReview。Domain 側 ScenarioProgress state: not-started / in-progress / completed / errored（`stageIndex` 等は status そのものではなく in-progress state の data として保持）。Decision workflow（意味的に）: awaiting-decision → decision-recorded → feedback-available → next-decision | completed。Guided / Simulation / Adoption Review で別 engine を作らず同一 Scenario Engine と ExperiencePolicy を共有。ScenarioLoader: load → validate →（valid: validated definitions → Orchestrator → Catalog）／（invalid: ScenarioValidationError → Error presentation）。

---

## Q7. frontend components 階層（UI unit・frontend-components.md）

主要 React component 階層と責務分担をどう置きますか（presentation は domain を汚さない）。

- A. **推奨**: `App`（結線・routing 相当の view 切替）→ `HomeView` / `ModeSelectView` / `ScenarioView`（`StagePanel` → `DecisionPointPanel` → `DecisionOptionList` / `FeedbackPanel` / `ProvenanceBadge`）/ `ResultView`（`DimensionResultList` / `ReflectionPanel`）/ `AdoptionReviewView`（`AdoptionSheetPreview`）/ `FocusLibraryView` / `ErrorView`（malformed Scenario）。共通: `LocaleProvider`, `A11yLiveRegion`(aria-live)。state は ApplicationOrchestrator 経由の domain service 呼び出しで駆動し、UI に評価/進行ロジックを持たせない。
- B. 別階層（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋ 責務境界明確化。提示階層で進めるが `App` に domain orchestration そのものを持たせず、ApplicationOrchestrator を **presentation adapter 経由**で利用する。UI component の責務は render / user intent 取得 / accessibility / presentation state のみ。UI へ置かない: evaluation calculation / Scenario progression rule / ApprovalSemantics / effect rule interpretation / deterministic ID generation / persistence serialization semantics。`LocaleProvider` は semantic object を書き換えず、stable locale key → display string の解決のみ担当。

---

## Q8. provenance 4 区分の表示・データモデル（B3・FR6.8）

ProvenanceEntry（provenanceId, category, reference, note）の category と表示をどう固定しますか。

- A. **推奨**: category enum = `ai-dlc-spec` / `harness-behavior` / `simulator-interpretation` / `simulation-assumption` の 4 値。重要 LearningPoint は 1..n の ProvenanceEntry を必須参照（ScenarioLoader が invariant 検証）。UI は 4 区分を label + icon + 明示テキストで区別表示（色のみに依存しない）。`ai-dlc-spec` は AI-DLC v2.10.0 一次情報 reference を持つ。
- B. 別定義（補足してください）
- X. Other (please specify)

[Answer]: A（採用）。category 固定 4 値: ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption。表示は色のみに依存せず label + icon + explicit text。追加 invariant: `ai-dlc-spec`→AI-DLC v2.10.0 primary reference 必須 ; `harness-behavior`→harness/runtime 固有根拠を持つ ; `simulator-interpretation`→Simulator による interpretation であることを明示 ; `simulation-assumption`→教育上の仮定であることを明示。Important Decision Point および主要 LearningPoint は 1..n provenanceRefs 必須。詳細 reference は progressive disclosure でよいが category label 自体は decision 後に確認可能にする。

---

## Q9. error / edge case（FR12・NFR2）

malformed Scenario・空 state・破損 localStorage 等の扱いを確定します。

- A. **推奨**: (a) malformed Scenario → ScenarioValidationError → ErrorView（どの Scenario が読めなかったか可読表示、正常教材として開始しない、silent fallback なし）。(b) 破損 localStorage → PersistenceError → safe reset（進行を捨てて初期化、ユーザーに通知）。(c) 翻訳欠落 → 検出してキーを可視化（無言で空表示にしない）。(d) 全 Scenario ロード失敗 → アプリは起動するが「Scenario を読み込めません」を明示。決定性は保持（エラーパスも同一入力→同一挙動）。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）。malformed Scenario→ScenarioValidationError→該当 Scenario を開始しない・readable error・silent fallback なし。一部 Scenario のみ invalid→valid Scenario まで全滅させない・invalid を利用可能一覧から除外・読み込めなかった Scenario を明示。全 Scenario invalid→Application shell は起動・Scenario unavailable state を表示。corrupted persistence→PersistenceError→domain へ破損 object を渡さない・safe reset・ユーザー通知。unsupported persistenceSchemaVersion→safe reset または明示 migration・silent coercion 禁止。missing locale→blank にしない・dev/test で missing key を検出・production でも undefined を表示しない。unknown Scenario schemaVersion→reject。dangling ID/reference→reject。evaluation invariant violation→DomainInvariantError・silent partial score を返さない。error path も決定的（同一 semantic input + 同一 decision sequence で error classification も同一）。

---

## Consolidated Summary Confirmation

以下で U1 の Functional Design 成果物（entities.md / rules.md / functional-spec.md / traceability.json / frontend-components.md）を生成します。生成前に確認してください。技術非依存の設計（コード・SQL・framework 参照なし）。

- **Scenario JSON schema**: scenario 階層 + effectRules[] + provenanceEntries[] をトップレベルで一意所有。参照（effectRuleRefs/provenanceRefs/learningPointRefs/transition nextRef）を同一 validated definition 内で解決。文言は locale key。ScenarioLoader が schema/stable-ID uniqueness/dangling reference/cardinality/provenance invariant/transition/schemaVersion を検証し validated immutable definition へ変換。unknown field は reject。
- **version 分離**: Scenario `schemaVersion`（Loader 検証）と Persistence `persistenceSchemaVersion`（ProgressStore 検証・非互換は safe reset）は独立。
- **評価モデル**: effect-rule table 方式。effectRule{ effectRuleId, dimensionId, contribution(離散5段階), condition?, rationale/learningPointRef? }。非単調は Dimension ごとに定義（Delegation/Approval/Risk は非単調、Requirement Clarity 等は単調でよい）。DimensionEvaluator は DecisionRecord 列 + immutable context + DecisionEffectRules + ApprovalSemantics → deterministic DimensionOutcome。UI/locale/mode/time/random は評価入力にしない。
- **評価 Dimension（9 軸・固定）**: Requirement Clarity / Acceptance Criteria Coverage / Evidence Quality / Approval Boundary / Delegation Quality / Risk Handling / Traceability / Rework / Remaining Risks。**Learning Concept とは分離**し Concept→Dimension mapping で紐づける。
- **workflow / state machine**: UI flow（Home→ModeSelect→ScenarioIntro→Decision→Feedback→…→Result→Reflection→AdoptionReview）と domain ScenarioProgress（not-started/in-progress/completed/errored）を分離。Decision workflow（awaiting-decision→decision-recorded→feedback-available→next|completed）。Guided/Simulation/Adoption Review は同一 engine + ExperiencePolicy を共有。
- **frontend components**: App→各 View→panel。UI は render/intent/a11y/presentation state のみ。evaluation/progression/ApprovalSemantics/effect rule/ID 生成/persistence semantics を UI に置かない。Orchestrator は presentation adapter 経由。
- **provenance**: 4 値 enum + 区分別 invariant、label+icon+text で表示、Important Decision/主要 LearningPoint は 1..n 必須。
- **error/edge**: FR12 準拠の validation 失敗・部分 invalid の除外・safe reset・翻訳欠落可視化・dangling reject・DomainInvariantError。決定性は error path も同一。
- **source-of-truth 原則**: Dimension≠Concept / authoring data≠domain definition / semantic≠display / UI は domain 非所有 / mode・locale は評価不変 / stable-ID は time-random 非依存 / Traceability != Verification / Completion Approval != Release Approval。
- **traceability.json**: U1 の各 acceptance criterion を BRx.y へ対応（Coverage != Verification）。

- Looks correct
- Request changes

[Answer]: Looks correct
