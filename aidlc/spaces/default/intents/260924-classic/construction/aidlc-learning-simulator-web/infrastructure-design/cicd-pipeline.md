# CI/CD Pipeline — U1: aidlc-learning-simulator-web

> 配信 pipeline 設計（GitHub Actions 前提、team practice）。設計レベル（workflow 実装は code-generation、実 deploy は Operation）。**Infrastructure deployment（CloudFormation）と Application deployment（asset 配信）を分離**する。credential は **GitHub OIDC 短期 credential**（stored AWS deployment secret = 0）。

## Pipeline 全体像

3 つの pipeline に分ける:
1. **CI（quality）** — PR/main 共通。品質ゲート。
2. **Infrastructure deployment** — CloudFormation stack。頻繁に自動適用せず workflow_dispatch / Operation の承認済み実行。
3. **Application deployment** — CI 成功後、main merge で asset を配信。

## 1. CI（quality pipeline）

PR と main で共通に走る。ステップ（順序）:

1. checkout
2. dependency install（lockfile 固定・`npm ci` 相当）
3. **dependency security check**（`npm audit`。production dependency の high/critical を原則対応対象。例外は `security-requirements.md`「dependency 例外の記録」ルールに従う。Dependabot は継続的な dependency update mechanism として有効化）
4. lint（ESLint）
5. typecheck（tsc --noEmit）
6. unit / domain tests（Vitest、`--passWithNoTests=false`）
7. fixture / schema tests（全 `/scenarios/*.json` の健全性・malformed 検出）
8. accessibility automated tests（axe critical/serious=0・user-event の keyboard）
9. production build（Vite）

| Stage | Gate |
|---|---|
| dependency security（npm audit） | production dependency の high/critical を原則対応（例外は記録ルールに従い許容）。Dependabot 継続 |
| lint | ESLint error = 0（fail で merge ブロック） |
| typecheck | TypeScript error = 0 |
| tests（unit/domain/fixture/a11y） | すべて pass（未実行を成功扱いしない） |
| build | production build 成功 |
| Lighthouse / bundle size | regression visibility ＋ 300KB budget monitoring（**noisy hard gate にしない**、可視化・監視主体） |

- 権限: CI job は `contents: read`（`id-token: write` 不要）。
- 決定性テスト（同一入力→同一結果・順序不変性・time/random 静的排除）を tests に含む。

## 2. Infrastructure deployment（CloudFormation・app deploy と分離）

- 対象リソース: S3・CloudFront・OAC・ResponseHeadersPolicy・bucket policy・deploy 用 IAM/OIDC 構成。
- 実行: 頻繁に自動適用せず、**workflow_dispatch または Operation での承認済み実行**を基本。
- 初回 AWS infra/deploy は **Kiro → AWS 操作が確認できる形で Operation 時に実施・記録**（Hackathon Evidence）。
- 権限: CloudFormation stack 更新に必要な権限は **infrastructure role** に限定し、**application deploy role には CFN 更新権限を混ぜない**。

## 3. Application deployment（asset 配信）

フロー（main merge + CI 成功 → 配信）:

1. main への merge（CI 成功が前提）
2. GitHub OIDC → AWS STS で **short-lived credential** を取得（stored AWS key なし）
3. S3 upload / sync（build 成果物）
4. CloudFront invalidation（対象 distribution）
5. post-deploy smoke test（root 200 / asset / Core 開始 / security headers / SPA fallback）

- **Application deploy role の権限（最小）**: target bucket への必要な S3 upload、（sync で delete 使用時のみ）DeleteObject、必要な ListBucket、対象 CloudFront distribution への CreateInvalidation。**CFN 更新権限は含めない**。
- **GitHub OIDC trust policy（設計値）**: GitHub OIDC provider を信頼。`aud = sts.amazonaws.com` を **exact match**。`sub` を **exact match** で固定する:
  - GitHub Environment `production` を使う場合（第一候補）: `sub = repo:<owner>/<repo>:environment:production`
  - Environment を使わず main branch 限定の場合: `sub = repo:<owner>/<repo>:ref:refs/heads/main`
  - **`repo:<owner>/*` 等の広い wildcard は使用しない**（repository を固定し、production Environment または main branch を固定）。
  - **Infrastructure role と Application deploy role は別 trust / permission boundary** を維持（sub/permission を分ける）。
  - 実際の `<owner>/<repo>` は code-generation 時の repository 設定から確定し、設計文書では placeholder（`<owner>/<repo>`）と実値の対応を明記する。
- 権限: application deploy job のみ `id-token: write`（OIDC）＋上記最小 deploy 権限。CI job には付与しない。
- GitHub Pages 配信（審査後/暫定 fallback）は別 workflow/job で `GITHUB_TOKEN`（least-privilege）を使う。

## 4. Rollback

- rollback の source of truth は **previous successful Git commit / immutable CI artifact**。
- 成功 build artifact を CI artifact として一定期間保持し、**同じ artifact を再 deploy** できるようにする（再 build のみ依存は dependency/build 環境差で完全再現できない可能性があるため）。
- rollback フロー: previous successful artifact → S3 deploy → CloudFront invalidation → smoke test。
- 補助: S3 Versioning を有効化してもよい（ただし source of truth は artifact/commit）。

## 5. Secrets management（CI/CD）

- **application secret = 0 / stored AWS deployment secret = 0**（OIDC 短期 credential）。
- role ARN 等の identifier は configuration であり secret として扱わない。
- `GITHUB_TOKEN` は workflow runtime 提供の短期 token として least-privilege で利用。
- Evidence 公開時は secret でなくても AWS account ID / role ARN 等を不要ならマスク。

## Stage → Gate マップ

| Pipeline | Stage | Gate / 条件 | 権限 |
|---|---|---|---|
| CI | dependency security（npm audit） | production high/critical 原則対応（例外は記録ルール） | contents:read |
| CI | lint/typecheck/tests/build | 全 pass で merge 可 | contents:read |
| CI | Lighthouse/bundle | regression 監視（非 hard gate） | contents:read |
| Infra deploy | CloudFormation stack | workflow_dispatch/Operation 承認 | infrastructure role（CFN 権限） |
| App deploy | S3 sync + CF invalidation | CI 成功 + main merge、smoke pass | OIDC 短期 + 最小 deploy 権限（id-token:write） |
| App deploy | post-deploy smoke | root 200 等が pass しなければ成功としない | 同上 |

## 承認境界（重要）

- **AI-DLC Completion Approval**（本 workflow の完了）と **AWS Release Approval**（本番公開判断）は分離（C6）。
- AWS deployment（成功 + public CloudFront URL + Kiro→AWS connection/deployment evidence）は **Hackathon Release Approval の必須条件（release blocker）**。GitHub Pages は AWS 失敗時の development/demo continuity 用の暫定 fallback のみで final substitute にしない。

## Sources
- consumes: `../nfr-requirements/security-requirements.md`（NFR7.6/7.7）, `../nfr-design/security-design.md`（CSP/CI 権限）, `../nfr-requirements/performance-requirements.md`（NFR9 CI 可視化）, team.md（Testing Posture/Deployment/CI）。
- handoff: code-generation（GitHub Actions workflow・CloudFormation テンプレート）、Operation（実 deploy・smoke・evidence）。
