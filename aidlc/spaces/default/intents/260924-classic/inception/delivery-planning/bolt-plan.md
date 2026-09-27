# Bolt Plan — AI-DLC Learning Simulator

> **Bolt** = **planning / delivery slice**（この Delivery Planning が計画する、動く成果物で終わる実装の 1 まとまり。Definition of Done・確認したい仮説・担当を持つ）。**Bolt は AI-DLC engine が runtime の grouping/order 境界として直接実行するものではない**。engine の正式な **walk order** は `unit-of-work-dependency.md`（＝Construction runtime batches の source）と Construction stage semantics に従う。したがって「9 Bolt を engine が B1→B9 として順次実行する」とは解釈しない。B1〜B9 は **U1 内部の planned implementation slices（delivery slices）** であり、engine 上の独立 Unit/Bolt runtime boundary ではない。
> **AI-DLC Unit of Work（v2.9.0 semantics）** = independently implementable piece。本プロジェクトでは **U1 が唯一の AI-DLC Unit of Work**（deployable unit と一致）。B1〜B8 は U1 内部の planned implementation slices にすぎず、engine 上で独立に設計→code generation→verification される正式な Construction Unit/Bolt boundary ではない。もし B1〜B8 を独立 Construction slice として扱いたくなった場合は、Delivery Planning だけでなく **Units Generation へ Change Control で戻り複数 Unit 化の要否を再評価**する（現時点は U1 単一を維持し「Bolt=planning slice」とする）。
> **unit-major** = Bolt-major ではなく、**Unit を Construction stages 3.1〜3.5（functional-design / nfr-requirements / nfr-design / infrastructure-design / code-generation）へ通す walk mode**。単一 Unit(U1) を設計〜コードまで一貫して通す。
> **walking skeleton** = 全アーキテクチャ層を貫く最小の end-to-end スライスで、アーキテクチャが成立することを最初に証明する最初の implementation slice。
> 実装方針: **skeleton-first / sequential / unit-major / solo（aidlc-developer-agent）**。各 slice は implement → validate → evidence → 次 slice の順で閉じてから進む。**Coverage != Verification**（Story/Requirement を slice へ割り当てただけでは検証済みとしない。検証は各 slice の Validation/tests と Build & Test で行う）。
> Learning Target = AI-DLC v2.10.0 / Dev Workflow Runtime = v2.9.0。Owner は全 slice で aidlc-developer-agent。

## Bolt 概要

| Bolt | Name | User-visible working outcome | 主な work units / Components |
|---|---|---|---|
| B1 | Walking Skeleton | 1 Scenario を開始し Decision を選ぶと決定的な最小 Result が出る end-to-end | ScenarioLoader, ScenarioCatalog, ScenarioProgression, DimensionEvaluator(最小), ResultModel(最小), ApplicationOrchestrator, /ui shell |
| B2 | Deterministic Evaluation 拡充 | 9 Dimension の非単調評価が意味を持ち、説明可能な Result になる | DimensionEvaluator, DecisionEffectRules, ApprovalSemantics, ResultModel |
| B3 | Provenance & 教育的正確性 | Decision/LearningPoint に 4 区分 provenance が表示・区別できる | ScenarioCatalog(ProvenanceEntry), ResultModel, /ui |
| B4 | Guided Learning 体験 & i18n | Guided モードで Core Scenario を ja/en 完走でき、表示言語で結果が変わらない | ExperiencePolicy, LocaleResources, ScenarioProgression, /ui |
| B5 | Result / Reflection & 永続化 | Result/Reflection 画面と進行の localStorage 保存・復元・破損処理 | ResultModel, ProgressStore, /ui |
| B6 | Adoption Review & Discussion Sheet | Adoption Review モードと決定的 Markdown の Adoption Discussion Sheet 出力 | AdoptionSheetComposer, ExperiencePolicy, ResultModel, /ui |
| B7 | Focus Scenario Library & Simulation モード | Focus Scenario Library と Simulation モードで個別論点を深掘りできる | ScenarioCatalog, ScenarioProgression, ExperiencePolicy, /ui |
| B8 | Accessibility 仕上げ & JSON fixture 健全性 | WCAG 2.2 AA 観点の完成度向上、全 Scenario JSON の健全性を CI で担保 | /ui(a11y 横断), ScenarioLoader, testing |
| B9 | AWS Deployment Readiness & Evidence Preparation | production build・AWS deployment config/IaC・CloudFront+S3 readiness・smoke-test plan・credential/permission preflight・evidence capture plan（**実 deployment execution は Operation へ handoff**） | build/deploy config, IaC |

