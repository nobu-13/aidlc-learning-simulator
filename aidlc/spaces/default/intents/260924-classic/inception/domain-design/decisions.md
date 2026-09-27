# Architecture Decision Records — Domain Design

> AI-DLC Learning Simulator。将来変更されやすく影響範囲が大きい判断を記録。各 ADR は Context / Decision / Consequences / Alternatives Rejected を持つ（Inception phase guardrail）。

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | ScenarioCatalog と ResultModel の所有分離 | Accepted | 2026-09-25 |
| 002 | ProvenanceEntry の 4 区分 taxonomy と category invariant（shared value object） | Accepted | 2026-09-25 |
| 003 | 唯一の raw external JSON validation boundary（ScenarioLoader/Validator） | Accepted | 2026-09-25 |
| 004 | runtime invariant protection を ScenarioProgression に分離 | Accepted | 2026-09-25 |
| 005 | DecisionEffectRules の data-driven 化（評価ロジックとルールの分離） | Accepted | 2026-09-25 |
| 006 | i18n semantic / presentation separation | Accepted | 2026-09-25 |
| 007 | ExperiencePolicy による 3 モード共有 | Accepted | 2026-09-25 |
| 008 | ProgressStore を port/adapter として分離 | Accepted | 2026-09-25 |
| 009 | domain の UI/framework/storage 非依存（hexagonal 依存方向） | Accepted | 2026-09-25 |
| 010 | Completion Approval と Release Approval を別 semantic concept として扱う | Accepted | 2026-09-25 |
| 011 | Domain Error を boundary 別に型区別 | Accepted | 2026-09-25 |

---

## ADR-001: ScenarioCatalog と ResultModel の所有分離
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 教材の authoring データ（Scenario 定義）と実行結果（LearningResult 等）は変更理由・ライフサイクルが異なる。評価の決定性・純粋性を保ちたい。
**Decision**: authoring 側 entity（Scenario/Stage/DecisionPoint/DecisionOption/LearningPoint）は ScenarioCatalog が所有する。ResultModel は LearningResult / RemainingRisk / Rework 等の**結果集約 entity を所有（owner）**し、ScenarioProgression が生成・所有する DecisionRecord と DimensionEvaluator が生成・所有する DimensionOutcome を **stable ID で保持・参照（holder/reference）**する。canonical owner は 1 entity につき 1 component とし、producer / holder / reference を owner と混同しない（DecisionRecord owner=ScenarioProgression、DimensionOutcome owner=DimensionEvaluator）。
**Consequences**: Positive — 責務が明確で評価系はデータを読むだけの純関数に保てる。Negative — コンポーネント数が増える。Neutral — 両者を跨ぐ参照は stable ID で行う。
**Alternatives Rejected**: Scenario と結果を単一コンポーネントに同居（B 案）— 変更理由の混在と決定性検証の困難さで却下。

## ADR-002: ProvenanceEntry の 4 区分 taxonomy と category invariant
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 教材の正確性・信頼性のため、学習判断の根拠が AI-DLC 仕様由来か Simulator 独自解釈か等を区別・追跡する必要がある（FR6, NFR3）。Scenario 定義と結果表示の双方が根拠を参照する。
**Decision**: ProvenanceEntry を shared semantic value object とし、category を 4 区分固定（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）。shape = category / reference / note / stable id。category invariant: ai-dlc-spec は v2.10.0 一次情報 reference 必須 / harness-behavior は spec と別扱いで根拠識別可能 / simulator-interpretation は独自解釈明示・basis 任意 / simulation-assumption は仮定明示・外部 ref 不要・note で説明。reference は URL/repo-doc path/section-anchor/revision-version を表現可能。
**Consequences**: Positive — spec と教材独自解釈の非混同が構造で担保。Negative — authoring 時に category 付与の手間。Neutral — 型詳細（discriminated union）は Functional Design。
**Alternatives Rejected**: sourceRefs を単純文字列配列＋別タグ（B 案）— category invariant を型で表現できず混同リスクで却下。schema 完全保留（C 案）— 中核の Technical Accuracy 契約が曖昧になるため却下。

## ADR-003: 唯一の raw external JSON validation boundary
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 外部 Scenario JSON は untrusted 入力（C5, FR12）。検証ロジックが各所に散ると重複と抜けが生じる。
**Decision**: ScenarioLoader/Validator を唯一の raw external-data validation 境界とし、schema + cross-reference + provenance invariant を検証して validated domain object に変換する。失敗は fail-fast・readable error・silent fallback なし・malformed を正常 Scenario として開始しない。
**Consequences**: Positive — 検証の一元化、domain は検証済み前提で再検証不要。Negative — Loader が単一責務の要になる。Neutral — mid-scenario 不整合は別（ADR-004）。
**Alternatives Rejected**: 各コンポーネントが自前検証（B 案）— 重複・境界曖昧化で却下。

## ADR-004: runtime invariant protection を ScenarioProgression に分離
**Status**: Accepted / **Date**: 2026-09-25
**Context**: validated Scenario でも実行時に不正遷移・到達不能 state が起こりうる。これを外部データ検証と混同すると責務が曖昧になる。
**Decision**: ScenarioProgression が runtime domain invariant guard を持ち、invalid transition / nonexistent next Stage / unavailable Decision / impossible runtime state を検出したら DomainInvariantError（ScenarioRuntimeError）を返す。Loader 再実行はしない。
**Consequences**: Positive — external validation と runtime protection の責務分離。Negative — 進行ロジックにガードが増える。Neutral — error presentation は app/UI。
**Alternatives Rejected**: mid-scenario 不整合を Loader が再検証（domain-design Q4 の C 案の一部）— 境界責務の混在で却下。

