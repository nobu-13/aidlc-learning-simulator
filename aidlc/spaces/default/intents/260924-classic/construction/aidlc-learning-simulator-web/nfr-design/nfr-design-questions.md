# NFR Design — 計画質問（U1: aidlc-learning-simulator-web）

> Construction / NFR Design（3.3）。NFR Requirements（3.2）で定めた NFRx.y に対する**具体的な設計パターン**を決める（設計レベル、実装コードは code-generation）。client-only static SPA のため service 向け（scalability/reliability/observability）design artifact は N/A、生成するのは **performance-design / security-design / logical-components / traceability**。service reliability は N/A だが **client-side resilience は設計対象**（malformed fail-fast・safe reset・deterministic error・shell survival）。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。推奨案を付けています。

---

## Q1. Performance 設計パターン（NFR9.1〜9.4 の実現方針）

client-side で performance target を満たす設計をどうしますか。

- A. **推奨**: (a) **route/view-level code splitting**（Home/Scenario/Result/Adoption/Focus を lazy load、初期バンドルを NFR9.4 の gzip≤300KB budget 内に）、(b) Scenario/locale は build-time 同梱（runtime fetch なし）で NFR9.2 を満たす、(c) 決定的評価は同期純関数で軽量・必要なら結果を memoize（同一 DecisionRecord 列→同一 Outcome の決定性は保つ）、(d) 大きな依存を避け tree-shaking を効かせる、(e) 測定は Lighthouse/bundle-size を CI で可視化・regression 監視。過剰な最適化（仮想化・worker 等）は現データ規模では不要。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋code splitting 境界を実測主導へ。採用: build-time Scenario/locale・tree-shaking・大規模依存回避・Lighthouse/bundle size の CI 可視化・regression 監視・Worker/virtualization 等の過剰最適化なし。**全 view を機械的に lazy load しない**（NFR9.1 の初回 bundle 削減と NFR9.2 の Scenario 開始→最初の DecisionPoint ≤1s のトレードオフ）。方針: Core 必須（Home/ModeSelect/Scenario shell）は eager または早期 preload 許容、secondary（Adoption Review/Focus Library 等）を優先 lazy、ScenarioView を split する場合は Home 表示後の idle/preload で事前取得可能に、code splitting は目的でなく 300KB budget と実測値に基づき境界決定。**Decision evaluation の memoization はデフォルト必須にしない**（同期・純関数・小規模データ。profiling で必要性確認時のみ導入し、cache key は semantic input 由来・time/random/locale/mode 非混入）。「runtime fetch なし」は Scenario/locale 等 application data の制約であり、lazy chunk 等 static asset 取得まで禁止しない。

---

## Q2. Security 設計（NFR7.x の実現方針・review_artifact）

client-only SPA の security 設計をどうしますか。hosting header/CSP は infra へ委譲する前提です。

- A. **推奨**: (a) **no-network posture**: アプリは外部 API/analytics/telemetry を呼ばない設計（fetch を評価・進行経路に持たない）、(b) 自由入力 note/memo は sanitize せず**そのまま React でテキストとして描画**（dangerouslySetInnerHTML を使わない＝XSS 面を作らない）・外部送信しない・localStorage のみ、(c) **user-triggered reset** UI（NFR7.5a）を提供し localStorage をクリア、(d) secrets を code/bundle に置かない（そもそも不要）、(e) CSP/セキュリティ header の**推奨値を infra へ引き渡す**（default-src 'self'、外部接続を絞る方針を明記）、(f) dependency 例外記録の運用（NFR7.6）を CI 設計として参照。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋input/output 経路を明確化。基本: runtime 外部 API なし・analytics/telemetry なし・user data 外部送信なし・secrets を bundle に含めない・localStorage のみ・user-triggered reset・dependency security・hosting header/CSP は Infrastructure Design へ委譲。**no-network posture の定義**: 「ネットワーク通信が一切ない」ではなく **static application asset の取得を除き application data / user input を外部 service へ送信しない**（code splitting の JS chunk 取得と矛盾しない）。**note/memo 表示**: React text node / textarea value として扱う・dangerouslySetInnerHTML 禁止・user text を HTML として解釈しない（通常の text rendering に sanitize 追加不要）。**Adoption Discussion Sheet 経路**: note/noteText が Markdown へ入るため input→storage→result→Markdown export まで一貫して untrusted user-authored text として扱う（trusted HTML 扱いしない・Markdown 生成時に semantic data と user text を区別・preview renderer は raw HTML execution 無効・HTML injection を許す Markdown extension を有効化しない・export された Markdown 内 user text は「ユーザー記入内容」を維持・user input で provenance/system-generated section を偽装できない構造）。**CSP handoff**: 具体値でなく baseline policy として引き渡す（default-src 'self'・connect-src は runtime 外部 service なしを反映し最小化・script/style/img/font は必要な source のみ・object/embed は不要なら禁止・frame/embed 制御明示・inline/eval 依存を極力作らない）。最終 directive は hosting capability を確認して Infrastructure Design で確定。

