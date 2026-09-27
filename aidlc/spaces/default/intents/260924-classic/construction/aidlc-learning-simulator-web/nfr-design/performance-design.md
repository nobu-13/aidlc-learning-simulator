# Performance Design — U1: aidlc-learning-simulator-web

> NFR9.1〜9.4（performance target と測定条件）に対する client-side 設計パターン。設計レベル（実装は code-generation）。過剰最適化を避け、実測（bundle budget と Lighthouse）に基づいて境界を決める。

## 設計方針

### 1. Code splitting（実測主導・機械的 lazy にしない）
- **Core experience は eager / 早期 preload 許容**: Home / ModeSelect / Scenario shell。NFR9.1（初回ロード）と NFR9.2（Scenario 開始→最初の DecisionPoint ≤1s）のトレードオフを避けるため、Core への到達に不可欠な chunk は初期または idle preload で確保する。
- **Secondary path を優先的に lazy load**: Adoption Review / Focus Scenario Library / （必要なら）Result の重い部分。
- **ScenarioView を split する場合**は Home 表示後の `requestIdleCallback` 相当 / route preload で事前取得し、開始時のレイテンシを増やさない。
- **境界は目的でなく手段**: split の粒度は NFR9.4（初期 JS gzip ≤300KB budget）と実測（Lighthouse/bundle 分析）に基づいて決める。budget 内なら過剰に分割しない。

### 2. データ供給
- Scenario / locale は **build-time 同梱**（NFR9.2 のため runtime fetch しない＝application data の runtime 取得なし）。
- 「runtime fetch なし」は application data の制約であり、**lazy chunk 等 static asset の取得は許容**（no-network posture の定義と整合、security-design 参照）。

### 3. 評価の軽量性・決定性
- 決定的評価は同期・純関数・小規模データ。NFR9.3（Decision→Feedback ≤200ms）は通常このままで満たせる。
- **memoization はデフォルト必須にしない**。profiling で必要性が確認された場合のみ導入。導入時も cache key は **semantic input 由来**（DecisionRecord 列 + immutable context）とし、time/random/locale/mode を混入させない（決定性 NFR2 を崩さない）。

### 4. バンドル最適化
- tree-shaking を効かせる（ESM・side-effect free な import）。
- 大規模依存を避ける（i18n は独自軽量 resolver、schema は zod）。

### 5. 測定・監視（NFR9 の測定条件）
- **production build 対象**・同一 Lighthouse preset/条件・固定環境の interaction latency・複数回測定の代表値（NFR9.1〜9.4 の測定条件を継承）。
- CI で Lighthouse スコアと bundle size（gzip）を可視化し **regression 監視**。300KB は budget target（超過は即 fail でなく原因確認）。環境ノイズだけで落とす hard gate にしない。

## Performance budget（設計値・NFR9 由来）

| 項目 | budget | 実現手段 |
|---|---|---|
| 初回 cold load → Home（NFR9.1） | ≤ 3s | 初期 bundle 最小化・Core eager/preload・tree-shaking |
| Scenario 開始 → 最初の DecisionPoint（NFR9.2） | ≤ 1s | build-time 同梱・Scenario shell を初期/preload・split 時は idle preload |
| Decision → Feedback（NFR9.3） | ≤ 200ms | 同期純関数評価・必要時のみ semantic-key memoize |
| 初期 JS bundle gzip（NFR9.4） | ≤ 300KB(budget) | code splitting（secondary lazy）・tree-shaking・依存最小化 |

## Non-goals（本 unit）
- Web Worker / 仮想化 / server-side rendering 等は現データ規模で不要（過剰最適化）。
- サーバ throughput/キャッシュ層は該当なし（backend なし）→ scalability N/A。

## Sources
- consumes: `../nfr-requirements/performance-requirements.md`（NFR9.1〜9.4）, `../nfr-requirements/tech-stack-decisions.md`（Vite/tree-shaking）, `../functional-design/functional-spec.md`（評価の同期性）, `../functional-design/rules.md`（BR3.2 決定性）。
