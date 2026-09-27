# AI-DLC Learning Simulator — Learning Content Inventory / Audit

> 事実ベースの学習内容監査。source / scenario JSON / locale / domain / UI / tests / design artifacts を読み、実装から確認できる範囲のみを記載する。新規AWS操作・deploy・source変更は行わない。
>
> 監査対象コミット時点の読み取り。根拠区分の表記:
> - **[spec]** = AI-DLC spec 由来（requirements.md / stories.md / scenario provenance category `ai-dlc-spec`）
> - **[impl]** = 実装（src 配下の TypeScript / JSON / locale）から直接確認した事実
> - **[interp]** = 監査者の解釈（simulator interpretation ではなく本監査の判断）。混同しないため明示する。
> - **[harness]** = harness/runtime 挙動。本監査では該当箇所なし。
>
> 読んだ主要ファイル: `src/scenarios/*.json` `*.locale.ts` `src/domain/*` `src/data/*` `src/app/*` `src/ui/*` `src/i18n/*` `src/ui/app-views.test.tsx`、design: `inception/requirements-analysis/requirements.md` `inception/user-stories/stories.md` `construction/functional-design/memory.md`。

---

## 1. Executive Summary

AI-DLC Learning Simulator は、静的 React + TypeScript + Vite SPA として、AI-DLC の主要な判断を選択式で体験させる教育用 Simulator である（backend / DB / 登録 / 外部AI / runtime AI なし。[impl] `progress-store.ts` は localStorage のみ、`AdoptionReviewView.download` は Blob 生成でネットワーク送信なし）。

**3 learning modes**（[impl] `entities.ts` `ExperienceMode` / `experience-policy.ts`）:
- **Guided Learning** — 判断前に important DecisionPoint の provenance を先出しする（`showConceptBeforeDecision: true, showHints: true`）
- **Simulation** — 先出しヒントを減らす（`showConceptBeforeDecision: false, showHints: false`）
- **Adoption Review** — Adoption 導線を前面に出す（`emphasizeAdoptionReview: true`）

いずれのモードも **同一 Scenario Engine / Source Data / 評価 engine を共有し、評価は不変**（[spec] FR3.2 / BR5.2、[impl] `experience-policy.ts` コメントおよび `dimension-evaluator.ts` は mode を入力に取らない）。

**Scenario 数**: 4 本（[impl] `scenarios/index.ts`）。
**Focus Scenario 数**: 3 本（`focus-evidence` / `focus-checkpoint-review` / `focus-refusal-recovery`）。Core は 1 本（`core-e2e`）。

**主な学習 Topic**（[impl] scenario の learningObjective / learningPoint、[spec] FR2.1）: Acceptance Criteria 明確化、Human/Agent Delegation Boundary、Approval Boundary、Evidence と「実行済み ≠ 成功」、工程完了承認 ≠ Release Approval、checkpoint review（verified Unit / batch）、refusal / recovery（executable next step）。

**9 Dimension**（[impl] `entities.ts` `DIMENSION_IDS`、固定順・改変不可）:
`requirement-clarity` / `acceptance-criteria-coverage` / `evidence-quality` / `approval-boundary` / `delegation-quality` / `risk-handling` / `traceability` / `rework` / `remaining-risks`。うち `delegation-quality` / `approval-boundary` / `risk-handling` は非単調（過少・過剰の双方を negative 側へ寄せる。[impl] `NON_MONOTONIC_DIMENSIONS` / `foldDimensionScore`）。

**Result / Reflection / Adoption Discussion Sheet の存在**:
- **Result**: 存在する（[impl] `ResultView`）。ただし内容は 9 Dimension の記号（−−/−/0/＋/＋＋）+ Educational Simulation Value 注記のみ。
- **Reflection**: 画面は存在するが **実質空**（[impl] `ReflectionView` はタイトルと「導入レビューへ進む」ボタンのみ。振り返りコンテンツなし）。
- **Adoption Discussion Sheet**: 存在する（[impl] `adoption-sheet-composer.ts` / `AdoptionReviewView`）。FR8.2 の 10 見出し固定 Markdown を決定的に生成し、Blob download 可能。

**「知る / 判断する / 作る / レビューする」の到達度**（[interp]、根拠は §4）:
- **知る（Know）**: 到達している。各 DecisionPoint 後に LearningPoint（title/body）+ provenance を提示。
- **判断する（Decide）**: 到達している。各 DecisionPoint で選択式判断を行い、9 Dimension に決定的反映。
- **作る（Create）**: **未到達**。ユーザーが成果物（要件・AC・boundary 定義等）を書く体験はない。自由入力 `note` は存在するが採点対象外（[impl] BR2.5 / BR3.1）で、Adoption Sheet に引用転記されるのみ。
- **レビューする（Review）**: **未到達**。Evidence / 成果物を評価・改善する体験はない。Adoption Review モードも Sheet 生成が中心で、レビュー判断そのものは行わない。

現状は **Know + Decide まで到達、Create / Review は未到達**。

---

## 2. Learning Mode Inventory

| Mode | Entry point | 使用Scenario | 主な目的 | ユーザー操作 | Feedback timing | Result | Final output | 他modeとの差 |
|---|---|---|---|---|---|---|---|---|
| Guided Learning | Home → 「はじめる」→ mode-select → `mode-guided`（[impl] `ModeSelectView`） | **常に core-e2e**（[impl] `chooseScenario("core-e2e")` 固定） | 初学者が概念を先に知って判断 | 各DPで1択 + 任意note | 各DP判断直後（feedback view） | 9 Dimension | （導線上）Adoption Sheet | **judgment前に important DPのprovenanceを先出し**（`showConceptBeforeDecision:true`） |
| Simulation | Home → 「はじめる」→ mode-select → `mode-simulation` | **常に core-e2e**（同上） | 自力で判断 | 各DPで1択 + 任意note | 各DP判断直後（feedback view） | 9 Dimension | （導線上）Adoption Sheet | provenance先出しをしない（`showConceptBeforeDecision:false`）。**それ以外はGuidedと同一** |
| Adoption Review | Home → 「はじめる」→ mode-select → `mode-adoption-review` | **常に core-e2e**（同上） | 判断を振り返り実導入を検討 | 各DPで1択 + 任意note | 各DP判断直後（feedback view） | 9 Dimension | Adoption Discussion Sheet（`emphasizeAdoptionReview:true`） | provenance先出しなし。Adoption導線を強調する**policy値のみ差**。判断中の体験はSimulationと同一 |
| （Focus 3本） | Home → 「フォーカス・シナリオ」→ 各focus（[impl] `FocusLibraryView`） | focus-evidence / checkpoint / refusal-recovery | 特定判断の深掘り | 各DPで1択 + 任意note | 各DP判断直後 | 9 Dimension | （導線上）Adoption Sheet | **modeと無関係に開始**。state.mode は既定 `guided` のまま（[impl] Focus起動時に setMode しない） |

