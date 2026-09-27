# Unit Test Instructions — U1: aidlc-learning-simulator-web

> Testing Contract に準拠: methodology=test-after（deterministic core は test-first/concurrent）、strategy=standard（component あたり 5〜8 本、合計 ~20〜50 本、e2e 無し）。runner=Vitest + `@vitest/coverage-v8`。未実行テストを成功と報告しない。

## Test framework setup と configuration

- **runner**: Vitest（Vite ネイティブ、設定コスト最小）。
- **environment**: `jsdom`（UI テスト用）。domain/data の pure テストは環境非依存。
- **libraries**: `@testing-library/react`, `@testing-library/user-event`, `jest-axe`（axe-core wrapper）, `zod`（境界 schema）。
- **config**: `vitest.config.ts` に `environment: 'jsdom'`、`coverage.provider: 'v8'`、`passWithNoTests: false`（テスト 0 件を green にしない）、setup で `@testing-library/jest-dom` と axe matcher を登録。
- **静的チェック（テストと併走）**: ESLint（`@typescript-eslint`, `eslint-plugin-jsx-a11y`, および `/src/domain`・evaluation・semantic-ID scope への `no-restricted-globals`/`no-restricted-properties` による `Date`/`Math.random`/`performance.now` 排除）。

## この UNIT のテスト実行コマンド（unit-scoped・最初の test-first cycle 前に runnable）

本 unit は単一 deployable unit のため、`/src` 配下がこの unit のスコープ全体である。bare `npm test` は Build and Test が unit 単位で再実行する際に全 suite を重複実行するため不可。以下の**明示スコープ**コマンドを使う。

- 全ユニットテスト（この unit のスコープ、1 回実行・watch しない）:
  ```bash
  npx vitest run src/
  ```
- カバレッジ付き（core の branch coverage 確認）:
  ```bash
  npx vitest run src/ --coverage
  ```
- 層を絞る例（core deterministic ロジックのみ先行実行）:
  ```bash
  npx vitest run src/domain/
  ```
- lint / typecheck（CI ゲートと同一）:
  ```bash
  npx eslint src/ && npx tsc --noEmit
  ```

> `package.json` の `test:unit` script は `vitest run src/` にバインドし、CI は exit code をゲートにする（ログ目視で成功判定しない）。

## Expected coverage targets

- **一律 line-coverage floor は置かない**（team 方針）。
- **core deterministic ロジック（`/src/domain` の evaluator/progression/effect-rules/approval/result/adoption-sheet、`/src/data` の loader/store）は branch coverage を高く維持**し、未検証分岐を残さない。
- **UI（`/src/ui`）は主要 User Flow を重視**。行カバレッジ達成だけを目的にテストを増やさない。
- `.skip` / `.todo` は件数を可視化し恒常化させない。

## Mocking / stubbing guidance

- **domain は pure**（依存注入で純関数化）。mock は原則不要。time/random/locale/mode を入力にしないため、時刻・乱数の mock は不要（そもそも参照禁止）。
- **ProgressStore**: `localStorage` は jsdom の実装、または in-memory fake を注入して round-trip / 破損 / 非互換をテスト。破損データは不正 JSON 文字列を注入して PersistenceError→safe reset を検証。
- **ScenarioLoader**: raw JSON オブジェクトを直接渡し、境界 validation の妥当/不正を検証（ファイル I/O を mock しない。build-time import した JSON か inline fixture を使う）。
- **UI**: `@testing-library` で実 render。domain は実オブジェクトを使い over-mock しない（結線の回帰を拾う）。axe は実 DOM に対して実行。

## Test data management

- **golden 期待値**: 代表 Scenario ごとに DimensionOutcome / Adoption Sheet Markdown の期待値をコード内 fixture として固定。無検証の snapshot 自動更新はしない（意味のある期待値のみ）。
- **JSON fixture 健全性テスト（必須 1 本・パラメタライズド）**: 同梱する全 `src/scenarios/*.json` を境界 schema で実ロード・検証。妥当 Scenario 通過、必須欠落・型不一致・contribution 範囲外・dangling reference・provenance invariant を可読エラーで reject することを確認。データ追加時の壊れを CI で捕捉。
- **決定性テスト**: (a) 同一入力の反復実行で同一スコア、(b) DecisionRecord 配列の順序入替で結果不変（順序不変性）、(c) i18n locale 切替で semantic/evaluation/persisted progress 不変、(d) mode 切替で評価不変。

## Accessibility テスト

- 主要画面（Home/ModeSelect/ScenarioView/ResultView/AdoptionReviewView/ErrorView）の render テストに `jest-axe` を組み込み **critical/serious 違反ゼロ**をアサート。
- `@testing-library/user-event` で Tab 順・Enter/Space 起動・focus 遷移を確認（keyboard のみで主要 Flow 完走可能）。
- 静的に `eslint-plugin-jsx-a11y`。
- **注記**: これら自動チェックは WCAG 2.2 AA 準拠の一部にすぎず、完全な準拠検証にはスクリーンリーダー等の手動確認が別途必要（検証なしに準拠を主張しない）。

## Sources

- Testing Contract: `aidlc engine testing-posture render`（team.md Testing Posture / Accessibility 由来）。
- consumes: `../functional-design/rules.md`（BR2.x/BR3.x/BR5.x/BR6.x/BR7.1 の決定性・不変性）, `../nfr-design/performance-design.md`（NFR9 budget）, `../nfr-design/security-design.md`（note untrusted）, `../../../inception/requirements-analysis/requirements.md`（NFR2/NFR4/quality rules）。
