# Infrastructure Design — 計画質問（U1: aidlc-learning-simulator-web）

> Construction / Infrastructure Design（3.4）。static SPA の**配信・CI/CD・monitoring**を設計レベルで確定（IaC・pipeline 実装は code-generation、実 deploy は Operation）。同一 source を AWS（CloudFront+S3、審査中のライブ）と GitHub Pages（審査後）へ、差異は hosting-specific configuration に隔離（NFR6.1）。security-design の CSP baseline を hosting capability に応じて具体化する。backend/DB/queue なし＝infra services は最小。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。推奨案を付けています。

---

## Q1. 配信アーキテクチャ（deployment）

static SPA の配信構成をどうしますか。

- A. **推奨**: (a) **AWS: S3（private bucket, static site origin）+ CloudFront（OAC で S3 を保護、HTTPS、SPA 用に 403/404→index.html の fallback）**、(b) **GitHub Pages: 同一 build 成果物を Pages へ**（審査後）、(c) 差異は **Vite `base` と SPA fallback 設定**等の hosting-specific configuration に隔離（NFR6.1、別実装を作らない）、(d) IaC は AWS 側を CDK または CloudFormation（design 段階では「CDK/CloudFormation いずれか」を選択、実装は code-generation）、(e) 環境は本 MVP では単一（production 相当の公開 + ローカル dev）で staging を必須にしない。
- B. 別構成（補足してください）
- X. Other (please specify)

[Answer]: A 修正。**AWS**: CloudFront → OAC → **Private S3 bucket（REST bucket origin）**。**S3 Static Website Endpoint は使用しない**（OAC は website endpoint で使えないため REST origin を使う）。構成: S3 Block Public Access=ON・bucket private・CloudFront OAC でのみ読取・Viewer Protocol Policy=Redirect HTTP to HTTPS または HTTPS Only・Default Root Object=index.html・GET/HEAD のみ・compression 有効。**SPA path routing を使う場合のみ 403/404→`/index.html` fallback（response 200・error caching TTL 短め）**。deep-link path routing を使わず独自 view state のみなら SPA fallback は必須にせず実装方式に合わせる。**GitHub Pages**: byte-identical artifact は要求せず portability contract どおり **same application source + hosting-specific build/deploy configuration**（source/behavior 同一、AWS/Pages 固有差は config のみ、application logic の fork 禁止。Vite `base` 差で成果物自体が異なりうる）。**IaC=CloudFormation を採用**（S3+CloudFront+OAC+ResponseHeadersPolicy 程度の小規模、CDK bootstrap 等の複雑性不要、IaC を直接レビュー可能、公開時の再現性が高い。CDK は追加しない）。環境=local development と production 相当 AWS public の 2 種、staging は作らない。

---

## Q2. CSP / security header の配信方法（security-design baseline の具体化）

security-design が渡した CSP baseline を、hosting でどう配信しますか。

- A. **推奨**: (a) **CloudFront は response headers policy** で CSP と補助 header（X-Content-Type-Options, Referrer-Policy, 必要なら HSTS）を付与、(b) **GitHub Pages は response header を任意設定できないため、`<meta http-equiv="Content-Security-Policy">` で同等の CSP を index.html に埋め込む**（fallback）、(c) 具体 origin は各 hosting の capability に応じて確定（`default-src 'self'`、`connect-src 'self'`＝外部送信なし、`object-src 'none'`、`frame-ancestors 'none'`、inline/eval を避ける）、(d) 2 hosting で **CSP の意味は同等**に保つ（実現手段のみ差異）。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A 修正。**AWS**=CloudFront Response Headers Policy を security header の source of truth とする。baseline: CSP（`default-src 'self'` / `script-src 'self'` / `style-src 'self'` / `img-src 'self' data:`（data: が実際に必要な場合のみ）/ `font-src 'self'` / `connect-src 'self'` / `object-src 'none'` / `base-uri 'self'` / `form-action 'self'`（フォーム送信不要ならより厳格化）/ `frame-ancestors 'none'`）・`X-Content-Type-Options: nosniff`・`Referrer-Policy: no-referrer` または必要最小・HTTPS 前提・HSTS は CloudFront HTTPS 運用を確認して設定。Vite production build を確認し inline script/style を必要としない構成を優先。**GitHub Pages**=`<meta http-equiv="Content-Security-Policy">` は **fallback / best-effort CSP** と位置づけ、CloudFront header CSP と「完全同等」とは記載しない（meta では一部 directive を header と同等に適用できず、特に `frame-ancestors` は meta 不可）。AWS/CloudFront=full security baseline、GitHub Pages=supported directive のみ meta で可能な限り同等化し header-only protection との差異を document。Pages を AWS と完全同等にするためだけの proxy/CDN 追加はしない。primary production/hackathon hosting は AWS。