---

## Q3. logical-components（境界・failure domain・blast radius）

logical component の境界・障害分離をどう記述しますか。Domain Design の hexagonal 構成が既にあります。

- A. **推奨**: Domain Design の component 境界を踏襲し、client 内の failure domain を明記: (a) **ScenarioLoader 境界**＝外部データ検証の isolation（malformed は起動時に隔離、valid のみ Catalog へ）、(b) **domain（pure）**＝ React/IO 非依存で最も安定、(c) **ProgressStore 境界**＝localStorage 障害を PersistenceError に閉じ込め safe reset、(d) **UI 境界**＝presentation のみ、domain 障害を ErrorView へ橋渡し。blast radius: 1 Scenario の malformed は他 valid Scenario に波及しない（partial invalid isolation）。単一 bundle だが論理的 failure domain を上記で分離。
- B. 別記述（補足してください）
- X. Other (please specify)

[Answer]: A（採用）＋error ownership 明示。failure domain: **ScenarioLoader**=raw external authoring data の唯一の validation boundary（malformed を隔離・valid のみ Catalog へ・1 Scenario failure を他へ波及させない）。**Domain**=pure/deterministic core（React/localStorage/network/locale 表示 非依存）。**ProgressStore**=localStorage adapter boundary（parse/version/corruption を domain へ漏らさず PersistenceError へ正規化・safe reset 担当）。**UI/Presentation**=domain logic を持たず viewModel を表示。**error handling は 2 種に分離**: (1) 期待される domain/application error（ScenarioValidationError/DomainInvariantError/PersistenceError）は Orchestrator/adapter から明示的 error state として ErrorView へ、(2) 想定外の React rendering exception のみ React ErrorBoundary で view/shell を保護。**ErrorBoundary を domain error 処理の代替にしない**。blast radius: invalid Scenario→その Scenario のみ / persistence 破損→persisted state のみ / view rendering failure→該当 view を基本単位 / application shell は可能な限り生存。

---

## Q4. client-side resilience（service reliability は N/A だが client 側は設計する）

service-level reliability artifact は N/A ですが、client-side resilience の設計方針を確認します。

- A. **推奨**: (a) **malformed Scenario fail-fast**（ScenarioValidationError→開始しない・readable error）、(b) **partial invalid isolation**（invalid を除外し valid を維持、全 invalid でも shell 起動＋unavailable 表示）、(c) **persistence 破損/非互換**→PersistenceError→safe reset＋通知、(d) **deterministic error behavior**（同一入力→同一 error classification）、(e) **application shell survival**（致命でない限りアプリ全体を落とさない、ErrorBoundary 相当で view を保護）。これらは functional-design の BR（BR1.1/1.8/2.2/6.2/6.3）に対応する設計として logical-components/security に反映。circuit breaker/retry 等の service パターンは該当なし（外部呼び出しがない）。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋ErrorBoundary の責務限定。採用: malformed Scenario fail-fast・partial invalid isolation・all invalid でも application shell survival・corrupted/incompatible persistence→PersistenceError→safe reset+notification・deterministic error classification・expected domain error は explicit error state・unexpected render exception のみ ErrorBoundary・circuit breaker/retry/exponential backoff は runtime 外部 service がないため不要。**user-triggered reset と PersistenceError 時の safe reset は別概念を維持**。「致命でない限りアプリ全体を落とさない」は維持するが、**DomainInvariantError を握り潰して継続しない**（発生時は当該 session を errored として明示し、不整合な部分状態で処理を続行しない）。

