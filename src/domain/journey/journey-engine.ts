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
import {
  derivePropagationRules,
  computePropagatedEffects,
  directUpstreamStepOf,
} from "./propagation-engine.ts";
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
import {
  openConditions as computeOpenConditions,
  type ConditionalApproval,
} from "./conditional-approval.ts";
import {
  deriveAcceptedUpstreamFacts,
  acceptedFactsForStep,
  deriveDataSensitivityGrounding,
  workloadGroundingLabelKey,
} from "./effective-scenario-state.ts";
import type { AcceptedFactRef } from "./journey-entities.ts";
import type { JourneyProfile } from "./journey-profiles.ts";
import {
  revisionOf,
  artifactVersionOf,
  materializationOf,
  resolvedDefectIdsOf,
  defectStagesOf,
  type JourneyProgress,
} from "./rework-state-machine.ts";

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
   * RC6 P1-A: この Journey で保持している Conditional Approval（step-level 含む）。
   * computeJourneyResult がここから open conditions を導き、Result / learner evaluation へ反映する。
   * 省略時は空（条件なし）。
   */
  readonly conditionalApprovals?: readonly ConditionalApproval[] | undefined;
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

/**
 * 指定 step の Artifact を生成する（RC4 Phase 3: 双方向 downstream 伝播を全 mode 共通で反映）。
 *
 * 伝播（controlled 1-hop・全 mode 共通の domain engine）:
 *  - upstream で「見逃した（未解決）」defect → この step が target なら worsened item を注入。
 *  - upstream で「Rework 解決した」defect → この step が target なら improved item を注入。
 * Ground Truth は mode 不変。表示の explanation 粗密は mode-policy が別途決める（ここでは注入のみ）。
 */
export function buildArtifactForStep(
  input: JourneyRunInput,
  stepId: JourneyStepId,
): GeneratedArtifact {
  const defects = buildDefectSet(input.profile.context.structured, input.profile.profileDefectRules);

  const injectedConsequences = computeDownstreamInjection(input, stepId, defects);

  // RC4 Phase 3 正式配線: artifactVersion は Journey state から渡す（generator は決めない）。
  // legacy state では artifactVersionOf が undefined を返す → generator 側の fallback(?? revision) に委ねる
  // ため、undefined のときは artifactVersion を渡さない（暗黙 migration しない）。
  //
  // Propagation による content 変化を artifactId へ反映する（hard invariant: same artifactId → same content）。
  // upstream state（見逃し / 解決）で downstream content が変わるのに stored artifactVersion が同じままだと、
  // 同一 artifactId で異なる content を作ってしまう。これを避けるため effective artifactVersion を導出する:
  //  - downstream が materialized 済み かつ propagation で content が変わる（injectedConsequences あり）
  //      → stored + 1（Materialization semantics: 「materialized downstream が upstream 変化で変わるなら +1」）。
  //  - downstream が未 materialized（初回生成）→ 現在の upstream state をそのまま初回 content とし、+1 しない
  //      （Materialization semantics: 「未 materialized の初回生成は artifactVersion 0」）。
  //  - legacy（artifactVersion / materialization が unknown）→ 暗黙 migration せず stored のまま。
  const artifactVersion = effectiveArtifactVersion(input.progress, stepId, injectedConsequences.length > 0);

  // RC6 P1-B: この step が前提として扱う accepted upstream fact（確定済みの上流値）を導出する。
  // 「値が無い」と再要求せず、確定済み前提として artifact に載せる。derived（永続しない）。
  const acceptedFacts = acceptedFactsForStepFromInput(input, stepId);

  // RC6 P1-C / Parameter Sensitivity: structured 由来の文脈 grounding item を組み立てる。
  const contextGroundingItems = contextGroundingItemsFor(input, stepId);

  return generateArtifactV2({
    stepId,
    profileId: input.profile.profileId,
    context: input.profile.context,
    defects,
    revision: revisionOf(input.progress, stepId),
    ...(artifactVersion !== undefined ? { artifactVersion } : {}),
    contentCatalog: catalogOf(input),
    resolvedDefectIds: resolvedDefectIdsOf(input.progress, stepId),
    previouslyResolvedDefectIds: previouslyResolvedForStep(input.progress, stepId),
    // RC4 Final: multi-stage defect の partial 本文選択のために stage 到達状況を渡す。
    defectStages: defectStagesOf(input.progress, stepId),
    injectedConsequences,
    acceptedFacts,
    ...(contextGroundingItems.length > 0 ? { contextGroundingItems } : {}),
  });
}