---

## Q3. CI/CD pipeline（build/test/deploy・credential）

CI/CD をどう設計しますか（GitHub Actions 前提、team practice）。

- A. **推奨**: (a) **CI job（PR/merge）**: install → lint（ESLint）→ typecheck（tsc）→ test（Vitest、`--passWithNoTests=false`、a11y/JSON fixture 健全性含む）→ build（Vite production）。失敗はマージをブロック（quality gate）。(b) **Lighthouse/bundle-size** を CI で可視化・regression 監視（hard gate にしない、NFR9）。(c) **deploy job**: CI 成功後、main への merge で AWS へ配信（審査中）。GitHub Pages 配信は別 workflow/job。(d) **credential**: **GitHub OIDC → 短期 AWS role（least-privilege: S3 put + CloudFront invalidation のみ）**を推奨し、long-lived AWS key を repository secret に固定しない（NFR7.7）。(e) **rollback**: static のため直前の成功アーティファクト/コミットへ再デプロイ（S3 バージョニング or 再ビルド）。(f) 権限は CI job=`contents:read`、deploy job のみ `id-token:write`（OIDC）+ 必要な deploy 権限。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A 修正。**Infrastructure deployment と Application deployment を分離**する。**CI（PR/main 共通 quality pipeline）**: checkout→dependency install（lockfile 固定）→lint→typecheck→unit/domain tests→fixture/schema tests→accessibility automated tests→production build。quality gate: ESLint error=0・TypeScript error=0・tests pass・malformed fixture 等の validation tests pass。Lighthouse/bundle size は regression visibility＋300KB budget monitoring（noisy hard gate にしない）。**Infrastructure deployment（CloudFormation stack: S3/CloudFront/OAC/ResponseHeadersPolicy/bucket policy/deployment IAM・OIDC 構成）は application asset deploy と分離**し、頻繁に自動適用せず workflow_dispatch または Operation での承認済み実行を基本。初回 AWS infra/deploy は Kiro→AWS 操作が確認できる形で Operation 時に実施・記録（Hackathon Evidence）。**Application deployment**: main merge + CI 成功→GitHub OIDC→short-lived AWS credentials→S3 upload/sync→CloudFront invalidation→smoke test。**App deploy role 権限は最小**: target bucket への必要な S3 upload・（sync で delete 使用時のみ）DeleteObject・必要な ListBucket・対象 CloudFront distribution への CreateInvalidation。**CloudFormation を更新する権限を app deploy role に混ぜない**。**GitHub OIDC trust policy**: GitHub OIDC provider・`aud=sts.amazonaws.com`・repository 限定・main branch または GitHub Environment 限定（可能なら Environment `production` で境界明示）。CI job に `id-token:write` 不要、AWS deploy job のみに付与。**Rollback**: S3 Versioning を有効化してもよいが rollback の source of truth は **previous successful Git commit / immutable CI artifact**（成功 build artifact を一定期間保持し再 deploy 可能に。再 build のみ依存は dependency/build 環境差で完全再現できない可能性）。rollback: previous artifact→S3 deploy→CloudFront invalidation→smoke test。