---

## Q5. service 向け design（scalability/reliability/observability）の扱い

これらは service 向けで本 unit には該当しません。扱いを確認します。

- A. **推奨**: scalability-design / reliability-design / observability-design は **N/A**（backend/API/DB/server workload・runtime telemetry・backend monitoring なし）とし traceability に理由付きで明示。client 側の関連要件（resilience=Q4、performance=Q1）は performance-design / logical-components / security-design 側に設計として記述。
- B. 別扱い（補足してください）
- X. Other (please specify)

[Answer]: A（採用）。scalability-design / service reliability-design / service observability-design を理由付き N/A（backend/API/DB/server workload/runtime telemetry/backend monitoring なし）。ただし N/A なのは service artifact であり、以下は引き続き設計対象: client performance→performance-design / client resilience→logical-components・security-design / error visibility→ErrorView・A11yLiveRegion / dependency・CI・security→security-design。service 向け N/A を理由に client quality requirements を削除しない。

---

## Consolidated Summary Confirmation

以下で U1 の NFR Design 成果物（performance-design.md / security-design.md / logical-components.md / traceability.json）を生成します。生成前に確認してください。unit kind=ui のため scalability/reliability/observability の service 向け design は生成せず traceability で N/A（client 側は設計対象として保持）。

- **Performance design**: 実測主導 code splitting（Core=Home/ModeSelect/Scenario shell は eager/早期 preload、secondary=Adoption/Focus は lazy、ScenarioView split 時は idle preload、境界は 300KB budget と実測で決定）。build-time 同梱・tree-shaking・大規模依存回避。memoization はデフォルト必須にせず profiling 必要時のみ（cache key=semantic input、time/random/locale/mode 非混入）。CI で Lighthouse/bundle size 可視化・regression 監視。
- **Security design（review_artifact）**: no-network posture=「static asset 取得を除き application data/user input を外部送信しない」。note/memo は React text/textarea・dangerouslySetInnerHTML 禁止。**Adoption Markdown 経路まで untrusted user text を一貫**（raw HTML 実行無効・HTML injection 拡張無効・provenance/system section を偽装させない）。CSP は baseline policy（default-src 'self'・connect-src 最小・必要 source のみ・object/embed 禁止・frame 制御・inline/eval 回避）を Infrastructure Design へ引き渡し。dependency 例外運用（NFR7.6）参照。
- **logical-components**: failure domain を明記（ScenarioLoader=検証境界/隔離、Domain=pure、ProgressStore=persistence 正規化+safe reset、UI=presentation）。**error ownership 2 分離**（expected domain error=explicit state→ErrorView / 想定外 render exception のみ ErrorBoundary、代替にしない）。blast radius 段階化（invalid Scenario→その Scenario、persistence 破損→persisted state、view failure→該当 view、shell 生存）。
- **client-side resilience**: fail-fast・partial invalid isolation・safe reset+notification・deterministic error classification・shell survival。**DomainInvariantError は握り潰さず errored 明示・不整合部分状態で続行しない**。user reset と safe reset は別概念。circuit breaker/retry は該当なし。
- **service 系**: scalability/reliability/observability design は N/A（backend/telemetry なし）。client quality（performance/resilience/error visibility/dependency）は削除せず設計に保持。
- **traceability.json**: 上流 NFRx.y（NFR9.x/NFR7.x/NFR5.x/NFR6.x 等）を design solution へ対応。Coverage != Verification。

- Looks correct
- Request changes

[Answer]: Looks correct