### 「実質的に同じ体験になっていないか」の正直な記録 [impl][interp]

- **feedback timing は 3 mode 完全同一**。`experience-policy.ts` の `emphasizeFeedback` は 3 mode すべて `true`。UI（`ScenarioView`）は mode によって feedback の出し方を変えていない。
- **Guided と Simulation の唯一の実体差は、判断前 provenance 先出しの有無だけ**（`showConceptBeforeDecision`）。ヒント（`showHints`）は policy に存在するが、**UIで `showHints` を参照している箇所がない**（[impl] `app-views.tsx` は `showConceptBeforeDecision` のみ参照）。したがって「ヒント量の差」は実装されていない。
- **Adoption Review と Simulation の判断中の体験は同一**。`emphasizeAdoptionReview` を参照するUIも存在しない（[impl] `app-views.tsx` に該当参照なし）。Adoption Review固有の体験は「完走後にAdoption Sheetへ行く」ことだが、その導線（result→reflection→adoption）は **全modeで同じく到達可能**。
- 結論（[interp]）: **3 mode は同一 engine/data を共有しているだけでなく、ユーザー体験もほぼ同一**。差別化されているのは Guided の provenance 先出し 1 点のみで、Simulation と Adoption Review は判断中は区別不能。詳細判定は §7。

---

## 3. Complete Scenario Inventory

DecisionPoint 総数 = **10**（core 4 + focus 各 2 × 3）。全 DecisionPoint が `important: true`（[impl]）。

### Scenario: core-e2e / 「はじめての AI-DLC：要件からリリースまで」

- **Type**: Core
- **対応Mode**: Guided / Simulation / Adoption Review（mode選択時に固定でこれを開始）
- **Learning objective**: `lifecycle` `boundary` `approval` `evidence` `release-distinction`
- **AI-DLC topic**: Lifecycle、AC明確化、委任境界、Evidence/Testing、工程完了承認≠Release承認
- **Stage数**: 4（st-req / st-plan / st-build / st-release）
- **DecisionPoint数**: 4（各Stage 1つ）
- **Resultに影響するDimension**: requirement-clarity / acceptance-criteria-coverage / delegation-quality / approval-boundary / risk-handling / evidence-quality / traceability / rework / remaining-risks（EffectRule経由で9軸中9軸に到達しうる）
- **provenance category**: `ai-dlc-spec`（5件）, `simulator-interpretation`（2件: pv-interp-over / pv-interp-under）
- **ja/en availability**: 両方あり（[impl] `core-e2e.locale.ts` に ja/en 同一key）

#### Stage: st-req / 要件定義
##### DecisionPoint: dp-ac
- **Context / Prompt**: 受け入れ条件が曖昧。どうするか
- **User choices**: A `o-ac-clarify`（明確化してから進める）/ B `o-ac-skip`（とりあえず実装開始）
- **各choiceの意味**: A=要件を固めてから着手 / B=曖昧なまま着手
- **Feedback**: このDPは `learningPointRefs: []`（[impl]）→ **feedback view に LearningPoint 本文が出ない**。provenance（pv-spec-ac）は guided時のみ判断前に表示
- **LearningPoint**: なし（DP直下）。scenario全体の lp は boundary/evidence/release
- **provenance**: dp=pv-spec-ac [spec]。A=pv-spec-ac / B=（provenanceなし）
- **影響Dimension**: A→requirement-clarity(strong+)/acceptance-criteria-coverage(+)、B→requirement-clarity(−)/rework(−)
- **recommended/context/risky区別**: choice自体にラベルなし。EffectRuleの正負でのみ暗示（Aが正、Bが負）
- **正誤/望ましさの明確さ**: 判断前は不明。判断後もこのDPはLPが空のため feedback で説明されず、**Dimension結果（Result画面）まで正否が可視化されない**
- **user note**: あり（textarea 共通）
- **noteがevaluationに使われるか**: **使われない**（[impl] BR2.5/BR3.1、`collectAppliedEffects` は note 不参照）

#### Stage: st-plan / 計画・委任
##### DecisionPoint: dp-delegate
- **Prompt**: 低リスクな定型変更。誰が担当すべきか
- **User choices**: A `o-del-agent-lowrisk`（エージェント委任）/ B `o-del-human-lowrisk`（低リスクでも人間が逐一レビュー）/ C `o-del-agent-highrisk`（高リスクもエージェントに任せ承認省略）
- **各choiceの意味**: A=適切な委任 / B=過剰介入 / C=過少統制（承認境界逸脱）
- **Feedback**: `lp-boundary`（Human/Agent Boundary。過剰も過少も不適切）+ provenance
- **LearningPoint**: lp-boundary（betterAlternativeRef: o-del-agent-lowrisk）[spec]
- **provenance**: A=pv-spec-boundary [spec] / B=pv-interp-over [interp] / C=pv-interp-under [interp]
- **影響Dimension**: A→delegation-quality(+)、B→delegation-quality(−, rationale「過剰介入」)、C→approval-boundary(−)/risk-handling(−)
- **recommended/context/risky区別**: **唯一 rationaleKey を持つDP**（B/Cに理由文）。非単調Dimensionで過剰(B)・過少(C)双方がnegativeになる設計。ただしUI上「recommended」等のラベルはない
- **正誤/望ましさの明確さ**: feedbackのlp-boundaryで「過剰でも過少でも不適切」と説明。3択で唯一「正解1・不適切2」の構造が明確
- **user note**: あり / evaluation不使用

#### Stage: st-build / 実装・テスト
##### DecisionPoint: dp-testfail
- **Prompt**: テストが失敗。どう判断するか
- **User choices**: A `o-test-investigate`（原因調査しEvidence確認）/ B `o-test-tweak-expected`（期待値を書き換えて通す）
- **各choiceの意味**: A=Evidence尊重 / B=Evidence偽装
- **Feedback**: `lp-evidence`（実行済み≠成功、期待値書換はEvidence偽装）+ provenance
- **provenance**: dp/A/B とも pv-spec-testing [spec]
- **影響Dimension**: A→evidence-quality(strong+)、B→evidence-quality(strong−)/traceability(−)
- **正誤/望ましさの明確さ**: feedbackで明確。強正/強負で差が大きい
- **user note**: あり / evaluation不使用

