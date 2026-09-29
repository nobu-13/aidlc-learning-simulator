#!/usr/bin/env bash
#
# cleanup-preview.sh — tear down the RC4 preview.
#
# The S3 bucket uses DeletionPolicy: Retain, so CloudFormation will NOT delete it
# (or its objects) on stack delete. This script empties the bucket (all versions),
# deletes it, then deletes the stack (which removes CloudFront/OAC/policy).
#
# DESTRUCTIVE. Requires an explicit "yes" confirmation.
#
# Usage:
#   scripts/cleanup-preview.sh [STACK_NAME] [AWS_REGION]
# Defaults:
#   STACK_NAME = aidlc-learning-simulator-preview
#   AWS_REGION = ap-northeast-1

set -euo pipefail

STACK_NAME="${1:-${STACK_NAME:-aidlc-learning-simulator-preview}}"
AWS_REGION="${2:-${AWS_REGION:-ap-northeast-1}}"

command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found on PATH." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "ERROR: AWS credentials not configured." >&2; exit 1; }

BUCKET="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text 2>/dev/null || true)"

echo "This will DELETE the preview stack '${STACK_NAME}' (${AWS_REGION})"
[ -n "${BUCKET}" ] && [ "${BUCKET}" != "None" ] && echo "and PERMANENTLY empty + delete bucket '${BUCKET}' (all object versions)."
read -r -p "Type 'yes' to proceed: " CONFIRM
[ "${CONFIRM}" = "yes" ] || { echo "Aborted."; exit 1; }

# --- Empty the retained bucket (all versions + delete markers) ------------
if [ -n "${BUCKET}" ] && [ "${BUCKET}" != "None" ]; then
  echo "==> Emptying bucket ${BUCKET}…"
  # Remove current objects first (fast path).
  aws s3 rm "s3://${BUCKET}/" --recursive --region "${AWS_REGION}" || true
  # Remove all noncurrent versions and delete markers (versioning is ON).
  VERSIONS="$(aws s3api list-object-versions --bucket "${BUCKET}" --region "${AWS_REGION}" \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null || echo '{}')"
  if [ "$(echo "${VERSIONS}" | grep -c '"Key"')" -gt 0 ]; then
    aws s3api delete-objects --bucket "${BUCKET}" --region "${AWS_REGION}" --delete "${VERSIONS}" >/dev/null || true
  fi
  MARKERS="$(aws s3api list-object-versions --bucket "${BUCKET}" --region "${AWS_REGION}" \
    --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null || echo '{}')"
  if [ "$(echo "${MARKERS}" | grep -c '"Key"')" -gt 0 ]; then
    aws s3api delete-objects --bucket "${BUCKET}" --region "${AWS_REGION}" --delete "${MARKERS}" >/dev/null || true
  fi
  echo "==> Deleting bucket ${BUCKET}…"
  aws s3api delete-bucket --bucket "${BUCKET}" --region "${AWS_REGION}" || true
fi

# --- Delete the stack (CloudFront, OAC, policies) -------------------------
echo "==> Deleting stack ${STACK_NAME}…"
aws cloudformation delete-stack --stack-name "${STACK_NAME}" --region "${AWS_REGION}"
echo "==> delete-stack requested. Track with:"
echo "    aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${AWS_REGION}"
