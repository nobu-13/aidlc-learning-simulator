# Build and Test Summary — aidlc-learning-simulator

> 単一 deployable unit（U1 = aidlc-learning-simulator-web）の static SPA。Standard strategy。build + unit/integration テストをローカル実行し、測定可能な quality target を検証する。runtime latency 系（Lighthouse / interaction）は production-like 環境が必要なため performance-validation（Operation）へ deferred。

## 1. 全体ビルド状況・前提

- 前提: Node 20+、`npm ci`、backend/外部サービス不要。
- ビルド: `npm run build`（`tsc --noEmit && vite build`）**success**。`dist/` に index.html + assets 生成。
- 初期 JS bundle: **gzip 74.05KB**（NFR9.4 budget ≤300KB 内）。

## 2. テスト種別インベントリ

| 種別 | 生成/所在 | 状態 |
|---|---|---|
| Unit（domain/data/i18n/scenarios） | `src/**/*.test.ts` | 実行済み・pass |
| Integration（UI 経由の層結線・User Flow） | `src/ui/app-views.test.tsx` | 実行済み・pass |
| Accessibility（axe + user-event） | `src/ui/app-views.test.tsx` | 実行済み・pass（jsdom で color-contrast は評価不可・手動確認へ） |
| JSON fixture 健全性 | `src/scenarios/scenarios.test.ts` | 実行済み・pass |
| Performance（Lighthouse / interaction latency） | performance-validation（Operation）で実測 | deferred |
| e2e | MVP では持たない（team 方針） | N/A |

## 3. カバレッジ期待（unit）

- 全体: 90.68% stmts / 77.08% branch。
- core deterministic（domain 92.74%/82.79%、data 89.61%/77.06%、scenarios 100%）は branch coverage を高く維持（team 方針）。UI は主要 User Flow 重視（85.2%/64%）。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| BUILD | build-instructions.md | build success（exit 0・dist 生成） | success | `npm run build` exit 0、dist/index.html+assets | build-and-test | Met |
| TYPECHECK | tsconfig strict | tsc --noEmit exit 0 | pass | `npm run typecheck` exit 0 | build-and-test | Met |
| LINT | .eslintrc.cjs | eslint exit 0（0 error） | pass | `npm run lint` exit 0 | build-and-test | Met |
| TESTS | Testing Contract / unit-test-instructions | 全 test pass・未実行を成功扱いしない | 76 passed / 10 files | `npx vitest run src/` | build-and-test | Met |
| AC-TRACE | cross-unit-traceability（案C） | 全 AC を 1:1 明示・MISSING 0 | OK 100 / PARTIAL 10 / MISSING 0 | traceability.json / cross-unit-traceability.md | build-and-test | Met（PARTIAL は MVP Known Gap として明示） |
| COV-CORE-BRANCH | team Testing Posture（core branch coverage 高維持） | core の未検証分岐を残さない（高 branch） | domain 82.79% / data 77.06% branch | `vitest run --coverage` | build-and-test | Met |
| NFR2-DETERMINISM | nfr-requirements NFR2 | 反復同一・順序不変・time/random 排除 | 決定性テスト pass・ESLint 排除 | dimension-evaluator.test.ts / i18n invariance test / ESLint no-restricted-globals | build-and-test | Met |
| NFR9.4-BUNDLE | performance-requirements NFR9.4 | 初期 JS gzip ≤ 300KB（budget） | 74.05KB gzip | `vite build` 出力 | build-and-test | Met |
| NFR4-A11Y-AUTO | nfr-requirements NFR4 | 主要画面 axe critical/serious ゼロ・keyboard 完走 | axe pass・user-event Tab/Enter/focus pass | app-views.test.tsx | build-and-test | Met |
| NFR4-A11Y-CONTRAST | nfr-requirements NFR4 | color-contrast（WCAG 2.2 AA 目標） | 自動評価不可（jsdom に canvas なし） | code-summary 開示・team 方針 | performance-validation / 手動確認 | Unverified |
| NFR9.1-COLDLOAD | performance-requirements NFR9.1 | 初回 cold load → Home ≤ 3s | 未実測（production-like 環境要） | Lighthouse（Operation） | performance-validation | Unverified |
| NFR9.2-SCENARIO-START | performance-requirements NFR9.2 | Scenario 開始 → 最初の DecisionPoint ≤ 1s | 未実測 | 固定環境測定（Operation） | performance-validation | Unverified |
| NFR9.3-DECISION-FEEDBACK | performance-requirements NFR9.3 | Decision → Feedback ≤ 200ms | 未実測（設計上は同期純関数で軽量） | interaction latency 測定（Operation） | performance-validation | Unverified |

