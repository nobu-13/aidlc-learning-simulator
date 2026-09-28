# RC2 Release Deployment Evidence — aidlc-learning-simulator

> RC2 (Learning Experience Upgrade) を既存 AWS 環境へ再 deploy した実施記録。**secret / access key / session token / account ID / role ARN / request ID 等の識別情報は記録しない。** 実際に確認できた内容のみ記載（推測補完なし）。Pre-RC2 deployment evidence（`03-release-deployment.md`）は上書きせず、本書を新規追加。

## 1. Release Context

- 対象: RC2（Know → Decide → **Create → Review** へ拡張した学習体験）。
- Human approval 後の Release 活動として実施（PR review → merge → AWS redeploy）。AI-DLC 工程完了承認と AWS Release Approval は分離。
- profile: **cb2027-dev**（SSO）/ region: **ap-northeast-1** / interface: Kiro + AWS CLI。
- **既存 Infrastructure を再利用**（CloudFront + private S3 + OAC + Response Headers Policy）。今回 **CloudFormation update は実施していない**。
- 許可された AWS mutation は次の 2 つのみ: 既存 private S3 への application asset sync、既存 CloudFront distribution の `/*` invalidation。

## 2. Deployed Source

- merged `main` commit: `e83a610e7d306f8e98ddcf148b51830ec09654ee`（PR #2 squash merge）
- PR: #2 `feat: upgrade AI-DLC learning experience for RC2`（MERGED）
- Pre-RC2 baseline tag `v0.1.0-pre-rc2`（→ `b3949e7e2dbdc223088339dc660fe4eb95772ddf`）は不変。
- 新しい release tag は未作成（Post-RC2 Live UX Audit 後に判断）。

## 3. Build Validation（merged main）

- `npm run typecheck`: PASS / `npm run lint`: PASS / `npm test`: **141 passed**（Pre-RC2 76 + 65）。
- `npm run build`: PASS。gzip 合計 約 **96.2 KB**（JS 93.09 + CSS 2.51 + HTML 0.63）で NFR 300 KB gzip 上限以下。
- 生成物: `dist/index.html` / `dist/assets/index-*.js` / `dist/assets/index-*.css`（計 3 object）。

## 4. Infrastructure Drift Check

- `git diff v0.1.0-pre-rc2..main -- deploy/cloudformation/static-site.yaml`: **差分なし**。
- `deploy/` ディレクトリ全体も差分なし。
- 判定: **Infrastructure 変更なし → Application deploy のみ実施**（CloudFormation update / IAM / OAC / Response Headers Policy / bucket / distribution の構成変更は行わない）。

## 5. Pre-deploy READ-ONLY Check

- authentication: SUCCESS（値は非記録）。region: ap-northeast-1。
- stack `aidlc-learning-simulator`: **CREATE_COMPLETE**。
- outputs（CloudFormation から取得。hard-code せず）:
  - BucketName: `aidlc-learning-simulator-sitebucket-b9vmc47zcxcw`（private）
  - DistributionId: `E1TCEJMOQTHT5Q`
  - PublicUrl: `https://d3htkxj6qo0vt2.cloudfront.net`

## 6. Application Deploy（S3 sync）

- `aws s3 sync dist/ s3://<bucket>/ --delete`（bucket は outputs から取得）。
- upload: `index.html` / `assets/index-aZ9Tt18r.js` / `assets/index-CgFnAgTv.css`。
- delete（Pre-RC2 の旧 asset を除去）: `assets/index-CG0cYVtk.js` / `assets/index-BDcxLWLB.css`。
- 同期後の bucket 内容: 上記 RC2 の 3 object のみ（ローカル dist とサイズ一致）。

## 7. CloudFront Invalidation

- distribution `E1TCEJMOQTHT5Q` に対し `/*` invalidation を作成。
- invalidation id: `I9Y2URQMNC6P207Q5SU84N4UIK` → **Completed**（wait で完了確認）。

## 8. Production Smoke Test（public URL: https://d3htkxj6qo0vt2.cloudfront.net）

