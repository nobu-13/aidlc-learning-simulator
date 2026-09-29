// JourneyEngine — RC3 の中核。Profile + Mode + Review 列から、Artifact 生成・評価・consequence・
// 9 Dimension 集約を決定的にまとめる（Design §16 architecture）。
//
// pure・決定的（time / random / locale 非参照）。Ground Truth（defect set）は mode 不変。
// mode は consequence の「提示/伝播の仕方」（policy）にのみ影響し、defect の有無や 9 Dimension の
// 計算規則は変えない。runtime AI は使わない。
import type { ExperienceMode } from "../entities.ts";
import type {
  ApprovalDecision,
  ArtifactReview,
  DefectDefinition,
  GeneratedArtifact,
  JourneyStepId,
} from "./journey-entities.ts";
import { JOURNEY_STEP_IDS } from "./journey-entities.ts";
import { buildDefectSet, defectsForStep } from "./defect-catalog.ts";
import { generateArtifactV2 } from "./artifact-generator-v2.ts";
import { loadArchetypeContentCatalog } from "../../content/index.ts";
import type { ArchetypeContentCatalog } from "../../content/content-loader.ts";
import { evaluateArtifactReview, type ReviewEvaluation } from "./review-evaluator.ts";
import {
  approvalToDimensionContributions,
  reviewToDimensionContributions,
  type DimensionContribution,
} from "./dimension-effect-adapter.ts";
import {
  computeConsequences,
  consequenceContributions,
  type ConsequenceManifestation,
} from "./consequence-engine.ts";
import { foldJourneyContributions, type JourneyDimensionOutcome } from "./journey-result.ts";
import { journeyModePolicyFor } from "./mode-policy.ts";
import type { JourneyProfile } from "./journey-profiles.ts";
import { revisionOf, resolvedDefectIdsOf, type JourneyProgress } from "./rework-state-machine.ts";

/** Journey 実行の入力。 */
export interface JourneyRunInput {
  readonly profile: JourneyProfile;
  readonly mode: ExperienceMode;
  readonly progress: JourneyProgress;
  /** step id → その step に対する User の Review（未実施の step は無し）。 */
  readonly reviews: Readonly<Partial<Record<JourneyStepId, ArtifactReview>>>;
  /** J7 Completion / J8 Release の承認判断（未実施なら無し）。 */
  readonly completionDecision?: ApprovalDecision | undefined;
  readonly releaseDecision?: ApprovalDecision | undefined;
  /** Release で Completion を混同したか（UI が「completion 通過を理由に無条件 release」を検出して渡す）。 */
  readonly releaseConflatedWithCompletion?: boolean | undefined;
  /**
   * 検証済み archetype content catalog（RC4）。省略時は build-time 同梱の catalog を使う。
   * テストで in-memory の catalog を注入するために optional にする（決定性は catalog に閉じる）。
   */
  readonly contentCatalog?: ArchetypeContentCatalog | undefined;
}

/** input から content catalog を解決する（未指定なら同梱 catalog）。 */
function catalogOf(input: JourneyRunInput): ArchetypeContentCatalog {
  return input.contentCatalog ?? loadArchetypeContentCatalog();
}

/**
 * 指定 step の「直前 revision 時点で解決済みだった defect id」を rework 履歴から決定的に導く（RC4 Phase 2）。
 * 現在の resolvedDefectIds から「最後にその step を対象にした Return で追加された分」を除いた集合。
 * これにより changeSummaryKeys が「今回の Return で corrected になった slot」だけを指す。
 * 履歴に該当 Return が無ければ空（= 全 resolved が「今回分」扱いだが、Phase 2 の acceptance は本文変化で足りる）。
 */
function previouslyResolvedForStep(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): readonly string[] {
  const current = new Set(resolvedDefectIdsOf(progress, stepId));
  // 最後にこの step を対象にした rework entry を探す。
  let lastTargeted: readonly string[] | undefined;
  for (const e of progress.reworkHistory) {
    if (e.toStepId === stepId) lastTargeted = e.targetedDefectIds ?? [];
  }
  if (lastTargeted === undefined) return [...current];
  const prev = new Set(current);
  for (const id of lastTargeted) prev.delete(id);
  return [...prev];
}

/** 指定 step の Artifact を生成する（consequence 伝播は mode policy に従う）。 */
export function buildArtifactForStep(
  input: JourneyRunInput,
  stepId: JourneyStepId,
): GeneratedArtifact {
  const defects = buildDefectSet(input.profile.context.structured, input.profile.profileDefectRules);
  const policy = journeyModePolicyFor(input.mode);

  // Adoption（propagateConsequences=true）のみ、既に見逃した defect の manifestation を注入する。
  let injectedConsequences: readonly { manifestItemKey: string; sourceStepId: JourneyStepId }[] = [];
  if (policy.propagateConsequences) {
    const missed = collectMissedDefectsBefore(input, stepId, defects);
    const consequences = computeConsequences(missed);
    injectedConsequences = consequences
      .filter((c) => c.atStepId === stepId)
      .map((c) => ({ manifestItemKey: c.manifestItemKey, sourceStepId: c.sourceStepId }));
  }

  return generateArtifactV2({
    stepId,
    profileId: input.profile.profileId,
    context: input.profile.context,
    defects,
    revision: revisionOf(input.progress, stepId),
    contentCatalog: catalogOf(input),
    resolvedDefectIds: resolvedDefectIdsOf(input.progress, stepId),
    previouslyResolvedDefectIds: previouslyResolvedForStep(input.progress, stepId),
    injectedConsequences,
  });
}

