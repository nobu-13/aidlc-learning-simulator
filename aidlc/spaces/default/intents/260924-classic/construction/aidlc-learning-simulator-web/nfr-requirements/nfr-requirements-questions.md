# NFR Requirements — 計画質問（U1: aidlc-learning-simulator-web）

> Construction / NFR Requirements（3.2）。U1（UI kind・static SPA）の非機能要件を定量化・確定する。上流 NFR1〜9（requirements.md）を per-unit の `NFRx.y` へ具体化する。unit kind=ui のため **performance-requirements / security-requirements / tech-stack-decisions** を生成し、**scalability / reliability / observability は service 向けで本 unit には N/A**（backend/API/DB なし、C2）。NFR9 の厳密しきい値は本ステージで確定してよい（design へ委譲していた分）。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。推奨案を付けています。

---

## Q1. Performance の定量目標（NFR9 / NFR1）

static SPA の初回ロード〜体験開始と操作応答の目標をどう定めますか（厳密しきい値を本ステージで確定）。

- A. **推奨（軽量目標）**: 通常ブロードバンドで (a) 初回ロード〜Home 表示 ≤ 3 秒、(b) Scenario 開始〜最初の DecisionPoint 表示 ≤ 1 秒、(c) Decision 選択〜Feedback 表示 ≤ 200ms（決定的評価は同期・純関数で軽量）、(d) 本番 JS 初期バンドル（gzip 後）≤ 300KB を目安。Scenario/locale は build-time 同梱で runtime fetch なし。測定は Lighthouse/bundle size を CI で可視化（合否ゲートは軽く、目安として扱う）。
- B. 別の目標値（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋測定条件を明確化。target: 初回 cold load→Home ≤ 3 秒 / Scenario 開始→最初の DecisionPoint ≤ 1 秒 / Decision 選択→Feedback ≤ 200ms / production 初期 JS bundle gzip target ≤ 300KB。測定条件を固定: production build 対象・Lighthouse 等の同一 preset/同一条件・interaction latency は自動テスト可能な固定環境で測定・単発でなく複数回測定の代表値を記録。CI 運用: Lighthouse 値は可視化＋regression 監視、300KB は budget target（超過は即 fail でなく依存追加/bundle 増加理由を確認する運用も可）、環境ノイズだけで CI を不安定にする厳格 performance gate にはしない。数値を置くだけでなく再現可能な測定条件を残す。

---

## Q2. Security の範囲と方針（NFR7）

client-only static SPA の security 方針をどう固定しますか。

- A. **推奨（proportionate）**: (a) secret/credential/token を repo・バンドル・evidence に含めない、(b) backend/認証/認可なし（C2、認可モデル該当なし）、(c) 個人情報を収集・送信しない（localStorage は進行/結果/設定のみ、PII なし）、(d) 依存の供給網対策として CI に npm audit（high 以上で fail 検討）＋ Dependabot、least-privilege な CI 権限（contents:read、Pages/AWS デプロイ時のみ最小追加）、(e) 静的配信の基本 security header/CSP は hosting 設定として design/infra で具体化、(f) 過剰な security tooling は追加しない。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: B（基本採用・「PII なし」表現を修正）。secret/credential/token を repo・bundle・evidence に含めない。backend/auth/authorization なし。**アプリは PII 入力を要求しない**が、DecisionRecord.note / Adoption Review memo という自由入力があり **ユーザーが任意情報（個人情報含みうる）を書き込める**。analytics/telemetry 等でユーザー入力を外部送信しない。note/progress/result は localStorage のみ。**localStorage を機密情報保存先として扱わない**。runtime generative AI / 外部 AI API へ note を送信しない。ユーザーがローカル進行データを reset できる。dependency security: Dependabot 有効・npm audit を CI で実施・production dependency の high/critical を原則対応・false positive/fix unavailable 等は理由記録で例外可・dev dependency まで機械的に全件 blocking しない。CI permission: default least privilege・contents:read 基本・Pages/AWS deployment に必要な権限のみ deployment job へ・long-lived AWS credentials を repo secret として安易に固定しない。hosting security（CSP / X-Content-Type-Options / Referrer-Policy / frame・embed 制御）は Infrastructure/hosting design へ委譲。過剰な security tooling は追加しない。

