// Content Template JSON の境界 schema（zod）— RC4 Phase 1。
//
// Archetype content template（archetype → journey step → slot → variant）を検証する唯一の
// external JSON validation boundary の一部（scenario-loader.ts と同じ流儀）。
// unknown フィールドは reject（BR1.2 相当）。silent fallback しない・malformed は明示 error。
//
// data / logic 分離（tech-stack rule / Human Decision 11）: 本文テキストは JSON が持たず、
// すべて locale key（`*Key`）で参照する。Generator（logic）は本文を hardcode しない。
// defect semantic（defect-catalog.ts）と content template を過度に密結合しない:
// slot は `defectId` で defect を参照するだけで、activation 条件は content template に持たない。
import { z } from "zod";

const stableId = z.string().min(1);
const localeKey = z.string().min(1);

/** 4 Archetype の固定 id（journey-entities.ts の PROJECT_ARCHETYPE_IDS と一致）。 */
const archetypeId = z.enum([
  "internal-api-workflow",
  "document-search",
  "event-driven-processing",
  "customer-facing-app",
]);

/** Core Journey の 8 Step（journey-entities.ts の JourneyStepId と一致）。 */
const journeyStepId = z.enum([
  "j1-requirements",
  "j2-acceptance-scope",
  "j3-design",
  "j4-implementation-traceability",
  "j5-test-strategy",
  "j6-test-evidence",
  "j7-completion-approval",
  "j8-release-approval",
]);

/** 採点可能性（journey-entities.ts の ArtifactItemReviewability と一致）。 */
const reviewability = z.enum(["finding-candidate", "informational", "non-scored"]);

/**
 * 1 slot の定義。slot は Artifact 内の 1 項目 = Review 対象の最小単位に対応する。
 * baseline は常時、defective/corrected は defect が紐づく slot のみ。
 * defectId がある slot は defectiveBodyKey / correctedBodyKey の両方を持つこと（loader が検証）。
 */
const slotSchema = z
  .object({
    slotId: stableId,
    labelKey: localeKey,
    /** section 区分（J3 の functional-domain / nfr-architecture 等）。省略時は既定 section。 */
    sectionId: z.string().min(1).optional(),
    reviewability,
    /** distractor（罠だが valid）。finding-candidate のまま。 */
    distractor: z.boolean().optional(),
    /** 常時表示される本文（clean baseline）。 */
    baselineBodyKey: localeKey,
    /** この slot に紐づく defect id（defect-catalog.ts の defectId と対応）。 */
    defectId: stableId.optional(),
    /** defect が有効かつ未解決のときの本文（欠陥あり）。defectId がある slot は必須（loader 検証）。 */
    defectiveBodyKey: localeKey.optional(),
    /** defect が Rework で解決済みのときの本文（改善後）。defectId がある slot は必須（loader 検証）。 */
    correctedBodyKey: localeKey.optional(),
    /** defective→corrected になった際の変更サマリ locale key（Diff 表示用・任意）。 */
    changeSummaryKey: localeKey.optional(),
    /**
     * RC4 Final: data-driven multi-stage resolution の per-archetype 本文。
     * multi-stage defect（defect-catalog が resolutionStages を宣言）のみ持つ。
     * stageIndex は defect-catalog の resolutionStages と対応（0 起点・昇順）。
     * stage 本文をここに置くことで archetype 固有の題材を保ちつつ domain（catalog）を非依存に保つ。
     */
    stages: z
      .array(
        z
          .object({
            stageIndex: z.number().int().min(0),
            bodyKey: localeKey,
            changeSummaryKey: localeKey.optional(),
            remainingIssueKey: localeKey.optional(),
            whyInsufficientKey: localeKey.optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

/** 1 journey step の content（この archetype における当該 step の slot 群 + タイトル）。 */
const stepContentSchema = z
  .object({
    journeyStepId,
    titleKey: localeKey,
    summaryKey: localeKey,
    provenanceKey: localeKey.optional(),
    slots: z.array(slotSchema),
  })
  .strict();

/** 現時点で受け入れる content template schemaVersion（unknown は reject）。 */
export const SUPPORTED_CONTENT_SCHEMA_VERSIONS: readonly number[] = [1];

/** 1 Archetype の content template ファイル全体（JSON ルート）。 */
export const archetypeContentSchema = z
  .object({
    schemaVersion: z
      .number()
      .int()
      .refine((v) => SUPPORTED_CONTENT_SCHEMA_VERSIONS.includes(v), {
        message: `未対応の content schemaVersion です（対応: ${SUPPORTED_CONTENT_SCHEMA_VERSIONS.join(", ")}）`,
      }),
    archetypeId,
    /** archetype 表示名 locale key（UI の Setup で提示）。 */
    titleKey: localeKey,
    summaryKey: localeKey,
    steps: z.array(stepContentSchema).min(1),
  })
  .strict();

export type ArchetypeContentInput = z.infer<typeof archetypeContentSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type StepContentInput = z.infer<typeof stepContentSchema>;
