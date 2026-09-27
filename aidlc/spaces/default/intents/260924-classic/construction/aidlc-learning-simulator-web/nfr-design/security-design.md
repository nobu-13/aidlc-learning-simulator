# Security Design — U1: aidlc-learning-simulator-web

> NFR7.x（proportionate security）に対する client-side 設計。設計レベル（実装は code-generation）。hosting header/CSP の具体値は Infrastructure Design で確定し、本書は **baseline policy と設計意図**を引き渡す。backend/auth なしのため server 側 security は対象外。

## 1. no-network posture（定義）

- 定義: **static application asset の取得を除き、application data / user input を外部 service へ送信しない**（「通信が一切ない」ではない）。
- 実装意図: 評価・進行・保存の経路に外部 API/analytics/telemetry/生成 AI 呼び出しを持たない。fetch は（もし使うなら）static asset / lazy chunk 取得に限定。
- code splitting による JS chunk 取得と矛盾しない（それは static asset）。

## 2. user 入力（note/memo）の I/O 経路（一貫して untrusted 扱い）

自由入力（DecisionRecord.note / AdoptionReviewMemo.noteText）は **input → storage → result → Markdown export** の全経路で untrusted user-authored text として扱う。

- **入力/表示（XSS 面を作らない）**: React の text node / `textarea` value として扱い、`dangerouslySetInnerHTML` を使わない。user text を HTML として解釈しない（通常の text rendering に追加 sanitize 不要）。
- **保存**: localStorage のみ。外部送信しない（no-network posture）。
- **Adoption Discussion Sheet（Markdown）経路**:
  - user text を trusted HTML として扱わない。
  - Markdown 生成時に **semantic data（system-generated）と user-authored text を区別**する（セクション構造上、user text が system セクション/provenance を偽装できない）。
  - Markdown preview renderer を使う場合は **raw HTML execution を無効化**（HTML injection を許す Markdown extension を有効化しない）。
  - export された Markdown 内の user text は「ユーザー記入内容」であることを維持（引用/明示ラベル等の構造で system 生成と混同させない）。

## 3. secrets / 認証

- secret / credential / token を code / bundle / evidence に含めない（そもそも不要：backend/auth なし＝NFR7.1/7.2）。
- 認証・認可モデルなし（該当なし）。

## 4. localStorage / privacy

- note/progress/result/設定は localStorage のみ。**機密情報保存先として扱わない**（NFR7.5）。
- **user-triggered reset** を UI で提供し localStorage をクリアできる（NFR7.5a、privacy 配慮）。これは **BR6.x の safe reset（破損/非互換の error-recovery）とは別概念**。
- 「入力は端末内に保存され外部送信されない」旨をユーザーに示す（文言は functional/design で確定）。

## 5. CSP / security header（baseline policy を Infrastructure Design へ引き渡し）

具体値は hosting capability（AWS CloudFront/S3・GitHub Pages）を確認して Infrastructure Design で確定。本書は baseline policy と意図を渡す:

- `default-src 'self'`
- `connect-src`: runtime 外部 service なしを反映して最小化（自己 origin + 必要な static 配信のみ）。
- `script-src` / `style-src` / `img-src` / `font-src`: 実際に必要な source だけを許可。
- `object-src 'none'` / embed 系は不要なら禁止。
- `frame-ancestors` 等で frame/embed を制御。
- **inline/eval 依存を極力作らない**（CSP を厳格化しやすい実装にする。Vite の本番ビルドで inline script を避ける方針）。
- 補助 header: `X-Content-Type-Options: nosniff` / `Referrer-Policy`（最小送出）等を Infrastructure Design で設定。

### CSP と portability（NFR6.1 との整合）

- **配信 origin は hosting により異なりうる**（AWS CloudFront/S3 と GitHub Pages で実際の origin が変わる）。したがって `connect-src` / `script-src` / `style-src` / `img-src` 等の **具体 origin は Infrastructure Design が hosting capability に応じて確定**する。本書は `default-src 'self'` を baseline とし、方針（最小許可）だけを渡す。
- **static asset（JS chunk 等）の取得は no-network posture 違反ではない**（no-network posture は application data / user input の外部送信の禁止であり、self origin からの static asset 取得を妨げない）。
- **application data / user input の外部送信は禁止を維持**（connect-src を最小化し、runtime 外部 service への接続を作らない）。
- これは NFR6.1 portability（**same application source + hosting-specific configuration**）と整合する: CSP の具体 origin は hosting-specific configuration として infra が確定し、application source は同一。

## 6. dependency security（NFR7.6 運用の設計参照）

- Dependabot 有効・CI で npm audit。production dependency の high/critical を原則対応。
- 例外は `security-requirements.md`「dependency 例外の記録」に従い、記録先（repo 内 exception 記録）・判断責任（maintainer/owner）・必須項目（package/advisory・severity・production impact・fix availability・理由・review/expiry）を残す。
- dev dependency まで機械的に全件 blocking しない。

## 7. CI 権限（least-privilege）

- default `contents:read`。Pages/AWS deployment に必要な権限のみ deployment job へ。
- long-lived AWS credential を repository secret として安易に固定しない（OIDC 等の short-lived を Infrastructure/Pipeline で検討）。

## Threat 一覧（該当・非該当）

| 脅威 | 扱い |
|---|---|
| XSS（user note 経由） | text/textarea 描画・dangerouslySetInnerHTML 禁止・Markdown raw HTML 無効で防止 |
| user data 漏洩（外部送信） | no-network posture で送信経路を作らない |
| secret 漏洩 | secret を持たない・bundle/evidence に含めない |
| 供給網（dependency） | Dependabot + npm audit + 例外記録 |
| サーバ攻撃面（認可/インジェクション） | 該当なし（backend/DB なし） |
| clickjacking / frame 埋め込み | frame-ancestors 等を Infrastructure Design で設定 |

## Sources
- consumes: `../nfr-requirements/security-requirements.md`（NFR7.1〜7.9, 7.5a）, `../functional-design/rules.md`（BR2.5 note 採点非依存, BR7.1 Sheet 決定性）, `../functional-design/frontend-components.md`（自由入力/描画）, `../functional-design/entities.md`（AdoptionReviewMemo/DecisionRecord.note）。
- handoff: Infrastructure Design（CSP/header 具体値, CI credential 方式）。