#### Stage: st-release / 承認・リリース
##### DecisionPoint: dp-release
- **Prompt**: 工程完了承認が出た。リリースをどう扱うか
- **User choices**: A `o-rel-separate`（工程完了承認とリリース承認を分ける）/ B `o-rel-conflate`（工程完了承認をそのままリリース承認とみなす）
- **各choiceの意味**: A=承認境界の区別 / B=承認の混同（C6違反相当）
- **Feedback**: `lp-release`（工程完了承認≠リリース承認）+ provenance。両choiceとも nextRef: terminal
- **provenance**: pv-spec-release [spec]
- **影響Dimension**: A→approval-boundary(+)、B→approval-boundary(strong−)/remaining-risks(−)
- **正誤/望ましさの明確さ**: feedbackで明確
- **user note**: あり / evaluation不使用

---

### Scenario: focus-evidence / 「フォーカス：テスト失敗と Evidence」

- **Type**: Focus
- **対応Mode**: Focus Library から直接（mode非依存、state.mode=既定guidedのまま）
- **Learning objective**: `evidence` `testing`
- **AI-DLC topic**: Testing Contract、Evidence十分性
- **Stage数**: 1（st-only）
- **DecisionPoint数**: 2
- **影響Dimension**: evidence-quality / traceability / remaining-risks
- **provenance category**: `ai-dlc-spec`（pv-testing / pv-evidence の2件、全て spec）
- **ja/en**: 両方あり

#### Stage: st-only / テストと Evidence
##### DecisionPoint: dp-fail
- **Prompt**: CIでテスト失敗。最初にどうするか
- **choices**: A `o-investigate`（原因調査）/ B `o-tweak`（期待値書換で通す）
- **Feedback**: lp-ev（未実行テストを成功扱いにしない）
- **provenance**: pv-testing [spec]
- **影響Dimension**: A→evidence-quality(strong+)、B→evidence-quality(strong−)/traceability(−)
- **正誤の明確さ**: feedbackで明確 / note不使用

##### DecisionPoint: dp-evidence
- **Prompt**: 完了報告の前に何を確認するか
- **choices**: A `o-require-evidence`（実行Evidenceを要求）/ B `o-assume-ok`（ログを見ず成功とみなす）両者 terminal
- **Feedback**: lp-ev
- **provenance**: A=pv-evidence [spec] / B=pv-evidence [spec]
- **影響Dimension**: A→evidence-quality(+)、B→evidence-quality(−)/remaining-risks(−)
- **正誤の明確さ**: 明確 / note不使用
- **注記（[interp]）**: dp-fail と dp-evidence は **core-e2e dp-testfail とほぼ同じ判断**（Evidenceを尊重するか偽装/省略するか）。重複は §11 参照

---

### Scenario: focus-checkpoint-review / 「フォーカス：checkpoint review（検証済み Unit / batch）」

- **Type**: Focus
- **対応Mode**: Focus Library から直接
- **Learning objective**: `checkpoint-review` `verified-unit`
- **AI-DLC topic**: verified Unit / batch checkpoint review（[spec] FR2.2.2 必須Topic）
- **Stage数**: 1（st-review） / **DecisionPoint数**: 2
- **影響Dimension**: evidence-quality / traceability / approval-boundary / risk-handling / rework
- **provenance category**: `ai-dlc-spec`（pv-cr-spec）, `simulator-interpretation`（pv-cr-interp）
- **ja/en**: 両方あり

#### Stage: st-review / Checkpoint Review
##### DecisionPoint: dp-verify
- **Prompt**: Unit実装完了。次のUnitへ進む前にどうするか
- **choices**: A `o-verify-unit`（verified Unitとしてcheckpointで確認）/ B `o-skip-verify`（確認せず次へ）
- **Feedback**: lp-checkpoint
- **provenance**: A=pv-cr-spec [spec] / B=pv-cr-interp [interp]
- **影響Dimension**: A→evidence-quality(+)/traceability(+)、B→evidence-quality(−)/risk-handling(−)
- **正誤の明確さ**: 明確 / note不使用

##### DecisionPoint: dp-batch
- **Prompt**: 複数Unitが溜まっている。batchの扱いは
- **choices**: A `o-batch-checkpoint`（承認境界を通して確認）/ B `o-batch-blind`（まとめて無確認承認）両者 terminal
- **Feedback**: lp-checkpoint
- **provenance**: A=pv-cr-spec [spec] / B=pv-cr-interp [interp]
- **影響Dimension**: A→approval-boundary(+)、B→approval-boundary(strong−)/rework(−)
- **正誤の明確さ**: 明確 / note不使用

---

### Scenario: focus-refusal-recovery / 「フォーカス：refusal / recovery（次の一手）」

- **Type**: Focus
- **対応Mode**: Focus Library から直接
- **Learning objective**: `refusal` `recovery` `next-step`
- **AI-DLC topic**: refusal / recovery が executable next step を示す（[spec] FR2.2.3 必須Topic）
- **Stage数**: 1（st-recovery） / **DecisionPoint数**: 2
- **影響Dimension**: evidence-quality / risk-handling / rework / remaining-risks
- **provenance category**: `ai-dlc-spec`（pv-rr-spec）, `simulator-interpretation`（pv-rr-interp）
- **ja/en**: 両方あり

#### Stage: st-recovery / Refusal / Recovery
##### DecisionPoint: dp-refusal
- **Prompt**: Agentが操作を拒否。まずどうするか
- **choices**: A `o-read-refusal`（拒否理由とrecovery pathを読む）/ B `o-force-retry`（理由を無視して強制再試行）
- **Feedback**: lp-recovery
- **provenance**: A=pv-rr-spec [spec] / B=pv-rr-interp [interp]
- **影響Dimension**: A→evidence-quality(+)/risk-handling(+)、B→evidence-quality(−)/rework(−)
- **正誤の明確さ**: 明確 / note不使用

##### DecisionPoint: dp-nextstep
- **Prompt**: recovery pathが提示された。どう進めるか
- **choices**: A `o-actionable-next`（提示された実行可能なnext stepに従う）/ B `o-give-up`（無視して放棄）両者 terminal
- **Feedback**: lp-recovery
- **provenance**: A=pv-rr-spec [spec] / B=pv-rr-interp [interp]
- **影響Dimension**: A→risk-handling(+)/remaining-risks(+)、B→remaining-risks(−)
- **正誤の明確さ**: 明確 / note不使用

### Invalid / malformed scenario の明記

