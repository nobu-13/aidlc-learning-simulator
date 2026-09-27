# Code Generation Plan — U1: aidlc-learning-simulator-web

> static React + TypeScript(strict) + Vite SPA。backend/DB/登録/外部 AI API なし。Scenario は JSON 管理し domain logic と分離。決定的評価。i18n ja+en。WCAG 2.2 AA 目標。Learning Target = AI-DLC v2.10.0 / Dev Workflow Runtime = v2.9.0。
>
> 本 plan は Testing Contract（methodology=test-after、ただし deterministic core は test-first/concurrent）に従い、`/src` を `domain`（pure）/ `data`（境界 validation・localStorage）/ `scenarios`（JSON data）/ `i18n`（locale resources）/ `app`（結線）/ `ui`（React presentation）へレイヤー分離する。application code は workspace root（`/src` 等）へ生成し、record dir へは生成しない。

## 1. Scope と前提

- **生成対象**: U1 = `aidlc-learning-simulator-web`（deployable unit 1 つ、monolithic static bundle）。
- **layer 分離（ADR-009 hexagonal 依存方向）**:
  - `/src/domain` — pure semantic logic。React / localStorage / raw JSON / locale text / `Date` / `Math.random` / `performance.now` 非依存。ScenarioProgression / DecisionEffectRules / DimensionEvaluator / ApprovalSemantics / ResultModel / AdoptionSheetComposer / ExperiencePolicy。
  - `/src/data` — 境界: ScenarioLoader（唯一の raw JSON validation boundary・zod）/ ProgressStore（localStorage adapter・破損/非互換処理）。
  - `/src/scenarios` — Scenario JSON（build-time asset・data only、logic を持たない）。
  - `/src/i18n` — LocaleResources（ja/en、翻訳欠落検出）。semantic data と分離。
  - `/src/app` — ApplicationOrchestrator（loader→catalog→progression→result の結線）。
  - `/src/ui` — React presentation。domain logic 非所有（render / user intent / a11y / presentation state のみ）。
- **命名規約（team.md）**: file = kebab-case、type = PascalCase、interactive UI に `data-testid`。
- **決定性（NFR2）**: evaluation / progression / sheet 生成 / runtime semantic ID は同一入力→同一結果。time/random/order/locale/mode 非依存。ESLint（`no-restricted-globals` / `no-restricted-properties`）で domain/evaluation/semantic-ID から `Date`/`Math.random`/`performance.now` を静的排除。
- **禁止事項（project.md Forbidden 再掲）**: backend/DB/登録/外部 AI API を作らない。secret/token を repo・bundle・evidence に含めない。AWS版/Pages版を別実装しない。AI-DLC 完了承認 = AWS Release Approval と扱わない。
- **development-time capability と runtime dependency の分離（重要）**: Agent Toolkit for AWS / AWS MCP Server / Kiro は **development-time の agent capability**（設計・実装・検証・deploy 支援）であり、Simulator 本体の **runtime dependency にはしない**。生成される application runtime は引き続き client-only static SPA（backend なし / runtime generative AI なし / runtime AWS API dependency なし / runtime external API なし / application data・user input の外部送信なし）を維持する。すなわち「Kiro / Agent Toolkit / AWS MCP → development・infrastructure・deployment 支援」と「Browser → AI-DLC Learning Simulator（runtime）」を明確に分離する。

## 2. Testing 方針（Testing Contract 準拠）