| 確認項目 | 結果 |
|---|---|
| root `/` | **HTTP 200** / text/html / `<title>AI-DLC Learning Simulator</title>` / `id="root"` あり |
| root が参照する asset | **RC2 hash**（`/assets/index-aZ9Tt18r.js` / `index-CgFnAgTv.css`）= キャッシュ古い版でなく RC2 が live |
| JS asset | **HTTP 200** / text/javascript |
| CSS asset | **HTTP 200** / text/css |
| 予期しない 5xx | なし |
| Content-Security-Policy | ✅ `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| Strict-Transport-Security | ✅ `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | ✅ `nosniff` |
| X-Frame-Options | ✅ `DENY` |
| Referrer-Policy | ✅ `no-referrer` |
| 存在しない static asset | **HTTP 403**（200/index.html へ丸めない = 成功偽装なし。private S3 + OAC の既定挙動を維持） |
| 旧 Pre-RC2 asset | **HTTP 403**（`--delete` で除去済み） |

## 9. RC2 UX Smoke（live bundle 検証）

application は client-side static SPA（単一 HTML entry + JS bundle）であり、画面遷移は server response を持たない。そのため live bundle（`/assets/index-*.js`）に RC2 UX の各機能が含まれることを確認した。加えて、この deploy 対象 commit（`e83a610e`）に対する 141 integration test が全 UX flow（Home / 3 mode / Guided 開始 / DP1 Feedback / Result Dashboard / Reflection / Practice Library / Requirement Practice / Evidence Review / Adoption Workshop / ja-en 切替 / reload restore）を検証済み。

live bundle に含まれることを確認した RC2 UX marker:

| UX 項目 | 確認 |
|---|---|
| Home（Guided 開始 CTA） | ✅ `home.cta.start` |
| 3 Mode | ✅ `mode.guided` / `mode.simulation` / `mode.adoption-review` |
| Guided 差別化（概念先出し） | ✅ `concept-preview` |
| DP1 / option 別 Feedback | ✅ `feedback-card` / `feedback.status.recommended` |
| Result Dashboard | ✅ `result.dashboard.title` |
| Decision Timeline | ✅ `result.timeline.title` |
| Reflection（mode 別） | ✅ `reflection.practicalQuestion` |
| Practice Library | ✅ `practice.nav.title` |
| Requirement Practice | ✅ `practice.req.title` |
| Evidence Review Practice | ✅ `practice.ev.title` |
| Adoption Workshop | ✅ `adoption.workshop.title` / `ws-` inputs |
| Lifecycle Stepper | ✅ `stepper.title` |
| ja / en | ✅ `要件の明確さ` / `Requirement clarity` / `lang-select` |
| reload restore | ✅ `resume.banner`（progress persistence 復元 UI） |

## 10. Known Limitations（正直に記録）

- 存在しない static asset は **403**（404 ではない）: CloudFront + OAC + private S3 の既定挙動。「error を成功に見せない」hard requirement は充足。理想の 404 化は Pre-RC2 と同じく **Known Gap**（本 RC2 でも未変更）。
- RC2 UX の interactive smoke は、static SPA の性質上 public URL への HTTP request では画面操作を再現できない。live bundle の marker 検証 + 同一 commit に対する 141 integration test で担保している。ブラウザ実機での目視 UX 確認・最終 mobile 実機確認は本記録の範囲外（Post-RC2 Live UX Audit で実施予定）。
- accessibility は axe（critical/serious ゼロ）で確認済みだが、支援技術での実測・専門家レビューは未実施。

## 11. AWS Mutation Summary（今回実施した変更）

- ✅ 既存 private S3 bucket への RC2 application asset sync（`--delete`）。
- ✅ 既存 CloudFront distribution の `/*` invalidation。
- ❌ CloudFormation update: 実施せず（Infrastructure 差分なし）。
- ❌ IAM / OAC / Response Headers Policy / bucket / distribution の構成変更: 実施せず。

## 12. Evidence Policy

- secret / access key / session token / account ID / role ARN / request ID の値は本書に記録していない。
- bucket 名 / distribution id / public URL は Pre-RC2 evidence（`03-release-deployment.md`）で既に公開済みの非機密識別子であり、CloudFormation outputs から取得した実値。
- Pre-RC2 deployment evidence は上書きしていない。

## Sources
- merged `main` `e83a610e...`（PR #2）
- `deploy/cloudformation/static-site.yaml`（今回未変更）
- `docs/rc2-implementation-summary.md`（RC2 変更内容・Self Audit）
- `evidence/hackathon/03-release-deployment.md`（Pre-RC2 deployment・本書はその後続）
