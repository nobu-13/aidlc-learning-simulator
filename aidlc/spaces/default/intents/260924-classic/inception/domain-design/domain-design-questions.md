# Domain Design — Design Plan Questions

> requirements（FR/NFR, v2.10.0 baseline）と user-stories（US1.1〜US8.2）、refined-mockups から、論理的な building block（＝書くコード。infra ではない）を特定します。Refined Mockups 申し送りの 11 の意味論不変（同一 Engine/Shell、Decision は 7 種 enum の Scenario 依存 subset、provenance 4 区分固定、boundary≠gate、Completion Approval≠Release Approval、9 Dimension 決定的評価、UI に暗黙評価ロジックを持たせない、same input→same result、ja/en で結果不変、malformed は境界検出で silent fallback しない、Adoption Sheet 生成も決定的）と、UI から独立した semantic model という方針を前提にします。各 `[Answer]:` に記号で回答してください。

## Q1. domain（純ロジック）コンポーネントの分割

`/domain` を論理コンポーネントとしてどう分割しますか（複数選択で組合せ可）。

- A. 役割ごとに分ける: **ScoringEvaluator**（9 Dimension 評価）/ **ScenarioProgression**（Stage/Decision 進行の状態遷移）/ **RequirementCoverage**（要求カバレッジ判定）/ **ApprovalBoundaryEvaluator**（承認境界・Completion vs Release 判定）/ **AdoptionSheetComposer**（Markdown 生成）
- B. 粗く 2 つ: **ScenarioEngine**（進行）/ **Evaluator**（評価全般）にまとめる
- C. A を基本に、さらに細かく Decision ごとの Dimension 寄与ルールを独立させる
- X. Other (please specify)

[Answer]: X（A 基本＋調整。コンポーネント: ScenarioProgression（Stage/Decision/Return/Change Scope 等の状態遷移、Scenario Session の純粋な進行ロジック）/ DimensionEvaluator（別名 EvaluationEngine。9 Dimension の決定的評価。`ScoringEvaluator` は避ける——単一 score でなく multi-dimensional evaluation）/ DecisionEffectRules（Decision→Dimension contribution を表す決定的 rule/data、UI 完全独立、EvaluationEngine が読む、Decision ごとに class 量産せず data-driven rule set）/ ApprovalSemantics（agent execution boundary / human-controlled approval gate / AI-DLC Completion Approval / Release Approval の意味論・判定）/ AdoptionSheetComposer（LearningResult/DecisionRecord/Adoption memo から決定的に Markdown を生成する pure service）。RequirementCoverage は独立させない——Requirement Clarity / Acceptance Criteria Coverage は 9 Dimension の一部として EvaluationEngine 配下の rule で扱い、独立責務が明確になった場合のみ後で分離。過度な細分化を避ける）

## Q2. Scenario / Decision / Dimension / provenance の semantic model（entity 所有）

UI から独立した semantic model の entity 所有をどうしますか。

- A. **ScenarioCatalog** コンポーネントが Scenario / DecisionPoint / DecisionOption / Provenance(sourceRefs) entity を所有し、`/domain` の評価系はそれを入力として読むだけ（データ所有と評価ロジックを分離）
- B. 評価コンポーネントが Scenario も所有する（データと評価を同居）
- C. A に加え、LearningResult / DimensionOutcome / DecisionRecord を別の **ResultModel** コンポーネントが所有
- X. Other (please specify)

[Answer]: C（ScenarioCatalog が authoring/source 側 entity を所有: Scenario / Stage / DecisionPoint / DecisionOption / LearningPoint / Dimension contribution rule reference / provenance reference。ResultModel が実行結果側を所有: LearningResult / DimensionOutcome / DecisionRecord / RemainingRisk / Rework / Reflection・Result projection に必要な semantic result。ただし `ProvenanceEntry` は ScenarioCatalog 専用の内部型に閉じ込めず、Scenario/Result 双方から参照可能な **shared semantic value object** として設計。DecisionRecord は Scenario 定義でなく実行時に ScenarioProgression が生成する runtime record で、ResultModel が結果として保持・参照する）