- methodology = **test-after**。ただし **deterministic core（scoring/evaluation・scenario transition・requirement coverage・approval boundary 判定・markdown 生成）はテストを実装と同時または先行**して書く（team ordering）。
- strategy = **standard**（component あたり 5〜8 本の unit + 主要境界の integration、合計 ~20〜50 本、MVP は e2e 無し）。
- runner = **Vitest**、coverage = `@vitest/coverage-v8`。一律 line floor は置かず、**core は branch coverage を高く維持**し未検証分岐を残さない。UI は主要 User Flow 重視。
- 決定性検証: (a) 反復実行で同一スコア、(b) 入力順序入替で不変（順序不変性）、(c) time/random を ESLint で静的排除、(d) 代表 Scenario ごとの golden 期待値固定（無検証 snapshot 更新をしない）。
- JSON fixture 健全性テスト 1 本: 同梱全 `/src/scenarios/*.json` を境界 schema で実ロード・検証（妥当 Scenario 通過 / 必須欠落・型不一致・contribution 範囲外を可読エラーで reject）。
- a11y: 主要画面 render テストに axe（critical/serious ゼロ）、`@testing-library/user-event` で Tab 順・Enter/Space 起動・focus、静的に `eslint-plugin-jsx-a11y`。自動チェックは準拠の一部であり手動確認が別途必要である旨を明記。
- CI ゲート: test/lint 失敗はマージ block。Vitest は `--passWithNoTests=false`。`.skip`/`.todo` 可視化。未実行テストを成功と報告しない。
- 測定対象の quality target（NFR9 performance budget、branch coverage、a11y 違反ゼロ）は入力であり緩めない。満たせない場合は gap を surface する。

## 3. AWS/Kiro preflight（Code Generation の prerequisite・Approve 直後／コード生成前に実行）

> Human 指示（Option B）: **Code Generation のコード生成（Step 4）に着手する前に、READ-ONLY の AWS/Kiro connection preflight を実施し、PASS を prerequisite とする**。目的は deployment ではなく、「Kiro が AWS を理解・参照・操作できる development environment が成立していること」の確認。
>
> **実行タイミングの制約（harness 由来）**: Code Generation stage の Plan Approval guard は、承認前は planning ファイルの単一書き込みのみを許可し、shell / AWS MCP Server / Agent Toolkit / Powers を含む副作用ツールを一律 block する。したがって live preflight は **Approve Plan の直後・かつ Step 4 コード生成の前**に実行する（guard は承認で解禁される）。この順序は Human 意図（実装判断の前に AWS 参照環境の成立を確認する）を満たす。**preflight が PASS するまで Step 4 に進まない**。FAIL 時は Step 4 に入らず、原因を surface して Request Changes 相当で戻す。
>
> **primary AWS development interface = Kiro + Agent Toolkit for AWS Skills + AWS MCP Server**。単に Kiro から AWS CLI を実行できる状態を目的にしない。
>
> **MCP 役割整理（重複制御）**: primary は **AWS MCP Server（許可された AWS 情報取得・操作）** と **Agent Toolkit for AWS Skills（AWS Best Practice に沿った開発判断）**。既存の **AWS Documentation MCP は「公式 documentation 参照専用」**として役割を限定し、AWS MCP Server と機能が重複する部分は AWS MCP Server を優先する。重複 MCP を無制御に併用しない。実際の Skill 名・MCP 構成は現在利用可能な Agent Toolkit / MCP 定義に従い、**存在しない Skill 名を推測して作らない**。
>
> READ-ONLY・prod resource 作成/変更なし・AWS live は Hackathon Release blocker・CFN provision / application deployment は承認済み Infrastructure Design どおり **Operation** で実施、という方針は不変。

### preflight 項目（Approve 直後・コード生成前に実行し PASS/FAIL を記録）

- [ ] **PF1 — Kiro ↔ AWS MCP Server connection**: Kiro から AWS MCP Server へ正常接続でき、read-only 問い合わせが到達することを確認。
- [ ] **PF2 — Agent Toolkit for AWS Skills availability**: 本構成に関係する領域（CloudFormation / Amazon S3 / Amazon CloudFront / IAM / AWS deployment・infrastructure guidance）の Skills を Kiro から利用できることを確認。Skill 名・構成は Agent Toolkit 側の実定義に従う（推測で作らない）。
- [ ] **PF3 — AWS identity / account / region**: AWS MCP Server または同一 AWS identity context から read-only で caller identity / AWS account / target Region / 現在の credential context を確認。credential / access key / token 自体は表示・保存・Evidence 化しない。
- [ ] **PF4 — AWS Documentation / AWS context 取得**: Kiro が AWS 公式情報を取得できることを確認。AWS 関連判断の前に可能な限り (1) Agent Toolkit for AWS Skills → (2) AWS MCP Server → (3) AWS 公式 documentation → (4) project 内の承認済み設計資料 を参照する運用を確認。
- [ ] **PF5 — AWS permissions readiness**: prod resource は作成せず、後段（Operation）で必要となる権限（CloudFormation / S3 / CloudFront / OAC / Response Headers Policy / IAM・GitHub OIDC role）を準備できることを read-only で確認。**Infrastructure deployment role と Application deploy role は別 boundary を維持**。必要以上の permission 変更はしない。
- [ ] **PF6 — Hackathon Evidence readiness**: 後から証明できる Evidence を取得できる状態を確認し、preflight 時点ではまず「Kiro ↔ AWS connection / AWS context 取得」の Evidence を取得する。**Evidence に含めない**: access key / secret key / session token / credential / 不要な account ID / 不要な role ARN / その他 secret。

