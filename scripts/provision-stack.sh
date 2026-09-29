#!/usr/bin/env bash
#
# provision-stack.sh — create/update the RC4 preview CloudFormation stack.
#
# Creates the private S3 bucket + OAC + CloudFront distribution + security-headers
# policy defined in deploy/cloudformation/static-site.yaml. Idempotent: re-running
# updates the stack in place. No account id / credentials are hard-coded (AWS CLI
# default credential chain is used).
#
# Usage:
#   scripts/provision-stack.sh [STACK_NAME] [AWS_REGION]
# Defaults:
#   STACK_NAME = aidlc-learning-simulator-preview   (override: arg 1 or $STACK_NAME)
#   AWS_REGION = ap-northeast-1                      (override: arg 2 or $AWS_REGION)

set -euo pipefail

STACK_NAME="${1:-${STACK_NAME:-aidlc-learning-simulator-preview}}"
AWS_REGION="${2:-${AWS_REGION:-ap-northeast-1}}"
TEMPLATE="deploy/cloudformation/static-site.yaml"

command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found on PATH." >&2; exit 1; }
[ -f "${TEMPLATE}" ] || { echo "ERROR: ${TEMPLATE} not found (run from repo root)." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "ERROR: AWS credentials not configured." >&2; exit 1; }

echo "==> Deploying stack ${STACK_NAME} in ${AWS_REGION}…"
# No IAM resources are created, but --capabilities is harmless and future-proof.
aws cloudformation deploy \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --template-file "${TEMPLATE}" \
  --no-fail-on-empty-changeset

echo "==> Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs" \
  --output table

echo ""
echo "==> Next: scripts/deploy-preview.sh ${STACK_NAME} ${AWS_REGION}"
