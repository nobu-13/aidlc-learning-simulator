# Logical Components — U1: aidlc-learning-simulator-web

> NFR design 決定を component レベルの view に落とし、Infrastructure Design へ橋渡しする。単一 bundle（deployable unit U1）だが、**論理的 failure domain** を分離し blast radius を限定する。service isolation ではなく client 内の module 境界＋error ownership の設計。Domain Design の hexagonal 構成を踏襲。

## Failure domains（論理境界）

| Domain | 役割 | 所有 error | isolation 方針 |
|---|---|---|---|
| ScenarioLoader（/data 検証境界） | raw external authoring data の唯一の validation boundary | ScenarioValidationError | malformed Scenario を起動時に隔離。valid のみ validated definition→Catalog へ。1 Scenario の failure を他 Scenario へ波及させない |
| Domain（/domain, pure） | deterministic core（評価/進行/承認/rule） | DomainInvariantError（ScenarioProgression 所有） | React/localStorage/network/locale 表示 非依存。最も安定。invariant 違反時は当該 session を errored とし不整合部分状態で続行しない |
| ProgressStore（/data 永続境界） | localStorage adapter | PersistenceError | parse/version/corruption を domain へ漏らさず正規化。safe reset を担当（破損/非互換の error-recovery） |
| ApplicationOrchestrator（/app） | 結線・error 橋渡し | —（各 boundary の error を presentation へ橋渡し） | domain の純粋性を保ち、UI から domain ports/services のみ呼ぶ |
| UI / Presentation（/ui） | render / intent / a11y / presentation state | —（domain error は受けて表示） | domain logic を持たない。error は下記 2 経路で扱う |

## Error ownership（2 経路に分離）

1. **期待される domain / application error**（ScenarioValidationError / DomainInvariantError / PersistenceError）
   - Orchestrator / adapter から **明示的 error state** として ErrorView（または該当 view の error 表示）へ橋渡し。
   - readable error・silent fallback なし・決定的 error classification（同一入力→同一分類）。
2. **想定外の React rendering exception**
   - **React ErrorBoundary** で view / shell を保護（想定外の描画例外に限定）。
   - **ErrorBoundary を domain error 処理の代替にしない**（domain error は経路 1 で明示的に扱う）。

## Blast radius（影響範囲の限定）

| 障害 | 影響範囲 | shell への影響 |
|---|---|---|
| 1 Scenario が invalid | その Scenario のみ（利用可能一覧から除外・明示） | なし（他 valid Scenario と shell は生存） |
| 全 Scenario invalid | Scenario 実行不可 | shell は起動し「Scenario unavailable」を表示 |
| persistence 破損/非互換 | persisted state のみ（safe reset で初期化） | なし（通知後に継続可能） |
| view rendering failure（想定外） | 該当 view を基本単位（ErrorBoundary） | 可能な限り shell 生存 |
| domain invariant violation | 当該 session（errored 明示） | shell 生存・不整合状態で続行しない |

## client-side resilience（service reliability は N/A、client は設計対象）

- malformed Scenario fail-fast（BR1.1）/ partial invalid isolation（BR1.8）/ all invalid でも shell survival。
- PersistenceError→safe reset + notification（BR6.2/6.3）。
- deterministic error classification（error path も同一入力→同一挙動）。
- circuit breaker / retry / exponential backoff は **runtime 外部 service がないため不要**。
- user-triggered reset（privacy）と safe reset（error-recovery）は別概念（security-design 参照）。

## shared resource / isolation

- 単一 bundle だが、上記論理境界により障害の伝播を限定。shared な runtime resource は localStorage（ProgressStore が唯一の adapter として仲介、他 component は直接触れない）と build-time asset（read-only）のみ。

## Infrastructure Design への橋渡し

- 本 unit は static SPA のため service isolation / failure domain の物理分離は該当なし。Infrastructure Design が扱うのは配信（CloudFront+S3 / Pages）と security header/CSP（security-design の baseline policy を実装値へ）。
- deploy 実行は Operation（Deployment Execution）。

## Sources
- consumes（同ステージ nfr-requirements）: `../nfr-requirements/performance-requirements.md`, `../nfr-requirements/security-requirements.md`, `../nfr-requirements/tech-stack-decisions.md`。
- consumes（同 unit functional-design、実在ファイル）: `../functional-design/functional-spec.md`（state machine / error flow）, `../functional-design/entities.md`（ScenarioSession/DecisionRecord/error 所有 entity）, `../functional-design/frontend-components.md`（UI 境界）, `../functional-design/rules.md`（BR1.x/BR2.2/BR6.x error）。
- consumes（inception domain-design、役割を分離して参照）:
  - `../../../inception/domain-design/components.md` — 12 component の構造と Domain Error 所有表（component 境界の参照）。
  - `../../../inception/domain-design/decisions.md` — **ADR-011（Domain Error を boundary 別に型区別）の正式な定義元**。本書の error ownership 2 分離はこの ADR-011 に整合する。
