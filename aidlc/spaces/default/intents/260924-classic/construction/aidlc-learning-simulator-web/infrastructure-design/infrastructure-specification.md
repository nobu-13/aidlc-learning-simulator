# Infrastructure Specification — U1: aidlc-learning-simulator-web

> static SPA の配信インフラ設計（設計レベル。IaC 実装は code-generation、実 deploy は Operation）。IaC=CloudFormation。primary production/hackathon hosting は AWS。同一 application source を AWS と GitHub Pages へ（差異は hosting-specific configuration、NFR6.1）。

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | サーバレス静的配信（compute なし） | client-only static SPA。backend/API/Lambda なし（C2） |
| AWS origin | **Private S3 bucket（REST origin）** + CloudFront + OAC | OAC は S3 REST origin 前提（S3 Static Website Endpoint は OAC 非対応のため使わない）。Block Public Access ON・CloudFront 経由のみ読取 |
| CDN / edge | CloudFront（Viewer Protocol=Redirect HTTP to HTTPS or HTTPS Only、Default Root Object=index.html、GET/HEAD のみ、compression 有効） | HTTPS 配信・キャッシュ・security header 付与点 |
| SPA fallback | **MVP 第一候補: path-based deep-link routing を使わず custom error response による SPA fallback を設定しない**（最も単純・安全）。将来 path routing が必要になった場合のみ、document/navigation request・extensionless application route だけを `/index.html` へ rewrite（response 200） | **全 403/404 を無条件に index.html へ変換しない**。`.js`/`.css`/`.json`/image/font 等 static asset の不存在は **404 のまま**返す（404 を 200 に丸めない）。error caching TTL は短め |
| Alternate hosting | GitHub Pages（same application source + hosting-specific build/deploy config、Vite `base` 等） | 審査後の代替 hosting target。byte-identical artifact は要求しない・application logic の fork 禁止 |
| Networking topology | ingress=CloudFront(HTTPS) → S3 REST origin（OAC 署名）。egress なし | no-network posture（application data/user input を外部送信しない）。VPC/subnet なし（該当なし） |
| Storage strategy | S3 に build 成果物（immutable object）。localStorage は client 側（infra 対象外、ProgressStore が扱う） | 静的アセットのみ。DB/永続ストア（サーバ）なし |
| IaC approach | **CloudFormation**（S3 / CloudFront / OAC / ResponseHeadersPolicy / bucket policy / deploy IAM・OIDC 構成） | 小規模構成で CDK bootstrap 等の複雑性不要・直接レビュー可能・公開時の再現性 |
| Environments | local development / AWS production(public) の 2 種 | MVP は staging を作らない。hosting 差異は config で切替 |
| Resource sizing | S3 標準・CloudFront 既定・低トラフィック想定 | 教育用 MVP・低負荷。auto-scaling 該当なし（静的配信） |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Amazon S3 | origin storage | private bucket・Block Public Access ON・bucket policy は CloudFront OAC service principal のみ許可・（rollback 用に）Versioning 有効化可 | website endpoint 不使用（REST origin） |
| Amazon CloudFront | cdn / edge | OAC で S3 保護・HTTPS・Default Root Object index.html・GET/HEAD・compression・ResponseHeadersPolicy 付与・（path routing 時）custom error response で SPA fallback | 配信と security header の付与点 |
| CloudFront Response Headers Policy | security header | CSP/nosniff/Referrer-Policy/(HSTS) を付与（security-design の baseline を実装値へ） | AWS 側の security header source of truth |
| OAC（Origin Access Control） | access control | CloudFront→S3 REST origin の署名アクセス | OAI ではなく OAC を使用 |
| DNS（任意） | dns | 独自ドメインを使う場合のみ Route 53 / ACM 証明書。MVP は CloudFront ドメインで可 | 必須ではない |
| GitHub Pages | alternate cdn/host | 同一 source を Pages 用 config で build・配信 | AWS 失敗時の暫定 fallback / 審査後 |
| （非該当）DB / cache / queue / search / load-balancer | — | N/A | backend/API/DB/queue/検索なし（C2） |

## Shared Infrastructure

該当なし（deployable unit は U1 単一。複数 unit 間で共有するリソースは存在しない）。

## Hosting portability（NFR6.1）

- **same application source + hosting-specific configuration**: AWS/Pages で異なるのは build/deploy config（Vite `base`、SPA fallback 実現手段、security header 実現手段）のみ。application logic は fork しない。
- security header の実現差: AWS=CloudFront Response Headers Policy（full）、Pages=`<meta>` CSP（best-effort、`frame-ancestors` 等は不可）。詳細は `../nfr-design/security-design.md` と本 spec の Deployment/CI を参照。

## Sources
- consumes: `../nfr-design/performance-design.md`, `../nfr-design/security-design.md`（CSP baseline）, `../nfr-design/logical-components.md`, `../nfr-requirements/*`, `../functional-design/functional-spec.md`。
- handoff: code-generation（CloudFormation テンプレート・pipeline 実装）、Operation（実 provision/deploy・evidence）。
