# Code Summary — U1: aidlc-learning-simulator-web

> 承認済み Code Generation plan（Option B / 案X）に基づく実装成果の要約。application code は workspace root（`/src` 等）に生成。Testing Contract（test-after・core は test-first/concurrent）に準拠。全 quality gate green。

## 実装概要

static React + TypeScript(strict) + Vite SPA。`/src` を hexagonal に層分離（ADR-009）:

- `/src/domain` — pure semantic logic（React/localStorage/raw JSON/locale text/Date/Math.random/performance.now 非依存）
- `/src/data` — 境界（ScenarioLoader = 唯一の raw JSON validation boundary・zod / ProgressStore = localStorage port-adapter）
- `/src/scenarios` — Scenario JSON（build-time asset・data only）+ locale bundle
- `/src/i18n` — LocaleResources（ja/en、翻訳欠落検出）
- `/src/app` — ApplicationOrchestrator（結線）+ presentation state controller
- `/src/ui` — React presentation（domain logic 非所有）

## Files created/modified

### 設定・ルート
- `package.json`（pinned 依存）, `tsconfig.json`（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes）, `vite.config.ts`（VITE_BASE で hosting-neutral・assetsInlineLimit 0）, `vitest.config.ts`（jsdom・coverage v8・passWithNoTests:false）, `.eslintrc.cjs`（jsx-a11y + domain への no-restricted-globals/properties）, `.prettierrc.json`, `index.html`（best-effort meta CSP）, `src/main.tsx`, `src/test-setup.ts`, `src/vitest-axe.d.ts`

### domain（pure・決定的）
- `src/domain/entities.ts` — 全 entity 型、DIMENSION_IDS（固定 9 軸順）、NON_MONOTONIC_DIMENSIONS、EffectCondition discriminated union
- `src/domain/errors.ts` — ScenarioValidationError / DomainInvariantError / PersistenceError（境界別・ADR-011）
- `src/domain/semantic-id.ts` — runtime semantic ID の決定的導出（time/random 非依存・BR8.2）
- `src/domain/decision-effect-rules.ts` — condition 決定的評価・EffectRule 適用（BR3.1）
- `src/domain/dimension-evaluator.ts` — 9 Dimension 決定的算出、非単調 3 軸の不均衡→negative、順序不変（BR3.x）
- `src/domain/result-model.ts` — LearningResult 構築（9 Dimension 必須・BR3.5）
- `src/domain/approval-semantics.ts` — Completion Approval ≠ Release Approval（C6/BR7.3）
- `src/domain/scenario-progression.ts` — lifecycle（not-started/in-progress/completed/errored）・DomainInvariantError（BR2.x）
- `src/domain/experience-policy.ts` — 3 モードの提示ポリシー（評価不変・BR5.2）
- `src/domain/adoption-sheet-composer.ts` — 決定的 Markdown 生成（FR8.2 見出し順・user note untrusted・BR7.1）
- `src/domain/test-fixtures.ts` — テスト共通 fixture

### data（境界）
- `src/data/schema.ts` — zod strict schema（unknown reject / enum / cardinality / contribution 5 段階・SUPPORTED_SCHEMA_VERSIONS=[1]）
- `src/data/scenario-loader.ts` — validateScenarioSet + buildScenarioCatalog（BR1.1-1.8・部分 invalid 退避・FR12）
- `src/data/progress-store.ts` — StoragePort port-adapter（save/load/userReset・破損/非互換→safe reset・BR6.x/NFR7.5a）

### i18n
- `src/i18n/locale-resources.ts` — resolver（欠落 key 可視化・BR5.3）・defaultLocaleFrom（FR10.2）・diffBundleKeys
- `src/i18n/messages.ts` — ja/en chrome bundle（同一 key 集合・dimension label 含む）

### app / ui
- `src/app/application-orchestrator.ts` — createApplication（loader→catalog→port 公開・bundle マージ）
- `src/app/use-app-state.ts` — presentation state controller（view routing・domain 呼び出しのみ・BR8.1）
- `src/app/app.tsx` — App root（Application 注入可）
- `src/ui/styles.css`, `src/ui/provenance-badge.tsx`（label+icon+text・色非依存・BR4.2）, `src/ui/app-views.tsx`（9 views）

### scenarios（MVP 初期セット・data only）
- `src/scenarios/core-e2e.json`（Core End-to-End・4 Stage：要件→計画→実装→リリース）+ `core-e2e.locale.ts`
- `src/scenarios/focus-evidence.json`（Focus・テスト失敗と Evidence）+ `focus-evidence.locale.ts`
- `src/scenarios/index.ts`（registry・build-time 同梱）

