# AWS Release READ-ONLY Preflight — aidlc-learning-simulator

> Post-AI-DLC Release 活動（Option 1）の provision 前 READ-ONLY 確認。secret 非露出（credential / access key / session token / account ID / role ARN の値は記録しない）。AWS resource の作成・変更なし。AI-DLC の状態・成果物は未変更。

## 実行日時・構成
- 2026-09-26（cb2027-dev 再認証後）
- profile: cb2027-dev（SSO）/ region: ap-northeast-1 / interface: AWS CLI（read-only）+ 補助 aws-mcp

## READ-ONLY 確認結果

| 項目 | 結果 |
|---|---|
| identity / auth | SUCCESS（値は非記録） |
| region | ap-northeast-1 |
| 既存 CloudFormation stack（ap-northeast-1・active） | `aws-sam-cli-managed-default` のみ（本 Release と競合しない SAM bootstrap） |
| 既存 S3 bucket（aidlc/learning/simulator 名） | なし（競合なし） |
| 既存 CloudFront distribution（aidlc/simulator comment） | なし（競合なし） |
| 既存 OAC（aidlc） | なし |
| 既存 Response Headers Policy（aidlc・custom） | なし |
| GitHub OIDC provider（token.actions.githubusercontent.com） | **未構成** |
| IAM role（aidlc/simulator/infra-deploy/app-deploy） | **未作成** |
| CloudFormation template validate | OK（`validate-template` 成功） |
| READ-ONLY 権限（cfn validate / s3 list / cloudfront list / iam list-roles） | すべて OK |

## template 整合性
- `deploy/cloudformation/static-site.yaml` を承認済み `infrastructure-specification.md` に忠実に作成:
  - Private S3（Block Public Access ON・SSE・Versioning・BucketOwnerEnforced・TLS-only deny）
  - OAC（sigv4・always）、CloudFront（redirect-to-https・GET/HEAD・compression・DefaultRootObject index.html・CachingOptimized）
  - Response Headers Policy（CSP source of truth・nosniff・frame DENY・Referrer no-referrer・HSTS）
  - bucket policy は当該 distribution の `aws:SourceArn` のみ許可（confused-deputy 対策）
  - 全 403/404→index.html への rewrite なし（static-asset 404 は 404 のまま・spec どおり）
  - DeletionPolicy/UpdateReplacePolicy: Retain（stateful 保護）
- **cfn-lint: PASS（0 findings）** / **CFN service validate: OK**

## 所見（人間判断が必要な点）
- **GitHub OIDC / infra role / app-deploy role は未構成**。infrastructure-specification / cicd-pipeline は OIDC 短期 credential・stored secret=0 を想定するが、これは CI からのデプロイ自動化に必要なもの。**今回の手動 Release（Kiro→AWS, cb2027-dev SSO）による初回 provision/deploy には必須ではない**（後日 CI 自動化を組む際に別途構築）。
- 今回の provision/deploy は cb2027-dev SSO の権限で実施。CI OIDC role 構築は別タスクとして分離（infra-deploy と app-deploy の boundary 分離方針は維持）。

## 実施していないこと
- AWS resource の作成・変更・削除：なし（本書は read-only 確認のみ）。
- credential / secret の記録：なし。
- AI-DLC の workflow state / 成果物の変更：なし。