## Q3. sourceRefs / provenance schema の確定（OQ1/OQ2、Domain Design で確定）

保留していた provenance schema をこの stage でどう確定しますか（entity 所有と shape レベル。型詳細は Functional Design）。

- A. Provenance entity を「4 区分（category: ai-dlc-spec | harness-behavior | simulator-interpretation | simulation-assumption）+ reference（AI-DLC v2.10.0 一次情報の URL/doc パス/セクション ID/PR）+ note」の shape で確定し、DecisionPoint/LearningPoint から参照
- B. sourceRefs は単純な文字列配列に留め、区分は別途タグで持つ
- C. schema は Functional Design まで完全保留（Domain Design では entity 名のみ）
- X. Other (please specify)

[Answer]: X（A 基本＋条件明確化。4 区分 semantic taxonomy を確定: ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption。`ProvenanceEntry` の概念 shape: category / reference（optional/required 条件あり）/ note / stable id。reference は URL 限定でなく意味上 URL・repository/document path・section/anchor・revision/version を表現可能に。**category ごとの invariant**: ai-dlc-spec=AI-DLC v2.10.0 一次情報 Reference 必須 / harness-behavior=harness/runtime 固有挙動の根拠を識別可能にし AI-DLC spec として扱わない / simulator-interpretation=Simulator 独自の教育的解釈と明示、basis source があれば参照可 / simulation-assumption=Simulation 上の仮定と明示、外部 Reference 必須にはせず note で説明可能。TypeScript discriminated union 等の型詳細は Functional Design。Domain Design では semantic shape と category invariant まで固定）

## Q4. データ検証境界（malformed Scenario）のコンポーネント化

C5「外部 Scenario JSON を境界で runtime validation」をどのコンポーネントが担いますか。

- A. **ScenarioLoader/Validator**（`/data` 相当）が唯一の検証境界。JSON→domain 型へ変換し、失敗は fail-fast で可読エラー。domain は検証済みを前提に再検証しない
- B. 各 domain コンポーネントが自分で検証する
- C. A に加え、進行中の不整合検出（mid-scenario）も同コンポーネントの責務に含める
- X. Other (please specify)

[Answer]: X（責務分離。ScenarioLoader/ScenarioValidator を **唯一の raw external data validation boundary**: JSON → runtime schema validation → cross-reference/required field validation → validated domain object。失敗時は fail-fast / readable error / silent fallback なし / malformed を正常 Scenario として開始しない。mid-scenario 不整合は Loader 再実行の責務にしない。ScenarioProgression は validated Scenario を前提としつつ実行時に domain invariant guard を持ち、存在しない next Stage・不正な Decision transition・到達不能/矛盾した runtime state 等を検出したら明示的な Domain Error を返す。分離: external data validation→ScenarioLoader/Validator、runtime invariant protection→ScenarioProgression、error presentation→application/UI。同じ validation logic を各コンポーネントで重複させない）

## Q5. i18n コンテンツモデル（ja/en で結果不変）

「Scenario 内容と UI 文言を分離」「ja/en で Decision Outcome/評価結果が変わらない」を semantic model にどう落としますか。

- A. Scenario の意味データ（Decision/評価ルール/Dimension 寄与）は言語非依存の ID/enum で持ち、表示テキスト（Scenario 文言・UI 文言）は言語別の locale リソースに分離。評価系は言語非依存データのみを入力にする
- B. Scenario ごとに ja/en 両方のフルコピーを持つ
- C. まだ決めない（Functional Design で確定）
- X. Other (please specify)

[Answer]: A（semantic data は言語非依存。Evaluation への入力は stable ID / enum / decision type / dimension contribution / risk・evidence・boundary semantic data。表示用は ja locale / en locale に分離。EvaluationEngine は表示文字列を一切参照しない。したがって same Scenario semantic ID + same Decision sequence → ja/en に関係なく same Decision Outcome / same Dimension Outcome を domain architecture 上保証できる構造にする）

## Q6. 学習モード（Guided/Simulation/Adoption Review）のコンポーネント上の扱い

3 モードを semantic model でどう表現しますか（同一 Engine/Data 共有が不変）。