---

## Q3. tech-stack decisions（確定・NFR5/NFR6）

技術選定を確定します（steering/practices で既定のもの含む）。

- A. **推奨（確定済みを明文化）**: React + TypeScript(strict) + Vite（静的 SPA）。テスト: Vitest + @vitest/coverage-v8 + @testing-library/user-event + axe(axe-core ラッパー) + eslint-plugin-jsx-a11y。schema validation: zod（ScenarioLoader の runtime 検証境界。具体は functional-design で zod と示唆済み）。i18n: 独自の locale key→string 解決（軽量、外部 i18n ライブラリは必須としない）。lint/format: ESLint（no-restricted-globals/properties で Date/Math.random/performance.now を scoring から静的排除）+ Prettier。build/deploy: 同一 bundle を AWS(CloudFront+S3) と GitHub Pages へ（hosting 差異は Vite `base` 等の config）。
- B. 変更・追加（補足してください）
- X. Other (please specify)

[Answer]: A（基本採用）＋2 点修正。採用スタック: React / TypeScript strict / Vite / Vitest / @vitest/coverage-v8 / Testing Library・user-event / axe 系 / eslint-plugin-jsx-a11y / zod / ESLint / Prettier。i18n は独自軽量 locale resolver でよいが必須: ja/en key completeness 検証・missing key の test・production で blank/undefined を silent 表示しない・locale 変更で semantic data を変更しない。**time/random 静的排除は domain/evaluation/semantic-ID generation に限定**（UI・performance measurement・test utility まで禁止しない。ESLint は no-restricted-properties / no-restricted-syntax / directory-specific override を scoring/domain boundary に適用）。**portability は byte-identical 同一 bundle を必須にしない**。contract = **same application source + hosting-specific configuration**（same source・same application behavior・runtime AWS 固有依存なし・hosting 固有差は build/deploy config に限定・Vite base 等の hosting configuration 差は許容）。

---

## Q4. その他 NFR（NFR2/3/4/5/6/8）の本ステージ扱い

これらは functional-design / 上流で方針確定済みです。本ステージでの扱いを確認します。

- A. **推奨**: 本ステージでは新規定量化せず、performance/security/tech-stack に関係する範囲のみ `NFRx.y` として派生し、他は traceability で対応（NFR2 決定性=functional-design BR3.x とテストで担保 / NFR3 provenance=functional-design / NFR4 a11y=security ではなく quality・design で担保、performance と別 / NFR5 maintainability=tech-stack の data-driven/layer 分離 / NFR6 portability=tech-stack・infra / NFR8 honesty=表示方針、UI/文言で担保）。scalability/reliability/observability は service 向けで N/A（backend なし）と traceability に明示。
- B. 別扱い（補足してください）
- X. Other (please specify)

[Answer]: B（core quality NFR を検証可能な形へ具体化）。scalability/service observability artifact を N/A とすること自体は可だが、以下を traceability だけで終わらせず **per-unit NFR として明文化**する:
  - **Determinism**: 同一 validated Scenario + 同一 DecisionRecord sequence + 同一 semantic context → DimensionOutcome 100% 同一。ja/en・Guided/Simulation を変えても evaluation result 不変。runtime semantic ID は time/random 非依存。
  - **Provenance / Educational Accuracy**: Important DecisionPoint および主要 LearningPoint は provenanceRefs ≥ 1 を 100% 満たす。ai-dlc-spec は AI-DLC v2.10.0 primary reference 必須。4 category が混同されないことを fixture validation で検証。
  - **Accessibility（WCAG 2.2 AA 目標）**: Core E2E flow を keyboard-only 完走可能・axe critical/serious = 0・visible focus・provenance/evaluation level は色のみで表現しない・dynamic feedback/result/error を assistive technology へ通知可能。自動テストだけで完全準拠は主張せず最終 B8 で manual check。
  - **Maintainability**: TypeScript strict・production build type error = 0・ESLint error = 0・domain logic を UI へ置かない・Scenario 追加は原則 data 追加で可能・evaluation rule は data-driven 維持。任意の coverage % を品質保証として置かず、重要 domain path を tests で明示。
  - **Portability**: AWS hosting 固有 runtime dependency = 0・GitHub Pages/AWS で同一 source 利用可能・hosting 差異は configuration へ隔離・Scenario/locale は runtime remote dependency なし。
  - **Honesty / Educational Simulation**（明示的 NFR）: simulation 由来数値は 100% Educational Simulation Value として識別可能・empirical measurement と誤認させない・AI-DLC 仕様/harness behavior/simulator interpretation/simulation assumption を区別・Adoption Sheet を自動的な enterprise design 確定物として表示しない。
  - **service 系 NFR の扱い**: Scalability = N/A（backend/API/DB/server workload なし）。Observability = service observability は N/A（runtime telemetry/backend monitoring なし）。Reliability = **service-level reliability artifact は N/A だが client-side resilience 要件は存在**（malformed Scenario fail-fast・partial invalid isolation・PersistenceError safe reset・deterministic error behavior・application shell survival を既存 NFR/Functional Design で保持）。「service reliability artifact = N/A」と「client resilience requirement = 存在」を区別する。

