# Tech Stack Decisions — U1: aidlc-learning-simulator-web

> 技術選定と根拠。steering（tech-stack/quality/product）と practices（team.md）で既定のものを明文化し、本ステージで確定。上流 NFR5（maintainability/data-driven）/ NFR6（portability）に対応。

## 選定（NFRx.y）

| ID | 分類 | 選定 | 根拠 | source |
|---|---|---|---|---|
| NFR5.1 | 言語/型 | TypeScript（strict mode） | 型安全・保守性。strict で type error 0 を品質ゲート化 | tech-stack, quality, NFR5 |
| NFR5.2 | UI framework | React | 静的 SPA の標準的選択・component 分離 | tech-stack |
| NFR5.3 | build/bundler | Vite | 静的 SPA の慣用。`base` 等で hosting portability | tech-stack, NFR6 |
| NFR5.4 | test runner | Vitest + @vitest/coverage-v8 | Vite 慣用・設定コスト最小。branch coverage をコアで高める | team:Testing Posture |
| NFR5.5 | UI/a11y test | @testing-library/user-event + axe（axe-core ラッパー） | keyboard/flow テスト・critical/serious a11y 検出 | team:Accessibility, NFR4 |
| NFR5.6 | static a11y lint | eslint-plugin-jsx-a11y | 静的 a11y チェック | team:Accessibility, NFR4 |
| NFR5.7 | schema validation | zod | ScenarioLoader の runtime 検証境界（schema/型/cross-ref） | functional-design ADR-003 |
| NFR5.8 | i18n | 独自軽量 locale resolver（stable key→string） | 外部 i18n ライブラリを必須にしない軽量方針。**ja/en key completeness 検証・missing key test 必須・production で blank/undefined を silent 表示しない・locale 変更で semantic data 不変** | NFR5, FR10, ADR-006 |
| NFR5.9 | lint/format | ESLint + Prettier | コード品質・整形。error 0 を品質ゲート化 | org:Code Style |
| NFR5.10 | determinism guard | ESLint（no-restricted-properties / no-restricted-syntax / directory-specific override） | **domain / evaluation / semantic-ID generation でのみ** Date/Math.random/performance.now を静的排除。UI/perf 測定/test utility は対象外 | NFR2, team:Testing Posture |
| NFR6.1 | hosting portability | 同一 source を AWS(CloudFront+S3) と GitHub Pages へ配信、差異は build/deploy config（Vite `base` 等）に隔離 | NFR6, team:Deployment |

## Portability contract（NFR6）

**"same application source + hosting-specific configuration"** を portability contract とする（byte-identical な同一 bundle は必須要件にしない）:
- same application source / same application behavior。
- runtime の AWS 固有依存なし（NFR6.2: AWS hosting 固有 runtime dependency = 0）。
- hosting 固有差は build/deploy configuration に限定（Vite `base`、リダイレクト/404 fallback 等）。
- Scenario/locale は build-time 同梱で runtime remote dependency なし。

## Determinism scope（NFR5.10 補足）

- time/random 排除は **domain / evaluation / semantic-ID generation** の境界に適用（directory-specific ESLint override）。
- UI レンダリング、performance 測定、test utility では Date 等の使用を妨げない（過剰制約を避ける）。

## Rationale 概要

MVP・単一 unit・static SPA・教育用途に対し、Vite ecosystem の慣用スタックで設定コストを最小化しつつ、strict TS・決定性 ESLint・a11y lint/test・zod 検証境界で品質と決定性・アクセシビリティを担保する。i18n は軽量自作で依存を増やさず、completeness を test で保証する。hosting は config 隔離で AWS/Pages 両対応。

## Sources
- consumes: `../functional-design/functional-spec.md`, `../functional-design/rules.md`, `../../../inception/requirements-analysis/requirements.md`（NFR5, NFR6, C1, C4）, team.md（Testing Posture/Accessibility/Deployment/Code Style）, project.md。
