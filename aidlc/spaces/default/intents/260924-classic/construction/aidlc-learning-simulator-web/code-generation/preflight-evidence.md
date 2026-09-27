# AWS/Kiro Preflight Evidence — U1: aidlc-learning-simulator-web

> Code Generation §3（Option B / 案X）の READ-ONLY preflight。Approve Plan 後・Step 1 コード生成前に、最終構成で一気通貫再実行。**secret 非露出**（access/secret key・session token・credential・account ID・role ARN は出力・記録しない）。AWS resource の作成・変更・削除なし。Code Generation plan 本体は変更していない。

## 1. 実行日時

- 2026-09-26（Approve Plan 記録後、同一セッション・同一条件で一気通貫実行）

## 2. 使用構成

- **Kiro**（development-time agent host）
- **Agent Toolkit for AWS Skills**（Kiro skills 経由：aws-cloudformation / aws-storage / aws-networking / aws-iam / aws-deployment / aws-security）
- **AWS MCP Server**（AWS-managed）: endpoint `https://aws-mcp.us-east-1.api.aws/mcp`、`mcp-proxy-for-aws-cli` 経由、`~/.kiro/settings/mcp.json` の `aws-mcp`
- **profile**: `cb2027-dev`（SSO）
- **target region**: `ap-northeast-1`（Tokyo）／AWS MCP metadata `AWS_REGION=ap-northeast-1` と整合
- 補助: AWS Documentation MCP（`aws-docs`、workspace `.kiro/settings/mcp.json`）は **doc 参照専用**に役割限定。primary interface は AWS MCP Server。

## 3. PF1〜PF6 結果

| 項目 | 判定 | 確認方法 | secret-free Evidence 概要 |
|---|---|---|---|
| **PF1** Kiro ↔ AWS MCP Server | **PASS** | AWS MCP tool `list_regions` を呼び出し（READ-ONLY） | `aws-mcp` server が接続済みで応答。AWS 全 region 一覧を返却（`ap-northeast-1` 含む）。endpoint は AWS-managed（`aws-mcp.us-east-1.api.aws`）。AWS 変更操作なし。 |
| **PF2** Agent Toolkit for AWS Skills | **PASS** | 指定 6 領域の Skill availability を確認。`aws-cloudformation` と `aws-iam` を実ロードして到達性を実証。他 4 領域（aws-storage/aws-networking/aws-deployment/aws-security）は同一 skills registry に available | 6 Skill いずれも利用可能。CFN/IAM Skill は AWS MCP `call_aws` 連携・secure default・least-privilege guidance を提供。**availability のみ確認、実装変更には未使用。存在しない Skill 名は作っていない。** |
| **PF3** AWS identity / profile / region | **PASS** | `aws sts get-caller-identity --profile cb2027-dev`（成功/失敗のみ記録）、`aws configure get region --profile cb2027-dev` | `cb2027-dev` 経由の READ-ONLY API アクセス成功。default operation region = `ap-northeast-1`（profile・default とも一致）。AWS MCP metadata の region 設定とも整合。**identity/account/ARN の値は記録せず success のみ。** |
| **PF4** AWS official information readiness | **PASS** | CloudFormation/S3/CloudFront/IAM の公式情報到達を Agent Toolkit Skills（aws-cloudformation/aws-iam）で確認。AWS MCP `search_documentation`/`get_regional_availability` は AI-DLC guard に block されたため、READ-ONLY 代替（Skills + `web_fetch` で awslabs 公式）を使用 | CFN/S3/CloudFront/IAM の公式 guidance・best practice へ到達可。実装時は model knowledge のみで判断せず AWS MCP / Skills / official info を優先参照する方針を確認。AWS Documentation MCP は doc 参照専用、AWS MCP Server を primary とする。 |
| **PF5** permission readiness | **PASS** | `cb2027-dev` で READ-ONLY probe: `cloudformation list-stacks` / `s3api list-buckets` / `cloudfront list-distributions` / `list-response-headers-policies` / `list-origin-access-controls` / `iam list-roles` / `iam list-open-id-connect-providers`（すべて list/describe） | 全 probe SUCCESS。後続 Operation に必要な CloudFormation / S3 / CloudFront / OAC / Response Headers Policy / IAM・GitHub OIDC の構築準備を READ-ONLY で評価可能。**resource 作成・IAM 変更・deploy は未実施。** human/bootstrap 権限と将来の infra role（CFN/IAM 担当）・app deploy role（S3 deploy + CloudFront invalidation 中心）は別物として扱う。role 未作成は FAIL 理由にしない。 |
| **PF6** Hackathon Evidence readiness | **PASS** | 本ファイル自体が secret-free Evidence 手順の実例。各 PF の確認手順を再現可能な形で記録 | 残せる状態を確認: (a) Kiro で AWS MCP Server 接続済み、(b) Agent Toolkit Skills 利用可能、(c) Kiro から AWS API へ READ-ONLY アクセス可能、(d) profile=`cb2027-dev`、(e) target region=`ap-northeast-1`、(f) 後続 Operation で deployment Evidence 取得可能、(g) 最終的に public CloudFront URL を提示可能、(h) 手順に secret を含まない。 |

