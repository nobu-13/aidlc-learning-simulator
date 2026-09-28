// ArtifactGenerator — structured input + Journey Step + Profile から Artifact を決定的に生成する
// （Design §3 / §7 / 要件 7）。random / time 禁止。同一入力 → 同一 Artifact。
//
// 各 step は「常に出す valid 項目」＋「distractor（罠だが valid）」＋「有効な defect に対応する項目」で構成。
// defect が 1 件も無い step は clean artifact になる（要件 7: 必ず finding があると学習させない）。
// user-authored 自由文は quote のみ（semantic 生成に使わない・Design §8）。
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

const STEP_TITLE_KEY: Record<JourneyStepId, string> = {
  "j1-requirements": "rc3.artifact.j1.title",
  "j2-acceptance-scope": "rc3.artifact.j2.title",
  "j3-design": "rc3.artifact.j3.title",
  "j4-implementation-traceability": "rc3.artifact.j4.title",
  "j5-test-strategy": "rc3.artifact.j5.title",
  "j6-test-evidence": "rc3.artifact.j6.title",
  "j7-completion-approval": "rc3.artifact.j7.title",
  "j8-release-approval": "rc3.artifact.j8.title",
};

const STEP_SUMMARY_KEY: Record<JourneyStepId, string> = {
  "j1-requirements": "rc3.artifact.j1.summary",
  "j2-acceptance-scope": "rc3.artifact.j2.summary",
  "j3-design": "rc3.artifact.j3.summary",
  "j4-implementation-traceability": "rc3.artifact.j4.summary",
  "j5-test-strategy": "rc3.artifact.j5.summary",
  "j6-test-evidence": "rc3.artifact.j6.summary",
  "j7-completion-approval": "rc3.artifact.j7.summary",
  "j8-release-approval": "rc3.artifact.j8.summary",
};

/** 各 step が常に持つ valid 項目（clean baseline）と distractor。決定的・固定。 */
interface StaticItemSpec {
  readonly itemId: string;
  readonly labelKey: string;
  readonly bodyKey: string;
  readonly sectionId?: DesignReviewSectionId | string | undefined;
  readonly distractor?: boolean | undefined;
}

const STATIC_ITEMS: Record<JourneyStepId, readonly StaticItemSpec[]> = {
  "j1-requirements": [
    { itemId: "req-item-goal", labelKey: "rc3.item.j1.goal", bodyKey: "rc3.item.j1.goal.body" },
    { itemId: "req-item-valid", labelKey: "rc3.item.j1.valid", bodyKey: "rc3.item.j1.valid.body" },
    { itemId: "req-item-distractor", labelKey: "rc3.item.j1.distractor", bodyKey: "rc3.item.j1.distractor.body", distractor: true },
  ],
  "j2-acceptance-scope": [
    { itemId: "ac-item-valid", labelKey: "rc3.item.j2.valid", bodyKey: "rc3.item.j2.valid.body" },
    { itemId: "ac-item-distractor", labelKey: "rc3.item.j2.distractor", bodyKey: "rc3.item.j2.distractor.body", distractor: true },
  ],
  "j3-design": [
    { itemId: "design-item-fd-valid", labelKey: "rc3.item.j3.fdValid", bodyKey: "rc3.item.j3.fdValid.body", sectionId: "functional-domain" },
    { itemId: "design-item-nfr-valid", labelKey: "rc3.item.j3.nfrValid", bodyKey: "rc3.item.j3.nfrValid.body", sectionId: "nfr-architecture" },
    { itemId: "design-item-distractor", labelKey: "rc3.item.j3.distractor", bodyKey: "rc3.item.j3.distractor.body", sectionId: "functional-domain", distractor: true },
  ],
  "j4-implementation-traceability": [
    { itemId: "trace-item-valid", labelKey: "rc3.item.j4.valid", bodyKey: "rc3.item.j4.valid.body" },
    { itemId: "trace-item-distractor", labelKey: "rc3.item.j4.distractor", bodyKey: "rc3.item.j4.distractor.body", distractor: true },
  ],
  "j5-test-strategy": [
    { itemId: "teststrat-item-valid", labelKey: "rc3.item.j5.valid", bodyKey: "rc3.item.j5.valid.body" },
  ],
  "j6-test-evidence": [
    { itemId: "evidence-item-valid", labelKey: "rc3.item.j6.valid", bodyKey: "rc3.item.j6.valid.body" },
    { itemId: "evidence-item-distractor", labelKey: "rc3.item.j6.distractor", bodyKey: "rc3.item.j6.distractor.body", distractor: true },
  ],
  "j7-completion-approval": [],
  "j8-release-approval": [],
};