/** RC6: data classification を明示する step。 */
const DATA_CLASSIFICATION_STEPS: ReadonlySet<JourneyStepId> = new Set<JourneyStepId>([
  "j1-requirements",
  "j3-design",
]);

/** RC6: workload 文脈を明示する step（Design のみ）。 */
const WORKLOAD_GROUNDING_STEPS: ReadonlySet<JourneyStepId> = new Set<JourneyStepId>(["j3-design"]);

/**
 * RC6 P1-C / Parameter Sensitivity: structured 由来の文脈 grounding item 群を導出する。
 * 値ごとに bodyKey が変わり、artifact content の observable な差を保証する（Ground Truth は不変）。
 */
function contextGroundingItemsFor(
  input: JourneyRunInput,
  stepId: JourneyStepId,
): readonly { id: string; labelKey: string; bodyKey: string }[] {
  const structured = input.profile.context.structured;
  const out: { id: string; labelKey: string; bodyKey: string }[] = [];
  if (DATA_CLASSIFICATION_STEPS.has(stepId)) {
    const grounding = deriveDataSensitivityGrounding(structured.dataSensitivity);
    out.push({
      id: "data-classification",
      labelKey: "rc6.grounding.dataClassification.itemLabel",
      bodyKey: grounding.classificationLabelKey,
    });
  }
  if (WORKLOAD_GROUNDING_STEPS.has(stepId)) {
    out.push({
      id: "workload-context",
      labelKey: "rc6.grounding.workload.itemLabel",
      bodyKey: workloadGroundingLabelKey(structured.workload),
    });
  }
  return out;
}

/**
 * RC6 P1-B: 指定 step が前提として扱う accepted upstream fact を表示参照（AcceptedFactRef）へ変換する。
 * structured input から確定 fact を導き、relevantAtStepId が一致するものだけを返す。
 * 決定的（structured のみに依存）。
 */
function acceptedFactsForStepFromInput(
  input: JourneyRunInput,
  stepId: JourneyStepId,
): readonly AcceptedFactRef[] {
  const facts = deriveAcceptedUpstreamFacts(input.profile.context.structured);
  const relevant = acceptedFactsForStep(facts, stepId);
  return relevant.map((f) => ({
    factId: f.factId,
    sourceStepId: f.sourceStepId,
    // fact label は factId から決定的に導く（locale 側で用意）。
    labelKey: `rc6.fact.${f.factId}.label`,
    valueLabelKey: f.valueLabelKey,
    statementKey: f.statementKey,
  }));
}

/**
 * Propagation を織り込んだ effective artifactVersion を決定的に導く（RC4 Phase 3 Step 5）。
 *
 * stored = artifactVersionOf(progress, stepId)。propagationChangesContent は「この step に伝播効果が
 * 注入されるか」。materialized 済み downstream に伝播で content 変化が起きるときだけ stored + 1 する。
 * 未 materialized（初回生成）や伝播なしのときは stored のまま（初回は version 0 のまま）。
 * legacy（stored / materialization が undefined）は stored（undefined）を維持する（暗黙 migration しない）。
 */
function effectiveArtifactVersion(
  progress: JourneyProgress,
  stepId: JourneyStepId,
  propagationChangesContent: boolean,
): number | undefined {
  const stored = artifactVersionOf(progress, stepId);
  if (stored === undefined) return undefined; // legacy unknown。
  if (!propagationChangesContent) return stored;
  const materialized = materializationOf(progress, stepId);
  // materialized 済みのときだけ「upstream 変化による content 変化」= +1。
  // 未 materialized（初回生成）は現在の upstream state をそのまま version 0 の初回 content にする。
  return materialized === true ? stored + 1 : stored;
}

/**
 * この step に注入する双方向 downstream 伝播効果を決定的に計算する（RC4 Phase 3）。
 * 全 mode 共通。propagation-engine（1-hop・双方向）に委譲する。derived（永続しない）。
 */