> 注: accessibility(C) と provenance(B) は B8/B3 で「仕上げ」るが、リスク方針どおり **Bolt 1 から最小限を組み込む**（B1 で semantic HTML/keyboard/focus/logical order と 4 区分 provenance の最小フックを入れる）。B8/B3 は専任の完成度向上であって「初めて着手する」意味ではない。

---

## B1 — Walking Skeleton（最優先・skeleton）

- **Bolt ID / name**: B1 / Walking Skeleton
- **Goal**: 全アーキテクチャ層を貫く最小 end-to-end を通し、layer 間接続・semantic data と presentation の分離・deterministic progression/evaluation・stable-ID flow が実際に成立することを検証する。
- **User-visible working outcome**: 1 つの Scenario を開始 → Decision を 1 つ以上選択 → 進行が反映され → 最小の決定的 Result が表示される（ja 単一言語でよい）。
- **Included work units / Domain Components**: ScenarioLoader（Scenario JSON 検証境界）, ScenarioCatalog, ScenarioProgression, DimensionEvaluator（1〜数 Dimension の最小）, ResultModel（最小）, ApplicationOrchestrator（結線）, /ui shell（最小画面 + semantic HTML/keyboard/focus）。
- **User Stories / Requirements covered（Coverage、Verification ではない）**: US2.1, US2.2（部分）, US8.1, US8.2 / FR1, FR3(部分), FR4(部分), FR5.4, FR12, C1, C4, C5, NFR2, NFR5。
- **Hypothesis / risk being validated**: 「Scenario JSON 分離 → 検証 → 進行 → 決定的評価 → 結果表示」の縦の配線が成立する。B1 で検証するのは: **same semantic input + same decision sequence → same result** / stable-ID determinism / runtime semantic ID の時刻・乱数非依存 / validation boundary が ScenarioLoader に閉じている / domain と UI の分離。**ja/en invariance と mode invariance は i18n / ExperiencePolicy が実装される B4 で正式に検証する**（B1 では単一言語・単一モードでよい）。すなわち **最優先リスク A は B1 / B2 / B4 にまたがって段階的に close する**（B1=配線と基本決定性、B2=評価が data/rule で完結し UI 非評価、B4=言語/mode 不変）。
- **Definition of Done**: 上記 outcome が動作。domain は React/localStorage/UI/locale text/raw JSON を直接参照しない。malformed Scenario は fail-fast で readable error（silent fallback なし）。最小でも 4 区分 provenance のデータ構造と semantic HTML/keyboard/visible focus の骨格が入っている。
- **Validation / tests**: deterministic core の unit test（同一入力→同一 result、順序不変性、時刻・乱数排除の ESLint ガード）。ScenarioLoader の schema/必須/参照検証テスト（妥当 Scenario が通り、欠落・型不一致が readable error で弾かれる）。skeleton の end-to-end 動作確認。
- **Evidence to retain**: 決定性テストの結果、malformed JSON 拒否のログ/スクリーン、skeleton 動作の記録。
- **Dependencies on earlier Bolts**: なし（先頭）。
- **Explicitly deferred**: 9 Dimension 完全版（B2）、provenance 表示の作り込み（B3）、i18n 完走（B4）、永続化（B5）、Adoption Sheet（B6）、Focus Library/Simulation（B7）、a11y 完成度（B8）、AWS 配信（B9）。
- **Owner**: aidlc-developer-agent。

## B2 — Deterministic Evaluation 拡充（リスク A の本体）