### preflight 結果の記録場所と status

preflight 実行後、結果を本節の checklist と、Kiro↔AWS connection Evidence（secret 非露出）として記録する。status 表記:

| 項目 | status |
|---|---|
| PF1 AWS MCP connection | PENDING（Approve 後に実行） |
| PF2 Agent Toolkit Skills availability | PENDING |
| PF3 identity / account / region | PENDING |
| PF4 AWS documentation / context access | PENDING |
| PF5 permission readiness | PENDING |
| PF6 Evidence readiness | PENDING |

### preflight で実施しないこと（Operation で実施）

CloudFormation stack 作成 / production S3 bucket 作成 / CloudFront distribution 作成 / OAC 作成 / application deployment / production IAM permission の不要な変更 は **preflight では行わない**。承認済み Infrastructure Design どおり Operation で実施する。

### コード生成時の AWS 開発方針（Step 4 以降）

Step 4 で AWS 関連コード（CloudFormation / IAM / S3 / CloudFront / GitHub OIDC 等）を実装する際は、モデル知識だけで生成せず、**Kiro 自身が Agent Toolkit for AWS / AWS MCP Server / AWS 公式情報を参照してから実装判断する**流れを基本とする。可能であればその「参照→判断→実装」の過程を Hackathon / GitHub / 記事で使える Evidence として残す（ただし Evidence 取得のためだけに不自然な操作を増やさない）。

## 4. Story-to-code traceability（plan step → 実装対象 → 主要 story/FR/BR）

| Plan Step | 実装対象 | 主要 story / FR / BR |
|---|---|---|
| Step 0（prerequisite） | AWS/Kiro READ-ONLY preflight PF1–PF6（§3、Approve 直後・コード生成前） | NFR6, NFR7, Infrastructure Design, project Forbidden(secret=0) |
| Step 1 | project skeleton・Vite・TS strict・ESLint/Prettier・layout | C1, NFR5, team Code Style |
| Step 2 | Vitest runner/config・unit-scoped command | team Testing Posture, NFR2 |
| Step 3-4 | authoring/runtime entity 型・schema(zod)・validation | FR3, FR12, BR1.x, C4/C5, entities.md |
| Step 5-6 | ScenarioLoader / ProgressStore（境界・破損/非互換） | FR11, FR12, BR1.x, BR6.x, ADR-003/008/011 |
| Step 7-8 | domain: progression / effect-rules / evaluator / approval / result / sheet / experience-policy | FR4, FR5, FR7, FR8, FR9, BR2.x/BR3.x/BR5.2/BR7.x |
| Step 9-10 | app orchestrator・i18n resolver（欠落検出） | FR2, FR10, BR5.x, ADR-006 |
| Step 11-12 | UI: Home/ModeSelect/Scenario/Result/Reflection/Adoption/Error・a11y・provenance 表示 | FR1, FR6, FR7, FR9, FR12, BR4.x, BR8.x, NFR4 |
| Step 13 | build config（Vite base 等）・hosting-neutral | NFR6, C1 |
| Step 14 | code-summary / traceability / docs | NFR3, Traceability!=Verification |

## 5. 実装ステップ（test-after baseline・core は test-first/concurrent）

各 step 完了時にチェックを付ける。step 順序は Testing Contract `plan_profile.steps` を baseline とし、layer 名を本 unit に合わせて具体化した。

