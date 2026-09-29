// JourneyProfiles — canonical Sample Project（Guided 用）と User-driven profile の組み立て
// （Design §5 / Human Decision 5）。
//
// Scenario JSON を Simulation/Adoption 用に複製しない。Journey Engine + Mode Policy で共有し、
// Guided は canonical Sample、Simulation/Adoption は User の structured input を使う。pure・決定的。
import type { DefectRule } from "./defect-catalog.ts";
import {
  STRUCTURED_INPUT_FIELD_IDS,
  type ProjectArchetypeId,
  type ProjectContextInput,
  type StructuredControlInput,
} from "./journey-entities.ts";

/**
 * default archetype（RC4）。RC3 canonical は「社内向け業務アプリ」題材だったので、
 * 未指定時の安全既定として internal-api-workflow を用いる（Human Decision 10）。
 */
export const DEFAULT_ARCHETYPE_ID: ProjectArchetypeId = "internal-api-workflow";

/** Journey の 1 Profile（Ground Truth の源となる structured input + user 引用テキスト）。 */
export interface JourneyProfile {
  readonly profileId: string;
  readonly context: ProjectContextInput;
  /** Profile 固有の追加 defect ルール（canonical Sample の学習パス実証用）。 */
  readonly profileDefectRules: readonly DefectRule[];
}

/**
 * structured control input から stable/safe な profile identity token を決定的に導出する（FIX 3）。
 * - 決定的（random / time 不使用）: 同一 structured input → 同一 token。
 * - safe: enum 値（固定語彙）のみを連結。user-authored 自由文は一切露出しない。
 * - 異なる Project/Profile（structured input が異なる）→ 異なる token（collision 回避）。
 * enum 値は英数とハイフンのみなので ID として安全。
 */
export function deriveProfileIdentity(structured: StructuredControlInput): string {
  // 固定順のフィールドを固定順の enum 値で連結（順序も決定的）。
  const parts = STRUCTURED_INPUT_FIELD_IDS.map((f) => String(structured[f]));
  return parts.join("_");
}

/**
 * canonical Sample Project（Guided）。個人情報 + 外部依存 + high availability + high criticality の
 * 「Human Review が効く」構成にして、security constraint violation / missing NFR / traceability gap /
 * insufficient evidence を一通り体験できるようにする（要件 5: 1 canonical Sample）。
 */
const CANONICAL_STRUCTURED: StructuredControlInput = {
  workload: "interactive",
  dataSensitivity: "personal-info",
  availability: "high",
  externalDependency: "some",
  operationalCriticality: "high",
  releaseImpact: "high",
  reversibility: "partially-reversible",
  approvalRequirement: "dual",
};

export const CANONICAL_SAMPLE_PROFILE: JourneyProfile = {
  // canonical は固定 prefix + structured identity で安定 & 一意。
  profileId: `sample-canonical__${deriveProfileIdentity(CANONICAL_STRUCTURED)}`,
  context: {
    archetypeId: DEFAULT_ARCHETYPE_ID,
    userAuthored: {
      goal: "rc3.sample.goal",
      projectContext: "rc3.sample.context",
      requirements: "rc3.sample.requirements",
      acceptanceCriteria: "rc3.sample.acceptanceCriteria",
      constraints: "rc3.sample.constraints",
    },
    structured: CANONICAL_STRUCTURED,
  },
  // canonical は BASE ルールだけで security-violation / missing-nfr / trace-gap 等が有効化される
  // （CANONICAL_STRUCTURED がそれらの activateWhen を満たす）。追加ルールは不要。
  profileDefectRules: [],
};

/**
 * User-driven profile を組み立てる（Simulation / Adoption）。
 * user-authored 自由文は preserve/quote のみ（semantic 採点しない・Design §8）。
 * structured input が Ground Truth。
 */
export function buildUserProfile(
  kind: string,
  userAuthored: ProjectContextInput["userAuthored"],
  structured: StructuredControlInput,
  archetypeId: ProjectArchetypeId = DEFAULT_ARCHETYPE_ID,
): JourneyProfile {
  // profileId は structured identity + archetype から決定的に導く（FIX 3 + RC4）。
  // 異なる Project（structured / archetype 差）は異なる profileId → artifactId が collision しない。
  // user-authored 自由文は identity に含めない（safe）。
  return {
    profileId: `${kind}__${archetypeId}__${deriveProfileIdentity(structured)}`,
    context: { archetypeId, userAuthored, structured },
    profileDefectRules: [],
  };
}

/** 構造化入力の既定値（User がまだ選んでいない時の decent default）。 */
export function defaultStructuredInput(): StructuredControlInput {
  return {
    workload: "interactive",
    dataSensitivity: "internal",
    availability: "standard",
    externalDependency: "some",
    operationalCriticality: "medium",
    releaseImpact: "medium",
    reversibility: "partially-reversible",
    approvalRequirement: "single",
  };
}
