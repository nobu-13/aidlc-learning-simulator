**Reviewer:** aidlc-architecture-reviewer-agent

**Verdict:** READY
**Date:** 2026-09-26T00:50:00Z
**Iteration:** 1
**Class:** advisory
**Unit:** aidlc-learning-simulator-web
**Reviewed artifact:** construction/aidlc-learning-simulator-web/infrastructure-design/cicd-pipeline.md（併せて infrastructure-specification.md / monitoring-design.md / traceability.json の整合を確認）

**検証結果**

1. CI/deploy 分離・OIDC 短期 credential・least-privilege（app deploy role に CFN 更新権限を混ぜない・CI job は contents:read で id-token:write なし・app deploy job のみ id-token:write）・OIDC trust policy（provider/aud=sts.amazonaws.com/repo/branch or Environment 限定）は技術的に妥当・self-contradiction なし。
2. rollback（previous successful commit / immutable CI artifact を source of truth、再 build のみ非依存、artifact→S3→invalidation→smoke）は妥当。
3. CloudFront+OAC+Private S3 REST origin（website endpoint 不使用）は OAC と website endpoint の非互換を正しく処理（Block Public Access ON・bucket policy は OAC service principal のみ）。SPA fallback は path routing 時のみに限定。CloudFormation・Response Headers Policy を security header の source of truth とする方針も正しい。
4. security 整合（no-network posture・secret=0 の OIDC・CSP header(AWS full) vs Pages meta best-effort(frame-ancestors 不可)の差異 document・NFR7.x）に矛盾なし。
5. monitoring は no-network posture と整合、client error visibility / CloudFront・S3 標準メトリクス / CI Lighthouse・bundle / post-deploy smoke に限定され過不足なし。
6. traceability.json は valid JSON、upstream 11 件を漏れなく coverage 対応、非 infra NFR・service infra の N/A justification 妥当、Coverage != Verification 明記。

**Findings（advisory・非ブロッキング）**

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | traceability.json NFR7.6 と cicd-pipeline.md CI | NFR7.6 の coverage target が「CI に Dependabot/npm audit を組み込み」を根拠にするが cicd-pipeline.md の CI ステップ・Stage→Gate 表に dependency scan が明記されず参照先が artifact に存在しない | cicd-pipeline.md の CI に dependency scan（npm audit/Dependabot）ステップを明記し traceability と一致させる | New |
| R-02 | Minor | infrastructure-specification.md SPA fallback | 403/404→index.html を navigation route に限定する意図が未記述で、static asset の実 404 まで 200 に丸めうる副作用の扱いが曖昧 | SPA fallback を document/navigation route に限定し、static asset の 404 は 404 のまま返す旨を明記 | New |
| R-03 | Minor | cicd-pipeline.md OIDC trust policy | OIDC trust policy の sub claim 具体形（完全一致 vs wildcard、Environment 境界推奨）が設計値として未固定 | sub claim の形（repo:owner/repo:environment:production 等の完全一致を推奨）を設計値として明記 | New |

**Validation Tool Results**

| Tool | Result | Interpretation |
|---|---|---|
| json-parse traceability.json | PASS | valid JSON。upstream 11 件・coverage 11 件・差分ゼロ |
| coverage-vs-upstream | PASS | infra 関連 NFRx.y（NFR6.x/7.1/7.4/7.6/7.7/7.8/9.x）が coverage に 1:1 対応 |
| OAC/website-endpoint 非互換 | PASS | Private S3 REST origin + OAC で website endpoint を使わない設計が正しい |
| least-privilege 分離 | PASS | app deploy role に CFN 更新権限を混ぜず、CI に id-token 不要、deploy job のみ id-token:write |

**Summary**: cicd-pipeline は CI/deploy 分離・OIDC 短期 credential・least-privilege・rollback source of truth が技術的に妥当。infrastructure-specification の OAC+Private S3 REST・monitoring の no-network 整合も確認。Critical/Major なし、Minor 3 件（R-01 dependency scan 明記・R-02 SPA fallback の route 限定・R-03 OIDC sub claim 固定）は実装可能性を損なわない。評定: READY（advisory）。