/** stepId より前（進行順で手前）の step で見逃した defect を集める。 */
function collectMissedDefectsBefore(
  input: JourneyRunInput,
  stepId: JourneyStepId,
  defects: readonly DefectDefinition[],
): readonly DefectDefinition[] {
  const targetIdx = JOURNEY_STEP_IDS.indexOf(stepId);
  const missed: DefectDefinition[] = [];
  for (const s of JOURNEY_STEP_IDS) {
    if (JOURNEY_STEP_IDS.indexOf(s) >= targetIdx) break;
    const review = input.reviews[s];
    if (review === undefined) continue;
    const artifact = generateArtifactV2({
      stepId: s,
      profileId: input.profile.profileId,
      context: input.profile.context,
      defects,
      revision: revisionOf(input.progress, s),
      contentCatalog: catalogOf(input),
      resolvedDefectIds: resolvedDefectIdsOf(input.progress, s),
      previouslyResolvedDefectIds: previouslyResolvedForStep(input.progress, s),
    });
    const evalResult = evaluateArtifactReview(artifact, defects, review);
    for (const id of evalResult.missedItemIds) {
      const d = defects.find((x) => x.itemId === id && x.journeyStepId === s);
      if (d !== undefined) missed.push(d);
    }
  }
  return missed;
}

/** step id 付きの評価結果（stepId を artifactId からパースしない・FIX 3）。 */
export interface StepReviewEvaluation {
  readonly stepId: JourneyStepId;
  readonly evaluation: ReviewEvaluation;
}

/**
 * 全 step の Review を評価する（決定的）。未 Review の step は含めない。
 * stepId は反復元から直接持つ（artifactId のパースに依存しない）。
 * review/artifact の identity 不一致は evaluateArtifactReview が DomainInvariantError で reject する（FIX 3）。
 */
export function evaluateAllReviews(input: JourneyRunInput): readonly StepReviewEvaluation[] {
  const defects = buildDefectSet(input.profile.context.structured, input.profile.profileDefectRules);
  const out: StepReviewEvaluation[] = [];
  for (const stepId of JOURNEY_STEP_IDS) {
    const review = input.reviews[stepId];
    if (review === undefined) continue;
    const artifact = generateArtifactV2({
      stepId,
      profileId: input.profile.profileId,
      context: input.profile.context,
      defects,
      revision: revisionOf(input.progress, stepId),
      contentCatalog: catalogOf(input),
      resolvedDefectIds: resolvedDefectIdsOf(input.progress, stepId),
      previouslyResolvedDefectIds: previouslyResolvedForStep(input.progress, stepId),
    });
    out.push({ stepId, evaluation: evaluateArtifactReview(artifact, defects, review) });
  }
  return out;
}

/** Journey 全体の最終結果（9 Dimension + consequence + 診断集約）。 */
export interface JourneyFinalResult {
  readonly dimensionOutcomes: readonly JourneyDimensionOutcome[];
  readonly consequences: readonly ConsequenceManifestation[];
  readonly reviewEvaluations: readonly ReviewEvaluation[];
  readonly totalCaught: number;
  readonly totalMissed: number;
  readonly totalFalse: number;
}

/**
 * Journey 全体を評価して最終結果を決定的に構築する。
 * Review 寄与 + consequence 寄与 + 承認寄与 を集約し、既存 semantic で 9 Dimension へ畳み込む。
 */
export function computeJourneyResult(input: JourneyRunInput): JourneyFinalResult {
  const defects = buildDefectSet(input.profile.context.structured, input.profile.profileDefectRules);
  const stepEvaluations = evaluateAllReviews(input);

  const contributions: DimensionContribution[] = [];
  const missedDefects: DefectDefinition[] = [];
  let totalCaught = 0;
  let totalMissed = 0;
  let totalFalse = 0;

  for (const { stepId, evaluation } of stepEvaluations) {
    const stepDefs = defectsForStep(defects, stepId);
    contributions.push(...reviewToDimensionContributions(evaluation, stepDefs));
    totalCaught += evaluation.caughtItemIds.length;
    totalMissed += evaluation.missedItemIds.length;
    totalFalse += evaluation.falseItemIds.length;
    for (const id of evaluation.missedItemIds) {
      const d = defects.find((x) => x.itemId === id && x.journeyStepId === stepId);
      if (d !== undefined) missedDefects.push(d);
    }
  }

  const consequences = computeConsequences(missedDefects);
  contributions.push(...consequenceContributions(consequences));

  // 承認寄与（Completion / Release）。
  const unresolved = totalMissed;
  if (input.completionDecision !== undefined) {
    contributions.push(
      ...approvalToDimensionContributions({
        decision: input.completionDecision,
        unresolvedFindingCount: unresolved,
        isRelease: false,
      }),
    );
  }
  if (input.releaseDecision !== undefined) {
    contributions.push(
      ...approvalToDimensionContributions({
        decision: input.releaseDecision,
        unresolvedFindingCount: unresolved,
        isRelease: true,
        conflatedWithCompletion: input.releaseConflatedWithCompletion,
        remainingRiskHigh: consequences.length > 0,
      }),
    );
  }

  return {
    dimensionOutcomes: foldJourneyContributions(contributions),
    consequences,
    reviewEvaluations: stepEvaluations.map((s) => s.evaluation),
    totalCaught,
    totalMissed,
    totalFalse,
  };
}
