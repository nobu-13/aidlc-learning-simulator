// Scenario JSON の境界 schema（zod）。唯一の raw external JSON validation boundary の一部（ADR-003 / C5）。
// unknown フィールドは reject（BR1.2）。enum / cardinality / contribution 5 段階を型で担保（BR1.5 / BR3.3）。
// 注: cross-reference（dangling）や provenance invariant 等は schema 単体では表せないため
//     scenario-loader.ts が schema 通過後に追加検証する（BR1.4 / BR1.6）。
import { z } from "zod";

const stableId = z.string().min(1);
const localeKey = z.string().min(1);

const contribution = z.enum([
  "strong-negative",
  "negative",
  "neutral",
  "positive",
  "strong-positive",
]);

const dimensionId = z.enum([
  "requirement-clarity",
  "acceptance-criteria-coverage",
  "evidence-quality",
  "approval-boundary",
  "delegation-quality",
  "risk-handling",
  "traceability",
  "rework",
  "remaining-risks",
]);

const provenanceCategory = z.enum([
  "ai-dlc-spec",
  "harness-behavior",
  "simulator-interpretation",
  "simulation-assumption",
]);

const effectConditionSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("requires-decision"),
        anyOfOptionIds: z.array(stableId).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("absent-decision"),
        noneOfOptionIds: z.array(stableId).min(1),
      })
      .strict(),
  ]);

const effectRuleSchema = z
  .object({
    effectRuleId: stableId,
    dimensionId,
    contribution,
    condition: effectConditionSchema.optional(),
    rationaleKey: localeKey.optional(),
    learningPointRef: stableId.optional(),
  })
  .strict();

const provenanceEntrySchema = z
  .object({
    provenanceId: stableId,
    category: provenanceCategory,
    reference: z.string().min(1).optional(),
    noteKey: localeKey,
  })
  .strict()
  // category=ai-dlc-spec は reference 必須（BR1.6 の一部を schema でも担保）。
  .refine((p) => p.category !== "ai-dlc-spec" || (p.reference !== undefined && p.reference.length > 0), {
    message: "ProvenanceEntry.category=ai-dlc-spec は reference（AI-DLC v2.10.0 一次情報）が必須です",
    path: ["reference"],
  });

const decisionOptionSchema = z
  .object({
    optionId: stableId,
    labelKey: localeKey,
    effectRuleRefs: z.array(stableId),
    provenanceRefs: z.array(stableId),
    nextRef: z.string().min(1).optional(),
  })
  .strict();

const decisionPointSchema = z
  .object({
    decisionPointId: stableId,
    promptKey: localeKey,
    // DecisionPoint は 2..n の option（BR1.5）。
    optionIds: z.array(stableId).min(2),
    learningPointRefs: z.array(stableId),
    important: z.boolean(),
    provenanceRefs: z.array(stableId),
  })
  .strict();

const stageSchema = z
  .object({
    stageId: stableId,
    titleKey: localeKey,
    decisionPointIds: z.array(stableId),
  })
  .strict();

const learningPointSchema = z
  .object({
    learningPointId: stableId,
    conceptId: z.string().min(1),
    titleKey: localeKey,
    bodyKey: localeKey,
    // provenance 必須（BR1.5 / BR4.3）。
    provenanceRefs: z.array(stableId).min(1),
    betterAlternativeRef: stableId.optional(),
  })
  .strict();

const scenarioSchema = z
  .object({
    scenarioId: stableId,
    kind: z.enum(["core", "focus"]),
    titleKey: localeKey,
    summaryKey: localeKey,
    learningObjectiveIds: z.array(z.string().min(1)).min(1),
    stageIds: z.array(stableId).min(1),
    learningPointIds: z.array(stableId).min(1),
    tags: z.array(z.string().min(1)),
    provenanceRefs: z.array(stableId),
  })
  .strict();

/** 現時点で受け入れる Scenario schemaVersion 集合（unknown は reject・BR1.7）。 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

export const scenarioSetSchema = z
  .object({
    schemaVersion: z
      .number()
      .int()
      .refine((v) => SUPPORTED_SCHEMA_VERSIONS.includes(v), {
        message: `未対応の schemaVersion です（対応: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}）`,
      }),
    scenario: scenarioSchema,
    stages: z.array(stageSchema).min(1),
    decisionPoints: z.array(decisionPointSchema),
    decisionOptions: z.array(decisionOptionSchema),
    learningPoints: z.array(learningPointSchema).min(1),
    effectRules: z.array(effectRuleSchema),
    provenanceEntries: z.array(provenanceEntrySchema),
  })
  .strict();

export type ScenarioSetInput = z.infer<typeof scenarioSetSchema>;