> 注: NFR9.1/9.2/9.3 と NFR4-A11Y-CONTRAST は Build and Test でローカル実測できない（production-like 環境 / スクリーンリーダー等の手動確認が必要）targets。performance-validation（Operation）が owning stage。設計・自動チェックの範囲では良好だが、**Unverified** として承認 gate で明示する（緩めない）。

## 4. Readiness assessment

- **build-ready**: Yes（build success・bundle budget 内）。
- **test-ready**: Yes（68 tests pass・core branch coverage 良好・未実行テストを成功扱いしない）。
- **deployment-ready**: 部分的。CI/インフラは Operation（Environment Provisioning / Deployment Execution）で実施。runtime performance（NFR9.1-9.3）と手動 a11y は performance-validation / Operation で確定。AWS live は Hackathon Release blocker、AI-DLC 完了承認 ≠ Release Approval。

## 5. Known limitations / outstanding items

- NFR9.1/9.2/9.3（runtime latency）は本ステージで実測不可 → performance-validation へ。
- WCAG 2.2 AA の color-contrast と手動 a11y（スクリーンリーダー）は自動チェック範囲外 → 手動確認。検証なしに準拠を主張しない。
- Adoption Sheet の download UI（R-04）は本ステージで実装・テスト済み。
- **AC 1:1 traceability（案C）**: 全 AC を明示追記。AC5.2/5.3（checkpoint review / refusal-recovery）は Focus Scenario 2 本を追加して OK 化（76 tests）。

## 6. MVP Known Gaps（PARTIAL・明示・実装しない方針・human 承認済み）

削除・隠蔽せず明示追跡する。学習価値優先・過剰演出回避（product.md）のため今回は実装しない。Operation handoff / 後続改善候補:

| AC | 内容 | 現状 |
|---|---|---|
| AC1.2.4 | first-run オンボーディング文言 | 機構あり・文言簡易 |
| AC1.2.5 | モード間遷移 UX（Learn→Practice→Apply 導線） | 遷移可・導線簡易 |
| AC2.1.4 | P2 導入評価者視点の具体性 | Scenario 文言で部分的 |
| AC2.3.1 | Return to Previous Stage の実 UI 手戻り | progression に機構・UI 未提供 |
| AC2.6.4 | Reflection 画面の内省支援 | 画面あり・内容簡易 |
| AC3.1.1 | Result 全項目（Timeline/Better Alternative/次の Focus 等） | 9 Dimension 中心・一部項目簡易 |
| AC3.1.4 | Result empty-state（未完走時案内） | 直接遷移時は error view 経由 |
| AC5.1.3 | Focus Library empty-state | 現状 Focus 3 本あり空にならない |
| AC6.1.1 | Adoption Review の内省的問い | 導線あり・問い簡易 |
| AC8.2.3 | mid-scenario 実行時不整合の可読検出 | DomainInvariantError で errored・専用 UX 簡易 |

## Sources
- consumes: `../aidlc-learning-simulator-web/code-generation/{code-summary.md, code-generation-plan.md, unit-test-instructions.md}`, `../aidlc-learning-simulator-web/nfr-requirements/performance-requirements.md`, `../aidlc-learning-simulator-web/nfr-design/*`。
- 実行証跡: `test-results.md`（同ディレクトリ）。
