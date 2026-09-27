# Test Results — aidlc-learning-simulator

> Build and Test の実行証跡（2026-09-26）。単一 unit・Standard strategy。全コマンドをローカル実行。

## Build status

- `npm run build`（`tsc --noEmit && vite build`）: **success**（exit 0）。
- 出力: `dist/index.html`（gzip 0.63KB）/ `dist/assets/index-*.css`（gzip 0.63KB）/ `dist/assets/index-*.js`（**gzip 74.05KB**）。
- 55 modules transformed。inline script なし（`assetsInlineLimit: 0`）。

## Test results

- コマンド: `npx vitest run src/`（unit + integration、unit-scoped）。stage-level と per-unit の run コマンドは同一（`vitest run src/`）のため 1 回だけ実行（重複カウントなし）。
- **Total 76 / Passed 76 / Failed 0 / Skipped 0**（10 test files）。`--passWithNoTests=false`。（案C で Focus Scenario 2 本 + AC5.2/5.3 検証を追加）
- 内訳:
  - data: schema(7) + scenario-loader(9) + progress-store(6) = 22
  - domain: dimension-evaluator(8) + scenario-progression(8) + adoption-sheet-composer(4) + experience-policy(3) = 23
  - i18n: locale-resources(6)
  - scenarios: scenarios(16)（JSON fixture 健全性 + core/focus 4 本 + AC5.2/AC5.3 provenance 検証）
  - ui: app-views(9)（User Flow + axe + keyboard + Adoption Sheet download + ErrorBoundary）

## Failure details

- なし（全 pass）。

## Coverage report

- 全体: 90.68% stmts / 77.08% branch / 89.28% funcs / 90.68% lines。
- per-dir: domain 92.74%/82.79%、data 89.61%/77.06%、i18n 98.88%/100%、scenarios 100%/100%、app 84.36%/73.21%、ui 85.2%/64%。
- core deterministic ロジックの branch coverage を高く維持（team 方針）。UI は主要 User Flow 重視。

## Lint / Typecheck

- `npm run lint`: exit 0（0 error）。
- `npm run typecheck`（`tsc --noEmit`）: exit 0（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes）。

## Finalized Target Verification Matrix

`build-and-test-summary.md` の Target Verification Matrix を正とする。要約:
- **Met**: BUILD / TYPECHECK / LINT / TESTS / COV-CORE-BRANCH / NFR2-DETERMINISM / NFR9.4-BUNDLE / NFR4-A11Y-AUTO。
- **Unverified（later owning stage あり）**: NFR9.1-COLDLOAD / NFR9.2-SCENARIO-START / NFR9.3-DECISION-FEEDBACK / NFR4-A11Y-CONTRAST → performance-validation（Operation）/ 手動確認が owning stage。production-like 環境 / 手動検証が必要なため本ステージでは実測不可。緩めない。

## 本ステージで実施した追加実装

- **R-04（advisory review で Build and Test へ deferred）**: Adoption Discussion Sheet の生成・preview・download UI を `AdoptionReviewView` に実装（`composeAdoptionSheet` を locale bundle 経由で呼ぶ・no-network の Blob download）。テスト 1 本追加。
- **案C（AC 1:1 traceability 対応）**: v2.10.0 必須 Topic の Focus Scenario 2 本を追加 — `focus-checkpoint-review`（AC5.2）/ `focus-refusal-recovery`（AC5.3）。ai-dlc-spec provenance・deterministic evaluation 維持。scenarios.test.ts に AC5.2/5.3 検証を追加（合計 76 tests）。traceability の AC5.2/5.3 を MISSING → OK に更新。
- MVP Known Gaps（PARTIAL 10 件）は削除せず明示（build-and-test-summary §6 / cross-unit-traceability）。

## Sources
- 実行コマンド: `npm run build` / `npx vitest run src/ [--coverage]` / `npm run lint` / `npm run typecheck`（すべてローカル、2026-09-26）。