- A. モードは Scenario/評価データを変えない「提示ポリシー（PresentationPolicy: Guidance 量/Hint/説明量/Reflection 深さ）」として扱い、同一 ScenarioEngine/Evaluator を共有。モード差はポリシー値のみ
- B. モードごとに別の進行コンポーネントを持つ
- C. モードは UI 層のみの概念とし domain には出さない
- X. Other (please specify)

[Answer]: X（A 拡張。3 モードは別 Engine にしない。`ExperiencePolicy`（別名 ModePolicy）として表現。変更してよい: Guidance amount / Hint visibility / pre-decision support / post-decision Explanation amount / Reflection depth / Adoption-oriented prompts。変更してはいけない: Scenario semantic data / Decision meaning / DecisionEffectRules / Evaluation logic / Dimension Outcome。Adoption Review は追加 Reflection prompt を持つため名称は PresentationPolicy より ExperiencePolicy/ModePolicy を推奨。mode によって evaluation result を変えることは禁止）

## Q7. 永続化（localStorage）のコンポーネント境界

FR11（localStorage のみ）をどう扱いますか。

- A. **ProgressStore**（`/data` 相当の port/adapter）が永続化を担い、domain は永続化を知らない（ドメインは純粋、保存は境界）。破損データは安全に初期化/通知（AC7.2.3）
- B. 各コンポーネントが自分で localStorage を読み書き
- X. Other (please specify)

[Answer]: A（`ProgressStore` port/adapter。domain は localStorage を知らない。保存対象例: language / active mode / scenario progress / DecisionRecord / memo / completed scenarios / LearningResult / Adoption Review memo。adapter 側で schemaVersion / parse・validation / corrupted state handling / safe reset / quota・write failure を扱える構造。domain object と localStorage JSON representation を同一視しない）

## 追加の Domain Architecture 原則（確認済み）

- **Application orchestration layer（/app）を明示**: ScenarioCatalog → ScenarioProgression → DimensionEvaluator → ResultModel → AdoptionSheetComposer を組み合わせ、必要に応じて ScenarioLoader / ProgressStore / locale resources / UI と接続。
- **依存方向**: UI/Application → domain ports/domain services → semantic model。data adapter → domain の定義した boundary へ変換。
- **`/domain` から直接参照しない**: React / localStorage / UI library / locale 表示文字列 / raw JSON。

## Consolidated Summary Confirmation

以下の設計で components.md（YAML カタログ + mermaid + 表 + Rationale）/ decisions.md（ADR）/ traceability.json を生成します。生成前に確認してください。

**論理コンポーネント（/domain 純ロジック）**:
- **ScenarioProgression**: Stage/Decision/Return/Change Scope の状態遷移、Session 進行。実行時 domain invariant guard（不正遷移・到達不能 state → 明示 Domain Error）。
- **DimensionEvaluator**（EvaluationEngine）: 9 Dimension の決定的評価。DecisionEffectRules を読む。表示文字列を参照しない。
- **DecisionEffectRules**: Decision→Dimension contribution の data-driven rule set（UI 独立、class 量産しない）。
- **ApprovalSemantics**: agent execution boundary / human approval gate / AI-DLC Completion Approval / Release Approval の意味論・判定（別概念として区別）。
- **AdoptionSheetComposer**: LearningResult/DecisionRecord/memo から決定的に Markdown 生成する pure service。
- RequirementCoverage は独立させず 9 Dimension rule に内包。

**semantic model の entity 所有**:
- **ScenarioCatalog**: Scenario / Stage / DecisionPoint / DecisionOption / LearningPoint / dimension-contribution-rule reference / provenance reference。
- **ResultModel**: LearningResult / DimensionOutcome / DecisionRecord（runtime、ScenarioProgression が生成）/ RemainingRisk / Rework / Reflection projection。
- **ProvenanceEntry**: shared semantic value object（Scenario/Result 双方から参照）。shape = category / reference / note / stable id。reference は URL / repo-doc path / section-anchor / revision-version を表現可能。category invariant: ai-dlc-spec=v2.10.0 一次情報必須 / harness-behavior=spec と別扱い / simulator-interpretation=独自解釈明示 / simulation-assumption=仮定明示・外部 ref 任意。

