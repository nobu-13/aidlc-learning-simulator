<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T23:55:00Z — code splitting は機械的 lazy でなく実測(300KB budget)主導で境界決定。Core(Home/ModeSelect/Scenario shell)は eager/早期 preload 許容、secondary(Adoption/Focus)を優先 lazy。NFR9.1(初回 bundle)と NFR9.2(Scenario 開始≤1s)のトレードオフを避ける。memoization はデフォルト必須にせず profiling 必要時のみ(cache key は semantic input 由来)。「runtime fetch なし」は application data の制約で lazy chunk(static asset)取得は許容。
- 2026-09-25T23:55:00Z — no-network posture = 「通信ゼロ」ではなく「static application asset 取得を除き application data / user input を外部 service へ送信しない」。code splitting の chunk 取得と両立。
- 2026-09-25T23:55:00Z — 自由入力 note/memo は input→storage→result→Markdown export まで一貫して untrusted user-authored text として扱う。dangerouslySetInnerHTML 禁止・Markdown preview は raw HTML execution 無効・HTML injection 拡張を有効化しない・user input で provenance/system-generated section を偽装できない構造にする。CSP は具体値でなく baseline policy を Infrastructure Design へ引き渡す。
- 2026-09-25T23:55:00Z — error handling を 2 種に分離: 期待される domain/application error(ScenarioValidationError/DomainInvariantError/PersistenceError)は explicit error state→ErrorView、想定外の React render exception のみ ErrorBoundary。ErrorBoundary を domain error 処理の代替にしない。DomainInvariantError は握り潰さず session を errored 明示し不整合部分状態で続行しない。user-triggered reset と safe reset は別概念。circuit breaker/retry は外部呼び出しがないため不要。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-26T00:10:00Z — advisory review iteration1=READY（Minor 3）を Request-Changes で反映。R-01 logical-components Sources の dangling path ../functional-design/components を実在 source（functional-spec.md/entities.md/frontend-components.md/rules.md、inception domain-design）へ修正。R-02 ADR-011 の出典を分離明記（components.md=component 構造/Domain Error 表、decisions.md=ADR-011 正式定義元）。R-03 security-design CSP baseline に portability 整合節を追加（hosting で origin が異なりうる・default-src 'self' baseline・具体 origin は infra 確定・static asset 取得は no-network 違反でない・application data/user input 外部送信禁止維持・NFR6.1 と整合）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