## ADR-005: DecisionEffectRules の data-driven 化
**Status**: Accepted / **Date**: 2026-09-25
**Context**: Decision→Dimension 寄与は教材ごとに変化しやすい。Decision ごとに class を作ると保守性が低下し UI に評価ロジックが漏れる懸念（FR5.4.2, NFR5）。
**Decision**: 寄与を DecisionEffectRules として data-driven な rule set にし、DimensionEvaluator が読む。UI から完全独立、表示文字列を含まない。
**Consequences**: Positive — 保守性・拡張性、評価の純関数化。Negative — rule データ構造の設計が必要（Functional Design）。Neutral — 条件表現の詳細は下流。
**Alternatives Rejected**: Decision ごとに評価 class 生成 — 量産・保守低下で却下。

## ADR-006: i18n semantic / presentation separation
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 日英で Decision Outcome / 評価結果が変わってはならない（FR10.4）。
**Decision**: 意味データ（stable ID/enum/decision type/dimension contribution）は言語非依存、表示テキストは ja/en の LocaleResources に分離。EvaluationEngine は表示文字列を一切参照しない。
**Consequences**: Positive — same semantic IDs + same decision sequence → same result を architecture で保証。Negative — 表示解決の間接層。Neutral — 翻訳欠落検出は LocaleResources。
**Alternatives Rejected**: Scenario ごとに ja/en フルコピー（B 案）— 二重管理・結果不整合リスクで却下。

## ADR-007: ExperiencePolicy による 3 モード共有
**Status**: Accepted / **Date**: 2026-09-25
**Context**: Guided/Simulation/Adoption Review は同一 Scenario Engine/Data/Evaluation を共有すべき（FR9, FR3.2）。モードで評価結果が変わってはならない。
**Decision**: モードを ExperiencePolicy（ModePolicy）として表現。可変: guidance/hint/pre-decision support/explanation amount/reflection depth/adoption prompts。不変: semantic data/Decision meaning/DecisionEffectRules/Evaluation logic/Dimension Outcome。
**Consequences**: Positive — 同一評価保証、実装重複回避。Negative — ポリシーと提示層の設計が必要。Neutral — Adoption Review は追加 Reflection prompt を持つ。
**Alternatives Rejected**: モードごとに別 Engine（B 案）— 同一評価保証が崩れるため却下。モードを UI 層のみ（C 案）— Adoption Review の追加 prompt を表現しきれず却下。

## ADR-008: ProgressStore を port/adapter として分離
**Status**: Accepted / **Date**: 2026-09-25
**Context**: FR11 は localStorage のみ。domain を storage 実装に縛らない設計が望ましい。
**Decision**: ProgressStore を port/adapter とし、domain は localStorage を知らない。stable ID ベースで保存し、schemaVersion / parse・validation / corrupted 処理 / safe reset / quota・write failure（PersistenceError）を扱う。domain object と保存 JSON を同一視しない。
**Consequences**: Positive — domain 純粋性、保存形式の差し替え容易。Negative — マッピング層が必要。Neutral — 破損時は safe reset/通知。
**Alternatives Rejected**: 各コンポーネントが直接 localStorage（B 案）— domain 汚染・境界曖昧で却下。

## ADR-009: domain の UI/framework/storage 非依存（hexagonal 依存方向）
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 決定性・テスト容易性・レイヤー分離（team Code Style, NFR5）のため domain を外部技術から隔離したい。
**Decision**: 依存方向を UI/Application → domain ports/services → semantic model とし、data adapter が domain 定義の boundary へ変換する。/domain は React / localStorage / UI library / locale 表示文字列 / raw JSON を直接参照しない。
**Consequences**: Positive — domain を純関数中心に保て、単体テスト・決定性検証が容易。Negative — port/adapter の記述コスト。Neutral — orchestration は /app に集約。
**Alternatives Rejected**: レイヤー分離を宣言に留め実依存を許容 — grep 検証不能・決定性リスクで却下。

## ADR-010: Completion Approval と Release Approval を別 semantic concept として扱う
**Status**: Accepted / **Date**: 2026-09-25
**Context**: AI-DLC 工程完了承認と（AWS/Production）Release Approval の混同は本 Simulator が防ぎたい中核の誤解（C6, FR6.6(f), v2.10.0）。
**Decision**: ApprovalSemantics 内で両者を別 concept（別 ApprovalKind）として判定し、前者が後者を含意しない不変を表現する。boundary（Zone）と gate（停止点）も別概念。
**Consequences**: Positive — 学習の中核概念を構造で担保、UI もこれを反映（mockups S2/S3）。Negative — 意味論の明示的モデリングが必要。Neutral — 判定詳細は DecisionEffectRules と連携。
**Alternatives Rejected**: 承認を単一 concept として扱う — 誤解防止という学習目的を満たせず却下。

## ADR-011: Domain Error を boundary 別に型区別
**Status**: Accepted / **Date**: 2026-09-25
**Context**: 外部データ検証失敗・実行時不変違反・永続化失敗は原因も回復手段も異なる。同一エラーとして扱うと presentation・回復が曖昧になる。
**Decision**: ScenarioValidationError（Loader 所有）/ ScenarioRuntimeError=DomainInvariantError（Progression 所有）/ PersistenceError（ProgressStore 所有）を意味上区別する。どの boundary がどの failure を所有するかを固定。
**Consequences**: Positive — 適切な readable error/回復（再読込・safe reset 等）を種別ごとに設計できる。Negative — エラー型の設計が必要（型詳細は Functional Design）。Neutral — presentation は app/UI。
**Alternatives Rejected**: 単一の汎用エラー — 回復手段の出し分けができず却下。