[impl] 監査時点の同梱 4 本は **すべて schema + loader 検証を通過する構造**（stable-ID 一意、dangling参照なし、important DP は provenance を持つ、schemaVersion=1）。`scenario-loader.ts` は一部invalidでもvalidを全滅させず `unavailable` に退避する設計（BR1.8）。**現時点で malformed / unavailable な同梱 scenario は無い**。テスト `app-views.test.tsx` は意図的に壊した `{schemaVersion:1}` のみで error 画面を検証している。

---

## 4. Learning Topic Coverage Matrix

Learning depth: **1 Know**（説明を読む）/ **2 Decide**（選択肢から判断）/ **3 Create**（自身で成果物を書く）/ **4 Review**（他成果物/Evidenceを評価・改善）。到達している最高段階を記載。

| Topic | Covered? | Scenario | Current interaction | Learning depth | Gap |
|---|---|---|---|---|---|
| Requirements | 弱 | core dp-ac | AC曖昧を「明確化/スキップ」の2択 | 2 Decide | 要件自体を書く体験なし。要件そのものはTopic化されずAC文脈のみ |
| Requirement Clarity | あり | core dp-ac + Dimension | 2択 + requirement-clarity軸 | 2 Decide | ユーザーが明確な要件を書く(Create)がない |
| Acceptance Criteria | あり | core dp-ac + Dimension | 「明確化」を選ぶのみ | 2 Decide | ACを実際に列挙/評価するCreate/Reviewがない |
| Planning | 弱 | core st-plan | 委任判断のみ | 2 Decide | 計画立案そのものの体験なし |
| Human/Agent Delegation Boundary | あり | core dp-delegate | 3択(適切/過剰/過少) | 2 Decide | 複数actionの分類(Create)がない |
| Approval Boundary | あり | core dp-release / checkpoint dp-batch | 2択 + approval-boundary軸 | 2 Decide | action群を承認境界で分類するReviewがない |
| Evidence | あり | focus-evidence / core dp-testfail | Evidence要求か省略かの2択 | 2 Decide | Evidence一覧のsufficient/insufficient判定(Review)がない |
| Testing Expectations | あり | core dp-testfail / focus-evidence | 期待値書換か調査かの2択 | 2 Decide | テスト設計/評価のCreate/Reviewなし |
| Traceability | 弱 | Dimension のみ | traceability軸に反映されるが専用DPなし | 2 Decide（間接） | Req→AC→impl→testの対応付け(Create/Review)がない。UI表示もResultの1軸のみ |
| Change Control | **なし** | — | — | — | [spec] FR1.4/FR2.1で候補だがscenario化されていない |
| Checkpoint Review | あり | focus-checkpoint-review | 2択 | 2 Decide | verified Unitを自分で判定するReviewがない |
| Verified Unit / batch checkpoint | あり | focus-checkpoint-review | 2択 | 2 Decide | 同上 |
| Refusal | あり | focus-refusal-recovery dp-refusal | 2択 | 2 Decide | — |
| Recovery | あり | focus-refusal-recovery | 2択 | 2 Decide | recovery手順を組み立てるCreateがない |
| Failure Handling | 弱 | focus-refusal-recovery | 拒否/失敗の2択 | 2 Decide | 失敗状況の切り分けは1DPのみ |
| Rework | あり（間接） | Dimension のみ | rework軸に反映 | 2 Decide（間接） | 手戻り操作(Return/Change Scope)が選択肢に存在しない |
| Remaining Risks | あり（間接） | Dimension + Adoption Sheet | remaining-risks軸 + Sheetに1行 | 2 Decide（間接） | 残存リスクを列挙するCreateなし |
| Completion Approval | あり | core dp-release | 2択 | 2 Decide | — |
| Release Approval | あり | core dp-release | 完了承認と区別する2択 | 2 Decide | — |
| Reversibility | **なし（明示）** | — | approval-semantics/非単調設計の前提だがDP無し | 1 Know（間接） | [spec] FR5.2で言及。reversibilityを判断軸に置くDPがない |
| Risk Handling | あり | dp-delegate / checkpoint / recovery | 各所で risk-handling軸 | 2 Decide | nuancedなrisk reasoning(Create/Review)なし |
| Adoption Discussion | あり | Adoption Sheet | Sheet生成 + 任意note | 1 Know / 3 Create（弱） | Sheet本文は汎用文言。ユーザーが埋める入力欄なし。noteのみ引用転記 |

**depth 総括（[interp]）**: 21 Topic中、**2 Decide 到達が中心**。3 Create は Adoption Sheet の note 転記が唯一かつ限定的（Sheet本文はユーザーが書かない）。4 Review 到達 Topic は **0**。Change Control は scenario 未実装、Reversibility は判断軸として独立していない。

---

## 5. Quiz Dependency Audit

現在の全 10 DecisionPoint は「選択肢から1つ選ぶ」形式であり、学習体験は選択問題に全面依存している（[impl]）。

| Scenario / Topic | Current interaction | Quiz dependency | 学習上の弱点 | Practice化候補 |
|---|---|---|---|---|
| Requirement / AC (core dp-ac) | 「明確化/スキップ」2択 | 高 | 「明確化を選ぶ」だけで、明確なACが何かを産まない | ユーザーがGoal/User/Scope/AC等を入力→required field presenceを決定的判定（§9 Requirement Practice） |
| Evidence (focus-evidence / core dp-testfail) | Evidence要求/省略の2択 | 高 | Evidenceの「十分性」を自分で判定しない | Evidence一覧をsufficient/insufficient/missingに分類（§9 Evidence Review Practice） |
| Approval Boundary (dp-release / dp-batch) | 分ける/混同の2択 | 高 | 承認境界の線引きを自分で行わない | 複数actionをAgent自律/人間承認/Blockに分類（§9 Approval Boundary Practice） |
| Delegation Boundary (dp-delegate) | 適切/過剰/過少の3択 | 中 | 3択で唯一ニュアンスがあるが依然選択式 | risk/reversibility/impactを見て委任範囲を決める分類（§9 Delegation Boundary Practice） |
| Testing (dp-testfail / focus-evidence) | 調査/書換の2択 | 高 | テスト設計・評価をしない | 期待テストの列挙・十分性判定 |
| Traceability | Dimension反映のみ（DPなし） | — （UI操作なし） | ユーザー操作が一切ない。Result 1軸に出るだけ | Req→AC→impl→test/evidenceの対応付け（§9 Traceability Practice） |

**分析（[interp]）**: Requirement / AC / Evidence / Approval Boundary / Delegation Boundary / Testing はいずれも **「ユーザー自身が作る/レビューする」形式へ変更可能**。特に Requirement・AC・Approval Boundary・Delegation Boundary は、決定的なルーブリック（必須フィールド有無・件数・分類の正誤）で採点でき、runtime AI 不要（§10）。Traceability も対応付けの完全性を決定的に判定できる。semantic な品質評価（要件文の曖昧さ等）のみ runtime AI が必要（§10）。