function computeDownstreamInjection(
  input: JourneyRunInput,
  stepId: JourneyStepId,
  defects: readonly DefectDefinition[],
): readonly { manifestItemKey: string; sourceStepId: JourneyStepId; kind: "worsened" | "improved" }[] {
  const rules = derivePropagationRules(defects);
  if (rules.length === 0) return [];

  // 上流（この step より手前）で「未解決で見逃した」defect と「Rework 解決した」defect を集める。
  const { missed, resolved } = collectUpstreamDefectStatus(input, stepId, defects);

  const effects = computePropagatedEffects({
    rules,
    targetStepId: stepId,
    upstreamMissedDefectIds: missed,
    upstreamResolvedDefectIds: resolved,
  });
  return effects.map((e) => ({
    manifestItemKey: e.manifestItemKey,
    sourceStepId: e.originStepId,
    kind: e.kind,
  }));
}

/**
 * RC4 Phase 3（レビュー厳守事項 1）: actual 1-hop propagation の source を **direct upstream step のみ** に
 * 限定して「未解決で見逃した defect id」と「Rework 解決した defect id」を集める。
 * rule filter だけに依存せず、source collection 自体を 1-hop に閉じる。
 *
 * - resolved: direct upstream step の progress.resolvedDefectIds（Rework で解決）。
 * - missed: direct upstream step の review 済みかつ resolved でない見逃し defect id。
 * resolved が優先（resolved なら missed には数えない）。決定的。
 * direct upstream が無い（J1 / 承認 step）なら空。
 */
function collectUpstreamDefectStatus(
  input: JourneyRunInput,
  stepId: JourneyStepId,
  defects: readonly DefectDefinition[],
): { missed: ReadonlySet<string>; resolved: ReadonlySet<string> } {
  const missed = new Set<string>();
  const resolved = new Set<string>();

  const upstream = directUpstreamStepOf(stepId);
  if (upstream === undefined) return { missed, resolved };

  // resolved（direct upstream で Rework 修正済み）。
  for (const id of resolvedDefectIdsOf(input.progress, upstream)) resolved.add(id);

  // 見逃し（direct upstream の review 済みで missed、かつ resolved でない）。
  const review = input.reviews[upstream];
  if (review !== undefined) {
    // upstream artifact は buildArtifactForStep で生成する（effective artifactVersion を適用するため）。
    // 直接 generateArtifactV2 を stored version で呼ぶと、propagation で bump された displayed 版と
    // artifactId が食い違い、review identity 検証（evaluateArtifactReview）が誤って reject する。
    const artifact = buildArtifactForStep(input, upstream);
    // review が現在の upstream artifact と identity 不一致（revision/version ずれ）なら、
    // その review は現世代の見逃し判定に使えない → missed 収集をスキップする（安全側）。
    if (review.artifactId === artifact.artifactId) {
      const evalResult = evaluateArtifactReview(artifact, defects, review);
      for (const itemId of evalResult.missedItemIds) {
        const d = defects.find((x) => x.itemId === itemId && x.journeyStepId === upstream);
        if (d !== undefined) missed.add(d.defectId);
      }
    }
  }
  // resolved を missed から除外（Rework で直したものは悪化させない）。
  for (const id of resolved) missed.delete(id);
  return { missed, resolved };
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
    // buildArtifactForStep で生成する（effective artifactVersion + informational 伝播注入を含む）。
    // これにより review が捕捉された displayed artifact と artifactId が一致する（identity 検証を通す）。
    // 伝播注入は informational（採点母集団外）なので TP/FP/FN には影響しない。
    const artifact = buildArtifactForStep(input, stepId);
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
  /**
   * RC6 P1-A: 未解決の Conditional Approval（step-level / J7 / J8 由来）。
   * Result / learner evaluation / readiness が「条件は残っている」ことを勝手に推測せず参照するための
   * single source。open な条件は resolved 扱いにしない（下流で消えない）。
   */
  readonly openConditions: readonly ConditionalApproval[];
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
    // RC6 P1-A: open conditions を result へ含める（Result / learner evaluation が参照する）。
    openConditions: computeOpenConditions(input.conditionalApprovals ?? []),
  };
}
