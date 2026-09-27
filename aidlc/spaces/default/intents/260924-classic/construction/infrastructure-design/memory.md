<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-26T00:30:00Z — AWS static hosting は CloudFront + OAC + **Private S3 REST origin**（S3 Static Website Endpoint は OAC 非対応のため使わない）。SPA 403/404→index.html fallback は deep-link path routing を使う場合のみ。IaC は小規模構成のため CloudFormation を採用（CDK 不使用、直接レビュー可能・再現性）。
- 2026-09-26T00:30:00Z — security header は CloudFront Response Headers Policy を source of truth とし、GitHub Pages の meta CSP は best-effort（frame-ancestors 等は meta で適用不可なので header-only 保護との差異を document）。primary hosting は AWS。
- 2026-09-26T00:30:00Z — infra deploy(CloudFormation stack) と application asset deploy を分離。app deploy role は S3 upload/sync + CloudFront invalidation に最小化し CFN 更新権限を混ぜない。GitHub OIDC 短期 credential（stored AWS deployment secret=0）、CI job に id-token:write 不要・AWS deploy job のみ付与。rollback の source of truth は previous successful commit / immutable CI artifact（再 build のみ依存しない）。
- 2026-09-26T00:30:00Z — monitoring は no-network posture 下で runtime telemetry/APM を持たず、client error visibility(ErrorView/A11yLiveRegion/ErrorBoundary)+CloudFront/S3 標準メトリクス+post-deploy smoke verification に限定。

## Tradeoffs
- 2026-09-26T00:30:00Z — AWS deployment（成功 + public CloudFront URL + Kiro→AWS connection/deployment evidence）を Hackathon Release Approval の必須条件（release blocker）とする。GitHub Pages は AWS 失敗時の development/demo continuity 用の暫定 fallback のみで final substitute にしない。AI-DLC Completion Approval と AWS Release Approval は引き続き分離（C6）。
- 2026-09-26T01:00:00Z — advisory review iteration1=READY（Minor 3）を Request-Changes で反映。R-01 cicd-pipeline CI に dependency security check（npm audit・production high/critical 原則対応・Dependabot 継続）を step と Stage→Gate 表に明記し traceability NFR7.6 と一致。R-02 SPA fallback は全 403/404 無条件変換にしない: MVP は custom error response を使わないを第一候補、必要時のみ navigation/extensionless route のみ index.html rewrite、static asset(.js/.css/.json/画像) の 404 は 404 のまま（infrastructure-specification/monitoring smoke を整合）。R-03 OIDC sub claim を設計値化（Environment: repo:<owner>/<repo>:environment:production、main 限定: :ref:refs/heads/main の exact match、aud exact、wildcard 不使用、infra role と app deploy role は別 boundary、owner/repo は code-generation 時確定で placeholder 明記）。traceability 11/11 維持。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