---

## 6. Feedback Quality Audit

feedback は「各DP判断直後」に `learningPointRefs` に紐づく LearningPoint（title/body）と provenance を表示する（[impl] `ScenarioView` feedback view）。**判断ごとに内容が変わらず、選んだ選択肢に依らず同じ LearningPoint 本文が出る**（[impl] feedback は `dp.learningPointRefs` を出すだけで、chosen option 別の分岐なし）。

| DecisionPoint | Good/Bad clarity | Why | Trade-off | Dimension impact | Practical takeaway | Gap |
|---|---|---|---|---|---|---|
| core dp-ac | **feedbackでは不明**（LP空） | なし（feedback） | なし | Result画面まで見えない | 弱 | LP未紐付け。判断直後に良否が出ない |
| core dp-delegate | 中（lp-boundaryが過剰/過少を説明） | あり（body + rationale over/under） | あり（過剰も過少も不適切） | feedbackにはDimension記号なし | 中 | 選んだ選択肢別の個別feedbackがない。Dimension impactは判断時に非表示 |
| core dp-testfail | 高（lp-evidence明確） | あり | 部分的 | feedbackに非表示 | 中 | option別feedbackなし |
| core dp-release | 高（lp-release明確） | あり | 部分的 | feedbackに非表示 | 中 | 同上 |
| focus-evidence dp-fail | 高 | あり | 弱 | 非表示 | 中 | option別feedbackなし |
| focus-evidence dp-evidence | 中 | あり | 弱 | 非表示 | 中 | dp-failと同一LP再掲 |
| checkpoint dp-verify | 中 | あり | 弱 | 非表示 | 中 | option別feedbackなし |
| checkpoint dp-batch | 中 | あり | 弱 | 非表示 | 中 | dp-verifyと同一LP再掲 |
| refusal dp-refusal | 中 | あり | あり（body に強制再試行のrework言及） | 非表示 | 中 | option別feedbackなし |
| refusal dp-nextstep | 中 | あり | あり | 非表示 | 中 | dp-refusalと同一LP再掲 |

**共通所見（[interp]）**:
- **「自分の判断が良かったか」は判断直後には分からない**。feedback は選択に依らず同一 LP を出すため、良い選択でも悪い選択でも同じ文章が表示される。良否は Result 画面の 9 Dimension 記号で初めて可視化される（[impl]）。
- **Why はある**（LP body に理由記述）。**Risk / Trade-off は dp-delegate / refusal で部分的にある**（rationale・body内言及）。他は薄い。
- **Dimension impact が判断時に見えない**（feedback view に Dimension 表示なし）。「この選択が evidence-quality を下げた」等の即時フィードバックがない。
- **実務でどう判断するか**は LP body が概念レベルで触れるが、具体手順は薄い。
- **provenance は分かる**（[impl] feedback view で ProvenanceBadge を LP ごとに表示。記号+ラベル+テキストで色非依存）。

**recommended / context-dependent / risky 表現の適切さ（[interp]）**: 現状 choice に明示ラベルはなく、正負は EffectRule の contribution で暗黙表現。dp-delegate のみ「過剰(over)/過少(under)」の rationale があり最も適切。他DPは「正解1・不正解1」の二値に近く、context-dependent の余地を示していない。承認境界・委任などは本来 context-dependent なので、Risky / Recommended / Context-dependent のラベル導入余地がある（[spec] FR5.2 の非単調性の趣旨に沿う）。

---

## 7. Mode Differentiation Audit

| 観点 | Guided | Simulation | Adoption Review |
|---|---|---|---|
| 目的 | [spec] 概念を先に知って判断 | [spec] 自力で判断 | [spec] 振り返り→実導入検討 |
| Scenario選択 | [impl] 固定でcore-e2e | 固定でcore-e2e | 固定でcore-e2e |
| Feedback timing | [impl] 各DP直後 | 各DP直後（同一） | 各DP直後（同一） |
| Hint | [impl] policyに`showHints:true`だが**UI未参照** | `showHints:false`だがUI未参照 | 同左 |
| Free input | [impl] note textarea（全mode共通） | 同左 | 同左 |
| Result | [impl] 9 Dimension（共通） | 9 Dimension（共通） | 9 Dimension（共通） |
| Final output | [impl] 導線上Adoption Sheet到達可 | 同左 | Adoption Sheet（policyで強調だがUI未参照） |
| 学習難易度 | provenance先出しで最易 | 先出しなしでやや難 | Simulationと同等 |
| 現在の差別化 | **provenance先出しの有無のみ**（`showConceptBeforeDecision`） | 先出しなし | Simulationと判断中は区別不能 |

**判定: 一部重複している（Guidedのみ弱く差別化、Simulation と Adoption Review は実質同じ体験）**

理由（[impl][interp]）:
- 差別化の実装は `experience-policy.ts` の 4 boolean のみ。うち **UIが実際に参照するのは `showConceptBeforeDecision` の 1 つだけ**（[impl] `app-views.tsx`）。`showHints` / `emphasizeFeedback` / `emphasizeAdoptionReview` はUIで参照されておらず、体験差を生んでいない。
- したがって Guided は「判断前 provenance 先出し」で他 2 mode と区別できるが、**Simulation と Adoption Review は判断中も結果画面も同一フロー**。Adoption Review 固有と期待される「実業務 boundary を問う振り返り」（[spec] US6.1 AC6.1.1）は未実装で、Reflection 画面も空。
- 評価が mode 不変なのは設計通り（[spec] FR3.2/BR5.2）で正しい。問題は評価ではなく **提示体験の差別化がほぼ実装されていない**こと。

---

## 8. Navigation / UX Learning Friction