/** defect id → 表示 label/body key（defect 項目の見た目）。 */
const DEFECT_ITEM_KEYS: Record<string, { labelKey: string; bodyKey: string; sectionId?: string }> = {
  "req-item-omission": { labelKey: "rc3.item.j1.omission", bodyKey: "rc3.item.j1.omission.body" },
  "ac-item-mismatch": { labelKey: "rc3.item.j2.mismatch", bodyKey: "rc3.item.j2.mismatch.body" },
  "ac-item-scope-creep": { labelKey: "rc3.item.j2.scopeCreep", bodyKey: "rc3.item.j2.scopeCreep.body" },
  "design-item-missing-nfr": { labelKey: "rc3.item.j3.missingNfr", bodyKey: "rc3.item.j3.missingNfr.body", sectionId: "nfr-architecture" },
  "design-item-saas-logging": { labelKey: "rc3.item.j3.saasLogging", bodyKey: "rc3.item.j3.saasLogging.body", sectionId: "nfr-architecture" },
  "design-item-delegation": { labelKey: "rc3.item.j3.delegation", bodyKey: "rc3.item.j3.delegation.body", sectionId: "functional-domain" },
  "trace-item-gap": { labelKey: "rc3.item.j4.gap", bodyKey: "rc3.item.j4.gap.body" },
  "teststrat-item-coverage": { labelKey: "rc3.item.j5.coverage", bodyKey: "rc3.item.j5.coverage.body" },
  "evidence-item-insufficient": { labelKey: "rc3.item.j6.insufficient", bodyKey: "rc3.item.j6.insufficient.body" },
};

export interface GenerateArtifactArgs {
  readonly stepId: JourneyStepId;
  /** Journey/Profile identity（artifact identity へ含める・FIX 3）。stable/safe token。 */
  readonly profileId: string;
  readonly context: ProjectContextInput;
  readonly defects: readonly DefectDefinition[];
  readonly revision: number;
  /**
   * 見逃した defect による consequence 差し込み（Adoption の伝播・Design §13 / P2-3）。
   * ここに渡された manifest は「顕在化した問題」として Artifact に決定的に追加される。
   * sourceStepId は由来工程（UI が「前段の見逃し由来」であることを示すため）。
   */
  readonly injectedConsequences?: readonly {
    readonly manifestItemKey: string;
    readonly sourceStepId: JourneyStepId;
  }[] | undefined;
}

/** 定義済み field のみを含む quote object を作る（exactOptionalPropertyTypes 対応）。 */
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

/** user-authored 自由文の quote 対象（step ごとに引用する field）。 */
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
 * Artifact を決定的に生成する。項目順は「static valid → defect（defectId 昇順）→ consequence」で固定。
 * artifactId は step + revision から決定的に導く（同一入力 → 同一 id）。
 */
export function generateArtifact(args: GenerateArtifactArgs): GeneratedArtifact {
  const { stepId, profileId, context, defects, revision } = args;
  const items: ArtifactItem[] = [];

  // 1) static valid / distractor 項目（clean baseline）。いずれも finding-candidate。
  for (const s of STATIC_ITEMS[stepId]) {
    items.push({
      itemId: s.itemId,
      labelKey: s.labelKey,
      bodyKey: s.bodyKey,
      sectionId: s.sectionId,
      reviewability: "finding-candidate",
      userDerived: false,
      distractor: s.distractor,
    });
  }

  // 2) 有効な defect に対応する項目（defectId 昇順で決定的）。
  const stepDefects = defectsForStep(defects, stepId)
    .slice()
    .sort((a, b) => (a.defectId < b.defectId ? -1 : a.defectId > b.defectId ? 1 : 0));
  for (const d of stepDefects) {
    const keys = DEFECT_ITEM_KEYS[d.itemId];
    if (keys === undefined) continue;
    items.push({
      itemId: d.itemId,
      labelKey: keys.labelKey,
      bodyKey: keys.bodyKey,
      sectionId: keys.sectionId,
      reviewability: "finding-candidate",
      userDerived: false,
      defectId: d.defectId,
    });
  }

  // 3) consequence 差し込み（見逃し伝播）。前段の見逃しで顕在化した「情報」であり、新しい Finding 候補ではない。
  //    reviewability=informational で明示し、採点母集団から除外する（FIX 1）。distractor は使わない。
  const consequences = args.injectedConsequences ?? [];
  consequences.forEach((c, idx) => {
    items.push({
      itemId: `consequence-${stepId}-${idx}`,
      labelKey: "rc3.consequence.label",
      bodyKey: c.manifestItemKey,
      reviewability: "informational",
      userDerived: false,
      originStepId: c.sourceStepId,
    });
  });

  return {
    // artifact identity: profile + step + revision（FIX 3）。異なる Project は異なる id。
    artifactId: `art__${profileId}__${stepId}__r${revision}`,
    journeyStepId: stepId,
    kind: STEP_KIND[stepId],
    titleKey: STEP_TITLE_KEY[stepId],
    summaryKey: STEP_SUMMARY_KEY[stepId],
    items,
    quotedUserText: quotedFor(stepId, context),
    provenanceRefs: [`rc3.pv.${stepId}`],
    revision,
    status: "under-review",
  };
}