- [x] **Step 0（prerequisite）— AWS/Kiro READ-ONLY preflight**（§3）
  - Approve Plan の**直後・かつ Step 1 以降のコード生成の前**に、AWS MCP Server + Agent Toolkit for AWS 経由で PF1–PF6 を実行する。
  - 各 PF の PASS/FAIL と Kiro↔AWS connection Evidence（secret 非露出）を §3 の status 表に記録する。
  - **全 PF が PASS するまで Step 1 に進まない**。FAIL 時は原因を surface し、Step 1 に着手しない。
- [x] **Step 1 — Project structure と production configuration skeleton**
  - Vite + React + TypeScript(strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 等) の初期化。
  - `/src/{domain,data,scenarios,i18n,app,ui}` ディレクトリと `index.html` / `main.tsx` / `App.tsx` の骨格。
  - ESLint（`@typescript-eslint`, `eslint-plugin-jsx-a11y`, `no-restricted-globals`/`no-restricted-properties` を domain/evaluation/semantic-ID scope に適用）+ Prettier。
  - `package.json` scripts（dev/build/preview/test/test:unit/lint/typecheck）。exact/pinned version で依存追加。
- [x] **Step 2 — Test runner bootstrap（最初の test-first cycle の前に runner を用意）**
  - `vitest.config.ts`（jsdom 環境、`@vitest/coverage-v8`、`passWithNoTests: false`）。
  - `@testing-library/react` + `@testing-library/user-event` + `jest-axe`(axe-core wrapper) の setup。
  - unit-scoped 実行コマンドを確定し `unit-test-instructions.md` に記録（bare `npm test` 不可）。
- [x] **Step 3 — Data model / entity 型（authoring + runtime/result）を実装**
  - `/src/domain/entities.ts` 等に entities.md の logical model を TS 型として定義（ScenarioSet/Scenario/Stage/DecisionPoint/DecisionOption/LearningPoint/ProvenanceEntry/EffectRule/Dimension、ScenarioSession/DecisionRecord/DimensionOutcome/LearningResult/AdoptionReviewMemo）。表示文言は locale key（`*Key`）参照、semantic data は言語非依存。
  - `/src/data/schema.ts` に zod schema（unknown reject / enum / cardinality / contribution 5 段階）。
- [x] **Step 4 — Data model のテスト（core は同時/先行）**
  - schema の妥当/不正入力テスト（unknown key reject・cardinality・contribution 範囲）。
- [x] **Step 5 — Repository / data access（ScenarioLoader / ProgressStore）を実装**
  - `/src/data/scenario-loader.ts`: 唯一の raw JSON validation boundary。schema / stable-ID uniqueness / dangling reference / provenance invariant / supported schemaVersion を検証（BR1.1-1.8）。一部 invalid は除外し明示、全 invalid は unavailable state。ScenarioValidationError（Loader 所有）。
  - `/src/data/progress-store.ts`: localStorage adapter。stable-ID ベース保存（表示文言非保存）、persistenceSchemaVersion 検証、破損→PersistenceError→safe reset（silent coercion 禁止、BR6.x）、user-triggered reset（NFR7.5a）。PersistenceError（ProgressStore 所有）。
- [x] **Step 6 — Loader / Store のテスト（core は同時/先行）**
  - Loader: 妥当通過 / 各 invalid 種別が可読エラーで reject / 部分 invalid の除外挙動。
  - Store: 保存復元 round-trip / 非互換 safe reset / 破損 safe reset / user reset。
