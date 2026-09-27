# Security Requirements — U1: aidlc-learning-simulator-web

> client-only static SPA（backend/auth/authorization なし）の proportionate security NFR。上流 NFR7 を per-unit `NFRx.y` へ具体化。過剰な security tooling は追加しない。hosting レベルの security header/CSP は Infrastructure/hosting design へ委譲。

## Threat model（概要）

- backend/API/DB/認証なし → サーバ側攻撃面・認可バイパス・データ漏洩（サーバ）に相当する脅威は該当なし。
- 主な考慮: (1) secret/credential の混入、(2) 依存の供給網リスク、(3) ユーザー自由入力（note/memo）の取り扱いと外部送信、(4) CI 権限の過剰付与、(5) 静的配信の基本 header。
- 個人情報: **アプリは PII 入力を要求しない**が、自由入力 note にユーザーが任意情報（個人情報を含みうる）を書き込める点を明示的に扱う。

## 要件（NFRx.y）

| ID | 要件 | 内容 | source |
|---|---|---|---|
| NFR7.1 | secret 非混入 | secret / credential / token を repository・バンドル・evidence に含めない | NFR7 |
| NFR7.2 | 認証・認可なし | backend/auth/authorization を持たない（認可モデル該当なし） | NFR7, C2 |
| NFR7.3 | PII 入力を要求しない | アプリは登録・個人情報入力を要求しない。ただし自由入力 note/memo にユーザーが任意情報を書きうることを前提に扱う | NFR7, C2 |
| NFR7.4 | ユーザー入力を外部送信しない | analytics/telemetry/runtime generative AI/外部 AI API のいずれへも note/memo/進行データを送信しない | NFR7, C3, OOS2 |
| NFR7.5 | localStorage の位置づけ | note/progress/result は localStorage のみに保存し、**機密情報保存先として扱わない** | NFR7, FR11 |
| NFR7.5a | user-triggered reset（privacy） | ユーザーが自分のローカル進行データ（note/memo/progress/result/設定）を能動的に消去できる。これは **本ステージで追加した security/privacy 指向の要件**であり、BR6.x の safe reset（corrupted/incompatible persistence に対する error-recovery）とは別概念。上流に明示的な user reset 要件がないため rationale を明記: 自由入力に個人情報が含まれうる（NFR7.3）ため、ユーザーが端末内データを自分で消せる手段を提供する | NFR7（本ステージ追加。rationale=NFR7.3 自由入力の privacy 配慮） |
| NFR7.6 | dependency security | Dependabot 有効。CI で npm audit 実施。**production dependency の high/critical を原則対応対象**。false positive / fix unavailable 等は理由を記録して例外可（記録要件は下記「dependency 例外の記録」）。dev dependency まで機械的に全件 blocking しない | NFR7, team:Testing Posture |
| NFR7.7 | CI least-privilege | default least privilege。`contents:read` を基本とし、Pages/AWS deployment に必要な権限のみ deployment job へ付与。long-lived AWS credentials を repository secret として安易に固定しない | NFR7 |
| NFR7.8 | hosting security（委譲） | CSP / X-Content-Type-Options / Referrer-Policy / frame・embed 制御等の具体設定は Infrastructure/hosting design で確定 | NFR7 |
| NFR7.9 | 過剰 tooling を追加しない | 静的教育用 SPA の規模に見合わない重量級 security tooling は導入しない（proportionate） | NFR7 |

## 自由入力（note/memo）の取り扱い方針（重要）

- ユーザーは DecisionRecord.note / AdoptionReviewMemo.noteText に任意テキストを入力できる（個人情報を含みうる）。
- これらは **localStorage のみ**に保存し、**外部送信しない**（NFR7.4/7.5）。
- runtime 生成 AI / 外部 API へ note を渡さない（C3）。評価入力にも含めない（採点非依存、functional-design BR2.5/BR3.1）。
- **user-triggered reset**により、ユーザーが端末内のローカル保存データを能動的に消去できる（NFR7.5a、privacy 配慮の本ステージ追加要件）。これは破損/非互換 persistence に対する **BR6.x の safe reset（error-recovery）とは別概念**として扱う。
- UI 上で「入力は端末内に保存され外部送信されない」旨をユーザーに示すことが望ましい（文言は design/functional で確定）。

## dependency 例外の記録（NFR7.6 補足・proportionate）

production dependency の high/critical に即時対応できない（false positive / fix unavailable 等）場合、以下を最低限記録する。過剰な enterprise approval workflow は追加しない。

- **記録先**: repository 内の security/dependency exception 記録（例: `SECURITY.md` の一節・`docs/` の dependency-exceptions ファイル・または同等の追跡可能な場所）。
- **判断責任**: repository maintainer / project owner。
- **必須記録項目**: package / advisory（ID）・severity・production impact（本 SPA への実影響有無）・fix availability（修正版の有無）・exception 理由・review / expiry 条件（再評価時期）。

これにより「原則対応、例外は理由記録」の判定と記録が CI 実装時に一意化される（軽量な明確化に留める）。

## Non-goals

- サーバ側 WAF/認可/暗号化通信の設計は該当なし（backend なし）。
- 侵入テスト・脅威モデリングの重量プロセスは MVP 規模に不要（proportionate）。

## Sources
- consumes: `../functional-design/rules.md`（BR2.5 note 採点非依存, BR6.x 永続化）, `../functional-design/frontend-components.md`（自由入力）, `../../../inception/requirements-analysis/requirements.md`（NFR7, C2, C3, OOS2）, team.md（Deployment/CI）。