- **Bolt ID / name**: B2 / Deterministic Evaluation 拡充
- **Goal**: 9 Concept/Decision Dimension の非単調・決定的評価を data-driven で成立させ、説明可能な Result にする。
- **User-visible working outcome**: Decision の結果が 9 Dimension で説明され、Human Intervention 過多も High Risk 過剰委任も「悪い」側に振れる非単調評価が Result に反映される。
- **Included work units / Domain Components**: DimensionEvaluator（9 Dimension）, DecisionEffectRules（data-driven, ADR-005）, ApprovalSemantics, ResultModel。
- **User Stories / Requirements covered**: US2.2, US2.4, US2.5, US3.1, US3.2, US7.4 / FR5, FR5.4.1, FR5.4.2, NFR2, NFR3。
- **Hypothesis / risk being validated**: 評価が data/rule で完結し UI に評価ロジックが漏れない。mode を変えても evaluation result が変わらない。非単調モデルが教育的に意味を持つ。
- **Definition of Done**: 9 Dimension の DimensionOutcome が決定的に算出。代表 Scenario の golden 期待値を固定。UI に評価ロジックなし。
- **Validation / tests**: Dimension ごとの branch coverage を高め未検証分岐を残さない。golden 値テスト（無検証 snapshot 更新はしない）。mode 不変性テスト。
- **Evidence to retain**: golden テスト結果、branch coverage レポート、非単調性を示すケース。
- **Dependencies on earlier Bolts**: B1。
- **Explicitly deferred**: provenance 表示（B3）、i18n（B4）。
- **Owner**: aidlc-developer-agent。

## B3 — Provenance & 教育的正確性（リスク B）

- **Bolt ID / name**: B3 / Provenance & 教育的正確性
- **Goal**: 重要 Decision/LearningPoint について 4 区分 provenance を区別・表示できるようにし、AI-DLC v2.10.0 仕様と Simulator 独自解釈の混同を防ぐ。
- **User-visible working outcome**: LearningPoint/Result 上で ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption の 4 区分が識別できる表示。
- **Included work units / Domain Components**: ScenarioCatalog（ProvenanceEntry, category 別必須参照）, ResultModel, /ui（provenance 表示スロット）。
- **User Stories / Requirements covered**: US7.3, US3.2(部分) / FR2.2, FR6, FR6.8, NFR3。
- **Hypothesis / risk being validated**: 教材の正確性を、spec 由来か独自解釈かを追跡可能な形で担保できる（信頼性リスク B）。
- **Definition of Done**: 4 区分が semantic data として付与・検証され、UI で区別表示。provenance invariant（category 別 required reference）を ScenarioLoader が検証。
- **Validation / tests**: provenance invariant のテスト、4 区分表示のレンダリングテスト。
- **Evidence to retain**: provenance invariant テスト結果、区分表示のスクリーン。
- **Dependencies on earlier Bolts**: B1, B2。
- **Explicitly deferred**: i18n 完走（B4）、Adoption Sheet の provenance 反映（B6 で連携）。
- **Owner**: aidlc-developer-agent。

## B4 — Guided Learning 体験 & i18n

- **Bolt ID / name**: B4 / Guided Learning 体験 & i18n
- **Goal**: Guided モードで Core Scenario を約 5〜10 分で ja/en 完走でき、表示言語が semantic result を変えないことを保証する。
- **User-visible working outcome**: 言語切替を含む Guided モードで Core Scenario を最初から最後まで通せる。
- **Included work units / Domain Components**: ExperiencePolicy（モード提示ポリシー）, LocaleResources（ja/en, 翻訳欠落検出）, ScenarioProgression, /ui。
- **User Stories / Requirements covered**: US1.1, US1.2, US2.1, US2.2, US2.3, US2.6, US5.1 / FR2, FR4, FR10, NFR1, NFR6。
- **Hypothesis / risk being validated**: 言語や mode を変えても identity/evaluation/traceability が不変（ADR-006）。Core が短時間体験として成立。
- **Definition of Done**: ja/en 完走。表示変更で評価結果不変のテスト green。翻訳欠落を検出。
- **Validation / tests**: i18n 不変性テスト（ja/en で同一 semantic result）、Guided 完走の flow テスト。
- **Evidence to retain**: i18n 不変性テスト結果、ja/en 完走記録。
- **Dependencies on earlier Bolts**: B1, B2, B3。
- **Explicitly deferred**: 永続化（B5）、Adoption（B6）、Focus/Simulation（B7）。
- **Owner**: aidlc-developer-agent。

## B5 — Result / Reflection & 永続化

