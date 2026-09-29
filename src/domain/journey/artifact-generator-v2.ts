// ArtifactGenerator v2 — RC4 Phase 1。archetype content template（JSON）+ structured input +
// journey step + revision + resolved/unresolved defect から Artifact を決定的に生成する。
//
// RC3 の artifact-generator.ts（v1）との関係:
//  - v1 は STATIC_ITEMS / DEFECT_ITEM_KEYS を TS に hardcode し、revision を artifactId にしか使わなかった。
//  - v2 は本文を TS に hardcode せず、content template（JSON, content-loader 検証済み）から引く。
//    slot × content-state（baseline / defective / corrected）で item 本文が実際に変わる（RC4 の核）。
//  - artifactId 生成規則・quotedUserText・provenance・consequence 注入の「構造」は v1 と互換に保つ。
//    これにより review-evaluator / journey-engine の identity 前提を壊さない。
//
// pure・決定的（time / random / locale / mode 非参照）。runtime AI を使わない。
// Ground Truth（どの defect が有効か）は defect-catalog が structured から決める。v2 は本文選択のみを担う
// ので、mode を変えても Ground Truth は不変（v2 は mode を受け取らない）。
import type {
  AcceptedFactRef,
  ArtifactItem,
  ArtifactKind,
  DefectDefinition,
  DesignReviewSectionId,
  GeneratedArtifact,
  JourneyStepId,
  ProjectContextInput,
  UserAuthoredFieldId,
} from "./journey-entities.ts";
import { defectsForStep } from "./defect-catalog.ts";
import { clampStage, resolutionStateAt } from "./defect-resolution.ts";
import type { ArchetypeContentCatalog, ValidatedStepContent } from "../../content/content-loader.ts";
import { DomainInvariantError } from "../errors.ts";

const STEP_KIND: Record<JourneyStepId, ArtifactKind> = {
  "j1-requirements": "requirements",
  "j2-acceptance-scope": "acceptance-criteria",
  "j3-design": "design",
  "j4-implementation-traceability": "traceability",
  "j5-test-strategy": "test-strategy",
  "j6-test-evidence": "evidence",
  "j7-completion-approval": "completion-approval",
  "j8-release-approval": "release-approval",
};

export interface GenerateArtifactV2Args {
  readonly stepId: JourneyStepId;
  /** Journey/Profile identity（artifact identity へ含める・v1 と互換）。 */
  readonly profileId: string;
  readonly context: ProjectContextInput;
  readonly defects: readonly DefectDefinition[];
  /** localRevision（この step のローカル改訂回数）。フィールド名は歴史的経緯で revision。 */
  readonly revision: number;
  /**
   * artifactVersion（RC4 Phase 3）。artifactId に反映する content 全体 version。
   * 正式経路（journey-engine）は必ず明示的に渡す。未指定時は revision へ fallback するが、
   * これは direct test / legacy compatibility 専用（正式経路では使わない）。
   */
  readonly artifactVersion?: number | undefined;
  /** 検証済み archetype content catalog（content-loader の出力）。 */
  readonly contentCatalog: ArchetypeContentCatalog;
  /**
   * このリビジョンで解決済み（terminal stage 到達）の defect id（Rework で前進）。
   * ここに含まれる defect の slot は corrected 本文になる。RC4 Phase 1 では通常空。
   */
  readonly resolvedDefectIds?: readonly string[] | undefined;
  /** 前リビジョンで解決済みだった defect id（changeSummary の算出に使う・Phase 1 は空でよい）。 */
  readonly previouslyResolvedDefectIds?: readonly string[] | undefined;
  /**
   * RC4 Final: この step の各 defect の到達済み resolution stageIndex（defectId → index）。
   * multi-stage defect の partial 本文を選ぶために使う。省略時は空（= 全 defect stage 0）。
   * resolvedDefectIds（terminal）と整合すること（呼び出し側 = journey-engine が state から渡す）。
   */
  readonly defectStages?: Readonly<Record<string, number>> | undefined;
  /**
   * 上流 defect による downstream 伝播効果（RC4 Phase 3 で双方向へ拡張）。
   * kind: "worsened"（未解決の悪化）/ "improved"（Rework 解決による改善）。
   * いずれも informational item（採点母集団外・FIX 1）として注入する。
   */
  readonly injectedConsequences?:
    | readonly {
        readonly manifestItemKey: string;
        readonly sourceStepId: JourneyStepId;
        readonly kind?: "worsened" | "improved" | undefined;
      }[]
    | undefined;
  /**
   * RC6 P1-B: この step が前提として扱う accepted upstream fact（確定済みの上流値）。
   * generator は本文選択には使わず、artifact.acceptedFacts へそのまま載せる（下流提示のため）。
   * 省略時は空。
   */
  readonly acceptedFacts?: readonly AcceptedFactRef[] | undefined;
  /**
   * RC6 P1-C / Parameter Sensitivity: structured input を artifact へ observable に ground する
   * 文脈 informational item 群（data classification / workload 等）。
   * 各要素は { id, labelKey, bodyKey }。bodyKey は structured 値で変わる（値ごとに別文言）。
   * informational（採点母集団外）として注入するので TP/FP/FN には影響しない。省略時は注入しない。
   */
  readonly contextGroundingItems?:
    | readonly { readonly id: string; readonly labelKey: string; readonly bodyKey: string }[]
    | undefined;
}

