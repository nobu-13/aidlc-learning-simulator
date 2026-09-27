# Integration Test Instructions — aidlc-learning-simulator

> Standard strategy の主要境界テスト。単一 deployable unit のため「cross-unit」は存在せず、**アプリ内の層境界を跨ぐ結線**（ApplicationOrchestrator: loader → catalog → progression → evaluator → result → UI）を統合的に検証する。

## テストフレームワーク

- Vitest（jsdom）+ `@testing-library/react` + `@testing-library/user-event` + `vitest-axe`。unit テストと同一 runner。追加セットアップ不要。

## 実行方法

- 統合テストは UI 経由の主要 User Flow テスト（`src/ui/app-views.test.tsx`）が担う。実オブジェクトの Application を注入し、domain / data / i18n を over-mock せずに結線を通す:
  ```bash
  npx vitest run src/ui/
  ```
- 全体（unit + integration）:
  ```bash
  npx vitest run src/
  ```

## 主要境界と検証観点

1. **Loader → Catalog → UI（起動経路）**: 実 Scenario JSON を `createApplication` で読み込み、Home が描画されること。全 invalid 時は ErrorView に「読めなかった Scenario」を列挙（FR12 / BR1.8）。
2. **UI → Progression → Evaluator → Result（完走経路）**: Home → mode → intro → 各 DecisionPoint 選択 → 完走で ResultView に 9 Dimension が出ること。DomainInvariantError は制御された error view へ（握り潰さない）。
3. **i18n 境界**: 言語切替で UI 文言のみ変わり、進捗・note・評価結果が不変（FR10.3 / BR5.1）。
4. **Adoption Sheet 経路**: 完走後に Adoption Review で `composeAdoptionSheet` を UI から呼び、FR8.2 見出し順の Markdown を preview / download できる（FR8.1）。user note は untrusted として引用構造で分離。
5. **ErrorBoundary**: 予期しない render エラーで fallback を表示し、メッセージを握り潰さない。

## カバレッジ目標（Standard）

- 主要 User Flow（起動・完走・言語切替・Adoption Sheet・エラー表示）を網羅。行カバレッジ達成のみを目的にしたテストは追加しない（team 方針）。
- domain / data の deterministic core は unit テスト側で branch coverage を高く維持。

## テストデータ管理

- 統合テストは同梱 Scenario（`src/scenarios/`）と in-memory localStorage fake（`StoragePort`）を使用。外部依存・ネットワークなし。

## Sources
- consumes: `../aidlc-learning-simulator-web/code-generation/unit-test-instructions.md`, `../aidlc-learning-simulator-web/functional-design/functional-spec.md`（UC1-UC5）。
- team Testing Posture（Standard / e2e なし / axe / user-event）。