### tests
- `src/data/schema.test.ts`（7）, `src/data/scenario-loader.test.ts`（9）, `src/data/progress-store.test.ts`（6）
- `src/domain/dimension-evaluator.test.ts`（8）, `src/domain/scenario-progression.test.ts`（8）, `src/domain/adoption-sheet-composer.test.ts`（4）, `src/domain/experience-policy.test.ts`（3）
- `src/i18n/locale-resources.test.ts`（6）, `src/scenarios/scenarios.test.ts`（8）, `src/ui/app-views.test.tsx`（7）

## Key implementation decisions

- **決定的評価の内部表現**: contribution 5 段階を内部で数値 [-2,2] に map（BR3.3）。非単調 Dimension（delegation-quality/approval-boundary/risk-handling）は「正負が両立するとき打ち消さず不均衡として negative へ寄せる」ロジックで過少/過剰双方を negative 化（BR3.4）。順序不変性は寄与 DecisionRecord を orderIndex 昇順に正規化して担保（BR3.2）。
- **境界の error 分離（ADR-011）**: Loader=ScenarioValidationError、runtime=DomainInvariantError、ProgressStore=PersistenceError。load 境界と runtime lifecycle を混在させない。
- **ProgressStore を port/adapter 化**（ADR-008）: StoragePort インターフェースで localStorage を抽象化し、テストで in-memory fake を注入。破損 JSON / 型不一致 / 非互換 version はいずれも silent coercion せず safe reset + recovered 通知。
- **i18n semantic/presentation 分離**（ADR-006）: 評価・進行・永続は locale 非依存。欠落 key は `⟦missing:key⟧` マーカーで可視化（blank/undefined を出さない）。ja/en bundle の key 対称性をテストで担保。
- **UI 責務境界**（BR8.1）: domain logic を UI に置かず、app 層の controller が domain 関数を呼ぶ。view flow は presentation。
- **provenance 表示**（BR4.2）: 4 区分を記号アイコン（◆▲●◇）+ label + text で表現し、色のみに依存しない。
- **user note untrusted**（security-design §2）: React text node / textarea のみ。`dangerouslySetInnerHTML` 不使用。Adoption Sheet では引用ブロック + 明示ラベルで system 生成と構造分離。

## Test coverage summary

- **合計 66 tests / 10 files、全 pass**（`npx vitest run src/`）。
- core deterministic ロジック（evaluator/progression/loader/store/adoption-sheet）に golden・反復同一・順序不変・非単調・9 Dimension 必須・DomainInvariantError・safe reset を検証。
- JSON fixture 健全性テスト（全 scenarios を境界 schema で実ロード）と ja/en locale 対称性テストを配置。
- UI は主要 User Flow（Home→mode→intro→scenario→result）、keyboard 操作（Tab/Enter/focus）、axe（critical/serious ゼロ）、note 保持 + 言語切替、ErrorView を検証。

## Quality gate 結果

- **lint**: `npx eslint src/` OK（0 error）
- **typecheck**: `npx tsc --noEmit` OK（strict / exactOptionalPropertyTypes）
- **test**: 66 passed / 10 files（`--passWithNoTests=false`）
- **build**: `npx vite build` OK、初期 JS bundle gzip **72.65 KB**（NFR9.4 の ≤300KB budget 内）

## Deviations / surfaced gaps（papering over せず明示）

1. **dispatch 手段の逸脱（harness 制約）**: stage 定義は mode=subagent（aidlc-developer-agent へ Task dispatch）だが、Kiro IDE の plan-approval guard が `invoke_sub_agent` を「target 不明の mutation-capable」として block したため、承認済み plan を入力に **conductor が直接生成**した。承認済み plan・Testing Contract を唯一の入力とし、生成内容は plan に忠実。
2. **axe の color-contrast は jsdom 環境で完全評価不可**: jsdom が `HTMLCanvasElement.getContext` 未実装のため axe の color-contrast ルールが canvas を使えず警告を出す（テストは pass）。これは既知の制約で、team Testing Posture の「自動チェックは準拠の一部にすぎず、完全な準拠検証にはスクリーンリーダー等の手動確認が必要」という明記と整合。WCAG 2.2 AA は「目標」であり検証なしに準拠を主張しない。
3. **dependency 監査（dev-only）**: `npm audit` が esbuild / vite / vitest に 4 件（moderate〜critical）を報告。いずれも **dev-server / test-runner の advisory であり production bundle には含まれない**（静的 SPA の runtime に影響しない）。security-design §6 の方針（dev dependency を機械的に全件 blocking しない・例外は記録）に従い、pinned version を壊す `audit fix --force` は実施せず記録に留める。CI で npm audit / Dependabot を敷く方針は infrastructure-specification どおり。
4. **AWS 関連コードは本 unit で生成せず**: backend なし client-only static SPA のため、CloudFormation/IAM/OIDC 等は本 unit のコードに含めない（Operation で実施・plan §3 / unit-of-work）。