- **Bolt ID / name**: B5 / Result / Reflection & 永続化
- **Goal**: Result/Reflection 体験を完成させ、進行・結果・設定を localStorage で安全に保存・復元する。
- **User-visible working outcome**: 完了後に Result/Reflection を確認でき、再訪時に進行が復元される（破損時は安全にリセット）。
- **Included work units / Domain Components**: ResultModel, ProgressStore（localStorage adapter, schemaVersion, corrupted 処理, PersistenceError）, /ui。
- **User Stories / Requirements covered**: US2.3, US3.1, US7.2 / FR3, FR11, NFR2。
- **Hypothesis / risk being validated**: 永続化は stable-ID ベースで表示文言に依存しない。破損状態を安全に扱える。persistence schemaVersion は Scenario schema version と別概念として扱える。
- **Definition of Done**: 保存/復元/破損リセットが動作。domain object と localStorage 表現を同一視しない。
- **Validation / tests**: 永続化の round-trip テスト、破損 state のリカバリテスト。
- **Evidence to retain**: round-trip/破損リカバリテスト結果。
- **Dependencies on earlier Bolts**: B1, B2, B4。
- **Explicitly deferred**: Adoption（B6）、Focus/Simulation（B7）。
- **Owner**: aidlc-developer-agent。

## B6 — Adoption Review & Discussion Sheet

- **Bolt ID / name**: B6 / Adoption Review & Discussion Sheet
- **Goal**: Adoption Review モードと、決定的に生成される Markdown の Adoption Discussion Sheet を成立させる。
- **User-visible working outcome**: Adoption Review モードで導入議論の観点を確認でき、Adoption Discussion Sheet（Markdown）を出力できる。
- **Included work units / Domain Components**: AdoptionSheetComposer（pure service, 決定的 Markdown 生成）, ExperiencePolicy, ResultModel, /ui。
- **User Stories / Requirements covered**: US4.1, US6.1 / FR7, FR8, OOS3（Sheet は確定物でなく議論材料）。
- **Hypothesis / risk being validated**: Sheet が決定的に生成され、導入議論に使える粒度になる。
- **Definition of Done**: Adoption Review 動作、Sheet が決定的生成（同一入力→同一 Markdown）、Composer は LocaleResources に直接依存せず locale bundle を受け取る。
- **Validation / tests**: Sheet 生成の決定性テスト（golden）、Adoption Review flow テスト。
- **Evidence to retain**: Sheet golden テスト結果、生成例。
- **Dependencies on earlier Bolts**: B1, B2, B3, B4, B5。
- **Explicitly deferred**: Focus Library/Simulation（B7）。
- **Owner**: aidlc-developer-agent。

## B7 — Focus Scenario Library & Simulation モード

- **Bolt ID / name**: B7 / Focus Scenario Library & Simulation モード
- **Goal**: 時間制限なしで論点を深掘りする Focus Scenario Library と Simulation モードを成立させる。
- **User-visible working outcome**: Focus Scenario Library から個別 Scenario を選び、Simulation モードで深掘りできる。
- **Included work units / Domain Components**: ScenarioCatalog, ScenarioProgression, ExperiencePolicy, /ui。
- **User Stories / Requirements covered**: US5.2, US5.3, US2.6(Simulation 部分) / FR2, FR9, NFR5（JSON 追加で拡張）。
- **Hypothesis / risk being validated**: 同一 Scenario Shell/Engine を再利用して Focus/Simulation を追加でき、JSON 追加で拡張可能。
- **Definition of Done**: Focus Library と Simulation モードが動作、同一 engine/data を再利用。
- **Validation / tests**: Focus/Simulation の flow テスト、Scenario 追加時の健全性。
- **Evidence to retain**: flow テスト結果。
- **Dependencies on earlier Bolts**: B1, B2, B3, B4。
- **Explicitly deferred**: a11y 完成度（B8）、AWS 配信（B9）。
- **Owner**: aidlc-developer-agent。

## B8 — Accessibility 仕上げ & JSON fixture 健全性

