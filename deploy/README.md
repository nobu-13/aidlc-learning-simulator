# RC4 Preview Deployment (AWS Static Hosting)

Deploys the AI-DLC Learning Simulator (Vite SPA) to AWS for a **Blind Product
Audit preview** — a stable, public HTTPS URL. This is a preview, not a
production hosting platform: no backend, no auth, no custom domain, no runtime AI.

## Architecture

```
Browser ──HTTPS──▶ CloudFront (OAC, redirect-to-https, SPA fallback)
                        │  SigV4-signed REST origin
                        ▼
                 Private S3 bucket  (Block Public Access ON, SSE-S3, versioned)
```

- **S3** holds the built `dist/` assets. It is fully private (no website
  endpoint, no public policy). Only the CloudFront distribution can read it, via
  a bucket policy scoped to `cloudfront.amazonaws.com` with an `aws:SourceArn`
  condition on this distribution (confused-deputy protection).
- **CloudFront** is the only public surface. It reads S3 through **Origin Access
  Control (OAC)** with SigV4, forces HTTPS (`redirect-to-https`), serves
  `index.html` as the default root object, applies a security-headers/CSP
  response policy, and does **SPA fallback** (403/404 → `/index.html` 200).
- **No compute.** No Lambda, API Gateway, Cognito, WAF, or Route 53.

## AWS resources created

| Logical ID | Type | Notes |
| --- | --- | --- |
| `SiteBucket` | `AWS::S3::Bucket` | Private, SSE-S3 (AES256), versioning ON, `BucketOwnerEnforced`, `DeletionPolicy: Retain`. Name auto-assigned by CloudFormation (no global-namespace collision). |
| `OriginAccessControl` | `AWS::CloudFront::OriginAccessControl` | SigV4, `SigningBehavior: always`, origin type `s3`. |
| `SecurityHeadersPolicy` | `AWS::CloudFront::ResponseHeadersPolicy` | CSP + HSTS + `X-Content-Type-Options` + `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer`. |
| `Distribution` | `AWS::CloudFront::Distribution` | REST S3 origin + OAC, `DefaultRootObject: index.html`, `ViewerProtocolPolicy: redirect-to-https`, managed CachingOptimized policy, SPA 403/404→index.html. |
| `SiteBucketPolicy` | `AWS::S3::BucketPolicy` | Allows only this distribution `s3:GetObject`; denies non-TLS access. |

No IAM roles, users, or access keys are created.

## Prerequisites

- **AWS CLI v2**, configured with credentials that can create the above
  resources (`aws sts get-caller-identity` must succeed). Credentials come from
  your environment / SSO / profile — nothing is hard-coded.
- **Node + npm** for the Vite build.
- Region: **ap-northeast-1** by default (the S3 bucket is region-scoped;
  CloudFront and its policies are global). Override with `$AWS_REGION` or the
  second script argument.

Optional (used during authoring/verification only): `cfn-lint`, `cfn-guard`.

## Deploy

From the repository root:

```bash
# 1) Provision infrastructure (create/update the CloudFormation stack)
scripts/provision-stack.sh                 # stack: aidlc-learning-simulator-preview, region: ap-northeast-1
# or: scripts/provision-stack.sh my-stack ap-northeast-1

# 2) Build + upload + invalidate
scripts/deploy-preview.sh                  # reads bucket & distribution id from stack outputs
# or: scripts/deploy-preview.sh my-stack ap-northeast-1
```

`deploy-preview.sh` prints the preview URL (CloudFront `PublicUrl` output).
First propagation can take a few minutes.

## Update (redeploy after code changes)

Re-run the build+sync+invalidate step. No infrastructure change is needed unless
the template changed:

```bash
scripts/deploy-preview.sh
```

`index.html` is uploaded with `Cache-Control: no-cache` and hashed assets with a
1-year immutable cache, then the whole distribution is invalidated (`/*`), so the
new build is served promptly.

If the CloudFormation template itself changed, run `scripts/provision-stack.sh`
first (it is idempotent) and then `scripts/deploy-preview.sh`.

## Delete / Cleanup

The bucket is `DeletionPolicy: Retain`, so a plain stack delete leaves the bucket
and its objects behind. The cleanup script empties (all versions) and deletes the
bucket, then deletes the stack:

```bash
scripts/cleanup-preview.sh                 # destructive; asks for a "yes" confirmation
```

To remove only the CloudFront/OAC/policy and keep the bucket, run
`aws cloudformation delete-stack --stack-name <name> --region <region>` and empty
the retained bucket manually.

## Security considerations

- **S3 is private.** Block Public Access is ON (all four flags); there is no S3
  website endpoint and no public bucket policy. The bucket is readable **only**
  by this CloudFront distribution (OAC + `aws:SourceArn`-scoped policy).
- **HTTPS only.** CloudFront redirects HTTP→HTTPS; the bucket policy denies any
  non-TLS request (`aws:SecureTransport = false`).
- **Least privilege.** The bucket policy grants a single action (`s3:GetObject`)
  to a single service principal, bounded to this distribution. No IAM
  principals, roles, or keys are created.
- **Security headers.** A CloudFront Response Headers Policy sets a strict CSP
  (`script-src 'self'`, `connect-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `X-Frame-Options:
  DENY`, and `Referrer-Policy: no-referrer`, consistent with the app's
  no-network posture.
- **No secrets.** The template and scripts contain no account id, credentials, or
  secrets. Everything account-specific is resolved at runtime from your AWS
  session and the stack outputs.
- **SPA fallback tradeoff.** 403/404 both resolve to `index.html` (200). This is
  what makes a refresh on any path work; the cost is that a genuinely missing
  asset also returns the SPA shell rather than a hard 404 — acceptable for a
  preview.
- **Encryption at rest.** SSE-S3 (AES256) on the bucket.

## Estimated AWS resources / cost

Preview-scale, effectively negligible for audit traffic:

- 1 S3 bucket holding a few hundred KB of static assets (well within free tier).
- 1 CloudFront distribution, `PriceClass_100` (North America + Europe edges),
  serving small static files. Data transfer for audit-level traffic is minimal.
- No always-on compute, database, or NAT — there is no idle cost beyond
  CloudFront's per-request/data pricing and negligible S3 storage.

Actual cost depends on audit traffic volume; for a Blind Product Audit it is
expected to be within or near the AWS Free Tier.
