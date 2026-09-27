# AWS Release Deployment Evidence — aidlc-learning-simulator

> Post-AI-DLC Release 活動（Option 1）の provision + deploy 実施記録。secret 非露出（credential / access key / session token / account ID / role ARN の値は記録しない）。AI-DLC の状態・成果物は未変更。

## 実行日時・構成
- 2026-09-26
- profile: cb2027-dev（SSO）/ region: ap-northeast-1 / interface: Kiro + AWS CLI（+ aws-mcp 接続確認済み）
- IaC: `deploy/cloudformation/static-site.yaml`（cfn-lint PASS / CFN validate OK）

## Provision（CloudFormation）
- stack: `aidlc-learning-simulator`（ap-northeast-1）／status: **CREATE_COMPLETE**
- 初回 create は ROLLBACK（root cause: CSP は Response Headers Policy の CustomHeader に設定不可 → `SecurityHeadersConfig.ContentSecurityPolicy` へ移動して修正・再作成）。
- 作成リソース: Private S3（BPA ON・SSE・Versioning・BucketOwnerEnforced・TLS-only deny・Retain）/ OAC（sigv4）/ CloudFront Distribution / Response Headers Policy / Bucket Policy（当該 distribution の `aws:SourceArn` のみ許可）。
- named IAM リソースなし。secret なし。

## Outputs
- Bucket: `aidlc-learning-simulator-sitebucket-b9vmc47zcxcw`（private）
- DistributionId: `E1TCEJMOQTHT5Q`
- **Public CloudFront URL: https://d3htkxj6qo0vt2.cloudfront.net**

## Application deploy
- `aws s3 sync dist/ s3://<bucket>/ --delete`：3 objects（index.html / assets/index-*.js / assets/index-*.css）アップロード。
- CloudFront invalidation `/*`（id: IANNHX1BIH6O35N3JDCQ3ZTJOP）：**Completed**。

## Post-deploy smoke（public URL に対する検証）
| 確認 | 結果 |
|---|---|
| root `/` | **HTTP 200** / text/html / `<title>AI-DLC Learning Simulator</title>` / `id="root"` あり |
| JS asset `/assets/index-*.js` | **HTTP 200** / text/javascript |
| Content-Security-Policy header | ✅ `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| Strict-Transport-Security | ✅ `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | ✅ `nosniff` |
| X-Frame-Options | ✅ `DENY` |
| Referrer-Policy | ✅ `no-referrer` |
| 存在しない static asset | **HTTP 403**（index.html へ rewrite されない＝200 に丸めない・spec の hard requirement 充足） |

## 所見（正直な記録）
- **存在しない static asset が 403（404 ではない）**: CloudFront + OAC + Private S3 の既定挙動（S3 が `s3:ListBucket` 非付与時に欠損キーを 403 で返す）。spec の hard requirement「404 を 200（index.html）に丸めない」は**充足**（403 のまま・成功偽装なし）。理想は 404 だが、404 化には bucket policy への `s3:ListBucket` 追加 or CloudFront custom error response（403→404 変換）が必要で、MVP では未実施の **Known Gap** とする。error を成功に見せない要件は満たしている。
- GitHub OIDC / CI role は未作成（本手動 Release には不要。CI 自動化時に別タスクで infra/app role の boundary 分離を維持して構築）。

## Hackathon Evidence readiness（secret 非露出）
- ✅ Kiro が AWS へ接続し（cb2027-dev / ap-northeast-1）、CloudFormation provision + S3 deploy + CloudFront invalidation を実行。
- ✅ AWS 上で application が live（public CloudFront URL で 200・実 HTML/JS 配信）。
- ✅ public CloudFront URL 提示: https://d3htkxj6qo0vt2.cloudfront.net
- ✅ 手順・出力に access key / secret / session token / account ID / role ARN の値を含めない。
- ✅ AI-DLC 工程完了承認 ≠ AWS Release Approval：本 Release は AI-DLC classic workflow 完了後の、人間承認による別活動として実施。

## ロールバック / 運用メモ
- ロールバックは「以前の build artifact を S3 へ再 sync + invalidation」。S3 Versioning 有効。
- stack は `DeletionPolicy: Retain`（S3/distribution は誤削除保護）。撤去時は明示手順で対応。