- **Bolt ID / name**: B8 / Accessibility 仕上げ & JSON fixture 健全性
- **Goal**: WCAG 2.2 AA を目標とした accessibility 完成度を高め、全 Scenario JSON の健全性を CI で担保する（accessibility は B1 から着手済み、ここで仕上げ）。
- **User-visible working outcome**: keyboard のみで主要 Flow を完走でき、focus 表示・contrast・色非依存表現・aria-live 通知が整う。
- **Included work units / Domain Components**: /ui（a11y 横断）, ScenarioLoader（fixture 健全性）, testing。
- **User Stories / Requirements covered**: US7.1 / NFR4, C1。
- **Hypothesis / risk being validated**: 主要 Flow が keyboard 完走可能で critical/serious a11y 違反がない（準拠主張は手動確認前提で誇張しない）。
- **Definition of Done**: axe critical/serious ゼロ、Tab 順/Enter・Space 起動/focus 確認、全 /scenarios/*.json のパラメタライズド健全性テスト green。
- **Validation / tests**: axe レンダリングテスト、user-event での keyboard テスト、eslint-plugin-jsx-a11y、JSON fixture 健全性テスト。
- **Evidence to retain**: axe 結果、keyboard テスト結果、fixture テスト結果、および「自動チェックは準拠の一部であり手動確認が必要」の注記。
- **Dependencies on earlier Bolts**: B1〜B7。
- **Explicitly deferred**: AWS 配信（B9）。
- **Owner**: aidlc-developer-agent。

## B9 — AWS Deployment Readiness & Evidence Preparation

> **重要**: 本 slice は Construction 内で **deployment readiness の準備まで**を扱う。**実際の AWS への deployment execution は Operation フェーズの Deployment Execution へ handoff** する。AI-DLC Completion Approval（この workflow の完了）と AWS Release Approval（本番公開判断）は分離（C6）。

- **Bolt ID / name**: B9 / AWS Deployment Readiness & Evidence Preparation
- **Goal**: 同一 source/bundle を AWS（CloudFront + S3）へ配信できる **readiness** を Construction 内で整える（実配信は Operation）。
- **User-visible working outcome**: production build が生成でき、AWS 配信に必要な設定・手順・preflight・evidence 計画が揃った状態（＝deployment-ready）。公開 URL の実現は Operation の Deployment Execution。
- **Construction で扱うもの**: production build / AWS deployment configuration・IaC / CloudFront + S3 deployment readiness / smoke-test plan / credential・permission preflight / evidence capture plan / secrets 非露出確認。
- **Operation へ handoff するもの**: 実際の AWS への deployment execution、公開後の smoke 実行、公開 URL の確定、release 判断（AWS Release Approval）。
- **Included work units / Domain Components**: build/deploy config（Vite `base` 等）, IaC（CloudFront + S3）。
- **User Stories / Requirements covered（Coverage、Verification ではない）**: US（横断・非機能） / NFR6, NFR7(部分), C6。
- **Hypothesis / risk being validated**: 同一 bundle が AWS でも GitHub Pages でも動く構成（hosting 差異は config のみ、別実装なし）が readiness レベルで成立する。
- **Definition of Done**: production build 成功、deployment config/IaC 準備、readiness チェックと preflight 完了、smoke-test plan と evidence capture plan 策定、secrets 非露出確認。**実 deployment execution は含まない**（Operation へ handoff）。
- **Validation / tests**: 本番相当ビルドの動作確認、smoke-test plan のレビュー、config/IaC の妥当性確認。
- **Evidence to retain**: build ログ、deployment config/IaC、preflight 結果、smoke-test plan、evidence capture plan（secrets は repo/evidence に含めない）。
- **Dependencies on earlier Bolts**: B1〜B8。**Construction 序盤に AWS preflight（account/credential・S3/CloudFront 権限・Kiro からの操作可否・evidence 取得方法）を確認**（readiness slice の前倒しでも実 deployment でもない、実行可能性の事前確認）。
- **Explicitly deferred（Operation へ）**: 実 AWS deployment execution、公開後 smoke、公開 URL 確定、AWS Release Approval。
- **Owner**: aidlc-developer-agent。

---

## 用語整合（4 artifact 共通・AI-DLC v2.9.0 semantics）

本 Delivery Planning の 4 artifact（bolt-plan.md / team-allocation.md / risk-and-sequencing-rationale.md / external-dependency-map.md）は次を同一の意味で用いる:

- **Bolt = planning / delivery slice**（engine の runtime 実行境界ではない）。
- **runtime walk source = `unit-of-work-dependency.md`**（Construction runtime batches の source。walk order は Construction stage semantics に従う）。
- **Construction iteration = unit-major**（Unit を Construction stages 3.1〜3.5 へ通す walk mode。Bolt-major ではない）。
- **U1 = single AI-DLC Unit of Work**（唯一の独立実装単位・deployable unit と一致）。
- **B1〜B8 = U1 内部の planned implementation slices**（engine 上の独立 Unit/Bolt runtime boundary ではない）。
- **deployment execution = Operation フェーズ（Deployment Execution）へ handoff**（Construction の B9 は readiness/evidence preparation まで）。
- **Coverage != Verification**（slice への割り当ては検証ではない。検証は各 slice の Validation/tests と Build & Test）。
