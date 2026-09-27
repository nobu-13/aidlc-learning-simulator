# AWS Release Process Notes — aidlc-learning-simulator

> Hackathon 提出 / Builder Center 記事 / LT / 技術記事で再利用するための、AWS Release 過程の事実ベース記録。**secret / access key / session token / account ID / email / role ARN / request ID 等の識別情報は含めない。** 実際に確認できた内容のみ記載（推測補完なし）。新規 AWS 操作は行っていない（本書はファイル生成のみ）。
>
> 正本（詳細）: `evidence/hackathon/02-release-readonly-preflight.md` / `evidence/hackathon/03-release-deployment.md`。本書はそれらを要約し、failure → diagnosis → fix → successful release の流れを再現可能にするための記録。

## 1. Release Context

- **AI-DLC classic workflow は Build and Test まで完了済み**（17/17 stages）。AWS Release はその **workflow 外**の、**human-approved Release activity** として実施した。
- AI-DLC 工程完了承認と AWS Release Approval を分離（workflow completion ≠ production change authorization）。
- profile: **cb2027-dev**（SSO） / target region: **ap-northeast-1**
- interface: **Kiro + AWS CLI**、**AWS MCP Server 接続済み**
- 実 AWS resource の作成・変更前に毎回 human の明示承認を取得。
- secret / access key / session token / account ID / role ARN 等は記録しない方針で全工程を実施。

## 2. READ-ONLY Preflight（要約・正本: 02-release-readonly-preflight.md）

- authentication: SUCCESS、region: ap-northeast-1（値は非記録）。
- 既存 resource 競合確認: CloudFormation stack は SAM bootstrap（`aws-sam-cli-managed-default`）のみで本 Release と競合なし。S3 / CloudFront / OAC / Response Headers Policy に aidlc/simulator 名の競合なし。
- IaC 検証: **cfn-lint PASS（0 findings）** / **CloudFormation validate OK**。
- GitHub OIDC provider / infra role / app deploy role は **未構成**（本 manual Release には不要と判断）。

## 3. Initial Provision Attempt

- CloudFormation stack `aidlc-learning-simulator`（ap-northeast-1）を create。
- **初回 stack creation は ROLLBACK_COMPLETE**（作成途中で 1 resource が失敗し全体ロールバック）。
- 既存 AWS resource への影響なし（新規 stack 内のリソースのみが対象で、それらはロールバックで巻き戻し）。

## 4. Failure Investigation

- root cause は **CloudFormation stack events** から確認した（推測ではなく実イベントに基づく）。
- **root cause**: CloudFront **Response Headers Policy** で **Content-Security-Policy を CustomHeader として設定**していたため、CloudFront service 側の validation で **InvalidRequest**（CSP は security header であり custom header として設定不可）。
- failure は隠さず記録。識別情報（account ID / request ID 等）は記録しない。

## 5. Recovery

- **修正**: Content-Security-Policy を `CustomHeadersConfig` から **`SecurityHeadersConfig.ContentSecurityPolicy`** へ移動。
- 修正後の検証: cfn-lint PASS / CloudFormation validate OK。
- ロールバック済み（空の）stack を削除してから、修正 template で **再作成/再実行**。
- 結果: **stack status = CREATE_COMPLETE**。
- 正常作成された 5 resource: **Private S3 / OAC / CloudFront Distribution / Response Headers Policy / Bucket Policy**。
  - Private S3: Block Public Access ON・SSE・Versioning・TLS-only deny・DeletionPolicy Retain。
  - Bucket Policy: 当該 CloudFront distribution の `aws:SourceArn` のみ許可（confused-deputy 対策）。

## 6. Application Deployment

- `dist/`（本番 build 成果物）を **private S3 bucket へ sync**。
- upload object: **index.html / assets の JS / assets の CSS**（計 3 object）。
- **CloudFront invalidation `/*`** を実行 → **Completed** を確認。
- **public CloudFront URL で application を確認**（下記 smoke）。

## 7. Post-deploy Smoke Test（public URL に対して確認済み）

| 確認項目 | 結果 |
|---|---|
| root `/` | HTTP 200（text/html、title「AI-DLC Learning Simulator」、`id="root"` 存在） |
| JS asset | HTTP 200（text/javascript） |
| Content-Security-Policy | 付与確認（`default-src 'self'; connect-src 'self'; …; frame-ancestors 'none'`） |
| Strict-Transport-Security | 付与確認（`max-age=31536000; includeSubDomains`） |
| X-Content-Type-Options | 付与確認（`nosniff`） |
| X-Frame-Options | 付与確認（`DENY`） |
| Referrer-Policy | 付与確認（`no-referrer`） |

## 8. Known Gaps（正直に記録）

- **存在しない static asset は HTTP 403**（CloudFront + OAC + private S3 構成の既定挙動）。
- index.html へ 200 rewrite していないため、「**error を成功に見せない**」という hard requirement は満たしている。
- **理想の 404 化は MVP では未実施**（404 化には `s3:ListBucket` 付与または CloudFront custom error response が必要）。
- **GitHub OIDC / CI roles は今回の manual Release では未構築**。
- CI 自動化時は **infra role / app deploy role を分離**する方針を維持（app deploy role は S3 deploy + CloudFront invalidation に最小化）。

## 9. Evidence Policy

- `01-kiro-aws-mcp-connection.png`: 現時点で確定した **Hackathon 提出候補 Evidence**。
- 今回取得した CloudFormation rollback / recovery / deploy 等のスクリーンショット・出力は **Process Evidence（途中経過の証跡）** として保管する。
- **最終機能版の完成後に、Hackathon 提出用として deploy / live application の Evidence を改めて取得する**（本 Process Evidence とは区別する）。
- 現在の Process Evidence は **削除せず**、Builder Center 記事 / LT / 技術記事で **failure/recovery story** として再利用可能とする。

## 10. Final Release Evidence Checklist（最終版 deploy 時に改めて取得する TODO）

- [ ] Kiro からの最終 CloudFormation deploy
- [ ] Kiro からの最終 application deploy
- [ ] （必要なら）failure/recovery の代表 1 枚
- [ ] 最終 CloudFront public URL で動く application
- [ ] （任意）CloudFront Console の live infrastructure 1 枚

## 11. Key Learning

- **IaC の静的検証（cfn-lint）や CloudFormation validate が通っても、AWS service 側の semantic validation で失敗する場合がある**（例: CSP を custom header に置けない）。静的 lint と service-side の受理は別レイヤー。
- **CloudFormation failure 時は stack events を Evidence として root cause を切り分ける**（推測しない）。
- **failure → diagnosis → fix → redeploy を記録すること自体が、Agentic Engineering の有用な Evidence** になる（うまくいった結果だけでなく、切り分け過程が再現可能性と信頼性を示す）。
- **AI-DLC completion と AWS Release Approval を分離**したことで、workflow completion と production change authorization を混同せずに進められた（Release は人間承認による別活動）。

## Sources（本書が要約する正本）
- `evidence/hackathon/02-release-readonly-preflight.md`
- `evidence/hackathon/03-release-deployment.md`
- `evidence/hackathon/01-kiro-aws-mcp-connection.png`（提出候補 Evidence）
- `deploy/cloudformation/static-site.yaml`（IaC）
