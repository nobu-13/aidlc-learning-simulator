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
  readonly revision: number;
  /** 検証済み archetype content catalog（content-loader の出力）。 */
  readonly contentCatalog: ArchetypeContentCatalog;
  /**
   * このリビジョンで解決済みの defect id（Rework で前進）。
   * ここに含まれる defect の slot は corrected 本文になる。RC4 Phase 1 では通常空。
   */
  readonly resolvedDefectIds?: readonly string[] | undefined;
  /** 前リビジョンで解決済みだった defect id（changeSummary の算出に使う・Phase 1 は空でよい）。 */
  readonly previouslyResolvedDefectIds?: readonly string[] | undefined;
  /**
   * 見逃した defect による consequence 差し込み（Adoption の伝播・v1 と互換）。
   */
  readonly injectedConsequences?:
    | readonly {
        readonly manifestItemKey: string;
        readonly sourceStepId: JourneyStepId;
      }[]
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
 * artifactId は v1 と同じ `art__{profileId}__{stepId}__r{revision}`。同一入力 → 同一 id。
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

  // この step で有効な defect（Ground Truth）を itemId と defectId で引けるようにする。
  const stepDefects = defectsForStep(defects, stepId);
  const defectByItemId = new Map<string, DefectDefinition>();
  const activeDefectIds = new Set<string>();
  for (const d of stepDefects) {
    defectByItemId.set(d.itemId, d);
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
        const resolved = resolvedSet.has(slot.defectId);
        if (resolved) {
          resolvedDefectIds.push(slot.defectId);
          // 前 revision で未解決だった → このリビジョンで corrected になった = 変更点。
          if (!prevResolvedSet.has(slot.defectId) && slot.changeSummaryKey !== undefined) {
            changeSummaryKeys.push(slot.changeSummaryKey);
          }
        } else {
          unresolvedDefectIds.push(slot.defectId);
        }
        // defect slot は content-loader が defective/corrected 両方の存在を保証している。
        const bodyKey = resolved
          ? (slot.correctedBodyKey as string)
          : (slot.defectiveBodyKey as string);
        items.push({
          itemId: slot.slotId,
          labelKey: slot.labelKey,
          bodyKey,
          sectionId: slot.sectionId as DesignReviewSectionId | string | undefined,
          reviewability: slot.reviewability,
          userDerived: slot.reviewability === "non-scored",
          defectId: defectByItemId.get(slot.slotId)?.defectId ?? slot.defectId,
          distractor: slot.distractor,
          contentState: resolved ? "corrected" : "defective",
          variantKey: `${slot.slotId}::${resolved ? "corrected" : "defective"}`,
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

  // consequence 差し込み（見逃し伝播・v1 と同一構造）。informational で採点母集団から除外。
  const consequences = args.injectedConsequences ?? [];
  consequences.forEach((c, idx) => {
    items.push({
      itemId: `consequence-${stepId}-${idx}`,
      labelKey: "rc3.consequence.label",
      bodyKey: c.manifestItemKey,
      reviewability: "informational",
      userDerived: false,
      originStepId: c.sourceStepId,
      contentState: "baseline",
    });
  });

  const titleKey = stepContent?.titleKey ?? `rc4.${archetypeId}.${stepId}.title`;
  const summaryKey = stepContent?.summaryKey ?? `rc4.${archetypeId}.${stepId}.summary`;
  const provenanceRef = stepContent?.provenanceKey ?? `rc3.pv.${stepId}`;

  return {
    artifactId: `art__${profileId}__${stepId}__r${revision}`,
    journeyStepId: stepId,
    kind: STEP_KIND[stepId],
    titleKey,
    summaryKey,
    items,
    quotedUserText: quotedFor(stepId, context),
    provenanceRefs: [provenanceRef],
    revision,
    status: "under-review",
    archetypeId,
    resolvedDefectIds,
    unresolvedDefectIds,
    changeSummaryKeys,
    carriedConditionKeys: [],
  };
}