---

## Q4. monitoring / observability（client-only の範囲）

no-network posture（外部送信なし）の下で monitoring をどうしますか。

- A. **推奨**: (a) **runtime のサーバ telemetry/APM は持たない**（backend なし・no-network posture、外部送信しない）。(b) **client 側の error visibility** は ErrorView（domain/application error の可読表示）と A11yLiveRegion（通知）＋ ErrorBoundary（想定外 render exception）で担保（アプリ内で完結、外部送信しない）。(c) **配信基盤の監視**は CloudFront/S3 の標準メトリクス（4xx/5xx 率・キャッシュヒット率等、AWS 側で確認可能な範囲）と Hackathon 用 evidence（公開 URL・デプロイログ）に限定。(d) **CI 監視**は Lighthouse/bundle regression（Q3）。(e) SLI/SLO は MVP では厳密に設けず、可用性は「公開 URL が応答する」レベルの軽い確認に留める。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A ＋ post-deploy smoke verification 追加。runtime telemetry/APM は追加しない（no-network posture 維持）。**Application 内**: ErrorView・A11yLiveRegion・ErrorBoundary・readable error state で client error visibility を担保（外部送信なし）。**AWS 側**: CloudFront/S3 で取得可能な標準的配信状態確認に限定（CloudFront request・4xx・5xx・cache behavior）。追加の real-time logging/APM は MVP 不要。**Deploy 後 smoke verification**（deployment pipeline/Operation で最低限）: CloudFront root URL=HTTP 200・index.html 取得成功・JS/CSS static asset 取得成功・Core Scenario 開始可能・security headers 存在確認・（deep link 使用時）SPA fallback 確認。Hackathon Evidence として CloudFront public URL・deployment 成功ログ・AWS 上で稼働が分かる画面を保存。厳密な availability SLO/alert は MVP では設定しない。

---

## Q5. secrets 管理・環境

secrets と環境構成をどうしますか。

- A. **推奨**: (a) アプリは secret を持たない（backend/auth なし）。(b) **CI/CD の唯一の機密は AWS デプロイ権限**で、OIDC 短期 role により long-lived secret を排除（Q3）。GitHub Pages 配信は `GITHUB_TOKEN`（least-privilege）。(c) secret を repo/bundle/evidence に含めない（NFR7.1）。(d) 環境は単一 production 公開（＋ローカル dev）。hosting 差異（AWS/Pages）は configuration で切替、別環境の複製は作らない。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A 修正。「唯一の機密は OIDC AWS デプロイ権限」という表現は避ける。OIDC では long-lived AWS secret を保存しないため **application secret = 0 / stored AWS deployment secret = 0** を目標とする。GitHub Actions: GitHub OIDC token→AWS STS short-lived credential、role ARN 等の identifier は configuration であり secret として扱わない、`GITHUB_TOKEN` も workflow runtime 提供の短期 token として least privilege 利用。Evidence 公開時は secret でなくても AWS account ID / role ARN 等は不要ならマスク。Environment: local と AWS production/public のみ。**GitHub Pages は別 application environment ではなく alternate hosting target** として扱う。

---

## Q6. AWS preflight（Delivery Planning B9 の申し送り）

Construction 序盤の AWS preflight（account/credential 利用可否・S3/CloudFront 権限・Kiro からの操作可否・evidence 取得方法）を、本設計でどう位置づけますか。