/** 定義済み field のみを含む quote object を作る（exactOptionalPropertyTypes 対応・v1 と同一）。 */
function pickDefined(
  ua: ProjectContextInput["userAuthored"],
  fields: readonly UserAuthoredFieldId[],
): GeneratedArtifact["quotedUserText"] {
  const out: Partial<Record<UserAuthoredFieldId, string>> = {};
  for (const f of fields) {
    const v = ua[f];
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/** user-authored 自由文の quote 対象（step ごと・v1 と同一）。 */
function quotedFor(
  stepId: JourneyStepId,
  context: ProjectContextInput,
): GeneratedArtifact["quotedUserText"] {
  const ua = context.userAuthored;
  switch (stepId) {
    case "j1-requirements":
      return pickDefined(ua, ["goal", "requirements", "constraints"]);
    case "j2-acceptance-scope":
      return pickDefined(ua, ["acceptanceCriteria", "requirements"]);
    case "j3-design":
      return pickDefined(ua, ["constraints", "projectContext"]);
    default:
      return {};
  }
}

/**
 * Artifact を決定的に生成する（v2）。
 *
 * 項目順は content template の slot 定義順で固定（決定的）。各 slot は:
 *  - defect 無し slot        → baseline 本文（contentState: "baseline"）
 *  - defect 有り・解決済み    → corrected 本文（contentState: "corrected"）
 *  - defect 有り・未解決      → defective 本文（contentState: "defective"）
 * の順で本文を選ぶ。defect が「有効」でない（structured で activate されていない）slot は
 * baseline を出す（欠陥は無い＝ clean）。
 *
 * artifactId は RC4 正式 identity `art__{profileId}__{stepId}__v{artifactVersion}`。同一入力 → 同一 id。
 * （RC3 v1 の `__r{revision}` は RC4 finalization で retire 済み。）
 */
export function generateArtifactV2(args: GenerateArtifactV2Args): GeneratedArtifact {
  const { stepId, profileId, context, defects, revision, contentCatalog } = args;
  const archetypeId = context.archetypeId;

  const archetype = contentCatalog.byArchetype.get(archetypeId);
  if (archetype === undefined) {
    throw new DomainInvariantError(`archetype content が見つかりません: ${archetypeId}`);
  }
  const stepContent: ValidatedStepContent | undefined = archetype.steps.get(stepId);

  const resolvedSet = new Set(args.resolvedDefectIds ?? []);
  const prevResolvedSet = new Set(args.previouslyResolvedDefectIds ?? []);
  const stageByDefectId = args.defectStages ?? {};

  // この step で有効な defect（Ground Truth）を itemId と defectId で引けるようにする。
  const stepDefects = defectsForStep(defects, stepId);
  const defectByItemId = new Map<string, DefectDefinition>();
  const defectById = new Map<string, DefectDefinition>();
  const activeDefectIds = new Set<string>();
  for (const d of stepDefects) {
    defectByItemId.set(d.itemId, d);
    defectById.set(d.defectId, d);
    activeDefectIds.add(d.defectId);
  }

  const items: ArtifactItem[] = [];
  const resolvedDefectIds: string[] = [];
  const unresolvedDefectIds: string[] = [];
  const changeSummaryKeys: string[] = [];

  // approval step（J7/J8）は content template に step content を持たない（items 空・v1 と同一）。
  if (stepContent !== undefined) {
    for (const slot of stepContent.slots) {
      // defect slot かつ「その defect が有効」なときだけ defect 挙動。無効なら baseline（clean）。
      const slotDefectActive = slot.defectId !== undefined && activeDefectIds.has(slot.defectId);

      if (slotDefectActive && slot.defectId !== undefined) {
        const defect = defectById.get(slot.defectId);
        // RC4 Final: multi-stage defect は到達済み stageIndex で本文を選ぶ。
        // stageIndex は resolvedSet（terminal）と defectStages（中間）から決定的に導く。
        const stageIndex =
          defect !== undefined
            ? resolvedSet.has(slot.defectId)
              ? // terminal に達している（resolved）→ 最終 stage。
                clampStage(defect, Number.MAX_SAFE_INTEGER)
              : clampStage(defect, stageByDefectId[slot.defectId] ?? 0)
            : resolvedSet.has(slot.defectId)
              ? 1
              : 0;
        const resolvedState =
          defect !== undefined ? resolutionStateAt(defect, stageIndex) : resolvedSet.has(slot.defectId) ? "resolved" : "unresolved";
        const isResolved = resolvedState === "resolved";
        const isPartial = resolvedState === "partial";

        if (isResolved) {
          resolvedDefectIds.push(slot.defectId);
        } else {
          unresolvedDefectIds.push(slot.defectId);
        }
        // 前 revision から content state が前進した slot は変更点（Diff / change summary）。
        const prevResolved = prevResolvedSet.has(slot.defectId);
        // stage の本文・メタは content template（slot.stages）を優先（per-archetype・data-driven）。
        // defect-catalog（archetype 非依存）は stage の state/isTerminal 構造のみを持つ。
        const slotStage = slot.stages?.find((s) => s.stageIndex === stageIndex) ?? undefined;
        // 変更サマリ: multi-stage は stage 固有 key、無ければ slot の changeSummaryKey。
        const changeSummaryKey = slotStage?.changeSummaryKey ?? slot.changeSummaryKey;
        // corrected 到達 or partial 前進のとき、前回と state が違えば変更点として記録。
        if (!prevResolved && (isResolved || isPartial) && changeSummaryKey !== undefined) {
          changeSummaryKeys.push(changeSummaryKey);
        }

        // 本文選択:
        //  - multi-stage: slot.stages の bodyKey（per-archetype・data-driven）。
        //    無ければ catalog stage の bodyKey（後方互換・通常は未使用）。
        //  - binary: 従来どおり defective / corrected（content-loader が両方の存在を保証）。
        const catalogStageBodyKey = defect?.resolutionStages?.find(
          (s) => s.stageIndex === stageIndex,
        )?.bodyKey;
        const bodyKey =
          slotStage?.bodyKey ??
          catalogStageBodyKey ??
          (isResolved ? (slot.correctedBodyKey as string) : (slot.defectiveBodyKey as string));

        const contentState: NonNullable<ArtifactItem["contentState"]> = isResolved
          ? "corrected"
          : isPartial
            ? "partial"
            : "defective";

        items.push({
          itemId: slot.slotId,
          labelKey: slot.labelKey,
          bodyKey,
          sectionId: slot.sectionId as DesignReviewSectionId | string | undefined,
          reviewability: slot.reviewability,
          userDerived: slot.reviewability === "non-scored",
          defectId: defectByItemId.get(slot.slotId)?.defectId ?? slot.defectId,
          distractor: slot.distractor,
          contentState,
          // multi-stage は stage index を variantKey に含めて Diff で確実に別扱いにする。
          variantKey: `${slot.slotId}::${contentState}::s${stageIndex}`,
          // RC6 P2: この slot 自身の変更サマリ（finding 単位）。Diff Engine が別 finding の理由を
          // reuse しないよう、item に直接紐づける（corrected/partial のときのみ）。
          ...((isResolved || isPartial) && changeSummaryKey !== undefined
            ? { changeSummaryKey }
            : {}),
          ...(defect?.resolutionStages !== undefined ? { resolutionStageIndex: stageIndex } : {}),
          ...(isPartial && slotStage?.remainingIssueKey !== undefined
            ? { remainingIssueKey: slotStage.remainingIssueKey }
            : {}),
          ...(isPartial && slotStage?.whyInsufficientKey !== undefined
            ? { whyInsufficientKey: slotStage.whyInsufficientKey }
            : {}),
        });
      } else {
        // baseline（defect 無し、または defect が structured で activate されていない）。
        items.push({
          itemId: slot.slotId,
          labelKey: slot.labelKey,
          bodyKey: slot.baselineBodyKey,
          sectionId: slot.sectionId as DesignReviewSectionId | string | undefined,
          reviewability: slot.reviewability,
          userDerived: slot.reviewability === "non-scored",
          distractor: slot.distractor,
          contentState: "baseline",
          variantKey: `${slot.slotId}::baseline`,
        });
      }
    }
  }

  // downstream 伝播効果の差し込み（RC4 Phase 3・双方向）。informational で採点母集団から除外。
  //  - worsened: 上流の未解決欠陥が後工程で顕在化した悪化 item（従来の consequence）。
  //  - improved: 上流の Rework 解決により後工程が改善された item（gap 解消）。
  const consequences = args.injectedConsequences ?? [];
  consequences.forEach((c, idx) => {
    const kind = c.kind ?? "worsened";
    items.push({
      itemId: `consequence-${stepId}-${idx}`,
      labelKey: kind === "improved" ? "rc4.prop.improved.label" : "rc3.consequence.label",
      bodyKey: c.manifestItemKey,
      reviewability: "informational",
      userDerived: false,
      originStepId: c.sourceStepId,
      contentState: kind === "improved" ? "corrected" : "baseline",
    });
  });

  // RC6 P1-C / Parameter Sensitivity: structured 由来の文脈 grounding item を informational として明示する。
  // 値ごとに bodyKey（文言）が変わるので、「structured input が artifact content を変える」ことを
  // observable に保証する。informational（採点母集団外）なので TP/FP/FN には影響しない（over-review 化しない）。
  const groundingItems = args.contextGroundingItems ?? [];
  for (const g of groundingItems) {
    items.push({
      itemId: `${g.id}-${stepId}`,
      labelKey: g.labelKey,
      bodyKey: g.bodyKey,
      reviewability: "informational",
      userDerived: false,
      contentState: "baseline",
      variantKey: `${g.id}::${g.bodyKey}`,
    });
  }

  const titleKey = stepContent?.titleKey ?? `rc4.${archetypeId}.${stepId}.title`;
  const summaryKey = stepContent?.summaryKey ?? `rc4.${archetypeId}.${stepId}.summary`;
  const provenanceRef = stepContent?.provenanceKey ?? `rc3.pv.${stepId}`;

  // RC4 Phase 3: artifactId は artifactVersion を使う（hash 不使用）。generator は決定せず受け取って反映するだけ。
  // fallback（?? revision）は direct test / legacy compatibility 専用（正式経路 journey-engine は明示渡し）。
  const artifactVersion = args.artifactVersion ?? revision;

  return {
    artifactId: `art__${profileId}__${stepId}__v${artifactVersion}`,
    journeyStepId: stepId,
    kind: STEP_KIND[stepId],
    titleKey,
    summaryKey,
    items,
    quotedUserText: quotedFor(stepId, context),
    provenanceRefs: [provenanceRef],
    revision,
    artifactVersion,
    status: "under-review",
    archetypeId,
    resolvedDefectIds,
    unresolvedDefectIds,
    changeSummaryKeys,
    carriedConditionKeys: [],
    // RC6 P1-B: 上流で確定した accepted fact を artifact へ載せる（本文選択には使わない・提示のみ）。
    acceptedFacts: args.acceptedFacts ?? [],
  };
}
