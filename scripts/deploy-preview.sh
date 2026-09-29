#!/usr/bin/env bash
#
# deploy-preview.sh — RC4 preview deployment helper (Blind Product Audit).
#
# Flow: build -> resolve stack outputs -> S3 sync -> CloudFront invalidation.
#
# NOTHING is hard-coded: AWS account id / credentials come from the caller's
# environment (AWS CLI default chain: env vars, SSO, profile). The S3 bucket name
# and CloudFront distribution id are READ from the CloudFormation stack outputs,
# never embedded here. No secrets are written or printed.
#
# Prerequisites:
#   - AWS CLI v2 configured (aws sts get-caller-identity must succeed)
#   - The CloudFormation stack (deploy/cloudformation/static-site.yaml) already deployed
#   - Node/npm for the Vite build
#
# Usage:
#   scripts/deploy-preview.sh [STACK_NAME] [AWS_REGION]
# Defaults:
#   STACK_NAME  = aidlc-learning-simulator-preview   (override: arg 1 or $STACK_NAME)
#   AWS_REGION  = ap-northeast-1                      (override: arg 2 or $AWS_REGION)
#
# The bucket is region-scoped; CloudFront is global. Run from the repo root.

set -euo pipefail

STACK_NAME="${1:-${STACK_NAME:-aidlc-learning-simulator-preview}}"
AWS_REGION="${2:-${AWS_REGION:-ap-northeast-1}}"
DIST_DIR="dist"

echo "==> Stack:  ${STACK_NAME}"
echo "==> Region: ${AWS_REGION}"

# --- Preconditions --------------------------------------------------------
command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found on PATH." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm not found on PATH." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "ERROR: AWS credentials not configured." >&2; exit 1; }

# --- Build (real Vite output) --------------------------------------------
echo "==> Building (npm run build)…"
npm run build
[ -f "${DIST_DIR}/index.html" ] || { echo "ERROR: ${DIST_DIR}/index.html missing after build." >&2; exit 1; }

# --- Resolve stack outputs (no hard-coded names) --------------------------
echo "==> Resolving stack outputs…"
get_output() {
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
BUCKET="$(get_output BucketName)"
DIST_ID="$(get_output DistributionId)"
PUBLIC_URL="$(get_output PublicUrl)"

[ -n "${BUCKET}" ] && [ "${BUCKET}" != "None" ] || { echo "ERROR: could not read BucketName output. Is the stack deployed?" >&2; exit 1; }
[ -n "${DIST_ID}" ] && [ "${DIST_ID}" != "None" ] || { echo "ERROR: could not read DistributionId output." >&2; exit 1; }

echo "    bucket=${BUCKET}"
echo "    distribution=${DIST_ID}"

# --- S3 sync --------------------------------------------------------------
# Hashed asset filenames get long cache; index.html must not be cached long
# (so a new deploy is picked up). --delete removes stale objects.
echo "==> Syncing hashed assets (long cache)…"
aws s3 sync "${DIST_DIR}/" "s3://${BUCKET}/" \
  --region "${AWS_REGION}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

echo "==> Uploading index.html (no long cache)…"
aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --region "${AWS_REGION}" \
  --cache-control "no-cache"

# --- CloudFront invalidation ---------------------------------------------
echo "==> Invalidating CloudFront cache…"
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text

echo ""
echo "==> Done. Preview URL: ${PUBLIC_URL}"
echo "    (CloudFront propagation may take a few minutes.)"