| Issue | Current state | Learning impact | Severity | Improvement |
|---|---|---|---|---|
| Homeへ戻れるか | [impl] `goHome` 実装済だが**どのViewからも呼ばれない**。`nav.home`文言あるが未使用 | 学習を中断/やり直せず離脱 | 高 | 各Viewにホーム導線を配置 |
| Back navigation | [impl] なし（前DP/前画面へ戻る操作なし） | 誤選択を戻せない | 高 | 直前ステップへのback追加 |
| current stage表示 | [impl] なし（stage title は scenario見出しに出ず、ScenarioViewはscenario titleのみ） | 現在どのStageか分からない | 中 | stage名/番号の表示 |
| AI-DLC lifecycle上の現在位置 | [impl] なし | Lifecycle体感が弱い（[spec] NFR1(a)に反する恐れ） | 高 | lifecycleブレッドクラム |
| progress | [impl] なし（進捗バー/ステップ数表示なし） | 残量が見えず完走動機低下 | 中 | progress indicator |
| mode変更 | [impl] 開始後の変更導線なし | 学習経路を切替えられない | 中 | Result等からmode再選択 |
| scenario変更 | [impl] 開始後の変更導線なし。Focp Libraryへの復帰導線もなし | 別scenarioへ移れず行き止まり | 高 | scenario切替/Focusライブラリ復帰 |
| resultから再挑戦 | [impl] なし（Result→Reflection→Adoptionの一方向のみ） | 学び直しできない | 高 | Retry/別選択で再実行 |
| focus scenarioへの移動 | [impl] Homeの「フォーカス」からのみ。Result/完走後の誘導なし | [spec] FR7.1「次に学習すべきFocus」未提示 | 高 | 完走後にFocus推薦 |
| mobile usability | [impl] `styles.css`存在。レスポンシブ設計は本監査で未検証（cssは読んだが数値確認外） | 不明 | 低（未確認） | 実機/幅別検証 |
| 進捗の再開（永続） | [impl] ProgressStore実装済だがフロー未接続（load/save未使用） | リロードで進捗消失（[spec] AC7.2未達） | 高 | load/saveをフローに接続 |

**総括（[interp]）**: 学習の「行き来」を支える navigation（Home / Back / progress / stage位置 / retry / scenario切替）が **ほぼ未実装**。文言や関数（`goHome` `resetProgress` `nav.home` `nav.reset`）は用意されているがUIに露出していない。これが学習価値を下げる最大級のUX摩擦。

---

## 9. Practice Expansion Candidates

現 architecture（決定的 EffectRule / data駆動 scenario / pure domain / port-adapter UI）を壊さずに Create/Review 体験へ引き上げる候補。

## Requirement Practice
ユーザーが Goal / User / Scope / Out of Scope / Constraints / Acceptance Criteria を入力し、必須フィールド有無・AC件数を決定的に判定。

## Evidence Review Practice
Evidence一覧を提示し sufficient / insufficient / missing を判断させ、正解分類と照合。

## Approval Boundary Practice
複数actionを Agent autonomous / Human approval / Block に分類させ、正解分類と照合。

## Delegation Boundary Practice
risk / reversibility / impact を見て agent委任範囲を決めさせ、非単調ルーブリックで評価。

## Traceability Practice
Requirement → AC → implementation → test/evidence を対応付けさせ、完全性を決定的判定。

## Recovery Practice
failure状況から safe next step / retry / rollback / escalation を組み立てさせ、順序・妥当性を判定。

| Practice | Learning value | Existing components reusable | New domain logic | New UI | Runtime AI required? | Priority |
|---|---|---|---|---|---|---|
| Requirement Practice | 高（Create到達） | scenario JSON / loader / provenance / result-model | 必須field/AC件数のrubric判定（決定的） | 入力フォーム + 判定表示 | 不要（presence/countは決定的）。曖昧性の意味評価のみAI要 | P0 |
| Evidence Review Practice | 高（Review到達） | scenario JSON / 9 Dimension（evidence-quality） / EffectRule | Evidence分類の正解データ + 照合 | 分類UI（3択/項目別） | 不要（missing検出は決定的） | P0 |
| Approval Boundary Practice | 高（Review到達） | approval-semantics / 9 Dimension / EffectRule | action分類の正解 + 照合 | 分類UI | 不要 | P1 |
| Delegation Boundary Practice | 高（判断の質向上） | 非単調Dimension / dp-delegateの構造 | risk/reversibility属性データ + 非単調rubric | 属性提示 + 分類UI | 不要（rubric）。nuance説明はAI寄り | P1 |
| Traceability Practice | 中〜高（Create/Review） | traceability Dimension / entities | 対応付け正解 + 完全性判定 | マッピングUI | 不要（完全性は決定的） | P1 |
| Recovery Practice | 中（既存focusを拡張） | focus-refusal-recovery / nextRef遷移 | 手順の順序/妥当性判定 | 手順組み立てUI | 不要（構造判定）。自由記述はAI要 | P2 |

（[interp]。既存コンポーネント再利用性は src 構造から判断。決定的判定可否は §10 と整合）

---

## 10. Runtime AI / Bedrock Boundary

## Deterministicで可能（現architectureで実装可能・runtime AI不要）
[impl] 既存の `dimension-evaluator` / `decision-effect-rules` / `scenario-loader` が示す通り、以下は決定的に判定できる:
- required field presence（要件/AC入力の必須項目有無）
- AC count（受け入れ条件の件数チェック）
- traceability completeness（Req→AC→impl→test対応の欠落検出）
- explicit approval boundary（action分類が正解集合と一致するか）
- structured rubric（選択・分類の正誤、非単調ルーブリック）
- missing evidence detection（提示Evidence集合と必要集合の差分）

## AIが必要になりやすい（現architectureでは実装しない領域）
- 要件文の曖昧性の意味的判定
- acceptance criteriaの意味的品質（測定可能性・網羅性のニュアンス）
- project contextへの適合性
- nuanced risk reasoning（文脈依存のリスク説明）
- 自由記述のsemantic feedback（noteへの意味的評価）

**現在の制約（明示）**（[spec] C2/C3、[impl]）:
- static SPA（Vite / GitHub Pages 配信前提、[spec] NFR6）
- no backend（[spec] C2 / `progress-store.ts` は localStorage のみ）
- no runtime AI（[spec] C3 / FR4.3。自由入力のAI評価は実装しない）
- no external transmission（[impl] Adoption Sheet は Blob download、fetch なし。scenario は build-time 同梱で runtime fetch しない）

したがって §9 の Practice 候補は **Deterministic な部分に限れば現制約内で全て実装可能**。semantic 評価が欲しい場合のみ将来的な runtime AI / Bedrock 境界を越える（Stretch、§14）。

---

## 11. Redundancy / Duplication Audit

