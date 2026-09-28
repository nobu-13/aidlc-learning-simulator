# RC2 Stabilization Deployment Evidence — aidlc-learning-simulator

> RC2 Stabilization patch を既存 AWS 環境へ再 deploy した実施記録。**secret / access key / session token / account ID / role ARN / request ID の値は記録しない。** 実際に確認できた内容のみ記載（推測補完なし）。既存 Evidence（`03-`/`04-`）は上書きせず、本書を新規追加。新機能追加ではなく、Post-RC2 Live UX Audit で確認された Persistence / Navigation / Localization / Accessibility の修正の公開。

## 1. Release Context

- 内容: RC2 Stabilization（Resume / Workshop・Practice 永続 / note 分離 / feedback 番号 / logical Back / locale preview / a11y label）。**新しい Learning 機能は追加していない。**
- Human approval 後の Release 活動（PR #3 review → squash merge → AWS application redeploy）。
- profile: **cb2027-dev**（SSO）/ region: **ap-northeast-1** / interface: Kiro + AWS CLI。
- **既存 Infrastructure を再利用**（CloudFront + private S3 + OAC + Response Headers Policy）。**CloudFormation update は実施していない。**
- 許可された AWS mutation: 既存 private S3 への application asset sync、既存 CloudFront distribution の `/*` invalidation のみ。

## 2. Deployed Source

- merged `main` commit: `73d3d350af433cebb566a98e9bfd7cfb8d697e8b`（PR #3 squash merge）
- PR: #3 `fix: stabilize RC2 persistence and navigation`（MERGED, remote branch deleted）
- 直前 main（RC2 application）: `fe48d89a5606e6fb2bce256845f1588309dc9e41`
- Pre-RC2 baseline tag `v0.1.0-pre-rc2`（→ `b3949e7e...`）は不変。新しい release tag は未作成。

## 3. Infrastructure Drift Check

- `git diff fe48d89..main -- deploy/`: **差分なし**。
- 判定: **Infrastructure 変更なし → Application deploy のみ実施**。CloudFormation / IAM / OAC / Response Headers Policy / bucket / distribution / cache policy の変更は行わない。

## 4. Build Validation（merged main）

- `npm run typecheck` / `npm run lint`: PASS。`npm test`: **159 passed**（RC2 141 + stabilization 18）。
- `npm run build`: PASS。gzip 合計 約 **97.2 KB**（JS 94.09 + CSS 2.51 + HTML 0.63）で NFR 300 KB 以下。
- 生成物: `index.html` / `assets/index-CdXZKL4P.js` / `assets/index-CgFnAgTv.css`。

## 5. Pre-deploy READ-ONLY Check

- authentication: SUCCESS（値は非記録）。region: ap-northeast-1。
- stack `aidlc-learning-simulator`: **CREATE_COMPLETE**。
- outputs（CloudFormation から取得。hard-code せず）:
  - BucketName: `aidlc-learning-simulator-sitebucket-b9vmc47zcxcw`（private）
  - DistributionId: `E1TCEJMOQTHT5Q`
  - PublicUrl: `https://d3htkxj6qo0vt2.cloudfront.net`

## 6. Application Deploy（S3 sync）

- `aws s3 sync dist/ s3://<bucket>/ --delete`（bucket は outputs 取得）。
- upload: `index.html` / `assets/index-CdXZKL4P.js` / `assets/index-CgFnAgTv.css`。
- delete（旧 RC2 asset 除去）: `assets/index-aZ9Tt18r.js`。
- 同期後 bucket 内容: 上記 stabilization 3 object のみ（ローカル dist とサイズ一致）。

## 7. CloudFront Invalidation

- distribution `E1TCEJMOQTHT5Q` に `/*` invalidation。id: `I4U5V39RK63GMSEC4ZD72EZ075` → **Completed**。

## 8. Basic Production Smoke（public URL）