**境界コンポーネント（/data 相当 port/adapter）**:
- **ScenarioLoader/Validator**: 唯一の raw external-data validation 境界（schema + cross-ref → validated domain object、fail-fast、silent fallback なし）。
- **ProgressStore**: localStorage の port/adapter（schemaVersion / parse・validation / corrupted 処理 / safe reset / quota）。domain は localStorage を知らない。
- **LocaleResources**: ja/en 表示テキスト（semantic data と分離）。EvaluationEngine は参照しない。

**Application orchestration（/app）**: ScenarioCatalog → ScenarioProgression → DimensionEvaluator → ResultModel → AdoptionSheetComposer を組み合わせ、ScenarioLoader/ProgressStore/LocaleResources/UI と接続。

**ExperiencePolicy（ModePolicy）**: Guided/Simulation/Adoption Review を同一 Engine/Data 上で表現。変更可: guidance/hint/説明量/reflection/adoption prompts。変更不可: semantic data/Decision meaning/DecisionEffectRules/Evaluation logic/Dimension Outcome。mode で評価結果を変えない。

**依存方向**: UI/Application → domain ports/services → semantic model。data adapter → domain 定義の boundary へ変換。/domain は React/localStorage/UI library/locale 表示文字列/raw JSON を直接参照しない。

**ADR（decisions.md）**: コンポーネント境界（役割別分割・RequirementCoverage 非分離）、entity 所有（Catalog/Result 分離・ProvenanceEntry を shared VO 化）、provenance 4 区分 invariant、validation 境界の一元化と runtime invariant guard の分離、i18n 言語非依存 semantic、ExperiencePolicy による mode 表現、hexagonal な依存方向、を Context/Decision/Consequences/Alternatives Rejected で記録。

**traceability.json**: user-stories の全 US を列挙し、実現する component/entity へ対応。coverage の存在は検証済みを意味しない。

**維持**: 11 の意味論不変（決定的評価・same input→same result・ja/en 不変・boundary≠gate・Completion≠Release・malformed 検出・Adoption Sheet 決定的 等）、Learning Target = v2.10.0。

**生成時の追加契約（確認済み）**:
1. **Domain Error を型として区別（どの boundary がどの failure を所有するか固定。型詳細は Functional Design）**: ScenarioValidationError（malformed JSON / schema violation / invalid reference / required field missing / provenance invariant violation）は ScenarioLoader/Validator が所有 / ScenarioRuntimeError（DomainInvariantError）（invalid transition / nonexistent next Stage / unavailable Decision / impossible runtime state / validated Scenario 内の実行時不整合）は ScenarioProgression が所有 / PersistenceError（corrupted persisted state / schema version mismatch / quota・write failure）は ProgressStore が所有。
2. **Stable ID を domain contract 化**: Scenario/Stage/DecisionPoint/DecisionOption/LearningPoint/ProvenanceEntry/Dimension は表示文言と独立した stable ID を持つ。same semantic IDs + same Decision sequence → same evaluation result。ja/en の表示変更・翻訳修正で Decision identity/evaluation/traceability/persisted progress が変わらない。localStorage には表示文言でなく stable ID を保存。
3. **traceability.json は US → Component/Entity に加え主要 Requirement 接続も保持**: FR3/FR5/FR6/FR8/FR9/FR10/FR11/FR12/NFR2/NFR3/NFR5/NFR8 を追跡可能に。`Traceability != Verification` は維持。
- **ADR に残す判断**: ScenarioCatalog/ResultModel 所有分離 / ProvenanceEntry 4 区分 taxonomy と category invariant / raw external JSON validation boundary / runtime invariant protection の分離 / DecisionEffectRules の data-driven 化 / i18n semantic-presentation 分離 / ExperiencePolicy による 3 モード共有 / ProgressStore port/adapter / domain の UI・framework・storage 非依存 / Completion Approval と Release Approval を別 semantic concept として扱う判断。

- Looks correct
- Request changes

[Answer]: Looks correct