| Content A | Content B | 重複内容 | Keep both? | Consolidation idea |
|---|---|---|---|---|
| core dp-testfail | focus-evidence dp-fail | **ほぼ同一判断**（テスト失敗時に調査 vs 期待値書換）。effectRule も evidence-quality strong±/traceability−で同型 | Yes（core=一周体験、focus=深掘り） | focus側は「なぜ書換が危険か」をより深く展開し、単なる再問化を避ける |
| focus-evidence dp-fail | focus-evidence dp-evidence | 同一 scenario 内で同一 LP(lp-ev) を2回提示。判断も「Evidence尊重か省略か」で近接 | 一部 | dp-evidence を「Evidence十分性のReview」へ変えて差別化（§9） |
| checkpoint dp-verify | checkpoint dp-batch | 同一 LP(lp-checkpoint) を2回提示。verify(単体) と batch は粒度違いだが判断構造は同型 | Yes | batch側を「複数Unitの承認境界Review」へ寄せる |
| refusal dp-refusal | refusal dp-nextstep | 同一 LP(lp-recovery) を2回提示。「理由を読む/従う」対「無視/放棄」で判断が連続的だが同型 | Yes | nextstep側を recovery手順の組み立て(Create)へ |
| lp-evidence (core) | lp-ev (focus-evidence) | 「実行済み≠成功、Evidence偽装」という同一概念を別LP idで重複定義 | Yes（scenario独立性のため） | 文言は独立でよいが、学習上は同一メッセージの再提示である点を認識 |

**重視点（[interp]）**: 単なる文言違いより「**同じ判断を何度もさせている**」構造が問題。各 focus scenario 内の 2 DP は「同じ概念を粒度違いで2回」という設計で、2つ目の DP が Review/Create へ発展していない。core の Evidence 判断と focus-evidence も同型。重複自体は core=概観 / focus=深掘りの役割分担で正当化できるが、focus 内の 2 個目 DP を段階的に深める（Decide→Review）と重複感が解消し学習深度も上がる。

---

## 12. Missing Learning Content

[spec] project requirements / stories / scenario 上に根拠があるものだけを対象（外部知識で追加しない）。

| Missing / Weak Topic | Why important | Current coverage | Proposed experience | Priority |
|---|---|---|---|---|
| Change Control / 承認後の要件変更・再承認 | [spec] FR1.4「Approval後のRequirement変更」「Source変更後の再承認」、FR2.1「Change Control」を明示的学習対象に列挙 | scenario なし。9 Dimension にも専用軸なし | Focus scenario追加（承認後変更→再承認要否の判断） | P0 |
| 手戻り / Rework 操作（Return to Previous Stage / Change Scope） | [spec] FR4.1で選択種別として定義、FR4.4/US2.3で「手戻りを体験」要求 | どのscenarioにも該当choiceが無い。rework Dimensionは間接反映のみ | core flowにReturn/Change Scope選択肢を追加 | P0 |
| Result画面の学習締めくくり（Timeline/Consequence/Stage対応/Better Alternative/次のFocus/Reference） | [spec] FR7.1/AC3.1.1で必須列挙 | ResultViewは9 Dimension記号+注記のみ。他要素すべて欠落 | Result拡充（各Decisionの帰結・Stage対応・betterAlternativeRef活用・Focus推薦） | P0 |
| Reflection（振り返り）の実体 | [spec] US2.6 AC2.6.4 / US6.1「自分の判断を実業務観点で振り返る」 | ReflectionViewはタイトル+ボタンのみで空 | 判断一覧+根拠区分+実業務への問いを提示 | P1 |
| 進捗の永続・中断再開 | [spec] FR11.1/US7.2 AC7.2.1で必須 | ProgressStore実装済だがフロー未接続 | load/saveをuse-app-stateに接続 | P1 |
| Adoption Review固有の振り返り問い | [spec] US6.1 AC6.1.1「自分の実業務でのboundary設計を考える問い」 | mode policyのみ。実際の問い未実装 | Adoption Reviewで実業務問いを提示 | P1 |
| IAM Permission過剰 / 古いKnowledge・CodeKB依存 / Session中断・再開 | [spec] FR1.4 Focus候補論点として列挙 | scenario なし | Focus scenario候補（優先度は低め、FR1.4は「候補」） | P2 |
| provenance 4区分のうち harness-behavior / simulation-assumption | [spec] FR6.8/NFR3で4区分識別が要求。US2.4/5.2/5.3で「harness由来でないことを識別」要求 | [impl] 実scenarioで使用は ai-dlc-spec と simulator-interpretation の2区分のみ。他2区分は未使用 | harness挙動を扱う題材でharness-behaviorを実使用し4区分を体験可能に | P2 |
| Traceability の可視化・操作 | [spec] FR5.4.4/AC3.1.2「どのDecisionが寄与したか追跡」 | traceability Dimensionはあるが、寄与Decisionの追跡UIがResultに無い | Result に contributingDecisionRecordIds を可視化 | P1 |

---

## 13. Recommended Learning Journey

現 scenario を再利用した段階的ジャーニー案（[interp]。現実装で到達可能な範囲を明記）。

**Level 1: Understand（知る）**
- 対象Mode: Guided Learning
- Scenario: core-e2e
- 学習Topic: Lifecycle / boundary / approval / evidence / release区別
- user action: 各DPでprovenance先出しを読み、判断する
- completion condition: core-e2e完走（4 DP）

↓

**Level 2: Decide（自力で判断する）**
- 対象Mode: Simulation
- Scenario: core-e2e
- 学習Topic: 同上を先出しなしで判断
- user action: ヒントなしで4 DPを判断
- completion condition: core-e2e完走 + 9 Dimension確認

↓

**Level 3: Practice（深掘り）**
- 対象Mode: Focus（mode非依存）
- Scenario: focus-evidence → focus-checkpoint-review → focus-refusal-recovery
- 学習Topic: Evidence / checkpoint review / refusal-recovery
- user action: 各focusの2 DPを判断
- completion condition: 3 focus完走
- 注（[interp]）: 現状Level 3は依然Decide止まり。Create/Reviewは§9 Practice実装後に本Levelへ組込む想定

↓

**Level 4: Review（評価・改善）**
- 対象Mode: —（**現状未実装**）
- 学習Topic: Evidence十分性 / Approval Boundary分類 / Traceability
- user action: §9のReview Practiceで成果物を評価
- completion condition: Practice実装後に定義（現状到達不可）

↓

**Level 5: Adoption（導入検討）**
- 対象Mode: Adoption Review
- Scenario: core-e2e（完走履歴を利用）
- 学習Topic: 実業務boundary設計 / Team Discussion
- user action: Adoption Discussion Sheet生成・note追記・download
- completion condition: Sheet生成
- 注（[interp]）: Reflectionの実体化とAdoption固有の問い（§12）が加わると本Levelが機能する

**総括（[interp]）**: Level 1–3 と Level 5 は現 scenario/mode で概ね構成できるが、**Level 4（Review）は現状到達手段がない**。§9 の Practice を追加してはじめて 5 段階が完成する。

---

## 14. Improvement Backlog