## 4. guard により block された確認と代替 READ-ONLY 方法

- **block 内容**: AWS MCP の parameterized tool（`search_documentation`、`get_regional_availability`）は AI-DLC の Plan Approval guard に「mutation-capable payload whose target path is missing or unsupported」として block された（`list_regions` は通過）。これは AI-DLC guard の保守的分類であり、**AWS 側の失敗ではない**（Human 指示どおり FAIL 扱いにしない）。
- **代替 READ-ONLY 方法**:
  - PF4 の公式情報到達は **Agent Toolkit Skills（aws-cloudformation/aws-iam を実ロード）** と `web_fetch`（allowlist）で確認。
  - PF3/PF5 の identity・権限確認は **AWS CLI（`cb2027-dev`, READ-ONLY list/describe）** で確認（guard は approval 済み unit の shell を許可）。
  - PF1 は AWS MCP `list_regions`（引数なし）で接続実証。

## 5. 総合判定

**AWS/Kiro preflight: READY**

PF1〜PF6 すべて PASS。primary interface（Kiro + Agent Toolkit for AWS Skills + AWS MCP Server + `cb2027-dev` SSO / `ap-northeast-1`）の development 環境が同一セッション・同一条件で成立していることを確認。guard による一部 AWS MCP tool の block は Human 指示に従い FAIL 扱いとせず、READ-ONLY 代替で確認済み。

→ Code Generation Step 1 へ進む。実 CloudFormation provision / application deployment は方針どおり Operation で実施（AI-DLC 完了承認 ≠ AWS Release Approval）。

## 6. 実施しなかったこと（方針どおり）

- credential / access key / secret key / session token / account ID / role ARN の出力・保存・Evidence 化：**していない**。
- prod resource（CFN stack / S3 / CloudFront / OAC）作成・deployment・IAM 変更：**していない**（Operation で実施）。
- Code Generation plan 本体（`code-generation-plan.md`）の変更：**していない**（承認 fingerprint 維持）。

## Sources

- `~/.kiro/settings/mcp.json`（`aws-mcp` = AWS-managed MCP Server, proxy, profile cb2027-dev, region ap-northeast-1）, `.kiro/settings/mcp.json`（`aws-docs` = doc 参照専用）。
- AWS MCP tool `list_regions`（PF1）。
- Agent Toolkit Skills: `aws-cloudformation`, `aws-iam`（PF2/PF4、実ロードで到達性実証）。他 4 skill は registry 上 available。
- AWS CLI READ-ONLY（`cb2027-dev`）: `sts get-caller-identity` / `configure get region` / `cloudformation list-stacks` / `s3api list-buckets` / `cloudfront list-distributions` / `list-response-headers-policies` / `list-origin-access-controls` / `iam list-roles` / `iam list-open-id-connect-providers`（PF3/PF5、値は非記録）。