| 確認 | 結果 |
|---|---|
| root `/` | **HTTP 200** / text/html / `<title>AI-DLC Learning Simulator</title>` / `id="root"` |
| root asset 参照 | **stabilization hash**（`/assets/index-CdXZKL4P.js` / `index-CgFnAgTv.css`）= 新 build が live |
| JS asset | **HTTP 200** / text/javascript |
| CSS asset | **HTTP 200** / text/css |
| 予期しない 5xx | なし |
| Content-Security-Policy | ✅ `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| Strict-Transport-Security | ✅ `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | ✅ `nosniff` |
| X-Frame-Options | ✅ `DENY` |
| Referrer-Policy | ✅ `no-referrer` |
| 存在しない static asset | **HTTP 403**（200 へ丸めない） |
| 旧 RC2 asset（削除済み） | **HTTP 403** |

## 9. Stabilization Smoke（A–I）

application は client-side static SPA（単一 HTML + JS bundle）で、画面遷移に server response が無い。そのため live bundle の内容検証 + 同一 commit（`73d3d35`）に対する 18 の stabilization/persistence 自動テストで担保する。

- **live bundle は local build と byte-identical**（cmp 一致）。deployed = tested build であることを確認。
- live bundle に各 A–I の実装 marker が存在:

| 項目 | 本番確認 | 対応 marker / test |
|---|---|---|
| A. Core Resume | ✅ | `home.continue.cta` + resume 実装 / `rc2-stabilization.test.tsx` Resume Core |
| B. Focus Resume | ✅ | 同 resume 実装 / Resume Focus test |
| C. Workshop persistence | ✅ | `workshopInputs`（schema v2）/ Workshop reload test |
| D. Requirement draft persistence | ✅ | `practiceDrafts` / Practice draft reload test |
| E. Decision note isolation | ✅ | per-DP note / note A/B/C tests |
| F. Feedback progress `1 / 4` | ✅ | `stepper-count` / feedback number test |
| G. Logical Back | ✅ | `nav-back-home` / practice→lib, result→Home, reflection→result tests |
| H. Locale preview state | ✅ | `adoption.workshop.staleNotice` / `outputLocale` / locale preview test |
| I. Workshop a11y names | ✅ | per-section `aria-label` / unique-names test |

## 10. Old-asset Reproduction Check

- **Not Reproduced.** 新規 request（cache-bust）6 回 + 通常 reload 3 回、計 9 回いずれも現行 `index.html` は現行 build asset（`index-CdXZKL4P.js`）を参照。旧 asset は返らなかった（`x-cache: Hit from cloudfront`、一貫）。
- 既知の原因（cache-timing）は `docs/rc2-stabilization-summary.md` §1 に記録済み。根本対策は `index.html` の `Cache-Control` 付与や cache policy 変更が必要で **Infrastructure 変更を伴うため今回未実施**（Human approval 対象・RC3 判断）。**CDN / cache policy は変更していない。**

## 11. AWS Mutation Summary

- ✅ 既存 private S3 への stabilization asset sync（`--delete`）。
- ✅ 既存 CloudFront distribution の `/*` invalidation。
- ❌ CloudFormation update / IAM / OAC / Response Headers Policy / bucket / distribution / cache policy 変更: 実施せず。

## 12. Known Limitations

- 旧 asset の一瞬表示は cache-timing 起因で、根本対策は infra 変更が必要（未実施）。
- semantic 品質評価（曖昧さ・測定可能性）は runtime AI 無しのため非対応（RC3）。
- accessibility は axe（critical/serious ゼロ）で確認済みだが、支援技術での実測は未実施。
- chip 選択式 Practice の途中選択は session-scoped（自由記述ではないため P1 とせず）。
- SPA の interactive UX の本番目視確認は本記録の範囲外（byte-identical build + 自動テストで担保）。

## 13. Evidence Policy

- secret / access key / session token / account ID / role ARN / request ID の値は記録していない。
- bucket 名 / distribution id / public URL は既存 Evidence で公開済みの非機密識別子で、CloudFormation outputs 由来の実値。
- 既存 Evidence（`03-` / `04-`）は上書きしていない。

## Sources
- merged `main` `73d3d35...`（PR #3）
- `deploy/cloudformation/static-site.yaml`（今回未変更）
- `docs/rc2-stabilization-summary.md`（修正内容・root cause・deferred）
- `evidence/hackathon/04-rc2-deployment.md`（RC2 application deploy・本書はその後続）