## P0 — Learning value blocker
- **P0-1 Result画面の学習締めくくりを実装**
  - Problem: [spec] FR7.1/AC3.1.1が必須とするTimeline/Consequence/Stage対応/Better Alternative/次のFocus/Referenceが全欠落。[impl] 9 Dimension記号のみ
  - Proposed change: DecisionRecord列からTimeline、EffectRuleのrationale/LPからConsequence、`betterAlternativeRef`活用、Focus推薦、provenance reference表示
  - Learning impact: 高（Know→振り返り学習の要）
  - Implementation impact: 中（ResultView拡充。domainは既存result-model/contributingDecisionRecordIds再利用）
  - Existing components reusable: result-model / dimension-evaluator / provenance / learningPoint.betterAlternativeRef
  - Test impact: ResultView test追加（現状は9件数のみ検証）
- **P0-2 手戻り（Return/Change Scope）を体験可能に**
  - Problem: [spec] FR4.1/FR4.4/US2.3で要求だが選択肢が全scenarioに無い
  - Proposed change: core flowにReturn to Previous Stage / Change Scope choiceを追加（scenario JSON + advanceStageの逆遷移）
  - Learning impact: 高（rework理解）
  - Implementation impact: 中（scenario-progressionに戻り遷移。現状advanceStageは前進のみ）
  - Existing components reusable: scenario JSON schema / effectRule(rework)
  - Test impact: progression test追加
- **P0-3 Change Control / 承認後変更 Focus scenario追加**
  - Problem: [spec] FR1.4/FR2.1で明示学習対象だがscenario無し
  - Proposed change: JSON追加のみ（domain変更不要、[spec] FR3.1）
  - Learning impact: 高
  - Implementation impact: 低（データ追加）
  - Existing components reusable: loader / engine全て
  - Test impact: scenarios.test.ts に1本追加
- **P0-4 Requirement / Evidence Review Practice（Create/Review到達）**
  - Problem: 学習がDecide止まり（§4）。Create/Review体験ゼロ
  - Proposed change: §9のRequirement Practice / Evidence Review Practiceを決定的rubricで実装（runtime AI不要）
  - Learning impact: 最高（depth 3–4到達）
  - Implementation impact: 中〜高（新domain rubric + 新UI。engine/loaderは再利用）
  - Existing components reusable: dimension-evaluator / effectRule / provenance / result-model
  - Test impact: rubric判定のunit test（決定性・golden）

## P1 — High learning value
- **P1-1 進捗永続をフローに接続**: Problem: ProgressStore実装済だが未使用でリロード消失（AC7.2未達）。Change: use-app-stateでload/save接続。Impact: 中。Reusable: progress-store全て。Test: 復元test
- **P1-2 Reflection実体化 + Adoption固有の問い**: Problem: Reflection空、Adoption Reviewが差別化されない（US6.1）。Change: 判断一覧+根拠区分+実業務問い。Impact: 中。Reusable: DecisionRecord/provenance。Test: view test
- **P1-3 mode差別化の実装（showHints等の反映）**: Problem: policy 4値中UIが1値しか参照せず3 modeがほぼ同一（§7）。Change: showHints/emphasizeAdoptionReviewをUIで実際に反映。Impact: 中。Reusable: experience-policy。Test: mode別view test
- **P1-4 Approval/Delegation/Traceability Practice**: §9のP1候補。決定的rubric。Reusable: 非単調Dimension/approval-semantics

## P2 — UX / visualization
- **P2-1 Navigation整備**: Home戻る/Back/progress/stage位置/retry/scenario切替/Focus復帰（§8）。`goHome`/`resetProgress`/`nav.home`/`nav.reset`は既存。Impact: UX大。Test: navigation test
- **P2-2 lifecycle位置の可視化**: 現在Stage/lifecycleブレッドクラム（NFR1(a)補強）
- **P2-3 完走後のFocus推薦導線**: FR7.1「次に学習すべきFocus」
- **P2-4 focus内2個目DPをReviewへ発展**: 重複解消（§11）

## Stretch — runtime AI / Bedrock 等
- **S-1 自由記述noteのsemantic feedback**: [spec] C3/FR4.3で現状禁止。要件文の曖昧性・AC意味品質の評価（§10 AI領域）。制約変更（backend/runtime AI導入）を要し、no-network posture（NFR6/NFR7）と両立検討が必要

**優先方針（[interp]）**: デザインの派手さより「AI-DLCを実際に使えるようになるか」を優先し、P0（Result締めくくり・手戻り・Change Control・Create/Review Practice）を最上位に置く。

---

## 15. Final Assessment

100点満点。各点は上記セクションの事実に基づく（[interp]）。

- **Learning Depth: 45 / 100** — Know + Decide は成立（10 DP全て決定的評価）。Create/Review未到達（§4）、Change Control欠落、手戻り未実装
- **Mode Differentiation: 30 / 100** — 評価不変は設計通り。だがUIが参照する差別化はGuidedのprovenance先出し1点のみ。Simulation/Adoption Reviewは実質同一（§7）
- **Feedback Quality: 50 / 100** — Why/provenanceは明確。だが選択に依らず同一LP提示、判断時のDimension impact非表示、良否が即時に分からない（§6）
- **Practice / Hands-on Value: 25 / 100** — 全て選択式。作る/レビューする体験なし。noteは採点対象外の転記のみ（§5）
- **AI-DLC Topic Coverage: 60 / 100** — boundary/approval/evidence/testing/checkpoint/refusal-recovery/release区別は網羅。Change Control/Reversibility独立軸/rework操作が欠落（§4/§12）
- **UX for Learning: 35 / 100** — Home戻る/Back/progress/stage位置/retry/scenario切替/永続再開がほぼ未実装（§8）
- **Reusability / Extensibility: 85 / 100** — data駆動scenario/pure domain/決定的評価/port-adapterで拡張容易（[spec] FR3.1、JSON追加でscenario増設可）。§9 Practiceも既存部品を再利用可能
- **Overall: 45 / 100** — 基盤（engine/評価/provenance/i18n/a11y志向/拡張性）は堅牢だが、学習体験がKnow+Decideの選択問題に留まり、Result締めくくり・手戻り・Create/Review・navigationが未達で学習価値が頭打ち

**現状のSimulatorを一言で表すなら**: 「堅牢な決定的エンジンの上に載った、AI-DLCの主要判断を選択式で一周体験できるクイズ型ラーナー」

**改善後に目指すべきSimulatorを一言で表すなら**: 「AI-DLCの判断を自分で下し、成果物を作り・レビューし、実チーム導入まで持ち帰れる実践型トレーナー」