- [x] **Step 7 — Business logic（domain）を実装**
  - `/src/domain/scenario-progression.ts`: ScenarioSession lifecycle（not-started→in-progress→completed / runtime invariant で errored）、DecisionRecord 記録（chosenDecisionOptionId・orderIndex・note）、DomainInvariantError（BR2.x）。runtime semantic ID は semantic key 由来で決定的導出（BR8.2）。
  - `/src/domain/decision-effect-rules.ts`: EffectRule 適用（condition 決定的評価、副作用なし）。
  - `/src/domain/dimension-evaluator.ts`: 固定 9 Dimension を決定的算出。入力は DecisionRecord 列 + immutable context + EffectRules + ApprovalSemantics のみ（note 除外）。非単調 Dimension（delegation-quality/approval-boundary/risk-handling）は過少/過剰双方を negative へ。DimensionOutcome に contributingDecisionRecordIds（説明可能性）。invariant 違反は DomainInvariantError（silent partial score なし）（BR3.x）。
  - `/src/domain/approval-semantics.ts`: Completion Approval != Release Approval の概念区別（BR7.3）。
  - `/src/domain/result-model.ts`: LearningResult 構築（9 DimensionOutcome・rework/remaining-risks）。
  - `/src/domain/adoption-sheet-composer.ts`: Markdown 決定的生成（FR8.2 見出し順固定、user note は untrusted 区別、system 生成と混同させない）（BR7.1）。
  - `/src/domain/experience-policy.ts`: 3 モード（Guided/Simulation/Adoption Review）の提示ポリシー。評価 engine/data は共有し評価不変（BR5.2）。
- [x] **Step 8 — domain のテスト（core：test-first/concurrent で最重視）**
  - evaluator: golden 期待値（代表 Scenario）・反復同一・順序不変・非単調 3 Dimension・9 Dimension 必ず出力・DomainInvariantError。
  - progression: lifecycle 遷移・invariant guard。
  - adoption-sheet: golden markdown・見出し順・note 混同防止。
  - approval-semantics / experience-policy: mode 不変性。
- [x] **Step 9 — App orchestration（結線層）を実装**
  - `/src/app/application-orchestrator.ts`: loader→ScenarioCatalog→progression→evaluator→result の結線。UI へ port を公開。
- [x] **Step 10 — i18n resolver を実装 + テスト**
  - `/src/i18n/`: ja/en resource、locale key resolver、翻訳欠落検出（blank/undefined を出さず dev/test で検出・production でも欠落明示、BR5.3）。既定言語はブラウザ言語追従（ja→日本語 / 他→English、常時切替）。locale 変更で semantic/evaluation/persisted progress 不変（BR5.1）。テスト: 欠落検出・不変性。
- [x] **Step 11 — Frontend（UI）を実装**
  - `/src/ui/`: Home / ModeSelect / ScenarioIntro / FocusLibrary / ScenarioView（decision/feedback ループ）/ ResultView / ReflectionView / AdoptionReviewView / ErrorView。view flow は presentation で domain state と分離（BR8.1）。
  - provenance 4 区分表示は label+icon+text（色のみ非依存、BR4.2）。Educational Simulation Value を実測値と誤認させない表示（FR6.1）。
  - a11y: keyboard 完走・focus 表示・semantic HTML・aria-live（NFR4）。interactive 要素に `data-testid`。
  - user note は React text node / `textarea` value（`dangerouslySetInnerHTML` 不使用、security-design 2）。
  - 不正 Scenario 時は無言停止せず ErrorView で「どれを読めなかったか」明示（FR12）。
- [x] **Step 12 — Frontend のテスト**
  - 主要 User Flow render + user-event（Tab/Enter/Space/focus）、axe critical/serious ゼロ、ErrorView 表示、provenance 表示、note 入力保持・言語切替で消えない。
- [x] **Step 13 — Environment / build configuration**
  - Vite production build（inline script 回避で CSP 厳格化しやすく）、`base` を deployment configuration として扱い AWS/Pages で別実装しない（NFR6）。build-time で Scenario/locale 同梱（runtime fetch なし）。
  - `/src/scenarios/*.json` に MVP 初期 Scenario（Core End-to-End 1 本 + Focus 数本）を data として用意。
- [x] **Step 14 — Documentation と traceability**
  - inline doc、`code-summary.md`、`traceability.json`（AC/NFR/BR → 実装/テストファイル）、`source-manifest.json`。

## Testing Contract