- A. **推奨**: 本 Infrastructure Design で **preflight チェックリスト**（上記 4 点）を明記し、実際の疎通確認・実 deploy は **Operation（Deployment Execution）** で行う。ここでは「何を事前確認すべきか」と「不可時の代替（GitHub Pages 暫定公開）」を設計として残す。AI-DLC Completion Approval と AWS Release Approval は分離（C6）。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A 修正。Infrastructure Design に preflight checklist を残し、実際の AWS 操作・deploy は Operation で実施。ただし **AWS deployment を Hackathon submission 上の release blocker として扱う**。Preflight checklist: (1) AWS account 利用可能 (2) target Region 確認 (3) STS identity 確認 (4) CloudFormation 利用可能 (5) S3 create/update 権限 (6) CloudFront create/update 権限 (7) OAC/ResponseHeadersPolicy 作成権限 (8) IAM/OIDC role 作成または利用可否 (9) Kiro から AWS 操作可能 (10) AWS Console/Kiro/deployment log の Evidence 取得方法確認 (11) secret/token/account 情報を Evidence に露出させない方法確認。**GitHub Pages は AWS deploy 失敗時の development/demo continuity 用の暫定 fallback のみ**で Hackathon の final hosting substitute にはしない。Zero to Shipped Hackathon は「coding agent を AWS へ接続し実 application を AWS 上で live にする」ことを求めるため、**AWS deployment 成功 + public CloudFront URL + Kiro→AWS connection/deployment evidence を Hackathon Release Approval の必須条件**とする。AI-DLC Completion Approval とは引き続き分離。

---

## Consolidated Summary Confirmation

以下で U1 の Infrastructure Design 成果物（infrastructure-specification.md / monitoring-design.md / cicd-pipeline.md / traceability.json）を生成します。生成前に確認してください。設計レベル（IaC/pipeline 実装は code-generation、実 deploy は Operation）。

- **Deployment**: AWS = CloudFront + OAC + **Private S3 REST origin**（website endpoint 不使用・Block Public Access ON・HTTPS・Default Root=index.html・GET/HEAD・compression）。SPA 403/404→index.html fallback は path routing 使用時のみ。GitHub Pages = same application source + hosting-specific configuration（byte-identical 非要求）。IaC=**CloudFormation**（CDK 不使用）。環境=local と AWS production の 2 種。
- **Security header/CSP**: CloudFront Response Headers Policy を source of truth（`default-src 'self'` 他厳格・`frame-ancestors 'none'`・nosniff・Referrer-Policy・HSTS）。GitHub Pages は meta CSP を best-effort（frame-ancestors 等 meta 不可を document）。inline/eval を避ける Vite 構成。
- **CI/CD**: CI quality pipeline（install→lint→typecheck→tests→fixture/a11y→build、ESLint/TS error 0・tests pass のゲート、Lighthouse/bundle regression 監視は hard gate にしない）。**infra deploy(CloudFormation) と app deploy を分離**、app deploy role は S3+CloudFront invalidation に最小化（CFN 更新権限を混ぜない）、**GitHub OIDC 短期 credential**（stored AWS deployment secret=0、CI に id-token 不要 deploy job のみ）、rollback は previous successful commit/immutable CI artifact。
- **Monitoring**: runtime telemetry/APM なし（no-network）。client error visibility（ErrorView/A11yLiveRegion/ErrorBoundary）＋CloudFront/S3 標準メトリクス＋**post-deploy smoke verification**（root 200/asset/Core 開始/headers/SPA fallback）。厳密 SLO/alert は MVP 未設定。
- **Secrets/Environment**: application secret=0 / stored AWS deployment secret=0。role ARN は config（secret 扱いしない）。Pages は alternate hosting target。
- **AWS preflight**: 11 項目 checklist を設計に明記、疎通/実 deploy は Operation。**AWS deployment（成功+public CloudFront URL+Kiro→AWS evidence）を Hackathon Release Approval の必須条件（release blocker）**、Pages は暫定 fallback のみ。AI-DLC Completion Approval と分離。
- **traceability.json**: infra 関連 NFRx.y（NFR6.x/NFR7.x/NFR9.x 等）を concrete resource/config へ対応。Coverage != Verification。

- Looks correct
- Request changes

[Answer]: Looks correct
