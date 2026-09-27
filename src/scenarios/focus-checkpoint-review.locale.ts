import type { Locale } from "../domain/entities.ts";
import type { LocaleBundle } from "../i18n/locale-resources.ts";

const ja: LocaleBundle = {
  "sc.focus-checkpoint-review.title": "フォーカス：checkpoint review（検証済み Unit / batch）",
  "sc.focus-checkpoint-review.summary": "verified Unit / batch checkpoint での確認を体験する短いシナリオ（AI-DLC v2.10.0 の必須 Topic）。",
  "sc.focus-checkpoint-review.st-review.title": "Checkpoint Review",
  "sc.focus-checkpoint-review.dp-verify.prompt": "Unit の実装が完了しました。次の Unit へ進む前にどうしますか？",
  "sc.focus-checkpoint-review.o-verify-unit.label": "verified Unit として checkpoint で確認してから進む",
  "sc.focus-checkpoint-review.o-skip-verify.label": "確認せず次の Unit へ進む",
  "sc.focus-checkpoint-review.dp-batch.prompt": "複数 Unit が溜まっています。batch の扱いは？",
  "sc.focus-checkpoint-review.o-batch-checkpoint.label": "batch checkpoint で承認境界を通して確認する",
  "sc.focus-checkpoint-review.o-batch-blind.label": "まとめて無確認で承認する",
  "sc.focus-checkpoint-review.lp-checkpoint.title": "verified Unit / batch checkpoint review",
  "sc.focus-checkpoint-review.lp-checkpoint.body": "Unit / batch の checkpoint で検証してから先へ進むことで、Evidence と追跡可能性を保ち、手戻りと残存リスクを抑えます。無確認の一括承認は承認境界を空洞化させます。",
  "sc.focus-checkpoint-review.pv.spec": "verified Unit / batch checkpoint review（AI-DLC v2.10.0 一次情報）。",
  "sc.focus-checkpoint-review.pv.interp": "無確認一括承認のリスクに関するシミュレーターの教育的解釈。",
};

const en: LocaleBundle = {
  "sc.focus-checkpoint-review.title": "Focus: checkpoint review (verified Unit / batch)",
  "sc.focus-checkpoint-review.summary": "A short scenario to experience verified-Unit / batch checkpoint review (a required Topic in AI-DLC v2.10.0).",
  "sc.focus-checkpoint-review.st-review.title": "Checkpoint Review",
  "sc.focus-checkpoint-review.dp-verify.prompt": "A Unit's implementation is complete. What do you do before moving to the next Unit?",
  "sc.focus-checkpoint-review.o-verify-unit.label": "Verify it at a checkpoint as a verified Unit before proceeding",
  "sc.focus-checkpoint-review.o-skip-verify.label": "Move to the next Unit without verifying",
  "sc.focus-checkpoint-review.dp-batch.prompt": "Several Units have accumulated. How do you handle the batch?",
  "sc.focus-checkpoint-review.o-batch-checkpoint.label": "Review the batch through the approval boundary at a checkpoint",
  "sc.focus-checkpoint-review.o-batch-blind.label": "Approve the whole batch without review",
  "sc.focus-checkpoint-review.lp-checkpoint.title": "Verified Unit / batch checkpoint review",
  "sc.focus-checkpoint-review.lp-checkpoint.body": "Verifying at a Unit/batch checkpoint before proceeding preserves evidence and traceability and limits rework and residual risk. Blind bulk approval hollows out the approval boundary.",
  "sc.focus-checkpoint-review.pv.spec": "Verified Unit / batch checkpoint review (AI-DLC v2.10.0 primary source).",
  "sc.focus-checkpoint-review.pv.interp": "Simulator's educational interpretation of the risk of blind bulk approval.",
};

export const focusCheckpointReviewLocales: Readonly<Record<Locale, LocaleBundle>> = { ja, en };