## Advisory review（iteration 1）で fold した所見

助言レビュー（`.aidlc-engine/reviews/code-generation/.../1.review.md`）で以下を検出し、承認前に反映した:

- **R-01（Major）React ErrorBoundary の欠落**: nfr-design の error handling 2-way split（予期しない render エラー→ErrorBoundary）が未実装だった。`src/ui/error-boundary.tsx` を追加し App root で包んだ。fallback を表示しつつエラーメッセージを握り潰さない（DomainInvariantError never swallowed）。
- **R-02（Major）runtime domain 呼び出しの未ハンドリング**: `use-app-state.ts` の recordDecision/advanceStage/buildLearningResult が throw する DomainInvariantError を捕捉していなかった。`toErrored` で制御された error view へ遷移させ、ErrorView に runtime メッセージを表示するようにした（握り潰さない）。
- **R-03（Minor）非単調 Dimension の authoring 契約**: 非単調 Dimension の「過剰介入」ペナルティは、authoring 側が negative の EffectRule を意図的に付与することで表現する（コード側は正負両立時に不均衡→negative へ寄せる）。この authoring 契約を明記した。

R-04（Adoption Sheet の download UI 未接続）と R-05（jsdom の color-contrast 未評価）は Minor として Build and Test / 手動確認へ明示的に送った（理由付き）。

## 追加ファイル（fold 分）
- `src/ui/error-boundary.tsx`（R-01）。`src/app/app.tsx`・`src/app/use-app-state.ts`・`src/ui/app-views.tsx`・`src/i18n/messages.ts` を R-01/R-02 反映で更新。

## Build and Test 段階の追加実装（AC 1:1 traceability 対応・案C）

Build and Test の cross-unit coverage gate で AC を traceability.json に 1:1 明示追記した際、v2.10.0 必須 Topic の 2 AC 群が MISSING と判明したため、human 判断（案C）で以下を追加:
- `src/scenarios/focus-checkpoint-review.json` + `.locale.ts`（AC5.2.1/AC5.2.2: verified Unit / batch checkpoint review。ai-dlc-spec provenance）
- `src/scenarios/focus-refusal-recovery.json` + `.locale.ts`（AC5.3.1/AC5.3.2: refusal/recovery が実行可能な next step を示す。ai-dlc-spec provenance）
- `src/scenarios/index.ts` に 2 本を登録、`src/scenarios/scenarios.test.ts` に AC5.2/AC5.3 の provenance 検証を追加。deterministic evaluation / 9 Dimension / i18n / provenance / testing contract は不変。76 tests green。
- traceability: AC5.2.1/5.2.2/5.3.1/5.3.2 を MISSING → **OK** に更新。

## MVP Known Gaps（PARTIAL・削除/隠蔽せず明示・human 承認済み方針）

以下 10 AC は機構は存在するが AC 細部が未充足の **MVP Known Gap**。学習価値優先・過剰演出回避（product.md）のため今回は実装せず、traceability.json で `PARTIAL` として明示追跡し、Operation handoff / 後続改善候補とする:
- AC1.2.4（first-run オンボーディング文言の充実）
- AC1.2.5（モード間遷移 UX / Learn→Practice→Apply 導線）
- AC2.1.4（P2 導入評価者視点の具体性）
- AC2.3.1（Return to Previous Stage の実 UI 手戻り）
- AC2.6.4（Reflection 画面の内省支援の充実）
- AC3.1.1（Result 画面の全項目網羅：Decision Timeline / Better Alternative / 次の Focus 提示等）
- AC3.1.4（Result empty-state：未完走時の可読案内）
- AC5.1.3（Focus Library empty-state）
- AC6.1.1（Adoption Review モードの内省的問いの充実）
- AC8.2.3（mid-scenario 実行時不整合の可読検出）

これらは NFR9.1-9.3（runtime latency）/ NFR4 手動 a11y の Unverified と同様、緩めず承認 gate・Build and Test summary・Operation handoff で surface する。

## Sources
- approved: `code-generation-plan.md`（fingerprint sha256:v3:37a2b2c5…）, `unit-test-instructions.md`
- preflight: `preflight-evidence.md`（READY）
- consumes: functional-spec / entities / rules / performance-design / security-design / requirements / unit-of-work（§ plan Sources）