---

## Consolidated Summary Confirmation

以下で U1 の NFR Requirements 成果物（performance-requirements.md / security-requirements.md / tech-stack-decisions.md / traceability.json）を生成します。生成前に確認してください。unit kind=ui のため scalability/reliability/observability の service 向け artifact は生成せず traceability で N/A（＋client resilience は既存で保持）を明示します。

- **Performance（NFRx.y）**: load→Home ≤3s / Scenario→最初の DecisionPoint ≤1s / Decision→Feedback ≤200ms / production 初期 JS gzip ≤300KB(budget)。**再現可能な測定条件を固定**（production build・同一 Lighthouse preset/条件・固定環境の interaction latency・複数回代表値）。CI は可視化＋regression 監視、厳格 gate にしない。
- **Security（NFRx.y）**: secret 非混入・backend/auth なし・PII 入力を要求しない・自由入力 note に任意情報を書きうる・外部送信なし（analytics/telemetry/生成 AI へ note 送信なし）・localStorage のみ（機密保存先扱いしない）・reset 可能。dependency: Dependabot＋npm audit（production high/critical 原則対応、例外は理由記録、dev 全件 blocking しない）。CI least-privilege（contents:read 基本、deploy に必要な権限のみ、long-lived AWS credential を安易に固定しない）。hosting header/CSP は infra へ委譲。
- **Tech Stack**: React/TS(strict)/Vite、Vitest+coverage-v8+Testing Library/user-event+axe+jsx-a11y、zod、独自軽量 i18n（ja/en completeness・missing key test 必須）、ESLint（time/random 排除は domain/evaluation/semantic-ID に限定、directory override）+Prettier、同一 source+hosting config で AWS/Pages 配信。
- **Core quality NFR（明文化）**: Determinism（同一入力→100% 同一 DimensionOutcome、ja/en・mode 不変、runtime ID time/random 非依存）/ Provenance（重要 DecisionPoint・LearningPoint は provenanceRefs≥1 100%、ai-dlc-spec は v2.10.0 reference 必須、4 category 混同なしを fixture 検証）/ Accessibility（keyboard-only 完走・axe critical/serious=0・色のみ非依存・aria 通知、完全準拠は主張せず B8 で manual）/ Maintainability（strict・type error 0・ESLint error 0・UI に domain logic 置かない・data-driven）/ Portability（AWS 固有 runtime dependency 0・config 隔離）/ Honesty（Educational Simulation Value を実測と誤認させない・4 区分・Sheet は確定物でない）。
- **service 系**: Scalability=N/A、service Observability=N/A、service reliability artifact=N/A。ただし **client-side resilience（malformed fail-fast・partial invalid isolation・PersistenceError safe reset・deterministic error・application shell survival）は要件として存在**。
- **traceability.json**: 上流 NFR1〜9 を per-unit NFRx.y へ対応、service 系は N/A（理由付き）。

- Looks correct
- Request changes

[Answer]: Looks correct