> §6。`aidlc engine testing-posture render` 出力を verbatim 転記。

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "純粋ロジックと UI は実装後にテストするが、deterministic core（scoring/evaluation・scenario transition・requirement coverage・approval boundary 判定・markdown 生成）はテストを実装と同時または先行して書く。",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 純粋ロジックと UI は実装後にテストするが、deterministic core（scoring/evaluation・scenario transition・requirement coverage・approval boundary 判定・markdown 生成）はテストを実装と同時または先行して書く。\n- **Test runner**: Vitest を使用します（Vite に対する慣用的なテストランナーで設定コストが最小）。カバレッジは `@vitest/coverage-v8` を用います。\n- **Coverage**: 一律の line-coverage floor は置きません。コアの deterministic ロジックは **branch coverage を高めに維持し、コアの未検証分岐を残さない**ことを優先します。UI は主要 User Flow を重視し、行カバレッジ達成だけを目的としたテスト追加はしません。\n- **決定性検証**: 「同一入力→同一スコア」に留めず、(a) 同一 Scenario 入力を反復実行しても同一スコアになること、(b) 入力配列の順序を入れ替えても結果が不変であること（順序不変性）、(c) scoring ロジック内の `Math.random` / `Date` / `performance.now` などランダム・時刻依存を ESLint（`no-restricted-globals` / `no-restricted-properties`）で静的排除すること、(d) 代表 Scenario ごとに意味のある golden 期待値を固定することを検証します（無検証の snapshot 更新はしない）。\n- **JSON fixture 健全性テスト**: 同梱する全 `/scenarios/*.json` を境界の schema で実際にロード・検証するパラメタライズドテストを 1 本置き、データ追加時の壊れを CI で捕捉します。妥当な Scenario が通ること、必須フィールド欠落・型不一致・スコア重み範囲外が可読なエラーで弾かれることを検証します。\n- **CI ゲート**: マージ前に CI で test / lint を実行し、失敗はマージをブロックします。Vitest は `--passWithNoTests=false` で運用し（テスト 0 件をグリーンにしない）、ログの目視ではなく `test` ステップの exit code をゲートにします。`.skip` / `.todo` 件数を可視化し恒常的な skip を放置しません。未実行テストを成功として報告しません。\n- **テスト量**: `Test Strategy=Standard` の範囲（component あたり 5〜8 本の Unit + Integration、合計 ~20〜50 本）に収め、MVP では e2e を持ちません（ice cream cone を避ける）。\n\n**Accessibility（working practice）**: WCAG 2.2 AA は「目標」として扱い、検証なしに準拠を主張しません。keyboard 操作・focus 表示・十分な contrast・色のみに依存しない表現・semantic HTML を基本方針とします。補助として主要画面のレンダリングテストに axe（axe-core ラッパー）を組み込み critical/serious 違反ゼロをアサートし、`@testing-library/user-event` で Tab 順・Enter/Space 起動・フォーカスを確認します。静的チェックとして `eslint-plugin-jsx-a11y` を併用します。ただし自動チェックは準拠の一部にすぎず、完全な準拠検証にはスクリーンリーダー等の手動確認が必要である旨を明記します。"
    },
    {
      "layer": "project",
      "text": "- 主要ロジックは test-after を基本とする（TDD/BDD を一律に義務づけない）。仕様先行を義務づける明示ルールが無く、決定的 scoring と主要ロジックの unit test を担保できれば org 既定に沿う。ただし決定的な core ロジックはテスト先行または同時に書く。 (learned 2026-09-24)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:ababbc7d66331400f227378291c050902c6d6f0407d7bf73a306f7118629690c",
  "contract_sha256": "sha256:2bdc792b1d6db34be9c61dd2f33c55876b158a8e151eed6d3978537b5aa72c69"
}
```

## Sources

- consumes: `../functional-design/functional-spec.md`, `../functional-design/entities.md`, `../functional-design/rules.md`, `../nfr-design/performance-design.md`, `../nfr-design/security-design.md`, `../infrastructure-design/infrastructure-specification.md`, `../../../inception/units-generation/unit-of-work.md`, `../../../inception/requirements-analysis/requirements.md`, `../../../inception/contract-design/contract-summary.md`。
- Testing Contract: `aidlc engine testing-posture render`（§6 verbatim）。
- API/endpoint layer は本 unit（backend なし static SPA）では該当なし → plan_profile の当該 step は app orchestration（結線層）へ読み替え、genuinely inapplicable な server API 層は省略（methodology 不変）。
